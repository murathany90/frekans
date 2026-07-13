import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const manifest = JSON.parse(readFileSync("data/manifest.json", "utf8"));

const requiredIds = [
  "autoDataSummary",
  "useAutoDataBtn",
  "useManualDataBtn",
  "reloadAutoDataBtn",
  "dateSelect",
  "frequencyChart",
  "oscSourceSelect",
  "excelBtn",
  "pdfBtn"
];

for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`Missing required frontend id: ${id}`);
  }
}

const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)];
let compiled = 0;
for (const [, attrs, code] of scripts) {
  if (/\ssrc=/i.test(attrs)) continue;
  new Function(code);
  compiled += 1;
}

if (!manifest.sources?.teias?.availableDates?.length) {
  throw new Error("Manifest does not expose TEİAŞ dates.");
}

if (!manifest.sources?.netztransparenz?.availableDates?.length) {
  throw new Error("Manifest does not expose Netztransparenz dates.");
}

console.log(`frontend_static_smoke ok: ${compiled} inline scripts compiled`);
