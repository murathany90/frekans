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
  if (dataHealth.length < 2 || !dataHealth.some(text => /Türkiye/.test(text)) || !dataHealth.some(text => /Kıta Avrupası|Netztransparenz|ENTSO-E/.test(text))) {
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
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#analysisInfoPanel")?.classList.contains("hidden"));
  const qualityControls = await page.evaluate(() => ({
    resolutionHidden: document.querySelector('[data-param-key="resolution"]')?.hidden,
    ydHidden: document.querySelector('[data-param-key="yd"]')?.hidden,
    visibleDateModes: [...document.querySelectorAll("#analysisDateMode option")]
      .filter(option => !option.hidden && !option.disabled)
      .map(option => option.value),
    threshold: document.querySelector("#repeatedValueSeconds")?.value
  }));
  if (!qualityControls.resolutionHidden || qualityControls.ydHidden || qualityControls.threshold !== "15" || qualityControls.visibleDateModes.join(",") !== "single,range") {
    throw new Error(`Data Coverage controls are not scoped correctly: ${JSON.stringify(qualityControls)}`);
  }

  await page.locator(".analysis-advanced-panel").evaluate(details => {
    details.open = true;
  });
  await page.waitForFunction(() => {
    const input = document.querySelector("#repeatedValueSeconds");
    return input && input.offsetParent !== null;
  });
  await page.fill("#repeatedValueSeconds", "2");
  await page.click("#analysisRunBtn");
  await page.waitForFunction(() => document.querySelectorAll("#analysisResultCards .analysis-result-card").length === 4, { timeout: 30000 });
  await page.waitForFunction(() => window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"))?.getOption?.()?.series?.some(series => series.type === "heatmap"), { timeout: 20000 });
  const qualityState = await page.evaluate(() => {
    const chart = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart"));
    const option = chart?.getOption?.() || {};
    return {
      samplingInterval: state?.analysis?.sampling?.intervalSeconds,
      samplingMethod: state?.analysis?.sampling?.method,
      hasQualityClass: document.querySelector("#analysisMainChart")?.classList.contains("quality-chart"),
      seriesTypes: (option.series || []).map(series => series.type),
      seriesNames: (option.series || []).map(series => series.name),
      tableRows: document.querySelectorAll("#analysisEventsBody tr").length,
      cardValues: [...document.querySelectorAll("#analysisResultCards .analysis-result-card .value")].map(node => node.textContent?.trim() || "")
    };
  });
  if (qualityState.samplingInterval !== 1 || qualityState.samplingMethod !== "raw-canonical") {
    throw new Error(`Data Coverage must use raw one-second sampling: ${JSON.stringify(qualityState)}`);
  }
  if (!qualityState.hasQualityClass || !qualityState.seriesTypes.includes("heatmap") || qualityState.tableRows !== 4) {
    throw new Error(`Data Coverage chart/table did not render the new quality UI: ${JSON.stringify(qualityState)}`);
  }
  if (!qualityState.cardValues.some(value => /%$/.test(value))) {
    throw new Error(`Data Coverage cards do not include percentage KPIs: ${JSON.stringify(qualityState)}`);
  }
  if (qualityState.seriesNames.some(name => /max|min/i.test(name || ""))) {
    throw new Error(`Data Coverage graph must not show min/max series: ${JSON.stringify(qualityState.seriesNames)}`);
  }

  await page.evaluate(() => {
    const chart = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart"));
    const heatmap = chart.getOption().series.find(series => series.type === "heatmap");
    const cell = (heatmap.data || []).find(item => item[2] >= 0) || heatmap.data[0];
    showQualityDetailWindow(state.analysis.lastResult, cell[3], cell[4]);
  });
  await page.waitForFunction(() => window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"))?.getOption?.()?.series?.some(series => /1s$/.test(series.name || "") && (series.data || []).length > 100), { timeout: 10000 });

  const ydRows = await page.locator("#analysisEventsBody tr.event-row").count();
  if (ydRows > 0) {
    await page.locator("#analysisEventsBody tr.event-row").first().click();
    await page.waitForFunction(() => window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"))?.getOption?.()?.series?.some(series => /1s$/.test(series.name || "") && (series.data || []).length > 0), { timeout: 10000 });
  }

  const rangeCheck = await page.evaluate(async () => {
    const dates = state.auto.manifest?.sources?.teias?.availableDates || [];
    const selected = dates.slice(-Math.min(31, dates.length));
    if (selected.length < 8) return { skipped: true, reason: "not enough dates" };
    document.querySelector("#analysisDateMode").value = "range";
    document.querySelector("#analysisStartDate").value = selected[0];
    document.querySelector("#analysisEndDate").value = selected.at(-1);
    document.querySelector("#repeatedValueSeconds").value = "15";
    return { skipped: false, expectedDays: selected.length };
  });
  if (!rangeCheck.skipped) {
    await page.click("#analysisRunBtn");
    await page.waitForFunction(expectedDays => {
      const chart = window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"));
      const option = chart?.getOption?.() || {};
      const heatmap = (option.series || []).find(series => series.type === "heatmap");
      return (option.yAxis?.[1]?.data || []).length === expectedDays && (heatmap?.data || []).length === expectedDays * 96;
    }, rangeCheck.expectedDays, { timeout: 60000 });
    const rangeState = await page.evaluate(() => {
      const chart = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart"));
      const option = chart.getOption();
      const heatmap = (option.series || []).find(series => series.type === "heatmap");
      return {
        days: option.yAxis?.[1]?.data?.length || 0,
        cells: heatmap?.data?.length || 0,
        height: document.querySelector("#analysisMainChart")?.getBoundingClientRect().height || 0
      };
    });
    if (rangeState.days !== rangeCheck.expectedDays || rangeState.cells !== rangeCheck.expectedDays * 96 || rangeState.height < 650) {
      throw new Error(`Range heatmap did not include all selected days: ${JSON.stringify({ rangeCheck, rangeState })}`);
    }
  }

  const syntheticQuality = await page.evaluate(() => {
    document.querySelector("#repeatedValueSeconds").value = "15";
    document.querySelector("#analysisDateMode").value = "single";
    const series = Array.from({ length: 86400 }, (_, second) => 50 + Math.sin(second / 120) * 0.001);
    for (let second = 100; second < 114; second += 1) series[second] = 50.04;
    for (let second = 200; second < 215; second += 1) series[second] = 50.05;
    for (let second = 400; second < 420; second += 1) series[second] = NaN;
    for (let second = 1000; second < 1020; second += 1) series[second] = NaN;
    const current = {
      date: "2026-01-01",
      rawSeries: { tr: series, de: series },
      displaySeries: { tr: series, de: series },
      analysisSeries: { tr: series, de: series },
      overall: { pairedCount: 86400 }
    };
    const result = computeQualityAnalysisResult("quality", "tr", current, ["2026-01-01"]);
    state.analysis.lastResult = result;
    renderAnalysisResult(result);
    const repeatedEvents = result.events.filter(event => event.type === "repeated");
    const missingEvents = result.events.filter(event => event.type === "missing");
    const option = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart")).getOption();
    const tooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
    const formatter = tooltip?.formatter;
    const firstLine = (option.series || []).find(series => series.type === "line" && (series.data || []).some(point => Array.isArray(point) && point[1] !== null));
    const firstLinePoint = (firstLine?.data || []).find(point => Array.isArray(point) && point[1] !== null);
    const repeatedSeries = (option.series || []).find(series => /YD \/|RV \/|Yinelenen|Repeated/.test(series.name || ""));
    const repeatedArea = repeatedSeries?.markArea?.data?.[0];
    const missingSeries = (option.series || []).find(series => /Eksik Veri|Missing Data/.test(series.name || ""));
    const missingArea = missingSeries?.markArea?.data?.[0];
    const summaryTooltip = typeof formatter === "function" && firstLinePoint
      ? formatter({ seriesType: "line", seriesName: firstLine.name, seriesIndex: option.series.indexOf(firstLine), data: firstLinePoint, value: firstLinePoint })
      : "";
    const repeatedTooltip = typeof formatter === "function" && repeatedArea
      ? formatter({ seriesType: "line", seriesName: repeatedSeries.name, data: repeatedArea, value: null })
      : "";
    const missingTooltip = typeof formatter === "function" && missingArea
      ? formatter({ seriesType: "line", seriesName: missingSeries.name, data: missingArea, value: null })
      : "";
    return {
      titleText: document.querySelector("#oscChartTitle")?.textContent?.trim() || "",
      repeatedEvents: repeatedEvents.map(event => ({ start: event.startSecond, end: event.endSecond, duration: event.durationSeconds })),
      missingEvents: missingEvents.map(event => ({ start: event.startSecond, end: event.endSecond, duration: event.durationSeconds })),
      repeatedLegendNames: (option.series || []).filter(series => /YD|RV|Yinelenen|Repeated/.test(series.name || "")).map(series => series.name),
      repeatedMarkerNames: (repeatedSeries?.markArea?.data || []).map(area => area?.[0]?.name).filter(Boolean),
      summaryTooltip,
      repeatedTooltip,
      missingTooltip,
      hasResetButton: Boolean(document.querySelector("#qualityZoomResetBtn")),
      resetLabel: document.querySelector("#qualityZoomResetBtn")?.textContent?.trim() || "",
      resetAria: document.querySelector("#qualityZoomResetBtn")?.getAttribute("aria-label") || "",
      resetHidden: document.querySelector("#qualityZoomResetBtn")?.hidden,
      tableText: document.querySelector("#analysisEventsBody")?.textContent || ""
    };
  });
  if (syntheticQuality.repeatedEvents.length !== 1 || syntheticQuality.repeatedEvents[0].duration !== 15) {
    throw new Error(`15-second YD/RV threshold behavior failed: ${JSON.stringify(syntheticQuality.repeatedEvents)}`);
  }
  if (syntheticQuality.missingEvents.length < 2 || syntheticQuality.missingEvents.filter(event => event.duration === 20).length < 2) {
    throw new Error(`Equal longest missing gaps were not preserved: ${JSON.stringify(syntheticQuality.missingEvents)}`);
  }
  if (!syntheticQuality.hasResetButton || !syntheticQuality.resetHidden || !/En Uzun Veri Boşluğu|Longest Data Gap/.test(syntheticQuality.tableText)) {
    throw new Error(`Synthetic Data Coverage controls/table are incomplete: ${JSON.stringify(syntheticQuality)}`);
  }
  if (!/Veri Kapsama ve Kalite Özeti|Data Coverage and Quality Summary/.test(syntheticQuality.titleText) || /YD|RV|Yinelenen|Repeated/.test(syntheticQuality.titleText.replace(/Data Coverage and Quality Summary|Veri Kapsama ve Kalite Özeti/g, ""))) {
    throw new Error(`Data Coverage chart title must stay concise: ${syntheticQuality.titleText}`);
  }
  if (!syntheticQuality.repeatedLegendNames.some(name => /YD \/ Yinelenen Değer|RV \/ Repeated Value/.test(name))) {
    throw new Error(`Chart legend must use the full YD/RV layer label: ${JSON.stringify(syntheticQuality.repeatedLegendNames)}`);
  }
  if (!syntheticQuality.repeatedMarkerNames.length || syntheticQuality.repeatedMarkerNames.some(name => !/^(YD|RV)$/.test(name))) {
    throw new Error(`Chart YD/RV markers must use compact labels: ${JSON.stringify(syntheticQuality.repeatedMarkerNames)}`);
  }
  if (!/Görünümü Sıfırla|Reset View/.test(syntheticQuality.resetLabel) || !/Görünümü Sıfırla|Reset View/.test(syntheticQuality.resetAria)) {
    throw new Error(`Quality reset button label does not match current localization: ${JSON.stringify({ label: syntheticQuality.resetLabel, aria: syntheticQuality.resetAria })}`);
  }
  if (!/Tarih|Date|Saat|Time|Aralık|Interval/i.test(syntheticQuality.summaryTooltip) || !/Frekans|Frequency/i.test(syntheticQuality.summaryTooltip) || !/Durum|Status|Kalite|Quality/i.test(syntheticQuality.summaryTooltip)) {
    throw new Error(`Data Coverage summary tooltip is incomplete: ${syntheticQuality.summaryTooltip}`);
  }
  if (!/YD|RV/.test(syntheticQuality.repeatedTooltip) || !/Süre|Duration/i.test(syntheticQuality.repeatedTooltip)) {
    throw new Error(`Data Coverage YD/RV tooltip is incomplete: ${syntheticQuality.repeatedTooltip}`);
  }
  if (!/Eksik Veri|Missing Data/.test(syntheticQuality.missingTooltip) || /50\.\d+\s*Hz/.test(syntheticQuality.missingTooltip)) {
    throw new Error(`Missing data tooltip must avoid invented frequency values: ${syntheticQuality.missingTooltip}`);
  }

  await page.locator("#analysisEventsBody tr.event-row", { hasText: /En Uzun Veri Boşluğu|Longest Data Gap/ }).click();
  await page.waitForFunction(() => {
    const option = window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"))?.getOption?.() || {};
    return (option.series || []).some(series => /1s$/.test(series.name || "") && (series.data || []).length > 0);
  }, { timeout: 10000 });
  const gapZoomState = await page.evaluate(() => {
    const chart = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart"));
    const option = chart.getOption();
    const tooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
    const formatter = tooltip?.formatter;
    const secondSeries = (option.series || []).find(series => /1s$/.test(series.name || ""));
    const secondPoint = (secondSeries?.data || []).find(point => Array.isArray(point) && point[1] !== null);
    const missingSeries = (option.series || []).filter(series => /Eksik Veri|Missing Data/.test(series.name || ""));
    return {
      xMin: option.xAxis?.[0]?.min,
      xMax: option.xAxis?.[0]?.max,
      resetHidden: document.querySelector("#qualityZoomResetBtn")?.hidden,
      missingSeriesCount: missingSeries.length,
      missingSeriesJson: JSON.stringify(missingSeries),
      detailTooltip: typeof formatter === "function" && secondPoint
        ? formatter({ seriesType: "line", seriesName: secondSeries.name, seriesIndex: option.series.indexOf(secondSeries), data: secondPoint, value: secondPoint })
        : ""
    };
  });
  if (!(gapZoomState.xMin <= 400 && gapZoomState.xMax >= 420) || gapZoomState.resetHidden) {
    throw new Error(`Longest gap click did not zoom to the missing range: ${JSON.stringify(gapZoomState)}`);
  }
  if (!/#dc2626|dashed|Eksik Veri|Missing Data/.test(gapZoomState.missingSeriesJson)) {
    throw new Error(`Missing data is not clearly marked in red/dashed style: ${gapZoomState.missingSeriesJson}`);
  }
  if (!/1s|Tarih|Date|Saat|Time/i.test(gapZoomState.detailTooltip) || !/Frekans|Frequency/i.test(gapZoomState.detailTooltip)) {
    throw new Error(`Second-level zoom tooltip must show real second data: ${gapZoomState.detailTooltip}`);
  }

  await page.click("#qualityZoomResetBtn");
  await page.waitForFunction(() => {
    const option = window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"))?.getOption?.() || {};
    return document.querySelector("#qualityZoomResetBtn")?.hidden === true && option.xAxis?.[0]?.min === 0 && option.xAxis?.[0]?.max === 86400;
  }, { timeout: 10000 });

  await page.evaluate(() => {
    const chart = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart"));
    const heatmap = chart.getOption().series.find(series => series.type === "heatmap");
    const cell = (heatmap.data || []).find(item => item[2] >= 0) || heatmap.data[0];
    showQualityDetailWindow(state.analysis.lastResult, cell[3], cell[4]);
  });
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn")?.hidden === false, { timeout: 10000 });
  await page.click("#qualityZoomResetBtn");
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn")?.hidden === true, { timeout: 10000 });

  await page.setViewportSize({ width: 360, height: 760 });
  await page.locator("#analysisEventsBody tr.event-row", { hasText: /En Uzun Veri Boşluğu|Longest Data Gap/ }).click();
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn")?.hidden === false, { timeout: 10000 });
  const mobileReset = await page.evaluate(() => {
    const button = document.querySelector("#qualityZoomResetBtn");
    const text = document.querySelector("#qualityZoomResetText");
    const icon = document.querySelector("#qualityZoomResetBtn .quality-zoom-reset-icon");
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      textDisplay: text ? getComputedStyle(text).display : "",
      iconDisplay: icon ? getComputedStyle(icon).display : "",
      label: button?.textContent?.trim() || ""
    };
  });
  if (mobileReset.overflow || mobileReset.textDisplay !== "none" || mobileReset.iconDisplay === "none") {
    throw new Error(`Mobile reset zoom button must use an icon without horizontal scroll: ${JSON.stringify(mobileReset)}`);
  }
  await page.click("#qualityZoomResetBtn");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.click("#langToggle");
  await page.waitForFunction(() => document.querySelector(".brand h1")?.textContent?.trim() === "GridFreq");
  const enLabels = await page.$$eval("#analysisSourceSelect option, #coverageSummary .label", items => items.map(item => item.textContent?.trim() || ""));
  if (!enLabels.some(label => /Continental Europe/.test(label)) && !enLabels.some(label => /Latest Continental Europe data/.test(label))) {
    throw new Error(`English Continental Europe labels are missing: ${JSON.stringify(enLabels)}`);
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
