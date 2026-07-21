import {
  computeCrossCorrelation,
  computeCrossPowerSpectralDensity,
  computeDailyFrequencyTrend,
  computeMagnitudeSquaredCoherence,
  computeOscillationCandidates,
  computeRocof,
  computeStftSpectrogram,
  computeWelchPsd
} from "./analysis-core.mjs";

const cancelled = new Set();
const workerScope = typeof self !== "undefined" ? self : null;

if (workerScope) workerScope.onmessage = event => {
  const message = event.data || {};
  if (message.type === "cancel" && message.id) {
    cancelled.add(message.id);
    workerScope.postMessage({ id: message.id, status: "cancelled" });
    return;
  }

  const { id, type, payload = {}, parameters = {} } = message;
  try {
    if (cancelled.has(id)) {
      workerScope.postMessage({ id, status: "cancelled" });
      return;
    }
    const result = runAnalysis(type, payload, parameters);
    if (cancelled.has(id)) {
      workerScope.postMessage({ id, status: "cancelled" });
      return;
    }
    workerScope.postMessage({ id, status: "success", result }, spectrogramTransfers(result));
  } catch (error) {
    workerScope.postMessage({ id, status: "error", error: error?.message || String(error) });
  } finally {
    if (id) cancelled.delete(id);
  }
};

function runAnalysis(type, payload, parameters) {
  const series = typed(payload.series);
  const timestamps = typed(payload.timestamps);
  const a = typed(payload.a);
  const b = typed(payload.b);
  if (type === "welchPsd" || type === "psd") return computeWelchPsd(series, parameters);
  if (type === "spectrogram") return computeStftSpectrogram(series, parameters);
  if (type === "coherence") {
    return {
      coherence: computeMagnitudeSquaredCoherence(a, b, parameters),
      crossPsd: computeCrossPowerSpectralDensity(a, b, parameters)
    };
  }
  if (type === "crossPsd") return computeCrossPowerSpectralDensity(a, b, parameters);
  if (type === "crossCorrelation") return computeCrossCorrelation(a, b, parameters);
  if (type === "rocof") return computeRocof(series, parameters);
  if (type === "oscillation") return computeOscillationCandidates(series, parameters);
  if (type === "trend") return computeDailyFrequencyTrend(series, timestamps, parameters);
  throw new Error(`Unknown analysis type: ${type}`);
}

export function typed(value) {
  if (!value) return new Float64Array();
  if (ArrayBuffer.isView(value)) return Float64Array.from(value);
  if (value instanceof ArrayBuffer) return new Float64Array(value);
  return Float64Array.from(value);
}

export function spectrogramTransfers(result) {
  if (!result || (result.method !== "stft-spectrogram" && result.method !== "oscillation-candidates")) return [];
  const transfers = [];
  if (ArrayBuffer.isView(result.powerValues) && result.powerValues.buffer instanceof ArrayBuffer) transfers.push(result.powerValues.buffer);
  if (ArrayBuffer.isView(result.timeBins) && result.timeBins.buffer instanceof ArrayBuffer) transfers.push(result.timeBins.buffer);
  if (ArrayBuffer.isView(result.timeBinsSeconds) && result.timeBinsSeconds.buffer instanceof ArrayBuffer) transfers.push(result.timeBinsSeconds.buffer);
  if (ArrayBuffer.isView(result.timeBinsEpochMs) && result.timeBinsEpochMs.buffer instanceof ArrayBuffer) transfers.push(result.timeBinsEpochMs.buffer);
  if (ArrayBuffer.isView(result.frequencyBins) && result.frequencyBins.buffer instanceof ArrayBuffer) transfers.push(result.frequencyBins.buffer);
  if (ArrayBuffer.isView(result.validityByTime) && result.validityByTime.buffer instanceof ArrayBuffer) transfers.push(result.validityByTime.buffer);
  if (ArrayBuffer.isView(result.imputedSamplesByTime) && result.imputedSamplesByTime.buffer instanceof ArrayBuffer) transfers.push(result.imputedSamplesByTime.buffer);
  if (ArrayBuffer.isView(result.filtered) && result.filtered.buffer instanceof ArrayBuffer) transfers.push(result.filtered.buffer);
  if (ArrayBuffer.isView(result.filteredSeries) && result.filteredSeries.buffer instanceof ArrayBuffer && result.filteredSeries.buffer !== result.filtered?.buffer) transfers.push(result.filteredSeries.buffer);
  if (ArrayBuffer.isView(result.envelopeMilliHz) && result.envelopeMilliHz.buffer instanceof ArrayBuffer) transfers.push(result.envelopeMilliHz.buffer);
  if (ArrayBuffer.isView(result.positiveEnvelopeMilliHz) && result.positiveEnvelopeMilliHz.buffer instanceof ArrayBuffer && result.positiveEnvelopeMilliHz.buffer !== result.envelopeMilliHz?.buffer) transfers.push(result.positiveEnvelopeMilliHz.buffer);
  if (ArrayBuffer.isView(result.negativeEnvelopeMilliHz) && result.negativeEnvelopeMilliHz.buffer instanceof ArrayBuffer) transfers.push(result.negativeEnvelopeMilliHz.buffer);
  return transfers;
}
