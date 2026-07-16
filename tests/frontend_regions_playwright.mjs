import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for frequency regions tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const baseUrl = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-regions";
mkdirSync(artifactDir, { recursive: true });

function appUrl(hash = "") {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = hash;
  return url.href;
}

async function waitForRegions(page) {
  await page.waitForFunction(() => document.querySelector(".tab-button.active")?.dataset.tab === "tab-regions", null, { timeout: 30000 });
  await page.waitForSelector("#regionsMapHost svg", { timeout: 30000 });
}

const browser = await chromium.launch({ headless: true });

try {
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const requests = [];
    const consoleErrors = [];
    page.on("request", request => {
      if (request.url().includes(".frequency.i16")) requests.push(request.url());
    });
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", error => consoleErrors.push(error.message));

    await page.goto(appUrl(""), { waitUntil: "networkidle" });
    await waitForRegions(page);
    await page.waitForFunction(() => window.location.hash.startsWith("#/regions"));
    const initial = await page.evaluate(() => ({
      hash: window.location.hash,
      title: document.querySelector("#regionsPanelTitle")?.textContent?.trim(),
      subtitle: document.querySelector("#regionsPanelSubtitle")?.textContent?.trim(),
      summary: document.querySelector("#regionsSummaryGrid")?.textContent || "",
      dailyDisabled: document.querySelector("#regionsDailyBtn")?.disabled,
      mapLayout: document.querySelector("#regionsMapHost svg")?.getAttribute("data-map-layout"),
      cardCount: document.querySelectorAll("#regionsMapHost svg .region-card").length,
      hasIrelandCard: Boolean(document.querySelector('#regionsMapHost svg [data-region-id="ireland"]')),
      turkeyHighlightFill: document.querySelector("#regionsMapHost svg .turkiye-highlight")?.getAttribute("fill"),
      controlNames: [...document.querySelectorAll("#regionsControlGrid .regions-control-item strong")].map(node => node.textContent?.trim())
    }));
    if (!initial.hash.startsWith("#/regions") || initial.title !== "Türkiye" || !initial.subtitle.includes("TEİAŞ") || initial.dailyDisabled) {
      throw new Error(`Default regions view did not select Türkiye with data: ${JSON.stringify(initial)}`);
    }
    if (initial.mapLayout !== "png-silhouette-cards" || initial.cardCount !== 3 || initial.hasIrelandCard || initial.turkeyHighlightFill !== "#EF4444") {
      throw new Error(`Regions map must render the card silhouette layout: ${JSON.stringify(initial)}`);
    }
    if (initial.controlNames.join("|") !== "PFK|SFK|Tersiyer") {
      throw new Error(`Turkish control cards must show PFK/SFK/Tersiyer: ${initial.controlNames.join(", ")}`);
    }
    if (requests.length > 2) {
      throw new Error(`Regions default view fetched too many daily binaries: ${requests.length}`);
    }

    await page.click("#langToggle");
    await page.waitForFunction(() => document.documentElement.dataset.currentLang === "en");
    const englishControlNames = await page.evaluate(() => [...document.querySelectorAll("#regionsControlGrid .regions-control-item strong")].map(node => node.textContent?.trim()));
    if (englishControlNames.join("|") !== "FCR|aFRR|mFRR") {
      throw new Error(`English control cards must keep FCR/aFRR/mFRR: ${englishControlNames.join(", ")}`);
    }

    await page.selectOption("#regionsMobileSelect", "nordic|SE");
    await page.waitForFunction(() => window.location.hash.startsWith("#/regions/nordic"));
    const nordic = await page.evaluate(() => ({
      title: document.querySelector("#regionsPanelTitle")?.textContent?.trim(),
      dailyDisabled: document.querySelector("#regionsDailyBtn")?.disabled,
      analysisDisabled: document.querySelector("#regionsAnalysisBtn")?.disabled,
      status: document.querySelector("#regionsTimeDeviationStatus")?.textContent || ""
    }));
    if (!/Nordik|Nordic/.test(nordic.title) || !nordic.dailyDisabled || !nordic.analysisDisabled) {
      throw new Error(`No-data region should disable daily and analysis buttons: ${JSON.stringify(nordic)}`);
    }

    await page.selectOption("#regionsMobileSelect", "continental-europe|TR");
    await page.waitForFunction(() => document.querySelector("#regionsDailyBtn") && !document.querySelector("#regionsDailyBtn").disabled);
    await page.click("#regionsDailyBtn");
    await page.waitForFunction(() => document.querySelector(".tab-button.active")?.dataset.tab === "tab-chart" && window.location.hash.startsWith("#/daily"));
    if (consoleErrors.length) {
      throw new Error(`Console errors during regions test: ${consoleErrors.join(" | ")}`);
    }
    await page.close();
  }

  for (const width of [320, 360, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 740 }, isMobile: true });
    await page.goto(appUrl("#/regions?country=TR"), { waitUntil: "networkidle" });
    await waitForRegions(page);
    const mobileState = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      mapLayout: document.querySelector("#regionsMapHost svg")?.getAttribute("data-map-layout"),
      cardCount: document.querySelectorAll("#regionsMapHost svg .region-card").length,
      hasIrelandCard: Boolean(document.querySelector('#regionsMapHost svg [data-region-id="ireland"]')),
      turkeyHighlightFill: document.querySelector("#regionsMapHost svg .turkiye-highlight")?.getAttribute("fill")
    }));
    if (mobileState.overflow || mobileState.mapLayout !== "png-silhouette-cards" || mobileState.cardCount !== 3 || mobileState.hasIrelandCard || mobileState.turkeyHighlightFill !== "#EF4444") {
      await page.screenshot({ path: `${artifactDir}/regions-mobile-${width}.png`, fullPage: true });
      throw new Error(`Frequency regions mobile view failed at ${width}px: ${JSON.stringify(mobileState)}`);
    }
    await page.close();
  }

  console.log("frontend_regions_playwright ok");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
