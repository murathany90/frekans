import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

function mustContain(text, label = text) {
  if (!html.includes(text)) throw new Error(`Missing prompt5 frontend marker: ${label}`);
}

for (const marker of [
  "analysisRegistry",
  "updateAnalysisAvailability",
  "validateAnalysisSelection",
  "resolveAnalysisResolution",
  "resampleSeries",
  "buildSamplingMetadata",
  "printReport",
  "preparePrintChartSnapshots",
  "cleanupPrintArtifacts",
  "analysisCompatibilityNote",
  "analysisSamplingInfo",
  "analysisTableTitle",
  "analysisTableDescription",
  "analysisEventsHead",
  "sourceHealthSummary",
  "print-report",
  "print-chart-snapshot"
]) {
  mustContain(marker);
}

if (/\.tab-panel\s*\{\s*display:\s*block\s*!important/.test(html)) {
  throw new Error("Print CSS must not force every tab panel to print.");
}

if (!/body\.print-report\s+#tab-reports\s*\{[\s\S]*display:\s*block\s*!important/.test(html)) {
  throw new Error("Print CSS must explicitly show only #tab-reports for report printing.");
}

if (!/body\.print-report\s+\.tab-panel:not\(#tab-reports\)\s*\{[\s\S]*display:\s*none\s*!important/.test(html)) {
  throw new Error("Report print mode must hide all non-report tab panels.");
}

if (!/allowedSources:\s*\[\s*'tr'\s*,\s*'de'\s*,\s*'both'/.test(html)) {
  throw new Error("Analysis registry must declare source compatibility lists.");
}

if (!/allowedSources:\s*\[\s*'both'\s*\][\s\S]{0,180}crossCorrelation/.test(html) && !/crossCorrelation[\s\S]{0,220}allowedSources:\s*\[\s*'both'\s*\]/.test(html)) {
  throw new Error("Cross-correlation must only be available for Türkiye + Continental Europe.");
}

if (!/allowedResolutions:\s*\[\s*'1s'\s*\][\s\S]{0,420}spectrogram/.test(html) && !/spectrogram[\s\S]{0,520}allowedResolutions:\s*\[\s*'1s'\s*\]/.test(html)) {
  throw new Error("Spectrogram must require second-level analysis resolution.");
}

if (!/data-param-key="band"/.test(html) || !/data-param-key="rocof"/.test(html)) {
  throw new Error("Advanced analysis parameters must be tagged with data-param-key.");
}

console.log("frontend_prompt5_static ok");
