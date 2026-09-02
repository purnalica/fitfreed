import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createLinuxPublicReleaseManifest,
  validateLinuxPublicReleaseManifest,
} from "./linux-public-release-evidence.mjs";

const artifact = (path, kind, fill) => ({
  path,
  kind,
  size: 100 + fill.charCodeAt(0),
  sha256: fill.repeat(64),
});

function manifestInput() {
  return {
    version: "0.1.0",
    revision: "a".repeat(40),
    generatedAt: "2026-09-02T08:00:00.000Z",
    storageSchemaVersion: 37,
    releaseKeyId: "linux-release-2026-1",
    updateKeyId: "stable-2026-1",
    updateSequence: 1,
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.8.5",
    },
    artifacts: [
      artifact("stable.json", "stable-update-envelope", "b"),
      artifact("FitFreed_0.1.0_amd64.deb.sig", "updater-signature", "c"),
      artifact("FitFreed_0.1.0_amd64.deb", "linux-x86_64-deb", "d"),
      artifact(
        "FitFreed_0.1.0_amd64.deb.inventory.json",
        "linux-package-inventory",
        "e",
      ),
      artifact("supported-upgrades.json", "upgrade-matrix", "f"),
      artifact("npm.cdx.json", "cyclonedx-sbom", "1"),
      artifact("RELEASE_NOTES.md", "release-notes", "2"),
    ],
  };
}

function createManifest() {
  return createLinuxPublicReleaseManifest(manifestInput());
}

test("creates the closed public Linux release manifest and trust subjects", () => {
  const manifest = createManifest();

  assert.equal(validateLinuxPublicReleaseManifest(manifest), manifest);
  assert.equal(manifest.schemaVersion, 4);
  assert.deepEqual(manifest.target, {
    os: "linux",
    architecture: "x86_64",
    packageFormat: "deb",
    updateTarget: "linux-x86_64-deb",
    supportedDistributions: [
      { id: "ubuntu", version: "24.04", edition: "desktop" },
      { id: "ubuntu", version: "26.04", edition: "desktop" },
    ],
  });
  assert.deepEqual(manifest.trust.releaseSignature, {
    algorithm: "minisign-ed25519",
    keyId: "linux-release-2026-1",
    subjectPath: "SHA256SUMS",
    signaturePath: "SHA256SUMS.minisig",
  });
  assert.deepEqual(manifest.trust.updaterSignature, {
    algorithm: "minisign-ed25519",
    keyId: "stable-2026-1",
    subjectPath: "FitFreed_0.1.0_amd64.deb",
    signaturePath: "FitFreed_0.1.0_amd64.deb.sig",
  });
  assert.deepEqual(manifest.provenanceRequirements.generatedSubjects, [
    "release-manifest.json",
    "SHA256SUMS",
    "SHA256SUMS.minisig",
  ]);
  assert.deepEqual(
    manifest.artifacts.map(({ path }) => path),
    [...manifest.artifacts.map(({ path }) => path)].sort((left, right) =>
      left.localeCompare(right, "en")),
  );
});

test("rejects cross-platform, incomplete, renamed, or trust-inconsistent evidence", () => {
  const manifest = createManifest();
  manifest.target.architecture = "aarch64";
  manifest.update.target = "darwin-aarch64";
  manifest.trust.updaterSignature.keyId = "another-key";
  manifest.artifacts = manifest.artifacts.filter(
    ({ kind }) => kind !== "linux-package-inventory",
  );
  manifest.artifacts.find(({ kind }) => kind === "linux-x86_64-deb").path = "another.deb";

  assert.throws(
    () => validateLinuxPublicReleaseManifest(manifest),
    (error) => {
      for (const fragment of [
        "schema violation",
        "update target",
        "updater signature key",
        "linux-package-inventory",
        "linux-x86_64-deb must be named",
        "provenance subjects",
      ]) {
        assert.match(error.message, new RegExp(fragment));
      }
      return true;
    },
  );
});

test("rejects artifact ordering drift independently of provenance order", () => {
  const manifest = createManifest();
  manifest.artifacts.reverse();
  manifest.provenanceRequirements.digestBoundSubjects.reverse();

  assert.throws(
    () => validateLinuxPublicReleaseManifest(manifest),
    /Linux public artifact paths must be sorted/,
  );
});

test("documents and indexes the immutable Linux manifest contract", () => {
  const document = readFileSync(
    new URL("../docs/data-formats/release/release-manifest-v4.md", import.meta.url),
    "utf8",
  );
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  for (const value of [
    "linux-x86_64-deb",
    "linux-package-inventory",
    "SHA256SUMS.minisig",
    "updater-signature",
    "stable-v2",
    "github-artifact-attestations",
  ]) {
    assert.match(document, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(index, /release\/release-manifest-v4\.md/);
});
