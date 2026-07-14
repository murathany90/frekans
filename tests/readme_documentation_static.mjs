import { readFileSync } from "node:fs";

const readme = readFileSync("README.md", "utf8");

const requiredSections = [
  "## Uygulama Sekmeleri ve Kullanım Akışı",
  "## Grafik Yapısı",
  "## Analiz Laboratuvarı",
  "## Otomatik İndirme Süreçleri",
  "### TEİAŞ otomatik güncelleme",
  "### Netztransparenz otomatik güncelleme",
  "## Veri Şeması ve Optimize Dosya Yapısı",
  "## GitHub Actions ve Yayın Akışı"
];

for (const section of requiredSections) {
  if (!readme.includes(section)) {
    throw new Error(`README missing required section: ${section}`);
  }
}

const requiredDetails = [
  "Ana canlı uygulama: https://gridfreq.com/",
  "GitHub Pages custom domain: `gridfreq.com`",
  "www.gridfreq.com",
  "Settings > Pages > Custom domain",
  "Enforce HTTPS",
  "TürkTicaret",
  "DNS doğrulama tokenları",
  "https://murathany90.github.io/frekans/",
  "assets/brand/",
  "site.webmanifest",
  "GridFreq SVG logo",
  "scripts/fetch_teias.py",
  "scripts/fetch_netztransparenz.py",
  "scripts/netztransparenz_client.py",
  "official_zip",
  "OAuth token check",
  "Welch PSD",
  "Spektrogram",
  "RoCoF",
  "Çapraz korelasyon",
  "Koherens ve faz",
  "Osilasyon adayı",
  "manifest-summary.json",
  ".frequency.i16",
  "minute.json",
  "hourly.json",
  "meta.json"
];

for (const detail of requiredDetails) {
  if (!readme.includes(detail)) {
    throw new Error(`README missing required implementation detail: ${detail}`);
  }
}

console.log("readme_documentation_static ok");
