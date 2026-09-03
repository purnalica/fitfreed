import assert from "node:assert/strict";
import test from "node:test";

import { validateLinuxExpansionPrerequisites } from "./public-linux-expansion-preflight.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";

const updateAuthority = createSyntheticMinisignAuthority();
const releaseAuthority = createSyntheticMinisignAuthority();

function prerequisites() {
  return {
    releaseKeyId: "release-2026-1",
    releaseSigningConfiguration: {
      format: "org.fitfreed.release-signing-configuration",
      schemaVersion: 2,
      status: "active",
      purpose: "public-release-checksums",
      algorithm: "minisign-ed25519",
      keys: [{
        id: "release-2026-1",
        publicKey: releaseAuthority.publicKey,
      }],
    },
    updateConfiguration: {
      keys: [{
        id: "update-2026-1",
        publicKey: updateAuthority.publicKey,
      }],
    },
    updateKeyId: "update-2026-1",
    upgradeMatrix: {
      format: "org.fitfreed.upgrade-matrix",
      schemaVersion: 2,
      release: { version: "0.2.0", librarySchemaVersion: 37 },
      supportedApplicationBaselines: [{
        version: "0.1.0",
        targets: ["darwin-aarch64"],
        librarySchemaVersions: [37],
      }],
      supportedLibrarySchemaVersions: [37],
    },
    predecessorRelease: {
      isDraft: false,
      isImmutable: true,
      isPrerelease: false,
      tagName: "v0.1.0",
    },
  };
}

test("accepts one immutable public macOS predecessor and neutral checksum authority", () => {
  assert.deepEqual(validateLinuxExpansionPrerequisites(prerequisites()), {
    predecessorTargets: ["darwin-aarch64"],
    predecessorVersion: "0.1.0",
    releaseKeyId: "release-2026-1",
  });
});

test("rejects absent, mutable, or non-macOS predecessor publication", () => {
  for (const [mutate, expected] of [
    [(input) => { input.upgradeMatrix.supportedApplicationBaselines = []; }, /baseline/],
    [(input) => { input.upgradeMatrix.supportedApplicationBaselines[0].targets = ["linux-x86_64-deb"]; }, /macOS/],
    [(input) => { input.predecessorRelease.isDraft = true; }, /immutable public Release/],
    [(input) => { input.predecessorRelease.isImmutable = false; }, /immutable public Release/],
    [(input) => { input.predecessorRelease.tagName = "v0.0.9"; }, /predecessor tag/],
  ]) {
    const input = prerequisites();
    mutate(input);
    assert.throws(() => validateLinuxExpansionPrerequisites(input), expected);
  }
});

test("rejects inactive, legacy, or unselected release checksum trust", () => {
  for (const [mutate, expected] of [
    [(input) => {
      input.releaseSigningConfiguration.status = "inactive";
      input.releaseSigningConfiguration.keys = [];
    }, /trust is inactive/],
    [(input) => { input.releaseSigningConfiguration.schemaVersion = 1; }, /platform-neutral/],
    [(input) => { input.releaseSigningConfiguration.purpose = "linux-package-checksums"; }, /platform-neutral/],
    [(input) => { input.releaseKeyId = "unknown"; }, /outside the active trust set/],
    [(input) => {
      input.releaseSigningConfiguration.keys[0].publicKey =
        input.updateConfiguration.keys[0].publicKey;
    }, /independent public keys/],
  ]) {
    const input = prerequisites();
    mutate(input);
    assert.throws(() => validateLinuxExpansionPrerequisites(input), expected);
  }
});
