import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for frontend prompt5 tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-prompt5";
mkdirSync(artifactDir, { recursive: true });

const analyses = [
  ["quality", /Veri Kapsama ve Kalite Özeti/, /Data Coverage and Quality Summary/],
  ["stats", /Temel Frekans İstatistikleri/, /Basic Frequency Statistics/],
  ["events", /Bant İhlali Özeti/, /Band Violation Summary/],
  ["rocof", /RoCoF Analiz Sonuçları/, /RoCoF Analysis Results/],
  ["psd", /Welch Güç Spektral Yoğunluğu/, /Welch Power Spectral Density/],
  ["spectrogram", /Spektrogram — Zaman-Frekans Analizi/, /Spectrogram — Time-Frequency Analysis/],
  ["oscillation", /Salınım Adayı Tespiti/, /Oscillation Candidate Detection/],
  ["crossCorrelation", /Çapraz Korelasyon Özeti/, /Cross-Correlation Summary/],
  ["coherence", /Koherens ve Faz Özeti/, /Coherence and Phase Summary/],
  ["trend", /Günlük Frekans ve Trend Analizi/, /Daily Frequency and Trend Analysis/]
];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

async function closeHelpWithEscape() {
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#analysisInfoPanel")?.classList.contains("hidden"));
}

async function openHelpFor(value) {
  const source = value === "crossCorrelation" || value === "coherence" ? "both" : "tr";
  await page.evaluate(nextSource => {
    const select = document.querySelector("#analysisSourceSelect");
    if (!select) return;
    select.value = nextSource;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, source);
  const currentType = await page.$eval("#analysisTypeSelect", select => select.value);
  if (currentType !== value) {
    await page.selectOption("#analysisTypeSelect", value);
  }
  await page.click("#analysisInfoToggle");
  await page.waitForSelector("#analysisInfoPanel:not(.hidden)");
}

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#autoModeBadge", { state: "attached" });
  await page.click('[data-tab="tab-oscillation"]');

  for (const [value, trTitle] of analyses) {
    await openHelpFor(value);
    const state = await page.evaluate(() => ({
      role: document.querySelector("#analysisInfoPanel")?.getAttribute("role"),
      modal: document.querySelector("#analysisInfoPanel")?.getAttribute("aria-modal"),
      title: document.querySelector("#analysisHelpTitle")?.textContent || "",
      openSections: [...document.querySelectorAll("[data-help-section-toggle]")].filter(button => button.getAttribute("aria-expanded") === "true").length,
      glossaryItems: document.querySelectorAll("[data-help-glossary-item]").length,
      parameterCards: document.querySelectorAll("[data-help-parameter-card]").length,
      otherLongPage: document.querySelector("#analysisHelpBody")?.textContent?.match(/Veri Kapsama ve Kalite Özeti|Temel Frekans İstatistikleri|Bant İhlali Özeti|Welch Güç Spektral Yoğunluğu/g)?.length || 0
    }));
    assert.equal(state.role, "dialog", `Help shell must be a dialog for ${value}`);
    assert.equal(state.modal, "true", `Help dialog must be modal for ${value}`);
    assert.match(state.title, trTitle, `Wrong Turkish help title for ${value}`);
    assert(state.openSections >= 4, `Default help sections should be open for ${value}: ${JSON.stringify(state)}`);
    assert(state.glossaryItems >= 3, `Glossary is missing for ${value}: ${JSON.stringify(state)}`);
    assert(state.parameterCards >= 1, `Parameter guidance is missing for ${value}: ${JSON.stringify(state)}`);
    assert(state.otherLongPage <= 1, `Help content must be scoped to active analysis: ${JSON.stringify(state)}`);
    await closeHelpWithEscape();
    const focusId = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(focusId, "analysisInfoToggle", `Focus should return to help button after Escape for ${value}`);
  }

  await openHelpFor("psd");
  const accordionState = await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-help-section-toggle]")].find(item => item.getAttribute("aria-expanded") === "false");
    button?.click();
    return button?.getAttribute("aria-expanded") || "";
  });
  assert.equal(accordionState, "true", "Accordion section did not open");

  await page.evaluate(() => {
    const section = document.querySelector('[data-help-section="Glossary"]');
    const button = section?.querySelector("[data-help-section-toggle]");
    if (button?.getAttribute("aria-expanded") === "false") button.click();
  });
  await page.fill("#analysisHelpGlossarySearch", "FFT");
  const glossaryFilter = await page.evaluate(() => ({
    visible: [...document.querySelectorAll("[data-help-glossary-item]")].filter(item => !item.hidden).map(item => item.textContent || ""),
    hidden: [...document.querySelectorAll("[data-help-glossary-item]")].filter(item => item.hidden).length
  }));
  assert(glossaryFilter.visible.some(text => /FFT/.test(text)), `Glossary search should keep FFT visible: ${JSON.stringify(glossaryFilter)}`);
  assert(glossaryFilter.hidden > 0, `Glossary search should hide unrelated terms: ${JSON.stringify(glossaryFilter)}`);

  await page.click("#analysisHelpLangToggle");
  await page.waitForFunction(() => /Welch Power Spectral Density/.test(document.querySelector("#analysisHelpTitle")?.textContent || ""));
  const englishModal = await page.evaluate(() => ({
    title: document.querySelector("#analysisHelpTitle")?.textContent || "",
    text: document.querySelector("#analysisInfoPanel")?.innerText || ""
  }));
  assert.match(englishModal.title, analyses.find(([value]) => value === "psd")[2], "Open help modal did not update to English");
  for (const leak of ["Gelişmiş filtreler", "Yapay Zekâ", "Sık yapılan", "Teknik ayrıntı"]) {
    assert(!englishModal.text.includes(leak), `English help modal contains Turkish fallback: ${leak}`);
  }
  await closeHelpWithEscape();

  await page.click("#langToggle");
  await page.waitForFunction(() => document.documentElement.getAttribute("data-current-lang") === "tr");
  await page.selectOption("#analysisTypeSelect", "spectrogram");
  await page.fill("#spectralQuickSegmentSeconds", "300");
  await page.dispatchEvent("#spectralQuickSegmentSeconds", "change");
  await openHelpFor("spectrogram");
  const dynamicParams = await page.locator("#analysisHelpDynamic").textContent();
  assert.match(dynamicParams || "", /300/, "Help modal should reflect active segment value");
  assert.match(dynamicParams || "", /1 saniyelik kaynak veri/, "Help modal should explain display summaries do not recalculate spectral data");
  await closeHelpWithEscape();

  await page.selectOption("#analysisTypeSelect", "stats");
  await page.click("#analysisRunBtn");
  await page.waitForFunction(() => document.querySelectorAll("#analysisResultCards .analysis-result-card").length >= 2);
  await page.click("#analysisInfoToggle");
  const accordingToResult = await page.locator("#analysisHelpAccordingToResult").textContent();
  assert.match(accordingToResult || "", /Bu sonuca göre|Ortalama|örnek/i, "Help modal should show deterministic result guidance after an analysis exists");
  await closeHelpWithEscape();

  await page.setViewportSize({ width: 390, height: 760 });
  await openHelpFor("rocof");
  const mobileLayout = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
    closeMinHeight: getComputedStyle(document.querySelector("#analysisHelpCloseBtn")).minHeight,
    headerTop: getComputedStyle(document.querySelector(".analysis-help-header")).position
  }));
  if (mobileLayout.doc > mobileLayout.viewport + 2 || mobileLayout.body > mobileLayout.viewport + 2) {
    throw new Error(`Mobile help modal overflows horizontally: ${JSON.stringify(mobileLayout)}`);
  }
  assert.equal(mobileLayout.closeMinHeight, "44px", "Close button should keep a 44px touch target");
  assert.equal(mobileLayout.headerTop, "sticky", "Mobile help header should remain sticky");

  if (consoleErrors.length) {
    throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  }

  await page.screenshot({ path: `${artifactDir}/prompt5-help.png`, fullPage: false });
  console.log("frontend_prompt5_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/prompt5-help-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
