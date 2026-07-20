import { readFileSync, existsSync } from "node:fs";

const dailyWorkflow = readFileSync(".github/workflows/teias_daily_update.yml", "utf8");
const deployWorkflow = readFileSync(".github/workflows/deploy_pages.yml", "utf8");

const requiredDailySnippets = [
  'cron: "15,45 7-15 * * *"',
  "python scripts/fetch_teias.py --lookback-days 21 --catch-up-published --catch-up-days 45 --discovery-retries 5 --discovery-timeout 90 --discovery-delay 3 --download-retries 5 --download-timeout 180",
  "automation/teias-update",
  "TEİAŞ veri güncelleme sorunu",
  "issues.listForRepo",
  "issues.createComment",
  "issues.update",
  "state: \"closed\"",
  "if: failure()",
  "if: success()",
  "data/status.json",
  "retryCount",
  "Workflow run"
];

for (const snippet of requiredDailySnippets) {
  if (!dailyWorkflow.includes(snippet)) {
    throw new Error(`TEIAS workflow is missing required issue/status behavior: ${snippet}`);
  }
}

if (/TEIAS daily update failed: \$\{new Date\(\)\.toISOString\(\)\}/.test(dailyWorkflow)) {
  throw new Error("TEIAS workflow still creates a new timestamped failure issue title.");
}

if (!existsSync(".github/workflows/frontend_tests.yml")) {
  throw new Error("Missing mandatory frontend Playwright workflow.");
}

for (const snippet of [
  "workflow_run:",
  'workflows: ["TEIAS Daily Frequency Update", "Netztransparenz Daily Frequency Update"]',
  "types: [completed]",
  "github.event.workflow_run.conclusion == 'success'",
]) {
  if (!deployWorkflow.includes(snippet)) {
    throw new Error(`Deploy workflow must publish successful automated data updates: ${snippet}`);
  }
}

const frontendWorkflow = readFileSync(".github/workflows/frontend_tests.yml", "utf8");
for (const snippet of ["npx playwright install --with-deps chromium", "node tests/frontend_smoke_playwright.mjs", "node tests/frontend_germany_only_daily_playwright.mjs", "node tests/frontend_initial_load_playwright.mjs", "node tests/frontend_prompt4_static.mjs", "node tests/frontend_prompt5_static.mjs", "node tests/frontend_prompt5_playwright.mjs", "node tests/frontend_prompt6_static.mjs", "node tests/frontend_public_sharing_static.mjs", "node tests/frontend_source_labels_static.mjs", "node tests/frontend_regions_static.mjs", "node tests/frontend_basic_stats_static.mjs", "node tests/frontend_basic_stats_playwright.mjs", "node tests/frequency_regions_time_deviation.mjs", "node tests/frontend_prompt6_playwright.mjs", "node tests/frontend_hash_routing_static.mjs", "node tests/frontend_hash_routing_playwright.mjs", "node tests/frontend_regions_playwright.mjs", "node tests/readme_documentation_static.mjs", "python -m http.server", "Wait for local HTTP server", "curl -fsS http://127.0.0.1:8080/frekans_rapor_v1.html"]) {
  if (!frontendWorkflow.includes(snippet)) {
    throw new Error(`Frontend workflow is missing: ${snippet}`);
  }
}

const playwrightSmoke = readFileSync("tests/frontend_smoke_playwright.mjs", "utf8");
if (playwrightSmoke.includes("SKIP: Playwright is not installed") || playwrightSmoke.includes("process.exit(0)")) {
  throw new Error("Playwright smoke must fail when Playwright is not installed; silent SKIP is forbidden.");
}

console.log("workflow_static_smoke ok");
