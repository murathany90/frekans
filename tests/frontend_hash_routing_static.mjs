import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

const requiredMarkers = [
  "const ROUTE_TAB_TO_PATH",
  "parseHashRoute",
  "applyRoute",
  "updateRoute",
  "normalizeRouteQueryParams",
  "routeSourceAlias",
  "routeResolutionAlias",
  "isApplyingRoute",
  "hashchange",
  "#/daily",
  "#/analysis",
  "#/reports",
  "#/data"
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Hash routing marker missing: ${marker}`);
  }
}

if (!/window\.addEventListener\(['"]hashchange['"],\s*\(\)\s*=>\s*applyRoute\(parseHashRoute\(\)\)\)/.test(html)) {
  throw new Error("hashchange must re-apply the parsed route.");
}

if (!/history\.pushState\([^)]*window\.location\.hash/.test(html) && !/window\.location\.hash\s*=/.test(html)) {
  throw new Error("Route updates must update the hash for browser history.");
}

if (/react-router|@reach\/router|vue-router|navigo|page\.js|universal-router/i.test(html)) {
  throw new Error("Hash routing must stay framework-free.");
}

if (/chartZoomRange|chartLegendSelection/.test(html.match(/function updateRoute[\s\S]*?function /)?.[0] || "")) {
  throw new Error("updateRoute must not serialize chart zoom or legend session state.");
}

console.log("frontend_hash_routing_static ok");
