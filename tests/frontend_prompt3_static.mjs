import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

function mustContain(text, label = text) {
  if (!html.includes(text)) throw new Error(`Missing frontend prompt3 marker: ${label}`);
}

mustContain('id="showDifference"');
mustContain('id="showMinMaxEnvelope"');
mustContain('data-layer="difference"');
mustContain('data-layer="minmax"');
mustContain('data-date-picker="daily"');
mustContain('data-date-picker="analysis"');
mustContain('analysis-controls analysis-filter-bar');
mustContain('analysis-date-label-row');
mustContain('analysis-action-field');
mustContain('analysis-advanced-panel');
mustContain('analysisPrevDayBtn');
mustContain('analysisNextDayBtn');
mustContain('analysisCalGrid');
mustContain('analysisCalToggle');
mustContain('activeDateRequestController');
mustContain('dateRequestSequence');
mustContain('AbortController');
mustContain('AbortError');
mustContain('dateChangeDebounceMs');
mustContain('autoDataCache');
mustContain('inFlightAutoLoads');
mustContain('analysis-worker.mjs');
mustContain('runAnalysisWorker');
mustContain('computeWelchPsd');
mustContain('computeMagnitudeSquaredCoherence');
mustContain('computeCrossPowerSpectralDensity');
mustContain('computeStftSpectrogram');
mustContain('manifest-summary.json');
mustContain('manifest/${year}.json');
mustContain('loadManifestWithFallback');
mustContain('echartsLocalFallback');
mustContain('Grafik yuklenemedi.');
mustContain('Chart could not be loaded.');
mustContain('Ortak mod gostergesi');
mustContain('Common-mode indicator');

if (!/<select id="showDifference"[^>]*>[\s\S]*<option value="no"[^>]*selected/.test(html)) {
  throw new Error("Difference layer must default to off on first load.");
}

if (!/<select id="showMinMaxEnvelope"[^>]*>[\s\S]*<option value="no"[^>]*selected/.test(html)) {
  throw new Error("Min/Max layer must default to off on first load.");
}

if (/seriesTrMin[\s\S]{0,600}!\s*detailMode\s*\?/.test(html)) {
  throw new Error("Min/max series appear to be included without a min/max toggle guard.");
}

if (!/\.analysis-filter-bar\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*\.9fr\)\s*minmax\(220px,\s*1fr\)\s*minmax\(220px,\s*1fr\)\s*minmax\(180px,\s*\.7fr\)/.test(html)) {
  throw new Error("Analysis filter bar must use the compact symmetric desktop grid.");
}

if (!/class="analysis-date-label-row"[\s\S]*id="copyDailyDateBtn"[\s\S]*<\/div>\s*<div[^>]*>\s*<button[^>]*id="analysisPrevDayBtn"[\s\S]*id="analysisCalToggle"/.test(html)) {
  throw new Error("Copy daily date action must live in the analysis date label row, before the date control row.");
}

console.log("frontend_prompt3_static ok");
