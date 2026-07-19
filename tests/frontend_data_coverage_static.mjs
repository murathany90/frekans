import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, "..", "frekans_rapor_v1.html"), "utf8");
const core = readFileSync(join(__dirname, "..", "assets", "analysis-core.mjs"), "utf8");

assert.match(html, /function computeQualityAnalysisResult\(/, "Data Coverage has a dedicated raw-axis result builder");
assert.match(html, /chart:\s*\{\s*kind:\s*['"]quality['"]/, "Data Coverage uses the quality chart renderer");
assert.match(html, /analysisWindowSeries\(current\.rawSeries\./, "quality analysis reads raw canonical series, not interpolated analysis series");
assert.match(html, /expectedIntervalSeconds:\s*1/, "quality analysis is locked to one-second calculations");
assert.match(html, /qualityHeatmap/, "Data Quality Heatmap translation key is present");
assert.match(html, /qualityPairedValid/, "dual-series paired valid metric is translated");
assert.match(html, /Türkiye & Kıta Avrupası \(Çift Seri\)/, "Turkish dual-series label is updated");
assert.match(html, /Türkiye & Continental Europe \(Dual Series\)/, "English dual-series label is updated");
assert.match(html, /Kıta Avrupası \(CE\)/, "Turkish CE source label is explicit");
assert.match(html, /Continental Europe \(CE\)/, "English CE source label is explicit");
assert.doesNotMatch(html, /Stuck Value|stuck-value|stuck duration/i, "Data Coverage UI must use YD/RV terminology, not Stuck Value");
assert.match(html, /YD \/|RV \/ Repeated Value/, "YD/RV terminology is translated");
assert.match(html, /qualityRepeatedEvents/, "repeated consecutive frequency count metric is translated");
assert.match(html, /qualityRepeatedThresholdLabel/, "repeated-value threshold is available in the advanced panel");
assert.match(html, /data-param-key=["']yd["']/, "Data Coverage advanced controls expose a YD/RV threshold field");
assert.match(core, /repeatedValueThresholdSeconds\s*=\s*10/, "repeated-value threshold defaults to 10 seconds");
assert.match(core, /uniqueValidCount/, "coverage is based on unique valid timestamps");
assert.match(core, /repeatedValueEventCount/, "repeated-value event count is event-based");
assert.match(html, /function updateQualityControlVisibility\(/, "Data Coverage has dedicated control visibility rules");
assert.match(html, /QUALITY_DATE_MODES/, "Data Coverage restricts date modes to single/range");
assert.match(html, /function qualityDisplayBucketSeconds\(/, "Data Coverage chooses display resolution automatically");
assert.match(html, /function buildQualitySecondWindowSeries\(/, "Heatmap click can show second-level detail data");
assert.match(html, /showQualityDetailWindow\(/, "Data Coverage table and heatmap clicks use second-level zoom");
assert.match(html, /visualMap:[\s\S]*#1f9d55/, "heatmap uses green for 100% quality");
assert.match(html, /visualMap:[\s\S]*#facc15[\s\S]*#f97316[\s\S]*#dc2626/, "heatmap uses yellow-orange-red as quality drops");
assert.match(html, /visualMap:[\s\S]*#d1d5db/, "heatmap uses grey for no-data cells");
assert.match(html, /days:\s*dailyResults\.map\(item => displayDate\(item\.date\)\)/, "range heatmap includes all selected days");

const qualityMinMaxEnabled = /buildQualityFrequencySummary\([^)]*\{[^}]*showMinMax:\s*true/.test(html);
assert.equal(qualityMinMaxEnabled, false, "Data Coverage main frequency graph must not show min/max lines");

const legacyQualityBranch = /if\s*\(type\s*===\s*['"]quality['"]\)\s*\{[\s\S]{0,1200}?sampleSeries\(series,\s*60,\s*sampleIntervalSeconds\)/.test(html);
assert.equal(legacyQualityBranch, false, "quality KPI/chart path must not reuse resolution-dependent sampled series");

console.log("frontend_data_coverage_static checks passed");
