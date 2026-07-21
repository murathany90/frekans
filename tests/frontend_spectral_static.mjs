import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const core = readFileSync("assets/analysis-core.mjs", "utf8");
const worker = readFileSync("assets/analysis-worker.mjs", "utf8");

for (const fragment of [
  "DEFAULT_WELCH_PARAMETERS",
  "DEFAULT_SPECTROGRAM_PARAMETERS",
  "requestedSegmentSeconds",
  "effectiveSegmentSamples",
  "fftLengthSamples",
  "frequencyResolutionHz",
  "candidateSegmentCount",
  "acceptedSegmentCount",
  "totalImputedSampleCount",
  "snrLinear",
  "snrDb",
  "parsevalErrorRatio",
  "powerValues",
  "validityByTime"
]) {
  assert(core.includes(fragment), `Core missing ${fragment}`);
}

assert(worker.includes("spectrogramTransfers"), "Worker should transfer spectrogram typed-array buffers.");
assert(worker.includes("powerValues.buffer"), "Worker transfer list should include powerValues.buffer.");

for (const fragment of [
  "Welch Güç Spektral Yoğunluğu (PSD)",
  "Spektrogram — Zaman-Frekans Analizi",
  "Minimum analiz frekansı (Hz)",
  "Maksimum analiz frekansı (Hz)",
  "Segment süresi (sn)",
  "Segment adımı (sn)",
  "Örtüşme oranı (%)",
  "Pencere fonksiyonu",
  "Segment trend çıkarma",
  "Minimum geçerli örnek oranı (%)",
  "Güç ölçeği",
  "Görünümü Sıfırla",
  "Spektral Tepeler",
  "Zaman-Frekans Bölümleri",
  "Pencere Kalitesi",
  "Tepe/Gürültü oranı",
  "Tepe/Gürültü oranı (dB)",
  "PSD seviyesi (dB re 1 Hz²/Hz)",
  "Welch Power Spectral Density (PSD)",
  "Spectrogram — Time-Frequency Analysis",
  "Minimum analysis frequency (Hz)",
  "Maximum analysis frequency (Hz)",
  "Segment duration (s)",
  "Segment step (s)",
  "Overlap (%)",
  "Window function",
  "Segment detrending",
  "Minimum valid samples per segment (%)",
  "Power scale",
  "Reset View",
  "Spectral Peaks",
  "Time-Frequency Regions",
  "Window Quality",
  "Peak-to-noise ratio",
  "Peak-to-noise ratio (dB)",
  "PSD level (dB re 1 Hz²/Hz)"
]) {
  assert(html.includes(fragment), `Frontend missing localized text: ${fragment}`);
}

assert(!html.includes(">Zoom Sıfırla<"), "Turkish UI should not contain mixed-language Zoom Sıfırla text.");
assert(html.includes("psdEmptyState"), "Welch should have a dedicated empty state.");
assert(html.includes("spectrogramEmptyState"), "Spectrogram should have a dedicated empty state.");
assert(html.includes("renderWelchAnalysisChart"), "Welch should have a specialized chart renderer.");
assert(html.includes("renderSpectrogramAnalysisChart"), "Spectrogram should have a specialized chart renderer.");
assert(html.includes("renderSpectralDetailSummary"), "Spectral analyses should render parameter/data-quality summaries.");
assert(html.includes("spectralParameterMetadata"), "Spectral metadata should be included in export metadata.");
assert(html.includes("'units'"), "Spectral metadata should preserve result units.");
assert(html.includes("['powerUnit', meta.units"), "Spectral CSV export should include the PSD power unit.");
assert(html.includes("secondsUnitShort"), "Second labels should be localized instead of hard-coded as sn.");
assert(html.includes("analysisSpectralTableTitle"), "Spectral table title should be analysis-specific.");

console.log("frontend_spectral_static ok");
