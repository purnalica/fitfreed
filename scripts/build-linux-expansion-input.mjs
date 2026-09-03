import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildLinuxPackage } from "./build-linux-package.mjs";
import {
  loadPublicUpdateConfiguration,
  publicUpdateBuildEnvironment,
} from "./public-update-configuration.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export function buildLinuxExpansionInput({
  arguments_ = process.argv.slice(2),
  buildLinux = buildLinuxPackage,
  configuration,
  environment = process.env,
  platform = process.platform,
} = {}) {
  if ([
    "TAURI_SIGNING_PRIVATE_KEY",
    "TAURI_SIGNING_PRIVATE_KEY_PATH",
    "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  ].some((name) => Object.hasOwn(environment, name))) {
    throw new Error(
      "the Linux expansion input must not receive private updater signing authority",
    );
  }
  const updateConfiguration = configuration
    ?? loadPublicUpdateConfiguration(repositoryRoot);
  if (
    updateConfiguration.schemaVersion !== 2
    || updateConfiguration.status !== "active"
    || updateConfiguration.contract !== "stable-v3"
  ) {
    throw new Error(
      "the Linux expansion input requires active recoverable stable-v3 update trust",
    );
  }
  const publicUpdateEnvironment = publicUpdateBuildEnvironment(
    updateConfiguration,
    true,
  );
  buildLinux({
    arguments_,
    platform,
    publicUpdateEnvironment,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildLinuxExpansionInput();
  } catch (error) {
    process.stderr.write(`Linux expansion input build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
