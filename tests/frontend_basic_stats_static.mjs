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
  "repeatedValueSeconds",
  "statsGoodUsedCount",
  "statsRawValidCount",
  "statsExcludedCount",
  "statsLowerBandViolationSeconds",
  "statsUpperBandViolationSeconds",
  "statsLowerBandViolationShort",
  "statsUpperBandViolationShort",
  "statsLowerBandViolationLegend",
  "statsUpperBandViolationLegend",
  "statsBandViolationCount",
  "statsHeatmap",
  "statsGroupSamples",
  "statsHelpVariance",
  "statsHelpPercentile",
  "statsTooltipRmsDeviation",
]) {
  assert.match(html, new RegExp(marker.replace(/[()]/g, "\\$&")), `Missing Basic Stats marker: ${marker}`);
}

assert.match(html, /id=["']statsBandMinHz["'][^>]+value=["']49\.90["']/, "Basic Stats lower band defaults to 49.90 Hz");
assert.match(html, /id=["']statsBandMaxHz["'][^>]+value=["']50\.10["']/, "Basic Stats upper band defaults to 50.10 Hz");
assert.match(html, /id=["']repeatedValueSeconds["'][^>]+value=["']15["']/, "Basic Stats shares the default 15s YD/RV threshold control");
assert.match(html, /stats:[\s\S]{0,260}?parameterKeys:\s*\[['"]statsBand['"],\s*['"]yd['"]\]/, "Basic Stats exposes the shared YD/RV threshold setting");
assert.doesNotMatch(html, /repeatedValueSeconds[\s\S]{0,120}(?:\|\||\?\?)\s*(?:5|10)\b/, "Basic Stats/Data Coverage YD/RV threshold must not fall back to 5s or 10s");
assert.match(html, /statsBandMinHz:\s*49\.90[\s\S]{0,80}statsBandMaxHz:\s*50\.10/, "Basic Stats saved defaults use 49.90/50.10 Hz");
assert.match(html, /const\s+LIMITED_DATE_MODE_ANALYSES\s*=\s*new Set\(\[['"]quality['"],\s*['"]stats['"]\]\)/, "Basic Stats and Data Coverage share restricted date modes");
assert.match(html, /function syncAnalysisDateControlState\(/, "Basic Stats date controls have an explicit active/passive sync");
assert.match(html, /resolveAnalysisDates[\s\S]{0,600}type\s*===\s*['"]stats['"][\s\S]{0,500}mode\s*===\s*['"]range['"][\s\S]{0,500}analysisStartDate/, "Basic Stats range mode uses start/end dates explicitly");
assert.match(html, /statsHeatmap:\s*['"]15 dk RMS Sapma['"][\s\S]*statsHeatmap:\s*['"]15-min RMS Deviation['"]/, "Basic Stats heatmap label is localized");
assert.match(html, /statsRawValidCount:\s*['"]Geçerli Örnek['"][\s\S]*statsRawValidCount:\s*['"]Raw Valid Sample['"]/, "Basic Stats separates raw valid sample labels in TR/EN");
assert.match(html, /statsLowerBandViolationLegend:\s*['"]Aİ \/ Alt Bant İhlali['"][\s\S]*statsUpperBandViolationLegend:\s*['"]Üİ \/ Üst Bant İhlali['"][\s\S]*statsLowerBandViolationLegend:\s*['"]LB \/ Lower Band Violation['"][\s\S]*statsUpperBandViolationLegend:\s*['"]UB \/ Upper Band Violation['"]/, "Basic Stats band legend labels are localized and compact");
assert.match(html, /type\s*===\s*['"]stats['"][\s\S]{0,120}?return\s*['"]1s['"]/, "Basic Stats analysis resolution is locked to 1s");
assert.match(html, /masks\.good/, "Basic Stats must use good-quality masks");
assert.match(html, /chart:\s*\{[\s\S]{0,120}kind:\s*['"]stats['"]/, "Basic Stats uses a dedicated chart renderer");
assert.match(html, /type:\s*['"]heatmap['"][\s\S]{0,180}statsHeatmap/, "Basic Stats includes the deviation heatmap series");
assert.match(html, /0-25 mHz[\s\S]*25-50 mHz[\s\S]*50-100 mHz[\s\S]*100-200 mHz[\s\S]*>200 mHz/, "Basic Stats heatmap uses the requested RMS mHz bands");
assert.match(html, /data-param-key=["']statsBand["']/, "Basic Stats frequency band controls are scoped separately from oscillation band controls");
assert.match(html, /dataZoom:[\s\S]{0,220}xAxisIndex:\s*\[0\]/, "Basic Stats zoom must affect the main frequency axis");
assert.match(html, /drilldownType:\s*['"]min['"][\s\S]*drilldownType:\s*['"]max['"][\s\S]*drilldownType:\s*['"]band['"]/, "Basic Stats min/max/longest band rows are drillable");
assert.match(html, /class=["']analysis-group-row["']|analysis-group-row/, "Basic Stats table includes compact logical group rows");
assert.match(html, /data-tooltip="\$\{escapeHtml\(row\.tooltip\)\}"/, "Basic Stats technical metric rows expose tooltips");
assert.match(html, /data-tooltip-kind=["']metric-help["']|data-tooltip-kind=\\["']metric-help\\["']/, "Basic Stats metric help tooltips are separate from chart data tooltips");
assert.match(html, /class=["']metric-info-icon["'][\s\S]{0,80}&#9432;/, "Basic Stats technical metric rows show an info icon");

console.log("frontend_basic_stats_static ok");
