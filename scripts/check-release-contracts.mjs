import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  releaseNotesSourcePath,
  validateReviewedReleaseNotes,
} from "./release-notes.mjs";

const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function readJson(repositoryRoot, relativePath) {
  return JSON.parse(readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

function readCargoPackage(repositoryRoot, relativePath) {
  const manifest = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  const packageSection = manifest.match(/\[package\]([\s\S]*?)(?=\n\[|$)/)?.[1];
  if (!packageSection) throw new Error(`${relativePath} has no [package] section`);
  const value = (key) => packageSection.match(new RegExp(`^${key} = "([^"]+)"$`, "m"))?.[1];
  return {
    path: relativePath,
    name: value("name"),
    version: value("version"),
    license: value("license"),
    repository: value("repository"),
  };
}

function cargoManifestPaths(repositoryRoot) {
  const rootPath = "src-tauri/Cargo.toml";
  const rootManifest = readFileSync(path.join(repositoryRoot, rootPath), "utf8");
  const workspaceSection = rootManifest.match(/\[workspace\]([\s\S]*?)(?=\n\[|$)/)?.[1];
  const membersSource = workspaceSection?.match(/members = \[([^\]]*)\]/)?.[1];
  if (membersSource === undefined) throw new Error(`${rootPath} has no workspace members`);
  const members = [...membersSource.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  return [rootPath, ...members.map((member) => `src-tauri/${member}/Cargo.toml`)];
}

export function validateReleaseMetadata(metadata, expectedVersion) {
  const errors = [];
  const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const version = metadata.npm.version;

  requireValue(semanticVersion.test(version ?? ""), `invalid release version: ${version}`);
  requireValue(metadata.npm.name === "fitfreed", "package.json name must be fitfreed");
  requireValue(metadata.npm.private === true, "package.json must remain private");
  requireValue(metadata.npm.license === "GPL-3.0-or-later", "package.json license mismatch");
  requireValue(
    metadata.npm.repository?.url === "https://github.com/purnalica/fitfreed",
    "package.json repository mismatch",
  );
  requireValue(metadata.tauri.productName === "FitFreed", "Tauri product name mismatch");
  requireValue(metadata.tauri.identifier === "org.fitfreed.desktop", "Tauri identifier mismatch");
  requireValue(
    metadata.recoveryBundleIdentifier === metadata.tauri.identifier,
    "update recovery bundle identifier does not match Tauri",
  );
  requireValue(metadata.tauri.version === version, "Tauri version does not match package.json");
  requireValue(metadata.tauri.bundle?.active === true, "Tauri bundling must be active");
  requireValue(metadata.tauri.bundle?.targets === "all", "Tauri bundle targets must include app and DMG");
  requireValue(
    metadata.tauri.bundle?.macOS?.minimumSystemVersion === "15.0",
    "minimum supported macOS version must be 15.0",
  );
  requireValue(
    !JSON.stringify(metadata.tauri).match(/wdio|webdriver/i),
    "production Tauri configuration contains E2E instrumentation",
  );
  requireValue(
    metadata.publicTauri?.bundle?.createUpdaterArtifacts === true,
    "public Tauri overlay must create updater artifacts",
  );
  requireValue(
    JSON.stringify(metadata.publicTauri) ===
      JSON.stringify({ bundle: { createUpdaterArtifacts: true } }),
    "public Tauri overlay contains unexpected configuration",
  );

  const expectedCargoPackages = new Set([
    "fitfreed",
    "fitfreed-application",
    "fitfreed-domain",
  ]);
  for (const cargoPackage of metadata.cargoPackages) {
    expectedCargoPackages.delete(cargoPackage.name);
    requireValue(
      cargoPackage.version === version,
      `${cargoPackage.path} version does not match package.json`,
    );
    requireValue(
      cargoPackage.license === "GPL-3.0-or-later",
      `${cargoPackage.path} license mismatch`,
    );
    requireValue(
      cargoPackage.repository === "https://github.com/purnalica/fitfreed",
      `${cargoPackage.path} repository mismatch`,
    );
  }
  requireValue(
    expectedCargoPackages.size === 0,
    `missing Cargo packages: ${[...expectedCargoPackages].sort().join(", ")}`,
  );

  if (expectedVersion !== undefined) {
    requireValue(expectedVersion === version, `expected version ${expectedVersion}, found ${version}`);
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    version,
    productName: metadata.tauri.productName,
    identifier: metadata.tauri.identifier,
    cargoPackages: metadata.cargoPackages.map(({ name }) => name).sort(),
  };
}

export function inspectReleaseContracts(repositoryRoot, expectedVersion) {
  const npm = readJson(repositoryRoot, "package.json");
  const tauri = readJson(repositoryRoot, "src-tauri/tauri.conf.json");
  const publicTauri = readJson(repositoryRoot, "src-tauri/tauri.public.conf.json");
  const recoverySourcePath = "src-tauri/src/infrastructure/update_recovery.rs";
  const recoverySource = readFileSync(path.join(repositoryRoot, recoverySourcePath), "utf8");
  const recoveryBundleIdentifier = recoverySource.match(
    /const EXPECTED_BUNDLE_IDENTIFIER: &str = "([^"]+)";/,
  )?.[1];
  const result = validateReleaseMetadata(
    {
      npm,
      tauri,
      publicTauri,
      recoveryBundleIdentifier,
      cargoPackages: cargoManifestPaths(repositoryRoot).map((manifestPath) =>
        readCargoPackage(repositoryRoot, manifestPath)),
    },
    expectedVersion,
  );
  const notesPath = releaseNotesSourcePath(result.version);
  const absoluteNotesPath = path.join(repositoryRoot, notesPath);
  if (!existsSync(absoluteNotesPath)) {
    throw new Error(`missing reviewed release notes: ${notesPath}`);
  }
  validateReviewedReleaseNotes(readFileSync(absoluteNotesPath, "utf8"));
  return { ...result, releaseNotesSource: notesPath };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = inspectReleaseContracts(repositoryRoot, process.argv[2]);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
