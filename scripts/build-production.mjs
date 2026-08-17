import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const revisionPattern = /^[0-9a-f]{40,64}$/;
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicUpdateBuildKeys = [
  "FITFREED_PUBLIC_UPDATE_CONTRACT",
  "FITFREED_PUBLIC_UPDATE_ENDPOINT",
  "FITFREED_PUBLIC_UPDATE_TRUST",
];

export function productionBuildIdentity(revision, status) {
  if (!revisionPattern.test(revision)) throw new Error("invalid Git revision for production build");
  return {
    FITFREED_SOURCE_REVISION: revision,
    FITFREED_SOURCE_TREE_CLEAN: status.length === 0 ? "true" : "false",
  };
}

export function productionBuildEnvironment(
  inheritedEnvironment,
  identity,
  publicUpdateEnvironment = {},
) {
  const environment = { ...inheritedEnvironment };
  for (const key of publicUpdateBuildKeys) delete environment[key];
  const suppliedKeys = Object.keys(publicUpdateEnvironment);
  if (
    suppliedKeys.some((key) => !publicUpdateBuildKeys.includes(key))
    || (suppliedKeys.length !== 0 && suppliedKeys.length !== publicUpdateBuildKeys.length)
    || publicUpdateBuildKeys.some(
      (key) => suppliedKeys.length > 0 && typeof publicUpdateEnvironment[key] !== "string",
    )
  ) {
    throw new Error("invalid explicit public update build environment");
  }
  return { ...environment, ...identity, ...publicUpdateEnvironment };
}

function git(arguments_) {
  return execFileSync("git", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function buildProductionPackage({
  arguments_ = process.argv.slice(2),
  publicUpdateEnvironment = {},
} = {}) {
  const revision = git(["rev-parse", "HEAD"]);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  const identity = productionBuildIdentity(revision, status);
  execFileSync(
    path.join(repositoryRoot, "node_modules/.bin/tauri"),
    ["build", ...arguments_],
    {
      cwd: repositoryRoot,
      env: productionBuildEnvironment(process.env, identity, publicUpdateEnvironment),
      stdio: "inherit",
    },
  );
  if (
    git(["rev-parse", "HEAD"]) !== revision ||
    git(["status", "--porcelain=v1", "--untracked-files=all"]) !== status
  ) {
    throw new Error("source changed while the production package was being built");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    buildProductionPackage();
  } catch (error) {
    process.stderr.write(`Production build failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
