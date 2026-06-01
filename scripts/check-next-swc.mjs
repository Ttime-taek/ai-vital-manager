#!/usr/bin/env node
/**
 * Ensure the platform SWC binary is installed. next@14.2.35 often pins SWC to
 * 14.2.33 in optionalDependencies — versions need not match patch-for-patch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLATFORM_PKG = "@next/swc-win32-x64-msvc";
const PLATFORM_DIR = "swc-win32-x64-msvc";

function readJson(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const nextMeta = readJson("node_modules/next/package.json");
if (!nextMeta?.version) {
  console.error("check-next-swc: next is not installed. Run fix-deps.bat");
  process.exit(1);
}

const nextVer = nextMeta.version;
const expectedSwc =
  nextMeta.optionalDependencies?.[PLATFORM_PKG] ??
  process.env.EXPECTED_SWC_VERSION ??
  null;

const swcPkgPath = path.join(
  root,
  "node_modules",
  "@next",
  PLATFORM_DIR,
  "package.json",
);
if (!fs.existsSync(swcPkgPath)) {
  console.error(`check-next-swc: ${PLATFORM_PKG} missing. Run quick-fix-swc.bat`);
  process.exit(1);
}

const swcVer = JSON.parse(fs.readFileSync(swcPkgPath, "utf8")).version;
const nodePath = path.join(
  root,
  "node_modules",
  "@next",
  PLATFORM_DIR,
  "next-swc.win32-x64-msvc.node",
);

if (!fs.existsSync(nodePath)) {
  console.error(`check-next-swc: native binary missing at ${nodePath}`);
  console.error("Run quick-fix-swc.bat");
  process.exit(1);
}

if (expectedSwc && swcVer !== expectedSwc) {
  console.error(
    `check-next-swc: wrong SWC version — need ${PLATFORM_PKG}@${expectedSwc} (from next@${nextVer}), found @${swcVer}`,
  );
  console.error("Run quick-fix-swc.bat");
  process.exit(1);
}

console.log(
  `check-next-swc: ok (next@${nextVer}, ${PLATFORM_DIR}@${swcVer}${expectedSwc ? "" : ", no optionalDep pin"})`,
);
process.exit(0);
