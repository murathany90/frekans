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
assert.match(html, /function\s+updateAnalysisSourceOptions\(\)[\s\S]*option\.hidden\s*=\s*!\s*allowed[\s\S]*option\.disabled\s*=\s*!\s*allowed/, "RoCoF source select should hide and disable disallowed source modes.");
assert.match(html, /id=["']rocofMethod["']/, "RoCoF method select should exist.");
assert.match(html, /id=["']rocofPreFilterSeconds["']/, "Filtered derivative pre-filter control should exist.");
assert.match(html, /id=["']rocofRegressionWindowSeconds["']/, "Moving regression window control should exist.");
assert.match(html, /rocofThresholdLabel:\s*['"][^'"]*mHz\/s/, "RoCoF threshold label should be in mHz/s.");
assert.match(html, /DEFAULT_ROCOF_PARAMETERS/, "Frontend should use the shared RoCoF default parameter contract.");
assert.match(html, /function\s+mHzPerSecondToHzPerSecond\s*\(/, "Frontend should use a named mHz/s -> Hz/s conversion helper.");
assert.match(html, /function\s+hzPerSecondToMhzPerSecond\s*\(/, "Frontend should use a named Hz/s -> mHz/s conversion helper.");
assert.match(html, /function computeRocofAnalysisResult\s*\(/, "RoCoF should have a dedicated Good Quality result builder.");
assert.match(html, /function computeRocofRangeResult\s*\(/, "RoCoF should support date-range analysis.");
assert.match(html, /function renderRocofAnalysisChart\s*\(/, "RoCoF should use a dedicated rich chart renderer.");
assert.match(html, /function showRocofDetailWindow\s*\(/, "RoCoF event and heatmap drill-down should use a dedicated detail window.");
assert.match(html, /rocofSeverityHeatmap/, "RoCoF severity heatmap i18n/rendering hooks should exist.");
assert.match(html, /rocofPositiveLegend[\s\S]*rocofNegativeLegend/, "RoCoF R+/R- legend keys should exist.");
assert.match(html, /rocofPeakMarker/, "RoCoF peak marker label should be localized via rocofPeakMarker.");
assert.doesNotMatch(html, /name:\s*['"]Peak RoCoF['"]/, "RoCoF markPoint series name should not hard-code Peak RoCoF.");
assert.doesNotMatch(html, /<div[^>]*>\s*Peak RoCoF\s*<\/div>/, "RoCoF markPoint tooltip should not hard-code Peak RoCoF.");
assert.match(html, /rocofMethodLabel:\s*['"]RoCoF hesaplama yöntemi['"]/, "Turkish method label should use the precise mathematical wording.");
assert.match(html, /rocofMethodCentral:\s*['"]Standart RoCoF hesabı['"]/, "Turkish central method label should be user-friendly.");
assert.match(html, /rocofMethodFiltered:\s*['"]Yumuşatılmış RoCoF['"]/, "Turkish filtered method label should be user-friendly.");
assert.match(html, /rocofMethodRegression:\s*['"]Regresyon tabanlı RoCoF['"]/, "Turkish regression method label should be user-friendly.");
assert.match(html, /rocofMethodLabel:\s*['"]RoCoF estimation method['"]/, "English method label should use the precise mathematical wording.");
assert.match(html, /rocofMethodCentral:\s*['"]Standard RoCoF calculation['"]/, "English central method label should be user-friendly.");
assert.match(html, /rocofMethodFiltered:\s*['"]Smoothed RoCoF['"]/, "English filtered method label should be user-friendly.");
assert.match(html, /rocofMethodRegression:\s*['"]Regression-based RoCoF['"]/, "English regression method label should be user-friendly.");
assert.match(html, /rocofSeverityHeatmap:\s*['"]15 Dakikalık Tepe \|RoCoF\| Isı Haritası['"]/, "Turkish heatmap label should be fully localized.");
assert.match(html, /rocofSeverityHeatmap:\s*['"]15-Minute Peak \|RoCoF\| Heatmap['"]/, "English heatmap label should use the new wording.");
assert.match(html, /rocofSeverityRatio:\s*['"]Tepe \|RoCoF\| \/ Eşik['"]/, "Turkish severity ratio should name the actual calculation.");
assert.match(html, /rocofSeverityRatio:\s*['"]Peak \|RoCoF\| \/ Threshold['"]/, "English severity ratio should name the actual calculation.");
assert.match(html, /rocofThresholdStrictHelp/, "Strict threshold semantics should be exposed in help text.");
assert.match(html, /rocofScientificWarning/, "RoCoF result area should include a scientific-use warning.");
assert.match(html, /rocofLegendExplanation/, "RoCoF result area should explain R+ and R-.");
assert.match(html, /requestedWindowSeconds[\s\S]*effectiveWindowSeconds/, "RoCoF exports/details should expose requested and effective regression windows.");
assert.match(html, /requestedPreFilterSeconds[\s\S]*effectivePreFilterSeconds/, "RoCoF exports/details should expose requested and effective pre-filter windows.");
assert.match(html, /Array\.isArray\(params\.value\)/, "RoCoF heatmap callbacks should guard params.value before destructuring.");
assert.match(html, /normalizeAnalysisCard/, "RoCoF should use existing normalized object-card support.");
assert.match(html, /event\.startSecond[\s\S]*event\.endSecond/, "CSV export should continue supporting RoCoF event startSecond/endSecond fields.");

console.log("frontend_rocof_static checks passed");
