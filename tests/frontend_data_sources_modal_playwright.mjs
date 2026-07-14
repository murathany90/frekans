import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for data sources modal tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-data-sources";
mkdirSync(artifactDir, { recursive: true });

async function openPage(viewport, routeStatusFailure = false) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));
  if (routeStatusFailure) {
    await page.route("**/data/status.json", route => route.abort("failed"));
  }
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#dataSourcesInfoBtn");
  return { browser, page, consoleErrors };
}

function unexpectedConsoleErrors(errors) {
  return errors.filter(text => !/Failed to load resource: net::ERR_FAILED/i.test(text));
}

try {
  {
    const { browser, page, consoleErrors } = await openPage({ width: 1440, height: 900 });
    const resetAndInfo = await page.$$eval("#tab-chart .control-bar > button", buttons =>
      buttons.map(button => button.id).filter(Boolean)
    );
    const resetIndex = resetAndInfo.indexOf("resetZoomBtn");
    const infoIndex = resetAndInfo.indexOf("dataSourcesInfoBtn");
    if (!(resetIndex >= 0 && infoIndex === resetIndex + 1)) {
      throw new Error(`Info button must be immediately after reset button: ${JSON.stringify(resetAndInfo)}`);
    }

    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    const modalCount = await page.locator("#dataSourcesModal").count();
    if (modalCount !== 1) throw new Error(`Expected one modal, found ${modalCount}`);

    const modalText = await page.locator("#dataSourcesModal").textContent();
    for (const expected of [
      "Türkiye Şebeke Frekansı",
      "Kıta Avrupası Şebeke Frekansı",
      "Doğrudan ENTSO-E Transparency API’sinden alınmamaktadır",
      "50Hertz Transmission",
      "Amprion",
      "TenneT TSO",
      "TransnetBW"
    ]) {
      if (!modalText?.includes(expected)) throw new Error(`Modal text missing: ${expected}`);
    }

    const bodyOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    if (bodyOverflow !== "hidden") throw new Error(`Body must be locked while modal is open, got ${bodyOverflow}`);

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#dataSourcesModal")?.classList.contains("hidden"));
    const focusedAfterEscape = await page.evaluate(() => document.activeElement?.id);
    if (focusedAfterEscape !== "dataSourcesInfoBtn") {
      throw new Error(`Focus must return to info button after Escape, got ${focusedAfterEscape}`);
    }

    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    await page.click("#dataSourcesCloseBtn");
    await page.waitForFunction(() => document.querySelector("#dataSourcesModal")?.classList.contains("hidden"));
    const focusedAfterClose = await page.evaluate(() => document.activeElement?.id);
    if (focusedAfterClose !== "dataSourcesInfoBtn") {
      throw new Error(`Focus must return to info button after close button, got ${focusedAfterClose}`);
    }

    await page.click("#resetZoomBtn");
    await page.waitForSelector("#frequencyChart");

    await page.click("#langToggle");
    await page.waitForFunction(() => document.querySelector("#dataSourcesInfoBtn")?.textContent?.includes("Info"));
    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    const englishText = await page.locator("#dataSourcesModal").textContent();
    if (!/Data Sources and Methodology|Continental Europe Grid Frequency|not taken directly from the standard ENTSO-E Transparency API/i.test(englishText || "")) {
      throw new Error(`English modal text is missing expected content: ${englishText}`);
    }

    const unexpected = unexpectedConsoleErrors(consoleErrors);
    if (unexpected.length) throw new Error(`Console errors: ${unexpected.join(" | ")}`);
    await page.screenshot({ path: `${artifactDir}/desktop.png`, fullPage: false });
    await browser.close();
  }

  for (const width of [320, 360, 390, 430, 768, 1024]) {
    const { browser, page, consoleErrors } = await openPage({ width, height: 820 });
    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
      modal: document.querySelector(".data-sources-dialog")?.getBoundingClientRect().width || 0,
      viewport: window.innerWidth
    }));
    if (overflow.doc > 2 || overflow.body > 2 || overflow.modal > overflow.viewport) {
      throw new Error(`Horizontal overflow at ${width}px: ${JSON.stringify(overflow)}`);
    }
    const closeVisible = await page.locator("#dataSourcesCloseBtn").isVisible();
    if (!closeVisible) throw new Error(`Close button not visible at ${width}px.`);
    const unexpected = unexpectedConsoleErrors(consoleErrors);
    if (unexpected.length) throw new Error(`Console errors at ${width}px: ${unexpected.join(" | ")}`);
    await page.screenshot({ path: `${artifactDir}/mobile-${width}.png`, fullPage: false });
    await browser.close();
  }

  {
    const { browser, page, consoleErrors } = await openPage({ width: 390, height: 820 }, true);
    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    const text = await page.locator("#dataSourcesModal").textContent();
    if (!/Güncel durum bilgisi alınamadı|Current status information could not be loaded/i.test(text || "")) {
      throw new Error(`Status failure fallback is missing: ${text}`);
    }
    const unexpected = unexpectedConsoleErrors(consoleErrors);
    if (unexpected.length) throw new Error(`Console errors during status failure fallback: ${unexpected.join(" | ")}`);
    await browser.close();
  }

  console.log("frontend_data_sources_modal_playwright ok");
} catch (error) {
  console.error(error);
  process.exit(1);
}
