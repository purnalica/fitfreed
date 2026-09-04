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

import { createCompletePlatformReleaseManifest } from "../complete-platform-release-evidence.mjs";
import { composePagesArtifact } from "../pages-artifact.mjs";
import { stageLinuxExpansionInput } from "../prepare-linux-expansion-input.mjs";
import { stageWindowsExpansionInput } from "../prepare-windows-expansion-input.mjs";
import { publicUpdateEndpoint } from "../public-origin.mjs";
import { stageStableUpdateChannel } from "../public-update-staging.mjs";
import { inspectArtifact, renderChecksumFile } from "../release-evidence.mjs";
import { createLinuxExpansionInputFixture } from "./linux-expansion-input.mjs";
import { createSyntheticMinisignAuthority } from "./minisign.mjs";
import { createWindowsExpansionInputFixture } from "./windows-expansion-input.mjs";

const updaterAuthority = createSyntheticMinisignAuthority();
const releaseAuthority = createSyntheticMinisignAuthority();
const repositoryRoot = path.resolve(import.meta.dirname, "../..");

export const completePlatformUpdateConfiguration = {
  format: "org.fitfreed.public-update-configuration",
  schemaVersion: 2,
  status: "active",
  contract: "stable-v3",
  metadataEndpoint: publicUpdateEndpoint,
  keys: [{ id: "complete.synthetic-1", publicKey: updaterAuthority.publicKey }],
};

export const completePlatformReleaseSigningConfiguration = {
  format: "org.fitfreed.release-signing-configuration",
  schemaVersion: 2,
  status: "active",
  purpose: "public-release-checksums",
  algorithm: "minisign-ed25519",
  keys: [{ id: "complete-release.synthetic-1", publicKey: releaseAuthority.publicKey }],
};

function writeJson(filename, value) {
  writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function targetArtifact(releaseDirectory, artifactPath, kind, target) {
  return { ...inspectArtifact(releaseDirectory, artifactPath, kind), target };
}

function copyExpansionInput(inputDirectory, releaseDirectory, names) {
  for (const name of names) {
    copyFileSync(path.join(inputDirectory, name), path.join(releaseDirectory, name));
  }
}

export function createCompletePlatformReleaseCandidateFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-complete-platform-candidate-"));
  const releaseDirectory = path.join(root, "release");
  const pagesDirectory = path.join(root, "pages");
  const updateDirectory = path.join(root, "update");
  const inputsDirectory = path.join(root, "inputs");
  mkdirSync(releaseDirectory);
  mkdirSync(inputsDirectory);

  const version = "0.3.0";
  const revision = "a".repeat(40);
  const generatedAt = "2026-09-04T08:00:00.000Z";
  const storageSchemaVersion = 37;
  const windowsCertificateSha256 = "c".repeat(64);

  const linux = createLinuxExpansionInputFixture({ revision, version });
  const linuxInputDirectory = path.join(inputsDirectory, "linux");
  const linuxNames = stageLinuxExpansionInput({
    generatedAt,
    inventoryPath: linux.inventoryPath,
    outputDirectory: linuxInputDirectory,
    packagePath: linux.packagePath,
    revision,
    storageSchemaVersion,
    version,
  });
  copyExpansionInput(linuxInputDirectory, releaseDirectory, [
    linuxNames.packageName,
    linuxNames.inventoryName,
    linuxNames.buildEvidenceName,
  ]);

  const windows = createWindowsExpansionInputFixture({
    certificateSha256: windowsCertificateSha256,
    revision,
    updateConfiguration: completePlatformUpdateConfiguration,
    version,
  });
  const windowsInputDirectory = path.join(inputsDirectory, "windows");
  const windowsNames = stageWindowsExpansionInput({
    authenticodeCertificateSha256: windowsCertificateSha256,
    generatedAt,
    inventoryPath: windows.inventoryPath,
    outputDirectory: windowsInputDirectory,
    packagePath: windows.packagePath,
    revision,
    storageSchemaVersion,
    updateConfiguration: completePlatformUpdateConfiguration,
    version,
  });
  copyExpansionInput(windowsInputDirectory, releaseDirectory, [
    windowsNames.packageName,
    windowsNames.inventoryName,
    windowsNames.buildEvidenceName,
  ]);

  const macosUpdaterName = `FitFreed_${version}_aarch64.app.tar.gz`;
  const macosUpdaterPath = path.join(releaseDirectory, macosUpdaterName);
  writeFileSync(macosUpdaterPath, "synthetic signed macOS updater bytes");
  writeFileSync(
    `${macosUpdaterPath}.sig`,
    updaterAuthority.signTauri(readFileSync(macosUpdaterPath), macosUpdaterName),
  );
  for (const packageName of [linuxNames.packageName, windowsNames.packageName]) {
    const packagePath = path.join(releaseDirectory, packageName);
    writeFileSync(
      `${packagePath}.sig`,
      updaterAuthority.signTauri(readFileSync(packagePath), packageName),
    );
  }

  const predecessorVersion = "0.2.0";
  const recoveryPackages = [
    {
      version: predecessorVersion,
      target: "linux-x86_64-deb",
      librarySchemaVersions: [36, 37],
      packageName: `FitFreed_${predecessorVersion}_amd64.deb`,
    },
    {
      version: predecessorVersion,
      target: "windows-x86_64-nsis",
      librarySchemaVersions: [36, 37],
      packageName: `FitFreed_${predecessorVersion}_x64-setup.exe`,
    },
  ].map((recovery) => {
    const packagePath = path.join(inputsDirectory, recovery.packageName);
    const packageSignaturePath = `${packagePath}.sig`;
    writeFileSync(packagePath, `synthetic predecessor bytes: ${recovery.target}`);
    writeFileSync(
      packageSignaturePath,
      updaterAuthority.signTauri(readFileSync(packagePath), recovery.packageName),
    );
    return { ...recovery, packagePath, packageSignaturePath };
  });
  const expectedRecoveryArtifacts = recoveryPackages.map(({
    librarySchemaVersions,
    target,
    version: recoveryVersion,
  }) => ({
    librarySchemaVersions,
    target,
    version: recoveryVersion,
  }));
  stageStableUpdateChannel({
    configuration: completePlatformUpdateConfiguration,
    expectedRecoveryArtifacts,
    expiresAt: "2026-09-11T08:00:00.000Z",
    issuedAt: generatedAt,
    maximumReadableSchemaVersion: storageSchemaVersion,
    minimumReadableSchemaVersion: 1,
    minimumSupportedVersion: predecessorVersion,
    outputDirectory: updateDirectory,
    packages: [
      {
        packagePath: macosUpdaterPath,
        packageSignaturePath: `${macosUpdaterPath}.sig`,
        target: "darwin-aarch64",
      },
      {
        packagePath: path.join(releaseDirectory, linuxNames.packageName),
        packageSignaturePath: path.join(releaseDirectory, `${linuxNames.packageName}.sig`),
        target: "linux-x86_64-deb",
      },
      {
        packagePath: path.join(releaseDirectory, windowsNames.packageName),
        packageSignaturePath: path.join(releaseDirectory, `${windowsNames.packageName}.sig`),
        target: "windows-x86_64-nsis",
      },
    ],
    publishedAt: generatedAt,
    recoveryPackages,
    releaseNotes: {
      "en-US": "Synthetic complete-platform release.",
      "es-ES": "Synthetic complete-platform release.",
    },
    sequence: 3,
    signPayload: (payload) => updaterAuthority.signTauri(payload, "stable-payload.json"),
    signingKeyId: "complete.synthetic-1",
    targetSchemaVersion: storageSchemaVersion,
    version,
    withdrawnVersions: [],
  });
  copyFileSync(
    path.join(updateDirectory, "updates", "stable.json"),
    path.join(releaseDirectory, "stable.json"),
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
  for (const name of [
    "npm.cdx.json",
    "fitfreed.cdx.json",
    "fitfreed-application.cdx.json",
    "fitfreed-domain.cdx.json",
  ]) {
    writeJson(path.join(releaseDirectory, name), {
      bomFormat: "CycloneDX",
      metadata: { component: { name } },
    });
  }
  writeFileSync(
    path.join(releaseDirectory, "RELEASE_NOTES.md"),
    `# FitFreed ${version}\n\nTargets: macOS, Linux, and Windows.\n`,
  );
  writeJson(path.join(releaseDirectory, "supported-upgrades.json"), {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 2,
    release: { version, librarySchemaVersion: storageSchemaVersion },
    supportedApplicationBaselines: [{
      version: predecessorVersion,
      targets: ["darwin-aarch64", "linux-x86_64-deb", "windows-x86_64-nsis"],
      librarySchemaVersions: [36, 37],
    }],
    supportedLibrarySchemaVersions: Array.from(
      { length: storageSchemaVersion },
      (_, index) => index + 1,
    ),
  });

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
      linuxNames.packageName,
      "linux-x86_64-deb",
      "linux-x86_64-deb",
    ),
    targetArtifact(
      releaseDirectory,
      linuxNames.inventoryName,
      "linux-package-inventory",
      "linux-x86_64-deb",
    ),
    targetArtifact(
      releaseDirectory,
      linuxNames.buildEvidenceName,
      "linux-build-evidence",
      "linux-x86_64-deb",
    ),
    targetArtifact(
      releaseDirectory,
      `${linuxNames.packageName}.sig`,
      "linux-updater-signature",
      "linux-x86_64-deb",
    ),
    targetArtifact(
      releaseDirectory,
      windowsNames.packageName,
      "windows-x86_64-nsis",
      "windows-x86_64-nsis",
    ),
    targetArtifact(
      releaseDirectory,
      windowsNames.inventoryName,
      "windows-package-inventory",
      "windows-x86_64-nsis",
    ),
    targetArtifact(
      releaseDirectory,
      windowsNames.buildEvidenceName,
      "windows-build-evidence",
      "windows-x86_64-nsis",
    ),
    targetArtifact(
      releaseDirectory,
      `${windowsNames.packageName}.sig`,
      "windows-updater-signature",
      "windows-x86_64-nsis",
    ),
    ...[
      "npm.cdx.json",
      "fitfreed.cdx.json",
      "fitfreed-application.cdx.json",
      "fitfreed-domain.cdx.json",
    ].map((name) => targetArtifact(releaseDirectory, name, "cyclonedx-sbom", "release")),
    targetArtifact(releaseDirectory, "stable.json", "stable-update-envelope", "release"),
    targetArtifact(releaseDirectory, "supported-upgrades.json", "upgrade-matrix", "release"),
    targetArtifact(releaseDirectory, "RELEASE_NOTES.md", "release-notes", "release"),
  ];
  const manifest = createCompletePlatformReleaseManifest({
    artifacts,
    generatedAt,
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxBuildEvidence: "1",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.11.4",
      windowsBuildEvidence: "1",
      windowsPackageInventory: "1",
    },
    macosCertificateSha256: "d".repeat(64),
    macosTeamIdentifier: "A1B2C3D4E5",
    releaseKeyId: "complete-release.synthetic-1",
    revision,
    storageSchemaVersion,
    updateKeyId: "complete.synthetic-1",
    updateSequence: 3,
    version,
    windowsCertificateSha256,
  });
  writeJson(path.join(releaseDirectory, "release-manifest.json"), manifest);
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
  composePagesArtifact({
    repositoryRoot,
    outputDirectory: pagesDirectory,
    releaseManifest: manifest,
    updateDirectory: path.join(updateDirectory, "updates"),
  });

  rmSync(linux.root, { force: true, recursive: true });
  rmSync(windows.root, { force: true, recursive: true });
  rmSync(inputsDirectory, { force: true, recursive: true });
  rmSync(updateDirectory, { force: true, recursive: true });
  return {
    linuxBuildEvidenceName: linuxNames.buildEvidenceName,
    linuxPackageName: linuxNames.packageName,
    manifest,
    pagesDirectory,
    releaseDirectory,
    revision,
    root,
    version,
    windowsBuildEvidenceName: windowsNames.buildEvidenceName,
    windowsCertificateSha256,
    windowsInventoryName: windowsNames.inventoryName,
    windowsPackageName: windowsNames.packageName,
  };
}
