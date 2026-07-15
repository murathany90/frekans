import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const readme = readFileSync("README.md", "utf8");
const sources = JSON.parse(readFileSync("data/sources.json", "utf8"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const sourceId of ["teias", "netztransparenz"]) {
  const source = sources.sources?.[sourceId];
  assert(source, `data/sources.json must keep ${sourceId}.`);
  assert(source.provider, `${sourceId} must define provider.`);
  assert(source.systemCode, `${sourceId} must define systemCode.`);
  for (const language of ["tr", "en"]) {
    for (const context of ["short", "standard", "long", "report"]) {
      assert(source.labels?.[language]?.[context], `${sourceId}.${language}.${context} label is required.`);
    }
  }
}

assert(sources.sources.teias.labels.tr.short === "Türkiye", "TEİAŞ Turkish short label must be Türkiye.");
assert(sources.sources.teias.labels.tr.standard === "Türkiye · TEİAŞ", "TEİAŞ Turkish standard label is wrong.");
assert(sources.sources.teias.labels.en.short === "Türkiye", "TEİAŞ English short label must still be Türkiye.");
assert(sources.sources.netztransparenz.labels.tr.short === "Kıta Avrupası", "Netztransparenz Turkish short label must be Kıta Avrupası.");
assert(sources.sources.netztransparenz.labels.tr.standard === "Kıta Avrupası · Netztransparenz", "Netztransparenz Turkish standard label is wrong.");
assert(sources.sources.netztransparenz.labels.en.short === "Continental Europe", "Netztransparenz English short label is wrong.");
assert(sources.sources.netztransparenz.labels.en.report === "Continental Europe (Netztransparenz)", "Netztransparenz English report label is wrong.");

for (const marker of [
  "const AUTO_SOURCE_TO_STATE = { teias: 'tr', netztransparenz: 'de' }",
  "const STATE_TO_AUTO_SOURCE = { tr: 'teias', de: 'netztransparenz' }",
  "function getSourceLabel(sourceId",
  "sourceCatalog",
  "loadSourceCatalog"
]) {
  assert(html.includes(marker), `HTML must keep source-label/catalog marker: ${marker}`);
}

const forbiddenExact = [
  "ENTSO-E (Almanya)",
  "ENTSO-E (Germany)",
  "Türkiye ENTSO-E",
  "Türkiye-ENTSO-E",
  "Türkiye - ENTSO-E",
  "TR→DE",
  "Almanya frekansı",
  "Almanya frekans",
  "Germany frequency",
  "TÃ¼rkiye-ENTSO-E",
  "TÃ¼rkiye - ENTSO-E",
  "TRâ†’DE"
];

for (const phrase of forbiddenExact) {
  assert(!html.includes(phrase), `HTML must not expose legacy source phrase: ${phrase}`);
  assert(!readme.includes(phrase), `README must not expose legacy source phrase: ${phrase}`);
}

for (const pattern of [
  /sourceDeShort:\s*['"]ENTSO-E['"]/,
  /seriesDe:\s*['"]ENTSO-E['"]/,
  /tooltipDe:\s*['"]ENTSO-E['"]/,
  /kpiDeMean:\s*['"]ENTSO-E/,
  /metricMeanDe:\s*['"]ENTSO-E/,
  /coverageDeLatest:\s*['"][^'"]*ENTSO-E/
]) {
  assert(!pattern.test(html), `HTML must not use standalone ENTSO-E as a source label: ${pattern}`);
}

for (const marker of [
  "Türkiye + Kıta Avrupası",
  "Türkiye − Kıta Avrupası",
  "Fark bileşeni",
  "Türkiye–Kıta Avrupası saat farkı",
  "Kıta Avrupası Ortalama",
  "Kıta Avrupası Ort. |Δf|",
  "Kıta Avrupası min",
  "Kıta Avrupası maks",
  "Kıta Avrupası (Netztransparenz)",
  "Continental Europe (Netztransparenz)"
]) {
  assert(html.includes(marker) || readme.includes(marker), `Expected standardized source label marker: ${marker}`);
}

console.log("frontend_source_labels_static ok");
