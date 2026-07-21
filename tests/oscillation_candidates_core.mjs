import assert from "node:assert/strict";

import {
  DEFAULT_OSCILLATION_PARAMETERS,
  computeOscillationCandidates
} from "../assets/analysis-core.mjs";

function assertNear(actual, expected, tolerance, label) {
  assert(Number.isFinite(actual), `${label}: expected finite value, got ${actual}`);
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
}

function modalSeries({
  seconds = 900,
  frequencyHz = 0.12,
  amplitudeHz = 0.02,
  sigma = 0,
  startSecond = 0,
  endSecond = seconds,
  noiseHz = 0,
  gaps = [],
  chirpHzPerSecond = 0
} = {}) {
  const values = new Float64Array(seconds);
  let seed = 42;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff - 0.5) * 2;
  };
  for (let i = 0; i < seconds; i += 1) {
    let value = 50;
    if (i >= startSecond && i < endSecond) {
      const t = i - startSecond;
      const f = frequencyHz + chirpHzPerSecond * t;
      value += amplitudeHz * Math.exp(sigma * t) * Math.cos(2 * Math.PI * f * t);
    }
    if (noiseHz) value += noiseHz * noise();
    values[i] = value;
  }
  for (const [from, to] of gaps) {
    for (let i = Math.max(0, from); i < Math.min(seconds, to); i += 1) values[i] = NaN;
  }
  return values;
}

const expectedDefaultKeys = [
  "minFrequencyHz",
  "maxFrequencyHz",
  "thresholdMode",
  "enterThresholdMilliHz",
  "exitThresholdMilliHz",
  "minimumEventSeconds",
  "minimumCycles",
  "mergeGapSeconds",
  "filterOrder",
  "filterPhaseMode",
  "rmsWindowSeconds",
  "spectralWindowSeconds",
  "spectralStepSeconds",
  "minimumSnrDb",
  "minimumProminence",
  "minimumValidRatio",
  "gapHandlingMethod",
  "dampingEnabled",
  "dampingMethod"
];
for (const key of expectedDefaultKeys) {
  assert(Object.hasOwn(DEFAULT_OSCILLATION_PARAMETERS, key), `DEFAULT_OSCILLATION_PARAMETERS.${key} is required`);
}

const baseParams = {
  sampleRateHz: 1,
  minFrequencyHz: 0.08,
  maxFrequencyHz: 0.18,
  thresholdMode: "fixed",
  enterThresholdMilliHz: 5,
  exitThresholdMilliHz: 3,
  minimumEventSeconds: 25,
  minimumCycles: 3,
  mergeGapSeconds: 8,
  filterOrder: 80,
  filterPhaseMode: "zero-phase",
  rmsWindowSeconds: 60,
  spectralWindowSeconds: 256,
  spectralStepSeconds: 64,
  minimumSnrDb: 3,
  minimumProminence: 0.02,
  minimumValidRatio: 0.8,
  gapHandlingMethod: "reject",
  dampingEnabled: true,
  dampingMethod: "envelope-regression"
};

const ringdown = computeOscillationCandidates(
  modalSeries({ sigma: -0.006, amplitudeHz: 0.06, startSecond: 60, endSecond: 620 }),
  baseParams
);
assert.equal(ringdown.method, "oscillation-candidates");
assert.equal(ringdown.parameters.requestedFilterOrder, 80);
assert.equal(ringdown.parameters.effectiveFilterOrder % 2, 0);
assert(ringdown.parameters.filterTapCount >= 81);
assert(ringdown.parameters.edgeDiscardSeconds > 0);
assert(ringdown.edgeDiscardCount > 0);
assert(ringdown.candidates.length >= 1, "ringdown should produce a candidate");
const ringdownCandidate = ringdown.candidates[0];
assert.equal(ringdownCandidate.candidateType, "ringdown");
assertNear(ringdownCandidate.dominantHz, 0.12, 0.015, "ringdown dominant frequency");
assert(ringdownCandidate.minimumCyclesSatisfied, "ringdown should satisfy minimum cycles");
assert(ringdownCandidate.confidenceComponents.coverageContribution >= 0);
assert(ringdownCandidate.confidenceComponents.snrContribution > 0);
assert.equal(ringdownCandidate.damping.dampingStatus, "available");
assert(ringdownCandidate.damping.dampingRatio > 0, "decaying ringdown should have positive damping ratio");
assert(ringdownCandidate.damping.fitR2 > 0.45, "ringdown fit quality should be reported");

const forced = computeOscillationCandidates(
  modalSeries({ amplitudeHz: 0.022, seconds: 900 }),
  baseParams
);
assert(forced.candidates.length >= 1, "forced sine should produce a candidate");
assert.equal(forced.candidates[0].candidateType, "sustained_forced");
assert.equal(forced.candidates[0].damping.dampingStatus, "unavailable");
assert.match(forced.candidates[0].damping.dampingUnavailableReason, /forced|continuous/i);

const growing = computeOscillationCandidates(
  modalSeries({ sigma: 0.004, amplitudeHz: 0.006, startSecond: 40, endSecond: 760 }),
  { ...baseParams, enterThresholdMilliHz: 3, exitThresholdMilliHz: 2 }
);
assert(growing.candidates.length >= 1, "growing signal should produce a candidate");
assert.equal(growing.candidates[0].candidateType, "growing");
assert(growing.candidates[0].damping.dampingRatio < 0, "growing mode should report negative damping ratio");

const tooShort = computeOscillationCandidates(
  modalSeries({ amplitudeHz: 0.06, startSecond: 50, endSecond: 64 }),
  baseParams
);
assert.equal(tooShort.candidates.length, 0, "candidate shorter than minimum cycles must be rejected");
assert(tooShort.rejectedCandidateCount >= 1, "short candidate should be counted as rejected");

const gapped = computeOscillationCandidates(
  modalSeries({ amplitudeHz: 0.03, seconds: 500, gaps: [[210, 260]] }),
  { ...baseParams, mergeGapSeconds: 120, minimumEventSeconds: 20 }
);
assert(gapped.candidates.length >= 2, "events must not be merged across missing-data gaps");
assert(gapped.candidates.every(candidate => candidate.dataQuality.missingCount === 0), "accepted candidates should not span missing samples");

function finiteGapBursts() {
  const values = new Float64Array(1000).fill(50);
  for (let i = 80; i < 850; i += 1) {
    if (i >= 420 && i < 520) continue;
    const t = i < 420 ? i - 80 : i - 520;
    values[i] += 0.035 * Math.cos(2 * Math.PI * 0.12 * t);
  }
  return values;
}

const splitFiniteGap = computeOscillationCandidates(
  finiteGapBursts(),
  { ...baseParams, mergeGapSeconds: 10, minimumSnrDb: 0, spectralWindowSeconds: 128, spectralStepSeconds: 32 }
);
const mergedFiniteGap = computeOscillationCandidates(
  finiteGapBursts(),
  { ...baseParams, mergeGapSeconds: 160, minimumSnrDb: 0, spectralWindowSeconds: 128, spectralStepSeconds: 32 }
);
assert(splitFiniteGap.candidates.length >= 2, "short-gap merging should be controlled by mergeGapSeconds");
assert.equal(mergedFiniteGap.candidates.length, 1, "finite quality gaps shorter than mergeGapSeconds may be merged");

const thresholdProbe = computeOscillationCandidates(
  modalSeries({ amplitudeHz: 0.04, seconds: 600 }),
  { ...baseParams, enterThresholdMilliHz: 2, exitThresholdMilliHz: 1, minimumSnrDb: 0 }
);
const equalThreshold = thresholdProbe.candidates[0]?.peakAmplitudeMhz;
assert(Number.isFinite(equalThreshold), "threshold equality probe needs a finite peak");
const equalThresholdResult = computeOscillationCandidates(
  modalSeries({ amplitudeHz: 0.04, seconds: 600 }),
  { ...baseParams, enterThresholdMilliHz: equalThreshold, exitThresholdMilliHz: equalThreshold, minimumSnrDb: 0 }
);
const aboveThresholdResult = computeOscillationCandidates(
  modalSeries({ amplitudeHz: 0.04, seconds: 600 }),
  { ...baseParams, enterThresholdMilliHz: equalThreshold * 0.7, exitThresholdMilliHz: equalThreshold * 0.5, minimumSnrDb: 0 }
);
assert.equal(equalThresholdResult.candidates.length, 0, "values equal to the enter threshold must not start an event");
assert(aboveThresholdResult.candidates.length >= 1, "values above the enter threshold should start an event");

const adaptive = computeOscillationCandidates(
  finiteGapBursts(),
  { ...baseParams, thresholdMode: "adaptive", enterThresholdMilliHz: 2, exitThresholdMilliHz: 1, minimumSnrDb: 0 }
);
assert.equal(adaptive.thresholdMode, "adaptive");
assert(adaptive.enterThresholdMilliHz > 2, "adaptive MAD threshold should be visible in result metadata");
assert(adaptive.exitThresholdMilliHz >= 1, "adaptive exit threshold should be visible in result metadata");

const chirp = computeOscillationCandidates(
  modalSeries({ amplitudeHz: 0.025, seconds: 700, frequencyHz: 0.09, chirpHzPerSecond: 0.00008 }),
  { ...baseParams, minFrequencyHz: 0.07, maxFrequencyHz: 0.18, minimumSnrDb: 0 }
);
assert(chirp.candidates.some(candidate => candidate.candidateType === "frequency_drifting" || candidate.ridge.frequencyDriftHz > 0.02));

assert.throws(
  () => computeOscillationCandidates(modalSeries(), { ...baseParams, maxFrequencyHz: 0.55 }),
  /Nyquist/i,
  "Nyquist upper-band validation must be explicit"
);

console.log("oscillation_candidates_core ok");
