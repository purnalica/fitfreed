import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  linuxCleanInstallationCommand,
  ubuntuCleanInstallImage,
  verifyLinuxCleanInstallation,
} from "./verify-linux-clean-install.mjs";

const packagePath = path.resolve("synthetic/FitFreed_0.1.0_amd64.deb");

test("isolates the exact Debian package in a pinned clean Ubuntu 24.04 image", () => {
  const command = linuxCleanInstallationCommand({
    architecture: "x64",
    packagePath,
    platform: "linux",
    version: "0.1.0",
  });

  assert.equal(command.file, "docker");
  assert.deepEqual(command.arguments.slice(0, 5), [
    "run",
    "--rm",
    "--platform",
    "linux/amd64",
    "--mount",
  ]);
  assert.equal(command.arguments[5], [
    "type=bind",
    `source=${packagePath}`,
    "target=/candidate/FitFreed_0.1.0_amd64.deb",
    "readonly",
  ].join(","));
  assert.equal(command.arguments[6], ubuntuCleanInstallImage);
  const program = command.arguments.at(-1);
  assert.match(program, /for command_name in node npm cargo rustc git gcc/);
  assert.match(program, /apt-get -qq install -y --no-install-recommends/);
  assert.match(program, /dpkg-query/);
  assert.match(program, /ldd \/usr\/bin\/fitfreed/);
  assert.match(program, /apt-get -qq purge -y fitfreed/);
});

test("rejects another host, architecture, artifact identity, or unsafe version", () => {
  for (const options of [
    { platform: "darwin" },
    { architecture: "arm64" },
    { packagePath: path.resolve("synthetic/another.deb") },
    { version: "0.1.0; touch unexpected" },
  ]) {
    assert.throws(
      () => linuxCleanInstallationCommand({
        architecture: "x64",
        packagePath,
        platform: "linux",
        version: "0.1.0",
        ...options,
      }),
      /clean installation requires|Debian artifact name|invalid release version/,
    );
  }
});

test("returns only validated clean-installation evidence", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-clean-install-test-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  const exactPackage = path.join(directory, "FitFreed_0.1.0_amd64.deb");
  writeFileSync(exactPackage, "synthetic package");
  const expected = {
    distribution: "ubuntu",
    version: "24.04",
    architecture: "amd64",
    package: "fitfreed",
    removed: true,
  };

  const result = verifyLinuxCleanInstallation({
    architecture: "x64",
    packagePath: exactPackage,
    platform: "linux",
    run: () => ({ error: undefined, status: 0, stderr: "", stdout: JSON.stringify(expected) }),
    version: "0.1.0",
  });

  assert.deepEqual(result, expected);
});

test("reports a bounded phase and rejects malformed container evidence", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "fitfreed-clean-install-test-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  const exactPackage = path.join(directory, "FitFreed_0.1.0_amd64.deb");
  writeFileSync(exactPackage, "synthetic package");
  const base = {
    architecture: "x64",
    packagePath: exactPackage,
    platform: "linux",
    version: "0.1.0",
  };

  assert.throws(
    () => verifyLinuxCleanInstallation({
      ...base,
      run: () => ({ status: 17, stderr: "private detail\nFITFREED_PHASE=installation\n" }),
    }),
    /^Error: clean installation failed during installation$/,
  );
  assert.throws(
    () => verifyLinuxCleanInstallation({
      ...base,
      run: () => ({ error: undefined, status: 0, stderr: "", stdout: "not-json" }),
    }),
    /^Error: clean installation returned invalid evidence$/,
  );
});
