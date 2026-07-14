import { existsSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const buildSite = readFileSync("scripts/build_site.py", "utf8");
const deployWorkflow = readFileSync(".github/workflows/deploy_pages.yml", "utf8");
const frontendWorkflow = readFileSync(".github/workflows/frontend_tests.yml", "utf8");

const brandFiles = [
  "assets/brand/gridfreq-logo.svg",
  "assets/brand/gridfreq-logo-horizontal.svg",
  "assets/brand/favicon.svg",
  "assets/brand/favicon.ico",
  "assets/brand/favicon-32x32.png",
  "assets/brand/apple-touch-icon.png",
  "assets/brand/icon-192.png",
  "assets/brand/icon-512.png",
  "assets/brand/icon-maskable-512.png",
  "assets/brand/gridfreq-social-card.png",
  "site.webmanifest"
];

for (const file of brandFiles) {
  if (!existsSync(file)) throw new Error(`Missing GridFreq brand asset: ${file}`);
}

function pngSize(path) {
  const data = readFileSync(path);
  if (data.readUInt32BE(0) !== 0x89504e47 || data.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${path} is not a PNG file.`);
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

function assertPngSize(path, width, height) {
  const size = pngSize(path);
  if (size.width !== width || size.height !== height) {
    throw new Error(`${path} must be ${width}x${height}, got ${size.width}x${size.height}.`);
  }
}

assertPngSize("assets/brand/favicon-32x32.png", 32, 32);
assertPngSize("assets/brand/apple-touch-icon.png", 180, 180);
assertPngSize("assets/brand/icon-192.png", 192, 192);
assertPngSize("assets/brand/icon-512.png", 512, 512);
assertPngSize("assets/brand/icon-maskable-512.png", 512, 512);
assertPngSize("assets/brand/gridfreq-social-card.png", 1200, 630);

const ico = readFileSync("assets/brand/favicon.ico");
if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1 || ico.readUInt16LE(4) < 3) {
  throw new Error("favicon.ico must contain at least 16, 32 and 48 px icon entries.");
}

const faviconSvg = readFileSync("assets/brand/favicon.svg", "utf8");
for (const marker of ["#0B1220", "#22D3EE", "#3B82F6", "#F8FAFC"]) {
  if (!faviconSvg.includes(marker)) throw new Error(`favicon.svg missing palette marker: ${marker}`);
}
if (/50\s*Hz|GridFreq|GF|Türkiye|Almanya|Germany/i.test(faviconSvg)) {
  throw new Error("favicon.svg must stay symbol-only with no text, flags or country labels.");
}

const horizontalLogo = readFileSync("assets/brand/gridfreq-logo-horizontal.svg", "utf8");
if (!horizontalLogo.includes("GridFreq") || !horizontalLogo.includes("Şebeke Frekansı Analiz Platformu")) {
  throw new Error("Horizontal logo must contain GridFreq and the Turkish platform subtitle.");
}

const manifest = JSON.parse(readFileSync("site.webmanifest", "utf8"));
if (manifest.name !== "GridFreq – Şebeke Frekansı Analiz Platformu") throw new Error("Unexpected manifest name.");
if (manifest.short_name !== "GridFreq") throw new Error("Unexpected manifest short_name.");
if (manifest.start_url !== "/") throw new Error("Manifest start_url must be custom-domain root.");
if (manifest.display !== "standalone") throw new Error("Manifest display must be standalone.");
if (manifest.background_color !== "#0B1220" || manifest.theme_color !== "#0B1220") {
  throw new Error("Manifest colors must match the GridFreq dark brand background.");
}
for (const icon of [
  ["assets/brand/icon-192.png", "192x192", undefined],
  ["assets/brand/icon-512.png", "512x512", undefined],
  ["assets/brand/icon-maskable-512.png", "512x512", "maskable"]
]) {
  const found = manifest.icons?.find(item => item.src === icon[0] && item.sizes === icon[1] && (!icon[2] || item.purpose?.includes(icon[2])));
  if (!found) throw new Error(`Manifest missing icon declaration: ${icon.join(" ")}`);
}

for (const marker of [
  '<link rel="icon" href="assets/brand/favicon.svg" type="image/svg+xml">',
  '<link rel="icon" href="assets/brand/favicon.ico" sizes="any">',
  '<link rel="icon" href="assets/brand/favicon-32x32.png" type="image/png" sizes="32x32">',
  '<link rel="apple-touch-icon" href="assets/brand/apple-touch-icon.png">',
  '<link rel="manifest" href="site.webmanifest">',
  '<meta property="og:image" content="https://gridfreq.com/assets/brand/gridfreq-social-card.png">',
  '<meta name="twitter:image" content="https://gridfreq.com/assets/brand/gridfreq-social-card.png">',
  'class="brand-logo"',
  'assets/brand/favicon.svg',
  'GridFreq'
]) {
  if (!html.includes(marker)) throw new Error(`HTML missing GridFreq brand marker: ${marker}`);
}

if (!buildSite.includes("site.webmanifest")) {
  throw new Error("build_site.py must copy site.webmanifest into dist.");
}

for (const workflow of [deployWorkflow, frontendWorkflow]) {
  for (const marker of ['"site.webmanifest"', "node tests/frontend_brand_static.mjs"]) {
    if (!workflow.includes(marker)) throw new Error(`Workflow missing brand marker: ${marker}`);
  }
}

rmSync("dist", { recursive: true, force: true });
execFileSync("python", ["scripts/build_site.py"], { stdio: "pipe" });

for (const file of brandFiles) {
  const distFile = file.startsWith("assets/") ? `dist/${file}` : `dist/${file}`;
  if (!existsSync(distFile)) throw new Error(`Build output missing GridFreq brand asset: ${distFile}`);
}

const distIndex = readFileSync("dist/index.html", "utf8");
if (!distIndex.includes('href="assets/brand/favicon.svg"') || !distIndex.includes("gridfreq-social-card.png")) {
  throw new Error("dist/index.html must include favicon and social card metadata.");
}

console.log("frontend_brand_static ok");
