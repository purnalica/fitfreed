import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  cleanupWdioSession,
  createTauriCapabilities,
  startWdioSession,
} from "@wdio/tauri-service";

import { openSettingsCategory } from "../e2e/support/application-actions.js";

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
const driverPort = Number(requiredEnvironment("FITFREED_UPDATE_E2E_DRIVER_PORT"));
const evidenceDirectory = path.dirname(evidencePath);

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
  throw new Error("Linux update recovery was not published");
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
  throw new Error(`Linux update recovery did not retain the ${expectedOutcome} outcome`);
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
  throw new Error("Terminal Linux update recovery cleanup did not converge");
}

function sqliteValues(libraryPath, statement) {
  return execFileSync("sqlite3", [libraryPath, statement], { encoding: "utf8" })
    .trim()
    .split("\n");
}

function installedVersion() {
  return execFileSync(
    "dpkg-query",
    ["--show", "--showformat=${Version}", "fitfreed"],
    { encoding: "utf8" },
  ).trim();
}

async function selectSpanish(browser) {
  const settings = await browser.$("aria/Settings");
  await settings.waitForEnabled({ timeout: 15_000 });
  await settings.click();
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

function applicationProcessIds() {
  return fs.readdirSync("/proc", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .filter((processId) => {
      try {
        const executable = fs.readlinkSync(`/proc/${processId}/exe`);
        const environment = fs.readFileSync(`/proc/${processId}/environ`);
        return executable.startsWith(applicationBinary)
          && environment.includes(Buffer.from(`FITFREED_E2E_DATABASE_PATH=${databasePath}`));
      } catch {
        return false;
      }
    });
}

async function stopApplication() {
  for (const processId of applicationProcessIds()) {
    try {
      process.kill(processId, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && applicationProcessIds().length > 0) {
    await delay(100);
  }
  if (applicationProcessIds().length > 0) {
    throw new Error("the installed Linux application did not stop");
  }
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
  const notice = await browser.$(".update-recovery-notice");
  const noticeText = await notice.getText();
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
      timeoutMsg: "the Linux update recovery outcome was not acknowledged",
    },
  );
  await notice.waitForDisplayed({ reverse: true, timeout: 15_000 });
}

async function verifyJourney(browser) {
  await openSettingsCategory("updates", browser);
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

  const publishedRecovery = waitForPublishedRecovery();
  await install.click();
  const recovery = await publishedRecovery;

  assert.equal(recovery.manifest.source.version, "0.1.0");
  assert.equal(recovery.manifest.target.version, "0.2.0");
  assert.equal(recovery.manifest.source.libraryPath, databasePath);
  assert.equal(recovery.manifest.platform.os, "linux");
  assert.equal(recovery.manifest.platform.architecture, "x86_64");
  assert.equal(recovery.manifest.platform.packageKind, "deb");
  assert.equal(recovery.manifest.platform.updateTarget, "linux-x86_64-deb");
  assert.equal(recovery.manifest.source.nativePackage.name, "fitfreed");
  assert.equal(recovery.manifest.source.nativePackage.architecture, "amd64");
  assert.equal(recovery.manifest.source.nativePackage.version, "0.1.0");
  assert.equal(recovery.manifest.source.nativePackage.executablePath, applicationBinary);
  assert.equal(
    fs.existsSync(path.join(recovery.attemptDirectory, "previous/package.deb")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(recovery.attemptDirectory, "previous/runnable/usr/bin/fitfreed")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(recovery.attemptDirectory, "candidate/package.deb")),
    true,
  );
  assert.deepEqual(
    sqliteValues(
      databasePath,
      "PRAGMA integrity_check; SELECT locale FROM application_preference WHERE id = 1;",
    ),
    ["ok", "es-ES"],
  );
  assert.deepEqual(
    sqliteValues(
      path.join(recovery.attemptDirectory, "previous/fitfreed.sqlite"),
      "PRAGMA integrity_check; SELECT locale FROM application_preference WHERE id = 1;",
    ),
    ["ok", "es-ES"],
  );
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
  return recovery;
}

async function main() {
  if (!Number.isSafeInteger(driverPort) || driverPort < 1_024 || driverPort > 65_535) {
    throw new Error("FITFREED_UPDATE_E2E_DRIVER_PORT must be a non-privileged TCP port");
  }
  if (!["updated", "recovered"].includes(expectedOutcome)) {
    throw new Error("FITFREED_UPDATE_E2E_EXPECTED_OUTCOME is invalid");
  }
  const expectedScenario = scenario === "success"
    ? { outcome: "updated", installedVersion: "0.2.0" }
    : ["candidate-failure", "installer-failure"].includes(scenario)
      ? { outcome: "recovered", installedVersion: "0.1.0" }
      : undefined;
  if (
    !expectedScenario
    || expectedOutcome !== expectedScenario.outcome
    || expectedInstalledVersion !== expectedScenario.installedVersion
  ) {
    throw new Error("The Linux update E2E scenario contract is invalid");
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
    const recovery = await verifyJourney(browser);
    await stopApplication();
    try {
      await cleanupWdioSession(browser);
    } catch {
      // Native replacement invalidates the original WebDriver session.
    }
    browser = await startWdioSession(capabilities, {
      rootDir: process.cwd(),
      logLevel: "warn",
    });
    await verifyRecoveryNotice(browser, recovery.recoveryId);
    const evidence = {
      scenario,
      outcome: expectedOutcome,
      installedVersion: installedVersion(),
      libraryIntegrity: sqliteValues(databasePath, "PRAGMA integrity_check;")[0],
      locale: sqliteValues(
        databasePath,
        "SELECT locale FROM application_preference WHERE id = 1;",
      )[0],
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
    if (browser && !journeyCompleted) await cleanupWdioSession(browser);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
