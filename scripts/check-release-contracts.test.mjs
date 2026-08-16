import assert from "node:assert/strict";
import test from "node:test";

import { validateReleaseMetadata } from "./check-release-contracts.mjs";

function validMetadata() {
  return {
    npm: {
      name: "fitfreed",
      version: "0.1.0",
      private: true,
      license: "GPL-3.0-or-later",
      repository: { url: "https://github.com/purnalica/fitfreed" },
    },
    tauri: {
      productName: "FitFreed",
      version: "0.1.0",
      identifier: "org.fitfreed.desktop",
      bundle: { active: true, targets: "all" },
    },
    cargoPackages: ["fitfreed", "fitfreed-application", "fitfreed-domain"].map((name) => ({
      path: `${name}/Cargo.toml`,
      name,
      version: "0.1.0",
      license: "GPL-3.0-or-later",
      repository: "https://github.com/purnalica/fitfreed",
    })),
  };
}

test("accepts one consistent private development release identity", () => {
  assert.deepEqual(validateReleaseMetadata(validMetadata(), "0.1.0"), {
    version: "0.1.0",
    productName: "FitFreed",
    identifier: "org.fitfreed.desktop",
    cargoPackages: ["fitfreed", "fitfreed-application", "fitfreed-domain"],
  });
});

test("reports every inconsistent release identity in one actionable failure", () => {
  const metadata = validMetadata();
  metadata.tauri.version = "0.2.0";
  metadata.tauri.security = { capability: "wdio-webdriver" };
  metadata.cargoPackages[1].license = "UNKNOWN";

  assert.throws(
    () => validateReleaseMetadata(metadata, "0.3.0"),
    (error) => {
      assert.match(error.message, /Tauri version does not match package\.json/);
      assert.match(error.message, /production Tauri configuration contains E2E instrumentation/);
      assert.match(error.message, /fitfreed-application\/Cargo\.toml license mismatch/);
      assert.match(error.message, /expected version 0\.3\.0, found 0\.1\.0/);
      return true;
    },
  );
});

test("rejects versions that are not semantic versions", () => {
  const metadata = validMetadata();
  metadata.npm.version = "01.0.0";
  metadata.tauri.version = "01.0.0";
  for (const cargoPackage of metadata.cargoPackages) cargoPackage.version = "01.0.0";

  assert.throws(
    () => validateReleaseMetadata(metadata),
    /invalid release version: 01\.0\.0/,
  );
});
