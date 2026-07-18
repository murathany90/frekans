import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const liveJs = readFileSync("assets/live-frequency.js", "utf8");
const liveCss = readFileSync("assets/live-frequency.css", "utf8");

const requiredMarkers = [
  'href="assets/live-frequency.css"',
  'src="assets/live-frequency.js"',
  "window.GRIDFREQ_CONFIG",
  "liveApiBaseUrl",
  'data-tab="tab-live-frequency"',
  'id="tab-live-frequency"',
  'id="liveFrequencyChart"',
  'id="liveFrequencyChartTitle"',
  'id="liveFrequencyKpis"',
  'id="liveFrequencyStatus"',
  'id="liveFrequencyRangeControls"',
  'id="liveFrequencyHourNav"',
  'id="liveFrequencyPrevHour"',
  'id="liveFrequencyNextHour"',
  'id="liveFrequencySourceTerms"',
  "#/live-frequency",
  "'tab-live-frequency': 'live-frequency'",
  "'live-frequency': 'tab-live-frequency'"
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Live Frequency marker missing: ${marker}`);
  }
}

if (/GRIDRADAR_TOKEN|Bearer\s+[A-Za-z0-9._-]{10,}/.test(html + liveJs)) {
  throw new Error("Frontend must not contain a GridRadar token or bearer value.");
}

const liveSection = html.match(/<section id="tab-live-frequency"[\s\S]*?<\/section>/)?.[0] || "";
if (!/GridRadar/.test(liveSection) || !/~15 dk|15 dakika/.test(liveSection)) {
  throw new Error("Live Frequency section must clearly disclose GridRadar source and approximate delay.");
}

const requiredLiveCopy = [
  "Kıta Avrupası · GridRadar · yaklaşık 15 dakika gecikmeli",
  "frequency-ucte-median-1s",
  "1 s çözünürlük",
  "~15 dk gecikme",
  "Veri kullanım koşulları",
  "Ticari veya profesyonel veri erişimi için GridRadar ile iletişime geçin.",
  "https://gridradar.net/en",
  "https://gridradar.net/en/mains-frequency"
];

for (const marker of requiredLiveCopy) {
  if (!liveSection.includes(marker)) {
    throw new Error(`Live Frequency GridRadar disclosure missing: ${marker}`);
  }
}

if (/gerçek zamanlı/i.test(liveSection + liveJs)) {
  throw new Error("Live Frequency section must not use the phrase 'gerçek zamanlı'.");
}

if (/data-live-range="900"|Son 15 dakika|Last 15/i.test(liveSection + liveJs)) {
  throw new Error("Live Frequency range controls must not include the 15 minute option.");
}

if (!/<button[^>]*class="[^"]*\bactive\b[^"]*"[^>]*data-live-range="3600"/.test(liveSection) && !/<button[^>]*data-live-range="3600"[^>]*class="[^"]*\bactive\b[^"]*"/.test(liveSection)) {
  throw new Error("Live Frequency must default to the last 1 hour range.");
}

if (!existsSync("assets/gridradar/gridradar-logo.svg") && !existsSync("assets/gridradar/gridradar-logo.png")) {
  throw new Error("Published GridRadar logo asset is missing under assets/gridradar/.");
}

if (!/SUMMARY_SYNC_MS\s*=\s*300_000/.test(liveJs)) {
  throw new Error("Live Frequency frontend must define a 5 minute summary sync interval.");
}

if (!/rangeSeconds:\s*3600/.test(liveJs)) {
  throw new Error("Live Frequency frontend state must default to 1 hour.");
}

for (const marker of [
  "resolution=1s",
  "resolution=60s",
  "RAW_WINDOW_MS",
  "ZOOM_RAW_THRESHOLD_MS",
  "oneSecondCache",
  "data-current-lang",
  "MutationObserver",
  "Last 1 Hour",
  "Data use terms"
]) {
  if (!liveJs.includes(marker)) {
    throw new Error(`Live Frequency JS missing targeted UX behavior: ${marker}`);
  }
}

for (const marker of [
  "live-frequency-status-dot",
  "live-frequency-provider",
  "live-frequency-usage-notice",
  "live-frequency-hour-nav",
  "live-frequency-source-links",
  "live-frequency-source-terms"
]) {
  if (!liveCss.includes(marker)) {
    throw new Error(`Live Frequency CSS missing responsive/support class: ${marker}`);
  }
}

console.log("frontend_live_frequency_static ok");
