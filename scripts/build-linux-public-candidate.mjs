import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertUpdaterSigningAuthority } from "./build-public-candidate.mjs";
import { linuxPackageBuildArguments } from "./build-linux-package.mjs";
import { buildProductionPackage } from "./build-production.mjs";
import { validateLinuxPackageConfiguration } from "./linux-package-contract.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

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

function buildLinuxPublicCandidate() {
  validateLinuxPackageConfiguration(
    JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "src-tauri/tauri.linux.conf.json"),
        "utf8",
      ),
    ),
  );
  const configuration = loadPublicUpdateConfiguration(repositoryRoot);
  const publicUpdateEnvironment = publicUpdateBuildEnvironment(configuration, true);
  assertUpdaterSigningAuthority(process.env);
  buildProductionPackage({
    arguments_: linuxPublicCandidateBuildArguments(process.argv.slice(2)),
    publicUpdateEnvironment,
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
