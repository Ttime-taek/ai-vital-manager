#!/usr/bin/env node
/** Run next dev; mirror stdout/stderr to console and .gstack/dev-live.log */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const logPath = path.join(root, ".gstack", "dev-live.log");
const port = process.argv[2] ?? "3000";

fs.mkdirSync(path.dirname(logPath), { recursive: true });
const log = fs.createWriteStream(logPath, { flags: "w" });
const write = (chunk) => {
  const s = chunk.toString();
  process.stdout.write(s);
  log.write(s);
};

const env = {
  ...process.env,
  WATCHPACK_POLLING: "true",
  CHOKIDAR_USEPOLLING: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};

const child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  cwd: root,
  env,
  stdio: ["inherit", "pipe", "pipe"],
  windowsHide: false,
});

child.stdout.on("data", write);
child.stderr.on("data", write);
child.on("error", (e) => write(`\nspawn error: ${e}\n`));
child.on("exit", (code, signal) => {
  write(`\n--- process exit code=${code} signal=${signal} ---\n`);
  log.end(() => {
    process.exit(code === 0 || code === null ? 0 : code);
  });
});
