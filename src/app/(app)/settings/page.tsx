"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/app";
import { Avatar, Button, Card, Field, Page, Segmented, Sheet, Toggle, TopBar, useConfirm, useHide, useToast } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { usePush } from "@/components/push";
import { api, ApiError, logout } from "@/lib/client";
import { useAccounts } from "@/lib/hooks";
import { CURRENCIES } from "@/lib/money";

function Tile({ icon, bg }: { icon: IconName | string; bg: string }) {
  return <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-white" style={{ background: bg }}>{icon.length <= 2 ? <span className="text-sm font-bold">{icon}</span> : <Icon name={icon as IconName} size={16} stroke={2} />}</span>;
}

function Line({ icon, bg, title, sub, right, href, onClick }: { icon: IconName | string; bg: string; title: string; sub?: string; right?: React.ReactNode; href?: string; onClick?: () => void }) {
  const inner = (
    <>
      <Tile icon={icon} bg={bg} />
      <span className="flex flex-1 flex-col gap-px"><span className="text-[15px]">{title}</span>{sub && <span className="text-xs text-muted">{sub}</span>}</span>
      {right}
      {(href || onClick) && !right && <Icon name="chevron" size={16} stroke={2} className="text-muted" />}
    </>
  );
  const cls = "flex w-full items-center gap-3 py-2.5 text-left";
  if (href) return <Link href={href} className={cls}>{inner}</Link>;
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}

function Select({ value, onChange, children, label }: { value: string; onChange: (v: string) => void; children: React.ReactNode; label: string }) {
  return (
    <span className="relative flex items-center gap-1 text-sm text-muted">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none bg-transparent pr-4 text-right text-sm text-muted outline-none">{children}</select>
      <Icon name="down" size={14} stroke={2} className="pointer-events-none absolute right-0" />
    </span>
  );
}

export default function SettingsPage() {
  const { user, saveSettings } = useApp();
  const { data: acc } = useAccounts();
  const toast = useToast();
  const confirm = useConfirm();
  const push = usePush();
  const hide = useHide();
  const [sheet, setSheet] = useState<null | "profile" | "password" | "delete">(null);

  const set = async (patch: Record<string, unknown>) => {
    try { await saveSettings(patch); } catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't save", "error"); }
  };
  const logout = async () => {
    if (!(await confirm({ title: "Log out of Pocket?", confirm: "Log out", danger: true }))) return;
    await logout();
  };
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [user.timezone];

  return (
    <Page nav={false}>
      <TopBar back="/wallets" title="Settings" />
      <button onClick={() => setSheet("profile")} className="flex items-center gap-3 rounded-[22px] bg-card px-4 py-3 text-left">
        <Avatar name={user.name} ink size={48} />
        <span className="flex flex-1 flex-col gap-0.5"><span className="text-base font-bold">{user.name}</span><span className="text-[13px] text-muted">{user.email}</span></span>
        <Icon name="chevron" size={16} stroke={2} className="text-muted" />
      </button>

      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        <Line icon={CURRENCIES[user.currency]?.symbol.slice(0, 2) ?? "¤"} bg="#13824F" title="Currency" right={<Select label="Currency" value={user.currency} onChange={(v) => set({ currency: v })}>{Object.keys(CURRENCIES).map((c) => <option key={c}>{c}</option>)}</Select>} />
        <Line icon="calendar" bg="#2F5BEA" title="Month starts on" sub="Handy if you're paid on a set day" right={<Select label="Month starts on" value={String(user.monthStartDay)} onChange={(v) => set({ monthStartDay: Number(v) })}>{Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>{ord(i + 1)}</option>)}</Select>} />
        <Line icon="calendar" bg="#0E7490" title="Week starts on" right={<Select label="Week starts on" value={String(user.weekStartsOn)} onChange={(v) => set({ weekStartsOn: Number(v) })}><option value="1">Monday</option><option value="0">Sunday</option></Select>} />
        <Line icon="wallet" bg="#6B3FD6" title="Default account" right={<Select label="Default account" value={user.defaultAccount ?? ""} onChange={(v) => set({ defaultAccount: v || null })}><option value="">First account</option>{acc?.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>} />
        <Line icon="clock" bg="#5F6672" title="Time zone" right={<Select label="Time zone" value={user.timezone} onChange={(v) => set({ timezone: v })}>{zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</Select>} />
        <div className="flex items-center gap-3 py-2.5">
          <Tile icon="moon" bg="#111318" />
          <span className="flex-1 text-[15px]">Appearance</span>
          <div className="w-[170px]"><Segmented size="sm" value={user.theme} onChange={(v) => set({ theme: v })} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "auto", label: "Auto" }]} /></div>
        </div>
      </Card>

      <Card id="notifications" className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        {push.state !== "granted" || !push.subscribed ? (
          <Line icon="bell" bg="#FF5A36" title="Phone notifications" sub={push.state === "needs-install" ? "Add Pocket to your Home Screen first" : push.state === "denied" ? "Blocked — allow in iPhone Settings" : push.state === "unsupported" ? "Not supported in this browser" : "Off"}
            right={push.state === "default" || (push.state === "granted" && !push.subscribed) ? <button onClick={() => push.enable().then((ok) => ok && toast("Notifications on")).catch((e) => toast(e.message, "error"))} className="h-8 rounded-lg bg-ink px-3 text-[13px] font-bold text-bg">Turn on</button> : <span />} />
        ) : (
          <Line icon="bell" bg="#FF5A36" title="Phone notifications" sub="On for this device" right={<button onClick={() => push.disable()} className="text-[13px] font-semibold text-muted">Turn off</button>} />
        )}
        <div className="flex items-center gap-3 py-2.5">
          <Tile icon="clock" bg="#D9541E" />
          <span className="flex flex-1 flex-col gap-px"><span className="text-[15px]">Daily reminder</span>
            <input type="time" aria-label="Reminder time" value={user.reminder.time} onChange={(e) => e.target.value && set({ reminder: { ...user.reminder, time: e.target.value } })} className="w-fit bg-transparent text-xs text-muted outline-none" />
          </span>
          <Toggle label="Daily reminder" checked={user.reminder.enabled} onChange={(v) => set({ reminder: { ...user.reminder, enabled: v } })} />
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <Tile icon="warning" bg="#A66A00" />
          <span className="flex-1 text-[15px]">Budget &amp; bill alerts</span>
          <Toggle label="Budget and bill alerts" checked={user.alerts} onChange={(v) => set({ alerts: v })} />
        </div>
        <div className="flex items-center gap-3 py-2.5">
          <Tile icon="eyeOff" bg="#5F6672" />
          <span className="flex flex-1 flex-col gap-px"><span className="text-[15px]">Hide amounts</span><span className="text-xs text-muted">Tap the eye on Home to peek</span></span>
          <Toggle label="Hide amounts" checked={hide.hidden} onChange={() => hide.toggle()} />
        </div>
      </Card>

      <Card className="px-4 py-0.5 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-line">
        <Line icon="lock" bg="#111318" title="App lock & Face ID" href="/settings/lock" right={<span className="flex items-center gap-1 text-sm text-muted">{user.lock.enabled ? "On" : "Off"}<Icon name="chevron" size={16} stroke={2} /></span>} />
        <Line icon="download" bg="#2F5BEA" title="Export & backup" href="/settings/export" />
        <Line icon="grid" bg="#C2335C" title="Categories" href="/categories" />
        <Line icon="repeat" bg="#0E7490" title="Recurring" href="/recurring" />
        <Line icon="lock" bg="#5F6672" title="Change password" onClick={() => setSheet("password")} />
      </Card>

      <Button variant="secondary" size="md" onClick={logout} className="!text-neg">Log out</Button>
      <button onClick={() => setSheet("delete")} className="text-center text-[13px] font-semibold text-muted">Delete my account</button>
      <span className="text-center text-xs text-faint">Pocket 1.0</span>

      {sheet === "profile" && <ProfileSheet onClose={() => setSheet(null)} />}
      {sheet === "password" && <PasswordSheet onClose={() => setSheet(null)} />}
      {sheet === "delete" && <DeleteSheet onClose={() => setSheet(null)} />}
    </Page>
  );
}

function ord(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function useClose(onClose: () => void) {
  const [open, setOpen] = useState(true);
  return [open, (o: boolean) => { setOpen(o); if (!o) setTimeout(onClose, 300); }] as const;
}

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { user, saveSettings } = useApp();
  const toast = useToast();
  const [open, close] = useClose(onClose);
  const [name, setName] = useState(user.name);
  return (
    <Sheet open={open} onOpenChange={close} title="Your profile" top={300}>
      <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <p className="-mt-2 px-1 text-xs text-muted">Signed in as {user.email}</p>
      <Button disabled={!name.trim()} onClick={() => saveSettings({ name: name.trim() }).then(() => { toast("Saved"); close(false); }).catch((e) => toast(e.message, "error"))}>Save</Button>
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [open, close] = useClose(onClose);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api("/api/me/password", { body: { current, next } }); toast("Password changed. Other devices were signed out."); close(false); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't change it", "error"); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onOpenChange={close} title="Change password" top={200}>
      <Field label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      <Field label="New password" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
      <Button loading={busy} disabled={!current || next.length < 8} onClick={save}>Change password</Button>
    </Sheet>
  );
}

function DeleteSheet({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [open, close] = useClose(onClose);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await api("/api/me", { method: "DELETE", body: { password: pw } }); window.location.href = "/signup"; }
    catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't delete", "error"); setBusy(false); }
  };
  return (
    <Sheet open={open} onOpenChange={close} title="Delete account" top={200}>
      <p className="rounded-2xl bg-neg-bg p-4 text-sm leading-relaxed text-neg">This permanently deletes your accounts, transactions, budgets and goals. Download a backup first if you might want them later.</p>
      <Link href="/settings/export" className="text-center text-sm font-bold">Download a backup</Link>
      <Field label="Type your password to confirm" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <Button variant="danger" loading={busy} disabled={!pw} onClick={go}>Delete everything</Button>
    </Sheet>
  );
}
