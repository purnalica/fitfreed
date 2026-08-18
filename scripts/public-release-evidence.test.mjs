import assert from "node:assert/strict";
import test from "node:test";

import {
  createPublicReleaseManifest,
  renderPublicReleaseNotes,
  validatePublicReleaseManifest,
} from "./public-release-evidence.mjs";

const artifact = (path, kind, fill) => ({
  path,
  kind,
  size: 100 + fill.charCodeAt(0),
  sha256: fill.repeat(64),
});

function createManifest() {
  return createPublicReleaseManifest({
    version: "0.1.0",
    revision: "a".repeat(40),
    generatedAt: "2026-08-17T20:00:00.000Z",
    storageSchemaVersion: 9,
    certificateSha256: "b".repeat(64),
    teamIdentifier: "A1B2C3D4E5",
    updateKeyId: "stable-2026-1",
    updateSequence: 1,
    generators: { cargoCycloneDx: "0.5.9", npmCycloneDx: "6.0.1", tauri: "2.8.5" },
    artifacts: [
      artifact("stable.json", "stable-update-envelope", "c"),
      artifact("FitFreed_0.1.0_aarch64.app.tar.gz.sig", "updater-signature", "d"),
      artifact("FitFreed.app", "macos-application-bundle", "e"),
      artifact("supported-upgrades.json", "upgrade-matrix", "f"),
      artifact("FitFreed_0.1.0_aarch64.dmg", "macos-disk-image", "1"),
      artifact("npm.cdx.json", "cyclonedx-sbom", "2"),
      artifact("FitFreed_0.1.0_aarch64.app.tar.gz", "macos-updater-archive", "3"),
      artifact("RELEASE_NOTES.md", "release-notes", "4"),
    ],
  });
}

test("creates the closed public stable evidence contract from final signed artifacts", () => {
  const manifest = createManifest();

  assert.equal(validatePublicReleaseManifest(manifest), manifest);
  assert.equal(manifest.schemaVersion, 3);
  assert.equal(manifest.release.channel, "public-stable");
  assert.equal(manifest.release.signed, true);
  assert.equal(manifest.release.notarized, true);
  assert.equal(manifest.target.architecture, "aarch64");
  assert.equal(manifest.target.minimumSystemVersion, "15.0");
  assert.equal(manifest.trust.codeSigning.identity, "developer-id-application");
  assert.equal(manifest.trust.codeSigning.hardenedRuntime, true);
  assert.equal(manifest.trust.notarization.gatekeeperAccepted, true);
  assert.equal(manifest.update.contract, "stable-v2");
  assert.equal(manifest.update.metadataEndpoint, "https://fitfreed.org/updates/stable.json");
  assert.deepEqual(manifest.provenanceRequirements.generatedSubjects, [
    "release-manifest.json",
    "SHA256SUMS",
  ]);
  assert.equal(manifest.provenanceRequirements.digestBoundSubjects.length, 7);
  assert.equal(
    manifest.provenanceRequirements.digestBoundSubjects.some(({ path }) => path === "FitFreed.app"),
    false,
  );
  assert.deepEqual(
    manifest.artifacts.map(({ path }) => path),
    [...manifest.artifacts.map(({ path }) => path)].sort((left, right) =>
      left.localeCompare(right, "en"),
    ),
  );
});

test("rejects a public release manifest bound to a non-canonical update endpoint", () => {
  const manifest = createManifest();
  manifest.update.metadataEndpoint = "https://updates.example.test/stable.json";

  assert.throws(
    () => validatePublicReleaseManifest(manifest),
    /update endpoint is not canonical/,
  );
});

test("rejects unsigned, non-notarized, Intel, or older-system public claims", () => {
  for (const mutate of [
    (manifest) => { manifest.release.signed = false; },
    (manifest) => { manifest.release.notarized = false; },
    (manifest) => { manifest.target.architecture = "x86_64"; },
    (manifest) => { manifest.target.minimumSystemVersion = "14.0"; },
    (manifest) => { manifest.trust.codeSigning.hardenedRuntime = false; },
    (manifest) => { manifest.trust.notarization.diskImageStapled = false; },
  ]) {
    const manifest = createManifest();
    mutate(manifest);
    assert.throws(() => validatePublicReleaseManifest(manifest), /schema violation/);
  }
});

test("requires every public package, update, compatibility, inventory, and note artifact", () => {
  const manifest = createManifest();
  manifest.artifacts = manifest.artifacts.filter(({ kind }) => kind !== "macos-updater-archive");
  manifest.provenanceRequirements.digestBoundSubjects =
    manifest.provenanceRequirements.digestBoundSubjects.filter(
      ({ path }) => !path.endsWith(".app.tar.gz"),
    );

  assert.throws(
    () => validatePublicReleaseManifest(manifest),
    /public release manifest has no macos-updater-archive/,
  );
});

test("rejects provenance requirements that omit or mutate a regular artifact", () => {
  const manifest = createManifest();
  manifest.provenanceRequirements.digestBoundSubjects[0].sha256 = "9".repeat(64);

  assert.throws(
    () => validatePublicReleaseManifest(manifest),
    /provenance subjects must match every regular manifest artifact/,
  );
});

test("rejects a public artifact renamed away from its stable contract", () => {
  const manifest = createManifest();
  const diskImage = manifest.artifacts.find(({ kind }) => kind === "macos-disk-image");
  diskImage.path = "FitFreed-latest.dmg";
  manifest.provenanceRequirements.digestBoundSubjects = manifest.artifacts
    .filter(({ kind }) => kind !== "macos-application-bundle")
    .sort((left, right) => left.path.localeCompare(right.path, "en"))
    .map(({ path, sha256 }) => ({ path, sha256 }));

  assert.throws(
    () => validatePublicReleaseManifest(manifest),
    /macos-disk-image must be named FitFreed_0.1.0_aarch64.dmg/,
  );
});

test("assembles public notes from generated trust identity and reviewed content", () => {
  const reviewed = `## Highlights

Synthetic product highlights.

## Compatibility

Apple Silicon on macOS 15.0 or later.

## Privacy and data

Local-first processing.

## Known limitations

Synthetic test only.

## Installation and recovery

Use the verified disk image.

## Support

Use the public issue tracker.
`;
  const notes = renderPublicReleaseNotes({
    version: "0.1.0",
    revision: "a".repeat(40),
    storageSchemaVersion: 9,
  }, reviewed);

  assert.match(notes, /^# FitFreed 0\.1\.0$/m);
  assert.match(notes, /Developer ID signed, Apple notarized/);
  assert.match(notes, /authenticated `stable-v2`/);
  assert.match(notes, /## Highlights/);
  assert.doesNotMatch(notes, /private development/);
});
