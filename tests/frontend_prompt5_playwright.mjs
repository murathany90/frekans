import { mkdirSync } from "node:fs";

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
  await page.click('[data-tab="tab-chart"]');
  await page.click("#calculateBtn");
  await page.waitForSelector("#frequencyChart canvas");

  const cards = await page.$$eval("#coverageSummary .coverage-item", items => items.map(item => ({
    label: item.querySelector(".label")?.textContent?.trim() || "",
    value: item.querySelector(".value")?.textContent?.trim() || ""
  })));
  const labels = cards.map(card => card.label);
  if (labels.slice(0, 5).join("|") !== "Görünüm|Rapor tarihi|Son Türkiye verisi|Son ENTSO-E verisi|Son ortak gün") {
    throw new Error(`Unexpected daily coverage card order: ${JSON.stringify(cards)}`);
  }
  if (!/24 saat|24h/i.test(cards[0].value) || !/\d{2}\.\d{2}\.\d{4}/.test(cards[1].value)) {
    throw new Error(`Daily view/date cards were not populated: ${JSON.stringify(cards.slice(0, 2))}`);
  }

  await page.click(".hour-header");
  await page.waitForFunction(() => {
    const first = document.querySelector("#coverageSummary .coverage-item .value")?.textContent || "";
    return /3\.600 saniye|3,600 seconds/.test(first);
  });
  await page.dblclick(".hour-header");
  await page.waitForFunction(() => {
    const first = document.querySelector("#coverageSummary .coverage-item .value")?.textContent || "";
    return /24 saat|24h/i.test(first);
  });

  await page.click('[data-tab="tab-oscillation"]');
  await page.selectOption("#analysisSourceSelect", "tr");
  const trCompatibility = await page.evaluate(() => ({
    crossDisabled: document.querySelector('#analysisTypeSelect option[value="crossCorrelation"]')?.disabled,
    coherenceDisabled: document.querySelector('#analysisTypeSelect option[value="coherence"]')?.disabled,
    note: document.querySelector("#analysisCompatibilityNote")?.textContent || ""
  }));
  if (!trCompatibility.crossDisabled || !trCompatibility.coherenceDisabled || !/iki|two|kaynak|source/i.test(trCompatibility.note)) {
    throw new Error(`Single-source compatibility note/disabled state is wrong: ${JSON.stringify(trCompatibility)}`);
  }

  await page.selectOption("#analysisSourceSelect", "both");
  const bothCompatibility = await page.evaluate(() => ({
    crossDisabled: document.querySelector('#analysisTypeSelect option[value="crossCorrelation"]')?.disabled,
    coherenceDisabled: document.querySelector('#analysisTypeSelect option[value="coherence"]')?.disabled
  }));
  if (bothCompatibility.crossDisabled || bothCompatibility.coherenceDisabled) {
    throw new Error(`Joint-source analyses should be enabled for both: ${JSON.stringify(bothCompatibility)}`);
  }

  await page.selectOption("#analysisTypeSelect", "oscillation");
  await page.locator("details.analysis-advanced-panel").evaluate(node => { node.open = true; });
  await page.selectOption("#analysisResolution", "1m");
  await page.click("#analysisRunBtn");
  await page.waitForFunction(() => /Nyquist|çözünürlük|resolution/i.test(document.querySelector("#analysisStatus")?.textContent || ""));

  await page.selectOption("#analysisResolution", "1s");
  await page.selectOption("#analysisTypeSelect", "stats");
  await page.click("#analysisRunBtn");
  await page.waitForFunction(() => document.querySelectorAll("#analysisResultCards .analysis-result-card").length >= 2);
  const dynamicTable = await page.evaluate(() => ({
    title: document.querySelector("#analysisTableTitle")?.textContent || "",
    headers: [...document.querySelectorAll("#analysisEventsHead th")].map(th => th.textContent.trim()).join("|"),
    sampling: document.querySelector("#analysisSamplingInfo")?.textContent || ""
  }));
  if (/Osilasyon/.test(dynamicTable.title) || /Baskın frekans|Dominant frequency/.test(dynamicTable.headers)) {
    throw new Error(`Stats analysis should not render oscillation table semantics: ${JSON.stringify(dynamicTable)}`);
  }
  if (!/Nyquist|örnekleme|sample/i.test(dynamicTable.sampling)) {
    throw new Error(`Sampling metadata is missing: ${JSON.stringify(dynamicTable)}`);
  }

  await page.click('[data-tab="tab-reports"]');
  await page.waitForSelector("#reportPreview");
  const printState = await page.evaluate(async () => {
    const originalPrint = window.print;
    let called = 0;
    window.print = () => {
      called += 1;
      window.dispatchEvent(new Event("afterprint"));
    };
    document.querySelector("#reportPrintBtn").click();
    await new Promise(resolve => setTimeout(resolve, 350));
    const result = {
      called,
      hasPrintReportClass: document.body.classList.contains("print-report"),
      snapshots: document.querySelectorAll(".print-chart-snapshot").length
    };
    window.print = originalPrint;
    return result;
  });
  if (printState.called !== 1 || printState.hasPrintReportClass || printState.snapshots !== 0) {
    throw new Error(`Report print lifecycle did not clean up correctly: ${JSON.stringify(printState)}`);
  }

  if (consoleErrors.length) {
    throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  }

  await page.screenshot({ path: `${artifactDir}/prompt5.png`, fullPage: false });
  console.log("frontend_prompt5_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/prompt5-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
