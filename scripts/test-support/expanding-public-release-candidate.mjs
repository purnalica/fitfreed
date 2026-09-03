import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createLinuxExpansionReleaseManifest } from "../expanding-public-release-evidence.mjs";
import { createLinuxPublicBuildEvidence } from "../linux-public-build-evidence.mjs";
import { composePagesArtifact } from "../pages-artifact.mjs";
import { inspectArtifact, renderChecksumFile } from "../release-evidence.mjs";
import {
  createLinuxPublicReleaseCandidateFixture,
  linuxPublicUpdateConfiguration,
} from "./linux-public-release-candidate.mjs";
import { createSyntheticMinisignAuthority } from "./minisign.mjs";

const releaseAuthority = createSyntheticMinisignAuthority();
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export const expandingPublicUpdateConfiguration = linuxPublicUpdateConfiguration;

export const expandingPublicReleaseSigningConfiguration = {
  format: "org.fitfreed.release-signing-configuration",
  schemaVersion: 2,
  status: "active",
  purpose: "public-release-checksums",
  algorithm: "minisign-ed25519",
  keys: [{
    id: "expansion-release.synthetic-1",
    publicKey: releaseAuthority.publicKey,
  }],
};

function targetArtifact(releaseDirectory, artifactPath, kind, target) {
  return { ...inspectArtifact(releaseDirectory, artifactPath, kind), target };
}

export function createExpandingPublicReleaseCandidateFixture() {
  const linuxCandidate = createLinuxPublicReleaseCandidateFixture({ withPredecessor: true });
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-expanding-public-candidate-"));
  const releaseDirectory = path.join(root, "release");
  const pagesDirectory = path.join(root, "pages");
  mkdirSync(releaseDirectory);
  composePagesArtifact({
    repositoryRoot,
    outputDirectory: pagesDirectory,
    updateDirectory: path.join(linuxCandidate.pagesDirectory, "updates"),
  });

  const version = linuxCandidate.manifest.release.version;
  const revision = linuxCandidate.revision;
  const linuxPackageName = linuxCandidate.linuxPackageName;
  const linuxInventoryName = `${linuxPackageName}.inventory.json`;
  const linuxBuildEvidenceName = `${linuxPackageName}.build.json`;
  for (const filename of [linuxPackageName, linuxInventoryName, `${linuxPackageName}.sig`]) {
    copyFileSync(
      path.join(linuxCandidate.releaseDirectory, filename),
      path.join(releaseDirectory, filename),
    );
  }
  for (const filename of ["stable.json", "supported-upgrades.json"]) {
    copyFileSync(
      path.join(linuxCandidate.releaseDirectory, filename),
      path.join(releaseDirectory, filename),
    );
  }

  const macosUpdaterName = `FitFreed_${version}_aarch64.app.tar.gz`;
  copyFileSync(
    path.join(pagesDirectory, "updates", version, macosUpdaterName),
    path.join(releaseDirectory, macosUpdaterName),
  );
  const envelope = JSON.parse(readFileSync(path.join(releaseDirectory, "stable.json"), "utf8"));
  const payload = JSON.parse(
    Buffer.from(envelope.fitfreed.payloadBase64, "base64").toString("utf8"),
  );
  writeFileSync(
    path.join(releaseDirectory, `${macosUpdaterName}.sig`),
    `${payload.release.platforms["darwin-aarch64"].tauriSignature}\n`,
  );
  mkdirSync(path.join(releaseDirectory, "FitFreed.app", "Contents"), { recursive: true });
  writeFileSync(
    path.join(releaseDirectory, "FitFreed.app", "Contents", "synthetic"),
    "signed and notarized application bytes",
  );
  writeFileSync(
    path.join(releaseDirectory, `FitFreed_${version}_aarch64.dmg`),
    "signed and notarized disk image bytes",
  );

  const packageArtifact = inspectArtifact(
    releaseDirectory,
    linuxPackageName,
    "linux-x86_64-deb",
  );
  const inventoryArtifact = inspectArtifact(
    releaseDirectory,
    linuxInventoryName,
    "linux-package-inventory",
  );
  const buildEvidence = createLinuxPublicBuildEvidence({
    version,
    revision,
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
    packageArtifact,
    inventoryArtifact,
  });
  writeFileSync(
    path.join(releaseDirectory, linuxBuildEvidenceName),
    `${JSON.stringify(buildEvidence, null, 2)}\n`,
  );
  for (const filename of [
    "npm.cdx.json",
    "fitfreed.cdx.json",
    "fitfreed-application.cdx.json",
    "fitfreed-domain.cdx.json",
  ]) {
    writeFileSync(
      path.join(releaseDirectory, filename),
      `${JSON.stringify({ bomFormat: "CycloneDX", metadata: { component: { name: filename } } })}\n`,
    );
  }
  writeFileSync(
    path.join(releaseDirectory, "RELEASE_NOTES.md"),
    `# FitFreed ${version}\n\nTargets: Apple Silicon macOS and x86-64 Ubuntu Desktop.\n`,
  );

  const artifacts = [
    targetArtifact(
      releaseDirectory,
      "FitFreed.app",
      "macos-application-bundle",
      "darwin-aarch64",
    ),
    targetArtifact(
      releaseDirectory,
      `FitFreed_${version}_aarch64.dmg`,
      "macos-disk-image",
      "darwin-aarch64",
    ),
    targetArtifact(
      releaseDirectory,
      macosUpdaterName,
      "macos-updater-archive",
      "darwin-aarch64",
    ),
    targetArtifact(
      releaseDirectory,
      `${macosUpdaterName}.sig`,
      "macos-updater-signature",
      "darwin-aarch64",
    ),
    targetArtifact(
      releaseDirectory,
      linuxPackageName,
      "linux-x86_64-deb",
      "linux-x86_64-deb",
    ),
    targetArtifact(
      releaseDirectory,
      linuxInventoryName,
      "linux-package-inventory",
      "linux-x86_64-deb",
    ),
    targetArtifact(
      releaseDirectory,
      linuxBuildEvidenceName,
      "linux-build-evidence",
      "linux-x86_64-deb",
    ),
    targetArtifact(
      releaseDirectory,
      `${linuxPackageName}.sig`,
      "linux-updater-signature",
      "linux-x86_64-deb",
    ),
    ...[
      "npm.cdx.json",
      "fitfreed.cdx.json",
      "fitfreed-application.cdx.json",
      "fitfreed-domain.cdx.json",
    ].map((filename) => targetArtifact(
      releaseDirectory,
      filename,
      "cyclonedx-sbom",
      "release",
    )),
    targetArtifact(
      releaseDirectory,
      "stable.json",
      "stable-update-envelope",
      "release",
    ),
    targetArtifact(
      releaseDirectory,
      "supported-upgrades.json",
      "upgrade-matrix",
      "release",
    ),
    targetArtifact(
      releaseDirectory,
      "RELEASE_NOTES.md",
      "release-notes",
      "release",
    ),
  ];
  const manifest = createLinuxExpansionReleaseManifest({
    version,
    revision,
    generatedAt: "2026-09-03T08:00:00.000Z",
    storageSchemaVersion: 37,
    releaseKeyId: "expansion-release.synthetic-1",
    updateKeyId: "stable.synthetic-1",
    updateSequence: 2,
    certificateSha256: "d".repeat(64),
    teamIdentifier: "A1B2C3D4E5",
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxBuildEvidence: "1",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.11.4",
    },
    artifacts,
  });
  writeFileSync(
    path.join(releaseDirectory, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const checksumPath = path.join(releaseDirectory, "SHA256SUMS");
  writeFileSync(
    checksumPath,
    renderChecksumFile(releaseDirectory, [
      ...manifest.artifacts
        .filter(({ kind }) => kind !== "macos-application-bundle")
        .map(({ path: artifactPath }) => artifactPath),
      "release-manifest.json",
    ]),
  );
  writeFileSync(
    path.join(releaseDirectory, "SHA256SUMS.minisig"),
    releaseAuthority.signRelease(readFileSync(checksumPath)),
  );
  rmSync(linuxCandidate.root, { recursive: true });
  return {
    linuxBuildEvidenceName,
    linuxPackageName,
    macosUpdaterName,
    manifest,
    pagesDirectory,
    releaseDirectory,
    revision,
    root,
  };
}
