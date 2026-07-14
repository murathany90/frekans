import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for frontend smoke tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts";
mkdirSync(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

async function getFrequencySeriesNames(targetPage = page) {
  return await targetPage.evaluate(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#frequencyChart"));
    return chart?.getOption()?.series?.map(series => series.name) || [];
  });
}

async function waitForFrequencySeries(predicate, label) {
  await page.waitForFunction(predicate, { timeout: 15000 }).catch(error => {
    throw new Error(`${label}: ${error.message}`);
  });
}

async function assertAnalysisFilterLayout(targetPage = page) {
  const layout = await targetPage.evaluate(() => {
    const bar = document.querySelector(".analysis-filter-bar");
    const advanced = document.querySelector(".analysis-advanced-panel");
    const controls = [
      document.querySelector("#analysisCalToggle"),
      document.querySelector("#analysisSourceSelect"),
      document.querySelector("#analysisTypeSelect"),
      document.querySelector("#analysisRunBtn")
    ];
    const boxes = controls.map(element => {
      const rect = element?.getBoundingClientRect();
      return rect ? { top: rect.top, bottom: rect.bottom, height: rect.height } : null;
    });
    const barRect = bar?.getBoundingClientRect();
    const advancedRect = advanced?.getBoundingClientRect();
    const copyRect = document.querySelector("#copyDailyDateBtn")?.getBoundingClientRect();
    return {
      childCount: bar?.children.length || 0,
      boxes,
      topSpread: Math.max(...boxes.map(box => box?.top || 0)) - Math.min(...boxes.map(box => box?.top || 0)),
      controlHeightSpread: Math.max(...boxes.map(box => box?.height || 0)) - Math.min(...boxes.map(box => box?.height || 0)),
      barHeight: barRect?.height || 0,
      advancedGap: advancedRect && barRect ? advancedRect.top - barRect.bottom : null,
      copyAboveControls: copyRect && boxes[0] ? copyRect.bottom <= boxes[0].top : false
    };
  });
  if (layout.childCount !== 4) {
    throw new Error(`Analysis filter bar should have four aligned groups: ${JSON.stringify(layout)}`);
  }
  if (layout.boxes.some(box => !box)) {
    throw new Error(`Analysis filter controls are missing: ${JSON.stringify(layout)}`);
  }
  if (layout.topSpread > 4) {
    throw new Error(`Analysis filter controls are not symmetrically top-aligned: ${JSON.stringify(layout)}`);
  }
  if (layout.controlHeightSpread > 2) {
    throw new Error(`Analysis filter controls should have matching heights: ${JSON.stringify(layout)}`);
  }
  if (layout.barHeight > 72 || layout.advancedGap === null || layout.advancedGap > 10) {
    throw new Error(`Analysis filter spacing is too loose: ${JSON.stringify(layout)}`);
  }
  if (!layout.copyAboveControls) {
    throw new Error(`Copy daily date action should be in the analysis date label row: ${JSON.stringify(layout)}`);
  }
}

function assertNoConsoleErrors(stage) {
  if (consoleErrors.length) {
    throw new Error(`${stage} console errors:\n${consoleErrors.join("\n")}`);
  }
}

try {
  await page.context().tracing.start({ screenshots: true, snapshots: true });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#autoModeBadge", { state: "attached" });
  await page.waitForFunction(() => Boolean(document.querySelector("#dateSelect")?.value));
  await page.click('[data-tab="tab-chart"]');

  const defaults = await page.evaluate(() => ({
    difference: document.querySelector("#showDifference")?.value,
    minmax: document.querySelector("#showMinMaxEnvelope")?.value,
    differencePressed: document.querySelector('[data-layer="difference"]')?.getAttribute("aria-pressed"),
    minmaxPressed: document.querySelector('[data-layer="minmax"]')?.getAttribute("aria-pressed")
  }));
  if (defaults.difference !== "no" || defaults.minmax !== "no") {
    throw new Error(`Layer defaults are not off: ${JSON.stringify(defaults)}`);
  }
  if (defaults.differencePressed !== "false" || defaults.minmaxPressed !== "false") {
    throw new Error(`Layer buttons are not aria-off by default: ${JSON.stringify(defaults)}`);
  }

  await page.click("#calculateBtn");
  await page.waitForFunction(() => document.querySelector("#reportDateTag")?.textContent.length > 4);
  await page.waitForSelector("#frequencyChart canvas");

  const initialSeries = await getFrequencySeriesNames();
  if (initialSeries.length !== 2) {
    throw new Error(`Expected only base frequency series by default, got: ${initialSeries.join(", ")}`);
  }

  await page.click('[data-layer="difference"]');
  await page.waitForFunction(() => document.querySelector('[data-layer="difference"]')?.getAttribute("aria-pressed") === "true");
  await waitForFrequencySeries(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#frequencyChart"));
    return (chart?.getOption()?.series || []).some(series => /fark|diff/i.test(series.name || ""));
  }, "Difference layer did not render");

  await page.click('[data-layer="minmax"]');
  await page.waitForFunction(() => document.querySelector('[data-layer="minmax"]')?.getAttribute("aria-pressed") === "true");
  await waitForFrequencySeries(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#frequencyChart"));
    const names = (chart?.getOption()?.series || []).map(series => series.name || "");
    return names.length >= 6 && names.some(name => /min/i.test(name)) && names.some(name => /max|maks/i.test(name));
  }, "Min/max layer did not render");

  const rapidDateResult = await page.evaluate(async () => {
    const dates = (state.auto.manifest?.sources?.teias?.availableDates || []).slice(-5);
    if (dates.length < 2) return { skipped: true, reason: "not enough dates" };
    dates.forEach((date, index) => {
      window.setTimeout(() => selectDate(date, { pushHistory: false, immediate: true }), index * 8);
    });
    await new Promise(resolve => window.setTimeout(resolve, 900));
    return {
      skipped: false,
      expected: dates.at(-1),
      selected: document.querySelector("#dateSelect")?.value,
      rendered: state.datePerf.renderedDate,
      loading: state.dateLoading,
      requests: state.dateRequestSequence,
      aborted: state.datePerf.abortedFetches
    };
  });
  if (!rapidDateResult.skipped) {
    await page.waitForFunction(() => !state.dateLoading, { timeout: 20000 });
    const finalDateState = await page.evaluate(() => ({
      selected: document.querySelector("#dateSelect")?.value,
      rendered: state.datePerf.renderedDate,
      loading: state.dateLoading
    }));
    if (finalDateState.loading || finalDateState.selected !== rapidDateResult.expected || finalDateState.rendered !== rapidDateResult.expected) {
      throw new Error(`Rapid date navigation did not settle on the last request: ${JSON.stringify({ rapidDateResult, finalDateState })}`);
    }
  }

  await page.click(".hour-header");
  await page.waitForFunction(() => document.querySelector("#chartViewTag")?.textContent.includes("3.600 saniye"));
  await page.dblclick(".hour-header");
  await page.waitForFunction(() => document.querySelector("#chartViewTag")?.textContent.includes("24 saat"));

  await page.click('[data-tab="tab-oscillation"]');
  await assertAnalysisFilterLayout();
  await page.selectOption("#analysisTypeSelect", "psd");
  const beforeWorkerRun = await page.evaluate(() => state.analysis.workerRequestId);
  await page.click("#analysisRunBtn");
  await page.waitForFunction(() => document.querySelectorAll("#analysisResultCards .analysis-result-card").length >= 2, { timeout: 20000 });
  await page.waitForSelector("#analysisMainChart canvas");
  const afterWorkerRun = await page.evaluate(() => state.analysis.workerRequestId);
  if (afterWorkerRun <= beforeWorkerRun) throw new Error("PSD analysis did not enter the worker execution path.");

  await page.selectOption("#analysisSourceSelect", "de");
  const selected = await page.$eval("#analysisSourceSelect", el => el.value);
  if (selected !== "de") throw new Error("Oscillation source did not switch to Netztransparenz.");

  await page.screenshot({ path: `${artifactDir}/desktop.png`, fullPage: false });

  const mobileViewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
    { width: 768, height: 1024 }
  ];
  for (const viewport of mobileViewports) {
    const mobilePage = await browser.newPage({ viewport, isMobile: viewport.width < 768 });
    await mobilePage.goto(url, { waitUntil: "networkidle" });
    await mobilePage.waitForSelector("#frequencyChart", { state: "attached" });
    await mobilePage.waitForFunction(() => Boolean(document.querySelector("#dateSelect")?.value));
    await mobilePage.click('[data-tab="tab-chart"]');
    await mobilePage.click("#calculateBtn");
    await mobilePage.waitForSelector("#frequencyChart canvas");
    const mobileState = await mobilePage.evaluate(() => ({
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 2,
      layerControlsVisible: Boolean(document.querySelector('[data-layer="difference"]')?.offsetParent)
        && Boolean(document.querySelector('[data-layer="minmax"]')?.offsetParent),
      prevButtonHeight: document.querySelector("#prevDayBtn")?.getBoundingClientRect().height || 0,
      nextButtonHeight: document.querySelector("#nextDayBtn")?.getBoundingClientRect().height || 0
    }));
    if (mobileState.horizontalScroll) throw new Error(`Horizontal scroll at ${viewport.width}x${viewport.height}`);
    if (!mobileState.layerControlsVisible) throw new Error(`Layer controls not visible at ${viewport.width}x${viewport.height}`);
    if (mobileState.prevButtonHeight < 36 || mobileState.nextButtonHeight < 36) {
      throw new Error(`Date buttons are too small at ${viewport.width}x${viewport.height}: ${JSON.stringify(mobileState)}`);
    }
    if (viewport.width === 390) await mobilePage.screenshot({ path: `${artifactDir}/mobile.png`, fullPage: false });
    await mobilePage.close();
  }

  assertNoConsoleErrors("frontend smoke");
  console.log("frontend_smoke_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await page.context().tracing.stop({ path: `${artifactDir}/trace.zip` }).catch(() => {});
  await browser.close();
}
