import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildLinuxExpansionInput } from "./build-linux-expansion-input.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const inactiveUpdateConfiguration = JSON.parse(
  readFileSync(path.join(repositoryRoot, "release/public-update-channel.json"), "utf8"),
);
const prepareLinuxExpansionInputSource = readFileSync(
  path.join(repositoryRoot, "scripts/prepare-linux-expansion-input.mjs"),
  "utf8",
);

function activeConfiguration() {
  return {
    ...inactiveUpdateConfiguration,
    contract: "stable-v3",
    schemaVersion: 2,
    status: "active",
    keys: [{
      id: "stable.synthetic",
      publicKey: "U3ludGhldGljIHB1YmxpYyBrZXkgZm9yIGNvbnRyYWN0IHRlc3RzLg==",
    }],
  };
}

test("builds the secret-free Linux expansion input with public update trust", () => {
  const calls = [];
  buildLinuxExpansionInput({
    arguments_: ["--verbose"],
    buildLinux: (options) => calls.push(options),
    configuration: activeConfiguration(),
    platform: "linux",
  });

  assert.equal(
    packageJson.scripts["package:linux-expansion-input"],
    "npm run icons && node scripts/build-linux-expansion-input.mjs",
  );
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].arguments_, ["--verbose"]);
  assert.equal(calls[0].platform, "linux");
  assert.equal(
    calls[0].publicUpdateEnvironment.FITFREED_PUBLIC_UPDATE_CONTRACT,
    "stable-v3",
  );
  assert.equal(
    calls[0].publicUpdateEnvironment.FITFREED_PUBLIC_UPDATE_ENDPOINT,
    inactiveUpdateConfiguration.metadataEndpoint,
  );
  assert.doesNotMatch(JSON.stringify(calls[0]), /PRIVATE|PASSWORD/u);
  assert.match(
    prepareLinuxExpansionInputSource,
    /run\("npm", \["run", "package:linux-expansion-input"\]\)/u,
  );
  assert.doesNotMatch(
    prepareLinuxExpansionInputSource,
    /run\("npm", \["run", "package:linux"\]\)/u,
  );
});

test("rejects inactive or legacy update trust before building the Linux input", () => {
  for (const configuration of [
    inactiveUpdateConfiguration,
    { ...activeConfiguration(), contract: "stable-v2" },
  ]) {
    let built = false;
    assert.throws(() => buildLinuxExpansionInput({
      buildLinux: () => { built = true; },
      configuration,
      platform: "linux",
    }), /active recoverable stable-v3/);
    assert.equal(built, false);
  }
});

test("rejects private updater authority at the secret-free build boundary", () => {
  let built = false;
  assert.throws(() => buildLinuxExpansionInput({
    buildLinux: () => { built = true; },
    configuration: activeConfiguration(),
    environment: {
      TAURI_SIGNING_PRIVATE_KEY: "forbidden",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "forbidden",
    },
    platform: "linux",
  }), /must not receive private updater signing authority/);
  assert.equal(built, false);
});
