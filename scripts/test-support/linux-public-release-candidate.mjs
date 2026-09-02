import { createHash } from "node:crypto";
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

import {
  createRecoverableLinuxPublicReleaseManifest,
} from "../linux-public-release-evidence.mjs";
import { expectedLinuxDebianArtifactName, linuxPackageContract } from "../linux-package-contract.mjs";
import { linuxPackageInventoryName } from "../linux-package-inventory.mjs";
import { publicUpdateEndpoint } from "../public-origin.mjs";
import { stageStableUpdateChannel } from "../public-update-staging.mjs";
import { inspectArtifact, renderChecksumFile } from "../release-evidence.mjs";
import { createSyntheticMinisignAuthority } from "./minisign.mjs";

const updaterAuthority = createSyntheticMinisignAuthority();
const releaseAuthority = createSyntheticMinisignAuthority();

export const linuxPublicUpdateConfiguration = {
  format: "org.fitfreed.public-update-configuration",
  schemaVersion: 2,
  status: "active",
  contract: "stable-v3",
  metadataEndpoint: publicUpdateEndpoint,
  keys: [{ id: "stable.synthetic-1", publicKey: updaterAuthority.publicKey }],
};

export const linuxPublicReleaseSigningConfiguration = {
  format: "org.fitfreed.release-signing-configuration",
  schemaVersion: 1,
  status: "active",
  purpose: "linux-release-checksums",
  algorithm: "minisign-ed25519",
  keys: [{ id: "linux-release.synthetic-1", publicKey: releaseAuthority.publicKey }],
};

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function packageEntry(entryPath, mode = "0644") {
  const bytes = Buffer.from(`synthetic installed content: ${entryPath}`);
  return {
    mode,
    path: entryPath,
    sha256: sha256(bytes),
    size: bytes.length,
    type: "file",
  };
}

function packageInventory(packageName, packageBytes, version) {
  return {
    format: "org.fitfreed.linux-package-inventory",
    schemaVersion: 1,
    target: {
      architecture: "amd64",
      distributionFamily: "debian",
      packageFormat: "deb",
    },
    artifact: {
      path: packageName,
      sha256: sha256(packageBytes),
      size: packageBytes.length,
    },
    control: {
      packageName: "fitfreed",
      version,
      architecture: "amd64",
      maintainer: "FitFreed contributors",
      section: "utils",
      priority: "optional",
      homepage: "https://fitfreed.org/",
      description: "Synthetic FitFreed Debian package.",
      dependencyExpression: "libgtk-3-0, libwebkit2gtk-4.1-0",
      dependencyNames: ["libgtk-3-0", "libwebkit2gtk-4.1-0"],
    },
    entries: [
      packageEntry(linuxPackageContract.executablePath, "0755"),
      packageEntry(linuxPackageContract.desktopEntryPath),
      packageEntry(linuxPackageContract.licensePath),
      ...linuxPackageContract.requiredIconPaths.map((entryPath) => packageEntry(entryPath)),
    ].sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path))),
  };
}

export function createLinuxPublicReleaseCandidateFixture({ withPredecessor = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-linux-public-candidate-"));
  const releaseDirectory = path.join(root, "release");
  const pagesDirectory = path.join(root, "pages");
  const inputDirectory = path.join(root, "inputs");
  mkdirSync(releaseDirectory);
  mkdirSync(inputDirectory);

  const version = withPredecessor ? "0.2.0" : "0.1.0";
  const linuxPackageName = expectedLinuxDebianArtifactName(version);
  const linuxPackageBytes = Buffer.from("synthetic signed Debian package bytes");
  const linuxPackagePath = path.join(releaseDirectory, linuxPackageName);
  writeFileSync(linuxPackagePath, linuxPackageBytes);
  writeFileSync(
    `${linuxPackagePath}.sig`,
    updaterAuthority.signTauri(linuxPackageBytes, linuxPackageName),
  );
  const inventoryName = linuxPackageInventoryName(version);
  writeFileSync(
    path.join(releaseDirectory, inventoryName),
    `${JSON.stringify(packageInventory(linuxPackageName, linuxPackageBytes, version), null, 2)}\n`,
  );

  const macosPackageName = `FitFreed_${version}_aarch64.app.tar.gz`;
  const macosPackageBytes = Buffer.from("previously published macOS updater bytes");
  const macosPackagePath = path.join(inputDirectory, macosPackageName);
  writeFileSync(macosPackagePath, macosPackageBytes);
  writeFileSync(
    `${macosPackagePath}.sig`,
    updaterAuthority.signTauri(macosPackageBytes, macosPackageName),
  );
  const predecessorVersion = "0.1.0";
  const predecessorPackageName = expectedLinuxDebianArtifactName(predecessorVersion);
  const predecessorPackagePath = path.join(inputDirectory, predecessorPackageName);
  if (withPredecessor) {
    const predecessorBytes = Buffer.from("authenticated predecessor Debian package bytes");
    writeFileSync(predecessorPackagePath, predecessorBytes);
    writeFileSync(
      `${predecessorPackagePath}.sig`,
      updaterAuthority.signTauri(predecessorBytes, predecessorPackageName),
    );
  }
  const recoveryRequirements = withPredecessor
    ? [{
      version: predecessorVersion,
      target: "linux-x86_64-deb",
      librarySchemaVersions: [36, 37],
    }]
    : [];
  stageStableUpdateChannel({
    outputDirectory: pagesDirectory,
    configuration: linuxPublicUpdateConfiguration,
    packages: [
      {
        packagePath: macosPackagePath,
        packageSignaturePath: `${macosPackagePath}.sig`,
        target: "darwin-aarch64",
      },
      {
        packagePath: linuxPackagePath,
        packageSignaturePath: `${linuxPackagePath}.sig`,
        target: "linux-x86_64-deb",
      },
    ],
    recoveryPackages: recoveryRequirements.map((requirement) => ({
      ...requirement,
      packagePath: predecessorPackagePath,
      packageSignaturePath: `${predecessorPackagePath}.sig`,
    })),
    expectedRecoveryArtifacts: recoveryRequirements,
    signingKeyId: "stable.synthetic-1",
    version,
    sequence: 2,
    issuedAt: "2026-09-02T08:00:00.000Z",
    expiresAt: "2026-09-09T08:00:00.000Z",
    publishedAt: "2026-09-02T08:00:00.000Z",
    minimumSupportedVersion: withPredecessor ? predecessorVersion : version,
    minimumReadableSchemaVersion: 1,
    maximumReadableSchemaVersion: 37,
    targetSchemaVersion: 37,
    releaseNotes: {
      "en-US": "Synthetic Linux public release.",
      "es-ES": "Versión pública Linux sintética.",
    },
    withdrawnVersions: [],
    signPayload: (payload) => updaterAuthority.signTauri(payload, "stable-payload.json"),
  });
  rmSync(inputDirectory, { recursive: true });
  copyFileSync(
    path.join(pagesDirectory, "updates", "stable.json"),
    path.join(releaseDirectory, "stable.json"),
  );

  writeFileSync(path.join(releaseDirectory, "npm.cdx.json"), "{\"bomFormat\":\"CycloneDX\"}\n");
  writeFileSync(
    path.join(releaseDirectory, "supported-upgrades.json"),
    `${JSON.stringify({
      format: "org.fitfreed.upgrade-matrix",
      schemaVersion: 2,
      release: { version, librarySchemaVersion: 37 },
      supportedApplicationBaselines: withPredecessor
        ? [{
          version: predecessorVersion,
          targets: ["darwin-aarch64", "linux-x86_64-deb"],
          librarySchemaVersions: [36, 37],
        }]
        : [],
      supportedLibrarySchemaVersions: Array.from({ length: 37 }, (_, index) => index + 1),
    }, null, 2)}\n`,
  );
  writeFileSync(path.join(releaseDirectory, "RELEASE_NOTES.md"), "# FitFreed 0.1.0 for Linux\n");

  const artifacts = [
    inspectArtifact(releaseDirectory, linuxPackageName, "linux-x86_64-deb"),
    inspectArtifact(releaseDirectory, inventoryName, "linux-package-inventory"),
    inspectArtifact(releaseDirectory, `${linuxPackageName}.sig`, "updater-signature"),
    inspectArtifact(releaseDirectory, "stable.json", "stable-update-envelope"),
    inspectArtifact(releaseDirectory, "npm.cdx.json", "cyclonedx-sbom"),
    inspectArtifact(releaseDirectory, "supported-upgrades.json", "upgrade-matrix"),
    inspectArtifact(releaseDirectory, "RELEASE_NOTES.md", "release-notes"),
  ];
  const revision = "c".repeat(40);
  const manifest = createRecoverableLinuxPublicReleaseManifest({
    version,
    revision,
    generatedAt: "2026-09-02T08:00:00.000Z",
    storageSchemaVersion: 37,
    releaseKeyId: "linux-release.synthetic-1",
    updateKeyId: "stable.synthetic-1",
    updateSequence: 2,
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.8.5",
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
      ...artifacts.map(({ path: artifactPath }) => artifactPath),
      "release-manifest.json",
    ]),
  );
  writeFileSync(
    path.join(releaseDirectory, "SHA256SUMS.minisig"),
    releaseAuthority.signRelease(readFileSync(checksumPath)),
  );
  return {
    artifacts,
    linuxPackageName,
    manifest,
    pagesDirectory,
    releaseDirectory,
    revision,
    root,
  };
}
