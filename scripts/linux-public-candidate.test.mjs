import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildLinuxPublicCandidate,
  linuxPublicCandidateBuildArguments,
} from "./build-linux-public-candidate.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const inactiveUpdateConfiguration = JSON.parse(
  readFileSync(path.join(repositoryRoot, "release/public-update-channel.json"), "utf8"),
);

test("builds one Linux public candidate with mandatory updater artifacts", () => {
  assert.deepEqual(linuxPublicCandidateBuildArguments([], "linux"), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--bundles",
    "deb",
  ]);
  assert.deepEqual(linuxPublicCandidateBuildArguments(["--verbose"], "linux"), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--bundles",
    "deb",
    "--verbose",
  ]);
  assert.equal(
    packageJson.scripts["package:linux-public-candidate"],
    "npm run icons && node scripts/build-linux-public-candidate.mjs",
  );
});

test("rejects another host or unreviewed build arguments", () => {
  assert.throws(
    () => linuxPublicCandidateBuildArguments([], "darwin"),
    /requires Linux/,
  );
  assert.throws(
    () => linuxPublicCandidateBuildArguments(["--config", "another.json"], "linux"),
    /only accepts --verbose/,
  );
});

test("normalizes the signed external Debian names only after the public build", () => {
  const calls = [];
  const configuration = {
    ...inactiveUpdateConfiguration,
    contract: "stable-v3",
    schemaVersion: 2,
    status: "active",
    keys: [{
      id: "stable.synthetic",
      publicKey: "U3ludGhldGljIHB1YmxpYyBrZXkgZm9yIGNvbnRyYWN0IHRlc3RzLg==",
    }],
  };

  buildLinuxPublicCandidate({
    arguments_: ["--verbose"],
    build: (options) => calls.push(["build", options]),
    configuration,
    environment: { TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/updater.key" },
    normalize: (options) => calls.push(["normalize", options]),
    platform: "linux",
  });

  assert.equal(calls[0][0], "build");
  assert.deepEqual(calls[0][1].arguments_, [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--bundles",
    "deb",
    "--verbose",
  ]);
  assert.equal(calls[0][1].publicUpdateEnvironment.FITFREED_PUBLIC_UPDATE_CONTRACT, "stable-v3");
  assert.deepEqual(calls[1], ["normalize", {
    directory: path.resolve("src-tauri/target/release/bundle/deb"),
    signature: "required",
    version: "0.1.0",
  }]);
});

test("rejects legacy update trust before building a Linux public candidate", () => {
  let built = false;
  assert.throws(
    () => buildLinuxPublicCandidate({
      build: () => {
        built = true;
      },
      configuration: {
        ...inactiveUpdateConfiguration,
        status: "active",
        keys: [{
          id: "stable.synthetic",
          publicKey: "U3ludGhldGljIHB1YmxpYyBrZXkgZm9yIGNvbnRyYWN0IHRlc3RzLg==",
        }],
      },
      environment: { TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/updater.key" },
      normalize: () => {},
      platform: "linux",
    }),
    /requires recoverable stable-v3 update trust/,
  );
  assert.equal(built, false);
});
