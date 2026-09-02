import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  createLinuxUpdatePolkitRule,
  createLinuxUpdateTransportGate,
  debianPackageVariantArguments,
  linuxInstallerFailureScript,
  linuxUpdateBuildArguments,
  linuxUpdateScenarioPlan,
  validateLinuxUpdateEvidence,
} from "./verify-packaged-linux-update.mjs";

test("makes an offline recovery retry fail if it reaches update transport", () => {
  const gate = createLinuxUpdateTransportGate();

  assert.equal(gate.allowRequest(), true);
  gate.close();
  gate.assertUnusedWhileClosed();
  assert.equal(gate.allowRequest(), false);
  assert.throws(() => gate.assertUnusedWhileClosed(), /transport while it was unavailable/);
  gate.open();
  assert.equal(gate.allowRequest(), true);
  gate.close();
  gate.assertUnusedWhileClosed();
});

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

test("covers replacement, package failures, and authorization recovery with exact Debian packages", () => {
  assert.deepEqual(linuxUpdateScenarioPlan(), [
    {
      name: "success",
      candidateVariant: "ordinary",
      initialAuthorization: "candidate-and-predecessor",
      expectedOutcome: "updated",
      expectedVersion: "0.2.0",
    },
    {
      name: "installer-failure",
      candidateVariant: "installer-failure",
      initialAuthorization: "candidate-and-predecessor",
      expectedOutcome: "recovered",
      expectedVersion: "0.1.0",
    },
    {
      name: "candidate-failure",
      candidateVariant: "ordinary",
      initialAuthorization: "candidate-and-predecessor",
      expectedOutcome: "recovered",
      expectedVersion: "0.1.0",
    },
    {
      name: "authorization-retry",
      candidateVariant: "ordinary",
      initialAuthorization: "candidate-only",
      expectedOutcome: "recovered",
      expectedVersion: "0.1.0",
    },
  ]);
});

test("builds the installer-failure candidate as a closed root-owned Debian variant", () => {
  assert.deepEqual(
    debianPackageVariantArguments(
      "/workspace/.artifacts/linux-update-e2e/variants/installer-failure/root",
      "/workspace/.artifacts/linux-update-e2e/packages/candidate-installer-failure.deb",
    ),
    [
      "--root-owner-group",
      "--build",
      "/workspace/.artifacts/linux-update-e2e/variants/installer-failure/root",
      "/workspace/.artifacts/linux-update-e2e/packages/candidate-installer-failure.deb",
    ],
  );
  assert.throws(
    () => debianPackageVariantArguments("relative", "/workspace/candidate.deb"),
    /absolute/,
  );
  assert.throws(
    () => debianPackageVariantArguments("/workspace/root", "relative.deb"),
    /absolute/,
  );
  assert.equal(
    linuxInstallerFailureScript(),
    "#!/bin/sh\nset -eu\nexit 42\n",
  );
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

  const candidateOnly = createLinuxUpdatePolkitRule({
    allowedRoot,
    user: "runner",
    allowedPackageRoles: ["candidate"],
  });
  assert.match(candidateOnly, /\/candidate\/package\[\.\]deb/);
  assert.doesNotMatch(candidateOnly, /previous/);
  assert.throws(
    () => createLinuxUpdatePolkitRule({
      allowedRoot,
      user: "runner",
      allowedPackageRoles: ["candidate", "candidate"],
    }),
    /roles/,
  );
  assert.throws(
    () => createLinuxUpdatePolkitRule({
      allowedRoot,
      user: "runner",
      allowedPackageRoles: ["unbounded"],
    }),
    /roles/,
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
  const installerFailure = {
    ...success,
    scenario: "installer-failure",
    outcome: "recovered",
    installedVersion: "0.1.0",
  };
  assert.deepEqual(validateLinuxUpdateEvidence(installerFailure), installerFailure);
  const authorizationRetry = {
    ...installerFailure,
    scenario: "authorization-retry",
  };
  assert.deepEqual(validateLinuxUpdateEvidence(authorizationRetry), authorizationRetry);

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
