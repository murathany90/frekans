import { existsSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const html = readFileSync("frekans_rapor_v1.html", "utf8");
const readme = readFileSync("README.md", "utf8");
const buildSite = readFileSync("scripts/build_site.py", "utf8");
const deployWorkflow = readFileSync(".github/workflows/deploy_pages.yml", "utf8");
const frontendWorkflow = readFileSync(".github/workflows/frontend_tests.yml", "utf8");

if (!existsSync("LICENSE")) throw new Error("Repository root must contain LICENSE.");
const license = readFileSync("LICENSE", "utf8");
for (const marker of [
  "MIT License",
  "Copyright (c) 2026 Murathan YENICELI",
  "Permission is hereby granted, free of charge",
  "THE SOFTWARE IS PROVIDED \"AS IS\""
]) {
  if (!license.includes(marker)) throw new Error(`LICENSE missing MIT marker: ${marker}`);
}

for (const marker of [
  "# GridFreq",
  "Türkiye ve Kıta Avrupası Şebeke Frekansı Analiz Platformu",
  "Ana canlı uygulama: https://gridfreq.com/",
  "## Lisans",
  "MIT lisansı",
  "veri kaynaklarının kullanım haklarını kapsamaz",
  "Kıta Avrupası – Netztransparenz"
]) {
  if (!readme.includes(marker)) throw new Error(`README missing public-sharing marker: ${marker}`);
}

if (/ENTSO-E \(Almanya\)|ENTSO-E Almanya/.test(readme)) {
  throw new Error("README should use Kıta Avrupası – Netztransparenz instead of ENTSO-E (Almanya).");
}

for (const marker of [
  '<meta name="description" content="GridFreq, Türkiye ve Kıta Avrupası şebeke frekansı verilerini karşılaştıran bağımsız frekans kalite ve analiz platformudur." />',
  '<link rel="canonical" href="https://gridfreq.com/">',
  '<meta property="og:title" content="GridFreq | Türkiye ve Kıta Avrupası Şebeke Frekansı Analiz Platformu">',
  '<meta property="og:description" content="Türkiye ve Kıta Avrupası şebeke frekansı verilerini karşılaştırın; veri kalitesi, frekans davranışı ve analiz raporlarını GridFreq ile inceleyin.">',
  '<meta property="og:image" content="https://gridfreq.com/assets/brand/gridfreq-social-card.png">',
  '<meta name="twitter:title" content="GridFreq | Türkiye ve Kıta Avrupası Şebeke Frekansı Analiz Platformu">',
  '<meta name="twitter:description" content="Türkiye ve Kıta Avrupası şebeke frekansı verilerini karşılaştırın; veri kalitesi, frekans davranışı ve analiz raporlarını GridFreq ile inceleyin.">',
  '<title>GridFreq – Türkiye ve Kıta Avrupası Şebeke Frekansı Analiz Platformu</title>',
  'id="aboutLegalSection"',
  'data-i18n="aboutLegalTitle"',
  'data-i18n="aboutLegalContact"',
  'data-i18n="aboutLegalDisclaimer"',
  'data-i18n="aboutLegalVersion"'
]) {
  if (!html.includes(marker)) throw new Error(`HTML missing public-sharing marker: ${marker}`);
}

if (!html.includes("Kıta Avrupası – Netztransparenz") || /ENTSO-E \(Almanya\)|ENTSO-E Almanya/.test(html)) {
  throw new Error("HTML source labels should use Kıta Avrupası – Netztransparenz instead of ENTSO-E (Almanya).");
}

const aboutSection = html.slice(html.indexOf('id="aboutLegalSection"'), html.indexOf("</section>", html.indexOf('id="aboutLegalSection"')));
for (const marker of [
  'href="mailto:murathan.yeniceli@gmail.com"',
  'murathan.yeniceli@gmail.com',
  'href="https://www.linkedin.com/in/murathan-yeniceli-906044192"',
  'LinkedIn'
]) {
  if (!aboutSection.includes(marker)) throw new Error(`About contact card missing marker: ${marker}`);
}
if (/GridFreq Issues|github\.com\/murathany90\/frekans\/issues|GitHub Issues/.test(aboutSection)) {
  throw new Error("About contact card must use email and LinkedIn instead of GitHub Issues.");
}

if (!buildSite.includes("LICENSE")) throw new Error("build_site.py must copy LICENSE into dist.");
for (const marker of ['- "LICENSE"', "node tests/frontend_public_sharing_static.mjs"]) {
  if (!deployWorkflow.includes(marker) && !frontendWorkflow.includes(marker)) {
    throw new Error(`Workflows must include public-sharing marker: ${marker}`);
  }
}

rmSync("dist", { recursive: true, force: true });
execFileSync("python", ["scripts/build_site.py"], { stdio: "pipe" });
if (!existsSync("dist/LICENSE")) throw new Error("dist/LICENSE must be published with the site.");
const distIndex = readFileSync("dist/index.html", "utf8");
if (!distIndex.includes('og:title" content="GridFreq | Türkiye ve Kıta Avrupası')) {
  throw new Error("dist/index.html must contain the updated LinkedIn/Open Graph title.");
}
if (!distIndex.includes('id="aboutLegalSection"')) {
  throw new Error("dist/index.html must contain the About / Legal section.");
}

console.log("frontend_public_sharing_static ok");
