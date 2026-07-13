import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

const requiredIds = [
  "analysisDateSelect",
  "analysisStartDate",
  "analysisEndDate",
  "analysisSourceSelect",
  "analysisTypeSelect",
  "analysisRunBtn",
  "analysisCancelBtn",
  "analysisStatus",
  "analysisResultCards",
  "analysisMainChart",
  "analysisEventsBody",
  "reportLanguageSelect",
  "reportPreview",
  "reportExportJsonBtn",
  "coverageSummary"
];

for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`Missing prompt2 frontend id: ${id}`);
  }
}

const requiredText = [
  "const translations",
  "chartResolutionConfig",
  "rawSeries",
  "displaySeries",
  "analysisSeries",
  "Loading second-level data",
  "Saniyelik veri yükleniyor",
  "Görünen veri",
  "Raw second-level data",
  "Grafiği PNG olarak indir",
  "Download chart as PNG"
];

for (const text of requiredText) {
  if (!html.includes(text)) {
    throw new Error(`Missing prompt2 frontend behavior marker: ${text}`);
  }
}

if (html.includes("Önce Günlük Frekans sekmesinde rapor hesaplayın.")) {
  throw new Error("Analysis tab still depends on the Daily Frequency tab.");
}

if (/font-size:\s*\.43rem/.test(html)) {
  throw new Error("Mobile hourly matrix still uses unreadable .43rem text.");
}

if (!/aria-label="Grafiği PNG olarak indir"/.test(html) || !/min-width:\s*40px/.test(html)) {
  throw new Error("Chart download buttons need visible accessible 40px controls.");
}

console.log("frontend_prompt2_static ok");
