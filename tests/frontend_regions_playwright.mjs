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
      dailyDisabled: document.querySelector("#regionsDailyBtn")?.disabled
    }));
    if (!initial.hash.startsWith("#/regions") || initial.title !== "Türkiye" || !initial.subtitle.includes("TEİAŞ") || initial.dailyDisabled) {
      throw new Error(`Default regions view did not select Türkiye with data: ${JSON.stringify(initial)}`);
    }
    if (requests.length > 2) {
      throw new Error(`Regions default view fetched too many daily binaries: ${requests.length}`);
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

  {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 }, isMobile: true });
    await page.goto(appUrl("#/regions?country=TR"), { waitUntil: "networkidle" });
    await waitForRegions(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    if (overflow) {
      await page.screenshot({ path: `${artifactDir}/regions-mobile-overflow.png`, fullPage: true });
      throw new Error("Frequency regions mobile view must not create horizontal page overflow at 360px.");
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
