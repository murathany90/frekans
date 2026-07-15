import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for chart state and tooltip tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const baseUrl = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-chart-state";
mkdirSync(artifactDir, { recursive: true });

function appUrl() {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", "en");
  return url.href;
}

async function chartState(page) {
  return page.evaluate(() => {
    const chart = window.echarts?.getInstanceByDom(document.querySelector("#frequencyChart"));
    const option = chart?.getOption?.() || {};
    const legend = option.legend?.[0] || {};
    const zoom = option.dataZoom?.[0] || {};
    return {
      legendSelected: legend.selected || {},
      legendData: legend.data || [],
      dataZoom: { start: zoom.start, end: zoom.end, startValue: zoom.startValue, endValue: zoom.endValue },
      viewText: document.querySelector("#coverageSummary .coverage-item .value")?.textContent?.trim() || "",
      diffPressed: document.querySelector('[data-layer="difference"]')?.getAttribute("aria-pressed"),
      minmaxPressed: document.querySelector('[data-layer="minmax"]')?.getAttribute("aria-pressed")
    };
  });
}

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth
  }));
  if (overflow.document > 2 || overflow.body > 2) {
    throw new Error(`${label} must not overflow horizontally: ${JSON.stringify(overflow)}`);
  }
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

    await page.goto(appUrl(), { waitUntil: "networkidle" });
    await page.waitForSelector("#frequencyChart canvas");
    await page.waitForSelector("#kpiGrid .kpi");

    const bodyText = await page.locator("body").evaluate(node => node.innerText);
    if (/\bTurkey\b/.test(bodyText)) {
      throw new Error("English UI must use Türkiye, not Turkey.");
    }

    await page.evaluate(() => {
      const chart = window.echarts.getInstanceByDom(document.querySelector("#frequencyChart"));
      chart.dispatchAction({ type: "legendUnSelect", name: "Türkiye" });
    });
    await page.click('.hour-header[data-hour="12"]');
    await page.waitForFunction(() => /3\.600|3,600/.test(document.querySelector("#coverageSummary .coverage-item .value")?.textContent || ""));
    let state = await chartState(page);
    if (state.legendSelected["Türkiye"] !== false || state.legendSelected["Continental Europe"] === false) {
      throw new Error(`Legend selection must survive hour view render: ${JSON.stringify(state)}`);
    }

    await page.evaluate(() => {
      const chart = window.echarts.getInstanceByDom(document.querySelector("#frequencyChart"));
      chart.dispatchAction({ type: "dataZoom", start: 20, end: 60 });
    });
    await page.click('.hour-header[data-hour="13"]');
    await page.waitForFunction(() => /13:00/.test(document.querySelector("#coverageSummary .coverage-item .value")?.textContent || ""));
    state = await chartState(page);
    if (Math.abs(Number(state.dataZoom.start) - 20) > 1 || Math.abs(Number(state.dataZoom.end) - 60) > 1) {
      throw new Error(`Zoom range must survive view changes: ${JSON.stringify(state)}`);
    }

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector("#frequencyChart canvas");
    await page.waitForSelector("#kpiGrid .kpi");
    state = await chartState(page);
    if (state.legendSelected["Türkiye"] !== false || state.legendSelected["Continental Europe"] === false) {
      throw new Error(`Legend selection must survive a session reload: ${JSON.stringify(state)}`);
    }
    if (Math.abs(Number(state.dataZoom.start) - 20) > 1 || Math.abs(Number(state.dataZoom.end) - 60) > 1) {
      throw new Error(`Zoom range must survive a session reload: ${JSON.stringify(state)}`);
    }

    await page.click("#resetZoomBtn");
    await page.waitForFunction(() => /24h|24 saat/i.test(document.querySelector("#coverageSummary .coverage-item .value")?.textContent || ""));
    state = await chartState(page);
    if (state.legendSelected["Türkiye"] === false || state.legendSelected["Continental Europe"] === false || state.diffPressed !== "false" || state.minmaxPressed !== "false") {
      throw new Error(`Reset must restore default chart layers: ${JSON.stringify(state)}`);
    }
    if (Math.abs(Number(state.dataZoom.start || 0)) > 1 || Math.abs(Number(state.dataZoom.end || 100) - 100) > 1) {
      throw new Error(`Reset must restore full zoom: ${JSON.stringify(state)}`);
    }

    const kpiTooltips = await page.$$eval("#kpiGrid .kpi", cards => cards.map(card => ({
      label: card.querySelector(".label")?.textContent?.trim() || "",
      tooltip: card.getAttribute("data-tooltip") || "",
      tabindex: card.getAttribute("tabindex")
    })));
    for (const label of ["Bias", "MAE", "Correlation", "Paired Data"]) {
      const card = kpiTooltips.find(item => item.label === label);
      if (!card?.tooltip || !/Hz|mHz|correlation|ratio|paired|unitless|percent|share/i.test(card.tooltip) || card.tabindex !== "0") {
        throw new Error(`KPI tooltip missing or incomplete for ${label}: ${JSON.stringify(kpiTooltips)}`);
      }
      if (card.tooltip.length > 96) {
        throw new Error(`KPI tooltip should stay short for ${label}: ${card.tooltip}`);
      }
    }

    const maeCard = page.locator("#kpiGrid .kpi", { hasText: "MAE" }).first();
    await maeCard.scrollIntoViewIfNeeded();
    await maeCard.focus();
    await page.waitForSelector("#appTooltip:not(.hidden)");
    const appTooltip = await page.locator("#appTooltip").evaluate(node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        text: node.textContent || "",
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        background: style.backgroundColor,
        color: style.color,
        zIndex: Number(style.zIndex || 0),
        pointerEvents: style.pointerEvents
      };
    });
    if (!/MAE|Mean absolute/i.test(appTooltip.text) || appTooltip.left < 8 || appTooltip.right > 1272 || appTooltip.width > 300 || appTooltip.zIndex < 3000 || appTooltip.pointerEvents !== "none") {
      throw new Error(`Unified app tooltip must be compact, high-layer and inside the viewport: ${JSON.stringify(appTooltip)}`);
    }
    if (!/rgb\((0|7|8|9|10|11|12|13|14|15|16)/.test(appTooltip.background) || !/rgb\(24[0-9]|rgb\(25[0-5]/.test(appTooltip.color)) {
      throw new Error(`Unified app tooltip must use high contrast colors: ${JSON.stringify(appTooltip)}`);
    }

    await page.hover('.hour-header[data-hour="12"]');
    await page.waitForSelector("#hourMatrixTooltip:not(.hidden)");
    const tooltipBox = await page.locator("#hourMatrixTooltip").boundingBox();
    const tooltipText = await page.locator("#hourMatrixTooltip").textContent();
    if (!tooltipBox || tooltipBox.width > 360 || !/12:00|13:00/.test(tooltipText || "")) {
      throw new Error(`Hour tooltip must be compact and readable: ${JSON.stringify({ tooltipBox, tooltipText })}`);
    }

    const metricTooltip = await page.locator(".metric-name", { hasText: "Bias" }).first().getAttribute("data-tooltip");
    if (!metricTooltip || !/hourly|mean difference|mHz/i.test(metricTooltip)) {
      throw new Error(`Hourly metric names must expose descriptive tooltip text: ${metricTooltip}`);
    }
    await page.focus(".metric-name:text-is('Bias')");
    await page.waitForSelector("#appTooltip:not(.hidden)");
    const metricTipState = await page.locator("#appTooltip").evaluate(node => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        text: node.textContent || "",
        width: rect.width,
        background: style.backgroundColor,
        color: style.color,
        zIndex: Number(style.zIndex || 0)
      };
    });
    if (!/Bias|mean difference|mHz/i.test(metricTipState.text) || metricTipState.width < 80 || metricTipState.zIndex < 3000) {
      throw new Error(`Hourly metric tooltip must render readable text in the shared tooltip: ${JSON.stringify(metricTipState)}`);
    }

    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    const modalShape = await page.evaluate(() => ({
      trRows: document.querySelectorAll("#dataSourcesTrCard dl > dt").length,
      euRows: document.querySelectorAll("#dataSourcesEuCard dl > dt").length,
      detailsOpen: document.querySelector("#dataSourcesSourceDetails") instanceof HTMLDetailsElement,
      cardText: document.querySelector(".data-sources-grid")?.textContent || ""
    }));
    if (modalShape.trRows > 6 || modalShape.euRows > 6 || !modalShape.detailsOpen || /It is not taken directly/.test(modalShape.cardText)) {
      throw new Error(`Data source cards must be compact and long text must move to details: ${JSON.stringify(modalShape)}`);
    }

    if (consoleErrors.length) {
      throw new Error(`Console errors: ${consoleErrors.join(" | ")}`);
    }
    await page.screenshot({ path: `${artifactDir}/desktop-chart-state.png`, fullPage: false });
    await page.close();
  }

  for (const width of [320, 360, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(appUrl(), { waitUntil: "networkidle" });
    await page.waitForSelector("#frequencyChart canvas");
    await assertNoHorizontalOverflow(page, `Daily page at ${width}px`);

    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    await assertNoHorizontalOverflow(page, `Data sources modal at ${width}px`);
    const modalText = await page.locator("#dataSourcesModal").textContent();
    if (/\bTurkey\b/.test(modalText || "")) {
      throw new Error(`Mobile English modal must use Türkiye, not Turkey at ${width}px.`);
    }
    await page.screenshot({ path: `${artifactDir}/mobile-${width}.png`, fullPage: false });
    await page.close();
  }

  console.log("frontend_chart_state_tooltips_playwright ok");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
