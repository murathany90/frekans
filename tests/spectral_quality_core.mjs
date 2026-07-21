import assert from "node:assert/strict";
import {
  DEFAULT_SPECTROGRAM_PARAMETERS,
  DEFAULT_WELCH_PARAMETERS,
  computeStftSpectrogram,
  computeWelchPsd,
  createSyntheticSignal,
  prepareSegment
} from "../assets/analysis-core.mjs";

function twoTone({ seconds = 2048, firstHz = 0.12, secondHz = 0.18 }) {
  const values = new Float64Array(seconds);
  for (let index = 0; index < seconds; index += 1) {
    values[index] = 50
      + 0.02 * Math.sin(2 * Math.PI * firstHz * index)
      + 0.014 * Math.sin(2 * Math.PI * secondHz * index);
  }
  return values;
}

function chirp(seconds = 2048) {
  const values = new Float64Array(seconds);
  let phase = 0;
  for (let index = 0; index < seconds; index += 1) {
    const ratio = index / Math.max(1, seconds - 1);
    const frequency = 0.10 + 0.10 * ratio;
    phase += 2 * Math.PI * frequency;
    values[index] = 50 + 0.02 * Math.sin(phase);
  }
  return values;
}

function withValidRatio(length, ratio) {
  const values = new Float64Array(length);
  values.fill(50);
  const valid = Math.round(length * ratio);
  for (let index = valid; index < length; index += 1) values[index] = NaN;
  return values;
}

assert.deepEqual(DEFAULT_WELCH_PARAMETERS, {
  sampleRateHz: 1,
  segmentSeconds: 256,
  stepSeconds: 128,
  windowType: "hann",
  detrend: "constant",
  minValidRatio: 0.75,
  scale: "linear",
  averaging: "mean",
  maxPeaks: 5
});
assert.deepEqual(DEFAULT_SPECTROGRAM_PARAMETERS, {
  sampleRateHz: 1,
  segmentSeconds: 256,
  stepSeconds: 64,
  windowType: "hann",
  detrend: "constant",
  minValidRatio: 0.75,
  scale: "log"
});

const sine012 = createSyntheticSignal({ seconds: 2048, oscillationHz: 0.12, amplitudeMhz: 25 });
const welch300 = computeWelchPsd(sine012.values, {
  sampleRateHz: 1,
  segmentSeconds: 300,
  stepSeconds: 128,
  minHz: 0.05,
  maxHz: 0.25,
  maxPeaks: 3
});
assert.equal(welch300.requestedSegmentSeconds, 300);
assert.equal(welch300.requestedSegmentSamples, 300);
assert.equal(welch300.effectiveSegmentSamples, 300);
assert.equal(welch300.effectiveSegmentSeconds, 300);
assert.equal(welch300.fftLengthSamples, 512);
assert.equal(welch300.adjustmentApplied, true);
assert.match(welch300.adjustmentReason, /zero-padding|sıfır|power/i);
assert.equal(welch300.frequencyResolutionHz, 1 / welch300.fftLengthSamples);
assert.equal(welch300.nyquistHz, 0.5);

const at74 = prepareSegment(withValidRatio(100, 0.74), 0, 100, { minValidRatio: 0.75, gapHandlingMethod: "segment-mean" });
const at75 = prepareSegment(withValidRatio(100, 0.75), 0, 100, { minValidRatio: 0.75, gapHandlingMethod: "segment-mean" });
const at76 = prepareSegment(withValidRatio(100, 0.76), 0, 100, { minValidRatio: 0.75, gapHandlingMethod: "segment-mean" });
assert.equal(at74.accepted, false);
assert.equal(at74.rejectedReason, "min-valid-ratio");
assert.equal(at75.accepted, true);
assert.equal(at75.imputedCount, 25);
assert.equal(at76.accepted, true);
assert.equal(at76.imputedCount, 24);
const allMissing = prepareSegment(new Float64Array(32).fill(NaN), 0, 32, { minValidRatio: 0.75 });
assert.equal(allMissing.accepted, false);
assert.equal(allMissing.validCount, 0);

const shortGap = new Float64Array([50, 50.01, NaN, NaN, 50.04, 50.05, 50.06, 50.07]);
const shortGapSegment = prepareSegment(shortGap, 0, shortGap.length, {
  minValidRatio: 0.5,
  gapHandlingMethod: "short-gap-linear",
  maxInterpolationGapSamples: 2
});
assert.equal(shortGapSegment.accepted, true);
assert.equal(shortGapSegment.imputationMethod, "short-gap-linear");
assert.equal(shortGapSegment.imputedCount, 2);
const longGap = new Float64Array([50, NaN, NaN, NaN, 50.04, 50.05, 50.06, 50.07]);
const longGapSegment = prepareSegment(longGap, 0, longGap.length, {
  minValidRatio: 0.5,
  gapHandlingMethod: "short-gap-linear",
  maxInterpolationGapSamples: 2
});
assert.equal(longGapSegment.accepted, false);
assert.equal(longGapSegment.rejectedReason, "unfilled-gap");

const gappy = new Float64Array(1024);
for (let index = 0; index < gappy.length; index += 1) {
  gappy[index] = 50 + 0.02 * Math.sin(2 * Math.PI * 0.12 * index);
}
for (let index = 200; index < 220; index += 1) gappy[index] = NaN;
const welchGappy = computeWelchPsd(gappy, {
  sampleRateHz: 1,
  segmentSeconds: 128,
  stepSeconds: 64,
  minValidRatio: 0.75,
  minHz: 0.05,
  maxHz: 0.25
});
assert.equal(welchGappy.candidateSegmentCount, 15);
assert.equal(welchGappy.acceptedSegmentCount, welchGappy.segmentCount);
assert.equal(welchGappy.rejectedSegmentCount + welchGappy.acceptedSegmentCount, welchGappy.candidateSegmentCount);
assert(welchGappy.imputedSegmentCount > 0);
assert(welchGappy.totalImputedSampleCount > 0);
assert(welchGappy.meanValidRatio >= welchGappy.minimumAcceptedValidRatio);
assert.equal(welchGappy.gapHandlingMethod, "segment-mean");

const two = computeWelchPsd(twoTone({}), {
  sampleRateHz: 1,
  segmentSeconds: 256,
  stepSeconds: 128,
  minHz: 0.05,
  maxHz: 0.25,
  maxPeaks: 5,
  averaging: "median"
});
assert.equal(two.averagingMethod, "median");
assert(two.peaks.some(peak => Math.abs(peak.frequencyHz - 0.12) < 0.01));
assert(two.peaks.some(peak => Math.abs(peak.frequencyHz - 0.18) < 0.01));
assert(two.peaks.every(peak => Number.isFinite(peak.snrLinear)));
assert(two.peaks.every(peak => Number.isFinite(peak.snrDb)));
assert(two.peaks.every(peak => Number.isFinite(peak.peakProminence)));
assert(two.peaks.every(peak => Number.isFinite(peak.peakBandwidthHz)));
assert(two.peaks.every(peak => Number.isFinite(peak.qualityFactor)));
assert(Number.isFinite(two.snrLinear));
assert(Number.isFinite(two.snrDb));
assert.equal(two.snr, two.snrLinear);
assert(two.degreesOfFreedom >= two.acceptedSegmentCount * 2);
assert(two.confidenceInterval95.lowerFactor < 1);
assert(two.confidenceInterval95.upperFactor > 1);
assert(two.totalBandPower > 0);
assert(Math.abs(two.parsevalErrorRatio) < 0.35);

const spectrogram = computeStftSpectrogram(chirp(), {
  sampleRateHz: 1,
  segmentSeconds: 300,
  stepSeconds: 64,
  minHz: 0.05,
  maxHz: 0.25,
  scale: "log",
  analysisStartEpochMs: Date.UTC(2026, 0, 1),
  analysisTimezone: "Europe/Istanbul"
});
assert.equal(spectrogram.units, "dB re 1 Hz²/Hz");
assert.equal(spectrogram.requestedSegmentSeconds, 300);
assert.equal(spectrogram.effectiveSegmentSamples, 300);
assert.equal(spectrogram.fftLengthSamples, 512);
assert.equal(spectrogram.frequencyResolutionHz, 1 / 512);
assert.equal(spectrogram.timeResolutionSeconds, 64);
assert.equal(spectrogram.timeBinReference, "window-center");
assert.equal(spectrogram.analysisStartEpochMs, Date.UTC(2026, 0, 1));
assert.equal(spectrogram.analysisTimezone, "Europe/Istanbul");
assert(spectrogram.powerValues instanceof Float32Array);
assert.equal(spectrogram.powerValues.length, spectrogram.rowCount * spectrogram.columnCount);
assert.equal(spectrogram.timeBins.length, spectrogram.rowCount);
assert.equal(spectrogram.frequencyBins.length, spectrogram.columnCount);
assert.equal(spectrogram.validityByTime.length, spectrogram.rowCount);
assert.equal(spectrogram.imputedSamplesByTime.length, spectrogram.rowCount);
assert(Number.isFinite(spectrogram.peaksByTime[1].frequencyHz));

const invalidSpectrogram = computeStftSpectrogram(gappy, {
  sampleRateHz: 1,
  segmentSeconds: 128,
  stepSeconds: 64,
  minValidRatio: 0.95,
  minHz: 0.05,
  maxHz: 0.25
});
assert(invalidSpectrogram.invalidWindowCount > 0);
assert(invalidSpectrogram.validityByTime.some(value => value < 0.95));

assert.throws(() => computeWelchPsd(sine012.values, { sampleRateHz: 0 }), /sampleRateHz/i);
assert.throws(() => computeWelchPsd(sine012.values, { segmentSeconds: 4 }), /segmentSamples/i);
assert.throws(() => computeWelchPsd(sine012.values, { stepSeconds: 999 }), /stepSamples/i);
assert.throws(() => computeWelchPsd(sine012.values, { minValidRatio: 1.2 }), /minValidRatio/i);
assert.throws(() => computeWelchPsd(sine012.values, { minHz: 0.3, maxHz: 0.2 }), /minHz/i);
assert.throws(() => computeWelchPsd(sine012.values, { maxHz: 0.7 }), /Nyquist/i);
assert.throws(() => computeWelchPsd(sine012.values, { maxPeaks: 0 }), /maxPeaks/i);
assert.throws(() => computeWelchPsd(sine012.values, { windowType: "blackman" }), /windowType/i);
assert.throws(() => computeWelchPsd(sine012.values, { detrend: "quadratic" }), /detrend/i);
assert.throws(() => computeStftSpectrogram(sine012.values, { scale: "sqrt" }), /scale/i);
assert.throws(() => computeStftSpectrogram(new Float64Array(16), { segmentSeconds: 256 }), /too short|short/i);

const tooLarge = createSyntheticSignal({ seconds: 4096, oscillationHz: 0.12, amplitudeMhz: 20 });
assert.throws(() => computeStftSpectrogram(tooLarge.values, {
  sampleRateHz: 1,
  segmentSeconds: 64,
  stepSeconds: 1,
  minHz: 0,
  maxHz: 0.5,
  maxCells: 1000
}), /cell/i);

console.log("spectral_quality_core ok");
