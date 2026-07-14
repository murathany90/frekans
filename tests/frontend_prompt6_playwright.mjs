import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for frontend prompt6 tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-prompt6";
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#autoModeBadge", { state: "attached" });
  await page.waitForFunction(() => Boolean(document.querySelector("#dateSelect")?.value));

  const header = await page.locator(".brand h1").textContent();
  if (header?.trim() !== "GridFreq") {
    throw new Error(`Unexpected header title: ${header}`);
  }

  await page.click('[data-tab="tab-chart"]');
  const dailyHealthVisible = await page.locator('#tab-chart #sourceHealthSummary .source-health-card').count();
  if (dailyHealthVisible !== 0) {
    throw new Error(`Daily tab must not show source health cards above the chart, found ${dailyHealthVisible}.`);
  }

  await page.click('[data-tab="tab-settings"]');
  await page.waitForSelector("#tab-settings #sourceHealthSummary .source-health-card");
  const dataHealth = await page.$$eval("#tab-settings #sourceHealthSummary .source-health-card", cards => cards.map(card => card.textContent || ""));
  if (dataHealth.length < 2 || !dataHealth.some(text => /Türkiye/.test(text)) || !dataHealth.some(text => /ENTSO-E|Almanya/.test(text))) {
    throw new Error(`Data tab source health cards are missing or mislabeled: ${JSON.stringify(dataHealth)}`);
  }

  await page.click('[data-tab="tab-oscillation"]');
  await page.selectOption("#analysisSourceSelect", "tr");
  await page.selectOption("#analysisTypeSelect", "quality");
  const compactInfoInitial = await page.evaluate(() => ({
    panelHidden: document.querySelector("#analysisInfoPanel")?.classList.contains("hidden"),
    compatibilityVisible: getComputedStyle(document.querySelector("#analysisCompatibilityNote")).position !== "absolute",
    samplingVisible: getComputedStyle(document.querySelector("#analysisSamplingInfo")).position !== "absolute"
  }));
  if (!compactInfoInitial.panelHidden || compactInfoInitial.compatibilityVisible || compactInfoInitial.samplingVisible) {
    throw new Error(`Analysis info must be compact by default: ${JSON.stringify(compactInfoInitial)}`);
  }

  await page.click("#analysisInfoToggle");
  await page.waitForSelector("#analysisInfoPanel:not(.hidden)");
  const infoText = await page.locator("#analysisInfoPanel").textContent();
  if (!/Veri kapsama|koherens|rnekleme|Nyquist/i.test(infoText || "")) {
    throw new Error(`Analysis info panel does not contain moved guidance: ${infoText}`);
  }

  await page.click("#langToggle");
  await page.waitForFunction(() => document.querySelector(".brand h1")?.textContent?.trim() === "GridFreq");
  const enLabels = await page.$$eval("#analysisSourceSelect option, #coverageSummary .label", items => items.map(item => item.textContent?.trim() || ""));
  if (!enLabels.some(label => /ENTSO-E \(Germany\)/.test(label)) && !enLabels.some(label => /Latest ENTSO-E data/.test(label))) {
    throw new Error(`English ENTSO-E labels are missing: ${JSON.stringify(enLabels)}`);
  }

  if (consoleErrors.length) {
    throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  }

  await page.screenshot({ path: `${artifactDir}/prompt6.png`, fullPage: false });
  console.log("frontend_prompt6_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/prompt6-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
