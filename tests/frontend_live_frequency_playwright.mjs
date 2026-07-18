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

function makeStatus(ageMinutes = 15) {
  const measuredAt = new Date(Date.now() - ageMinutes * 60_000).toISOString();
  return {
    status: "healthy",
    source: "GridRadar",
    metric: "frequency-ucte-median-1s",
    nominalFrequencyHz: 50,
    latestFrequencyHz: 49.9987,
    latestMeasurementTime: measuredAt,
    lastCollectionTime: new Date(Date.now() - 30_000).toISOString(),
    sourceDelaySeconds: ageMinutes * 60,
    collectorDelaySeconds: 10,
    resolutionSeconds: 1,
    retentionHours: 24,
    availableHistorySeconds: 86400,
    validSampleRatio: 0.995,
    minFrequencyHz: 49.982,
    maxFrequencyHz: 50.031,
    meanFrequencyHz: 50.0002
  };
}

let statusPayload = makeStatus(15);
let statusCalls = 0;
let series60Calls = 0;
let rawSeriesCalls = 0;
let deltaCalls = 0;

const seriesPayload = Array.from({ length: 1500 }, (_, index) => {
  const timestamp = new Date(Date.now() - (1499 - index) * 60_000).toISOString();
  const wave = Math.sin(index / 7) * 0.012;
  return {
    timestamp,
    meanHz: 50 + wave,
    minHz: 49.985 + wave,
    maxHz: 50.015 + wave,
    validSamples: index % 17 === 0 ? 52 : 60
  };
});

async function installMockRoutes(targetPage) {
  await targetPage.route("https://mock.gridfreq.local/v1/live/status", (route) => {
    statusCalls += 1;
    return route.fulfill({ json: statusPayload });
  });
  await targetPage.route("https://mock.gridfreq.local/v1/live/series?range=24h&resolution=60s", (route) => {
    series60Calls += 1;
    return route.fulfill({ json: seriesPayload });
  });
  await targetPage.route(/https:\/\/mock\.gridfreq\.local\/v1\/live\/series\?.*resolution=1s.*/, (route) => {
    rawSeriesCalls += 1;
    return route.fulfill({ json: [] });
  });
  await targetPage.route(/https:\/\/mock\.gridfreq\.local\/v1\/live\/delta.*/, (route) => {
    deltaCalls += 1;
    return route.fulfill({ json: [] });
  });
}

async function installInitScripts(targetPage) {
  await targetPage.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    window.__liveIntervals = [];
    window.setInterval = (callback, delay, ...args) => {
      const id = nativeSetInterval(callback, delay, ...args);
      window.__liveIntervals.push({ id, delay, active: true, callback });
      return id;
    };
    window.clearInterval = (id) => {
      window.__liveIntervals.forEach((item) => {
        if (item.id === id) item.active = false;
      });
      return nativeClearInterval(id);
    };
    window.__activeLiveIntervals = () => window.__liveIntervals.filter((item) => item.active && item.delay === 60000).length;
    Object.defineProperty(window, "GRIDFREQ_CONFIG", {
      value: Object.freeze({ liveApiBaseUrl: "" }),
      configurable: true
    });
  });
}

async function setMockConfig(targetPage) {
  await targetPage.evaluate(() => {
    Object.defineProperty(window, "GRIDFREQ_CONFIG", {
      value: Object.freeze({ liveApiBaseUrl: "https://mock.gridfreq.local" }),
      configurable: true
    });
  });
}

async function assertLiveSurface(targetPage, widthLabel) {
  await targetPage.waitForSelector("#liveFrequencyChart canvas", { timeout: 15000 });
  const state = await targetPage.evaluate(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"));
    const option = chart?.getOption?.() || {};
    return {
      url: window.location.hash,
      activeTab: document.querySelector(".tab-button.active")?.dataset.tab,
      kpiCount: document.querySelectorAll(".live-frequency-kpi").length,
      rangeButtons: document.querySelectorAll("[data-live-range]").length,
      activeRange: document.querySelector("[data-live-range].active")?.getAttribute("data-live-range"),
      has15MinuteButton: Boolean(document.querySelector('[data-live-range="900"]')),
      text: document.querySelector("#tab-live-frequency")?.textContent || "",
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
      sourceLogoWidth: document.querySelector(".live-frequency-provider-logo")?.getBoundingClientRect().width || 0,
      providerWidth: document.querySelector(".live-frequency-provider")?.getBoundingClientRect().width || 0,
      chartSeries: (option.series || []).map((series) => ({
        name: series.name,
        color: series.lineStyle?.[0]?.color || series.lineStyle?.color || "",
        markLineLabels: (series.markLine?.data || []).map((item) => item.label?.formatter || "")
      })),
      yMin: option.yAxis?.[0]?.min,
      yMax: option.yAxis?.[0]?.max,
      activeIntervals: window.__activeLiveIntervals?.() || 0
    };
  });
  if (state.url !== "#/live-frequency" || state.activeTab !== "tab-live-frequency") {
    throw new Error(`${widthLabel}: live route did not stay active: ${JSON.stringify(state)}`);
  }
  if (state.kpiCount !== 4 || state.rangeButtons !== 3 || state.activeRange !== "3600" || state.has15MinuteButton) {
    throw new Error(`${widthLabel}: live controls/KPIs mismatch: ${JSON.stringify(state)}`);
  }
  if (!state.text.includes("Kıta Avrupası · GridRadar · yaklaşık 15 dakika gecikmeli") || !state.text.includes("GridRadar ile iletişime geçin")) {
    throw new Error(`${widthLabel}: GridRadar source/use disclosure missing: ${JSON.stringify(state)}`);
  }
  if (state.horizontalScroll || state.sourceLogoWidth > state.providerWidth) {
    throw new Error(`${widthLabel}: responsive layout overflow: ${JSON.stringify(state)}`);
  }
  if (state.chartSeries.length !== 3 || state.chartSeries.some((series) => /1 sn/i.test(series.name))) {
    throw new Error(`${widthLabel}: chart must use 60s summary series only: ${JSON.stringify(state.chartSeries)}`);
  }
  if (state.chartSeries[0].color !== "#111827" || state.chartSeries[1].color !== "#c83c3c" || state.chartSeries[2].color !== "#6b7280") {
    throw new Error(`${widthLabel}: live chart colors changed unexpectedly: ${JSON.stringify(state.chartSeries)}`);
  }
  if (state.yMin === 49.85 || state.yMax === 50.15 || state.chartSeries.some((series) => series.markLineLabels.some((label) => /20 mHz|50 mHz|100 mHz/.test(label)))) {
    throw new Error(`${widthLabel}: chart must use automatic y-axis without extra limit lines: ${JSON.stringify(state)}`);
  }
  if (state.activeIntervals !== 1) {
    throw new Error(`${widthLabel}: expected exactly one active polling timer: ${JSON.stringify(state)}`);
  }
  return state;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await installMockRoutes(page);
  await installInitScripts(page);
  await page.goto(`${url}#/live-frequency`, { waitUntil: "networkidle" });
  await page.waitForSelector("#tab-live-frequency.active");
  await page.waitForSelector("#liveFrequencyStatus");
  const emptyStatus = await page.textContent("#liveFrequencyStatus");
  if (!/Worker API URL/.test(emptyStatus || "")) {
    throw new Error(`Expected safe missing-config state, got: ${emptyStatus}`);
  }

  await setMockConfig(page);
  await page.evaluate(() => window.GridFreqLiveFrequency.refresh());
  await page.waitForFunction(() => /GridRadar|gösteriliyor/i.test(document.querySelector("#liveFrequencyStatus")?.textContent || ""));
  await assertLiveSurface(page, "desktop");
  await page.click('[data-live-range="21600"]');
  await page.waitForFunction(() => document.querySelector('[data-live-range="21600"]')?.classList.contains("active"));
  await page.click('[data-live-range="3600"]');
  await page.waitForFunction(() => document.querySelector('[data-live-range="3600"]')?.classList.contains("active"));
  await page.screenshot({ path: `${artifactDir}/desktop-live-frequency.png`, fullPage: false });

  statusPayload = makeStatus(35);
  await page.evaluate(() => window.GridFreqLiveFrequency.refresh());
  await page.waitForFunction(() => /kesintili|zayıf|eski/i.test(document.querySelector("#liveFrequencyKpis")?.textContent || ""));
  const staleState = await page.evaluate(() => ({
    dotClass: document.querySelector(".live-frequency-status-dot")?.className || "",
    statusText: document.querySelector("#liveFrequencyKpis")?.textContent || ""
  }));
  if (!/stale/.test(staleState.dotClass)) {
    throw new Error(`Stale measurement must override healthy backend status: ${JSON.stringify(staleState)}`);
  }

  await page.evaluate(() => window.GridFreqLiveFrequency.start());
  await page.evaluate(() => window.GridFreqLiveFrequency.start());
  const timerState = await page.evaluate(() => window.__activeLiveIntervals?.() || 0);
  if (timerState !== 1) {
    throw new Error(`Repeated start() must not create duplicate polling timers: ${timerState}`);
  }

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hiddenTimers = await page.evaluate(() => window.__activeLiveIntervals?.() || 0);
  if (hiddenTimers !== 0) {
    throw new Error(`Hidden tab must stop polling timers: ${hiddenTimers}`);
  }
  const beforeResumeStatusCalls = statusCalls;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  if (statusCalls <= beforeResumeStatusCalls) {
    throw new Error("Visible tab resume must refresh missed live data.");
  }

  const beforeManualPoll = { statusCalls, series60Calls, rawSeriesCalls, deltaCalls };
  await page.evaluate(async () => {
    const interval = window.__liveIntervals.find((item) => item.active && item.delay === 60000);
    await interval?.callback?.();
  });
  await page.waitForTimeout(100);
  if (rawSeriesCalls !== 0) {
    throw new Error(`Frontend must not call raw 1s series endpoint: ${rawSeriesCalls}`);
  }
  if (series60Calls < 1 || deltaCalls <= beforeManualPoll.deltaCalls || statusCalls <= beforeManualPoll.statusCalls) {
    throw new Error(`60s poll must refresh status/delta without raw 1s series: ${JSON.stringify({ beforeManualPoll, statusCalls, series60Calls, deltaCalls })}`);
  }

  await page.click('[data-tab="tab-chart"]');
  await page.waitForFunction(() => document.querySelector(".tab-button.active")?.dataset.tab === "tab-chart");
  const routeTimers = await page.evaluate(() => window.__activeLiveIntervals?.() || 0);
  if (routeTimers !== 0) {
    throw new Error(`Leaving live route must clear polling timer: ${routeTimers}`);
  }

  for (const width of [360, 390, 768]) {
    statusPayload = makeStatus(15);
    const mobile = await browser.newPage({ viewport: { width, height: 844 }, isMobile: width < 768 });
    await installMockRoutes(mobile);
    await installInitScripts(mobile);
    await mobile.goto(`${url}#/live-frequency`, { waitUntil: "networkidle" });
    await setMockConfig(mobile);
    await mobile.evaluate(() => window.GridFreqLiveFrequency.refresh());
    await assertLiveSurface(mobile, `${width}px`);
    await mobile.screenshot({ path: `${artifactDir}/mobile-${width}-live-frequency.png`, fullPage: false });
    await mobile.close();
  }

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
