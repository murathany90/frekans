import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

function mustContain(text, label = text) {
  if (!html.includes(text)) throw new Error(`Missing prompt4 frontend marker: ${label}`);
}

mustContain("loadedManifestYears");
mustContain("manifestShardPromises");
mustContain("ensureManifestYearLoaded");
mustContain("mergeManifestShard");
mustContain("MAX_ANALYSIS_DAY_CONCURRENCY");
mustContain("mapWithConcurrency");
mustContain("manifest/2025.json");

if (/Promise\.all\s*\(\s*shardPaths\.map/.test(html)) {
  throw new Error("Initial manifest loading must not fetch every yearly shard with Promise.all.");
}

if (!/MAX_ANALYSIS_DAY_CONCURRENCY\s*=\s*[34]\b/.test(html)) {
  throw new Error("Long-range analysis must declare a 3-4 day concurrency limit.");
}

if (!/ensureManifestYearLoaded\s*\([^)]*dateToYear/.test(html) && !/ensureManifestYearLoaded\s*\([^)]*selected/.test(html)) {
  throw new Error("Manifest shard loading should be driven by the selected/requested date.");
}

console.log("frontend_prompt4_static ok");
