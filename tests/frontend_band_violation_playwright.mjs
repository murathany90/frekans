import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const port = 4198;

function startServer() {
  const child = spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return child;
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

function buildSeries() {
  const length = 3600;
  const tr = Array.from({ length }, () => 50.0);
  const de = Array.from({ length }, () => 50.0);
  for (let i = 100; i < 120; i += 1) tr[i] = 49.889 + (i - 100) * 0.00001;
  for (let i = 125; i < 145; i += 1) tr[i] = 49.888 + (i - 125) * 0.00001;
  for (let i = 200; i < 210; i += 1) tr[i] = 49.90;
  for (let i = 210; i < 220; i += 1) tr[i] = 50.10;
  for (let i = 300; i < 318; i += 1) tr[i] = 50.121 + (i - 300) * 0.00001;
  for (let i = 400; i < 405; i += 1) tr[i] = 50.12 + (i - 400) * 0.00001;
  for (let i = 500; i < 515; i += 1) tr[i] = 49.88;
  tr[120] = NaN;
  tr[121] = NaN;
  tr[600] = 52.0;
  for (let i = 700; i < 716; i += 1) de[i] = 50.125 + (i - 700) * 0.00001;
  return { tr, de };
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

  const result = await page.evaluate(series => {
    setLanguage("tr");
    state.settings.repeatedValueSeconds = 15;
    state.settings.statsBandMinHz = 49.90;
    state.settings.statsBandMaxHz = 50.10;
    document.querySelector("#analysisTypeSelect").value = "events";
    document.querySelector("#analysisSourceSelect").value = "tr";
    document.querySelector("#analysisDateMode").value = "single";
    document.querySelector("#statsBandMinHz").value = "49.90";
    document.querySelector("#statsBandMaxHz").value = "50.10";
    document.querySelector("#repeatedValueSeconds").value = "15";
    document.querySelector("#minDuration").value = "10";
    updateAnalysisParameterPanel();
    const current = {
      date: "2026-01-01",
      rawSeries: { tr: series.tr, de: series.de },
      displaySeries: { tr: series.tr, de: series.de },
      analysisSeries: { tr: series.tr, de: series.de },
      tr: series.tr,
      de: series.de,
      overall: { pairedCount: series.tr.length }
    };
    state.current = current;
    const computed = computeAnalysisResult("events", "tr", current, ["2026-01-01"]);
    state.analysis.lastResult = computed;
    renderAnalysisResult(computed);
    return {
      kind: computed.chart.kind,
      samplingMethod: computed.metadata.sampling.method,
      events: computed.events.map(event => ({
        source: event.source,
        side: event.side,
        startSecond: event.startSecond,
        endSecond: event.endSecond,
        durationSeconds: event.durationSeconds,
        exceedanceMhz: event.exceedanceMhz
      })),
      cards: [...document.querySelectorAll("#analysisResultCards .analysis-result-card")].map(card => card.textContent.trim()),
      headers: [...document.querySelectorAll("#analysisEventsHead th")].map(th => th.textContent.trim()),
      tableRows: [...document.querySelectorAll("#analysisEventsBody tr.event-row")].length,
      visibleParams: [...document.querySelectorAll(".analysis-controls.compact [data-param-key]")].filter(el => !el.hidden).map(el => el.dataset.paramKey),
      dateOptions: [...document.querySelectorAll("#analysisDateMode option")].filter(option => !option.hidden && !option.disabled).map(option => option.value),
      resetHidden: document.querySelector("#qualityZoomResetBtn").hidden,
      sourceAllowed: analysisDefinition("events").allowedSources
    };
  }, buildSeries());

  assert.equal(result.kind, "bandViolation");
  assert.equal(result.samplingMethod, "good-quality-canonical");
  assert.deepEqual(result.sourceAllowed, ["tr", "de", "both", "common"]);
  assert(result.visibleParams.includes("statsBand"));
  assert(result.visibleParams.includes("yd"));
  assert(result.visibleParams.includes("duration"));
  assert(!result.visibleParams.includes("resolution"));
  assert(!result.visibleParams.includes("threshold"));
  assert.deepEqual(result.dateOptions, ["single", "range"]);
  assert.equal(result.events.length, 3);
  assert.deepEqual(result.events.map(event => event.side), ["lower", "lower", "upper"]);
  assert.equal(result.events.some(event => event.startSecond === 200 || event.startSecond === 210), false, "Boundary values must remain in band.");
  assert.equal(result.events.some(event => event.startSecond === 400), false, "Short events should be filtered by minimum duration.");
  assert.equal(result.events.some(event => event.startSecond === 500), false, "YD/RV bad-quality samples should not enter band events.");
  assert.equal(result.events[0].endSecond <= 120 && result.events[1].startSecond >= 122, true, "Missing data must split consecutive violations.");
  assert(result.cards.some(text => /Toplam ihlal süresi|Total violation duration/.test(text)));
  assert(result.cards.some(text => /Olay sayısı|Event count/.test(text)));
  assert(!/Kaynak|Source/.test(result.headers.join("|")));
  assert(/İhlal türü|Violation type/.test(result.headers.join("|")));
  assert(/Uç değer|Extreme value/.test(result.headers.join("|")));
  assert.equal(result.tableRows, 3);
  assert.equal(result.resetHidden, true);

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
    const csv = captured.find(item => item.filename === "analysis-events.csv")?.content || "";
    return {
      preview: document.querySelector("#reportPreview")?.textContent || "",
      downloads: captured.map(item => ({ filename: item.filename, type: item.type, hasBandText: /Bant|Band|Aİ|Üİ|LBV|UBV/.test(item.content) })),
      csv
    };
  });
  assert(/Toplam ihlal süresi|Total violation duration/.test(reportAndExport.preview), "Report preview should render object-format cards.");
  assert(reportAndExport.downloads.some(item => item.filename === "analysis-result.json"));
  assert(reportAndExport.downloads.some(item => item.filename === "analysis-events.csv"));
  assert(/start|Başlangıç|Start/i.test(reportAndExport.csv));
  assert(!/undefined/.test(reportAndExport.csv), "Band violation CSV export should not contain undefined event fields.");

  const consistency = await page.evaluate(() => {
    document.querySelector("#minDuration").value = "1";
    const current = state.current;
    const eventsResult = computeAnalysisResult("events", "tr", current, ["2026-01-01"]);
    const statsResult = computeStatsAnalysisResult("stats", "tr", current, ["2026-01-01"]);
    return {
      eventsCount: eventsResult.events.length,
      statsCount: statsResult.stats.bandViolationEventCount,
      statsLongest: statsResult.stats.longestBandViolationSeconds,
      eventLongest: Math.max(...eventsResult.events.map(event => event.durationSeconds))
    };
  });
  assert.equal(consistency.eventsCount, consistency.statsCount);
  assert.equal(consistency.eventLongest, consistency.statsLongest);

  const dual = await page.evaluate(() => {
    document.querySelector("#minDuration").value = "10";
    const current = state.current;
    const computed = computeAnalysisResult("events", "both", current, ["2026-01-01"]);
    return computed.events.map(event => event.source);
  });
  assert(dual.includes("tr"));
  assert(dual.includes("de"));

  const option = await page.evaluate(() => {
    const chart = state.oscillationChart.getOption();
    return {
      seriesNames: chart.series.map(series => series.name).filter(Boolean),
      heatmapNames: chart.series.filter(series => series.type === "heatmap").map(series => series.name),
      labels: chart.series
        .filter(series => /Aİ|Üİ|LBV|UBV/.test(series.name || ""))
        .flatMap(series => series.markArea?.data?.map(item => item?.[0]?.name).filter(Boolean) || []),
      visualPieces: chart.visualMap?.[0]?.pieces?.map(piece => piece.label) || []
    };
  });
  assert(option.seriesNames.some(name => /Aİ \/ Alt Bant İhlali|LBV \/ Lower Band Violation/.test(name)));
  assert(option.seriesNames.some(name => /Üİ \/ Üst Bant İhlali|UBV \/ Upper Band Violation/.test(name)));
  assert(option.heatmapNames.some(name => /Bant İhlali Isı Haritası|Band Violation Heatmap/.test(name)));
  assert(option.labels.every(label => label === "Aİ" || label === "Üİ" || label === "LBV" || label === "UBV"));
  assert(option.visualPieces.some(label => String(label).includes("100")));

  const heatmapProbe = await page.evaluate(() => {
    const chart = state.oscillationChart;
    const option = chart.getOption();
    const tooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
    const formatter = tooltip?.formatter;
    const heatmapIndex = (option.series || []).findIndex(series => series.type === "heatmap" && /Bant|Band/.test(series.name || ""));
    const heatmapSeries = option.series[heatmapIndex];
    const dataIndex = (heatmapSeries?.data || []).findIndex(point => Array.isArray(point) && point[2] >= 0);
    const point = dataIndex >= 0 ? heatmapSeries.data[dataIndex] : null;
    const realTooltip = typeof formatter === "function" && point
      ? formatter({ seriesType: "heatmap", seriesName: heatmapSeries.name, value: point, data: point })
      : "";
    const malformedTooltip = typeof formatter === "function"
      ? formatter({ seriesType: "heatmap", seriesName: heatmapSeries?.name || "x", value: { bad: true }, data: { bad: true } })
      : "";
    if (point) showBandViolationDetailWindow(state.analysis.lastResult, point[3], point[4]);
    return {
      heatmapIndex,
      dataIndex,
      realTooltip,
      malformedTooltip,
      resetVisible: !document.querySelector("#qualityZoomResetBtn").hidden,
      zoomSeries: chart.getOption().series.some(series => String(series.name || "").includes("1s"))
    };
  });
  assert(heatmapProbe.heatmapIndex >= 0 && heatmapProbe.dataIndex >= 0);
  assert(/Bant İhlali Isı Haritası|Band Violation Heatmap/.test(heatmapProbe.realTooltip));
  assert.equal(typeof heatmapProbe.malformedTooltip, "string");
  assert.equal(heatmapProbe.resetVisible, true);
  assert.equal(heatmapProbe.zoomSeries, true);
  await page.locator("#qualityZoomResetBtn").click();
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn").hidden);

  await page.locator("#analysisEventsBody tr.event-row").first().click();
  await page.waitForFunction(() => !document.querySelector("#qualityZoomResetBtn").hidden);
  const zoomed = await page.evaluate(() => {
    const chart = state.oscillationChart.getOption();
    return chart.series.some(series => String(series.name || "").includes("1s"));
  });
  assert.equal(zoomed, true);

  await page.locator("#qualityZoomResetBtn").click();
  await page.waitForFunction(() => document.querySelector("#qualityZoomResetBtn").hidden);

  await page.locator("#analysisResultCards .analysis-result-card").filter({ hasText: "En Uzun" }).click();
  await page.waitForFunction(() => !document.querySelector("#qualityZoomResetBtn").hidden);
  await page.locator("#qualityZoomResetBtn").click();

  await page.locator("#analysisInfoToggle").click();
  await page.waitForSelector("#analysisInfoPanel:not(.hidden)");
  const helpText = await page.locator("#analysisInfoPanel").textContent();
  assert(/Bant İhlali|eşik|ihlal|Band Violation|threshold/i.test(helpText || ""));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#analysisInfoPanel")?.classList.contains("hidden"));

  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 820 });
    await wait(150);
    const hasHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    assert.equal(hasHorizontalScroll, false, `${width}px viewport should not create page horizontal scroll.`);
  }

  const runMatrix = await page.evaluate(async series => {
    const originalPrepare = window.prepareDailyContext || prepareDailyContext;
    const buildCurrent = date => {
      const offset = date.endsWith("02") ? 40 : 0;
      const tr = series.tr.map((value, index) => Number.isFinite(value) && index >= 100 && index < 145 ? value - offset * 0.000001 : value);
      const de = series.de.map((value, index) => Number.isFinite(value) && index >= 700 && index < 716 ? value + offset * 0.000001 : value);
      for (let index = 1600; index < 1620; index += 1) {
        tr[index] = 49.875 + (index - 1600) * 0.00001;
        de[index] = 49.876 + (index - 1600) * 0.00001;
      }
      return {
        date,
        rawSeries: { tr, de },
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
          document.querySelector("#analysisSourceSelect").value = source;
          document.querySelector("#analysisTypeSelect").value = "events";
          document.querySelector("#analysisDateMode").value = mode;
          document.querySelector("#analysisDateSelect").value = "2026-01-02";
          document.querySelector("#analysisStartDate").value = "2026-01-01";
          document.querySelector("#analysisEndDate").value = "2026-01-02";
          document.querySelector("#statsBandMinHz").value = "49.90";
          document.querySelector("#statsBandMaxHz").value = "50.10";
          document.querySelector("#repeatedValueSeconds").value = "15";
          document.querySelector("#minDuration").value = "10";
          updateAnalysisAvailability();
          await runAnalysisLab();
          renderReportPreview();
          const chart = state.oscillationChart.getOption();
          const heatmap = chart.series.some(item => item.type === "heatmap" && /Bant|Band/.test(item.name || ""));
          outcomes.push({
            source,
            mode,
            status: document.querySelector("#analysisStatus")?.textContent || "",
            kind: state.analysis.lastResult?.chart?.kind,
            events: state.analysis.lastResult?.events?.length || 0,
            cards: document.querySelectorAll("#analysisResultCards .analysis-result-card").length,
            rows: document.querySelectorAll("#analysisEventsBody tr.event-row").length,
            heatmap,
            reportOk: /Toplam ihlal süresi|Total violation duration/.test(document.querySelector("#reportPreview")?.textContent || "")
          });
        }
      }
    } finally {
      prepareDailyContext = originalPrepare;
    }
    return outcomes;
  }, buildSeries());
  assert.equal(runMatrix.length, 8);
  for (const item of runMatrix) {
    assert(/Analiz tamamlandı|Analysis complete/.test(item.status), `Run did not complete: ${JSON.stringify(item)}`);
    assert.equal(item.kind, "bandViolation", `Wrong chart kind: ${JSON.stringify(item)}`);
    assert(item.events > 0, `No band events rendered: ${JSON.stringify(item)}`);
    assert.equal(item.cards, 4, `KPI cards missing: ${JSON.stringify(item)}`);
    assert(item.rows > 0, `Event rows missing: ${JSON.stringify(item)}`);
    assert.equal(item.heatmap, true, `Heatmap missing: ${JSON.stringify(item)}`);
    assert.equal(item.reportOk, true, `Report preview failed: ${JSON.stringify(item)}`);
  }
  assert.deepEqual(consoleIssues, []);

  console.log("Band violation Playwright checks passed.");
} finally {
  await browser?.close();
  server.kill();
}
