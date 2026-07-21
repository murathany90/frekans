import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const port = 4211;

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

function buildOscillationSeries(kind = "ringdown") {
  const length = 2400;
  const values = new Array(length).fill(50);
  const start = 220;
  const freq = kind === "drift" ? 0.10 : 0.12;
  for (let index = start; index < 1000; index += 1) {
    const t = index - start;
    const localFreq = kind === "drift" ? 0.10 + 0.00005 * t : freq;
    const envelope = kind === "forced" ? 0.035 : 0.055 * Math.exp(-t / 520);
    values[index] += envelope * Math.sin(2 * Math.PI * localFreq * t);
  }
  for (let index = 1260; index < 1290; index += 1) values[index] = NaN;
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

  const smoke = await page.evaluate(({ ringdown, forced }) => {
    const makeCurrent = (date, tr, de = forced) => ({
      date,
      rawSeries: { tr, de },
      displaySeries: { tr, de },
      analysisSeries: { tr, de },
      tr,
      de,
      overall: { pairedCount: tr.length }
    });

    const outcomes = [];
    for (const language of ["tr", "en"]) {
      setLanguage(language);
      document.querySelector("#analysisTypeSelect").value = "oscillation";
      document.querySelector("#analysisSourceSelect").value = "tr";
      document.querySelector("#analysisDateMode").value = "single";
      document.querySelector("#analysisDateSelect").value = "2026-03-01";
      document.querySelector("#analysisStartDate").value = "2026-03-01";
      document.querySelector("#analysisEndDate").value = "2026-03-01";
      document.querySelector("#bandMin").value = "0.08";
      document.querySelector("#bandMax").value = "0.20";
      document.querySelector("#oscThreshold").value = "6";
      document.querySelector("#oscThresholdMode").value = language === "tr" ? "fixed" : "adaptive";
      document.querySelector("#minDuration").value = "20";
      document.querySelector("#filterTaps").value = "81";
      document.querySelector("#windowSec").value = "80";
      document.querySelector("#stepSec").value = "20";
      updateAnalysisAvailability();
      updateAnalysisParameterPanel();

      state.current = makeCurrent("2026-03-01", ringdown);
      const prepared = prepareAnalysisInput("oscillation", "tr", state.current);
      state.analysis.sampling = prepared.sampling;
      const workerResult = FrequencyAnalysisCore.computeOscillationCandidates(prepared.series, workerAnalysisParameters("oscillation"));
      const result = computeAnalysisResult("oscillation", "tr", state.current, ["2026-03-01"], workerResult, prepared);
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
      const firstRow = document.querySelector("#analysisEventsBody tr.event-row");
      if (firstRow) firstRow.click();
      const chartOption = state.oscillationChart.getOption();
      const text = [
        document.querySelector("#analysisLab")?.innerText || "",
        document.querySelector("#analysisResultCards")?.innerText || "",
        document.querySelector("#analysisEventsHead")?.innerText || "",
        document.querySelector("#analysisEventsBody")?.innerText || "",
        document.querySelector("#reportPreview")?.innerText || ""
      ].join("\n");
      const forbidden = language === "tr"
        ? ["Oscillation Candidate", "Classification", "Confidence score"]
        : ["Salınım Adayı", "Aday türü", "Aday güven skoru"];
      outcomes.push({
        language,
        title: result.title,
        tableTitle: document.querySelector("#analysisTableTitle")?.textContent || "",
        headers: [...document.querySelectorAll("#analysisEventsHead th")].map(th => th.textContent.trim()),
        candidateTypes: result.candidates.map(candidate => candidate.candidateType),
        localizedTypes: result.tableRows.map(row => row.classification),
        detailCount: document.querySelectorAll("#analysisEventsBody .analysis-row-detail").length,
        dampingPanelCount: document.querySelectorAll("#analysisEventsBody .oscillation-damping-panel").length,
        infoButtonCount: document.querySelectorAll(".metric-info-button, .metric-info-icon").length,
        seriesNames: chartOption.series?.map(series => series.name || "") || [],
        hasEnterThreshold: chartOption.series?.some(series => JSON.stringify(series.markLine || {}).includes(language === "tr" ? "Giriş" : "Enter")) || false,
        hasCandidateRegion: chartOption.series?.some(series => Array.isArray(series.markArea?.data) && series.markArea.data.length > 0) || false,
        zoomAfterRowClick: chartOption.dataZoom?.some(zoom => zoom.startValue !== undefined || zoom.endValue !== undefined) || false,
        forbiddenHits: forbidden.filter(fragment => text.includes(fragment)),
        rawEnumVisible: ["sustained_forced", "frequency_drifting", "indeterminate"].filter(fragment => text.includes(fragment)),
        jsonParameters: json.metadata?.parameters?.oscillation || {},
        thresholdModeControl: document.querySelector("#oscThresholdMode")?.value || "",
        jsonCandidate: json.candidates?.[0] || {},
        csv,
        downloads: captured.map(item => item.filename)
      });
    }
    return outcomes;
  }, { ringdown: buildOscillationSeries("ringdown"), forced: buildOscillationSeries("forced") });

  assert.equal(smoke.length, 2);
  for (const item of smoke) {
    assert.match(item.title, item.language === "tr" ? /Salınım Adayı Tespiti/ : /Oscillation Candidate Detection/);
    assert.match(item.tableTitle, item.language === "tr" ? /Salınım Adayı Tespiti/ : /Oscillation Candidate Detection/);
    assert(item.headers.some(header => /Tepe genliği|Peak amplitude/.test(header)), `Peak-amplitude column missing: ${JSON.stringify(item)}`);
    assert(item.headers.some(header => /RMS/.test(header)), `RMS column missing: ${JSON.stringify(item)}`);
    assert(item.headers.some(header => /Aday türü|Candidate type/.test(header)), `Candidate-type column missing: ${JSON.stringify(item)}`);
    assert(item.headers.some(header => /Damping oranı|Damping ratio/.test(header)), `Damping column missing: ${JSON.stringify(item)}`);
    assert(item.candidateTypes.includes("ringdown"), `Ringdown candidate missing: ${JSON.stringify(item)}`);
    assert(item.localizedTypes.every(label => !/^ringdown$|sustained_forced|frequency_drifting|^indeterminate$/i.test(label)), `Raw enum leaked into table: ${JSON.stringify(item)}`);
    assert(item.detailCount >= 1, `Expandable technical row missing: ${JSON.stringify(item)}`);
    assert(item.dampingPanelCount >= 1, `Damping panel missing for modal candidate: ${JSON.stringify(item)}`);
    assert(item.infoButtonCount >= 2, `Confidence/damping help icons missing: ${JSON.stringify(item)}`);
    assert(item.seriesNames.some(name => /bant|Band-pass/i.test(name)), `Band-pass chart layer missing: ${JSON.stringify(item)}`);
    assert(item.seriesNames.some(name => /zarf|Envelope/i.test(name)), `Envelope chart layer missing: ${JSON.stringify(item)}`);
    assert.equal(item.hasEnterThreshold, true, `Enter threshold line missing: ${JSON.stringify(item)}`);
    assert.equal(item.hasCandidateRegion, true, `Candidate region missing: ${JSON.stringify(item)}`);
    assert.equal(item.zoomAfterRowClick, true, `Table row should zoom chart: ${JSON.stringify(item)}`);
    assert.deepEqual(item.forbiddenHits, [], `Localization leftovers: ${JSON.stringify(item)}`);
    assert.deepEqual(item.rawEnumVisible, [], `Raw enum should not be visible: ${JSON.stringify(item)}`);
    assert.equal(item.jsonParameters.requestedFilterOrder, 80);
    assert.equal(item.jsonParameters.thresholdMode, item.thresholdModeControl);
    assert.equal(item.jsonParameters.effectiveFilterOrder, 80);
    assert.equal(item.jsonParameters.filterTapCount, 81);
    assert(Number.isFinite(item.jsonParameters.groupDelaySeconds));
    assert(Number.isFinite(item.jsonParameters.edgeDiscardSeconds));
    assert.equal(item.jsonParameters.minimumCycles, 3);
    assert.equal(item.jsonCandidate.candidateType, "ringdown");
    assert(item.jsonCandidate.confidenceComponents?.snrContribution >= 0);
    assert.equal(item.jsonCandidate.damping?.dampingStatus, "available");
    assert(item.csv.includes("requestedFilterOrder"));
    assert(item.csv.includes("effectiveFilterOrder"));
    assert(item.csv.includes("filterTapCount"));
    assert(item.csv.includes("minimumCycles"));
    assert(item.csv.includes("dampingMethod"));
    assert(item.downloads.includes("analysis-result.json"));
    assert(item.downloads.includes("analysis-events.csv"));
  }

  const forcedDamping = await page.evaluate(({ forced }) => {
    setLanguage("en");
    document.querySelector("#analysisTypeSelect").value = "oscillation";
    document.querySelector("#analysisSourceSelect").value = "tr";
    document.querySelector("#bandMin").value = "0.08";
    document.querySelector("#bandMax").value = "0.20";
    document.querySelector("#oscThreshold").value = "6";
    document.querySelector("#oscThresholdMode").value = "fixed";
    document.querySelector("#minDuration").value = "20";
    document.querySelector("#filterTaps").value = "81";
    document.querySelector("#windowSec").value = "80";
    document.querySelector("#stepSec").value = "20";
    updateAnalysisParameterPanel();
    state.current = {
      date: "2026-03-02",
      rawSeries: { tr: forced, de: forced },
      displaySeries: { tr: forced, de: forced },
      analysisSeries: { tr: forced, de: forced },
      tr: forced,
      de: forced,
      overall: { pairedCount: forced.length }
    };
    const prepared = prepareAnalysisInput("oscillation", "tr", state.current);
    const workerResult = FrequencyAnalysisCore.computeOscillationCandidates(prepared.series, workerAnalysisParameters("oscillation"));
    const result = computeAnalysisResult("oscillation", "tr", state.current, ["2026-03-02"], workerResult, prepared);
    state.analysis.lastResult = result;
    renderAnalysisResult(result);
    return {
      type: result.candidates[0]?.candidateType,
      status: result.candidates[0]?.damping?.dampingStatus,
      reason: result.candidates[0]?.damping?.dampingUnavailableReason,
      text: document.querySelector("#analysisEventsBody")?.innerText || ""
    };
  }, { forced: buildOscillationSeries("forced") });
  assert.equal(forcedDamping.type, "sustained_forced");
  assert.equal(forcedDamping.status, "unavailable");
  assert.equal(forcedDamping.reason, "continuous-forced-candidate");
  assert(/Not applicable|Damping not estimated/i.test(forcedDamping.text));

  const cancellation = await page.evaluate(async ({ ringdown, forced }) => {
    const originalPrepare = prepareDailyContext;
    let calls = 0;
    const makeCurrent = (date, tr) => ({ date, rawSeries: { tr, de: forced }, displaySeries: { tr, de: forced }, analysisSeries: { tr, de: forced }, tr, de: forced, overall: { pairedCount: tr.length } });
    prepareDailyContext = async () => {
      calls += 1;
      const call = calls;
      await new Promise(resolve => setTimeout(resolve, call === 1 ? 180 : 10));
      return makeCurrent(call === 1 ? "2026-03-03" : "2026-03-04", call === 1 ? forced : ringdown);
    };
    try {
      setLanguage("en");
      document.querySelector("#analysisTypeSelect").value = "oscillation";
      document.querySelector("#analysisSourceSelect").value = "tr";
      document.querySelector("#analysisDateMode").value = "single";
      document.querySelector("#bandMin").value = "0.08";
      document.querySelector("#bandMax").value = "0.20";
      document.querySelector("#oscThreshold").value = "6";
      document.querySelector("#oscThresholdMode").value = "fixed";
      document.querySelector("#minDuration").value = "20";
      document.querySelector("#filterTaps").value = "81";
      document.querySelector("#windowSec").value = "80";
      document.querySelector("#stepSec").value = "20";
      updateAnalysisParameterPanel();
      const first = runAnalysisLab();
      await new Promise(resolve => setTimeout(resolve, 30));
      cancelAnalysis();
      const second = runAnalysisLab();
      await Promise.allSettled([first, second]);
      return {
        calls,
        running: state.analysis.running,
        resultType: state.analysis.lastResult?.type,
        lastDate: state.current?.date,
        candidateType: state.analysis.lastResult?.candidates?.[0]?.candidateType,
        status: document.querySelector("#analysisStatus")?.textContent || ""
      };
    } finally {
      prepareDailyContext = originalPrepare;
    }
  }, { ringdown: buildOscillationSeries("ringdown"), forced: buildOscillationSeries("forced") });
  assert.equal(cancellation.calls, 2);
  assert.equal(cancellation.running, false);
  assert.equal(cancellation.resultType, "oscillation");
  assert.equal(cancellation.lastDate, "2026-03-04");
  assert.equal(cancellation.candidateType, "ringdown");

  await page.setViewportSize({ width: 390, height: 820 });
  await wait(150);
  const mobileOk = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  assert.equal(mobileOk, true, "Oscillation analysis mobile view should not create page horizontal scroll.");

  assert.deepEqual(consoleIssues, []);
  console.log("frontend_oscillation_playwright ok");
} finally {
  await browser?.close();
  server.kill();
}
