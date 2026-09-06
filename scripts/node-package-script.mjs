import {
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const defaultRepositoryRoot = path.resolve(import.meta.dirname, "..");
const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const binaryNamePattern = /^[a-z0-9][a-z0-9._-]*$/;

export function npmCliInvocation(
  arguments_,
  platform = process.platform,
  npmCliPath = process.env.npm_execpath,
  nodeExecutable = process.execPath,
) {
  if (platform !== "win32") {
    return { arguments: arguments_, program: "npm" };
  }
  if (!npmCliPath) {
    throw new Error("the npm CLI path is unavailable; invoke this command through an npm script");
  }
  return {
    arguments: [npmCliPath, ...arguments_],
    program: nodeExecutable,
  };
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== ""
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

export function nodePackageScriptPath(
  packageName,
  binaryName,
  repositoryRoot = defaultRepositoryRoot,
) {
  if (!packageNamePattern.test(packageName) || !binaryNamePattern.test(binaryName)) {
    throw new Error("invalid Node.js package binary identity");
  }
  const packageRoot = path.join(repositoryRoot, "node_modules", ...packageName.split("/"));
  const manifest = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  const declaredPath = typeof manifest.bin === "string"
    ? manifest.bin
    : manifest.bin?.[binaryName];
  const portablePath = typeof declaredPath === "string" && declaredPath.startsWith("./")
    ? declaredPath.slice(2)
    : declaredPath;
  if (
    typeof declaredPath !== "string"
    || declaredPath.length === 0
    || path.isAbsolute(declaredPath)
    || declaredPath.includes("\\")
    || portablePath.length === 0
    || path.posix.normalize(portablePath) !== portablePath
  ) {
    throw new Error(`invalid ${packageName} package binary declaration for ${binaryName}`);
  }

  const realPackageRoot = realpathSync(packageRoot);
  const scriptPath = realpathSync(path.resolve(packageRoot, declaredPath));
  if (!isInside(realPackageRoot, scriptPath)) {
    throw new Error(`${packageName} package binary must remain inside its package`);
  }
  if (!scriptPath.endsWith(".js") || !statSync(scriptPath).isFile()) {
    throw new Error(`${packageName} package binary must be a JavaScript file`);
  }
  return scriptPath;
}
