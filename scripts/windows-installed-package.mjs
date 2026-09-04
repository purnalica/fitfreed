import path from "node:path";

import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";

const packageActionScript = path.resolve(
  import.meta.dirname,
  "run-installed-windows-package.ps1",
);
const supportedActions = new Set([
  "install",
  "preflight",
  "query",
  "remove",
  "reset-data",
]);

export function windowsInstalledPackageActionCommand({
  action,
  architecture = process.arch,
  packagePath,
  platform = process.platform,
  version,
}) {
  if (!supportedActions.has(action)) {
    throw new Error("unsupported installed Windows package action");
  }
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("installed package lifecycle requires x86-64 Windows");
  }
  const arguments_ = [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    packageActionScript,
    "-Action",
    action,
  ];
  if (action === "install") {
    if (!path.isAbsolute(packagePath ?? "")) {
      throw new Error("the Windows package path must be absolute");
    }
    if (path.basename(packagePath) !== expectedWindowsNsisArtifactName(version ?? "")) {
      throw new Error("the Windows package name is invalid");
    }
    arguments_.push(
      "-PackagePath",
      packagePath,
      "-ExpectedVersion",
      version,
    );
  }
  return { file: "powershell.exe", arguments: arguments_ };
}
