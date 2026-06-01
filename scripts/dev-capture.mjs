import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const logPath = path.join(root, ".gstack", "dev-run.log");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

fs.mkdirSync(path.dirname(logPath), { recursive: true });
const log = fs.createWriteStream(logPath, { flags: "w" });
const stamp = (msg) => log.write(`[${new Date().toISOString()}] ${msg}\n`);

stamp(`node ${process.version}`);
stamp(`cwd ${root}`);

const env = {
  ...process.env,
  WATCHPACK_POLLING: "true",
  CHOKIDAR_USEPOLLING: "true",
  NEXT_TELEMETRY_DISABLED: "1",
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--trace-uncaught", "--trace-warnings"]
    .filter(Boolean)
    .join(" "),
};

const child = spawn(process.execPath, [nextBin, "dev", "-p", "3000"], {
  cwd: root,
  env,
  windowsHide: true,
});

child.stdout.on("data", (d) => log.write(d));
child.stderr.on("data", (d) => log.write(d));
child.on("error", (e) => stamp(`spawn error: ${e}`));
child.on("exit", (code, signal) => {
  stamp(`exit code=${code} signal=${signal}`);
  log.end();
  process.exit(0);
});

setTimeout(() => {
  stamp("timeout — sending SIGTERM");
  child.kill("SIGTERM");
}, 25000);
