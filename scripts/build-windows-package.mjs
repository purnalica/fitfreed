import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionPackage } from "./build-production.mjs";
import {
  validateWindowsPackageConfiguration,
  windowsPackageContract,
} from "./windows-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;

export function windowsPackageBuildArguments(
  arguments_ = [],
  platform = process.platform,
  architecture = process.arch,
) {
  if (platform !== windowsPackageContract.platform) {
    throw new Error("the NSIS package build requires Windows");
  }
  if (architecture !== "x64") {
    throw new Error("the NSIS package build requires x86-64 Windows");
  }
  if (arguments_.some((argument) => !["--verbose", "-v"].includes(argument))) {
    throw new Error("the NSIS package build only accepts --verbose or -v");
  }
  return ["--bundles", windowsPackageContract.target, ...arguments_];
}

export function buildWindowsPackage({
  arguments_ = process.argv.slice(2),
  architecture = process.arch,
  build = buildProductionPackage,
  platform = process.platform,
} = {}) {
  validateWindowsPackageConfiguration(
    JSON.parse(
      readFileSync(
        path.join(repositoryRoot, "src-tauri/tauri.windows.conf.json"),
        "utf8",
      ),
    ),
    packageVersion,
  );
  build({
    arguments_: windowsPackageBuildArguments(arguments_, platform, architecture),
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildWindowsPackage();
  } catch (error) {
    process.stderr.write(`Windows package build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
