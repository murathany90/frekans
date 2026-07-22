import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for analysis simplification tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-analysis-simplification";
mkdirSync(artifactDir, { recursive: true });

const analyses = [
  "quality",
  "stats",
  "events",
  "rocof",
  "psd",
  "spectrogram",
  "oscillation",
  "crossCorrelation",
  "coherence",
  "trend"
];

const forbidden = [
  "filterTaps",
  "windowSec",
  "stepSec",
  "minValidRatio",
  "thresholdHzPerSecond",
  "computeMagnitudeSquaredCoherence",
  "computeCrossPowerSpectralDensity",
  "Teknik ayrıntı: motor parametresi",
  "Technical detail: engine parameter"
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
const consoleErrors = [];
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

async function setLanguage(language) {
  const current = await page.evaluate(() => document.documentElement.dataset.currentLang || "tr");
  if (current !== language) {
    await page.click("#langToggle");
    await page.waitForFunction(expected => document.documentElement.dataset.currentLang === expected, language);
  }
}

async function openAnalysis(type) {
  await page.click('[data-tab="tab-oscillation"]');
  const paired = ["crossCorrelation", "coherence"].includes(type);
  const source = paired ? "both" : "tr";
  const selectSource = async () => {
    const current = await page.evaluate(() => document.querySelector("#analysisSourceSelect")?.value || "");
    if (current !== source) {
      await page.selectOption("#analysisSourceSelect", source);
      await page.dispatchEvent("#analysisSourceSelect", "change");
      await page.waitForFunction(expected => document.querySelector("#analysisSourceSelect")?.value === expected, source);
    }
  };
  if (paired) await selectSource();
  await page.selectOption("#analysisTypeSelect", type);
  await page.dispatchEvent("#analysisTypeSelect", "change");
  await page.waitForFunction(selected => document.querySelector("#analysisTypeSelect")?.value === selected, type);
  if (!paired) await selectSource();
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#analysisTypeSelect", { state: "attached" });
  await page.waitForSelector("#autoModeBadge", { state: "attached" });
  await page.waitForFunction(() => Boolean(document.querySelector("#dateSelect")?.value));
  const initialDefault = await page.evaluate(() => ({
    selected: document.querySelector("#analysisTypeSelect")?.value || "",
    title: document.querySelector("#oscChartTitle")?.textContent || "",
    chartText: document.querySelector("#analysisMainChart")?.textContent || ""
  }));
  if (initialDefault.selected === "stats" && /Osilasyon|Oscillation|Bant Geçiren|Bandpass/i.test(`${initialDefault.title} ${initialDefault.chartText}`)) {
    throw new Error(`Default analysis empty state leaked another module: ${JSON.stringify(initialDefault)}`);
  }

  for (const language of ["tr", "en"]) {
    await setLanguage(language);
    for (const type of analyses) {
      await openAnalysis(type);
      const initial = await page.evaluate(() => ({
        cards: document.querySelectorAll("#analysisResultCards .analysis-result-card").length,
        tableHidden: Boolean(document.querySelector("#analysisTableTitle")?.closest(".panel")?.hidden),
        expertOpen: Boolean(document.querySelector(".analysis-advanced-panel")?.open),
        detailsOpen: Boolean(document.querySelector("#analysisDetailSummary")?.open),
        chartTop: document.querySelector("#analysisMainChart")?.getBoundingClientRect().top ?? 0,
        tableTop: document.querySelector("#analysisTableTitle")?.closest(".panel")?.getBoundingClientRect().top ?? 0
      }));
      if (initial.cards !== 0 || !initial.tableHidden || initial.expertOpen || initial.detailsOpen) {
        throw new Error(`${language}/${type} initial state is not simplified: ${JSON.stringify(initial)}`);
      }
      if (!initial.tableHidden && !(initial.chartTop < initial.tableTop)) {
        throw new Error(`${language}/${type} chart should appear before result tables.`);
      }

      await page.click("#analysisInfoToggle");
      await page.waitForSelector("#analysisInfoPanel:not(.hidden)");
      const help = await page.locator("#analysisInfoPanel").textContent();
      for (const term of forbidden) {
        if ((help || "").includes(term)) {
          throw new Error(`${language}/${type} help exposes forbidden term: ${term}`);
        }
      }
      const sectionCount = await page.locator("#analysisHelpBody [data-help-section]").count();
      if (sectionCount !== 4) {
        throw new Error(`${language}/${type} help should render 4 simplified sections, got ${sectionCount}.`);
      }
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#analysisInfoPanel")?.classList.contains("hidden"));
    }
  }

  await page.setViewportSize({ width: 390, height: 820 });
  await setLanguage("tr");
  await openAnalysis("spectrogram");
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    expertOpen: Boolean(document.querySelector(".analysis-advanced-panel")?.open),
    tableHidden: Boolean(document.querySelector("#analysisTableTitle")?.closest(".panel")?.hidden)
  }));
  if (mobile.overflow || mobile.expertOpen || !mobile.tableHidden) {
    throw new Error(`Mobile simplified initial state failed: ${JSON.stringify(mobile)}`);
  }

  if (consoleErrors.length) {
    throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  }

  await page.screenshot({ path: `${artifactDir}/analysis-simplification.png`, fullPage: false });
  console.log("frontend_analysis_simplification_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/analysis-simplification-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
