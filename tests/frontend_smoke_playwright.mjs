let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("SKIP: Playwright is not installed in this environment.");
  process.exit(0);
}

const url = process.env.APP_URL || "http://127.0.0.1:8080/frekans_rapor_v1.html";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("#autoModeBadge");
  await page.waitForFunction(() => document.querySelector("#dateSelect")?.options.length > 1);
  await page.click('[data-tab="tab-chart"]');
  await page.click("#calculateBtn");
  await page.waitForFunction(() => document.querySelector("#reportDateTag")?.textContent !== "Tarih seçilmedi");
  await page.waitForSelector("#frequencyChart canvas");
  await page.click(".hour-header");
  await page.waitForFunction(() => document.querySelector("#chartViewTag")?.textContent.includes("saniyelik"));
  await page.dblclick(".hour-header");
  await page.waitForFunction(() => document.querySelector("#chartViewTag")?.textContent.includes("24 saat"));
  await page.click('[data-tab="tab-oscillation"]');
  await page.selectOption("#oscSourceSelect", "de");
  const selected = await page.$eval("#oscSourceSelect", el => el.value);
  if (selected !== "de") throw new Error("Oscillation source did not switch to Netztransparenz.");
  console.log("frontend_smoke_playwright ok");
} finally {
  await browser.close();
}
