// Copies the receipt-scanning (Tesseract OCR) files into public/tesseract so the app
// serves them itself: no third-party CDN, and scanning keeps working offline once loaded.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "public", "tesseract");
const nm = (...p) => path.join(root, "node_modules", ...p);
fs.mkdirSync(path.join(out, "core"), { recursive: true });
fs.mkdirSync(path.join(out, "lang"), { recursive: true });

const copy = (from, to) => fs.copyFileSync(from, path.join(out, to));
copy(nm("tesseract.js", "dist", "worker.min.js"), "worker.min.js");
for (const f of fs.readdirSync(nm("tesseract.js-core"))) {
  if (/^tesseract-core(-simd|-relaxedsimd)?-lstm\.wasm\.js$/.test(f)) copy(nm("tesseract.js-core", f), path.join("core", f));
}
copy(nm("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), path.join("lang", "eng.traineddata.gz"));
console.log("OCR files copied to public/tesseract");
