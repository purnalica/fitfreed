import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createLinuxUpdatePolkitRule,
  linuxUpdateBuildArguments,
  linuxUpdateScenarioPlan,
  validateLinuxUpdateEvidence,
} from "./verify-packaged-linux-update.mjs";

test("builds only an instrumented Debian package from the closed Linux overlays", () => {
  assert.deepEqual(
    linuxUpdateBuildArguments("/workspace/.artifacts/linux-update-e2e/build.json"),
    [
      "build",
      "--features",
      "e2e",
      "--bundles",
      "deb",
      "--config",
      "src-tauri/tauri.e2e.conf.json",
      "--config",
      "src-tauri/tauri.linux.conf.json",
      "--config",
      "/workspace/.artifacts/linux-update-e2e/build.json",
      "--ignore-version-mismatches",
    ],
  );
  assert.throws(() => linuxUpdateBuildArguments("relative.json"), /absolute/);
});

test("covers replacement and native predecessor restoration with exact Debian packages", () => {
  assert.deepEqual(linuxUpdateScenarioPlan(), [
    { name: "success", expectedOutcome: "updated", expectedVersion: "0.2.0" },
    { name: "candidate-failure", expectedOutcome: "recovered", expectedVersion: "0.1.0" },
  ]);
});

test("limits unattended Polkit authority to recovery packages under one isolated root", () => {
  const allowedRoot = "/workspace/.artifacts/linux-update-e2e/scenarios";
  const rule = createLinuxUpdatePolkitRule({ allowedRoot, user: "runner" });

  assert.match(rule, /subject\.user === "runner"/);
  assert.match(rule, /action\.lookup\("program"\) === "\/usr\/bin\/dpkg"/);
  assert.match(rule, /commandLine\.startsWith\("\/usr\/bin\/dpkg --install \/workspace/);
  assert.match(rule, /\(candidate\|previous\)\/package\[\.\]deb/);
  assert.doesNotMatch(rule, /action\.id[^\n]+return polkit\.Result\.YES/);
  assert.throws(
    () => createLinuxUpdatePolkitRule({ allowedRoot: "relative", user: "runner" }),
    /absolute/,
  );
  assert.throws(
    () => createLinuxUpdatePolkitRule({ allowedRoot, user: "runner\" || true" }),
    /user/,
  );
});

test("accepts only closed privacy-safe Linux update evidence", () => {
  const success = {
    scenario: "success",
    outcome: "updated",
    installedVersion: "0.2.0",
    libraryIntegrity: "ok",
    locale: "es-ES",
    activeRecovery: false,
    retainedAttempt: false,
  };
  assert.deepEqual(validateLinuxUpdateEvidence(success), success);

  assert.throws(
    () => validateLinuxUpdateEvidence({ ...success, installedVersion: "0.1.0" }),
    /evidence/,
  );
  assert.throws(
    () => validateLinuxUpdateEvidence({ ...success, recoveryId: "private" }),
    /fields/,
  );
  assert.throws(
    () => validateLinuxUpdateEvidence({ ...success, scenario: path.sep }),
    /evidence/,
  );
});

test("registers the native Linux update campaign in project automation", () => {
  const packageJson = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
  const workflow = readFileSync(path.resolve(".github/workflows/ci.yml"), "utf8");

  assert.equal(
    packageJson.scripts["verify:linux-update-e2e"],
    "node scripts/verify-packaged-linux-update.mjs",
  );
  assert.match(workflow, /packaged-linux-update-e2e:/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /xvfb-run -a npm run verify:linux-update-e2e/);
  assert.match(workflow, /\.artifacts\/linux-update-e2e\/evidence/);
});
