import { existsSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const buildSite = readFileSync("scripts/build_site.py", "utf8");
const frontendWorkflow = readFileSync(".github/workflows/frontend_tests.yml", "utf8");
const deployWorkflow = readFileSync(".github/workflows/deploy_pages.yml", "utf8");

function mustContain(text, label = text) {
  if (!html.includes(text)) throw new Error(`Missing prompt6 frontend marker: ${label}`);
}

for (const marker of [
  "GridFreq",
  "Türkiye ve Kıta Avrupası Şebeke Frekansı Analiz Platformu",
  "Grid Frequency",
  "analysisInfoToggle",
  "analysisInfoPanel",
  "analysisInfoCompatibility",
  "analysisInfoStatus",
  "analysisInfoSampling",
  "sourceHealthSummary",
  "Kıta Avrupası · Netztransparenz",
  "Continental Europe · Netztransparenz",
  "Son Kıta Avrupası verisi",
  "Latest Continental Europe data"
]) {
  mustContain(marker);
}

const bodyHtml = html.split("</head>")[1] || html;
if (/Frekans Atlası|Frequency Atlas/.test(bodyHtml)) {
  throw new Error("Legacy Frekans Atlası/Frequency Atlas branding must be removed from the UI shell.");
}

const healthIndex = html.indexOf('id="sourceHealthSummary"');
const dailyIndex = html.indexOf('id="tab-chart"');
const dataIndex = html.indexOf('id="tab-settings"');
if (healthIndex < dataIndex || healthIndex < dailyIndex) {
  throw new Error("sourceHealthSummary must live in the Data tab auto-data panel, not above the daily chart.");
}

const autoPanelIndex = html.indexOf('data-i18n="sectionAutoData"');
if (healthIndex < autoPanelIndex) {
  throw new Error("sourceHealthSummary must be placed inside/after the GitHub Pages Auto Data panel heading.");
}

if (!/id="analysisInfoToggle"[\s\S]{0,240}aria-controls="analysisInfoPanel"/.test(html)) {
  throw new Error("Analysis info toggle must control the compact analysis info panel.");
}

if (!/id="analysisCompatibilityNote"[^>]*class="[^"]*\bsr-only\b/.test(html)) {
  throw new Error("Verbose analysis compatibility text must not be shown as a full-width visible banner.");
}

if (!/id="analysisSamplingInfo"[^>]*class="[^"]*\bsr-only\b/.test(html)) {
  throw new Error("Verbose sampling metadata must not be shown as a full-width visible banner.");
}

if (!existsSync("CNAME")) {
  throw new Error("GitHub Pages custom domain file CNAME is required.");
}
const cname = readFileSync("CNAME", "utf8").trim();
if (cname !== "gridfreq.com") {
  throw new Error(`CNAME must contain gridfreq.com, got: ${cname}`);
}

if (!/CNAME/.test(buildSite)) {
  throw new Error("build_site.py must copy CNAME into dist for GitHub Pages custom domain publishing.");
}

for (const pathTrigger of ['- "CNAME"', '- "LICENSE"', '- "robots.txt"', '- "sitemap.xml"', '- "404.html"']) {
  if (!deployWorkflow.includes(pathTrigger)) {
    throw new Error(`Deploy workflow must trigger on ${pathTrigger}.`);
  }
}

for (const marker of [
  '<link rel="canonical" href="https://gridfreq.com/">',
  '<meta property="og:type" content="website">',
  '<meta property="og:url" content="https://gridfreq.com/">',
  '<meta property="og:site_name" content="GridFreq">',
  '<meta property="og:title" content="GridFreq | Türkiye ve Kıta Avrupası Şebeke Frekansı Analiz Platformu">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:title" content="GridFreq | Türkiye ve Kıta Avrupası Şebeke Frekansı Analiz Platformu">'
]) {
  if (!html.includes(marker)) {
    throw new Error(`Missing custom-domain SEO marker: ${marker}`);
  }
}

if (/murathany90\.github\.io\/frekans|github\.io\/frekans/.test(html)) {
  throw new Error("Production HTML must not keep the old GitHub Pages URL as canonical metadata.");
}

for (const pathMarker of [
  'src="assets/analysis-core.mjs"',
  'assets/echarts.min.js',
  "new Worker('assets/analysis-worker.mjs'",
  "const AUTO_DATA_BASE = './data/';"
]) {
  if (!html.includes(pathMarker)) {
    throw new Error(`Custom-domain relative path marker is missing: ${pathMarker}`);
  }
}

rmSync("dist", { recursive: true, force: true });
execFileSync("python", ["scripts/build_site.py"], { stdio: "pipe" });

const distIndex = readFileSync("dist/index.html", "utf8");
const distCname = readFileSync("dist/CNAME", "utf8").trim();
const distRobots = readFileSync("dist/robots.txt", "utf8");
const distSitemap = readFileSync("dist/sitemap.xml", "utf8");

if (distCname !== "gridfreq.com") {
  throw new Error(`dist/CNAME must contain gridfreq.com, got: ${distCname}`);
}
if (!distIndex.includes('<link rel="canonical" href="https://gridfreq.com/">')) {
  throw new Error("dist/index.html must expose https://gridfreq.com/ canonical URL.");
}
if (!distIndex.includes('<meta property="og:url" content="https://gridfreq.com/">')) {
  throw new Error("dist/index.html must expose https://gridfreq.com/ og:url.");
}
if (distIndex.includes("murathany90.github.io/frekans")) {
  throw new Error("dist/index.html still contains the old GitHub Pages production URL.");
}
if (!distRobots.includes("Sitemap: https://gridfreq.com/sitemap.xml")) {
  throw new Error("dist/robots.txt must point to the gridfreq.com sitemap.");
}
if (!distSitemap.includes("<loc>https://gridfreq.com/</loc>")) {
  throw new Error("dist/sitemap.xml must contain the gridfreq.com root URL.");
}
if (/murathany90\.github\.io|github\.io\/frekans/.test(distSitemap)) {
  throw new Error("dist/sitemap.xml must not contain the old GitHub Pages URL.");
}
if (!existsSync("dist/assets/analysis-core.mjs") || !existsSync("dist/assets/analysis-worker.mjs") || !existsSync("dist/assets/echarts.min.js")) {
  throw new Error("dist/assets must include the app analysis and chart assets.");
}
if (!existsSync("dist/data/manifest-summary.json") || !existsSync("dist/data/status.json")) {
  throw new Error("dist/data must include manifest-summary.json and status.json.");
}
if (!existsSync("dist/404.html")) {
  throw new Error("dist/404.html must be copied for GitHub Pages not-found handling.");
}

if (!frontendWorkflow.includes("node tests/frontend_prompt6_static.mjs") || !frontendWorkflow.includes("node tests/frontend_prompt6_playwright.mjs")) {
  throw new Error("Frontend workflow must run prompt6 static and Playwright checks.");
}

console.log("frontend_prompt6_static ok");
