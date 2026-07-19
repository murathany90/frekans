import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for hash routing tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const baseUrl = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-hash-routing";
mkdirSync(artifactDir, { recursive: true });

function appUrl(hash = "") {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = hash;
  return url.href;
}

async function waitForDailyDate(page, date) {
  await page.waitForFunction(expected => {
    const active = document.querySelector(".tab-button.active")?.dataset.tab;
    const value = document.querySelector("#dateSelect")?.value;
    return active === "tab-chart" && value === expected && !window.state?.dateLoading;
  }, date, { timeout: 30000 });
}

async function currentRouteState(page) {
  return page.evaluate(() => ({
    hash: window.location.hash,
    activeTab: document.querySelector(".tab-button.active")?.dataset.tab || "",
    dailyDate: document.querySelector("#dateSelect")?.value || "",
    analysisDate: document.querySelector("#analysisDateSelect")?.value || "",
    analysisType: document.querySelector("#analysisTypeSelect")?.value || "",
    source: document.querySelector("#analysisSourceSelect")?.value || "",
    resolution: document.querySelector("#analysisResolution")?.value || "",
    effectiveResolution: window.resolveAnalysisResolution?.(
      document.querySelector("#analysisTypeSelect")?.value || "stats",
      document.querySelector("#analysisResolution")?.value || "auto"
    ) || document.querySelector("#analysisResolution")?.value || "",
    lang: document.documentElement.getAttribute("data-current-lang") || "",
    legend: window.echarts?.getInstanceByDom(document.querySelector("#frequencyChart"))?.getOption?.()?.legend?.[0]?.selected || {},
    zoom: window.echarts?.getInstanceByDom(document.querySelector("#frequencyChart"))?.getOption?.()?.dataZoom?.[0] || {}
  }));
}

const browser = await chromium.launch({ headless: true });

try {
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const consoleErrors = [];
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", error => consoleErrors.push(error.message));

    await page.goto(appUrl("#/daily/2026-07-11?lang=en"), { waitUntil: "networkidle" });
    await waitForDailyDate(page, "2026-07-11");
    await page.waitForSelector("#frequencyChart canvas");
    let state = await currentRouteState(page);
    if (state.hash !== "#/daily/2026-07-11?lang=en" || state.lang !== "en") {
      throw new Error(`Daily route did not apply date/lang: ${JSON.stringify(state)}`);
    }

    await page.click('[data-tab="tab-oscillation"]');
    await page.waitForFunction(() => window.location.hash.startsWith("#/analysis/"));
    await page.selectOption("#analysisTypeSelect", "rocof");
    await page.waitForFunction(() => window.location.hash.startsWith("#/analysis/rocof"));
    await page.selectOption("#analysisSourceSelect", "tr");
    await page.locator("details.analysis-advanced-panel").evaluate(node => { node.open = true; });
    const resolutionHidden = await page.locator('[data-param-key="resolution"]').evaluate(node => node.hidden);
    if (!resolutionHidden) {
      throw new Error("RoCoF should hide the user-facing resolution selector and lock analysis to 1s.");
    }
    state = await currentRouteState(page);
    if (!/^#\/analysis\/rocof\?/.test(state.hash) || !state.hash.includes("source=turkiye") || !state.hash.includes("resolution=1s")) {
      throw new Error(`Analysis route did not serialize analysis/source/resolution: ${JSON.stringify(state)}`);
    }

    await page.click('[data-tab="tab-reports"]');
    await page.waitForFunction(() => window.location.hash.startsWith("#/reports"));
    await page.click('[data-tab="tab-settings"]');
    await page.waitForFunction(() => window.location.hash.startsWith("#/data"));
    await page.goBack();
    await page.waitForFunction(() => document.querySelector(".tab-button.active")?.dataset.tab === "tab-reports");
    await page.goBack();
    await page.waitForFunction(() => document.querySelector(".tab-button.active")?.dataset.tab === "tab-oscillation");
    state = await currentRouteState(page);
    if (state.analysisType !== "rocof" || state.source !== "tr" || state.effectiveResolution !== "1s") {
      throw new Error(`Back navigation did not restore analysis route: ${JSON.stringify(state)}`);
    }

    await page.evaluate(() => {
      const chart = window.echarts.getInstanceByDom(document.querySelector("#frequencyChart"));
      chart.dispatchAction({ type: "legendUnSelect", name: "Türkiye" });
      chart.dispatchAction({ type: "dataZoom", start: 25, end: 55 });
    });
    await page.click('[data-tab="tab-chart"]');
    await waitForDailyDate(page, "2026-07-11");
    state = await currentRouteState(page);
    if (state.legend["Türkiye"] !== false || Math.abs(Number(state.zoom.start) - 25) > 1 || Math.abs(Number(state.zoom.end) - 55) > 1) {
      throw new Error(`Route changes must preserve chart legend and zoom session state: ${JSON.stringify(state)}`);
    }

    if (consoleErrors.length) {
      throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
    }
    await page.screenshot({ path: `${artifactDir}/hash-routing-main.png`, fullPage: false });
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(appUrl("#/analysis/rocof?source=turkiye&resolution=1s&lang=en"), { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector(".tab-button.active")?.dataset.tab === "tab-oscillation");
    const state = await currentRouteState(page);
    if (state.analysisType !== "rocof" || state.source !== "tr" || state.effectiveResolution !== "1s" || state.lang !== "en") {
      throw new Error(`Direct analysis route did not apply selections: ${JSON.stringify(state)}`);
    }
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(appUrl("#/regions?country=TR"), { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector(".tab-button.active")?.dataset.tab === "tab-regions");
    const state = await currentRouteState(page);
    if (state.activeTab !== "tab-regions" || !state.hash.startsWith("#/regions")) {
      throw new Error(`Regions route did not activate regions tab: ${JSON.stringify(state)}`);
    }
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(appUrl("#/unknown/x"), { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.location.hash.startsWith("#/regions"));
    const state = await currentRouteState(page);
    if (state.activeTab !== "tab-regions") {
      throw new Error(`Invalid route must normalize to regions: ${JSON.stringify(state)}`);
    }
    await page.close();
  }

  console.log("frontend_hash_routing_playwright ok");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
