import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

const requiredMarkers = [
  'id="dataSourcesInfoBtn"',
  'aria-label="Veri kaynakları hakkında bilgi"',
  'title="Veri kaynakları hakkında bilgi"',
  'id="dataSourcesModal"',
  'role="dialog"',
  'aria-modal="true"',
  'aria-labelledby="dataSourcesModalTitle"',
  'id="dataSourcesModalStatus"',
  'id="dataSourcesStatusGrid"',
  'id="dataSourcesTrCard"',
  'id="dataSourcesEuCard"',
  'id="dataSourcesCloseBtn"',
  'id="dataSourcesFooterCloseBtn"',
  'openDataSourcesModal',
  'closeDataSourcesModal',
  'renderDataSourceStatus',
  'loadDataSourceStatus',
  'updateDataSourceModalLanguage',
  'trapModalFocus',
  'Kıta Avrupası · Netztransparenz',
  'Doğrudan ENTSO-E Transparency API’sinden alınmamaktadır',
  '50Hertz Transmission',
  'Amprion',
  'TenneT TSO',
  'TransnetBW',
  'GridFreq bağımsız bir analiz uygulamasıdır'
];

for (const marker of requiredMarkers) {
  if (!html.includes(marker)) {
    throw new Error(`Missing data sources modal marker: ${marker}`);
  }
}

const resetIndex = html.indexOf('id="resetZoomBtn"');
const infoIndex = html.indexOf('id="dataSourcesInfoBtn"');
if (resetIndex < 0 || infoIndex < 0 || infoIndex < resetIndex) {
  throw new Error("Data sources info button must appear after reset zoom button.");
}

const modalHtml = html.slice(html.indexOf('id="dataSourcesModal"'), html.indexOf("<!-- SEKME 2:"));
if (!/target="_blank"\s+rel="noopener noreferrer"/.test(modalHtml)) {
  throw new Error("Official source links in the modal must use rel=\"noopener noreferrer\".");
}
if (/github\.com\/murathany90\/frekans|dataSourcesGithubLink|GridFreq GitHub/.test(modalHtml)) {
  throw new Error("The data sources modal must not list the GridFreq GitHub repository as an official source link.");
}

for (const key of [
  "dataSourcesInfoBtn",
  "dataSourcesTitle",
  "dataSourcesIntro",
  "dataSourcesStatusUnavailable",
  "dataSourcesClose",
  "dataSourcesCurrentStatusTitle",
  "dataSourcesTrTitle",
  "dataSourcesEuTitle",
  "dataSourcesOfficialLinksTitle"
]) {
  if (!html.includes(`${key}:`)) {
    throw new Error(`Missing i18n key: ${key}`);
  }
}

if (!/document\.body\.classList\.add\('modal-open'\)/.test(html)) {
  throw new Error("Modal opening must lock background scrolling.");
}

if (!/document\.addEventListener\('keydown', handleDataSourcesModalKeydown\)/.test(html)) {
  throw new Error("Modal must install a single keydown handler for Escape/focus trap.");
}

console.log("frontend_data_sources_modal_static ok");
