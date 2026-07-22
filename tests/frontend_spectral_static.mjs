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
  "fftBinSpacingHz",
  "effectiveSpectralResolutionHz",
  "zeroPaddingApplied",
  "frequencyResolutionHz",
  "candidateSegmentCount",
  "acceptedSegmentCount",
  "totalImputedSampleCount",
  "snrLinear",
  "snrDb",
  "parsevalErrorRatio",
  "powerValues",
  "validityByTime",
  "timeBinsSeconds",
  "timeBinsEpochMs",
  "peakCandidates",
  "peakStatus",
  "timeFrequencyRegions",
  "ridgePoints"
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

for (const fragment of [
  "Hesap Özeti",
  "Tüm ayrıntıları göster",
  "Analiz Ayrıntıları",
  "Anlamlı Bölgeler",
  "Veri Kalitesi",
  "Dengeli",
  "Calculation Summary",
  "Show all details",
  "Analysis Details",
  "Meaningful Regions",
  "Data Quality",
  "Balanced",
  "FFT bin aralığı",
  "FFT bin spacing",
  "Etkin spektral çözünürlük",
  "Effective spectral resolution",
  "Logaritmik (dB)",
  "Arithmetic mean",
  "Sabit ortalama",
  "Constant mean",
  "Kaynak zaman dilimi",
  "Source time zone",
  "Hesaplama çözünürlüğü",
  "Calculation resolution",
  "Görüntü özeti",
  "Display summary",
  "Tepe durumu",
  "Peak status",
  "Anlamlı",
  "Significant",
  "Sıfır doldurma yalnız FFT ara değerlerini sıklaştırır",
  "Zero padding only densifies FFT interpolation"
]) {
  assert(html.includes(fragment), `Frontend missing spectral audit text: ${fragment}`);
}

for (const fragment of [
  'id="spectralProfile"',
  'id="spectralMaxCells"',
  "spectralProfileBalanced",
  "spectrogramNoProblemWindowsSummary",
  "spectralDetailsRowsShowing",
  "metric-info-button",
  "data-spectral-tab",
  "data-spectral-detail-kind",
  "SPECTRAL_VISIBLE_ROW_LIMIT"
]) {
  assert(html.includes(fragment), `Frontend missing simplified spectral result UI hook: ${fragment}`);
}

assert(!html.includes(">Zoom Sıfırla<"), "Turkish UI should not contain mixed-language Zoom Sıfırla text.");
assert(html.includes("psdEmptyState"), "Welch should have a dedicated empty state.");
assert(html.includes("spectrogramEmptyState"), "Spectrogram should have a dedicated empty state.");
assert(html.includes("renderWelchAnalysisChart"), "Welch should have a specialized chart renderer.");
assert(html.includes("renderSpectrogramAnalysisChart"), "Spectrogram should have a specialized chart renderer.");
assert(html.includes("renderSpectralDetailSummary"), "Spectral analyses should render parameter/data-quality summaries.");
assert(html.includes("spectralParameterMetadata"), "Spectral metadata should be included in export metadata.");
assert(html.includes("'units'"), "Spectral metadata should preserve result units.");
assert(html.includes("'fftBinSpacingHz'"), "Spectral metadata should include FFT bin spacing.");
assert(html.includes("'effectiveSpectralResolutionHz'"), "Spectral metadata should include effective spectral resolution.");
assert(html.includes("'dataTimezone'"), "Spectrogram metadata should include source data timezone.");
assert(html.includes("'displayTimezone'"), "Spectrogram metadata should include display timezone.");
assert(html.includes("['powerUnit', meta.units"), "Spectral CSV export should include the PSD power unit.");
assert(html.includes("['fftBinSpacingHz', meta.fftBinSpacingHz"), "Spectral CSV export should include FFT bin spacing.");
assert(html.includes("['effectiveSpectralResolutionHz', meta.effectiveSpectralResolutionHz"), "Spectral CSV export should include effective spectral resolution.");
assert(html.includes("secondsUnitShort"), "Second labels should be localized instead of hard-coded as sn.");
assert(html.includes("analysisSpectralTableTitle"), "Spectral table title should be analysis-specific.");
assert.match(html, /mode === 'spectrogram'[\s\S]{0,240}spectralScaleLabel/, "Spectrogram detail rows should label scale, not Welch averaging.");
assert.match(html, /function renderSpectrogramDetailsCard/, "Spectrogram tables should be combined into an analysis-details card.");
assert.match(html, /const SPECTRAL_VISIBLE_ROW_LIMIT\s*=\s*50/, "Spectrogram UI tables should be capped at 50 visible rows.");
assert.match(html, /calculationResolutionSeconds:\s*1/, "Spectral UI parameters should keep one-second calculation semantics.");
assert.match(html, /details[\s\S]{0,180}spectralTechnicalAdvancedTitle/, "Advanced spectral metrics should be in a collapsible details block.");

console.log("frontend_spectral_static ok");
