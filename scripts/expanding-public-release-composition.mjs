import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { createLinuxExpansionReleaseManifest } from "./expanding-public-release-evidence.mjs";
import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { linuxPackageInventoryName } from "./linux-package-inventory.mjs";
import { composePagesArtifact } from "./pages-artifact.mjs";
import { verifyLinuxExpansionInput } from "./prepare-linux-expansion-input.mjs";
import { stageStableUpdateChannel } from "./public-update-staging.mjs";
import {
  inspectArtifact,
  renderChecksumFile,
} from "./release-evidence.mjs";
import { deriveRecoveryArtifactRequirements } from "./update-channel-v3.mjs";
import { verifyExpandingPublicReleaseCandidate } from "./verify-expanding-public-release.mjs";

function macosNames(version) {
  const updaterArchive = `FitFreed_${version}_aarch64.app.tar.gz`;
  return {
    application: "FitFreed.app",
    diskImage: `FitFreed_${version}_aarch64.dmg`,
    updaterArchive,
    updaterSignature: `${updaterArchive}.sig`,
  };
}

const tauriMacosUpdaterNames = Object.freeze({
  archive: "FitFreed.app.tar.gz",
  signature: "FitFreed.app.tar.gz.sig",
});

function linuxNames(version) {
  const packageName = expectedLinuxDebianArtifactName(version);
  return {
    buildEvidence: `${packageName}.build.json`,
    inventory: linuxPackageInventoryName(version),
    package: packageName,
    updaterSignature: `${packageName}.sig`,
  };
}

function requireFunction(value) {
  if (typeof value !== "function") {
    throw new Error("complete detached signing authority is unavailable");
  }
  return value;
}

function exactBasename(sourcePath, expectedName, label) {
  if (path.basename(sourcePath) !== expectedName) {
    throw new Error(`${label} must be named ${expectedName}`);
  }
  return sourcePath;
}

function targetArtifact(releaseDirectory, artifactPath, kind, target) {
  return { ...inspectArtifact(releaseDirectory, artifactPath, kind), target };
}

function defaultCopyMacosApplication(source, destination) {
  cpSync(source, destination, {
    errorOnExist: true,
    force: false,
    preserveTimestamps: true,
    recursive: true,
  });
}

function copyMacosArtifacts(
  releaseDirectory,
  version,
  macos,
  copyMacosApplication,
) {
  const names = macosNames(version);
  exactBasename(macos.applicationPath, names.application, "macOS application");
  exactBasename(macos.diskImagePath, names.diskImage, "macOS disk image");
  exactBasename(
    macos.updaterArchivePath,
    tauriMacosUpdaterNames.archive,
    "Tauri macOS updater archive",
  );
  exactBasename(
    macos.updaterSignaturePath,
    tauriMacosUpdaterNames.signature,
    "Tauri macOS updater signature",
  );
  copyMacosApplication(
    macos.applicationPath,
    path.join(releaseDirectory, names.application),
  );
  for (const [source, name] of [
    [macos.diskImagePath, names.diskImage],
    [macos.updaterArchivePath, names.updaterArchive],
    [macos.updaterSignaturePath, names.updaterSignature],
  ]) copyFileSync(source, path.join(releaseDirectory, name));
  return names;
}

function copyLinuxArtifacts(releaseDirectory, inputDirectory, version) {
  const names = linuxNames(version);
  for (const name of [names.package, names.inventory, names.buildEvidence]) {
    copyFileSync(path.join(inputDirectory, name), path.join(releaseDirectory, name));
  }
  return names;
}

function copySharedArtifacts({
  releaseDirectory,
  releaseNotesPath,
  sbomPaths,
  upgradeMatrixPath,
}) {
  exactBasename(releaseNotesPath, "RELEASE_NOTES.md", "release notes");
  exactBasename(upgradeMatrixPath, "supported-upgrades.json", "upgrade matrix");
  const seen = new Set(["RELEASE_NOTES.md", "supported-upgrades.json"]);
  const sbomNames = sbomPaths.map((sbomPath) => {
    const name = path.basename(sbomPath);
    if (!name.endsWith(".cdx.json") || seen.has(name)) {
      throw new Error(`invalid or duplicate release SBOM name: ${name}`);
    }
    seen.add(name);
    copyFileSync(sbomPath, path.join(releaseDirectory, name));
    return name;
  });
  copyFileSync(releaseNotesPath, path.join(releaseDirectory, "RELEASE_NOTES.md"));
  copyFileSync(upgradeMatrixPath, path.join(releaseDirectory, "supported-upgrades.json"));
  return sbomNames;
}

export function composeLinuxExpansionCandidate({
  candidateDirectory,
  copyMacosApplication = defaultCopyMacosApplication,
  generatedAt,
  generators,
  linuxInputDirectory,
  macos,
  macosTrust,
  policy,
  recoveryPackages = [],
  releaseKeyId,
  releaseNotesPath,
  releaseSigningConfiguration,
  revision,
  sbomPaths,
  signLinuxPackage,
  signReleaseChecksums,
  signUpdatePayload,
  storageSchemaVersion,
  times,
  updateConfiguration,
  updateKeyId,
  updateSequence,
  upgradeMatrixPath,
  version,
}) {
  const signLinux = requireFunction(signLinuxPackage);
  const signRelease = requireFunction(signReleaseChecksums);
  const signUpdate = requireFunction(signUpdatePayload);
  const destination = path.resolve(candidateDirectory);
  if (existsSync(destination)) throw new Error("expanding public candidate already exists");
  verifyLinuxExpansionInput({
    directory: linuxInputDirectory,
    revision,
    storageSchemaVersion,
    version,
  });
  const upgradeMatrix = JSON.parse(readFileSync(upgradeMatrixPath, "utf8"));
  const expectedRecoveryArtifacts = deriveRecoveryArtifactRequirements(upgradeMatrix);
  const staging = `${destination}.tmp-${process.pid}`;
  const releaseDirectory = path.join(staging, "release");
  const pagesDirectory = path.join(staging, "pages");
  const updateStagingDirectory = path.join(staging, "update-staging");
  rmSync(staging, { force: true, recursive: true });
  mkdirSync(releaseDirectory, { recursive: true });
  try {
    const macosArtifacts = copyMacosArtifacts(
      releaseDirectory,
      version,
      macos,
      requireFunction(copyMacosApplication),
    );
    const linuxArtifacts = copyLinuxArtifacts(releaseDirectory, linuxInputDirectory, version);
    const linuxPackagePath = path.join(releaseDirectory, linuxArtifacts.package);
    const linuxSignature = signLinux(
      readFileSync(linuxPackagePath),
      linuxArtifacts.package,
    );
    if (typeof linuxSignature !== "string" || linuxSignature.trim().length === 0) {
      throw new Error("Linux updater signing authority returned no signature");
    }
    writeFileSync(
      path.join(releaseDirectory, linuxArtifacts.updaterSignature),
      `${linuxSignature.trim()}\n`,
    );
    const sbomNames = copySharedArtifacts({
      releaseDirectory,
      releaseNotesPath,
      sbomPaths,
      upgradeMatrixPath,
    });

    stageStableUpdateChannel({
      configuration: updateConfiguration,
      expectedRecoveryArtifacts,
      expiresAt: times.expiresAt,
      issuedAt: times.issuedAt,
      maximumReadableSchemaVersion: upgradeMatrix.supportedLibrarySchemaVersions.at(-1),
      minimumReadableSchemaVersion: upgradeMatrix.supportedLibrarySchemaVersions[0],
      minimumSupportedVersion: policy.minimumSupportedVersion,
      outputDirectory: updateStagingDirectory,
      packages: [
        {
          packagePath: path.join(releaseDirectory, macosArtifacts.updaterArchive),
          packageSignaturePath: path.join(
            releaseDirectory,
            macosArtifacts.updaterSignature,
          ),
          target: "darwin-aarch64",
        },
        {
          packagePath: linuxPackagePath,
          packageSignaturePath: path.join(
            releaseDirectory,
            linuxArtifacts.updaterSignature,
          ),
          target: "linux-x86_64-deb",
        },
      ],
      publishedAt: times.publishedAt,
      recoveryPackages,
      releaseNotes: policy.releaseNotes,
      sequence: updateSequence,
      signPayload: signUpdate,
      signingKeyId: updateKeyId,
      targetSchemaVersion: storageSchemaVersion,
      version,
      withdrawnVersions: policy.withdrawnVersions,
    });
    copyFileSync(
      path.join(updateStagingDirectory, "updates", "stable.json"),
      path.join(releaseDirectory, "stable.json"),
    );

    const artifacts = [
      targetArtifact(
        releaseDirectory,
        macosArtifacts.application,
        "macos-application-bundle",
        "darwin-aarch64",
      ),
      targetArtifact(
        releaseDirectory,
        macosArtifacts.diskImage,
        "macos-disk-image",
        "darwin-aarch64",
      ),
      targetArtifact(
        releaseDirectory,
        macosArtifacts.updaterArchive,
        "macos-updater-archive",
        "darwin-aarch64",
      ),
      targetArtifact(
        releaseDirectory,
        macosArtifacts.updaterSignature,
        "macos-updater-signature",
        "darwin-aarch64",
      ),
      targetArtifact(
        releaseDirectory,
        linuxArtifacts.package,
        "linux-x86_64-deb",
        "linux-x86_64-deb",
      ),
      targetArtifact(
        releaseDirectory,
        linuxArtifacts.inventory,
        "linux-package-inventory",
        "linux-x86_64-deb",
      ),
      targetArtifact(
        releaseDirectory,
        linuxArtifacts.buildEvidence,
        "linux-build-evidence",
        "linux-x86_64-deb",
      ),
      targetArtifact(
        releaseDirectory,
        linuxArtifacts.updaterSignature,
        "linux-updater-signature",
        "linux-x86_64-deb",
      ),
      ...sbomNames.map((name) => targetArtifact(
        releaseDirectory,
        name,
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
      artifacts,
      certificateSha256: macosTrust.certificateSha256,
      generatedAt,
      generators,
      releaseKeyId,
      revision,
      storageSchemaVersion,
      teamIdentifier: macosTrust.teamIdentifier,
      updateKeyId,
      updateSequence,
      version,
    });
    writeFileSync(
      path.join(releaseDirectory, "release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      path.join(releaseDirectory, "SHA256SUMS"),
      renderChecksumFile(releaseDirectory, [
        ...manifest.artifacts
          .filter(({ kind }) => kind !== "macos-application-bundle")
          .map(({ path: artifactPath }) => artifactPath),
        "release-manifest.json",
      ]),
    );
    const checksumBytes = readFileSync(path.join(releaseDirectory, "SHA256SUMS"));
    const releaseSignature = signRelease(checksumBytes);
    if (typeof releaseSignature !== "string" || releaseSignature.trim().length === 0) {
      throw new Error("release checksum signing authority returned no signature");
    }
    writeFileSync(
      path.join(releaseDirectory, "SHA256SUMS.minisig"),
      `${releaseSignature.trim()}\n`,
    );
    composePagesArtifact({
      repositoryRoot: path.resolve(import.meta.dirname, ".."),
      outputDirectory: pagesDirectory,
      releaseManifest: manifest,
      updateDirectory: path.join(updateStagingDirectory, "updates"),
    });
    rmSync(updateStagingDirectory, { force: true, recursive: true });
    const verified = verifyExpandingPublicReleaseCandidate(
      staging,
      updateConfiguration,
      releaseSigningConfiguration,
    );
    mkdirSync(path.dirname(destination), { recursive: true });
    renameSync(staging, destination);
    return verified;
  } catch (error) {
    rmSync(staging, { force: true, recursive: true });
    throw error;
  }
}
