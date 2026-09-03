import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertUpdaterSigningAuthority } from "./build-public-candidate.mjs";
import { linuxPackageBuildArguments } from "./build-linux-package.mjs";
import { buildProductionPackage } from "./build-production.mjs";
import { normalizeLinuxDebianArtifactNames } from "./linux-debian-artifact-identity.mjs";
import { validateLinuxPackageConfiguration } from "./linux-package-contract.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;
const packageDirectory = path.join(
  repositoryRoot,
  "src-tauri/target/release/bundle/deb",
);

export function linuxPublicCandidateBuildArguments(
  arguments_ = [],
  platform = process.platform,
) {
  return [
    "--config",
    "src-tauri/tauri.public.conf.json",
    ...linuxPackageBuildArguments(arguments_, platform),
  ];
}

export function buildLinuxPublicCandidate({
  arguments_ = process.argv.slice(2),
  build = buildProductionPackage,
  configuration,
  environment = process.env,
  normalize = normalizeLinuxDebianArtifactNames,
  platform = process.platform,
} = {}) {
  validateLinuxPackageConfiguration(
    JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "src-tauri/tauri.linux.conf.json"),
        "utf8",
      ),
    ),
  );
  const updateConfiguration = configuration
    ?? loadPublicUpdateConfiguration(repositoryRoot);
  if (
    updateConfiguration.schemaVersion !== 2
    || updateConfiguration.contract !== "stable-v3"
  ) {
    throw new Error("the Linux public candidate requires recoverable stable-v3 update trust");
  }
  const publicUpdateEnvironment = publicUpdateBuildEnvironment(updateConfiguration, true);
  assertUpdaterSigningAuthority(environment);
  build({
    arguments_: linuxPublicCandidateBuildArguments(arguments_, platform),
    publicUpdateEnvironment,
  });
  normalize({
    directory: packageDirectory,
    signature: "required",
    version: packageVersion,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildLinuxPublicCandidate();
  } catch (error) {
    process.stderr.write(`Linux public candidate build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
