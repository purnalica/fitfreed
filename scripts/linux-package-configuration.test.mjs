import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildLinuxPackage,
  linuxPackageBuildArguments,
} from "./build-linux-package.mjs";
import {
  expectedLinuxDebianArtifactName,
  validateLinuxPackageConfiguration,
} from "./linux-package-contract.mjs";

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
const desktopTemplate = readFileSync(
  path.join(repositoryRoot, "src-tauri/linux/fitfreed.desktop.hbs"),
  "utf8",
);

test("keeps the first Linux package boundary and metadata closed", () => {
  assert.deepEqual(validateLinuxPackageConfiguration(linuxConfig), {
    architecture: "amd64",
    packageName: "fitfreed",
    productName: "fitfreed",
    target: "deb",
  });
  assert.equal(expectedLinuxDebianArtifactName("0.1.0"), "FitFreed_0.1.0_amd64.deb");
  assert.equal(desktopTemplate, [
    "[Desktop Entry]",
    "Categories={{categories}}",
    "{{#if comment}}",
    "Comment={{comment}}",
    "{{/if}}",
    "Exec={{exec}}",
    "StartupWMClass={{exec}}",
    "Icon={{icon}}",
    "Name=FitFreed",
    "Terminal=false",
    "Type=Application",
    "",
  ].join("\n"));
  const invalid = structuredClone(linuxConfig);
  invalid.productName = "FitFreed";
  invalid.bundle.targets.push("appimage");
  invalid.bundle.fileAssociations = [{ ext: ["zip"] }];
  invalid.bundle.linux.deb.depends = ["unreviewed-library"];
  invalid.bundle.linux.deb.files = {};
  invalid.bundle.linux.deb.desktopTemplate = "unreviewed.desktop.hbs";
  invalid.bundle.windows = {};
  invalid.plugins = {};
  assert.throws(
    () => validateLinuxPackageConfiguration(invalid),
    (error) => {
      assert.match(error.message, /only deb/);
      assert.match(error.message, /productName must be fitfreed/);
      assert.match(error.message, /desktop template must be linux\/fitfreed\.desktop\.hbs/);
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
  assert.equal(
    packageJson.scripts["verify:linux-installation"],
    "node scripts/verify-linux-clean-install.mjs",
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

test("normalizes the external Debian artifact name after a successful build", () => {
  const calls = [];
  buildLinuxPackage({
    arguments_: ["--verbose"],
    build: (options) => calls.push(["build", options]),
    normalize: (options) => calls.push(["normalize", options]),
    platform: "linux",
  });

  assert.deepEqual(calls, [
    ["build", { arguments_: ["--bundles", "deb", "--verbose"] }],
    ["normalize", {
      directory: path.resolve("src-tauri/target/release/bundle/deb"),
      signature: "optional",
      version: "0.1.0",
    }],
  ]);
});

test("does not normalize an artifact when the Debian build fails", () => {
  let normalized = false;
  assert.throws(
    () => buildLinuxPackage({
      build: () => {
        throw new Error("synthetic build failure");
      },
      normalize: () => {
        normalized = true;
      },
      platform: "linux",
    }),
    /synthetic build failure/,
  );
  assert.equal(normalized, false);
});
