import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createCompletePlatformReleaseManifest,
  renderCompletePlatformReleaseNotes,
  validateCompletePlatformReleaseManifest,
} from "./complete-platform-release-evidence.mjs";

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
  const version = "0.3.0";
  return {
    version,
    revision: "a".repeat(40),
    generatedAt: "2026-09-04T08:00:00.000Z",
    storageSchemaVersion: 37,
    releaseKeyId: "release.synthetic-1",
    updateKeyId: "stable.synthetic-1",
    updateSequence: 3,
    macosCertificateSha256: "b".repeat(64),
    macosTeamIdentifier: "A1B2C3D4E5",
    windowsCertificateSha256: "c".repeat(64),
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxBuildEvidence: "1",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.11.4",
      windowsBuildEvidence: "1",
      windowsPackageInventory: "1",
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
      artifact(
        `FitFreed_${version}_x64-setup.exe`,
        "windows-x86_64-nsis",
        "windows-x86_64-nsis",
        "9",
      ),
      artifact(
        `FitFreed_${version}_x64-setup.exe.inventory.json`,
        "windows-package-inventory",
        "windows-x86_64-nsis",
        "a",
      ),
      artifact(
        `FitFreed_${version}_x64-setup.exe.build.json`,
        "windows-build-evidence",
        "windows-x86_64-nsis",
        "b",
      ),
      artifact(
        `FitFreed_${version}_x64-setup.exe.sig`,
        "windows-updater-signature",
        "windows-x86_64-nsis",
        "c",
      ),
      artifact("npm.cdx.json", "cyclonedx-sbom", "release", "d"),
      artifact("RELEASE_NOTES.md", "release-notes", "release", "e"),
      artifact("stable.json", "stable-update-envelope", "release", "f"),
      artifact("supported-upgrades.json", "upgrade-matrix", "release", "0"),
    ],
  };
}

function createManifest() {
  return createCompletePlatformReleaseManifest(manifestInput());
}

test("creates one exact macOS, Linux, and Windows public release manifest", () => {
  const manifest = createManifest();

  assert.equal(validateCompletePlatformReleaseManifest(manifest), manifest);
  assert.equal(manifest.schemaVersion, 7);
  assert.deepEqual(
    manifest.platforms.map(({ target }) => target),
    ["darwin-aarch64", "linux-x86_64-deb", "windows-x86_64-nsis"],
  );
  assert.deepEqual(manifest.update.targets, [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]);
  assert.deepEqual(manifest.trust.updaterSignatures.map(({ target }) => target), [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]);
  assert.equal(
    manifest.platforms[2].trust.authenticode.certificateSha256,
    "c".repeat(64),
  );
});

test("renders a truthful complete-platform release preamble", () => {
  const notes = renderCompletePlatformReleaseNotes({
    revision: "a".repeat(40),
    storageSchemaVersion: 37,
    version: "0.3.0",
  }, `## Highlights

Windows joins the existing macOS and Linux applications.

## Compatibility

The exact support matrix is versioned.

## Privacy and data

The local-first boundary is unchanged.

## Known limitations

Only the documented packages are supported.

## Installation and recovery

Use the platform-specific guide.

## Support

Use the public support routes.
`);

  assert.match(notes, /Targets: Apple Silicon macOS, x86-64 Ubuntu Desktop, and x86-64 Windows 11/);
  assert.match(notes, /Authenticode signed/);
  assert.match(notes, /authenticated `stable-v3`/);
  assert.match(notes, /Windows joins the existing macOS and Linux applications/);
});

test("rejects a Windows expansion that omits or narrows an existing target", () => {
  const missingWindows = createManifest();
  missingWindows.platforms.pop();
  assert.throws(
    () => validateCompletePlatformReleaseManifest(missingWindows),
    /platform set|schema violation/,
  );

  const narrowedUpdate = createManifest();
  narrowedUpdate.update.targets = ["darwin-aarch64", "windows-x86_64-nsis"];
  assert.throws(
    () => validateCompletePlatformReleaseManifest(narrowedUpdate),
    /update target set|schema violation/,
  );
});

test("rejects Windows package, signature, trust, and provenance drift", () => {
  const manifest = createManifest();
  manifest.artifacts.find(({ kind }) => kind === "windows-x86_64-nsis").path =
    "FitFreed_0.2.0_x64-setup.exe";
  manifest.trust.updaterSignatures[2].keyId = "stable.other";
  manifest.platforms[2].trust.authenticode.certificateSha256 = "d".repeat(64);
  manifest.provenanceRequirements.digestBoundSubjects.pop();

  assert.throws(
    () => validateCompletePlatformReleaseManifest(manifest),
    (error) => {
      assert.match(error.message, /windows-x86_64-nsis must be named/);
      assert.match(error.message, /updater signature key/);
      assert.match(error.message, /provenance subjects/);
      return true;
    },
  );
});

test("rejects a Windows artifact assigned to the shared release scope", () => {
  const manifest = createManifest();
  manifest.artifacts.find(({ kind }) => kind === "windows-build-evidence").target = "release";

  assert.throws(
    () => validateCompletePlatformReleaseManifest(manifest),
    /windows-build-evidence target must be windows-x86_64-nsis/,
  );
});

test("documents and indexes the immutable complete-platform release contract", () => {
  const document = readFileSync(
    new URL("../docs/data-formats/release/release-manifest-v7.md", import.meta.url),
    "utf8",
  );
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  for (const value of [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
    "windows-updater-signature",
    "windows-build-evidence",
    "Authenticode",
    "SHA256SUMS.minisig",
    "stable-v3",
    "github-artifact-attestations",
  ]) {
    assert.match(document, new RegExp(value.replaceAll(".", "\\.")));
  }
  assert.match(index, /release\/release-manifest-v7\.md/);
});
