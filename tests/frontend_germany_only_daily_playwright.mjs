import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for frontend smoke tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const baseUrl = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const targetDate = process.env.GERMANY_ONLY_DATE || "2026-07-11";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts";
mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
const dialogs = [];
const consoleErrors = [];

page.on("dialog", async dialog => {
  dialogs.push(dialog.message());
  await dialog.dismiss();
});
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

try {
  const url = new URL(baseUrl);
  url.searchParams.set("date", targetDate);
  url.searchParams.set("lang", "tr");
  url.searchParams.set("source", "tr");
  url.searchParams.set("analysis", "stats");
  url.searchParams.set("alignment", "utcAuto");
  url.searchParams.set("mode", "single");
  url.searchParams.set("tab", "chart");

  await page.goto(url.toString(), { waitUntil: "networkidle" });
  await page.waitForSelector("#frequencyChart", { state: "attached" });
  await page.click("#calculateBtn");
  await page.waitForTimeout(3000);

  if (dialogs.length) {
    throw new Error(`ENTSO-E-only daily date triggered blocking dialog: ${dialogs.join(" | ")}`);
  }

  await page.waitForFunction(
    date => state?.datePerf?.renderedDate === date && Boolean(state?.current),
    targetDate,
    { timeout: 20000 }
  );
  await page.waitForSelector("#frequencyChart canvas", { timeout: 15000 });

  const result = await page.evaluate(date => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#frequencyChart"));
    const seriesNames = (chart?.getOption()?.series || []).map(series => series.name || "");
    const countFinite = series => {
      let count = 0;
      for (let i = 0; i < series.length; i += 1) if (Number.isFinite(series[i])) count += 1;
      return count;
    };
    return {
      selectedDate: document.querySelector("#dateSelect")?.value,
      renderedDate: state.datePerf.renderedDate,
      reportDate: document.querySelector("#reportDateTag")?.textContent || "",
      hasTr: state.tr.has(date),
      hasDe: state.de.has(date),
      trFinite: countFinite(state.current.tr),
      deFinite: countFinite(state.current.de),
      countA: state.current.overall.countA,
      countB: state.current.overall.countB,
      pairedCount: state.current.overall.pairedCount,
      seriesNames
    };
  }, targetDate);

  if (result.selectedDate !== targetDate || result.renderedDate !== targetDate) {
    throw new Error(`ENTSO-E-only date did not render: ${JSON.stringify(result)}`);
  }
  if (!result.hasDe || result.deFinite < 80000 || result.countB < 80000) {
    throw new Error(`ENTSO-E series is not available on the daily page: ${JSON.stringify(result)}`);
  }
  if (result.hasTr || result.trFinite !== 0 || result.countA !== 0 || result.pairedCount !== 0) {
    throw new Error(`ENTSO-E-only daily page should keep missing Turkey data empty: ${JSON.stringify(result)}`);
  }
  if (!result.seriesNames.some(name => /ENTSO-E|Almanya|Germany/i.test(name))) {
    throw new Error(`ENTSO-E chart series is missing: ${JSON.stringify(result)}`);
  }
  if (consoleErrors.length) {
    throw new Error(`Console errors:\n${consoleErrors.join("\n")}`);
  }

  await page.screenshot({ path: `${artifactDir}/germany-only-daily.png`, fullPage: false });
  console.log("frontend_germany_only_daily_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/germany-only-daily-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
