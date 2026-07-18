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

let latestMeasurementMs = Date.now() - 15 * 60_000;
let statusPayload = makeStatus(15);
let statusCalls = 0;
let series60Calls = 0;
let rawSeriesCalls = 0;
let deltaCalls = 0;
const rawRequests = [];

function makeStatus(ageMinutes = 15, availableHistorySeconds = 86400) {
  latestMeasurementMs = Date.now() - ageMinutes * 60_000;
  return {
    status: "healthy",
    source: "GridRadar",
    metric: "frequency-ucte-median-1s",
    nominalFrequencyHz: 50,
    latestFrequencyHz: 49.9987,
    latestMeasurementTime: new Date(latestMeasurementMs).toISOString(),
    lastCollectionTime: new Date(Date.now() - 30_000).toISOString(),
    sourceDelaySeconds: ageMinutes * 60,
    collectorDelaySeconds: 10,
    resolutionSeconds: 1,
    retentionHours: 24,
    availableHistorySeconds,
    validSampleRatio: 0.995,
    minFrequencyHz: 49.982,
    maxFrequencyHz: 50.031,
    meanFrequencyHz: 50.0002
  };
}

function makeSummarySeries() {
  return Array.from({ length: 1440 }, (_, index) => {
    const timestamp = new Date(latestMeasurementMs - (1439 - index) * 60_000).toISOString();
    const wave = Math.sin(index / 7) * 0.012;
    return {
      timestamp,
      meanHz: 50 + wave,
      minHz: 49.985 + wave,
      maxHz: 50.015 + wave,
      validSamples: index % 17 === 0 ? 52 : 60
    };
  });
}

function makeRawSeries(fromMs, toMs) {
  const points = [];
  const boundedTo = Math.min(toMs, fromMs + 3600_000);
  for (let timestampMs = fromMs; timestampMs <= boundedTo; timestampMs += 1000) {
    const index = Math.round((timestampMs - fromMs) / 1000);
    points.push({
      timestampMs,
      frequencyHz: 50 + Math.sin(index / 45) * 0.014
    });
  }
  return points;
}

async function waitFor(check, message, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
}

async function installMockRoutes(targetPage) {
  await targetPage.route("https://mock.gridfreq.local/v1/live/status", (route) => {
    statusCalls += 1;
    return route.fulfill({ json: statusPayload });
  });
  await targetPage.route(/https:\/\/mock\.gridfreq\.local\/v1\/live\/series\?.*resolution=60s.*/, (route) => {
    series60Calls += 1;
    return route.fulfill({ json: makeSummarySeries() });
  });
  await targetPage.route(/https:\/\/mock\.gridfreq\.local\/v1\/live\/series\?.*resolution=1s.*/, (route) => {
    rawSeriesCalls += 1;
    const requestUrl = new URL(route.request().url());
    const fromMs = Date.parse(requestUrl.searchParams.get("from") || "");
    const toMs = Date.parse(requestUrl.searchParams.get("to") || "");
    rawRequests.push({ fromMs, toMs });
    return route.fulfill({ json: makeRawSeries(fromMs, toMs) });
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

async function chartState(targetPage) {
  return targetPage.evaluate(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"));
    const option = chart?.getOption?.() || {};
    return {
      url: window.location.hash,
      lang: document.documentElement.getAttribute("data-current-lang") || "",
      activeTab: document.querySelector(".tab-button.active")?.dataset.tab,
      kpiCount: document.querySelectorAll(".live-frequency-kpi").length,
      rangeButtons: document.querySelectorAll("[data-live-range]").length,
      activeRange: document.querySelector("[data-live-range].active")?.getAttribute("data-live-range"),
      has15MinuteButton: Boolean(document.querySelector('[data-live-range="900"]')),
      chartTitle: document.querySelector("#liveFrequencyChartTitle")?.textContent?.trim() || "",
      statusText: document.querySelector("#liveFrequencyStatus")?.textContent || "",
      text: document.querySelector("#tab-live-frequency")?.textContent || "",
      bufferVisible: !document.querySelector("#liveFrequencyBufferNotice")?.hidden,
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
      sourceLogoWidth: document.querySelector(".live-frequency-provider-logo")?.getBoundingClientRect().width || 0,
      providerWidth: document.querySelector(".live-frequency-provider")?.getBoundingClientRect().width || 0,
      sourceTermsTag: document.querySelector("#liveFrequencySourceTerms")?.tagName || "",
      hourNavHidden: document.querySelector("#liveFrequencyHourNav")?.hidden,
      prevDisabled: document.querySelector("#liveFrequencyPrevHour")?.disabled,
      nextDisabled: document.querySelector("#liveFrequencyNextHour")?.disabled,
      chartSeries: (option.series || []).map((series) => ({
        name: series.name,
        color: series.lineStyle?.[0]?.color || series.lineStyle?.color || "",
        width: series.lineStyle?.[0]?.width || series.lineStyle?.width || 0,
        opacity: series.lineStyle?.[0]?.opacity ?? series.lineStyle?.opacity ?? 1,
        markLineLabels: (series.markLine?.data || []).map((item) => item.label?.formatter || "")
      })),
      yMin: option.yAxis?.[0]?.min,
      yMax: option.yAxis?.[0]?.max,
      activeIntervals: window.__activeLiveIntervals?.() || 0
    };
  });
}

async function assertLiveSurface(targetPage, widthLabel, expectedRange = "3600") {
  await targetPage.waitForSelector("#liveFrequencyChart canvas", { timeout: 15000 });
  const state = await chartState(targetPage);
  if (!state.url.startsWith("#/live-frequency") || state.activeTab !== "tab-live-frequency") {
    throw new Error(`${widthLabel}: live route did not stay active: ${JSON.stringify(state)}`);
  }
  if (state.kpiCount !== 4 || state.rangeButtons !== 3 || state.activeRange !== expectedRange || state.has15MinuteButton) {
    throw new Error(`${widthLabel}: live controls/KPIs mismatch: ${JSON.stringify(state)}`);
  }
  if (!state.text.includes("GridRadar") || !state.text.includes("frequency-ucte-median-1s") || !/Veri kullanım koşulları|Data use terms/.test(state.text)) {
    throw new Error(`${widthLabel}: compact GridRadar source/use disclosure missing: ${JSON.stringify(state)}`);
  }
  if (state.bufferVisible) {
    throw new Error(`${widthLabel}: buffer notice must stay hidden when selected range has enough data: ${JSON.stringify(state)}`);
  }
  if (state.horizontalScroll || state.sourceLogoWidth > state.providerWidth) {
    throw new Error(`${widthLabel}: responsive layout overflow: ${JSON.stringify(state)}`);
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
  const firstRawCount = rawSeriesCalls;
  await page.evaluate(() => window.GridFreqLiveFrequency.refresh());
  await waitFor(() => rawSeriesCalls > firstRawCount, "Default 1h view must fetch the 1s series.");
  await page.waitForFunction(() => /GridRadar|gösteriliyor/i.test(document.querySelector("#liveFrequencyStatus")?.textContent || ""));
  const oneHourState = await assertLiveSurface(page, "desktop", "3600");
  if (oneHourState.chartTitle !== "Son 1 Saat" || oneHourState.chartSeries.length !== 1 || !/Saniyelik|1 s/i.test(oneHourState.chartSeries[0].name)) {
    throw new Error(`Default 1h chart must use 1s data and a dynamic title: ${JSON.stringify(oneHourState)}`);
  }
  if (oneHourState.hourNavHidden || oneHourState.nextDisabled !== true || oneHourState.prevDisabled !== false) {
    throw new Error(`Latest 1h window must show hour navigation with next disabled: ${JSON.stringify(oneHourState)}`);
  }
  const latestWindow = rawRequests.at(-1);
  if (Math.abs(latestWindow.toMs - latestMeasurementMs) > 2500 || latestWindow.toMs - latestWindow.fromMs > 3600_000 + 1000) {
    throw new Error(`1h raw window must be anchored to latestMeasurementTime and capped to 1h: ${JSON.stringify({ latestWindow, latestMeasurementMs })}`);
  }

  const beforePrevRaw = rawSeriesCalls;
  await page.click("#liveFrequencyPrevHour");
  await waitFor(() => rawSeriesCalls > beforePrevRaw, "Previous hour navigation must fetch the shifted 1s window.");
  const shiftedState = await chartState(page);
  if (shiftedState.nextDisabled || shiftedState.hourNavHidden) {
    throw new Error(`Shifted 1h window must enable the forward button: ${JSON.stringify(shiftedState)}`);
  }
  const shiftedWindow = rawRequests.at(-1);
  if (Math.abs(shiftedWindow.toMs - (latestMeasurementMs - 3600_000)) > 2500) {
    throw new Error(`Previous hour must move the raw window back by one hour: ${JSON.stringify({ shiftedWindow, latestMeasurementMs })}`);
  }
  const beforeNextRaw = rawSeriesCalls;
  await page.click("#liveFrequencyNextHour");
  await page.waitForTimeout(200);
  const latestAgainState = await chartState(page);
  if (!latestAgainState.nextDisabled || rawSeriesCalls !== beforeNextRaw) {
    throw new Error(`Returning to cached latest hour should not refetch and should disable next: ${JSON.stringify({ latestAgainState, beforeNextRaw, rawSeriesCalls })}`);
  }

  await page.click("#langToggle");
  await page.waitForFunction(() => document.documentElement.getAttribute("data-current-lang") === "en");
  const englishState = await chartState(page);
  if (englishState.chartTitle !== "Last 1 Hour" || !englishState.text.includes("Continental Europe · GridRadar · about 15 minutes delayed") || !englishState.text.includes("Data use terms") || !englishState.text.includes("Commercial or professional data access")) {
    throw new Error(`Live Frequency surface must translate to English: ${JSON.stringify(englishState)}`);
  }

  await page.click('[data-live-range="21600"]');
  await page.waitForFunction(() => document.querySelector('[data-live-range="21600"]')?.classList.contains("active"));
  const sixHourState = await assertLiveSurface(page, "desktop 6h", "21600");
  if (sixHourState.chartTitle !== "Last 6 Hours" || sixHourState.chartSeries.length !== 3 || !sixHourState.hourNavHidden) {
    throw new Error(`6h chart must use 60s summary series and hide hour nav: ${JSON.stringify(sixHourState)}`);
  }
  if (sixHourState.chartSeries[0].color !== "#111827" || sixHourState.chartSeries[1].color !== "#ef9a9a" || sixHourState.chartSeries[2].color !== "#9ca3af") {
    throw new Error(`6h chart colors must be simplified: ${JSON.stringify(sixHourState.chartSeries)}`);
  }
  if (!(sixHourState.chartSeries[1].width < sixHourState.chartSeries[0].width && sixHourState.chartSeries[2].opacity < sixHourState.chartSeries[0].opacity)) {
    throw new Error(`Max/min lines must be thinner and lower opacity: ${JSON.stringify(sixHourState.chartSeries)}`);
  }

  const beforeZoomRaw = rawSeriesCalls;
  await page.evaluate(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"));
    chart?.dispatchAction({ type: "dataZoom", start: 92, end: 96 });
  });
  await waitFor(() => rawSeriesCalls > beforeZoomRaw, "Zooming 6h to <=15 minutes must fetch cached 1s data.");
  await page.waitForFunction(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"));
    return (chart?.getOption?.().series || []).length === 4;
  });
  const afterFirstZoomRaw = rawSeriesCalls;
  await page.evaluate(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"));
    chart?.dispatchAction({ type: "dataZoom", start: 92, end: 96 });
  });
  await page.waitForTimeout(250);
  if (rawSeriesCalls !== afterFirstZoomRaw) {
    throw new Error(`Repeated zoom over the same 1s interval must use cache: ${JSON.stringify({ afterFirstZoomRaw, rawSeriesCalls, rawRequests })}`);
  }
  await page.evaluate(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"));
    chart?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
  });
  await page.waitForFunction(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#liveFrequencyChart"));
    return (chart?.getOption?.().series || []).length === 3;
  });
  await page.screenshot({ path: `${artifactDir}/desktop-live-frequency.png`, fullPage: false });

  statusPayload = makeStatus(35);
  await page.evaluate(() => window.GridFreqLiveFrequency.refresh());
  await page.waitForFunction(() => /Interrupted|weak|kesintili|zayıf|old/i.test(document.querySelector("#liveFrequencyKpis")?.textContent || ""));
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
  await waitFor(() => statusCalls > beforeResumeStatusCalls, "Visible tab resume must refresh missed live data.");

  const beforeManualPoll = { statusCalls, series60Calls, rawSeriesCalls, deltaCalls };
  await page.evaluate(async () => {
    const interval = window.__liveIntervals.find((item) => item.active && item.delay === 60000);
    await interval?.callback?.();
  });
  await waitFor(() => deltaCalls > beforeManualPoll.deltaCalls, "60s poll must refresh delta data.");
  if (statusCalls <= beforeManualPoll.statusCalls) {
    throw new Error(`60s poll must refresh status: ${JSON.stringify({ beforeManualPoll, statusCalls, series60Calls, deltaCalls })}`);
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
