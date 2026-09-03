import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionPackage } from "./build-production.mjs";
import { normalizeLinuxDebianArtifactNames } from "./linux-debian-artifact-identity.mjs";
import {
  linuxPackageContract,
  validateLinuxPackageConfiguration,
} from "./linux-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const packageVersion = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
).version;
const packageDirectory = path.join(
  repositoryRoot,
  "src-tauri/target/release/bundle/deb",
);

export function linuxPackageBuildArguments(arguments_ = [], platform = process.platform) {
  if (platform !== linuxPackageContract.platform) {
    throw new Error("the Debian package build requires Linux");
  }
  if (arguments_.some((argument) => !["--verbose", "-v"].includes(argument))) {
    throw new Error("the Debian package build only accepts --verbose or -v");
  }
  return ["--bundles", linuxPackageContract.target, ...arguments_];
}

export function buildLinuxPackage({
  arguments_ = process.argv.slice(2),
  build = buildProductionPackage,
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
  build({ arguments_: linuxPackageBuildArguments(arguments_, platform) });
  normalize({
    directory: packageDirectory,
    signature: "optional",
    version: packageVersion,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildLinuxPackage();
  } catch (error) {
    process.stderr.write(`Linux package build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
