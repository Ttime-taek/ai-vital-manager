/**
 * Keep only @next/swc-win32-x64-msvc on Windows. Other platform packages are
 * optional npm stubs without package.json and break webpack's disk cache.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") {
  console.log("prune-swc-stubs: skip (non-Windows / Vercel Linux)");
  process.exit(0);
}

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = path.join(root, "node_modules", "@next");
const keep = "swc-win32-x64-msvc";

if (!fs.existsSync(nextDir)) {
  console.log("prune-swc-stubs: skip (no @next)");
  process.exit(0);
}

let removed = 0;
for (const name of fs.readdirSync(nextDir)) {
  if (!name.startsWith("swc-") || name === keep) continue;
  fs.rmSync(path.join(nextDir, name), { recursive: true, force: true });
  console.log("removed:", name);
  removed++;
}
const keepDir = path.join(nextDir, keep);
const keepExists = fs.existsSync(path.join(keepDir, "package.json"));
console.log(
  `prune-swc-stubs: ${removed} removed, ${keep} ${keepExists ? "present" : "MISSING"}`,
);
process.exit(0);
