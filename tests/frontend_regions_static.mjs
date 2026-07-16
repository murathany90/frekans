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

if (!svg.includes('data-region-id="continental-europe"') || !svg.includes('data-country-code="TR"')) {
  throw new Error("Frequency regions SVG must expose interactive region and country markers.");
}

if (/gridradar|mapbox|leaflet|google maps/i.test(`${html}\n${svg}`)) {
  throw new Error("Frequency regions must not depend on GridRadar, Mapbox, Leaflet, or Google Maps.");
}

console.log("frontend_regions_static ok");
