import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

const requiredMarkers = [
  'href="assets/live-frequency.css"',
  'src="assets/live-frequency.js"',
  "window.GRIDFREQ_CONFIG",
  "liveApiBaseUrl",
  'data-tab="tab-live-frequency"',
  'id="tab-live-frequency"',
  'id="liveFrequencyChart"',
  'id="liveFrequencyKpis"',
  'id="liveFrequencyStatus"',
  'id="liveFrequencyRangeControls"',
  "#/live-frequency",
  "'tab-live-frequency': 'live-frequency'",
  "'live-frequency': 'tab-live-frequency'"
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Live Frequency marker missing: ${marker}`);
  }
}

if (/GRIDRADAR_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}/.test(html)) {
  throw new Error("Frontend must not contain a GridRadar token or bearer value.");
}

const liveSection = html.match(/<section id="tab-live-frequency"[\s\S]*?<\/section>/)?.[0] || "";
if (!/GridRadar API/.test(liveSection) || !/15 dakika/.test(liveSection)) {
  throw new Error("Live Frequency section must clearly disclose GridRadar source and approximate delay.");
}

console.log("frontend_live_frequency_static ok");
