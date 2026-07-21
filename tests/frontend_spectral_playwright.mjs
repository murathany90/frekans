import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const port = 4207;

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
  const length = 4096;
  const values = Array.from({ length }, (_, index) => (
    50
    + 0.02 * Math.sin(2 * Math.PI * 0.12 * index)
    + 0.012 * Math.sin(2 * Math.PI * 0.18 * index)
    + offset
  ));
  for (let index = 600; index < 608; index += 1) values[index] = NaN;
  for (let index = 2200; index < 2224; index += 1) values[index] = NaN;
  return values;
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

  const checks = await page.evaluate(async ({ tr, de }) => {
    const makeCurrent = date => ({
      date,
      rawSeries: { tr, de },
      displaySeries: { tr, de },
      analysisSeries: { tr, de },
      tr,
      de,
      overall: { pairedCount: tr.length }
    });
    const outcomes = [];
    const forbidden = {
      tr: ["Zoom Sıfırla", "Window Quality", "Spectral Peaks"],
      en: ["Görünümü Sıfırla", "Pencere Kalitesi", "Spektral Tepeler"]
    };

    for (const language of ["tr", "en"]) {
      setLanguage(language);
      for (const type of ["psd", "spectrogram"]) {
        document.querySelector("#analysisTypeSelect").value = type;
        document.querySelector("#analysisSourceSelect").value = "tr";
        document.querySelector("#analysisDateMode").value = "single";
        document.querySelector("#analysisDateSelect").value = "2026-01-01";
        document.querySelector("#analysisStartDate").value = "2026-01-01";
        document.querySelector("#analysisEndDate").value = "2026-01-01";
        document.querySelector("#analysisResolution").value = "1s";
        document.querySelector("#bandMin").value = "0.05";
        document.querySelector("#bandMax").value = "0.25";
        document.querySelector("#windowSec").value = "300";
        document.querySelector("#stepSec").value = type === "psd" ? "128" : "64";
        updateAnalysisParameterPanel();
        renderAnalysisEmptyState(type);
        const emptyText = document.querySelector("#analysisTableDescription")?.textContent || "";
        state.current = makeCurrent("2026-01-01");
        const prepared = prepareAnalysisInput(type, "tr", state.current);
        state.analysis.sampling = prepared.sampling;
        const workerResult = type === "psd"
          ? FrequencyAnalysisCore.computeWelchPsd(prepared.series, workerAnalysisParameters(type))
          : FrequencyAnalysisCore.computeStftSpectrogram(prepared.series, workerAnalysisParameters(type));
        const result = computeAnalysisResult(type, "tr", state.current, ["2026-01-01"], workerResult, prepared);
        state.analysis.lastResult = result;
        renderAnalysisResult(result);
        renderReportPreview();
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
        const chart = state.oscillationChart.getOption();
        const text = [
          document.querySelector("#analysisLab")?.innerText || "",
          document.querySelector("#analysisDetailSummary")?.innerText || "",
          document.querySelector("#analysisEventsHead")?.innerText || "",
          document.querySelector("#analysisEventsBody")?.innerText || "",
          document.querySelector("#reportPreview")?.innerText || ""
        ].join("\n");
        const firstRow = document.querySelector("#analysisEventsBody tr.event-row");
        if (firstRow) firstRow.click();
        const zoomAfterRowClick = state.oscillationChart.getOption().dataZoom?.some(zoom => zoom.startValue !== undefined || zoom.endValue !== undefined) || false;
        outcomes.push({
          language,
          type,
          title: result.title,
          description: result.description,
          emptyText,
          tableTitle: document.querySelector("#analysisTableTitle")?.textContent || "",
          tableHeaders: [...document.querySelectorAll("#analysisEventsHead th")].map(th => th.textContent.trim()),
          cards: [...document.querySelectorAll("#analysisResultCards .analysis-result-card")].map(card => card.textContent.trim()),
          forbiddenHits: forbidden[language].filter(fragment => text.includes(fragment)),
          englishTurkishSecondHits: language === "en" ? [...text.matchAll(/\b\d+(?:[\.,]\d+)? sn\b/g)].map(match => match[0]) : [],
          requestedSegmentSeconds: json.metadata?.parameters?.spectral?.requestedSegmentSeconds,
          effectiveSegmentSamples: json.metadata?.parameters?.spectral?.effectiveSegmentSamples,
          fftLengthSamples: json.metadata?.parameters?.spectral?.fftLengthSamples,
          frequencyResolutionHz: json.metadata?.parameters?.spectral?.frequencyResolutionHz,
          units: json.metadata?.parameters?.spectral?.units,
          acceptedSegmentCount: json.metadata?.parameters?.spectral?.acceptedSegmentCount,
          rejectedSegmentCount: json.metadata?.parameters?.spectral?.rejectedSegmentCount,
          totalImputedSampleCount: json.metadata?.parameters?.spectral?.totalImputedSampleCount,
          csvHasRequestedSegment: csv.includes("requestedSegmentSeconds"),
          csvHasEffectiveSegment: csv.includes("effectiveSegmentSamples"),
          csvHasFftLength: csv.includes("fftLengthSamples"),
          csvHasDbReference: csv.includes("dB re 1 Hz²/Hz"),
          csvHasQuality: csv.includes("totalImputedSampleCount"),
          downloads: captured.map(item => item.filename),
          seriesNames: chart.series?.map(series => series.name || "") || [],
          hasVisualMap: Boolean(chart.visualMap),
          tooltipText: chart.tooltip ? "configured" : "",
          zoomAfterRowClick
        });
      }
    }
    return outcomes;
  }, { tr: buildSeries(), de: buildSeries(0.0002) });

  assert.equal(checks.length, 4);
  for (const item of checks) {
    assert.equal(item.forbiddenHits.length, 0, `Localization leftovers: ${JSON.stringify(item)}`);
    assert.equal(item.englishTurkishSecondHits.length, 0, `English UI should not show Turkish second units: ${JSON.stringify(item)}`);
    assert.equal(item.requestedSegmentSeconds, 300, `Requested segment missing: ${JSON.stringify(item)}`);
    assert.equal(item.effectiveSegmentSamples, 300, `Effective segment missing: ${JSON.stringify(item)}`);
    assert.equal(item.fftLengthSamples, 512, `FFT length missing: ${JSON.stringify(item)}`);
    assert.equal(item.frequencyResolutionHz, 1 / 512, `Frequency resolution wrong: ${JSON.stringify(item)}`);
    assert(Number.isFinite(item.acceptedSegmentCount), `Accepted segment metadata missing: ${JSON.stringify(item)}`);
    assert(Number.isFinite(item.rejectedSegmentCount), `Rejected segment metadata missing: ${JSON.stringify(item)}`);
    assert(Number.isFinite(item.totalImputedSampleCount), `Imputation metadata missing: ${JSON.stringify(item)}`);
    assert(item.csvHasRequestedSegment && item.csvHasEffectiveSegment && item.csvHasFftLength && item.csvHasQuality, `CSV metadata missing: ${JSON.stringify(item)}`);
    assert(item.downloads.includes("analysis-result.json") && item.downloads.includes("analysis-events.csv"));
    assert(item.zoomAfterRowClick, `Table row should zoom chart: ${JSON.stringify(item)}`);
    if (item.type === "psd") {
      assert(/Welch|PSD/.test(item.title));
      assert(item.emptyText.includes(item.language === "tr" ? "güç spektral yoğunluğu" : "power spectral density"));
      assert(item.tableHeaders.some(header => /SNR|Gürültü|noise/i.test(header)));
      assert(item.seriesNames.some(name => /Peak|Tepe|Noise|Gürültü|95|Nyquist/i.test(name)));
    } else {
      assert(/Spektrogram|Spectrogram/.test(item.title));
      assert(item.emptyText.includes(item.language === "tr" ? "zaman içindeki değişimi" : "changes over time"));
      assert(item.tableHeaders.some(header => /Geçerli|Valid|Doldur|Imputed/i.test(header)));
      assert(item.hasVisualMap, "Spectrogram should show a color scale.");
      assert.equal(item.units, "dB re 1 Hz²/Hz", `Spectrogram unit metadata missing: ${JSON.stringify(item)}`);
      assert.equal(item.csvHasDbReference, true, `Spectrogram CSV dB reference missing: ${JSON.stringify(item)}`);
      assert(item.seriesNames.some(name => /Ridge|Sırt|Invalid|Geçersiz|Quality|Kalite/i.test(name)));
    }
  }

  const invalidMessage = await page.evaluate(() => {
    setLanguage("en");
    document.querySelector("#analysisTypeSelect").value = "psd";
    document.querySelector("#bandMin").value = "0.4";
    document.querySelector("#bandMax").value = "0.8";
    document.querySelector("#windowSec").value = "300";
    updateAnalysisParameterPanel();
    const current = {
      date: "2026-01-01",
      rawSeries: { tr: new Float64Array(1024).fill(50), de: new Float64Array(1024).fill(50) },
      displaySeries: { tr: new Float64Array(1024).fill(50), de: new Float64Array(1024).fill(50) },
      analysisSeries: { tr: new Float64Array(1024).fill(50), de: new Float64Array(1024).fill(50) },
      tr: new Float64Array(1024).fill(50),
      de: new Float64Array(1024).fill(50),
      overall: { pairedCount: 1024 }
    };
    state.current = current;
    try {
      const prepared = prepareAnalysisInput("psd", "tr", current);
      computeAnalysisResult("psd", "tr", current, ["2026-01-01"], null, prepared);
    } catch (error) {
      return error?.message || String(error);
    }
    return "";
  });
  assert.match(invalidMessage, /Nyquist|maxHz|frequency/i);

  const cancellation = await page.evaluate(async ({ tr, de }) => {
    const originalPrepare = prepareDailyContext;
    let calls = 0;
    const buildCurrent = date => ({ date, rawSeries: { tr, de }, displaySeries: { tr, de }, analysisSeries: { tr, de }, tr, de, overall: { pairedCount: tr.length } });
    prepareDailyContext = async () => {
      calls += 1;
      const call = calls;
      await new Promise(resolve => setTimeout(resolve, call === 1 ? 180 : 10));
      return buildCurrent(call === 1 ? "2026-01-01" : "2026-01-02");
    };
    try {
      setLanguage("en");
      document.querySelector("#analysisTypeSelect").value = "spectrogram";
      document.querySelector("#analysisSourceSelect").value = "tr";
      document.querySelector("#analysisDateMode").value = "single";
      document.querySelector("#bandMin").value = "0.05";
      document.querySelector("#bandMax").value = "0.25";
      document.querySelector("#windowSec").value = "300";
      document.querySelector("#stepSec").value = "64";
      updateAnalysisParameterPanel();
      const first = runAnalysisLab();
      await new Promise(resolve => setTimeout(resolve, 30));
      cancelAnalysis();
      document.querySelector("#analysisTypeSelect").value = "psd";
      const second = runAnalysisLab();
      await Promise.allSettled([first, second]);
      return {
        calls,
        running: state.analysis.running,
        resultType: state.analysis.lastResult?.type,
        lastDate: state.current?.date,
        status: document.querySelector("#analysisStatus")?.textContent || ""
      };
    } finally {
      prepareDailyContext = originalPrepare;
    }
  }, { tr: buildSeries(), de: buildSeries(0.0002) });
  assert.equal(cancellation.calls, 2);
  assert.equal(cancellation.running, false);
  assert.equal(cancellation.resultType, "psd");
  assert.equal(cancellation.lastDate, "2026-01-02");

  await page.setViewportSize({ width: 390, height: 820 });
  await wait(150);
  const mobileOk = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  assert.equal(mobileOk, true, "Spectral analysis mobile view should not create page horizontal scroll.");

  assert.deepEqual(consoleIssues, []);
  console.log("frontend_spectral_playwright ok");
} finally {
  await browser?.close();
  server.kill();
}
