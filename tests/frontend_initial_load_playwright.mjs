import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for prompt4 initial-load tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts";
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const requested = [];
const consoleErrors = [];

page.on("request", request => {
  const requestUrl = request.url();
  if (requestUrl.includes("/data/")) requested.push(requestUrl);
});
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => Boolean(state?.auto?.manifest?.sources?.teias?.availableDates?.length));
  await page.waitForFunction(() => !state?.dateLoading, { timeout: 20000 });

  const initialState = await page.evaluate(() => ({
    selectedDate: document.querySelector("#dateSelect")?.value,
    years: state.auto.manifest.years,
    loadedManifestYears: Array.from(state.auto.loadedManifestYears || []),
    loadedDays: Array.from(state.auto.loadedDays || []),
    teiasDays: state.auto.manifest.sources.teias.availableDates.length,
    netzDays: state.auto.manifest.sources.netztransparenz.availableDates.length
  }));
  const initialDataRequests = requested.filter(item => item.includes("/data/"));
  const initialShardRequests = initialDataRequests.filter(item => /\/data\/manifest\/20\d\d\.json/.test(item));
  const initialFrequencyRequests = initialDataRequests.filter(item => item.includes(".frequency.i16"));

  if (!initialState.loadedManifestYears.includes(Number(initialState.selectedDate.slice(0, 4)))) {
    throw new Error(`Selected year shard is not loaded: ${JSON.stringify(initialState)}`);
  }
  if (initialShardRequests.some(item => item.includes("/manifest/2025.json")) && !initialState.selectedDate.startsWith("2025")) {
    throw new Error(`2025 shard was fetched before a 2025 date was selected: ${JSON.stringify(initialShardRequests)}`);
  }
  if (initialFrequencyRequests.length > 4) {
    throw new Error(`Initial load fetched too many daily binary files: ${initialFrequencyRequests.length}`);
  }
  if (initialState.loadedDays.length > 4) {
    throw new Error(`Initial load materialized too many daily series: ${JSON.stringify(initialState.loadedDays)}`);
  }

  const has2025 = await page.evaluate(() => (
    state.auto.manifest.sources.teias.availableDates.some(date => date.startsWith("2025-")) ||
    state.auto.manifest.sources.netztransparenz.availableDates.some(date => date.startsWith("2025-"))
  ));
  if (has2025) {
    const first2025 = await page.evaluate(() => (
      [
        ...state.auto.manifest.sources.teias.availableDates,
        ...state.auto.manifest.sources.netztransparenz.availableDates
      ].filter(date => date.startsWith("2025-")).sort()[0]
    ));
    await page.evaluate(date => selectDate(date, { pushHistory: false, immediate: true }), first2025);
    await page.waitForFunction(() => state.auto.loadedManifestYears.has(2025), { timeout: 20000 });
    await page.waitForFunction(date => !state.dateLoading && document.querySelector("#dateSelect")?.value === date, first2025, { timeout: 20000 });
  }

  if (consoleErrors.length) {
    throw new Error(`Console errors during prompt4 initial-load test:\n${consoleErrors.join("\n")}`);
  }
  console.log("frontend_initial_load_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/prompt4-initial-load-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
