import {
  computeCrossCorrelation,
  computeCrossPowerSpectralDensity,
  computeMagnitudeSquaredCoherence,
  computeRocof,
  computeStftSpectrogram,
  computeWelchPsd,
  createSyntheticSignal,
  estimateCoherence,
  estimateDominantFrequency
} from "../assets/analysis-core.mjs";

function assertNear(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
}

function assert(condition, label) {
  if (!condition) throw new Error(label);
}

function seededNoise(seconds, seed) {
  const values = new Float64Array(seconds);
  let state = seed >>> 0;
  for (let i = 0; i < seconds; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    values[i] = 50 + ((state / 0xffffffff) - 0.5) * 0.05;
  }
  return values;
}

function twoTone({ seconds = 1024, firstHz = 0.12, secondHz = 0.18 }) {
  const values = new Float64Array(seconds);
  for (let i = 0; i < seconds; i += 1) {
    values[i] = 50 + 0.02 * Math.sin(2 * Math.PI * firstHz * i) + 0.012 * Math.sin(2 * Math.PI * secondHz * i);
  }
  return values;
}

function splitFrequencySignal(seconds = 1024) {
  const values = new Float64Array(seconds);
  for (let i = 0; i < seconds; i += 1) {
    const f = i < seconds / 2 ? 0.10 : 0.20;
    values[i] = 50 + 0.02 * Math.sin(2 * Math.PI * f * i);
  }
  return values;
}

const sine012 = createSyntheticSignal({ seconds: 1024, oscillationHz: 0.12, amplitudeMhz: 20 });
const welch012 = computeWelchPsd(sine012.values, {
  sampleRateHz: 1,
  segmentLength: 256,
  overlapRatio: 0.5,
  windowType: "hann",
  minHz: 0.05,
  maxHz: 0.25,
  maxPeaks: 3
});
assert(welch012.method === "welch-psd", "Welch result must identify the real method");
assert(welch012.segmentCount > 3, "Welch PSD must average multiple segments");
assertNear(welch012.peaks[0].frequencyHz, 0.12, 0.01, "Welch peak for 0.12 Hz sine");
assert(welch012.peaks[0].psd > welch012.noiseFloor * 20, "Welch peak should rise above noise floor");
assert(welch012.units === "Hz^2/Hz", "PSD units must be explicit");

const two = computeWelchPsd(twoTone({}), {
  sampleRateHz: 1,
  segmentLength: 256,
  overlapRatio: 0.5,
  windowType: "hamming",
  minHz: 0.05,
  maxHz: 0.25,
  maxPeaks: 5
});
const peakFrequencies = two.peaks.slice(0, 3).map(peak => peak.frequencyHz);
assert(peakFrequencies.some(f => Math.abs(f - 0.12) < 0.012), "Welch PSD must find 0.12 Hz component");
assert(peakFrequencies.some(f => Math.abs(f - 0.18) < 0.012), "Welch PSD must find 0.18 Hz component");

const delayed = createSyntheticSignal({ seconds: 1024, oscillationHz: 0.12, amplitudeMhz: 20, delaySeconds: 3 });
const coherence = computeMagnitudeSquaredCoherence(sine012.values, delayed.values, {
  sampleRateHz: 1,
  segmentLength: 256,
  overlapRatio: 0.5,
  windowType: "hann",
  minHz: 0.05,
  maxHz: 0.25
});
assert(coherence.segmentCount > 3, "Coherence must use segment averaging");
assert(coherence.maxCoherence <= 1 && coherence.maxCoherence >= 0, "Coherence must stay in [0,1]");
assertNear(coherence.maxCoherenceFrequencyHz, 0.12, 0.015, "Coherence maximum should be at shared oscillation");
assert(coherence.bandAverageCoherence > 0.7, "Delayed same signal should have high band coherence");

const unrelated = computeMagnitudeSquaredCoherence(seededNoise(2048, 1), seededNoise(2048, 99), {
  sampleRateHz: 1,
  segmentLength: 128,
  overlapRatio: 0.5,
  windowType: "hann",
  minHz: 0.05,
  maxHz: 0.25
});
assert(unrelated.bandAverageCoherence < 0.45, `Unrelated noise should not look coherent, got ${unrelated.bandAverageCoherence}`);
const legacy = estimateCoherence(seededNoise(2048, 1), seededNoise(2048, 99), { targetHz: 0.12 });
assert(legacy.coherence < 0.65, "Legacy estimateCoherence wrapper must not return artificial unity coherence");

const commonBandX = twoTone({ seconds: 2048, firstHz: 0.12, secondHz: 0.20 });
const commonBandY = twoTone({ seconds: 2048, firstHz: 0.12, secondHz: 0.32 });
const banded = computeMagnitudeSquaredCoherence(commonBandX, commonBandY, {
  sampleRateHz: 1,
  segmentLength: 256,
  overlapRatio: 0.5,
  minHz: 0.05,
  maxHz: 0.35
});
const near012 = banded.points.find(point => Math.abs(point.frequencyHz - 0.12) < 0.006);
const near020 = banded.points.find(point => Math.abs(point.frequencyHz - 0.20) < 0.006);
assert(near012?.coherence > 0.7, "Shared band should be coherent");
assert((near020?.coherence ?? 1) < 0.6, "Non-shared band should not be highly coherent");

const cross = computeCrossPowerSpectralDensity(sine012.values, delayed.values, {
  sampleRateHz: 1,
  segmentLength: 256,
  overlapRatio: 0.5,
  minHz: 0.05,
  maxHz: 0.25,
  targetHz: 0.12
});
assertNear(cross.selectedFrequencyHz, 0.12, 0.01, "Cross PSD selected frequency");
assert(Number.isFinite(cross.selectedPhaseDegrees), "Cross PSD must expose selected phase");
assert(cross.phaseConfidence === "high" || cross.phaseConfidence === "medium", "High coherence phase should not be low confidence");

const spectrogram = computeStftSpectrogram(splitFrequencySignal(), {
  sampleRateHz: 1,
  segmentLength: 128,
  overlapRatio: 0.5,
  windowType: "hann",
  minHz: 0.05,
  maxHz: 0.25,
  scale: "linear"
});
assert(spectrogram.timeBins.length > 5, "STFT must produce multiple time bins");
assert(spectrogram.frequencyBins.length > 10, "STFT must produce frequency bins");
const firstPeak = spectrogram.peaksByTime[1].frequencyHz;
const lastPeak = spectrogram.peaksByTime.at(-2).frequencyHz;
assertNear(firstPeak, 0.10, 0.025, "STFT first-half peak");
assertNear(lastPeak, 0.20, 0.025, "STFT second-half peak");

const invertedDelayed = createSyntheticSignal({ seconds: 1024, oscillationHz: 0.12, amplitudeMhz: 20, delaySeconds: 4, phaseRadians: Math.PI });
const corr = computeCrossCorrelation(sine012.values, invertedDelayed.values, { maxLagSeconds: 8, sampleIntervalSeconds: 1 });
assert(corr.bestPositiveCorrelation > 0.8, "Cross correlation must still report best positive correlation");
assert(corr.bestNegativeCorrelation < -0.8, "Cross correlation must report best negative correlation");
assert(Math.abs(corr.bestAbsoluteCorrelation) > 0.8, "Cross correlation must report strongest absolute correlation");
assertNear(Math.abs(corr.bestAbsoluteLagSeconds), 4, 2, "Cross correlation lag seconds should use sampling interval");

const fastSample = createSyntheticSignal({ seconds: 300, sampleRateHz: 2, oscillationHz: 0.08, amplitudeMhz: 25 });
const regressionRocof = computeRocof(fastSample.values, {
  method: "movingRegression",
  sampleIntervalSeconds: 0.5,
  windowSeconds: 5,
  thresholdHzPerSecond: 0.003
});
const filteredRocof = computeRocof(fastSample.values, {
  method: "filteredDerivative",
  sampleIntervalSeconds: 0.5,
  preFilterSeconds: 5,
  thresholdHzPerSecond: 0.003
});
assert(regressionRocof.events.length > 0, "Moving regression RoCoF should detect synthetic events");
assert(filteredRocof.events.length > 0, "Filtered derivative RoCoF should detect synthetic events");
assert(regressionRocof.sampleIntervalSeconds === 0.5, "RoCoF must preserve explicit sample interval");

const scan = estimateDominantFrequency(sine012.values, { sampleRateHz: 1, minHz: 0.05, maxHz: 0.25 });
assert(scan.method === "welch-psd", "estimateDominantFrequency should use real Welch PSD after the fix");

console.log("spectral_methods ok");
