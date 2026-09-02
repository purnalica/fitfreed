import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { linuxPackageBuildArguments } from "./build-linux-package.mjs";
import { validateLinuxPackageConfiguration } from "./linux-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const linuxConfig = JSON.parse(
  readFileSync(path.join(repositoryRoot, "src-tauri/tauri.linux.conf.json"), "utf8"),
);
const developmentEnvironmentCheck = readFileSync(
  path.join(repositoryRoot, "scripts/check-development-environment.sh"),
  "utf8",
);

test("keeps the first Linux package boundary and metadata closed", () => {
  assert.deepEqual(validateLinuxPackageConfiguration(linuxConfig), {
    architecture: "amd64",
    packageName: "fitfreed",
    target: "deb",
  });
  const invalid = structuredClone(linuxConfig);
  invalid.bundle.targets.push("appimage");
  invalid.bundle.fileAssociations = [{ ext: ["zip"] }];
  invalid.bundle.linux.deb.depends = ["unreviewed-library"];
  invalid.bundle.linux.deb.files = {};
  invalid.bundle.windows = {};
  invalid.plugins = {};
  assert.throws(
    () => validateLinuxPackageConfiguration(invalid),
    (error) => {
      assert.match(error.message, /only deb/);
      assert.match(error.message, /generic file association/);
      assert.match(error.message, /canonical GPL license destination/);
      assert.match(error.message, /unexpected fields: depends/);
      assert.match(error.message, /unexpected bundle fields: fileAssociations, windows/);
      assert.match(error.message, /unexpected top-level fields: plugins/);
      return true;
    },
  );
});

test("exposes a Linux-only production package command", () => {
  assert.equal(
    packageJson.scripts["package:linux"],
    "npm run icons && node scripts/build-linux-package.mjs",
  );
  assert.deepEqual(linuxPackageBuildArguments([], "linux"), ["--bundles", "deb"]);
  assert.deepEqual(linuxPackageBuildArguments(["--verbose"], "linux"), [
    "--bundles",
    "deb",
    "--verbose",
  ]);
  for (const arguments_ of [
    ["--bundles", "appimage"],
    ["--config", "unreviewed.json"],
    ["--target", "aarch64-unknown-linux-gnu"],
    ["--features", "unreviewed"],
  ]) {
    assert.throws(
      () => linuxPackageBuildArguments(arguments_, "linux"),
      /only accepts --verbose/,
    );
  }
  assert.throws(() => linuxPackageBuildArguments([], "darwin"), /requires Linux/);
  assert.throws(() => linuxPackageBuildArguments([], "win32"), /requires Linux/);
  assert.match(developmentEnvironmentCheck, /require_command "dpkg-deb"/);
});
