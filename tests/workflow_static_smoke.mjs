import { readFileSync, existsSync } from "node:fs";

const dailyWorkflow = readFileSync(".github/workflows/teias_daily_update.yml", "utf8");

const requiredDailySnippets = [
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

const frontendWorkflow = readFileSync(".github/workflows/frontend_tests.yml", "utf8");
for (const snippet of ["npx playwright install --with-deps chromium", "node tests/frontend_smoke_playwright.mjs", "node tests/frontend_germany_only_daily_playwright.mjs", "node tests/frontend_initial_load_playwright.mjs", "node tests/frontend_prompt4_static.mjs", "node tests/frontend_prompt5_static.mjs", "node tests/frontend_prompt5_playwright.mjs", "node tests/readme_documentation_static.mjs", "python -m http.server"]) {
  if (!frontendWorkflow.includes(snippet)) {
    throw new Error(`Frontend workflow is missing: ${snippet}`);
  }
}

const playwrightSmoke = readFileSync("tests/frontend_smoke_playwright.mjs", "utf8");
if (playwrightSmoke.includes("SKIP: Playwright is not installed") || playwrightSmoke.includes("process.exit(0)")) {
  throw new Error("Playwright smoke must fail when Playwright is not installed; silent SKIP is forbidden.");
}

console.log("workflow_static_smoke ok");
