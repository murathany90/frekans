import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../frekans_rapor_v1.html", import.meta.url), "utf8");
const core = readFileSync(new URL("../assets/analysis-core.mjs", import.meta.url), "utf8");
const eventsBlock = html.match(/events:\s*\{[\s\S]*?\n\s*\},\s*\n\s*rocof:/)?.[0] || "";

assert.match(html, /function computeBandViolationEvents\s*\(/, "Band violation analysis should use a central event function.");
assert.match(
  eventsBlock,
  /allowedSources:\s*\[\s*['"]tr['"]\s*,\s*['"]de['"]\s*,\s*['"]both['"]\s*,\s*['"]common['"]\s*\]/,
  "Band violation should only allow 50 Hz-centered source modes."
);
assert.doesNotMatch(
  eventsBlock,
  /allowedSources:\s*\[[^\]]*['"]diff['"][^\]]*\]/,
  "Band violation should not allow raw TR-CE difference sources."
);
assert.doesNotMatch(
  eventsBlock,
  /allowedSources:\s*\[[^\]]*['"]differential['"][^\]]*\]/,
  "Band violation should not allow differential mode sources."
);
assert.match(
  eventsBlock,
  /parameterKeys:\s*\[\s*['"]statsBand['"]\s*,\s*['"]yd['"]\s*,\s*['"]duration['"]\s*\]/,
  "Band violation should use the shared frequency band, YD/RV threshold, and minimum duration controls."
);
assert.match(
  html,
  /LIMITED_DATE_MODE_ANALYSES\s*=\s*new Set\(\s*\[\s*['"]quality['"]\s*,\s*['"]stats['"]\s*,\s*['"]events['"]\s*,\s*['"]rocof['"]\s*\]\s*\)/,
  "Band violation should use the single-day/date-range-only date mode."
);
assert.match(
  html,
  /type\s*===\s*['"]events['"][\s\S]{0,120}return\s*['"]1s['"]/,
  "Band violation computation resolution should be locked to 1s."
);
assert.match(core, /bandMinHz\s*=\s*49\.90/, "Shared lower band default should be 49.90 Hz.");
assert.match(core, /bandMaxHz\s*=\s*50\.10/, "Shared upper band default should be 50.10 Hz.");
assert.doesNotMatch(core, /bandMinHz\s*=\s*49\.95/, "Old 49.95 Hz lower band fallback should be gone.");
assert.doesNotMatch(core, /bandMaxHz\s*=\s*50\.05/, "Old 50.05 Hz upper band fallback should be gone.");
assert.match(html, /bandViolationHeatmap/, "Band violation heatmap i18n/rendering hooks should exist.");
assert.match(html, /bandViolationExceedanceHelp/, "Event table technical tooltip text should exist.");
assert.match(html, /function normalizeAnalysisCard\s*\(/, "Analysis cards should be normalized through one shared helper.");
assert.doesNotMatch(
  html,
  /renderReportPreview[\s\S]*?result\.cards\.map\(\(\[label,\s*value\]\)/,
  "Report preview must not destructure analysis cards as tuples only."
);
assert.match(html, /Array\.isArray\(params\.value\)/, "Heatmap tooltip/click handlers should guard params.value before destructuring.");
assert.match(html, /event\.startSecond[\s\S]*event\.endSecond/, "Analysis CSV export should support event startSecond/endSecond fields.");

console.log("Band violation static checks passed.");
