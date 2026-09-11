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
const publicUpdateConfiguration = JSON.parse(
  readFileSync(path.join(repositoryRoot, "release/public-update-channel.json"), "utf8"),
);
const updaterPublicKey = publicUpdateConfiguration.keys[0].publicKey;

test("builds one Linux public candidate with mandatory updater artifacts", () => {
  const configuration = {
    ...publicUpdateConfiguration,
    contract: "stable-v3",
    schemaVersion: 2,
  };
  const arguments_ = linuxPublicCandidateBuildArguments(
    configuration,
    "stable.primary-1",
    [],
    "linux",
  );
  assert.deepEqual(arguments_.slice(0, 3), [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--config",
  ]);
  assert.deepEqual(JSON.parse(arguments_[3]), {
    plugins: { updater: { pubkey: updaterPublicKey } },
  });
  assert.deepEqual(arguments_.slice(4), [
    "--bundles",
    "deb",
  ]);
  assert.equal(
    packageJson.scripts["package:linux-public-candidate"],
    "npm run icons && node scripts/build-linux-public-candidate.mjs",
  );
});

test("rejects another host or unreviewed build arguments", () => {
  const configuration = {
    ...publicUpdateConfiguration,
    contract: "stable-v3",
    schemaVersion: 2,
  };
  assert.throws(
    () => linuxPublicCandidateBuildArguments(
      configuration,
      "stable.primary-1",
      [],
      "darwin",
    ),
    /requires Linux/,
  );
  assert.throws(
    () => linuxPublicCandidateBuildArguments(
      configuration,
      "stable.primary-1",
      ["--config", "another.json"],
      "linux",
    ),
    /only accepts --verbose/,
  );
});

test("normalizes the signed external Debian names only after the public build", () => {
  const calls = [];
  const configuration = {
    ...publicUpdateConfiguration,
    contract: "stable-v3",
    schemaVersion: 2,
    status: "active",
    keys: [{
      id: "stable.synthetic",
      publicKey: updaterPublicKey,
    }],
  };

  buildLinuxPublicCandidate({
    arguments_: ["--verbose"],
    build: (options) => calls.push(["build", options]),
    configuration,
    environment: {
      FITFREED_UPDATE_KEY_ID: "stable.synthetic",
      TAURI_SIGNING_PRIVATE_KEY: "/synthetic/updater.key",
      TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/updater.key",
    },
    normalize: (options) => calls.push(["normalize", options]),
    platform: "linux",
  });

  assert.equal(calls[0][0], "build");
  assert.deepEqual(calls[0][1].arguments_, [
    "--config",
    "src-tauri/tauri.public.conf.json",
    "--config",
    JSON.stringify({
      plugins: { updater: { pubkey: updaterPublicKey } },
    }),
    "--bundles",
    "deb",
    "--verbose",
  ]);
  assert.equal(calls[0][1].publicUpdateEnvironment.FITFREED_PUBLIC_UPDATE_CONTRACT, "stable-v3");
  assert.deepEqual(calls[1], ["normalize", {
    directory: path.resolve("src-tauri/target/release/bundle/deb"),
    signature: "required",
    version: packageJson.version,
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
        ...publicUpdateConfiguration,
        schemaVersion: 1,
        status: "active",
        contract: "stable-v2",
        keys: [{
          id: "stable.synthetic",
          publicKey: updaterPublicKey,
        }],
      },
      environment: {
        FITFREED_UPDATE_KEY_ID: "stable.synthetic",
        TAURI_SIGNING_PRIVATE_KEY: "/synthetic/updater.key",
        TAURI_SIGNING_PRIVATE_KEY_PATH: "/synthetic/updater.key",
      },
      normalize: () => {},
      platform: "linux",
    }),
    /requires recoverable stable-v3 update trust/,
  );
  assert.equal(built, false);
});
