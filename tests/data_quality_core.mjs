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

const stuck = analyzeDataQuality(
  [0, 1, 2, 3, 4, 5, 6],
  [50, 50, 50, 50, 50, 50.01, 50.02],
  {
    expectedIntervalSeconds: 1,
    startSecond: 0,
    endSecond: 7,
    validMinHz: 49,
    validMaxHz: 51,
    stuckThresholdSeconds: 5,
  },
);

assert.equal(stuck.stuckValueEventCount, 1, "5-second flat runs are stuck-value events");
assert.equal(stuck.totalStuckSeconds, 5, "total stuck duration includes all seconds in the bad run");
assert.equal(stuck.longestStuckSeconds, 5, "longest stuck duration is tracked separately");
assertClose(stuck.coverageRatio, 1, "stuck values still count as covered data");
assertClose(stuck.goodQualityRatio, 2 / 7, "stuck values are excluded from good quality data");
assert.equal(stuck.stuckEvents[0].classification, "Bad Quality - Stuck Value");

const duplicateAndStuck = analyzeDataQuality(
  [0, 1, 1, 2, 3, 4],
  [50, 50, 50, 50, 50, 50],
  {
    expectedIntervalSeconds: 1,
    startSecond: 0,
    endSecond: 5,
    validMinHz: 49,
    validMaxHz: 51,
    stuckThresholdSeconds: 5,
  },
);

assert.equal(duplicateAndStuck.duplicateTimestampCount, 1, "duplicate timestamp remains a separate metric");
assert.equal(duplicateAndStuck.stuckValueEventCount, 1, "stuck-value detection uses the canonical one-second axis");
assertClose(duplicateAndStuck.coverageRatio, 1, "duplicate plus stuck still cannot push coverage above 100%");

console.log("data_quality_core checks passed");
