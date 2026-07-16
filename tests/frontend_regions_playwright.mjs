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

async function readRegionState(page) {
  return page.evaluate(() => ({
    hash: window.location.hash,
    title: document.querySelector("#regionsPanelTitle")?.textContent?.trim(),
    subtitle: document.querySelector("#regionsPanelSubtitle")?.textContent?.trim(),
    dailyDisabled: document.querySelector("#regionsDailyBtn")?.disabled,
    analysisDisabled: document.querySelector("#regionsAnalysisBtn")?.disabled,
    mapLayout: document.querySelector("#regionsMapHost svg")?.getAttribute("data-map-layout"),
    focusCount: document.querySelectorAll("#regionsMapHost svg .region-focus").length,
    cardCount: document.querySelectorAll("#regionsMapHost svg .region-card").length,
    hasRemovedRegion: Boolean(document.querySelector('#regionsMapHost svg [data-region-id="nordic"], #regionsMapHost svg [data-region-id="great-britain"], #regionsMapHost svg [data-region-id="ireland"]')),
    turkeyHighlightFill: document.querySelector("#regionsMapHost svg .turkiye-highlight")?.getAttribute("fill"),
    mapTitle: document.querySelector('#regionsMapHost svg [data-map-label="title"]')?.textContent?.trim(),
    selectValues: [...document.querySelectorAll("#regionsMobileSelect option")].map(option => option.value),
    selectLabels: [...document.querySelectorAll("#regionsMobileSelect option")].map(option => option.textContent?.trim()),
    controlNames: [...document.querySelectorAll("#regionsControlGrid .regions-control-item strong")].map(node => node.textContent?.trim())
  }));
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
    const initial = await readRegionState(page);
    if (!initial.hash.startsWith("#/regions") || initial.title !== "Türkiye" || !initial.subtitle.includes("TEİAŞ") || initial.dailyDisabled) {
      throw new Error(`Default regions view did not select Türkiye with data: ${JSON.stringify(initial)}`);
    }
    if (
      initial.mapLayout !== "continental-europe-focus" ||
      initial.focusCount !== 1 ||
      initial.cardCount !== 0 ||
      initial.hasRemovedRegion ||
      initial.turkeyHighlightFill !== "#EF4444" ||
      initial.mapTitle !== "Kıta Avrupası"
    ) {
      throw new Error(`Regions map must render the single Continental Europe focus layout: ${JSON.stringify(initial)}`);
    }
    if (initial.selectValues.join("|") !== "continental-europe|TR|continental-europe|CE") {
      throw new Error(`Regions selector must only expose Türkiye and Continental Europe: ${JSON.stringify(initial.selectValues)}`);
    }
    if (initial.controlNames.join("|") !== "PFK|SFK|Tersiyer") {
      throw new Error(`Turkish control cards must show PFK/SFK/Tersiyer: ${initial.controlNames.join(", ")}`);
    }
    if (requests.length > 2) {
      throw new Error(`Regions default view fetched too many daily binaries: ${requests.length}`);
    }

    await page.click("#langToggle");
    await page.waitForFunction(() => document.documentElement.dataset.currentLang === "en");
    const english = await readRegionState(page);
    if (english.mapTitle !== "Continental Europe") {
      throw new Error(`Regions SVG text must switch to English: ${JSON.stringify(english)}`);
    }
    if (english.controlNames.join("|") !== "FCR|aFRR|mFRR") {
      throw new Error(`English control cards must keep FCR/aFRR/mFRR: ${english.controlNames.join(", ")}`);
    }
    if (!english.selectLabels.some(label => label === "Continental Europe Synchronous Area")) {
      throw new Error(`English selector must include Continental Europe label: ${JSON.stringify(english.selectLabels)}`);
    }

    await page.goto(appUrl("#/regions/nordic?country=SE"), { waitUntil: "networkidle" });
    await waitForRegions(page);
    const oldNordic = await readRegionState(page);
    if (oldNordic.hasRemovedRegion || /Nordic|Nordik/.test(oldNordic.title || "") || oldNordic.dailyDisabled) {
      throw new Error(`Removed Nordic route should fall back to data-backed Continental Europe view: ${JSON.stringify(oldNordic)}`);
    }

    await page.goto(appUrl("#/regions/great-britain?country=GB"), { waitUntil: "networkidle" });
    await waitForRegions(page);
    const oldGb = await readRegionState(page);
    if (oldGb.hasRemovedRegion || /Great Britain|Büyük Britanya/.test(oldGb.title || "") || oldGb.analysisDisabled) {
      throw new Error(`Removed Great Britain route should fall back to data-backed Continental Europe view: ${JSON.stringify(oldGb)}`);
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
      focusCount: document.querySelectorAll("#regionsMapHost svg .region-focus").length,
      cardCount: document.querySelectorAll("#regionsMapHost svg .region-card").length,
      hasRemovedRegion: Boolean(document.querySelector('#regionsMapHost svg [data-region-id="nordic"], #regionsMapHost svg [data-region-id="great-britain"], #regionsMapHost svg [data-region-id="ireland"]')),
      turkeyHighlightFill: document.querySelector("#regionsMapHost svg .turkiye-highlight")?.getAttribute("fill"),
      mapTitle: document.querySelector('#regionsMapHost svg [data-map-label="title"]')?.textContent?.trim()
    }));
    if (
      mobileState.overflow ||
      mobileState.mapLayout !== "continental-europe-focus" ||
      mobileState.focusCount !== 1 ||
      mobileState.cardCount !== 0 ||
      mobileState.hasRemovedRegion ||
      mobileState.turkeyHighlightFill !== "#EF4444" ||
      mobileState.mapTitle !== "Kıta Avrupası"
    ) {
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
