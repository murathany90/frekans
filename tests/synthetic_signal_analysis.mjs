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

const rocof = computeRocof(sine.values, { method: "central", thresholdHzPerSecond: 0.004, minEventSeconds: 1 });
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

// -----------------------------------------------------------------------------
// RoCoF Regression Tests
// -----------------------------------------------------------------------------
function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

// 1. Threshold exact value should not trigger event
const thresholdValues = [0, 0.01, 0.03, 0.03, 0.01, 0];
const exactThresholdRocof = computeRocof(thresholdValues, { method: "central", thresholdHzPerSecond: 0.03, minEventSeconds: 1 });
assertEqual(exactThresholdRocof.events.length, 0, "Exact threshold value should not trigger event");

// 2. Event boundaries and durations
const boundaryValues = [
  0, 
  0.04, 0.08, 0.12, 0.16, // pos
  0.16, 
  0.12, 0.08, 0.04, 0.00  // neg
];
// simple diffs:
// i=1: 0.04 (>0.035), i=2: 0.04, i=3: 0.04, i=4: 0.04.
// i=5: 0.00
// i=6: -0.04 (< -0.035), i=7: -0.04, i=8: -0.04, i=9: -0.04
const boundaryRocof = computeRocof(boundaryValues, { method: "simple", thresholdHzPerSecond: 0.035, minEventSeconds: 2 });
const posEvent = boundaryRocof.events.find(e => e.peakHzPerSecond > 0);
const negEvent = boundaryRocof.events.find(e => e.peakHzPerSecond < 0);

assertEqual(posEvent.startSecond, 1, "Positive event startSecond");
assertEqual(posEvent.lastViolationSecond, 4, "Positive event lastViolationSecond");
assertEqual(posEvent.endExclusiveSecond, 5, "Positive event endExclusiveSecond");
assertEqual(posEvent.durationSeconds, 4, "Positive event durationSeconds");

assertEqual(negEvent.startSecond, 6, "Negative event startSecond");
assertEqual(negEvent.lastViolationSecond, 9, "Negative event lastViolationSecond");
assertEqual(negEvent.endExclusiveSecond, 10, "Negative event endExclusiveSecond");
assertEqual(negEvent.durationSeconds, 4, "Negative event durationSeconds");

// 3. Sample quality metrics
// Total 10 values. All finite. method "simple" has 1 boundary NaN at i=0. clean=9.
assertEqual(boundaryRocof.originalValidCount, 10, "originalValidCount");
assertEqual(boundaryRocof.methodDiscardCount, 1, "methodDiscardCount");
assertEqual(boundaryRocof.rocofCalculatedCount, 9, "rocofCalculatedCount");
assertEqual(boundaryRocof.calculatedCount, boundaryRocof.rocofCalculatedCount, "calculatedCount");
assertEqual(boundaryRocof.edgeDiscardCount, 1, "edgeDiscardCount");
assertEqual(boundaryRocof.qualityGapDiscardCount, 0, "qualityGapDiscardCount");
assertEqual(boundaryRocof.filterWindowDiscardCount, 0, "filterWindowDiscardCount");
assertEqual(boundaryRocof.regressionWindowDiscardCount, 0, "regressionWindowDiscardCount");
assertEqual(
  boundaryRocof.edgeDiscardCount + boundaryRocof.qualityGapDiscardCount + boundaryRocof.filterWindowDiscardCount + boundaryRocof.regressionWindowDiscardCount,
  boundaryRocof.methodDiscardCount,
  "discard counter arithmetic"
);

// 4. Moving regression discard metrics
const mrValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 10 values
const mrRocof = computeRocof(mrValues, { method: "movingRegression", windowSeconds: 3, sampleIntervalSeconds: 1 });
// radius = floor((3/1)/2) = 1. Valid bounds: 1 to 8 (8 values). Discard: 2.
assertEqual(mrRocof.originalValidCount, 10, "MR originalValidCount");
assertEqual(mrRocof.methodDiscardCount, 2, "MR methodDiscardCount");
assertEqual(mrRocof.rocofCalculatedCount, 8, "MR rocofCalculatedCount");
assertEqual(mrRocof.calculatedCount, 8, "MR calculatedCount");
assertEqual(mrRocof.edgeDiscardCount, 2, "MR edgeDiscardCount");
assertEqual(mrRocof.regressionWindowDiscardCount, 0, "MR regressionWindowDiscardCount");

// 5. Large-array safety: extrema must not use spread syntax that overflows the call stack.
const millionSampleRamp = new Float64Array(1_000_005);
for (let index = 0; index < millionSampleRamp.length; index += 1) {
  millionSampleRamp[index] = 50 + index * 0.000001;
}
const millionRocof = computeRocof(millionSampleRamp, {
  method: "central",
  sampleIntervalSeconds: 1,
  thresholdHzPerSecond: 0.5,
  minEventSeconds: 1
});
if (!Number.isFinite(millionRocof.maxPositive) || !Number.isFinite(millionRocof.maxNegative)) {
  throw new Error("large-array RoCoF extrema should be finite and must not throw RangeError");
}

console.log("synthetic_signal_analysis ok");
