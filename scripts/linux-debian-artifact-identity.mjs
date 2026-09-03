import {
  lstatSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";

import {
  expectedLinuxDebianArtifactName,
  linuxPackageContract,
} from "./linux-package-contract.mjs";

const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function pathKind(candidate) {
  try {
    const statistics = lstatSync(candidate);
    return statistics.isFile() ? "file" : "other";
  } catch (error) {
    if (error.code === "ENOENT") return "absent";
    throw error;
  }
}

function sameFile(left, right) {
  try {
    const leftStatistics = lstatSync(left);
    const rightStatistics = lstatSync(right);
    return leftStatistics.dev === rightStatistics.dev
      && leftStatistics.ino === rightStatistics.ino;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function validateTauriDebianArtifactEntries(
  entries,
  generatedName,
  canonicalName,
) {
  const packages = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".deb"))
    .map((entry) => entry.name);
  if (
    !packages.includes(generatedName)
    || packages.some((name) => ![generatedName, canonicalName].includes(name))
    || packages.length > 2
  ) {
    throw new Error("the bundle directory must contain exactly the expected Tauri Debian artifact");
  }
}

export function tauriLinuxDebianArtifactName(version) {
  if (!versionPattern.test(version)) throw new Error("invalid package version");
  return `${linuxPackageContract.bundleProductName}_${version}_${linuxPackageContract.architecture}.deb`;
}

export function normalizeLinuxDebianArtifactNames({
  directory,
  signature = "optional",
  version,
}) {
  if (!["optional", "required"].includes(signature)) {
    throw new Error("invalid Debian updater signature policy");
  }
  const generatedName = tauriLinuxDebianArtifactName(version);
  const canonicalName = expectedLinuxDebianArtifactName(version);
  validateTauriDebianArtifactEntries(
    readdirSync(directory, { withFileTypes: true }),
    generatedName,
    canonicalName,
  );

  const generatedPackagePath = path.join(directory, generatedName);
  const canonicalPackagePath = path.join(directory, canonicalName);
  const generatedSignaturePath = `${generatedPackagePath}.sig`;
  const canonicalSignaturePath = `${canonicalPackagePath}.sig`;
  const previousPackagePath = path.join(directory, `.previous-${canonicalName}`);
  const previousSignaturePath = `${previousPackagePath}.sig`;
  const generatedSignatureKind = pathKind(generatedSignaturePath);
  const canonicalPackageKind = pathKind(canonicalPackagePath);
  const canonicalSignatureKind = pathKind(canonicalSignaturePath);
  if (generatedSignatureKind === "other") {
    throw new Error("the generated updater signature must be a regular file");
  }
  if (canonicalPackageKind === "other" || canonicalSignatureKind === "other") {
    throw new Error("the canonical Debian artifact destination must contain only regular files");
  }
  if (signature === "required" && generatedSignatureKind === "absent") {
    throw new Error("the required updater signature is missing");
  }
  if (pathKind(previousPackagePath) !== "absent" || pathKind(previousSignaturePath) !== "absent") {
    throw new Error("a prior interrupted Debian artifact normalization must be resolved");
  }

  const packageSharesIdentity = sameFile(generatedPackagePath, canonicalPackagePath);
  const signatureSharesIdentity = generatedSignatureKind === "file"
    && sameFile(generatedSignaturePath, canonicalSignaturePath);
  let previousPackageRetained = false;
  let previousSignatureRetained = false;
  let generatedPackageMoved = false;
  let generatedSignatureMoved = false;
  try {
    if (canonicalPackageKind === "file" && !packageSharesIdentity) {
      renameSync(canonicalPackagePath, previousPackagePath);
      previousPackageRetained = true;
    }
    if (canonicalSignatureKind === "file" && !signatureSharesIdentity) {
      renameSync(canonicalSignaturePath, previousSignaturePath);
      previousSignatureRetained = true;
    }
    renameSync(generatedPackagePath, canonicalPackagePath);
    generatedPackageMoved = true;
    if (generatedSignatureKind === "file") {
      renameSync(generatedSignaturePath, canonicalSignaturePath);
      generatedSignatureMoved = true;
    }
  } catch (error) {
    if (generatedSignatureMoved) renameSync(canonicalSignaturePath, generatedSignaturePath);
    if (generatedPackageMoved) renameSync(canonicalPackagePath, generatedPackagePath);
    if (previousPackageRetained) renameSync(previousPackagePath, canonicalPackagePath);
    if (previousSignatureRetained) renameSync(previousSignaturePath, canonicalSignaturePath);
    throw error;
  }
  if (previousPackageRetained) rmSync(previousPackagePath);
  if (previousSignatureRetained) rmSync(previousSignaturePath);

  return {
    packagePath: canonicalPackagePath,
    signaturePath: generatedSignatureKind === "file" ? canonicalSignaturePath : undefined,
  };
}
