import {
  analyzeDataQuality,
  computeBasicStats,
  computeCrossCorrelation,
  computeOscillationConfidence,
  computeRocof,
  createSyntheticSignal,
  estimateCoherence,
  estimateDominantFrequency,
  estimatePhaseDifference
} from "../assets/analysis-core.mjs";

function assertNear(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
  }
}

const sine = createSyntheticSignal({ seconds: 600, oscillationHz: 0.12, amplitudeMhz: 20 });
const dominant = estimateDominantFrequency(sine.values, { sampleRateHz: 1, minHz: 0.05, maxHz: 0.25 });
assertNear(dominant.frequencyHz, 0.12, 0.015, "dominant frequency for fixed sine");

const stats = computeBasicStats(sine.values);
if (!(stats.rmsDeviationMhz > 10 && stats.p99Hz > stats.p01Hz)) {
  throw new Error("basic frequency statistics did not capture synthetic oscillation spread");
}

const rocof = computeRocof(sine.values, { method: "central", thresholdHzPerSecond: 0.004 });
if (!(rocof.maxPositive > 0 && rocof.maxNegative < 0 && rocof.events.length > 0)) {
  throw new Error("RoCoF analysis did not detect synthetic rate-of-change events");
}

const delayed = createSyntheticSignal({ seconds: 600, oscillationHz: 0.12, amplitudeMhz: 20, delaySeconds: 2 });
const corr = computeCrossCorrelation(sine.values, delayed.values, { maxLagSeconds: 6 });
assertNear(Math.abs(corr.bestLagSeconds), 2, 1, "cross-correlation lag magnitude");
if (corr.bestCorrelation < 0.9) throw new Error("delayed same signal should have high correlation");

const coherence = estimateCoherence(sine.values, delayed.values, { targetHz: 0.12 });
if (coherence.coherence < 0.85) throw new Error("same delayed signal should have high coherence");

const inverted = createSyntheticSignal({ seconds: 600, oscillationHz: 0.12, amplitudeMhz: 20, phaseRadians: Math.PI });
const phase = estimatePhaseDifference(sine.values, inverted.values, { targetHz: 0.12 });
assertNear(Math.abs(phase.phaseDegrees), 180, 15, "inverse phase difference");

const weak = createSyntheticSignal({ seconds: 600, oscillationHz: 0.12, amplitudeMhz: 3, noiseMhz: 7 });
const confidence = computeOscillationConfidence({
  coverageRatio: 1,
  snr: estimateDominantFrequency(weak.values, { sampleRateHz: 1, minHz: 0.05, maxHz: 0.25 }).snr,
  durationSeconds: 600,
  bandEnergyRatio: 0.35,
  peakProminence: 0.25,
  simultaneousSources: false,
  coherence: 0.2,
  hasGaps: false
});
if (!(confidence.score > 0 && confidence.score < 75)) {
  throw new Error(`weak noisy oscillation should have low/medium confidence, got ${confidence.score}`);
}

const withGap = createSyntheticSignal({ seconds: 120, oscillationHz: 0.12, amplitudeMhz: 20, gaps: [[40, 70]] });
const quality = analyzeDataQuality(withGap.timestamps, withGap.values, { expectedIntervalSeconds: 1, nonFiniteAsMissing: true });
if (quality.longestGapSeconds < 30 || quality.missingCount < 30) {
  throw new Error("data quality analysis did not detect the 30-second gap");
}

console.log("synthetic_signal_analysis ok");
