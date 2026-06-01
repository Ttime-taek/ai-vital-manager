import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const logPath = path.join(root, ".gstack", "build-run.log");

const r = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
  timeout: 600000,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
});

const body = [
  `node ${process.version}`,
  `exit ${r.status} signal ${r.signal}`,
  r.error ? `error ${r.error.message}` : "",
  "--- stdout ---",
  r.stdout ?? "",
  "--- stderr ---",
  r.stderr ?? "",
].join("\n");

fs.mkdirSync(path.dirname(logPath), { recursive: true });
fs.writeFileSync(logPath, body);
process.stdout.write(body.slice(-15000));
process.exit(r.status ?? 1);
