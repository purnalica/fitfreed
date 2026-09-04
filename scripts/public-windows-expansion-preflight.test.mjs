import assert from "node:assert/strict";
import test from "node:test";

import {
  validateWindowsExpansionPrerequisites,
  validateWindowsExpansionProtectedEnvironments,
} from "./public-windows-expansion-preflight.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";

const updateAuthority = createSyntheticMinisignAuthority();
const releaseAuthority = createSyntheticMinisignAuthority();

function prerequisites() {
  return {
    predecessorRelease: {
      isDraft: false,
      isImmutable: true,
      isPrerelease: false,
      tagName: "v0.2.0",
    },
    releaseKeyId: "release-2026-1",
    releaseSigningConfiguration: {
      algorithm: "minisign-ed25519",
      format: "org.fitfreed.release-signing-configuration",
      keys: [{ id: "release-2026-1", publicKey: releaseAuthority.publicKey }],
      purpose: "public-release-checksums",
      schemaVersion: 2,
      status: "active",
    },
    updateConfiguration: {
      keys: [{ id: "update-2026-1", publicKey: updateAuthority.publicKey }],
    },
    updateKeyId: "update-2026-1",
    upgradeMatrix: {
      format: "org.fitfreed.upgrade-matrix",
      release: { librarySchemaVersion: 37, version: "0.3.0" },
      schemaVersion: 2,
      supportedApplicationBaselines: [{
        librarySchemaVersions: [37],
        targets: ["darwin-aarch64", "linux-x86_64-deb"],
        version: "0.2.0",
      }],
      supportedLibrarySchemaVersions: [37],
    },
  };
}

test("accepts only an immutable public macOS and Linux predecessor", () => {
  assert.deepEqual(validateWindowsExpansionPrerequisites(prerequisites()), {
    predecessorTargets: ["darwin-aarch64", "linux-x86_64-deb"],
    predecessorVersion: "0.2.0",
    releaseKeyId: "release-2026-1",
  });
});

test("rejects an absent, mutable, partial, or wrong predecessor publication", () => {
  for (const [mutate, expected] of [
    [(input) => { input.upgradeMatrix.supportedApplicationBaselines = []; }, /baseline/],
    [(input) => { input.upgradeMatrix.supportedApplicationBaselines[0].targets = ["darwin-aarch64"]; }, /macOS and Linux/],
    [(input) => { input.upgradeMatrix.supportedApplicationBaselines[0].targets.push("windows-x86_64-nsis"); }, /macOS and Linux/],
    [(input) => { input.predecessorRelease.isDraft = true; }, /immutable public Release/],
    [(input) => { input.predecessorRelease.isImmutable = false; }, /immutable public Release/],
    [(input) => { input.predecessorRelease.tagName = "v0.1.0"; }, /predecessor tag/],
  ]) {
    const input = prerequisites();
    mutate(input);
    assert.throws(() => validateWindowsExpansionPrerequisites(input), expected);
  }
});

test("rejects invalid or coupled trust selectors", () => {
  for (const [mutate, expected] of [
    [(input) => { input.releaseSigningConfiguration.status = "inactive"; input.releaseSigningConfiguration.keys = []; }, /trust is inactive/],
    [(input) => { input.releaseSigningConfiguration.purpose = "windows-package-checksums"; }, /platform-neutral/],
    [(input) => { input.releaseKeyId = "unknown"; }, /outside the active trust set/],
    [(input) => { input.releaseSigningConfiguration.keys[0].publicKey = input.updateConfiguration.keys[0].publicKey; }, /independent public keys/],
  ]) {
    const input = prerequisites();
    mutate(input);
    assert.throws(() => validateWindowsExpansionPrerequisites(input), expected);
  }
});

test("requires distinct protected Windows build and product-acceptance environments", () => {
  const environments = {
    productAcceptanceEnvironment: {
      administratorBypass: false,
      environment: "public-windows-product-acceptance",
      requiredReviewerCount: 1,
      selfReview: false,
      tagPolicy: "v*",
    },
    windowsReleaseEnvironment: {
      administratorBypass: false,
      environment: "public-windows-release",
      requiredReviewerCount: 1,
      selfReview: false,
      tagPolicy: "v*",
    },
  };
  assert.deepEqual(validateWindowsExpansionProtectedEnvironments(environments), {
    productAcceptanceEnvironment: "public-windows-product-acceptance",
    windowsReleaseEnvironment: "public-windows-release",
  });

  for (const mutate of [
    (value) => { value.productAcceptanceEnvironment.selfReview = true; },
    (value) => { value.windowsReleaseEnvironment.administratorBypass = true; },
    (value) => { value.windowsReleaseEnvironment.environment = "public-macos-release"; },
    (value) => { value.productAcceptanceEnvironment.tagPolicy = "main"; },
  ]) {
    const invalid = structuredClone(environments);
    mutate(invalid);
    assert.throws(
      () => validateWindowsExpansionProtectedEnvironments(invalid),
      /protected Windows expansion environments/,
    );
  }
});
