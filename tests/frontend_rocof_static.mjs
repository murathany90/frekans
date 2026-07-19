import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../frekans_rapor_v1.html", import.meta.url), "utf8");
const rocofBlock = html.match(/rocof:\s*\{[\s\S]*?\n\s*\},\s*\n\s*psd:/)?.[0] || "";

assert.match(
  rocofBlock,
  /allowedSources:\s*\[\s*['"]tr['"]\s*,\s*['"]de['"]\s*,\s*['"]both['"]\s*,\s*['"]common['"]\s*\]/,
  "RoCoF should only allow 50 Hz-centered source modes."
);
assert.doesNotMatch(rocofBlock, /allowedSources:\s*\[[^\]]*['"]diff['"][^\]]*\]/, "RoCoF should not allow raw TR-CE difference.");
assert.doesNotMatch(rocofBlock, /allowedSources:\s*\[[^\]]*['"]differential['"][^\]]*\]/, "RoCoF should not allow differential mode.");
assert.match(
  html,
  /LIMITED_DATE_MODE_ANALYSES\s*=\s*new Set\(\s*\[\s*['"]quality['"]\s*,\s*['"]stats['"]\s*,\s*['"]events['"]\s*,\s*['"]rocof['"]\s*\]\s*\)/,
  "RoCoF should share single-day/date-range-only date modes."
);
assert.match(html, /type\s*===\s*['"]rocof['"][\s\S]{0,120}return\s*['"]1s['"]/, "RoCoF analysis resolution should be locked to 1s.");
assert.match(rocofBlock, /parameterKeys:\s*\[[^\]]*['"]rocofMethod['"][^\]]*['"]rocofThreshold['"][^\]]*['"]duration['"][^\]]*['"]yd['"][^\]]*\]/, "RoCoF should expose method, mHz/s threshold, duration, and YD/RV controls.");
assert.match(html, /id=["']rocofMethod["']/, "RoCoF method select should exist.");
assert.match(html, /id=["']rocofPreFilterSeconds["']/, "Filtered derivative pre-filter control should exist.");
assert.match(html, /id=["']rocofRegressionWindowSeconds["']/, "Moving regression window control should exist.");
assert.match(html, /rocofThresholdLabel:\s*['"][^'"]*mHz\/s/, "RoCoF threshold label should be in mHz/s.");
assert.match(html, /function computeRocofAnalysisResult\s*\(/, "RoCoF should have a dedicated Good Quality result builder.");
assert.match(html, /function computeRocofRangeResult\s*\(/, "RoCoF should support date-range analysis.");
assert.match(html, /function renderRocofAnalysisChart\s*\(/, "RoCoF should use a dedicated rich chart renderer.");
assert.match(html, /function showRocofDetailWindow\s*\(/, "RoCoF event and heatmap drill-down should use a dedicated detail window.");
assert.match(html, /rocofSeverityHeatmap/, "RoCoF severity heatmap i18n/rendering hooks should exist.");
assert.match(html, /rocofPositiveLegend[\s\S]*rocofNegativeLegend/, "RoCoF R+/R- legend keys should exist.");
assert.match(html, /Array\.isArray\(params\.value\)/, "RoCoF heatmap callbacks should guard params.value before destructuring.");
assert.match(html, /normalizeAnalysisCard/, "RoCoF should use existing normalized object-card support.");
assert.match(html, /event\.startSecond[\s\S]*event\.endSecond/, "CSV export should continue supporting RoCoF event startSecond/endSecond fields.");

console.log("frontend_rocof_static checks passed");
