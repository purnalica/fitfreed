import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  cleanupWdioSession,
  createTauriCapabilities,
  startWdioSession,
} from "@wdio/tauri-service";

import { openSettingsCategory } from "../e2e/support/application-actions.js";
import {
  exactApplicationProcessId,
  parseExactApplicationProcessIds,
  applicationProcessTable,
} from "../e2e/support/application-process.js";

const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);

const scenario = requiredEnvironment("FITFREED_UPDATE_E2E_SCENARIO");
const expectedOutcome = requiredEnvironment("FITFREED_UPDATE_E2E_EXPECTED_OUTCOME");
const expectedInstalledVersion = requiredEnvironment("FITFREED_UPDATE_E2E_EXPECTED_VERSION");
const applicationBinary = requiredEnvironment("FITFREED_UPDATE_E2E_APPLICATION");
const databasePath = requiredEnvironment("FITFREED_E2E_DATABASE_PATH");
const recoveryRoot = requiredEnvironment("FITFREED_UPDATE_E2E_RECOVERY_ROOT");
const evidencePath = requiredEnvironment("FITFREED_UPDATE_E2E_EVIDENCE_PATH");
const packageScript = requiredEnvironment("FITFREED_UPDATE_E2E_PACKAGE_SCRIPT");
const driverPort = Number(requiredEnvironment("FITFREED_UPDATE_E2E_DRIVER_PORT"));
const evidenceDirectory = path.dirname(evidencePath);
const interruptionReady = process.env.FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_READY;
const interruptionContinue = process.env.FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_CONTINUE;

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

async function waitForPublishedRecovery() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      return activeRecovery();
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    await delay(25);
  }
  throw new Error("Windows update recovery was not published");
}

async function waitForRecoveryOutcome(recoveryId) {
  const outcomePath = path.join(recoveryRoot, "last-outcome.json");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const outcome = JSON.parse(fs.readFileSync(outcomePath, "utf8"));
      if (outcome.recoveryId === recoveryId && outcome.outcome === expectedOutcome) {
        return outcome;
      }
    } catch (error) {
      if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
    }
    await delay(100);
  }
  throw new Error(`Windows update recovery did not retain the ${expectedOutcome} outcome`);
}

async function waitForTerminalCleanup(recovery) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (
      !fs.existsSync(path.join(recoveryRoot, "active"))
      && !fs.existsSync(recovery.attemptDirectory)
    ) {
      return;
    }
    await delay(100);
  }
  throw new Error("Terminal Windows update recovery cleanup did not converge");
}

async function waitForMarker(markerPath, description) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(markerPath)) return;
    await delay(50);
  }
  throw new Error(`Windows update E2E did not ${description}`);
}

function installedVersion() {
  return execFileSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      packageScript,
      "-Action",
      "query",
    ],
    { encoding: "utf8" },
  ).trim();
}

function applicationProcessIds(executablePath) {
  return parseExactApplicationProcessIds(
    applicationProcessTable(executablePath),
    executablePath,
  );
}

async function stopApplication(executablePath) {
  for (const processId of applicationProcessIds(executablePath)) {
    spawnSync("taskkill.exe", ["/PID", String(processId), "/T", "/F"], {
      stdio: "ignore",
    });
  }
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && applicationProcessIds(executablePath).length > 0) {
    await delay(100);
  }
  if (applicationProcessIds(executablePath).length > 0) {
    throw new Error("the exact Windows application process did not stop");
  }
}

async function selectSpanish(browser) {
  await openSettingsCategory("appearance", browser);
  const select = await browser.$("#application-language");
  await select.waitForEnabled({ timeout: 15_000 });
  await browser.execute(() => {
    const element = document.querySelector("#application-language");
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
  const previewStatus = await (await browser.$(".settings-status")).getText();
  const save = await browser.$(`aria/${spanish.settings.save}`);
  await save.waitForEnabled({ timeout: 15_000 });
  await save.click();
  await browser.waitUntil(async () => {
    const status = await (await browser.$(".settings-status")).getText();
    const currentSave = await browser.$$(".settings-actions button[type='submit']");
    return status !== previewStatus && currentSave.length === 0;
  }, {
    timeout: 15_000,
    timeoutMsg: "the Spanish locale was not saved",
  });
}

async function readLocale(browser) {
  await openSettingsCategory("appearance", browser);
  const select = await browser.$("#application-language");
  await select.waitForEnabled({ timeout: 15_000 });
  return select.getValue();
}

async function verifyRecoveryNotice(browser, recoveryId) {
  const heading = await browser.$("#update-recovery-heading");
  await heading.waitForDisplayed({ timeout: 15_000 });
  assert.equal(
    await heading.getText(),
    expectedOutcome === "updated"
      ? spanish.updates.recovery.updatedHeading
      : spanish.updates.recovery.recoveredHeading,
  );
  const noticeText = await (await browser.$(".update-recovery-notice")).getText();
  assert.match(noticeText, /0\.1\.0/);
  assert.match(noticeText, /0\.2\.0/);
  assert.doesNotMatch(noticeText, new RegExp(recoveryId));
  const acknowledge = await browser.$(`aria/${spanish.updates.recovery.acknowledge}`);
  await acknowledge.waitForEnabled({ timeout: 15_000 });
  await acknowledge.click();
  await browser.waitUntil(
    () => !fs.existsSync(path.join(recoveryRoot, "last-outcome.json")),
    {
      timeout: 15_000,
      timeoutMsg: "the Windows update recovery outcome was not acknowledged",
    },
  );
}

function capabilitiesFor(executablePath) {
  const capabilities = createTauriCapabilities(executablePath, {
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
  return capabilities;
}

async function startSession(executablePath) {
  return startWdioSession(capabilitiesFor(executablePath), {
    rootDir: process.cwd(),
    logLevel: "warn",
  });
}

async function cleanupReplacedSession(browser) {
  try {
    await cleanupWdioSession(browser);
  } catch {
    // Native replacement invalidates the prior WebDriver session.
  }
}

function launchOrdinaryApplication(executablePath) {
  const environment = { ...process.env };
  delete environment.FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_READY;
  delete environment.FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_CONTINUE;
  const child = spawn(executablePath, [], {
    detached: true,
    env: environment,
    stdio: "ignore",
  });
  child.unref();
}

async function verifyJourney(browser) {
  await openSettingsCategory("updates", browser);
  const checkNow = await browser.$(".update-panel-heading button");
  await checkNow.waitForEnabled({ timeout: 15_000 });
  await checkNow.click();
  const available = await browser.$(".update-result-available");
  await available.waitForDisplayed({ timeout: 15_000 });
  assert.match(await available.getText(), /0\.2\.0/);
  await selectSpanish(browser);
  await openSettingsCategory("updates", browser);
  const install = await browser.$(`aria/${spanish.updates.install}`);
  await install.waitForEnabled({ timeout: 15_000 });

  const publishedRecovery = waitForPublishedRecovery();
  await install.click();
  const recovery = await publishedRecovery;
  assert.equal(recovery.manifest.source.version, "0.1.0");
  assert.equal(recovery.manifest.target.version, "0.2.0");
  assert.equal(recovery.manifest.source.libraryPath, databasePath);
  assert.deepEqual(recovery.manifest.platform, {
    os: "windows",
    architecture: "x86_64",
    packageKind: "nsis",
    installationScope: "current-user",
    updateTarget: "windows-x86_64-nsis",
  });
  assert.equal(recovery.manifest.source.nativePackage.productName, "FitFreed");
  assert.equal(recovery.manifest.source.nativePackage.version, "0.1.0");
  assert.equal(recovery.manifest.source.nativePackage.architecture, "x86_64");
  assert.equal(recovery.manifest.source.nativePackage.executablePath, applicationBinary);
  assert.equal(
    fs.existsSync(path.join(recovery.attemptDirectory, "previous/package.exe")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(recovery.attemptDirectory, "previous/runnable/fitfreed.exe")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(recovery.attemptDirectory, "candidate/package.exe")),
    true,
  );
  const backup = path.join(recovery.attemptDirectory, "previous/fitfreed.sqlite");
  assert.equal(fs.statSync(databasePath).size > 0, true);
  assert.equal(fs.statSync(backup).size > 0, true);
  return recovery;
}

async function interruptAndResume(recovery, browser) {
  await waitForMarker(interruptionReady, "reach the watchdog interruption point");
  const interrupted = activeRecovery();
  assert.equal(interrupted.recoveryId, recovery.recoveryId);
  assert.equal(interrupted.manifest.phase, "replacement-installed");
  assert.equal(installedVersion(), "0.2.0");
  const watchdogExecutable = path.join(
    recovery.attemptDirectory,
    "previous/runnable/fitfreed.exe",
  );
  exactApplicationProcessId(watchdogExecutable);
  await stopApplication(watchdogExecutable);
  await cleanupReplacedSession(browser);
  launchOrdinaryApplication(applicationBinary);
}

async function main() {
  if (!Number.isSafeInteger(driverPort) || driverPort < 1_024 || driverPort > 65_535) {
    throw new Error("FITFREED_UPDATE_E2E_DRIVER_PORT must be a non-privileged TCP port");
  }
  const expectedScenario = scenario === "success"
    ? { outcome: "updated", installedVersion: "0.2.0" }
    : ["candidate-failure", "installer-failure"].includes(scenario)
      ? { outcome: "recovered", installedVersion: "0.1.0" }
      : scenario === "restart-resumption"
        ? { outcome: "updated", installedVersion: "0.2.0" }
        : undefined;
  if (
    !expectedScenario
    || expectedOutcome !== expectedScenario.outcome
    || expectedInstalledVersion !== expectedScenario.installedVersion
    || (scenario === "restart-resumption") !== Boolean(interruptionReady)
    || Boolean(interruptionReady) !== Boolean(interruptionContinue)
  ) {
    throw new Error("The Windows update E2E scenario contract is invalid");
  }
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  let browser;
  let journeyCompleted = false;
  try {
    browser = await startSession(applicationBinary);
    const recovery = await verifyJourney(browser);
    if (scenario === "restart-resumption") {
      await interruptAndResume(recovery, browser);
      browser = undefined;
    }
    const outcome = await waitForRecoveryOutcome(recovery.recoveryId);
    assert.deepEqual(outcome, {
      format: "org.fitfreed.update-recovery-outcome",
      schemaVersion: 1,
      recoveryId: recovery.recoveryId,
      outcome: expectedOutcome,
      sourceVersion: "0.1.0",
      targetVersion: "0.2.0",
    });
    await waitForTerminalCleanup(recovery);
    assert.equal(installedVersion(), expectedInstalledVersion);
    if (browser) {
      await cleanupReplacedSession(browser);
      browser = undefined;
    }
    await stopApplication(applicationBinary);
    browser = await startSession(applicationBinary);
    await verifyRecoveryNotice(browser, recovery.recoveryId);
    const locale = await readLocale(browser);
    assert.equal(locale, "es-ES");
    const evidence = {
      scenario,
      outcome: expectedOutcome,
      installedVersion: installedVersion(),
      libraryState: fs.statSync(databasePath).size > 0 ? "locale-preserved" : "invalid",
      locale,
      activeRecovery: fs.existsSync(path.join(recoveryRoot, "active")),
      retainedAttempt: fs.existsSync(recovery.attemptDirectory),
    };
    fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
    await cleanupWdioSession(browser);
    browser = undefined;
    journeyCompleted = true;
  } catch (error) {
    if (browser) {
      try {
        await browser.saveScreenshot(path.join(evidenceDirectory, "failure.png"));
      } catch {
        // Replacement may already have invalidated the original session.
      }
    }
    throw error;
  } finally {
    if (browser && !journeyCompleted) await cleanupReplacedSession(browser);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
