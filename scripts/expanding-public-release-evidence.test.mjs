import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createLinuxExpansionReleaseManifest,
  validateExpandingPublicReleaseManifest,
} from "./expanding-public-release-evidence.mjs";

function artifact(path, kind, target, digestCharacter) {
  return {
    path,
    kind,
    target,
    size: 100,
    sha256: digestCharacter.repeat(64),
  };
}

function manifestInput() {
  const version = "0.2.0";
  return {
    version,
    revision: "a".repeat(40),
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
    releaseKeyId: "release.synthetic-1",
    updateKeyId: "stable.synthetic-1",
    updateSequence: 2,
    certificateSha256: "b".repeat(64),
    teamIdentifier: "A1B2C3D4E5",
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxBuildEvidence: "1",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.11.4",
    },
    artifacts: [
      artifact("FitFreed.app", "macos-application-bundle", "darwin-aarch64", "1"),
      artifact(`FitFreed_${version}_aarch64.dmg`, "macos-disk-image", "darwin-aarch64", "2"),
      artifact(
        `FitFreed_${version}_aarch64.app.tar.gz`,
        "macos-updater-archive",
        "darwin-aarch64",
        "3",
      ),
      artifact(
        `FitFreed_${version}_aarch64.app.tar.gz.sig`,
        "macos-updater-signature",
        "darwin-aarch64",
        "4",
      ),
      artifact(`FitFreed_${version}_amd64.deb`, "linux-x86_64-deb", "linux-x86_64-deb", "5"),
      artifact(
        `FitFreed_${version}_amd64.deb.inventory.json`,
        "linux-package-inventory",
        "linux-x86_64-deb",
        "6",
      ),
      artifact(
        `FitFreed_${version}_amd64.deb.build.json`,
        "linux-build-evidence",
        "linux-x86_64-deb",
        "7",
      ),
      artifact(
        `FitFreed_${version}_amd64.deb.sig`,
        "linux-updater-signature",
        "linux-x86_64-deb",
        "8",
      ),
      artifact("npm.cdx.json", "cyclonedx-sbom", "release", "9"),
      artifact("RELEASE_NOTES.md", "release-notes", "release", "a"),
      artifact("stable.json", "stable-update-envelope", "release", "b"),
      artifact("supported-upgrades.json", "upgrade-matrix", "release", "c"),
    ],
  };
}

function createManifest() {
  return createLinuxExpansionReleaseManifest(manifestInput());
}

test("creates one exact macOS and Linux public expansion manifest", () => {
  const manifest = createManifest();

  assert.equal(validateExpandingPublicReleaseManifest(manifest), manifest);
  assert.equal(manifest.schemaVersion, 6);
  assert.deepEqual(
    manifest.platforms.map(({ target }) => target),
    ["darwin-aarch64", "linux-x86_64-deb"],
  );
  assert.deepEqual(manifest.update.targets, ["darwin-aarch64", "linux-x86_64-deb"]);
  assert.equal(manifest.update.contract, "stable-v3");
  assert.deepEqual(
    manifest.artifacts.map(({ path }) => path),
    [...manifest.artifacts.map(({ path }) => path)].sort((left, right) =>
      left.localeCompare(right, "en")),
  );
  assert.deepEqual(manifest.trust.updaterSignatures.map(({ target }) => target), [
    "darwin-aarch64",
    "linux-x86_64-deb",
  ]);
});

test("rejects a Linux expansion that omits or narrows the macOS target", () => {
  const missingMacos = createManifest();
  missingMacos.platforms.shift();
  assert.throws(
    () => validateExpandingPublicReleaseManifest(missingMacos),
    /platform set|schema violation/,
  );

  const narrowedUpdate = createManifest();
  narrowedUpdate.update.targets = ["linux-x86_64-deb"];
  assert.throws(
    () => validateExpandingPublicReleaseManifest(narrowedUpdate),
    /update target set|schema violation/,
  );
});

test("rejects mixed identity, package naming, signature, and provenance evidence", () => {
  const manifest = createManifest();
  manifest.release.revision = "f".repeat(40);
  manifest.artifacts.find(({ kind }) => kind === "linux-x86_64-deb").path =
    "FitFreed_0.1.0_amd64.deb";
  manifest.trust.updaterSignatures[1].keyId = "stable.other";
  manifest.provenanceRequirements.digestBoundSubjects.pop();

  assert.throws(
    () => validateExpandingPublicReleaseManifest(manifest),
    (error) => {
      assert.match(error.message, /linux-x86_64-deb must be named/);
      assert.match(error.message, /updater signature key/);
      assert.match(error.message, /provenance subjects/);
      return true;
    },
  );
});

test("rejects target artifacts assigned to the shared release scope", () => {
  const manifest = createManifest();
  manifest.artifacts.find(({ kind }) => kind === "linux-package-inventory").target = "release";

  assert.throws(
    () => validateExpandingPublicReleaseManifest(manifest),
    /linux-package-inventory target must be linux-x86_64-deb/,
  );
});

test("documents and indexes the immutable expanding release contract", () => {
  const document = readFileSync(
    new URL("../docs/data-formats/release/release-manifest-v6.md", import.meta.url),
    "utf8",
  );
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  for (const value of [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "macos-updater-signature",
    "linux-updater-signature",
    "linux-build-evidence",
    "SHA256SUMS.minisig",
    "stable-v3",
    "github-artifact-attestations",
  ]) {
    assert.match(document, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(index, /release\/release-manifest-v6\.md/);
});
