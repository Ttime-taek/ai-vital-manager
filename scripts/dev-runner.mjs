#!/usr/bin/env node
/**
 * Spawn next dev with stdio:inherit so Next keeps TTY expectations,
 * but still lets us record exit code/signal.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const port = process.argv[2] ?? "3000";

const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_IGNORE_INCORRECT_LOCKFILE: "1",
    WATCHPACK_POLLING: process.env.WATCHPACK_POLLING ?? "true",
    CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING ?? "true",
    NEXT_TELEMETRY_DISABLED: "1",
  },
  windowsHide: false,
});

child.on("exit", (code, signal) => {
  process.stdout.write(
    `\n[dev-runner] child exit code=${code} signal=${signal}\n`,
  );
});

child.on("error", (e) => {
  process.stderr.write(`[dev-runner] spawn error: ${e?.message ?? e}\n`);
});

