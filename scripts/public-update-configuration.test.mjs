import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  publicUpdateBuildEnvironment,
  validatePublicUpdateConfiguration,
} from "./public-update-configuration.mjs";

const inactiveConfiguration = JSON.parse(
  readFileSync(new URL("../release/public-update-channel.json", import.meta.url), "utf8"),
);

const activeConfiguration = {
  ...inactiveConfiguration,
  status: "active",
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

test("keeps the versioned public update channel inactive without production trust", () => {
  assert.equal(validatePublicUpdateConfiguration(inactiveConfiguration).status, "inactive");
  assert.deepEqual(publicUpdateBuildEnvironment(inactiveConfiguration, false), {});
  assert.throws(
    () => publicUpdateBuildEnvironment(inactiveConfiguration, true),
    /public update channel is inactive/,
  );
});

test("maps complete active public trust to compile-time inputs without private material", () => {
  const environment = publicUpdateBuildEnvironment(activeConfiguration, true);

  assert.deepEqual(environment, {
    FITFREED_PUBLIC_UPDATE_CONTRACT: "stable-v2",
    FITFREED_PUBLIC_UPDATE_ENDPOINT:
      "https://purnalica.github.io/fitfreed/updates/stable.json",
    FITFREED_PUBLIC_UPDATE_TRUST: JSON.stringify({
      "stable.synthetic-1": activeConfiguration.keys[0].publicKey,
      "stable.synthetic-2": activeConfiguration.keys[1].publicKey,
    }),
  });
  assert.equal(JSON.stringify(environment).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(environment).includes("PASSWORD"), false);
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
