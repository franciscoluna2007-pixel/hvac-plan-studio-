import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { chromium } from "@playwright/test";

const port = 4174;
const url = `http://127.0.0.1:${port}/`;
const reportDir = path.resolve(".lighthouseci");
const reportPath = path.join(reportDir, "lighthouse-report.json");
const tempDir = path.join(reportDir, "tmp");

mkdirSync(tempDir, { recursive: true });
rmSync(reportPath, { force: true });

const environment = {
  ...process.env,
  TEMP: tempDir,
  TMP: tempDir,
  ...(process.platform === "win32" ? { NODE_OPTIONS: "--use-system-ca" } : {}),
};

const server = spawn(
  process.execPath,
  ["--use-system-ca", path.resolve("node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: "ignore", env: environment },
);
let auditBrowser;

async function waitForServer() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite exited before Lighthouse started (${server.exitCode}).`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Timed out waiting for the Lighthouse audit server.");
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      socket.close(() => resolve(address.port));
    });
  });
}

function runLighthouse(debuggingPort) {
  return new Promise((resolve, reject) => {
    const connectionArgs = debuggingPort
      ? [`--port=${debuggingPort}`, "--hostname=127.0.0.1"]
      : [
          "--chrome-flags=--headless=new --no-sandbox --disable-gpu --no-proxy-server --ignore-certificate-errors --disable-features=HttpsUpgrades",
        ];
    const audit = spawn(
      process.execPath,
      [
        path.resolve("node_modules/lighthouse/cli/index.js"),
        url,
        "--output=json",
        `--output-path=${reportPath}`,
        "--quiet",
        ...connectionArgs,
        "--only-categories=performance,accessibility,best-practices,seo",
        "--max-wait-for-load=30000",
        "--throttling-method=provided",
        "--disable-storage-reset",
      ],
      { stdio: "inherit", env: environment },
    );

    const timeout = setTimeout(() => {
      audit.kill();
      reject(new Error("Lighthouse timed out after 240 seconds."));
    }, 240_000);

    audit.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    audit.once("exit", (status) => {
      clearTimeout(timeout);
      resolve(status);
    });
  });
}

try {
  await waitForServer();
  await new Promise((resolve) => setTimeout(resolve, 1_000));

  let debuggingPort;
  if (process.platform === "win32") {
    debuggingPort = await reservePort();
    auditBrowser = await chromium.launch({
      channel: "chrome",
      headless: true,
      args: [`--remote-debugging-port=${debuggingPort}`, "--no-proxy-server", "--ignore-certificate-errors"],
    });
    const page = await auditBrowser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }

  const status = await runLighthouse(debuggingPort);

  const report = JSON.parse(readFileSync(reportPath, "utf8"));
  if (report.runtimeError) {
    throw new Error(`${report.runtimeError.code}: ${report.runtimeError.message}`);
  }

  const scores = Object.fromEntries(
    Object.entries(report.categories).map(([name, category]) => [name, Math.round(category.score * 100)]),
  );
  console.log("Lighthouse scores:", scores);

  const minimumScores = {
    performance: 35,
    accessibility: 80,
    // Start just below the measured legacy baseline, then tighten as the
    // existing console/source-map backlog is resolved.
    "best-practices": 70,
    seo: 75,
  };
  const failures = Object.entries(minimumScores).filter(([name, minimum]) => scores[name] < minimum);
  if (failures.length > 0) {
    throw new Error(
      `Lighthouse minimums failed: ${failures.map(([name, minimum]) => `${name} ${scores[name]} < ${minimum}`).join(", ")}`,
    );
  }

  if (status !== 0 && process.platform !== "win32") {
    throw new Error(`Lighthouse exited with status ${status}.`);
  }
} finally {
  await auditBrowser?.close();
  if (server.exitCode === null) server.kill();
}
