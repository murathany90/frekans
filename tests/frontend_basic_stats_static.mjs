import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const core = readFileSync("assets/analysis-core.mjs", "utf8");

for (const key of [
  "count",
  "mean",
  "median",
  "min",
  "max",
  "variance",
  "stdDev",
  "rmsDeviationMhz",
  "meanAbsDeviationMhz",
  "p01",
  "p05",
  "p25",
  "p75",
  "p95",
  "p99",
  "skewness",
  "kurtosis",
  "inBandRatio",
  "outOfBandSeconds",
  "longestBandViolationSeconds",
  "bandViolationEventCount",
]) {
  assert.match(core, new RegExp(`\\b${key}\\b`), `analysis-core computeBasicStats exposes ${key}`);
  assert.match(html, new RegExp(`['"]${key}['"]|\\.${key}\\b`), `Basic Stats UI maps core field ${key}`);
}

for (const marker of [
  "function computeStatsAnalysisResult(",
  "function buildStatsGoodSeries(",
  "function buildStatsHeatmap(",
  "function renderStatsAnalysisChart(",
  "function showStatsDetailWindow(",
  "function showStatsFullRange(",
  "statsBandMinHz",
  "statsBandMaxHz",
  "statsGoodUsedCount",
  "statsExcludedCount",
  "statsLowerBandViolationSeconds",
  "statsUpperBandViolationSeconds",
  "statsHeatmap",
  "statsTooltipRmsDeviation",
]) {
  assert.match(html, new RegExp(marker.replace(/[()]/g, "\\$&")), `Missing Basic Stats marker: ${marker}`);
}

assert.match(html, /id=["']statsBandMinHz["'][^>]+value=["']49\.95["']/, "Basic Stats lower band defaults to 49.95 Hz");
assert.match(html, /id=["']statsBandMaxHz["'][^>]+value=["']50\.05["']/, "Basic Stats upper band defaults to 50.05 Hz");
assert.match(html, /type\s*===\s*['"]stats['"][\s\S]{0,120}?return\s*['"]1s['"]/, "Basic Stats analysis resolution is locked to 1s");
assert.match(html, /masks\.good/, "Basic Stats must use good-quality masks");
assert.match(html, /chart:\s*\{[\s\S]{0,120}kind:\s*['"]stats['"]/, "Basic Stats uses a dedicated chart renderer");
assert.match(html, /type:\s*['"]heatmap['"][\s\S]{0,180}statsHeatmap/, "Basic Stats includes the deviation heatmap series");
assert.match(html, /data-param-key=["']statsBand["']/, "Basic Stats frequency band controls are scoped separately from oscillation band controls");
assert.match(html, /dataZoom:[\s\S]{0,220}xAxisIndex:\s*\[0\]/, "Basic Stats zoom must affect the main frequency axis");
assert.match(html, /drilldownType:\s*['"]min['"][\s\S]*drilldownType:\s*['"]max['"][\s\S]*drilldownType:\s*['"]band['"]/, "Basic Stats min/max/longest band rows are drillable");

console.log("frontend_basic_stats_static ok");
