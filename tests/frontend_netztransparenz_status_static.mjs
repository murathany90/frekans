import { readFileSync } from "node:fs";

const html = readFileSync("frekans_rapor_v1.html", "utf8");

for (const snippet of [
  "Automatic update",
  "Manual monthly import",
  "Otomatik g",
  "autoNetzStatus",
  "autoNetzSourceMethod",
  "autoNetzMissingDates",
  "Germany latest",
  "Source: {method}",
  "status.netztransparenz",
]) {
  if (!html.includes(snippet)) {
    throw new Error(`Missing Netztransparenz frontend status marker: ${snippet}`);
  }
}

for (const forbidden of [
  "NETZTRANSPARENZ_CLIENT_SECRET",
  "NETZTRANSPARENZ_CLIENT_ID",
  "Authorization: Bearer",
  "client_secret",
  "access_token",
]) {
  if (html.includes(forbidden)) {
    throw new Error(`Frontend must not contain credential marker: ${forbidden}`);
  }
}

console.log("frontend_netztransparenz_status_static ok");
