import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for daily mobile compact tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const baseUrl = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts-daily-mobile";
mkdirSync(artifactDir, { recursive: true });

function testUrl() {
  const url = new URL(baseUrl);
  url.searchParams.set("lang", "en");
  return url.href;
}

function unexpectedConsoleErrors(errors) {
  return errors.filter(text => !/Failed to load resource: net::ERR_FAILED/i.test(text));
}

async function readMobileLayout(page) {
  return page.evaluate(() => {
    const visible = el => {
      if (!el) return false;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const rectFor = id => {
      const el = document.getElementById(id);
      if (!visible(el)) return null;
      const rect = el.getBoundingClientRect();
      return {
        id,
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    };
    const rowCount = boxes => {
      const rows = [];
      for (const box of boxes.filter(Boolean).sort((a, b) => a.top - b.top)) {
        const row = rows.find(value => Math.abs(value - box.top) <= 8);
        if (row === undefined) rows.push(box.top);
      }
      return rows.length;
    };
    const coverageCards = [...document.querySelectorAll("#coverageSummary .coverage-item")]
      .filter(visible)
      .map(card => ({
        label: card.querySelector(".label")?.textContent?.trim() || "",
        value: card.querySelector(".value")?.textContent?.trim() || ""
      }));
    const kpiCards = [...document.querySelectorAll("#kpiGrid .kpi")]
      .filter(visible)
      .map(card => {
        const rect = card.getBoundingClientRect();
        return {
          label: card.querySelector(".label")?.textContent?.trim() || "",
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      });
    const compactControls = [
      "prevDayBtn",
      "calToggle",
      "nextDayBtn",
      "filterToggleBtn",
      "calculateBtn",
      "resetZoomBtn",
      "dataSourcesInfoBtn"
    ].map(rectFor);
    const firstRow = ["prevDayBtn", "calToggle", "nextDayBtn"].map(rectFor);
    const secondRow = ["filterToggleBtn", "calculateBtn", "resetZoomBtn", "dataSourcesInfoBtn"].map(rectFor);
    return {
      compactControls,
      firstRow,
      secondRow,
      controlRowCount: rowCount(compactControls),
      kpiRowCount: rowCount(kpiCards),
      kpiColumnCount: rowCount(kpiCards.map(card => ({ ...card, top: card.left }))),
      coverageCards,
      kpiCards,
      overflow: {
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth
      }
    };
  });
}

const browser = await chromium.launch({ headless: true });

try {
  for (const width of [320, 360, 390, 430]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const consoleErrors = [];
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", error => consoleErrors.push(error.message));

    await page.goto(testUrl(), { waitUntil: "networkidle" });
    await page.waitForSelector("#coverageSummary .coverage-item");
    await page.waitForSelector("#kpiGrid .kpi");
    await page.waitForSelector("#dataSourcesInfoBtn");
    await page.evaluate(() => window.scrollTo(0, 0));

    const layout = await readMobileLayout(page);

    if (layout.overflow.document > 2 || layout.overflow.body > 2) {
      throw new Error(`Page must not overflow horizontally at ${width}px: ${JSON.stringify(layout.overflow)}`);
    }

    if (layout.controlRowCount !== 2) {
      throw new Error(`Daily controls must fit in two rows at ${width}px: ${JSON.stringify(layout.compactControls)}`);
    }
    if (layout.firstRow.some(box => !box) || layout.secondRow.some(box => !box)) {
      throw new Error(`All daily controls must remain visible at ${width}px: ${JSON.stringify(layout.compactControls)}`);
    }
    const firstTop = layout.firstRow[0].top;
    const secondTop = layout.secondRow[0].top;
    if (!layout.firstRow.every(box => Math.abs(box.top - firstTop) <= 8) || !layout.secondRow.every(box => Math.abs(box.top - secondTop) <= 8) || secondTop <= firstTop) {
      throw new Error(`Daily controls are not aligned as date row plus action row at ${width}px: ${JSON.stringify(layout.compactControls)}`);
    }
    if (!layout.compactControls.every(box => box.height >= 39)) {
      throw new Error(`Daily control touch targets are too small at ${width}px: ${JSON.stringify(layout.compactControls)}`);
    }

    const coverageLabels = layout.coverageCards.map(card => card.label);
    if (coverageLabels.join("|") !== "View|Report date") {
      throw new Error(`Mobile coverage cards must only show view and report date at ${width}px: ${JSON.stringify(layout.coverageCards)}`);
    }

    const kpiLabels = layout.kpiCards.map(card => card.label);
    const expectedKpis = ["Turkey Mean", "ENTSO-E Mean", "Turkey Mean |Δf|", "ENTSO-E Mean |Δf|"];
    if (kpiLabels.join("|") !== expectedKpis.join("|")) {
      throw new Error(`Mobile KPI cards must only show the four mean cards at ${width}px: ${JSON.stringify(layout.kpiCards)}`);
    }
    if (layout.kpiCards.length !== 4 || layout.kpiRowCount !== 2 || layout.kpiColumnCount !== 2) {
      throw new Error(`Mobile KPI cards must render as a 2x2 grid at ${width}px: ${JSON.stringify(layout.kpiCards)}`);
    }
    if (layout.kpiCards.some(card => card.right > width + 1 || card.width < 80)) {
      throw new Error(`Mobile KPI cards overflow or become too narrow at ${width}px: ${JSON.stringify(layout.kpiCards)}`);
    }

    await page.click("#dataSourcesInfoBtn");
    await page.waitForSelector("#dataSourcesModal:not(.hidden)");
    const githubLinks = await page.locator('#dataSourcesModal .data-sources-links a[href*="github.com/murathany90/frekans"]').count();
    const modalText = await page.locator("#dataSourcesModal").textContent();
    if (githubLinks !== 0 || /GridFreq GitHub repository|GridFreq GitHub deposu/i.test(modalText || "")) {
      throw new Error("Data sources modal must not list the GridFreq GitHub repository as an official source link.");
    }
    await page.click("#dataSourcesCloseBtn");
    await page.waitForFunction(() => document.querySelector("#dataSourcesModal")?.classList.contains("hidden"));

    await page.click("#resetZoomBtn");
    await page.waitForSelector("#frequencyChart");

    const unexpected = unexpectedConsoleErrors(consoleErrors);
    if (unexpected.length) {
      throw new Error(`Console errors at ${width}px: ${unexpected.join(" | ")}`);
    }
    await page.screenshot({ path: `${artifactDir}/daily-mobile-${width}.png`, fullPage: false });
    await page.close();
  }

  console.log("frontend_daily_mobile_compact_playwright ok");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
