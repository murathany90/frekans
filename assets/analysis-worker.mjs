import {
  computeCrossCorrelation,
  computeCrossPowerSpectralDensity,
  computeMagnitudeSquaredCoherence,
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
    workerScope.postMessage({ id, status: "success", result });
  } catch (error) {
    workerScope.postMessage({ id, status: "error", error: error?.message || String(error) });
  } finally {
    if (id) cancelled.delete(id);
  }
};

function runAnalysis(type, payload, parameters) {
  const series = typed(payload.series);
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
  throw new Error(`Unknown analysis type: ${type}`);
}

export function typed(value) {
  if (!value) return new Float64Array();
  if (ArrayBuffer.isView(value)) return Float64Array.from(value);
  if (value instanceof ArrayBuffer) return new Float64Array(value);
  return Float64Array.from(value);
}
