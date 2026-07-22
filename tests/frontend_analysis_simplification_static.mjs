import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

function assertIncludes(fragment, label = fragment) {
  assert(html.includes(fragment), `Missing analysis simplification marker: ${label}`);
}

function assertNotIncludes(fragment, label = fragment) {
  assert(!html.includes(fragment), `Forbidden visible analysis UI marker remains: ${label}`);
}

for (const marker of [
  "const ANALYSIS_UI_PROFILES",
  "function analysisUiProfile",
  "function visibleAnalysisCards",
  "function visibleAnalysisTableColumns",
  "function renderAnalysisDetailsDisclosure",
  "analysisDetailsToggleTitle",
  "analysisExpertSettingsTitle",
  "helpSectionInterpretation",
  "helpSectionAttention",
  "helpSectionExpertSettings"
]) {
  assertIncludes(marker);
}

for (const type of [
  "quality",
  "stats",
  "events",
  "rocof",
  "psd",
  "spectrogram",
  "oscillation",
  "crossCorrelation",
  "coherence",
  "trend"
]) {
  assertIncludes(`${type}: {`, `${type} profile/help entry`);
}

const helpSurface = html.slice(
  html.indexOf("const ANALYSIS_HELP_PARAMETER_DEFINITIONS"),
  html.indexOf("const CHART_SESSION_STORAGE_KEY")
);

for (const fragment of [
  "Teknik ayrıntı: motor parametresi",
  "Technical detail: engine parameter",
  "analysisHelpEngineParameter",
  "<code>${escapeHtml(raw.engineParameter)}</code>"
]) {
  assertNotIncludes(fragment);
}

for (const fragment of [
  "computeMagnitudeSquaredCoherence",
  "computeCrossPowerSpectralDensity"
]) {
  assert(!helpSurface.includes(fragment), `Forbidden help-center engine term remains: ${fragment}`);
}

for (const userFacingText of [
  "Filtre keskinliği",
  "Filter sharpness",
  "Standart RoCoF hesabı",
  "Standard RoCoF calculation",
  "Yumuşatılmış RoCoF",
  "Smoothed RoCoF",
  "Regresyon tabanlı RoCoF",
  "Regression-based RoCoF",
  "bestLag: 'En iyi gecikme'",
  "crossCorrelationPeak: 'En yüksek benzerlik noktası'"
]) {
  assertIncludes(userFacingText, userFacingText);
}

const uiProfileBlock = html.slice(
  html.indexOf("const ANALYSIS_UI_PROFILES"),
  html.indexOf("function analysisUiProfile")
);
assert(uiProfileBlock.length > 1000, "ANALYSIS_UI_PROFILES block should be substantial.");

for (const match of uiProfileBlock.matchAll(/kpiKeys:\s*\[([^\]]*)\]/g)) {
  const keys = match[1]
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  assert(keys.length <= 4, `A UI profile exposes too many KPI cards: ${match[0]}`);
}

for (const match of uiProfileBlock.matchAll(/mobileColumns:\s*\[([^\]]*)\]/g)) {
  const keys = match[1]
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  assert(keys.length <= 4, `A mobile table profile exposes too many columns: ${match[0]}`);
}

console.log("frontend_analysis_simplification_static ok");
