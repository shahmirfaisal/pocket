"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app";
import { CatIcon, Money, Spinner, useToast } from "@/components/ui";
import { Icon } from "@/components/icons";
import { api, ApiError, haptic } from "@/lib/client";
import { useCategories } from "@/lib/hooks";
import { compressImage, parseReceipt } from "@/lib/receipt";
import { MONTHS } from "@/lib/dates";

type Result = ReturnType<typeof parseReceipt>;

export default function ScanPage() {
  const { user, open } = useApp();
  const router = useRouter();
  const toast = useToast();
  const { data: catData } = useCategories();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState<"starting" | "on" | "off">("starting");
  const [torch, setTorch] = useState(false);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [status, setStatus] = useState<null | string>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const stop = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        setCamera("on");
      } catch {
        setCamera("off");
      }
    })();
    return () => { cancelled = true; stop(); };
  }, []);

  const toggleTorch = async () => {
    const track = stream.current?.getVideoTracks()[0];
    try { await track?.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] }); setTorch(!torch); } catch { toast("Flash isn't available here", "info"); }
  };

  const process = useCallback(async (blob: Blob) => {
    const small = await compressImage(blob);
    setPhoto({ blob: small, url: URL.createObjectURL(small) });
    stop();
    setCamera("off");
    setStatus("Reading receipt…");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        // Served by Pocket itself (copied from node_modules at build time), not a CDN.
        workerPath: "/tesseract/worker.min.js",
        corePath: "/tesseract/core",
        langPath: "/tesseract/lang",
        gzip: true,
        logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && setStatus(`Reading receipt… ${Math.round(m.progress * 100)}%`),
      });
      const { data } = await worker.recognize(small);
      await worker.terminate();
      const r = parseReceipt(data.text, catData?.categories ?? []);
      setResult(r);
      haptic(10);
      setStatus(null);
    } catch (e) {
      console.error(e);
      setResult({ total: null, merchant: null, date: null, category: null });
      setStatus(null);
      toast("Couldn't read this receipt — you can fill it in by hand", "info");
    }
  }, [catData, toast]);

  const shoot = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    haptic(12);
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => b && process(b), "image/jpeg", 0.92);
  };

  const use = async () => {
    if (!photo) return;
    setBusy(true);
    let receipt: string | null = null;
    try {
      const form = new FormData();
      form.append("file", new File([photo.blob], "receipt.jpg", { type: "image/jpeg" }));
      receipt = (await api<{ name: string }>("/api/receipts", { form })).name;
    } catch (e) {
      toast(e instanceof ApiError ? `Photo not saved: ${e.message}` : "Photo not saved (offline?)", "info");
    }
    open("add", {
      type: "expense",
      prefill: { amount: result?.total ?? undefined, category: result?.category?.id ?? null, note: result?.merchant ?? "", date: result?.date?.toISOString(), receipt },
    });
    router.replace("/");
  };

  const retake = () => window.location.reload();

  return (
    <div className="fixed inset-0 bg-[#0B0C0F] text-[#F3F4F6]">
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_40%,#2A2622_0%,#0B0C0F_70%)]" />
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo.url} alt="Receipt" className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      )}

      <header className="absolute inset-x-5 z-10 flex items-center justify-between" style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}>
        <button aria-label="Close" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur"><Icon name="close" size={16} stroke={2.4} /></button>
        <span className="text-[15px] font-bold">Scan receipt</span>
        <button aria-label="Flash" onClick={toggleTorch} disabled={camera !== "on"} className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur disabled:opacity-30 ${torch ? "bg-white text-black" : "bg-white/15"}`}><Icon name="flash" size={18} /></button>
      </header>

      {!photo && camera === "on" && (
        <svg className="pointer-events-none absolute left-1/2 top-[45%] h-[60%] max-h-[420px] w-[72%] max-w-[300px] -translate-x-1/2 -translate-y-1/2" viewBox="0 0 270 366" preserveAspectRatio="none" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" aria-hidden>
          <path d="M2 32V8a6 6 0 0 1 6-6h24M238 2h24a6 6 0 0 1 6 6v24M268 334v24a6 6 0 0 1-6 6h-24M32 364H8a6 6 0 0 1-6-6v-24" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      {!photo && camera === "off" && (
        <div className="absolute inset-x-8 top-1/3 flex flex-col items-center gap-3 text-center">
          <Icon name="camera" size={40} />
          <span className="text-lg font-bold">Take a photo of the receipt</span>
          <span className="text-sm text-[#9AA0AA]">Tap the button below to open the camera or choose a photo.</span>
        </div>
      )}
      {!photo && camera === "starting" && <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div>}

      {(status || result) && (
        <section className="absolute inset-x-4 z-10 flex flex-col gap-2.5 rounded-[22px] bg-[rgba(28,31,37,0.92)] px-4 py-3.5 backdrop-blur-xl" style={{ bottom: "calc(env(safe-area-inset-bottom) + 132px)" }}>
          {status ? (
            <span className="flex items-center gap-2.5 text-sm font-semibold"><Spinner className="!h-4 !w-4" />{status}</span>
          ) : result && (
            <>
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[#7FD8A8]"><span className="h-2 w-2 rounded-full bg-[#34C77B]" />{result.total ? "Receipt found" : "Couldn't find a total — you can type it"}</span>
              <div className="flex items-center gap-3">
                <CatIcon emoji={result.category?.emoji ?? "🧾"} color={result.category?.color ?? "#3A2A22"} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="truncate text-[15px] font-bold">{result.merchant ?? "Receipt"}</span><span className="text-xs text-[#9AA0AA]">{result.category?.name ?? "Pick a category"}{result.date ? ` · ${result.date.getDate()} ${MONTHS[result.date.getMonth()]}` : ""}</span></span>
                {result.total ? <Money value={result.total} currency={user.currency} className="text-[17px] font-extrabold" /> : null}
              </div>
              <button onClick={use} disabled={busy} className="flex h-11 items-center justify-center rounded-[14px] bg-[#F3F4F6] text-[15px] font-bold text-[#0B0C0F] disabled:opacity-60">{busy ? <Spinner /> : "Use these details"}</button>
            </>
          )}
        </section>
      )}

      <div className="absolute inset-x-0 z-10 flex items-center justify-around" style={{ bottom: "calc(env(safe-area-inset-bottom) + 36px)" }}>
        <button aria-label="Choose from photos" onClick={() => fileRef.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-[14px] border-2 border-white/50 bg-[#3A3530]"><Icon name="photo" /></button>
        {photo ? (
          <button onClick={retake} className="h-[76px] rounded-full border-4 border-white px-6 text-[15px] font-bold">Retake</button>
        ) : (
          <button aria-label="Take photo" onClick={() => (camera === "on" ? shoot() : fileRef.current?.click())} className="h-[76px] w-[76px] rounded-full border-4 border-white p-1"><span className="block h-full w-full rounded-full bg-white" /></button>
        )}
        <span className="w-12 text-center text-xs font-semibold text-[#9AA0AA]">{camera === "on" ? "Auto" : ""}</span>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) process(f); e.target.value = ""; }} />
    </div>
  );
}
