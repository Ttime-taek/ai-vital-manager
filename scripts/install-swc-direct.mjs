#!/usr/bin/env node
/**
 * Install @next/swc-win32-x64-msvc via curl.exe + tar.exe (no npm install).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import https from "node:https";

const PLATFORM_PKG = "@next/swc-win32-x64-msvc";
const PLATFORM_DIR = "swc-win32-x64-msvc";
/** npm registry tarball size for @14.2.33 (bytes). */
const EXPECTED_TGZ_BYTES = 41_491_235;
const MIN_TGZ_BYTES = EXPECTED_TGZ_BYTES - 64 * 1024;

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const gstack = path.join(root, ".gstack");
const targetDir = path.join(root, "node_modules", "@next", PLATFORM_DIR);

function log(msg) {
  const line = `[install-swc-direct] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.mkdirSync(gstack, { recursive: true });
    fs.appendFileSync(path.join(gstack, "swc-fix.log"), line);
  } catch {}
}

function readNextSwcVersion() {
  const nextPkg = path.join(root, "node_modules", "next", "package.json");
  if (!fs.existsSync(nextPkg)) return null;
  const next = JSON.parse(fs.readFileSync(nextPkg, "utf8"));
  return next.optionalDependencies?.[PLATFORM_PKG] ?? null;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
          res.headers.location
        ) {
          res.resume();
          fetchJson(res.headers.location).then(resolve, reject);
          return;
        }
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => {
          body += c;
        });
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(`HTTP ${res.statusCode} for ${url}: ${body.slice(0, 200)}`),
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function formatMb(n) {
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function isValidTgz(filePath) {
  const size = fs.statSync(filePath).size;
  if (size < MIN_TGZ_BYTES) return false;
  const r = spawnSync("tar.exe", ["-tzf", filePath, "package/package.json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return r.status === 0;
}

function downloadWithCurl(url, dest) {
  if (fs.existsSync(dest)) {
    const size = fs.statSync(dest).size;
    if (isValidTgz(dest)) {
      log(`using valid tarball (${formatMb(size)})`);
      return;
    }
    log(`removing invalid tarball (${formatMb(size)}, need ~${formatMb(EXPECTED_TGZ_BYTES)})`);
    fs.rmSync(dest, { force: true });
  }

  log(`downloading ~${formatMb(EXPECTED_TGZ_BYTES)} — wait 30-90 sec, do not close window`);

  const args = [
    "-fSL",
    "--retry",
    "8",
    "--retry-delay",
    "5",
    "--connect-timeout",
    "60",
    "-o",
    dest,
    url,
  ];

  const r = spawnSync("curl.exe", args, { stdio: ["ignore", "ignore", "pipe"] });
  const errText = r.stderr?.toString?.() ?? "";
  if (r.error) {
    throw new Error(`curl spawn failed: ${r.error.message}`);
  }
  if (r.status !== 0) {
    throw new Error(
      `curl exited ${r.status}${errText ? `: ${errText.trim().slice(0, 300)}` : ""}`,
    );
  }

  if (!isValidTgz(dest)) {
    const size = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
    fs.rmSync(dest, { force: true });
    throw new Error(
      `download corrupt or incomplete (${formatMb(size)}). Run quick-fix-swc.bat again.`,
    );
  }
  log(`download ok (${formatMb(fs.statSync(dest).size)})`);
}

async function resolveVersion(requested) {
  if (requested) return requested;
  const fromNext = readNextSwcVersion();
  if (fromNext) {
    log(`using version from next optionalDependencies: ${fromNext}`);
    return fromNext;
  }
  return "14.2.33";
}

async function main() {
  fs.mkdirSync(gstack, { recursive: true });
  const version = await resolveVersion(process.argv[2]);
  const tarball = `https://registry.npmjs.org/${PLATFORM_PKG}/-/${PLATFORM_DIR}-${version}.tgz`;
  log(`tarball url ${tarball}`);

  const tgzPath = path.join(gstack, `swc-win32-x64-msvc-${version}.tgz`);
  log(`tarball ${tgzPath}`);

  log("before downloadWithCurl");
  downloadWithCurl(tarball, tgzPath);
  log("after downloadWithCurl");

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(path.join(root, "node_modules", "@next"), { recursive: true });
  fs.mkdirSync(targetDir, { recursive: true });

  log(`extracting into ${targetDir}`);
  const tar = spawnSync(
    "tar.exe",
    ["-xzf", tgzPath, "-C", targetDir, "--strip-components=1"],
    { encoding: "utf8" },
  );
  if (tar.status !== 0) {
    const detail = (tar.stderr || tar.stdout || "").trim();
    throw new Error(`tar.exe exited ${tar.status}${detail ? `: ${detail}` : ""}`);
  }

  const native = path.join(targetDir, "next-swc.win32-x64-msvc.node");
  if (!fs.existsSync(native)) {
    throw new Error(`missing ${native} after extract`);
  }

  const installed = JSON.parse(
    fs.readFileSync(path.join(targetDir, "package.json"), "utf8"),
  );
  log(`installed ${installed.name}@${installed.version}`);
}

process.on("SIGINT", () => {
  log("interrupted — run quick-fix-swc.bat again");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT: ${err?.message ?? err}`);
});

process.on("unhandledRejection", (err) => {
  log(`UNHANDLED: ${err?.message ?? err}`);
});

main().catch((err) => {
  log(`FAILED: ${err?.message ?? err}`);
  console.error(`[install-swc-direct] failed: ${err.message}`);
  process.exit(1);
});
