import assert from "node:assert/strict";
import { analyzeDataQuality } from "../assets/analysis-core.mjs";

function assertClose(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: expected ${expected}, got ${actual}`);
}

const duplicate = analyzeDataQuality(
  [0, 1, 1, 2],
  [50, 50.01, 50.02, 50.03],
  { expectedIntervalSeconds: 1, startSecond: 0, endSecond: 3, validMinHz: 49, validMaxHz: 51 },
);

assert.equal(duplicate.expectedCount, 3, "expected seconds use the half-open analysis window");
assert.equal(duplicate.validCount, 3, "duplicate timestamps must not inflate valid sample count");
assert.equal(duplicate.duplicateTimestampCount, 1, "duplicate timestamp count is tracked separately");
assertClose(duplicate.coverageRatio, 1, "coverage is capped at unique valid timestamps / expected seconds");

const missing = analyzeDataQuality(
  [0, 1, 4],
  [50, 50.01, 50.02],
  { expectedIntervalSeconds: 1, startSecond: 0, endSecond: 5, validMinHz: 49, validMaxHz: 51 },
);

assert.equal(missing.expectedCount, 5, "missing scenario expected seconds");
assert.equal(missing.validCount, 3, "missing seconds do not count as valid samples");
assert.equal(missing.missingCount, 2, "missing seconds are counted separately");
assert.equal(missing.gapEventCount, 1, "one contiguous missing run is one gap event");
assert.equal(missing.shortGapCount, 1, "legacy shortGapCount reflects real gap events");
assert.equal(missing.longestGapSeconds, 2, "longest data gap is measured in seconds");

const invalid = analyzeDataQuality(
  [0, 1, 2, 3],
  [50, 52, 48.5, 50.01],
  { expectedIntervalSeconds: 1, startSecond: 0, endSecond: 4, validMinHz: 49, validMaxHz: 51 },
);

assert.equal(invalid.expectedCount, 4, "invalid scenario expected seconds");
assert.equal(invalid.validCount, 2, "out-of-range finite values are invalid, not valid");
assert.equal(invalid.invalidCount, 2, "invalid finite values are counted separately from missing");
assert.equal(invalid.missingCount, 0, "present invalid timestamps are not missing samples");
assertClose(invalid.coverageRatio, 0.5, "coverage excludes invalid timestamps");
assertClose(invalid.goodQualityRatio, 0.5, "good quality excludes invalid timestamps");

const invalidPresentTimestamps = analyzeDataQuality(
  [0, 1, 2, 3, 4],
  [50, NaN, Infinity, "", 50.01],
  { expectedIntervalSeconds: 1, startSecond: 0, endSecond: 5, validMinHz: 49, validMaxHz: 51 },
);

assert.equal(invalidPresentTimestamps.expectedCount, 5, "present bad-value timestamps are still expected samples");
assert.equal(invalidPresentTimestamps.validCount, 2, "only physically valid samples count as valid");
assert.equal(invalidPresentTimestamps.invalidCount, 3, "NaN, Infinity, empty/parse-bad values are invalid when timestamp is present");
assert.equal(invalidPresentTimestamps.missingCount, 0, "present invalid timestamps must not be mixed with missing samples");

const nineSecondRepeatedDefault = analyzeDataQuality(
  Array.from({ length: 9 }, (_, index) => index),
  Array.from({ length: 9 }, () => 50),
  { expectedIntervalSeconds: 1, startSecond: 0, endSecond: 9, validMinHz: 49, validMaxHz: 51 },
);

assert.equal(nineSecondRepeatedDefault.repeatedValueEventCount, 0, "default repeated-value threshold is 10 seconds");

const repeated = analyzeDataQuality(
  [0, 1, 2, 3, 4, 5, 6],
  [50, 50, 50, 50, 50, 50.01, 50.02],
  {
    expectedIntervalSeconds: 1,
    startSecond: 0,
    endSecond: 7,
    validMinHz: 49,
    validMaxHz: 51,
    repeatedValueThresholdSeconds: 5,
  },
);

assert.equal(repeated.repeatedValueEventCount, 1, "5-second flat runs are repeated-value events when the threshold is set to 5");
assert.equal(repeated.totalRepeatedValueSeconds, 5, "total repeated-value duration includes all seconds in the bad run");
assert.equal(repeated.longestRepeatedValueSeconds, 5, "longest repeated-value duration is tracked separately");
assertClose(repeated.coverageRatio, 1, "repeated values still count as covered data");
assertClose(repeated.goodQualityRatio, 2 / 7, "repeated values are excluded from good quality data");
assert.equal(repeated.repeatedValueEvents[0].type, "repeated");
assert.equal(repeated.repeatedValueEvents[0].classification, "Bad Quality - Repeated Value");

const repeatedFifteenSeconds = analyzeDataQuality(
  Array.from({ length: 18 }, (_, index) => index),
  [...Array.from({ length: 15 }, () => 49.99), 50.01, 50.02, 50.03],
  {
    expectedIntervalSeconds: 1,
    startSecond: 0,
    endSecond: 18,
    validMinHz: 49,
    validMaxHz: 51,
    repeatedValueThresholdSeconds: 10,
  },
);

assert.equal(repeatedFifteenSeconds.repeatedValueEventCount, 1, "a 15-second repeated run is one event, not 15 samples");
assert.equal(repeatedFifteenSeconds.totalRepeatedValueSeconds, 15, "15-second repeated run duration is preserved");

const duplicateAndStuck = analyzeDataQuality(
  [0, 1, 1, 2, 3, 4],
  [50, 50, 50, 50, 50, 50],
  {
    expectedIntervalSeconds: 1,
    startSecond: 0,
    endSecond: 5,
    validMinHz: 49,
    validMaxHz: 51,
    repeatedValueThresholdSeconds: 5,
  },
);

assert.equal(duplicateAndStuck.duplicateTimestampCount, 1, "duplicate timestamp remains a separate metric");
assert.equal(duplicateAndStuck.repeatedValueEventCount, 1, "repeated-value detection uses the canonical one-second axis");
assertClose(duplicateAndStuck.coverageRatio, 1, "duplicate plus repeated value still cannot push coverage above 100%");

console.log("data_quality_core checks passed");
