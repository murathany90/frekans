import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-live-frequency";
mkdirSync(artifactDir, { recursive: true });

const statusPayload = {
  status: "healthy",
  source: "GridRadar",
  metric: "frequency-ucte-median-1s",
  nominalFrequencyHz: 50,
  latestFrequencyHz: 49.9987,
  latestMeasurementTime: "2026-07-18T00:00:00.000Z",
  lastCollectionTime: "2026-07-18T00:15:10.000Z",
  sourceDelaySeconds: 910,
  collectorDelaySeconds: 10,
  resolutionSeconds: 1,
  retentionHours: 24,
  availableHistorySeconds: 3600,
  validSampleRatio: 0.995,
  minFrequencyHz: 49.982,
  maxFrequencyHz: 50.031,
  meanFrequencyHz: 50.0002
};

const seriesPayload = Array.from({ length: 80 }, (_, index) => {
  const timestamp = new Date(Date.parse("2026-07-17T22:40:00.000Z") + index * 60_000).toISOString();
  const wave = Math.sin(index / 7) * 0.012;
  return {
    timestamp,
    meanHz: 50 + wave,
    minHz: 49.985 + wave,
    maxHz: 50.015 + wave,
    validSamples: index % 17 === 0 ? 52 : 60
  };
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

async function installMockRoutes(targetPage) {
  await targetPage.route("https://mock.gridfreq.local/v1/live/status", (route) => route.fulfill({ json: statusPayload }));
  await targetPage.route("https://mock.gridfreq.local/v1/live/series?range=24h&resolution=60s", (route) => route.fulfill({ json: seriesPayload }));
  await targetPage.route(/https:\/\/mock\.gridfreq\.local\/v1\/live\/series\?.*resolution=1s.*/, (route) => route.fulfill({
    json: seriesPayload.slice(-10).flatMap((point, minuteIndex) => Array.from({ length: 6 }, (_, secondIndex) => ({
      timestampMs: Date.parse(point.timestamp) + secondIndex * 10_000,
      frequencyHz: point.meanHz + minuteIndex * 0.0001
    })))
  }));
  await targetPage.route(/https:\/\/mock\.gridfreq\.local\/v1\/live\/delta.*/, (route) => route.fulfill({ json: [] }));
}

async function setMockConfig(targetPage) {
  await targetPage.evaluate(() => {
    Object.defineProperty(window, "GRIDFREQ_CONFIG", {
      value: Object.freeze({ liveApiBaseUrl: "https://mock.gridfreq.local" }),
      configurable: true
    });
  });
}

try {
  await installMockRoutes(page);
  // Override production config before page load so we can test the empty-config state first
  await page.addInitScript(() => {
    Object.defineProperty(window, "GRIDFREQ_CONFIG", {
      value: Object.freeze({ liveApiBaseUrl: "" }),
      configurable: true
    });
  });
  await page.goto(`${url}#/live-frequency`, { waitUntil: "networkidle" });
  await page.waitForSelector("#tab-live-frequency.active");
  await page.waitForSelector("#liveFrequencyStatus");
  const emptyStatus = await page.textContent("#liveFrequencyStatus");
  if (!/Worker API URL/.test(emptyStatus || "")) {
    throw new Error(`Expected safe missing-config state, got: ${emptyStatus}`);
  }

  await setMockConfig(page);
  await page.evaluate(() => window.GridFreqLiveFrequency.refresh());
  await page.waitForFunction(() => /canlı veri|gösteriliyor/i.test(document.querySelector("#liveFrequencyStatus")?.textContent || ""));
  await page.waitForSelector("#liveFrequencyChart canvas", { timeout: 15000 });
  const desktopState = await page.evaluate(() => ({
    url: window.location.hash,
    activeTab: document.querySelector(".tab-button.active")?.dataset.tab,
    kpiCount: document.querySelectorAll(".live-frequency-kpi").length,
    latestFrequencyText: document.querySelector("#liveFrequencyKpis")?.textContent || "",
    horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
    chartSeriesCount: window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"))?.getOption()?.series?.length || 0
  }));
  if (desktopState.url !== "#/live-frequency" || desktopState.activeTab !== "tab-live-frequency") {
    throw new Error(`Live route did not stay active: ${JSON.stringify(desktopState)}`);
  }
  if (desktopState.kpiCount !== 10 || !desktopState.latestFrequencyText.includes("49,9987")) {
    throw new Error(`Live KPI render failed: ${JSON.stringify(desktopState)}`);
  }
  if (desktopState.horizontalScroll || desktopState.chartSeriesCount < 3) {
    throw new Error(`Live chart/layout failed: ${JSON.stringify(desktopState)}`);
  }
  await page.click('[data-live-range="3600"]');
  await page.waitForFunction(() => document.querySelector('[data-live-range="3600"]')?.classList.contains("active"));
  await page.screenshot({ path: `${artifactDir}/desktop-live-frequency.png`, fullPage: false });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await installMockRoutes(mobile);
  await mobile.addInitScript(() => {
    Object.defineProperty(window, "GRIDFREQ_CONFIG", {
      value: Object.freeze({ liveApiBaseUrl: "" }),
      configurable: true
    });
  });
  await mobile.goto(`${url}#/live-frequency`, { waitUntil: "networkidle" });
  await setMockConfig(mobile);
  await mobile.evaluate(() => window.GridFreqLiveFrequency.refresh());
  await mobile.waitForSelector("#liveFrequencyChart canvas", { timeout: 15000 });
  const mobileState = await mobile.evaluate(() => ({
    horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
    rangeButtons: document.querySelectorAll("[data-live-range]").length,
    kpiCount: document.querySelectorAll(".live-frequency-kpi").length
  }));
  if (mobileState.horizontalScroll || mobileState.rangeButtons !== 4 || mobileState.kpiCount !== 10) {
    throw new Error(`Mobile live layout failed: ${JSON.stringify(mobileState)}`);
  }
  await mobile.screenshot({ path: `${artifactDir}/mobile-live-frequency.png`, fullPage: false });
  await mobile.close();

  if (consoleErrors.length) {
    throw new Error(`Console errors:\n${consoleErrors.join("\n")}`);
  }
  console.log("frontend_live_frequency_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/failure-live-frequency.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
