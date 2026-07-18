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
assert.match(html, /Bad Quality - Stuck Value/, "stuck-value classification is exposed for charts and tests");
assert.match(core, /stuckThresholdSeconds\s*=\s*5/, "stuck-value threshold defaults to 5 seconds");
assert.match(core, /uniqueValidCount/, "coverage is based on unique valid timestamps");

const legacyQualityBranch = /if\s*\(type\s*===\s*['"]quality['"]\)\s*\{[\s\S]{0,1200}?sampleSeries\(series,\s*60,\s*sampleIntervalSeconds\)/.test(html);
assert.equal(legacyQualityBranch, false, "quality KPI/chart path must not reuse resolution-dependent sampled series");

console.log("frontend_data_coverage_static checks passed");
