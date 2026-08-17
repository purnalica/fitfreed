import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createPublicReleaseManifest } from "../public-release-evidence.mjs";
import { stageStableUpdateChannel } from "../public-update-staging.mjs";
import { inspectArtifact, renderChecksumFile } from "../release-evidence.mjs";

export const publicUpdateConfiguration = {
  format: "org.fitfreed.public-update-configuration",
  schemaVersion: 1,
  status: "active",
  contract: "stable-v2",
  metadataEndpoint: "https://purnalica.github.io/fitfreed/updates/stable.json",
  keys: [
    {
      id: "stable.synthetic-1",
      publicKey: "U3ludGhldGljIHB1YmxpYyBrZXkgZm9yIHZlcmlmaWNhdGlvbiB0ZXN0cy4=",
    },
  ],
};

export function createPublicReleaseCandidateFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-candidate-"));
  const releaseDirectory = path.join(root, "release");
  const pagesDirectory = path.join(root, "pages");
  mkdirSync(path.join(releaseDirectory, "FitFreed.app", "Contents"), { recursive: true });
  writeFileSync(
    path.join(releaseDirectory, "FitFreed.app", "Contents", "synthetic"),
    "signed application bytes",
  );
  const files = {
    "FitFreed_0.1.0_aarch64.dmg": "signed and notarized disk image",
    "FitFreed_0.1.0_aarch64.app.tar.gz": "signed updater archive",
    "FitFreed_0.1.0_aarch64.app.tar.gz.sig":
      "U3ludGhldGljIHVwZGF0ZXIgc2lnbmF0dXJl",
    "npm.cdx.json": "{\"bomFormat\":\"CycloneDX\"}\n",
    "supported-upgrades.json": `${JSON.stringify({
      format: "org.fitfreed.upgrade-matrix",
      schemaVersion: 1,
      release: { version: "0.1.0", librarySchemaVersion: 1 },
      supportedApplicationBaselines: [],
      supportedLibrarySchemaVersions: [1],
    }, null, 2)}\n`,
    "RELEASE_NOTES.md": "# FitFreed 0.1.0\n",
  };
  for (const [filename, content] of Object.entries(files)) {
    writeFileSync(path.join(releaseDirectory, filename), content);
  }
  const updaterPath = path.join(releaseDirectory, "FitFreed_0.1.0_aarch64.app.tar.gz");
  stageStableUpdateChannel({
    outputDirectory: pagesDirectory,
    configuration: publicUpdateConfiguration,
    packagePath: updaterPath,
    packageSignaturePath: `${updaterPath}.sig`,
    signingKeyId: "stable.synthetic-1",
    version: "0.1.0",
    sequence: 1,
    issuedAt: "2026-08-17T20:00:00.000Z",
    expiresAt: "2026-08-24T20:00:00.000Z",
    publishedAt: "2026-08-17T20:00:00.000Z",
    minimumSupportedVersion: "0.1.0",
    minimumReadableSchemaVersion: 1,
    maximumReadableSchemaVersion: 1,
    targetSchemaVersion: 1,
    releaseNotes: {
      "en-US": "Synthetic public release.",
      "es-ES": "Versión pública sintética.",
    },
    withdrawnVersions: [],
    signPayload: () => "U3ludGhldGljIG1ldGFkYXRhIHNpZ25hdHVyZQ==",
  });
  copyFileSync(
    path.join(pagesDirectory, "updates", "stable.json"),
    path.join(releaseDirectory, "stable.json"),
  );

  const artifacts = [
    inspectArtifact(releaseDirectory, "FitFreed.app", "macos-application-bundle"),
    inspectArtifact(releaseDirectory, "FitFreed_0.1.0_aarch64.dmg", "macos-disk-image"),
    inspectArtifact(
      releaseDirectory,
      "FitFreed_0.1.0_aarch64.app.tar.gz",
      "macos-updater-archive",
    ),
    inspectArtifact(
      releaseDirectory,
      "FitFreed_0.1.0_aarch64.app.tar.gz.sig",
      "updater-signature",
    ),
    inspectArtifact(releaseDirectory, "stable.json", "stable-update-envelope"),
    inspectArtifact(releaseDirectory, "npm.cdx.json", "cyclonedx-sbom"),
    inspectArtifact(releaseDirectory, "supported-upgrades.json", "upgrade-matrix"),
    inspectArtifact(releaseDirectory, "RELEASE_NOTES.md", "release-notes"),
  ];
  const revision = "a".repeat(40);
  const manifest = createPublicReleaseManifest({
    version: "0.1.0",
    revision,
    generatedAt: "2026-08-17T19:00:00.000Z",
    storageSchemaVersion: 1,
    certificateSha256: "b".repeat(64),
    teamIdentifier: "A1B2C3D4E5",
    updateKeyId: "stable.synthetic-1",
    updateSequence: 1,
    generators: { cargoCycloneDx: "0.5.9", npmCycloneDx: "6.0.1", tauri: "2.8.5" },
    artifacts,
  });
  writeFileSync(
    path.join(releaseDirectory, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(
    path.join(releaseDirectory, "SHA256SUMS"),
    renderChecksumFile(releaseDirectory, [
      ...artifacts
        .filter(({ kind }) => kind !== "macos-application-bundle")
        .map(({ path: artifactPath }) => artifactPath),
      "release-manifest.json",
    ]),
  );
  return { artifacts, manifest, pagesDirectory, releaseDirectory, revision, root };
}
