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
  "meta.json",
  "Canlı Frekans",
  "GridRadar",
  "frequency-ucte-median-1s",
  "1 saniye kaynak çözünürlüğü",
  "yaklaşık 15 dakika gecikme",
  "son 24 saatlik görünüm",
  "Cloudflare Worker + SQLite Durable Object",
  "24 saatlik döner veri tamponu",
  "60 saniyelik frontend yenileme",
  "Tarihsel/Günlük Kıta Avrupası verisi Netztransparenz",
  "canlı/gecikmeli Kıta Avrupası verisi GridRadar",
  "Veriler yalnızca kişisel, ticari olmayan ve fonlanmamış akademik araştırma amaçlarıyla",
  "Ticari veya profesyonel kullanım için GridRadar"
];

for (const detail of requiredDetails) {
  if (!readme.includes(detail)) {
    throw new Error(`README missing required implementation detail: ${detail}`);
  }
}

console.log("readme_documentation_static ok");
