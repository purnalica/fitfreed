import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runE2eBuild } from "./build-e2e.mjs";
import { repositoryRoot } from "./e2e-paths.mjs";

const expectedConfiguration = Object.freeze({
  identifier: "org.fitfreed.desktop.e2e",
  mainBinaryName: "fitfreed-e2e",
  packageName: "fitfreed-e2e",
  productName: "fitfreed-e2e",
});
const configurationPath = path.join(
  repositoryRoot,
  "src-tauri/tauri.windows.e2e.conf.json",
);

export function validateWindowsE2ePackageConfiguration(configuration) {
  const allowedFields = ["$schema", "identifier", "mainBinaryName", "productName"];
  if (
    configuration.$schema !== "https://schema.tauri.app/config/2"
    || configuration.identifier !== expectedConfiguration.identifier
    || configuration.mainBinaryName !== expectedConfiguration.mainBinaryName
    || configuration.productName !== expectedConfiguration.productName
    || Object.keys(configuration).some((field) => !allowedFields.includes(field))
  ) {
    throw new Error("the Windows E2E package configuration is not isolated");
  }
  return { ...expectedConfiguration };
}

export function windowsE2ePackageBuildArguments(
  arguments_ = [],
  platform = process.platform,
  architecture = process.arch,
) {
  if (platform !== "win32") {
    throw new Error("the instrumented NSIS package build requires Windows");
  }
  if (architecture !== "x64") {
    throw new Error("the instrumented NSIS package build requires x86-64 Windows");
  }
  if (arguments_.some((argument) => !["--verbose", "-v"].includes(argument))) {
    throw new Error("the instrumented NSIS package build only accepts --verbose or -v");
  }
  return [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "nsis",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    "--config",
    "src-tauri/tauri.windows.conf.json",
    "--config",
    "src-tauri/tauri.windows.e2e.conf.json",
    ...arguments_,
  ];
}

export function buildWindowsE2ePackage(options = {}) {
  validateWindowsE2ePackageConfiguration(
    JSON.parse(readFileSync(configurationPath, "utf8")),
  );
  runE2eBuild({
    ...options,
    buildArguments: (arguments_) => windowsE2ePackageBuildArguments(
      arguments_,
      options.platform ?? process.platform,
      options.architecture ?? process.arch,
    ),
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildWindowsE2ePackage({ arguments_: process.argv.slice(2) });
  } catch (error) {
    process.stderr.write(`Windows E2E package build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
