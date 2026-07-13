import { mkdirSync } from "node:fs";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (error) {
  console.error("Playwright is required for frontend smoke tests. Install it with: npm install --no-save playwright");
  console.error(error?.message || String(error));
  process.exit(1);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const artifactDir = process.env.PLAYWRIGHT_ARTIFACT_DIR || "playwright-artifacts";
mkdirSync(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", message => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", error => consoleErrors.push(error.message));

try {
  await page.context().tracing.start({ screenshots: true, snapshots: true });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#autoModeBadge", { state: "attached" });
  await page.waitForFunction(() => Boolean(document.querySelector("#dateSelect")?.value));
  await page.click('[data-tab="tab-chart"]');
  await page.click("#calculateBtn");
  await page.waitForFunction(() => document.querySelector("#reportDateTag")?.textContent !== "Tarih seçilmedi");
  await page.waitForSelector("#frequencyChart canvas");
  await page.click(".hour-header");
  await page.waitForFunction(() => document.querySelector("#chartViewTag")?.textContent.includes("3.600 saniye"));
  await page.dblclick(".hour-header");
  await page.waitForFunction(() => document.querySelector("#chartViewTag")?.textContent.includes("24 saat"));
  await page.click('[data-tab="tab-oscillation"]');
  await page.selectOption("#analysisSourceSelect", "de");
  const selected = await page.$eval("#analysisSourceSelect", el => el.value);
  if (selected !== "de") throw new Error("Oscillation source did not switch to Netztransparenz.");
  if (consoleErrors.length) {
    throw new Error(`Critical browser console errors:\n${consoleErrors.join("\n")}`);
  }
  console.log("frontend_smoke_playwright ok");
} catch (error) {
  await page.screenshot({ path: `${artifactDir}/failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally {
  await page.context().tracing.stop({ path: `${artifactDir}/trace.zip` }).catch(() => {});
  await browser.close();
}
