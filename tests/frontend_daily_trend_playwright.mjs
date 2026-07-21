import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const port = 4213;
const url = `http://127.0.0.1:${port}/frekans_rapor_v1.html#/analysis`;
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-daily-trend";
mkdirSync(artifactDir, { recursive: true });

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startServer() {
  return spawn("python", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    stdio: ["ignore", "pipe", "pipe"]
  });
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

function makeDay(dayIndex, length = 3600) {
  return Array.from({ length }, (_, index) => {
    if (dayIndex === 1 && index >= 1800) return NaN;
    return 50 + dayIndex * 0.001 + 0.006 * Math.sin(2 * Math.PI * index / 900);
  });
}

const server = startServer();
let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => consoleErrors.push(error.message));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.FrequencyAnalysisCore && window.echarts && document.querySelector("#analysisTypeSelect"));

  const smoke = await page.evaluate(async ({ days }) => {
    const originalPrepare = prepareDailyContext;
    const dateMap = new Map([
      ["2026-04-01", days[0]],
      ["2026-04-02", days[1]],
      ["2026-04-03", days[2]]
    ]);
    prepareDailyContext = async date => {
      const tr = dateMap.get(date) || days[0];
      const de = tr.map(value => Number.isFinite(value) ? value + 0.0002 : NaN);
      return {
        date,
        rawSeries: { tr, de },
        displaySeries: { tr, de },
        analysisSeries: { tr, de },
        tr,
        de,
        overall: { pairedCount: tr.filter(Number.isFinite).length },
        metadata: { teias: { timezone: "Europe/Istanbul" } }
      };
    };
    const out = [];
    try {
      for (const language of ["tr", "en"]) {
        setLanguage(language);
        document.querySelector("#analysisTypeSelect").value = "trend";
        document.querySelector("#analysisSourceSelect").value = "tr";
        document.querySelector("#analysisDateMode").value = "range";
        document.querySelector("#analysisStartDate").value = "2026-04-01";
        document.querySelector("#analysisEndDate").value = "2026-04-03";
        document.querySelector("#analysisResolution").value = language === "tr" ? "15m" : "1h";
        updateAnalysisAvailability();
        updateAnalysisParameterPanel();
        await runAnalysisLab();
        await new Promise(resolve => setTimeout(resolve, 250));
        const result = state.analysis.lastResult;
        const option = state.oscillationChart.getOption();
        const captured = [];
        const originalDownload = window.downloadBlob;
        window.downloadBlob = (filename, content, mimeType) => captured.push({ filename, content, mimeType });
        try {
          exportAnalysisJson();
          exportAnalysisCsv();
        } finally {
          window.downloadBlob = originalDownload;
        }
        const json = JSON.parse(captured.find(item => item.filename === "analysis-result.json")?.content || "{}");
        const csv = captured.find(item => item.filename === "analysis-events.csv")?.content || "";
        const firstRow = document.querySelector("#analysisEventsBody tr.event-row");
        if (firstRow) firstRow.click();
        const zoomed = state.oscillationChart.getOption().dataZoom?.some(zoom => zoom.startValue !== undefined || zoom.endValue !== undefined) || false;
        const cardsTop = document.querySelector("#analysisResultCards")?.getBoundingClientRect().top ?? 0;
        const chartTop = document.querySelector("#oscChartWrapper")?.getBoundingClientRect().top ?? 0;
        const tableTop = document.querySelector("#analysisTableTitle")?.closest(".panel")?.getBoundingClientRect().top ?? 0;
        const histogramSeries = (option.series || []).find(series => /Histogram|Dağılım/.test(series.name || ""));
        out.push({
          language,
          title: result.title,
          cardsBeforeChart: cardsTop <= chartTop,
          chartBeforeTable: chartTop <= tableTop,
          chartTitle: option.title?.[0]?.text || option.title?.text || "",
          secondaryTitle: option.title?.[1]?.text || "",
          yAxisCount: Array.isArray(option.yAxis) ? option.yAxis.length : 1,
          yAxisNames: (Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis]).map(axis => axis?.name || ""),
          series: (option.series || []).map(series => ({ name: series.name || "", yAxisIndex: series.yAxisIndex || 0 })),
          seriesNames: (option.series || []).map(series => series.name || ""),
          histogramMarkerLabelPositions: (histogramSeries?.markLine?.data || []).map(item => item?.label?.position || ""),
          headers: [...document.querySelectorAll("#analysisEventsHead th")].map(th => th.textContent.trim()),
          rowCount: document.querySelectorAll("#analysisEventsBody tr.event-row").length,
          detailCount: document.querySelectorAll("#analysisEventsBody .analysis-row-detail").length,
          zoomed,
          text: document.querySelector("#analysisLab")?.innerText || "",
          jsonParameters: json.metadata?.parameters?.dailyTrend || {},
          jsonDailyCount: json.dailyStats?.length || 0,
          jsonTrendSlope: json.dailyTrend?.trendSlopesMhzPerDay?.mean,
          histogramTotalPercent: json.histogram?.totalPercent,
          csv,
          downloads: captured.map(item => item.filename)
        });
      }
      return out;
    } finally {
      prepareDailyContext = originalPrepare;
    }
  }, { days: [makeDay(0), makeDay(1), makeDay(2)] });

  assert.equal(smoke.length, 2);
  for (const item of smoke) {
    assert.equal(item.cardsBeforeChart, true, "KPI cards must render before the chart.");
    assert.equal(item.chartBeforeTable, true, "The chart must render before daily result rows.");
    assert.match(item.title, item.language === "tr" ? /Günlük Frekans ve Trend Analizi/ : /Daily Frequency and Trend Analysis/);
    assert.match(item.chartTitle, item.language === "tr" ? /Frekans Zaman Serisi ve Min–Maks Zarfı/ : /Frequency Time Series and Min–Max Envelope/);
    assert.match(item.secondaryTitle, item.language === "tr" ? /Frekans Dağılımı/ : /Frequency Distribution/);
    assert.ok(item.yAxisNames[0]?.includes("Hz"), "The time-series grid must use one Hz axis.");
    for (const expected of ["Mean", "Maximum", "Minimum"]) {
      assert.ok(item.seriesNames.some(name => new RegExp(expected, "i").test(name) || /Ortalama|Maksimum|Minimum/.test(name)), `Missing series: ${expected}`);
    }
    assert.ok(item.seriesNames.some(name => /Envelope|zarf/i.test(name)), "Min-max envelope series missing");
    assert.ok(item.seriesNames.some(name => /Histogram|Dağılım/.test(name)), "Histogram series missing");
    assert.ok(item.histogramMarkerLabelPositions.includes("insideEndTop"), "Mean histogram marker label should be separated from median.");
    assert.ok(item.histogramMarkerLabelPositions.includes("insideStartBottom"), "Median histogram marker label should be separated from mean.");
    const trendSeries = item.series.filter(series => /Mean|Maximum|Minimum|Ortalama|Maksimum/.test(series.name));
    assert.ok(trendSeries.length >= 3, "Mean/min/max trend series are missing");
    assert.ok(trendSeries.every(series => series.yAxisIndex === 0), "Mean/min/max must share the same Hz axis.");
    assert.ok(item.headers.some(header => /Tarih|Date/.test(header)), "Date column missing");
    assert.ok(item.headers.some(header => /Maksimum|Maximum/.test(header)), "Maximum column missing");
    assert.ok(item.headers.some(header => /Kapsama|Coverage/.test(header)), "Coverage column missing");
    assert.equal(item.rowCount, 3);
    assert.ok(item.detailCount >= 3, "Expandable daily detail rows missing");
    assert.equal(item.zoomed, true, "Clicking a daily row should zoom the chart");
    assert.equal(item.jsonParameters.requestedResolution, item.language === "tr" ? "15m" : "1h");
    assert.equal(item.jsonDailyCount, 3);
    assert.ok(Number.isFinite(item.jsonTrendSlope), "JSON must include daily trend slopes.");
    assert.ok(Math.abs(item.histogramTotalPercent - 100) < 1e-6);
    assert.ok(item.csv.includes("requestedResolution"));
    assert.ok(item.csv.includes("meanTrendSlopeMhzPerDay"));
    assert.ok(item.csv.includes("histogram bins"));
    assert.ok(item.downloads.includes("analysis-result.json"));
    assert.ok(item.downloads.includes("analysis-events.csv"));
  }

  const cancellation = await page.evaluate(async ({ days }) => {
    const originalPrepare = prepareDailyContext;
    let calls = 0;
    prepareDailyContext = async date => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, calls === 1 ? 180 : 10));
      const tr = calls === 1 ? days[0] : days[2];
      return {
        date,
        rawSeries: { tr, de: tr },
        displaySeries: { tr, de: tr },
        analysisSeries: { tr, de: tr },
        tr,
        de: tr,
        overall: { pairedCount: tr.filter(Number.isFinite).length }
      };
    };
    try {
      setLanguage("en");
      document.querySelector("#analysisTypeSelect").value = "trend";
      document.querySelector("#analysisSourceSelect").value = "tr";
      document.querySelector("#analysisDateMode").value = "single";
      document.querySelector("#analysisDateSelect").value = "2026-04-01";
      document.querySelector("#analysisResolution").value = "1m";
      updateAnalysisParameterPanel();
      const first = runAnalysisLab();
      await new Promise(resolve => setTimeout(resolve, 30));
      cancelAnalysis();
      document.querySelector("#analysisDateSelect").value = "2026-04-03";
      const second = runAnalysisLab();
      await Promise.allSettled([first, second]);
      return {
        calls,
        running: state.analysis.running,
        type: state.analysis.lastResult?.type,
        date: state.current?.date,
        title: state.analysis.lastResult?.title || ""
      };
    } finally {
      prepareDailyContext = originalPrepare;
    }
  }, { days: [makeDay(0), makeDay(1), makeDay(2)] });
  assert.equal(cancellation.running, false);
  assert.equal(cancellation.type, "trend");
  assert.equal(cancellation.date, "2026-04-03");

  await page.setViewportSize({ width: 390, height: 840 });
  await wait(150);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 2, `Mobile horizontal overflow: ${overflow}`);
  assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join(" | ")}`);

  await page.screenshot({ path: `${artifactDir}/daily-trend.png`, fullPage: false });
  console.log("frontend_daily_trend_playwright ok");
} catch (error) {
  if (browser) {
    const pages = browser.contexts()[0]?.pages() || [];
    await pages[0]?.screenshot({ path: `${artifactDir}/daily-trend-failure.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
