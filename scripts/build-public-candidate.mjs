import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionPackage } from "./build-production.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function publicCandidateBuildArguments(additionalArguments = []) {
  return [
    "--config",
    "src-tauri/tauri.public.conf.json",
    ...additionalArguments,
  ];
}

export function assertUpdaterSigningAuthority(environment) {
  const inlineKey = environment.TAURI_SIGNING_PRIVATE_KEY;
  const keyPath = environment.TAURI_SIGNING_PRIVATE_KEY_PATH;
  if (
    (typeof inlineKey !== "string" || inlineKey.length === 0)
    && (typeof keyPath !== "string" || keyPath.length === 0)
  ) {
    throw new Error("updater signing authority is unavailable");
  }
}

function buildPublicCandidate() {
  const configuration = loadPublicUpdateConfiguration(repositoryRoot);
  const publicUpdateEnvironment = publicUpdateBuildEnvironment(configuration, true);
  assertUpdaterSigningAuthority(process.env);
  buildProductionPackage({
    arguments_: publicCandidateBuildArguments(process.argv.slice(2)),
    publicUpdateEnvironment,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildPublicCandidate();
  } catch (error) {
    process.stderr.write(`Public candidate build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
