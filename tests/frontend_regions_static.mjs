import { existsSync, readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const regions = JSON.parse(readFileSync("assets/frequency-regions.json", "utf8"));
const countries = JSON.parse(readFileSync("assets/frequency-countries.json", "utf8"));
const svg = readFileSync("assets/frequency-regions-map.svg", "utf8");

const requiredHtmlMarkers = [
  'data-tab="tab-regions"',
  'id="tab-regions"',
  "Frekans Bölgeleri",
  "Frequency Regions",
  "assets/frequency-regions.mjs",
  "loadRegionsCatalog",
  "renderRegionsView",
  "selectFrequencyRegion",
  "applyRegionsRoute",
  "updateRegionsTimeDeviation",
  "#/regions"
];

for (const marker of requiredHtmlMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Frequency regions HTML marker missing: ${marker}`);
  }
}

for (const path of [
  "assets/frequency-regions.json",
  "assets/frequency-countries.json",
  "assets/frequency-regions-map.svg",
  "assets/frequency-regions.mjs"
]) {
  if (!existsSync(path)) throw new Error(`Frequency regions asset missing: ${path}`);
}

if (regions.defaultRegionId !== "continental-europe" || regions.defaultCountryCode !== "TR") {
  throw new Error("Frequency regions default must be Continental Europe with Türkiye selected.");
}

const ce = regions.regions.find(region => region.id === "continental-europe");
if (!ce?.countries?.includes("TR") || !ce.countries.includes("EE") || !ce.countries.includes("LV") || !ce.countries.includes("LT")) {
  throw new Error("Continental Europe region must include Türkiye and Baltic countries.");
}

if (ce.countryDataSources.TR !== "teias" || ce.dataSourceId !== "netztransparenz") {
  throw new Error("Region source mapping must preserve teias and netztransparenz internal keys.");
}

if (countries.countries.TR.sourceId !== "teias" || countries.countries.EE.regionId !== "continental-europe") {
  throw new Error("Country catalog must preserve internal source keys and Baltic region mapping.");
}

if (!svg.includes('data-map-layout="card-silhouette"') || !svg.includes('class="region-card"')) {
  throw new Error("Frequency regions SVG must use the card silhouette map layout.");
}

for (const regionId of ["continental-europe", "nordic", "great-britain", "ireland"]) {
  if (!svg.includes(`data-region-id="${regionId}"`)) {
    throw new Error(`Frequency regions SVG missing interactive card for ${regionId}.`);
  }
}

for (const countryCode of ["TR", "EE", "LV", "LT"]) {
  if (!svg.includes(`data-country-code="${countryCode}"`)) {
    throw new Error(`Frequency regions SVG missing country marker for ${countryCode}.`);
  }
}

if (!svg.includes('data-country-code="TR"')) {
  throw new Error("Frequency regions SVG must expose interactive region and country markers.");
}

if (svg.includes("map-pulse")) {
  throw new Error("Frequency regions SVG must not keep the old abstract pulse/blob map.");
}

const controlLayerNamesTr = ce.controlLayers.map(layer => layer.labels?.tr?.name);
const controlLayerNamesEn = ce.controlLayers.map(layer => layer.labels?.en?.name);
if (controlLayerNamesTr.join("|") !== "PFK|SFK|Tersiyer") {
  throw new Error(`Turkish control layers must be PFK, SFK, Tersiyer: ${controlLayerNamesTr.join(", ")}`);
}
if (controlLayerNamesEn.join("|") !== "FCR|aFRR|mFRR") {
  throw new Error(`English control layers must remain FCR, aFRR, mFRR: ${controlLayerNamesEn.join(", ")}`);
}
const controlLayerDescriptionsTr = ce.controlLayers.map(layer => layer.labels?.tr?.description || "").join("\n");
for (const term of ["Primer Frekans Kontrol", "Sekonder Frekans Kontrol", "Tersiyer Frekans Kontrol"]) {
  if (!controlLayerDescriptionsTr.includes(term)) {
    throw new Error(`Turkish control layer descriptions must include ${term}.`);
  }
}
if (html.includes("FCR, aFRR ve mFRR")) {
  throw new Error("Turkish regions UI copy must not keep FCR, aFRR ve mFRR.");
}
if (!html.includes("PFK, SFK ve Tersiyer")) {
  throw new Error("Turkish regions UI copy must mention PFK, SFK ve Tersiyer.");
}

if (/gridradar|mapbox|leaflet|google maps/i.test(`${html}\n${svg}`)) {
  throw new Error("Frequency regions must not depend on GridRadar, Mapbox, Leaflet, or Google Maps.");
}

console.log("frontend_regions_static ok");
