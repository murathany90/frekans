import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const buildSite = readFileSync("scripts/build_site.py", "utf8");
const frontendWorkflow = readFileSync(".github/workflows/frontend_tests.yml", "utf8");

function mustContain(text, label = text) {
  if (!html.includes(text)) throw new Error(`Missing prompt6 frontend marker: ${label}`);
}

for (const marker of [
  "Şebeke Frekansı",
  "Grid Frequency",
  "analysisInfoToggle",
  "analysisInfoPanel",
  "analysisInfoCompatibility",
  "analysisInfoStatus",
  "analysisInfoSampling",
  "sourceHealthSummary",
  "ENTSO-E (Almanya)",
  "ENTSO-E (Germany)",
  "Son ENTSO-E verisi",
  "Latest ENTSO-E data"
]) {
  mustContain(marker);
}

if (/Frekans Atlası|Frequency Atlas/.test(html)) {
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

if (!frontendWorkflow.includes("node tests/frontend_prompt6_static.mjs") || !frontendWorkflow.includes("node tests/frontend_prompt6_playwright.mjs")) {
  throw new Error("Frontend workflow must run prompt6 static and Playwright checks.");
}

console.log("frontend_prompt6_static ok");
