import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  publicUpdaterArtifactConfiguration,
  publicUpdateBuildEnvironment,
  validatePublicUpdateConfiguration,
} from "./public-update-configuration.mjs";
import { publicUpdateEndpoint } from "./public-origin.mjs";
import { decodeReleasePublicKey } from "./release-signature.mjs";

const canonicalConfiguration = JSON.parse(
  readFileSync(new URL("../release/public-update-channel.json", import.meta.url), "utf8"),
);

const inactiveConfiguration = {
  ...canonicalConfiguration,
  status: "inactive",
  keys: [],
};

const activeConfiguration = {
  ...inactiveConfiguration,
  schemaVersion: 1,
  status: "active",
  contract: "stable-v2",
  keys: [
    {
      id: "stable.synthetic-1",
      publicKey: "U3ludGhldGljIHB1YmxpYyBrZXkgZm9yIGNvbnRyYWN0IHRlc3RzLg==",
    },
    {
      id: "stable.synthetic-2",
      publicKey: "U2Vjb25kIHN5bnRoZXRpYyBwdWJsaWMga2V5IGZvciByb3RhdGlvbi4=",
    },
  ],
};

const recoverableConfiguration = {
  ...activeConfiguration,
  schemaVersion: 2,
  contract: "stable-v3",
};

test("keeps the versioned public update channel inactive without production trust", () => {
  assert.equal(validatePublicUpdateConfiguration(inactiveConfiguration).status, "inactive");
  assert.deepEqual(publicUpdateBuildEnvironment(inactiveConfiguration, false), {});
  assert.throws(
    () => publicUpdateBuildEnvironment(inactiveConfiguration, true),
    /public update channel is inactive/,
  );
});

test("activates the reviewed primary public updater trust", () => {
  const configuration = validatePublicUpdateConfiguration(canonicalConfiguration);

  assert.equal(configuration.status, "active");
  assert.deepEqual(configuration.keys.map(({ id }) => id), ["stable.primary-1"]);
  decodeReleasePublicKey(configuration.keys[0].publicKey);
  assert.deepEqual(publicUpdateBuildEnvironment(configuration, true), {
    FITFREED_PUBLIC_UPDATE_CONTRACT: "stable-v3",
    FITFREED_PUBLIC_UPDATE_ENDPOINT: publicUpdateEndpoint,
    FITFREED_PUBLIC_UPDATE_TRUST: JSON.stringify({
      "stable.primary-1": configuration.keys[0].publicKey,
    }),
  });
});

test("derives Tauri updater artifact trust from the explicitly selected public key", () => {
  const configuration = validatePublicUpdateConfiguration(canonicalConfiguration);
  const selectedKey = configuration.keys[0];

  assert.deepEqual(
    publicUpdaterArtifactConfiguration(configuration, selectedKey.id),
    {
      plugins: {
        updater: {
          pubkey: selectedKey.publicKey,
        },
      },
    },
  );
  assert.throws(
    () => publicUpdaterArtifactConfiguration(configuration, "stable.unknown"),
    /outside the active public trust set/,
  );
  assert.throws(
    () => publicUpdaterArtifactConfiguration(inactiveConfiguration, selectedKey.id),
    /inactive/,
  );
});

test("maps complete active public trust to compile-time inputs without private material", () => {
  const environment = publicUpdateBuildEnvironment(activeConfiguration, true);

  assert.deepEqual(environment, {
    FITFREED_PUBLIC_UPDATE_CONTRACT: "stable-v2",
    FITFREED_PUBLIC_UPDATE_ENDPOINT: publicUpdateEndpoint,
    FITFREED_PUBLIC_UPDATE_TRUST: JSON.stringify({
      "stable.synthetic-1": activeConfiguration.keys[0].publicKey,
      "stable.synthetic-2": activeConfiguration.keys[1].publicKey,
    }),
  });
  assert.equal(JSON.stringify(environment).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(environment).includes("PASSWORD"), false);
});

test("selects recoverable stable trust only through configuration version 2", () => {
  assert.deepEqual(publicUpdateBuildEnvironment(recoverableConfiguration, true), {
    FITFREED_PUBLIC_UPDATE_CONTRACT: "stable-v3",
    FITFREED_PUBLIC_UPDATE_ENDPOINT: publicUpdateEndpoint,
    FITFREED_PUBLIC_UPDATE_TRUST: JSON.stringify({
      "stable.synthetic-1": recoverableConfiguration.keys[0].publicKey,
      "stable.synthetic-2": recoverableConfiguration.keys[1].publicKey,
    }),
  });
  assert.throws(() => validatePublicUpdateConfiguration({
    ...recoverableConfiguration,
    schemaVersion: 1,
  }));
  assert.throws(() => validatePublicUpdateConfiguration({
    ...recoverableConfiguration,
    contract: "stable-v2",
  }));
});

test("rejects malformed, partial, duplicate, or relocated public channel configuration", () => {
  for (const invalidConfiguration of [
    { ...activeConfiguration, contract: "private-alpha-v1" },
    { ...activeConfiguration, metadataEndpoint: "http://updates.invalid/stable.json" },
    { ...activeConfiguration, metadataEndpoint: "https://updates.invalid/stable.json" },
    { ...activeConfiguration, keys: [] },
    { ...inactiveConfiguration, keys: activeConfiguration.keys },
    { ...activeConfiguration, keys: [activeConfiguration.keys[0], activeConfiguration.keys[0]] },
    {
      ...activeConfiguration,
      keys: [{ ...activeConfiguration.keys[0], id: "STABLE" }],
    },
    { ...activeConfiguration, privateKey: "forbidden" },
  ]) {
    assert.throws(() => validatePublicUpdateConfiguration(invalidConfiguration));
  }
});
