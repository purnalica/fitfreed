import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionPackage } from "./build-production.mjs";
import {
  linuxPackageContract,
  validateLinuxPackageConfiguration,
} from "./linux-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export function linuxPackageBuildArguments(arguments_ = [], platform = process.platform) {
  if (platform !== linuxPackageContract.platform) {
    throw new Error("the Debian package build requires Linux");
  }
  if (arguments_.some((argument) => !["--verbose", "-v"].includes(argument))) {
    throw new Error("the Debian package build only accepts --verbose or -v");
  }
  return ["--bundles", linuxPackageContract.target, ...arguments_];
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    validateLinuxPackageConfiguration(
      JSON.parse(
        readFileSync(
          path.join(repositoryRoot, "src-tauri/tauri.linux.conf.json"),
          "utf8",
        ),
      ),
    );
    buildProductionPackage({
      arguments_: linuxPackageBuildArguments(process.argv.slice(2)),
    });
  } catch (error) {
    process.stderr.write(`Linux package build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
