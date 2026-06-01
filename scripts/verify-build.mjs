import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

const r = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
  timeout: 600000,
  env: { ...process.env, FORCE_COLOR: "0" },
});

const log = [
  `node: ${process.version}`,
  `exit: ${r.status}`,
  r.error ? `spawn error: ${r.error.message}` : "",
  "--- stdout ---",
  r.stdout ?? "",
  "--- stderr ---",
  r.stderr ?? "",
].join("\n");

const outPath = path.join(root, ".gstack", "verify-build.log");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, log);
process.stdout.write(log.slice(-12000));
process.exit(r.status ?? 1);
