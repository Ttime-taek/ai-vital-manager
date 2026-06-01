#!/usr/bin/env node
/**
 * Next.js launcher. On Windows, "dev" runs in-shell to avoid double-spawn issues
 * (Ready → immediate exit 1) when wrapping `next dev` in an extra node child.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const runLog = path.join(root, ".gstack", "run-next.log");
const [command = "dev", ...rest] = process.argv.slice(2);
const args = [nextBin, command, ...rest];

function log(msg) {
  try {
    fs.mkdirSync(path.dirname(runLog), { recursive: true });
    fs.appendFileSync(runLog, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

function finalize(code, signal) {
  log(`child exit command=${command} code=${code} signal=${signal}`);
  if (signal) process.exit(1);
  process.exit(code === 0 || code === null ? 0 : code);
}

process.on("exit", (code) => {
  log(`parent exit code=${code}`);
});

process.on("uncaughtException", (err) => {
  log(`parent uncaughtException: ${err?.message ?? err}`);
});

process.on("unhandledRejection", (err) => {
  log(`parent unhandledRejection: ${err?.message ?? err}`);
});

log(`spawn direct args=${JSON.stringify(args)}`);
const child = spawn(process.execPath, args, {
  cwd: root,
  stdio: "inherit",
  env: process.env,
  windowsHide: false,
});
child.on("error", (err) => {
  log(`child error ${err?.message ?? err}`);
  console.error(err);
  process.exit(1);
});
child.on("exit", finalize);
