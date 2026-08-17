import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  cleanupWdioSession,
  createTauriCapabilities,
  startWdioSession,
} from "@wdio/tauri-service";

const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);

const scenario = requiredEnvironment("FITFREED_UPDATE_E2E_SCENARIO");
const applicationBinary = requiredEnvironment("FITFREED_UPDATE_E2E_APPLICATION");
const applicationPath = requiredEnvironment("FITFREED_UPDATE_E2E_APPLICATION_BUNDLE");
const databasePath = requiredEnvironment("FITFREED_E2E_DATABASE_PATH");
const recoveryRoot = requiredEnvironment("FITFREED_UPDATE_E2E_RECOVERY_ROOT");
const driverPort = Number(requiredEnvironment("FITFREED_UPDATE_E2E_DRIVER_PORT"));
const evidenceDirectory = path.resolve(".artifacts/update-e2e/evidence", scenario);
const expectedPhase = scenario === "success" ? "confirmed" : "recovered";
const expectedInstalledVersion = scenario === "success" ? "0.2.0" : "0.1.0";

if (scenario !== "success" && scenario !== "failure") {
  throw new Error("FITFREED_UPDATE_E2E_SCENARIO must be success or failure");
}

function requiredEnvironment(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function activeRecovery() {
  const recoveryId = fs.readFileSync(path.join(recoveryRoot, "active"), "utf8").trim();
  const attemptDirectory = path.join(recoveryRoot, "attempts", recoveryId);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(attemptDirectory, "manifest.json"), "utf8"),
  );
  return { recoveryId, attemptDirectory, manifest };
}

async function waitForRecoveryPhase(expected) {
  const deadline = Date.now() + 120_000;
  let observed = "not-published";
  while (Date.now() < deadline) {
    try {
      const recovery = activeRecovery();
      observed = recovery.manifest.phase;
      if (observed === expected) return recovery;
      if (observed === "recovery-failed") break;
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    await delay(250);
  }
  throw new Error(`update recovery did not reach ${expected}; last phase was ${observed}`);
}

function bundleVersion(bundlePath) {
  return execFileSync(
    "plutil",
    [
      "-extract",
      "CFBundleShortVersionString",
      "raw",
      "-o",
      "-",
      path.join(bundlePath, "Contents/Info.plist"),
    ],
    { encoding: "utf8" },
  ).trim();
}

function sqliteValues(libraryPath, statement) {
  return execFileSync("sqlite3", [libraryPath, statement], { encoding: "utf8" })
    .trim()
    .split("\n");
}

async function selectSpanish(browser) {
  const select = await browser.$("select");
  await select.waitForEnabled({ timeout: 15_000 });
  await browser.execute(() => {
    const element = document.querySelector("select");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    ).set;
    setValue.call(element, "es-ES");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await browser.waitUntil(async () => (await select.getValue()) === "es-ES", {
    timeout: 15_000,
    timeoutMsg: "the Spanish locale was not selected",
  });
}

async function verifyJourney(browser) {
  const heading = await browser.$("#update-heading");
  await heading.waitForDisplayed({ timeout: 15_000 });
  const checkNow = await browser.$(".update-panel-heading button");
  await checkNow.waitForEnabled({ timeout: 15_000 });
  await checkNow.click();
  const available = await browser.$(".update-result-available");
  await available.waitForDisplayed({ timeout: 15_000 });
  assert.match(await available.getText(), /0\.2\.0/);
  await selectSpanish(browser);
  const install = await browser.$(`aria/${spanish.updates.install}`);
  await install.waitForEnabled({ timeout: 15_000 });

  await install.click();
  const recovery = await waitForRecoveryPhase(expectedPhase);

  assert.equal(recovery.manifest.source.version, "0.1.0");
  assert.equal(recovery.manifest.target.version, "0.2.0");
  assert.equal(recovery.manifest.source.applicationPath, applicationPath);
  assert.equal(recovery.manifest.source.libraryPath, databasePath);
  assert.equal(bundleVersion(applicationPath), expectedInstalledVersion);
  assert.equal(
    bundleVersion(path.join(recovery.attemptDirectory, "previous/FitFreed.app")),
    "0.1.0",
  );
  assert.deepEqual(
    sqliteValues(
      databasePath,
      "PRAGMA integrity_check; SELECT locale FROM locale_preference WHERE id = 1;",
    ),
    ["ok", "es-ES"],
  );
  assert.deepEqual(
    sqliteValues(
      path.join(recovery.attemptDirectory, "previous/fitfreed.sqlite"),
      "PRAGMA integrity_check; SELECT locale FROM locale_preference WHERE id = 1;",
    ),
    ["ok", "es-ES"],
  );

  if (scenario === "failure") {
    const failedCandidate = path.join(
      path.dirname(applicationPath),
      `.FitFreed.app.fitfreed-recovery-${recovery.recoveryId}.failed`,
    );
    assert.equal(fs.existsSync(failedCandidate), true);
    assert.equal(bundleVersion(failedCandidate), "0.2.0");
  }
}

async function main() {
  if (!Number.isSafeInteger(driverPort) || driverPort < 1_024 || driverPort > 65_535) {
    throw new Error("FITFREED_UPDATE_E2E_DRIVER_PORT must be a non-privileged TCP port");
  }
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const capabilities = createTauriCapabilities(applicationBinary, {
    driverProvider: "embedded",
    tauriDriverPort: driverPort,
    logLevel: "warn",
    commandTimeout: 30_000,
    startTimeout: 60_000,
  });
  Object.assign(capabilities["wdio:tauriServiceOptions"], {
    captureBackendLogs: true,
    captureFrontendLogs: true,
    logDir: path.join(evidenceDirectory, "logs"),
  });
  let browser;
  let journeyCompleted = false;
  try {
    browser = await startWdioSession(capabilities, {
      rootDir: process.cwd(),
      logLevel: "warn",
    });
    await verifyJourney(browser);
    journeyCompleted = true;
  } catch (error) {
    if (browser) {
      try {
        await browser.saveScreenshot(path.join(evidenceDirectory, "failure.png"));
      } catch {
        // The expected application replacement may already have closed the original session.
      }
    }
    throw error;
  } finally {
    if (browser && !journeyCompleted) await cleanupWdioSession(browser);
  }
  process.stdout.write(`${JSON.stringify({ scenario, phase: expectedPhase, result: "passed" })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
