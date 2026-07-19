import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for Basic Stats tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-basic-stats";
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
  await page.click('[data-tab="tab-oscillation"]');
  await page.selectOption("#analysisSourceSelect", "tr");
  await page.selectOption("#analysisTypeSelect", "stats");

  const controls = await page.evaluate(() => {
    updateAnalysisAvailability();
    return {
      resolutionHidden: document.querySelector('[data-param-key="resolution"]')?.hidden,
      statsBandVisible: document.querySelector('[data-param-key="statsBand"]')?.hidden === false,
      ydVisible: document.querySelector('[data-param-key="yd"]')?.hidden === false,
      lower: document.querySelector("#statsBandMinHz")?.value,
      upper: document.querySelector("#statsBandMaxHz")?.value,
      ydThreshold: document.querySelector("#repeatedValueSeconds")?.value
    };
  });
  if (!controls.resolutionHidden || !controls.statsBandVisible || !controls.ydVisible || controls.lower !== "49.95" || controls.upper !== "50.05" || controls.ydThreshold !== "15") {
    throw new Error(`Basic Stats controls are not scoped correctly: ${JSON.stringify(controls)}`);
  }

  const synthetic = await page.evaluate(() => {
    document.querySelector("#analysisTypeSelect").value = "stats";
    document.querySelector("#statsBandMinHz").value = "49.95";
    document.querySelector("#statsBandMaxHz").value = "50.05";
    document.querySelector("#repeatedValueSeconds").value = "15";
    const series = Array.from({ length: 3600 }, (_, second) => 50 + Math.sin(second / 80) * 0.002);
    series[300] = 49.94;
    series[600] = 50.08;
    for (let second = 1000; second < 1010; second += 1) series[second] = NaN;
    series[1200] = 52;
    for (let second = 1500; second < 1515; second += 1) series[second] = 50.001;
    const current = {
      date: "2026-01-01",
      rawSeries: { tr: series, de: series },
      displaySeries: { tr: series, de: series },
      analysisSeries: { tr: series, de: series },
      tr: series,
      de: series,
      overall: { pairedCount: 3600 }
    };
    const result = computeStatsAnalysisResult("stats", "tr", current, ["2026-01-01"]);
    state.analysis.lastResult = result;
    renderAnalysisResult(result);
    const chart = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart"));
    const option = chart.getOption();
    const tooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
    const formatter = tooltip?.formatter;
    const lineSeries = (option.series || []).find(series => series.type === "line" && (series.data || []).length);
    const heatmap = (option.series || []).find(series => series.type === "heatmap");
    const bandSeries = (option.series || []).filter(series => series.type === "line" && series.markArea && /Aİ|Üİ|Lower|Upper/.test(series.name || ""));
    const bandMarker = bandSeries[0]?.markArea?.data?.[0]?.[0];
    const linePoint = lineSeries?.data?.find(point => Array.isArray(point) && point[1] !== null);
    const heatmapPoint = heatmap?.data?.find(point => Array.isArray(point) && point[2] >= 0);
    return {
      count: result.stats.count,
      expectedCount: result.statsMeta.expectedCount,
      rawValidSampleCount: result.statsMeta.rawValidSampleCount,
      goodUsedCount: result.statsMeta.goodUsedCount,
      excludedCount: result.statsMeta.excludedCount,
      minSecond: result.statsMeta.minSecond,
      maxSecond: result.statsMeta.maxSecond,
      longestBandStart: result.statsMeta.longestBandViolation?.startSecond,
      cards: [...document.querySelectorAll("#analysisResultCards .analysis-result-card .label")].map(node => node.textContent?.trim() || ""),
      tableText: document.querySelector("#analysisEventsBody")?.textContent || "",
      rowCount: document.querySelectorAll("#analysisEventsBody tr").length,
      clickableRows: document.querySelectorAll("#analysisEventsBody tr.event-row").length,
      sampling: state.analysis.sampling,
      chartKind: result.chart.kind,
      seriesTypes: (option.series || []).map(series => series.type),
      heatmapName: heatmap?.name || "",
      bandSeriesNames: bandSeries.map(series => series.name || ""),
      bandMarkerNames: bandSeries.flatMap(series => (series.markArea?.data || []).map(item => item?.[0]?.name || "")),
      countTag: document.querySelector("#oscCountTag")?.textContent || "",
      tooltipTargets: document.querySelectorAll("#analysisEventsBody [data-tooltip]").length,
      visualMapJson: JSON.stringify(option.visualMap || {}),
      lineTooltip: typeof formatter === "function" && linePoint
        ? formatter({ seriesType: "line", seriesName: lineSeries.name, data: linePoint, value: linePoint })
        : "",
      bandTooltip: typeof formatter === "function" && bandMarker
        ? formatter({ seriesType: "line", seriesName: bandSeries[0].name, data: bandMarker, value: bandMarker })
        : "",
      heatmapTooltip: typeof formatter === "function" && heatmapPoint
        ? formatter({ seriesType: "heatmap", seriesName: heatmap.name, value: heatmapPoint, data: heatmapPoint })
        : ""
    };
  });

  if (synthetic.count !== 3574 || synthetic.expectedCount !== 3600 || synthetic.excludedCount !== 26) {
    throw new Error(`Basic Stats must use only good-quality canonical samples: ${JSON.stringify(synthetic)}`);
  }
  if (synthetic.rawValidSampleCount !== 3589 || synthetic.goodUsedCount !== 3574) {
    throw new Error(`Basic Stats must separate raw valid and good-quality samples: ${JSON.stringify(synthetic)}`);
  }
  if (synthetic.cards.length !== 4 || synthetic.cards.some(label => /Medyan|Median|P01|P99|Bant|Band/.test(label))) {
    throw new Error(`Basic Stats top KPI cards must stay compact: ${JSON.stringify(synthetic.cards)}`);
  }
  for (const label of [
    /Geçerli Örnek|Raw Valid Sample/,
    /Kullanılan iyi kalite örnek|Good-quality samples used/,
    /Elenen Örnek|Excluded Sample/,
    /Medyan|Median/,
    /Varyans|Variance/,
    /Standart Sapma|Standard Deviation/,
    /Ortalama Mutlak Sapma|Mean Absolute Deviation/,
    /P01/,
    /P05/,
    /P25/,
    /P50/,
    /P75/,
    /P95/,
    /P99/,
    /Çarpıklık|Skewness/,
    /Fazlalık Basıklık|Excess Kurtosis/,
    /Bant içinde kalma oranı|In-band Ratio/,
    /Bant dışında kalma süresi|Out-of-band Duration/,
    /Alt bant ihlal süresi|Lower-band Violation Duration/,
    /Üst bant ihlal süresi|Upper-band Violation Duration/,
    /Bant ihlal olay sayısı|Band Violation Event Count/,
    /En uzun bant ihlali|Longest Band Violation/
  ]) {
    if (!label.test(synthetic.tableText)) throw new Error(`Basic Stats table is missing ${label}: ${synthetic.tableText}`);
  }
  if (synthetic.rowCount < 24 || synthetic.clickableRows < 3) {
    throw new Error(`Basic Stats detailed table/drilldowns are incomplete: ${JSON.stringify(synthetic)}`);
  }
  if (synthetic.sampling?.intervalSeconds !== 1 || synthetic.sampling?.method !== "good-quality-canonical" || synthetic.chartKind !== "stats") {
    throw new Error(`Basic Stats sampling/chart metadata is wrong: ${JSON.stringify(synthetic)}`);
  }
  if (!synthetic.seriesTypes.includes("heatmap") || !/Sapma|Deviation/.test(synthetic.heatmapName) || !/#d1d5db|#1f9d55|#facc15|#f97316|#dc2626/.test(synthetic.visualMapJson)) {
    throw new Error(`Basic Stats heatmap is missing or mis-colored: ${JSON.stringify(synthetic)}`);
  }
  if (!/15 dk RMS Sapma|15-min RMS Deviation/.test(synthetic.heatmapName) || !/0-25 mHz/.test(synthetic.visualMapJson) || !/25-50 mHz/.test(synthetic.visualMapJson) || !/50-100 mHz/.test(synthetic.visualMapJson) || !/100-200 mHz/.test(synthetic.visualMapJson) || !/>200 mHz/.test(synthetic.visualMapJson)) {
    throw new Error(`Basic Stats heatmap bands/name are wrong: ${JSON.stringify(synthetic)}`);
  }
  if (!synthetic.bandSeriesNames.some(name => /Aİ \/ Alt Bant İhlali|Lower Band Violation/.test(name)) || !synthetic.bandSeriesNames.some(name => /Üİ \/ Üst Bant İhlali|Upper Band Violation/.test(name))) {
    throw new Error(`Basic Stats band legend labels are not compact: ${JSON.stringify(synthetic.bandSeriesNames)}`);
  }
  if (!synthetic.bandMarkerNames.includes("Aİ") || !synthetic.bandMarkerNames.includes("Üİ") || synthetic.bandMarkerNames.some(name => /Alt Bant|Üst Bant|Lower-band|Upper-band/.test(name))) {
    throw new Error(`Basic Stats band markers should only use short labels: ${JSON.stringify(synthetic.bandMarkerNames)}`);
  }
  if (!/2 Bant İhlali|2 Band Violations/.test(synthetic.countTag)) {
    throw new Error(`Basic Stats count tag should describe band violations: ${synthetic.countTag}`);
  }
  if (synthetic.tooltipTargets < 8 || !/Alt Bant|Üst Bant|Lower-band|Upper-band/.test(synthetic.bandTooltip)) {
    throw new Error(`Basic Stats technical/band tooltips are incomplete: ${JSON.stringify(synthetic)}`);
  }
  if (!/Tarih|Date|Saat|Time/.test(synthetic.lineTooltip) || !/Frekans|Frequency/.test(synthetic.lineTooltip)) {
    throw new Error(`Basic Stats line tooltip is incomplete: ${synthetic.lineTooltip}`);
  }
  if (!/RMS|mHz/.test(synthetic.heatmapTooltip) || !/Ortalama|Mean/.test(synthetic.heatmapTooltip)) {
    throw new Error(`Basic Stats heatmap tooltip is incomplete: ${synthetic.heatmapTooltip}`);
  }

  await page.locator("#analysisEventsBody tr.event-row", { hasText: /Minimum|Minimum/ }).click();
  await page.waitForFunction(() => {
    const option = window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"))?.getOption?.() || {};
    return document.querySelector("#qualityZoomResetBtn")?.hidden === false && (option.series || []).some(series => /1s$/.test(series.name || ""));
  }, { timeout: 10000 });
  const minZoom = await page.evaluate(() => {
    const option = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart")).getOption();
    return { min: option.xAxis?.[0]?.min, max: option.xAxis?.[0]?.max };
  });
  if (!(minZoom.min <= 300 && minZoom.max >= 300)) {
    throw new Error(`Minimum row did not zoom to the true second: ${JSON.stringify(minZoom)}`);
  }
  await page.click("#qualityZoomResetBtn");
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn")?.hidden === true, { timeout: 10000 });

  await page.evaluate(() => {
    const chart = window.echarts.getInstanceByDom(document.querySelector("#analysisMainChart"));
    const heatmap = chart.getOption().series.find(series => series.type === "heatmap");
    const cell = (heatmap.data || []).find(item => item[3] <= 600 && item[4] > 600) || heatmap.data[0];
    showStatsDetailWindow(state.analysis.lastResult, cell[3], cell[4]);
  });
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn")?.hidden === false, { timeout: 10000 });
  await page.click("#qualityZoomResetBtn");
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn")?.hidden === true, { timeout: 10000 });

  await page.setViewportSize({ width: 360, height: 760 });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("resize"));
    window.echarts?.getInstanceByDom(document.querySelector("#analysisMainChart"))?.resize();
  });
  await page.waitForTimeout(100);
  const mobile = await page.evaluate(() => ({
    horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
    resetIcon: Boolean(document.querySelector("#qualityZoomResetBtn .quality-zoom-reset-icon"))
  }));
  if (mobile.horizontalScroll || !mobile.resetIcon) {
    throw new Error(`Basic Stats mobile layout is not compact: ${JSON.stringify(mobile)}`);
  }

  if (consoleErrors.length) {
    throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
  }

  await page.screenshot({ path: `${artifactDir}/basic-stats.png`, fullPage: false });
  console.log("frontend_basic_stats_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/basic-stats-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
