import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const port = 4199;

function startServer() {
  return spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function wait(ms) {
  return new Promise(resolveWait => setTimeout(resolveWait, ms));
}

async function waitForServer() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/frekans_rapor_v1.html`, { cache: "no-store" });
      if (response.ok) return;
    } catch {}
    await wait(150);
  }
  throw new Error("static server did not start");
}

function buildSeries(offset = 0) {
  const length = 3600;
  const base = Array.from({ length }, (_, index) => 50 + Math.sin(index / 37) * 0.00015 + index * 0.00000002 + offset);
  for (let index = 100; index < 130; index += 1) base[index] = 49.98 + (index - 100) * 0.004;
  for (let index = 150; index < 152; index += 1) base[index] = NaN;
  for (let index = 410; index < 440; index += 1) base[index] = 50.18 - (index - 410) * 0.004;
  for (let index = 900; index < 904; index += 1) base[index] = NaN;
  for (let index = 1500; index < 1525; index += 1) base[index] = 49.99 + (index - 1500) * 0.0045;
  return base;
}

const server = startServer();
let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleIssues = [];
  page.on("console", message => {
    if (message.type() === "error") consoleIssues.push(message.text());
  });
  page.on("pageerror", error => consoleIssues.push(error.stack || error.message));
  await page.goto(`http://127.0.0.1:${port}/frekans_rapor_v1.html#/analysis`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.FrequencyAnalysisCore && window.echarts);

  const initial = await page.evaluate(({ tr, de }) => {
    setLanguage("tr");
    document.querySelector("#analysisTypeSelect").value = "rocof";
    document.querySelector("#analysisSourceSelect").value = "tr";
    document.querySelector("#analysisDateMode").value = "single";
    document.querySelector("#rocofMethod").value = "central";
    document.querySelector("#rocofThreshold").value = "2";
    document.querySelector("#minDuration").value = "2";
    document.querySelector("#repeatedValueSeconds").value = "15";
    updateAnalysisAvailability();
    updateAnalysisParameterPanel();
    const current = {
      date: "2026-01-01",
      rawSeries: { tr, de },
      displaySeries: { tr, de },
      analysisSeries: { tr, de },
      tr,
      de,
      overall: { pairedCount: tr.length }
    };
    state.current = current;
    const computed = computeAnalysisResult("rocof", "tr", current, ["2026-01-01"]);
    state.analysis.lastResult = computed;
    renderAnalysisResult(computed);
    renderReportPreview();
    const option = state.oscillationChart.getOption();
    return {
      kind: computed.chart.kind,
      samplingMethod: computed.metadata.sampling.method,
      allowedSources: analysisDefinition("rocof").allowedSources,
      events: computed.events.map(event => ({
        side: event.side,
        startSecond: event.startSecond,
        endSecond: event.endSecond,
        durationSeconds: event.durationSeconds,
        peakMhzPerSecond: event.peakMhzPerSecond,
        startFrequencyHz: event.startFrequencyHz,
        endFrequencyHz: event.endFrequencyHz,
        minFrequencyHz: event.minFrequencyHz,
        maxFrequencyHz: event.maxFrequencyHz
      })),
      cards: [...document.querySelectorAll("#analysisResultCards .analysis-result-card")].map(card => card.textContent.trim()),
      visibleParams: [...document.querySelectorAll(".analysis-controls.compact [data-param-key]")].filter(el => !el.hidden).map(el => el.dataset.paramKey),
      visibleSources: [...document.querySelectorAll("#analysisSourceSelect option")]
        .filter(option => !option.hidden && !option.disabled)
        .map(option => option.value),
      dateOptions: [...document.querySelectorAll("#analysisDateMode option")].filter(option => !option.hidden && !option.disabled).map(option => option.value),
      headers: [...document.querySelectorAll("#analysisEventsHead th")].map(th => th.textContent.trim()),
      tableRows: document.querySelectorAll("#analysisEventsBody tr.event-row").length,
      heatmapNames: option.series.filter(series => series.type === "heatmap").map(series => series.name),
      seriesNames: option.series.map(series => series.name).filter(Boolean),
      markerLabels: option.series
        .filter(series => /R\+|R-/.test(series.name || ""))
        .flatMap(series => series.markArea?.data?.map(item => item?.[0]?.name).filter(Boolean) || []),
      resetHidden: document.querySelector("#qualityZoomResetBtn").hidden,
      reportPreview: document.querySelector("#reportPreview")?.textContent || ""
    };
  }, { tr: buildSeries(), de: buildSeries(0.0002) });

  assert.equal(initial.kind, "rocof");
  assert.equal(initial.samplingMethod, "good-quality-canonical");
  assert.deepEqual(initial.allowedSources, ["tr", "de", "both", "common"]);
  assert.deepEqual(initial.visibleSources, ["tr", "de", "both", "common"]);
  assert.deepEqual(initial.dateOptions, ["single", "range"]);
  assert(initial.visibleParams.includes("rocofMethod"));
  assert(initial.visibleParams.includes("rocofThreshold"));
  assert(initial.visibleParams.includes("duration"));
  assert(initial.visibleParams.includes("yd"));
  assert(!initial.visibleParams.includes("resolution"));
  assert(!initial.visibleParams.includes("window"));
  assert(initial.events.some(event => event.side === "positive"), "Expected at least one R+ event.");
  assert(initial.events.some(event => event.side === "negative"), "Expected at least one R- event.");
  assert(initial.events.every(event => Number.isFinite(event.startFrequencyHz)));
  assert(initial.events.every(event => Number.isFinite(event.endFrequencyHz)));
  assert(initial.cards.some(text => /Maks|Max/.test(text)));
  assert(initial.cards.some(text => /RoCoF/.test(text)));
  assert(/Peak RoCoF|Tepe/.test(initial.headers.join("|")));
  assert(initial.tableRows >= 2);
  assert(initial.heatmapNames.some(name => /RoCoF/.test(name)));
  assert(initial.seriesNames.some(name => /R\+/.test(name)));
  assert(initial.seriesNames.some(name => /R-|R−/.test(name)));
  assert(initial.markerLabels.every(label => label === "R+" || label === "R-" || label === "R−"));
  assert.equal(initial.resetHidden, true);
  assert(/RoCoF/.test(initial.reportPreview));

  const methodVisibility = await page.evaluate(() => {
    const states = {};
    for (const method of ["central", "filteredDerivative", "movingRegression"]) {
      document.querySelector("#rocofMethod").value = method;
      updateAnalysisParameterPanel();
      states[method] = [...document.querySelectorAll(".analysis-controls.compact [data-param-key]")]
        .filter(el => !el.hidden)
        .map(el => el.dataset.paramKey);
    }
    return states;
  });
  assert(!methodVisibility.central.includes("rocofPrefilter"));
  assert(!methodVisibility.central.includes("rocofRegression"));
  assert(methodVisibility.filteredDerivative.includes("rocofPrefilter"));
  assert(methodVisibility.movingRegression.includes("rocofRegression"));

  const reportAndExport = await page.evaluate(() => {
    const captured = [];
    const originalDownload = window.downloadBlob;
    window.downloadBlob = (filename, content, type) => captured.push({ filename, content, type });
    try {
      renderReportPreview();
      exportAnalysisJson();
      exportAnalysisCsv();
    } finally {
      window.downloadBlob = originalDownload;
    }
    return {
      preview: document.querySelector("#reportPreview")?.textContent || "",
      downloads: captured.map(item => item.filename),
      csv: captured.find(item => item.filename === "analysis-events.csv")?.content || ""
    };
  });
  assert(/RoCoF/.test(reportAndExport.preview));
  assert(reportAndExport.downloads.includes("analysis-result.json"));
  assert(reportAndExport.downloads.includes("analysis-events.csv"));
  assert(/Peak RoCoF|Tepe/.test(reportAndExport.csv));
  assert(!/undefined/.test(reportAndExport.csv));

  const heatmapProbe = await page.evaluate(() => {
    const chart = state.oscillationChart;
    const option = chart.getOption();
    const tooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
    const formatter = tooltip?.formatter;
    const heatmapIndex = (option.series || []).findIndex(series => series.type === "heatmap" && /RoCoF/.test(series.name || ""));
    const heatmapSeries = option.series[heatmapIndex];
    const dataIndex = (heatmapSeries?.data || []).findIndex(point => Array.isArray(point) && point[2] >= 0);
    const point = dataIndex >= 0 ? heatmapSeries.data[dataIndex] : null;
    const realTooltip = typeof formatter === "function" && point
      ? formatter({ seriesType: "heatmap", seriesName: heatmapSeries.name, value: point, data: point })
      : "";
    const malformedTooltip = typeof formatter === "function"
      ? formatter({ seriesType: "heatmap", seriesName: heatmapSeries?.name || "x", value: { bad: true }, data: { bad: true } })
      : "";
    if (point) showRocofDetailWindow(state.analysis.lastResult, point[3], point[4]);
    const detailOption = chart.getOption();
    return {
      heatmapIndex,
      dataIndex,
      realTooltip,
      malformedTooltip,
      resetVisible: !document.querySelector("#qualityZoomResetBtn").hidden,
      hasSecondSeries: detailOption.series.some(series => String(series.name || "").includes("1s")),
      hasEventBoundary: detailOption.series.some(series => /RoCoF.*(event boundary|olay)/.test(String(series.name || ""))),
      hasFrequencyDots: detailOption.series.some(series => /RoCoF.*(frequency points|frekans)/.test(String(series.name || "")))
    };
  });
  assert(heatmapProbe.heatmapIndex >= 0 && heatmapProbe.dataIndex >= 0);
  assert(/Peak|RoCoF/.test(heatmapProbe.realTooltip));
  assert.equal(typeof heatmapProbe.malformedTooltip, "string");
  assert.equal(heatmapProbe.resetVisible, true);
  assert.equal(heatmapProbe.hasSecondSeries, true);
  await page.locator("#qualityZoomResetBtn").click();
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn").hidden);

  await page.locator("#analysisEventsBody tr.event-row").first().click();
  await page.waitForFunction(() => !document.querySelector("#qualityZoomResetBtn").hidden);
  const eventZoom = await page.evaluate(() => {
    const option = state.oscillationChart.getOption();
    return {
      hasSecondSeries: option.series.some(series => String(series.name || "").includes("1s")),
      hasEventBoundary: option.series.some(series => /RoCoF.*(event boundary|olay)/.test(String(series.name || ""))),
      hasFrequencyDots: option.series.some(series => /RoCoF.*(frequency points|frekans)/.test(String(series.name || "")))
    };
  });
  assert.equal(eventZoom.hasSecondSeries, true);
  assert.equal(eventZoom.hasEventBoundary, true);
  assert.equal(eventZoom.hasFrequencyDots, true);
  await page.locator("#qualityZoomResetBtn").click();
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn").hidden);

  await page.locator("#analysisResultCards .analysis-result-card").filter({ hasText: /Maks|Max/ }).first().click();
  await page.waitForFunction(() => !document.querySelector("#qualityZoomResetBtn").hidden);
  await page.locator("#qualityZoomResetBtn").click();

  const helpText = await page.evaluate(() => {
    const target = [...document.querySelectorAll("#analysisEventsHead .metric-name")]
      .find(item => /RoCoF|mHz/.test(item.getAttribute("data-tooltip") || item.textContent || ""));
    target.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    return document.querySelector("#appTooltip")?.textContent || "";
  });
  assert(/RoCoF|mHz/.test(helpText));

  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 820 });
    await wait(150);
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(hasHorizontalScroll, false, `${width}px viewport should not create page horizontal scroll.`);
  }

  const matrix = await page.evaluate(async ({ tr, de }) => {
    const originalPrepare = window.prepareDailyContext || prepareDailyContext;
    const buildCurrent = date => {
      const dayShift = date.endsWith("02") ? 0.0001 : 0;
      return {
        date,
        rawSeries: { tr: tr.map(value => Number.isFinite(value) ? value + dayShift : value), de: de.map(value => Number.isFinite(value) ? value - dayShift : value) },
        displaySeries: { tr, de },
        analysisSeries: { tr, de },
        tr,
        de,
        overall: { pairedCount: tr.length }
      };
    };
    prepareDailyContext = async date => buildCurrent(date);
    state.dataMode = "manual";
    state.tr = new Map([["2026-01-01", {}], ["2026-01-02", {}]]);
    state.de = new Map([["2026-01-01", {}], ["2026-01-02", {}]]);
    const outcomes = [];
    try {
      for (const source of ["tr", "de", "both", "common"]) {
        for (const mode of ["single", "range"]) {
          document.querySelector("#analysisTypeSelect").value = "rocof";
          document.querySelector("#analysisSourceSelect").value = source;
          document.querySelector("#analysisDateMode").value = mode;
          document.querySelector("#analysisDateSelect").value = "2026-01-02";
          document.querySelector("#analysisStartDate").value = "2026-01-01";
          document.querySelector("#analysisEndDate").value = "2026-01-02";
          document.querySelector("#rocofMethod").value = source === "de" ? "filteredDerivative" : source === "common" ? "movingRegression" : "central";
          document.querySelector("#rocofThreshold").value = "2";
          document.querySelector("#minDuration").value = "2";
          document.querySelector("#repeatedValueSeconds").value = "15";
          updateAnalysisParameterPanel();
          updateAnalysisAvailability();
          await runAnalysisLab();
          renderReportPreview();
          const chart = state.oscillationChart.getOption();
          outcomes.push({
            source,
            mode,
            status: document.querySelector("#analysisStatus")?.textContent || "",
            kind: state.analysis.lastResult?.chart?.kind,
            events: state.analysis.lastResult?.events?.length || 0,
            cards: document.querySelectorAll("#analysisResultCards .analysis-result-card").length,
            rows: document.querySelectorAll("#analysisEventsBody tr.event-row").length,
            heatmap: chart.series.some(item => item.type === "heatmap" && /RoCoF/.test(item.name || "")),
            reportOk: /RoCoF/.test(document.querySelector("#reportPreview")?.textContent || "")
          });
        }
      }
    } finally {
      prepareDailyContext = originalPrepare;
    }
    return outcomes;
  }, { tr: buildSeries(), de: buildSeries(0.0002) });
  assert.equal(matrix.length, 8);
  for (const item of matrix) {
    assert(/Analiz tamamlandı|Analysis complete/.test(item.status), `Run did not complete: ${JSON.stringify(item)}`);
    assert.equal(item.kind, "rocof", `Wrong chart kind: ${JSON.stringify(item)}`);
    assert(item.events > 0, `No RoCoF events rendered: ${JSON.stringify(item)}`);
    assert.equal(item.cards, 4, `KPI cards missing: ${JSON.stringify(item)}`);
    assert(item.rows > 0, `Event rows missing: ${JSON.stringify(item)}`);
    assert.equal(item.heatmap, true, `Heatmap missing: ${JSON.stringify(item)}`);
    assert.equal(item.reportOk, true, `Report preview failed: ${JSON.stringify(item)}`);
  }

  assert.deepEqual(consoleIssues, []);
  console.log("RoCoF Playwright checks passed.");
} finally {
  await browser?.close();
  server.kill();
}
