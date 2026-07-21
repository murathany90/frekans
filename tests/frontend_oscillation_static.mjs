import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../frekans_rapor_v1.html", import.meta.url), "utf8");

for (const marker of [
  "DEFAULT_OSCILLATION_PARAMETERS",
  "computeOscillationCandidates",
  "oscillationParameterMetadata",
  "oscThresholdMode",
  "thresholdMode",
  "oscillationConfidenceHelp",
  "oscillationDampingWarning",
  "oscillationCandidateTypeRingdown",
  "oscillationCandidateTypeSustainedForced",
  "oscillationDampingPanelTitle"
]) {
  assert(html.includes(marker), `Missing oscillation UI marker: ${marker}`);
}

assert.match(html, /Salınım Adayı Tespiti/, "Turkish analysis label must be updated");
assert.match(html, /Oscillation Candidate Detection/, "English analysis label must be updated");
assert.doesNotMatch(html, />\s*Osilasyon adayı\s*</, "Old Turkish analysis label should not remain as visible text");
assert.doesNotMatch(html, />\s*Oscillation candidate\s*</, "Old English analysis label should not remain as visible text");
assert.match(html, /Filtrelenmiş genlik olay eşiği \(mHz\)/, "Threshold label should explain filtered amplitude");
assert.match(html, /Filtered amplitude event threshold \(mHz\)/, "English threshold label should explain filtered amplitude");
assert.match(html, /MAD tabanlı adaptif eşik/, "Turkish adaptive threshold mode must be visible");
assert.match(html, /MAD-based adaptive threshold/, "English adaptive threshold mode must be visible");
assert.match(html, /FIR filtre derecesi|FIR katsayı sayısı/, "FIR label must use order or tap-count wording");
assert.doesNotMatch(html, /FIR kademe/, "Old FIR wording must be removed");
assert.match(html, /Heuristik aday güven skoru/, "Turkish confidence label must not imply probability");
assert.match(html, /Heuristic candidate confidence/, "English confidence label must not imply probability");
assert.match(html, /kalibre edilmiş istatistiksel olasılık değildir/, "Confidence tooltip must explain non-probability semantics");
assert.match(html, /not a calibrated statistical probability/, "English confidence tooltip must explain non-probability semantics");
assert.match(html, /Damping oranı yalnız uygun ringdown olaylarında tahmin edilir/, "Damping warning must be present in Turkish");
assert.match(html, /Damping ratio is estimated only for suitable ringdown events/, "Damping warning must be present in English");

assert.doesNotMatch(html, /Türkiye ort\./, "Fixed Türkiye mean column label must not remain");
assert.doesNotMatch(html, /Türkiye min–maks/, "Fixed Türkiye min-max column label must not remain");

for (const raw of ["ringdown", "sustained_forced", "frequency_drifting", "indeterminate"]) {
  const visibleOptionPattern = new RegExp(`>\\s*${raw}\\s*<`);
  assert.doesNotMatch(html, visibleOptionPattern, `Raw enum ${raw} should not be visible user text`);
}

console.log("frontend_oscillation_static ok");
