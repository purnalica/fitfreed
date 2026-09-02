import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedLinuxDebianArtifactName,
  linuxPackageContract,
} from "./linux-package-contract.mjs";
import { findLinuxDebianPackage } from "./verify-linux-debian-package.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const ubuntuCleanInstallImage =
  "ubuntu@sha256:1e0a86e57d247923571b75e0aaf48a1449cf8c543d51fb3e07a4a7d7bfa79316";

function cleanInstallationProgram(packageName, version) {
  const packagePath = `/candidate/${packageName}`;
  return [
    "set -Eeuo pipefail",
    "phase=environment",
    "trap 'printf \"FITFREED_PHASE=%s\\n\" \"$phase\" >&2' ERR",
    ". /etc/os-release",
    'test "$ID" = "ubuntu"',
    'test "$VERSION_ID" = "24.04"',
    'test "$(dpkg --print-architecture)" = "amd64"',
    "for command_name in node npm cargo rustc git gcc; do ! command -v \"$command_name\" >/dev/null; done",
    "phase=repository-refresh",
    "apt-get -qq update >/dev/null",
    "phase=installation",
    `apt-get -qq install -y --no-install-recommends ${packagePath} >/dev/null`,
    "phase=installed-package",
    `test "$(dpkg-query -W -f='\${Status}' ${linuxPackageContract.packageName})" = "install ok installed"`,
    `test "$(dpkg-query -W -f='\${Version}' ${linuxPackageContract.packageName})" = "${version}"`,
    `test "$(dpkg-query -W -f='\${Architecture}' ${linuxPackageContract.packageName})" = "${linuxPackageContract.architecture}"`,
    `test "$(dpkg-query -W -f='\${Maintainer}' ${linuxPackageContract.packageName})" = "${linuxPackageContract.publisher}"`,
    `test -x /${linuxPackageContract.executablePath}`,
    `test -f /${linuxPackageContract.desktopEntryPath}`,
    `test -f /${linuxPackageContract.licensePath}`,
    "phase=dynamic-linking",
    `! ldd /${linuxPackageContract.executablePath} | grep -F "not found"`,
    "phase=removal",
    `apt-get -qq purge -y ${linuxPackageContract.packageName} >/dev/null`,
    `test ! -e /${linuxPackageContract.executablePath}`,
    `test ! -e /${linuxPackageContract.desktopEntryPath}`,
    `test ! -e /${linuxPackageContract.licensePath}`,
    `! dpkg-query -W ${linuxPackageContract.packageName} >/dev/null 2>&1`,
    "phase=complete",
    'printf \'{"distribution":"ubuntu","version":"24.04","architecture":"amd64","package":"fitfreed","removed":true}\\n\'',
  ].join("\n");
}

export function linuxCleanInstallationCommand({
  packagePath,
  version,
  platform = process.platform,
  architecture = process.arch,
}) {
  if (platform !== "linux" || architecture !== "x64") {
    throw new Error("clean installation requires an x86-64 Linux host");
  }
  if (!semanticVersion.test(version ?? "")) throw new Error("invalid release version");
  if (!path.isAbsolute(packagePath) || /[,\r\n]/.test(packagePath)) {
    throw new Error("Debian artifact path must be an absolute Docker mount source");
  }
  const expectedName = expectedLinuxDebianArtifactName(version);
  if (path.basename(packagePath) !== expectedName) {
    throw new Error(`Debian artifact name must be ${expectedName}`);
  }
  const mount = [
    "type=bind",
    `source=${packagePath}`,
    `target=/candidate/${expectedName}`,
    "readonly",
  ].join(",");
  return {
    file: "docker",
    arguments: [
      "run",
      "--rm",
      "--platform",
      "linux/amd64",
      "--mount",
      mount,
      ubuntuCleanInstallImage,
      "bash",
      "-c",
      cleanInstallationProgram(expectedName, version),
    ],
  };
}

export function verifyLinuxCleanInstallation({
  packagePath,
  version,
  platform = process.platform,
  architecture = process.arch,
  run = spawnSync,
}) {
  if (!existsSync(packagePath) || !statSync(packagePath).isFile()) {
    throw new Error("the exact Debian artifact is unavailable for clean installation");
  }
  const command = linuxCleanInstallationCommand({
    architecture,
    packagePath,
    platform,
    version,
  });
  const result = run(command.file, command.arguments, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw new Error("clean installation container could not start");
  if (result.status !== 0) {
    const phase = result.stderr?.match(/FITFREED_PHASE=([a-z-]+)/)?.[1] ?? "container";
    throw new Error(`clean installation failed during ${phase}`);
  }
  let evidence;
  try {
    evidence = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("clean installation returned invalid evidence");
  }
  if (
    evidence.distribution !== "ubuntu"
    || evidence.version !== "24.04"
    || evidence.architecture !== linuxPackageContract.architecture
    || evidence.package !== linuxPackageContract.packageName
    || evidence.removed !== true
  ) {
    throw new Error("clean installation returned invalid evidence");
  }
  return evidence;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const version = JSON.parse(
      readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
    ).version;
    const packagePath = findLinuxDebianPackage(
      path.join(repositoryRoot, "src-tauri/target/release/bundle/deb"),
      version,
    );
    process.stdout.write(`${JSON.stringify(verifyLinuxCleanInstallation({ packagePath, version }))}\n`);
  } catch (error) {
    process.stderr.write(`Linux clean installation verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
