import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createReleaseManifest,
  inspectArtifact,
  renderChecksumFile,
  renderDraftReleaseNotes,
} from "./release-evidence.mjs";
import { verifyReleaseIntegrity } from "./verify-release-integrity.mjs";

function releaseFixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-release-integrity-"));
  context.after(() => rmSync(root, { recursive: true }));
  mkdirSync(path.join(root, "FitFreed.app", "Contents"), { recursive: true });
  writeFileSync(path.join(root, "FitFreed.app", "Contents", "fitfreed"), "application");
  writeFileSync(path.join(root, "FitFreed.dmg"), "disk image");
  writeFileSync(path.join(root, "npm.cdx.json"), "{}\n");
  const manifest = createReleaseManifest({
    version: "0.1.0",
    revision: "a".repeat(40),
    generatedAt: "2026-08-16T16:00:00.000Z",
    architecture: "aarch64",
    storageSchemaVersion: 3,
    generators: { cargoCycloneDx: "0.5.9", npmCycloneDx: "6.0.1", tauri: "2.8.5" },
    artifacts: [
      inspectArtifact(root, "FitFreed.app", "macos-application-bundle"),
      inspectArtifact(root, "FitFreed.dmg", "macos-disk-image"),
      inspectArtifact(root, "npm.cdx.json", "cyclonedx-sbom"),
    ],
  });
  writeFileSync(path.join(root, "release-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(path.join(root, "RELEASE_NOTES.md"), renderDraftReleaseNotes(manifest));
  writeFileSync(
    path.join(root, "SHA256SUMS"),
    renderChecksumFile(root, [
      "FitFreed.dmg",
      "npm.cdx.json",
      "release-manifest.json",
      "RELEASE_NOTES.md",
    ]),
  );
  return root;
}

test("verifies every staged artifact and checksum before returning the disk image", (context) => {
  const root = releaseFixture(context);

  assert.deepEqual(verifyReleaseIntegrity(root), {
    version: "0.1.0",
    revision: "a".repeat(40),
    architecture: "aarch64",
    diskImage: path.join(root, "FitFreed.dmg"),
  });
});

test("reports manifest and checksum failures together", (context) => {
  const root = releaseFixture(context);
  writeFileSync(path.join(root, "FitFreed.dmg"), "corrupted disk image");
  writeFileSync(path.join(root, "unexpected.txt"), "must not ship\n");

  assert.throws(
    () => verifyReleaseIntegrity(root),
    (error) => {
      assert.match(error.message, /size mismatch: FitFreed\.dmg/);
      assert.match(error.message, /digest mismatch: FitFreed\.dmg/);
      assert.match(error.message, /checksum mismatch: FitFreed\.dmg/);
      assert.match(error.message, /unexpected release entry: unexpected\.txt/);
      return true;
    },
  );
});
