import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runE2eBuild } from "./build-e2e.mjs";
import { repositoryRoot } from "./e2e-paths.mjs";

const expectedConfiguration = Object.freeze({
  identifier: "org.fitfreed.desktop.e2e",
  mainBinaryName: "fitfreed-e2e",
  packageName: "fitfreed-e2e",
  productName: "FitFreed E2E",
});
const configurationPath = path.join(
  repositoryRoot,
  "src-tauri/tauri.linux.e2e.conf.json",
);

export function validateLinuxE2ePackageConfiguration(configuration) {
  const allowedFields = ["$schema", "identifier", "mainBinaryName", "productName"];
  if (
    configuration.$schema !== "https://schema.tauri.app/config/2"
    || configuration.identifier !== expectedConfiguration.identifier
    || configuration.mainBinaryName !== expectedConfiguration.mainBinaryName
    || configuration.productName !== expectedConfiguration.productName
    || Object.keys(configuration).some((field) => !allowedFields.includes(field))
  ) {
    throw new Error("the Linux E2E package configuration is not isolated");
  }
  return { ...expectedConfiguration };
}

export function linuxE2ePackageBuildArguments(
  arguments_ = [],
  platform = process.platform,
) {
  if (platform !== "linux") {
    throw new Error("the instrumented Debian package build requires Linux");
  }
  if (arguments_.some((argument) => !["--verbose", "-v"].includes(argument))) {
    throw new Error("the instrumented Debian package build only accepts --verbose or -v");
  }
  return [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "deb",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    "--config",
    "src-tauri/tauri.linux.conf.json",
    "--config",
    "src-tauri/tauri.linux.e2e.conf.json",
    ...arguments_,
  ];
}

export function buildLinuxE2ePackage(options = {}) {
  validateLinuxE2ePackageConfiguration(
    JSON.parse(readFileSync(configurationPath, "utf8")),
  );
  runE2eBuild({
    ...options,
    buildArguments: (arguments_) => linuxE2ePackageBuildArguments(
      arguments_,
      options.platform ?? process.platform,
    ),
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildLinuxE2ePackage({ arguments_: process.argv.slice(2) });
  } catch (error) {
    process.stderr.write(`Linux E2E package build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
