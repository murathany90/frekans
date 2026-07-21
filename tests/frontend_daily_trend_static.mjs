import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const core = readFileSync("assets/analysis-core.mjs", "utf8");
const worker = readFileSync("assets/analysis-worker.mjs", "utf8");

for (const marker of [
  "Günlük Frekans ve Trend Analizi",
  "Daily Frequency and Trend Analysis",
  "Frekans Zaman Serisi ve Min–Maks Zarfı",
  "Frequency Time Series and Min–Max Envelope",
  "Frekans Dağılımı",
  "Frequency Distribution",
  "Ham veri histogramı",
  "Raw-data histogram",
  "Görüntü çözünürlüğü",
  "Display resolution",
  "15 dakika",
  "15 minutes",
  "1 saat",
  "1 hour",
  "computeDailyFrequencyTrend"
]) {
  assert.ok(html.includes(marker) || core.includes(marker) || worker.includes(marker), `Missing marker: ${marker}`);
}

assert.match(core, /export const DEFAULT_DAILY_TREND_PARAMETERS/);
assert.match(core, /export function computeDailyFrequencyTrend/);
assert.match(worker, /computeDailyFrequencyTrend/);
assert.match(worker, /type === "trend"/);
assert.match(html, /allowedResolutions:\s*\[[^\]]*'1s'[^\]]*'1m'[^\]]*'15m'[^\]]*'1h'/s);
assert.match(html, /dateModeLast7[\s\S]*data-trend-preset/s, "Trend range presets should be rendered separately from the main date-mode select.");
assert.doesNotMatch(html, /analysisTrend:\s*'Günlük trend'/);
assert.doesNotMatch(html, /analysisTrend:\s*'Daily trend'/);
assert.doesNotMatch(html, /analysisTrendTitle:\s*'Uzun Dönem Trend Özeti'/);
assert.doesNotMatch(html, /analysisTrendTitle:\s*'Long-Term Trend Summary'/);

console.log("frontend_daily_trend_static ok");
