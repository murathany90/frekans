import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

function assertContains(fragment, label = fragment) {
  if (!html.includes(fragment)) {
    throw new Error(`Missing analysis help marker: ${label}`);
  }
}

for (const marker of [
  "ANALYSIS_HELP_CONTENT",
  "analysisHelpTitle",
  "analysisHelpSummary",
  "analysisHelpBody",
  "analysisHelpCloseBtn",
  "analysisHelpGlossarySearch",
  "analysisHelpAccordingToResult",
  "renderAnalysisHelpModal",
  "buildAnalysisHelpParameterCards",
  "buildAnalysisHelpResultSummary",
  "data-help-section",
  "aria-modal=\"true\"",
  "role=\"dialog\"",
  "aria-expanded"
]) {
  assertContains(marker);
}

for (const key of [
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
  assertContains(`${key}: {`, `${key} help content`);
}

for (const sectionKey of [
  "helpSectionWhat",
  "helpSectionWhen",
  "helpSectionParameters",
  "helpSectionResults",
  "helpSectionChart",
  "helpSectionTable",
  "helpSectionMistakes",
  "helpSectionAiSuggestions",
  "helpSectionGlossary",
  "helpSectionMathEngine"
]) {
  assertContains(sectionKey);
}

for (const text of [
  "Spektral hesaplama 1 saniyelik kaynak veri üzerinden yapılır",
  "Spectral calculation is performed on the one-second source series",
  "Bu sonuç çevrimdışı tarihsel veri analizidir",
  "This result is an offline historical-data analysis",
  "Yüksek bir spektral tepe",
  "A high spectral peak",
  "Her zaman penceresindeki en yüksek frekans",
  "The highest frequency in each time window"
]) {
  assertContains(text);
}

const modalHtml = html.slice(html.indexOf('id="analysisInfoPanel"'), html.indexOf('id="spectralQuickControls"'));
if (!/class="[^"]*analysis-help-modal/.test(modalHtml)) {
  throw new Error("Analysis info panel must be rendered as the help modal/drawer shell.");
}
if (/role="region"/.test(modalHtml)) {
  throw new Error("Analysis help shell must not remain a small region popover.");
}

for (const visibleRawEnum of [
  ">Mean<",
  ">Median<",
  ">Rectangular<",
  ">central<",
  ">filteredDerivative<",
  ">movingRegression<"
]) {
  if (html.includes(visibleRawEnum)) {
    throw new Error(`Raw engine enum is visible in static HTML: ${visibleRawEnum}`);
  }
}

console.log("frontend_prompt5_static ok");
