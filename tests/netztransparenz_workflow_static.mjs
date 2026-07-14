import { readFileSync, existsSync } from "node:fs";

const path = ".github/workflows/netztransparenz_daily_update.yml";
if (!existsSync(path)) {
  throw new Error("Missing Netztransparenz daily update workflow.");
}

const workflow = readFileSync(path, "utf8");

for (const snippet of [
  'cron: "30 4 * * *"',
  "workflow_dispatch:",
  "date_from:",
  "date_to:",
  "source:",
  "- auto",
  "- api",
  "- zip",
  "dry_run:",
  "contents: write",
  "issues: write",
  "actions: read",
  "group: netztransparenz-frequency-update",
  "NETZTRANSPARENZ_CLIENT_ID: ${{ secrets.NETZTRANSPARENZ_CLIENT_ID }}",
  "NETZTRANSPARENZ_CLIENT_SECRET: ${{ secrets.NETZTRANSPARENZ_CLIENT_SECRET }}",
  "gh secret list",
  "scripts/netztransparenz_client.py --check",
  "scripts/fetch_netztransparenz.py",
  "python -m pytest tests",
  "node tests/frontend_static_smoke.mjs",
  "node tests/readme_documentation_static.mjs",
  "python scripts/validate_frequency.py",
  "python scripts/build_site.py",
  "automation/netztransparenz-update",
  "Netztransparenz frekans veri güncelleme sorunu",
  "issues.listForRepo",
  "issues.createComment",
  "issues.update",
  "state: \"closed\"",
  "data: update Netztransparenz frequency through",
]) {
  if (!workflow.includes(snippet)) {
    throw new Error(`Netztransparenz workflow is missing: ${snippet}`);
  }
}

if (/client_secret:\s*["']?[^${\s-]/i.test(workflow) || /access_token:\s*["']?[^${\s-]/i.test(workflow)) {
  throw new Error("Workflow appears to contain a plaintext secret or token.");
}

if (workflow.indexOf("python -m pytest tests") > workflow.indexOf("git commit")) {
  throw new Error("Tests must run before committing data changes.");
}

if (!workflow.includes("Retry-After") || !workflow.includes("not_yet_published")) {
  throw new Error("Workflow must account for rate limiting and publication lag behavior.");
}

console.log("netztransparenz_workflow_static ok");
