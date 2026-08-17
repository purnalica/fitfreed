import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const teamIdentifierPattern = /^[A-Z0-9]{10}$/;

function execute(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const status = Number.isInteger(result.status) ? result.status : "unknown";
    throw new Error(`${path.basename(command)} trust check failed with exit status ${status}`);
  }
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

function requireMatch(content, expression, message) {
  const match = content.match(expression);
  if (!match) throw new Error(message);
  return match[1];
}

export function parseCodesignDetails(details) {
  if (/^Signature=adhoc$/m.test(details)) {
    throw new Error("application uses an ad hoc signature");
  }
  if (!/^Authority=Developer ID Application:/m.test(details)) {
    throw new Error("application is not signed with a Developer ID Application identity");
  }
  if (!/^CodeDirectory\b.*\bflags=.*\bruntime\b/m.test(details)) {
    throw new Error("application signature does not enable the hardened runtime");
  }
  const timestamp = requireMatch(
    details,
    /^Timestamp=(.+)$/m,
    "application signature has no secure timestamp",
  );
  if (timestamp.trim().toLowerCase() === "none") {
    throw new Error("application signature has no secure timestamp");
  }
  const teamIdentifier = requireMatch(
    details,
    /^TeamIdentifier=([A-Z0-9]+)$/m,
    "application signature has no team identifier",
  );
  if (!teamIdentifierPattern.test(teamIdentifier)) {
    throw new Error("application signature has an invalid team identifier");
  }
  return { teamIdentifier, hardenedRuntime: true, secureTimestamp: true };
}

export function parseMinimumSystemVersion(vtoolOutput) {
  const version = requireMatch(
    vtoolOutput,
    /^\s*minos\s+([0-9]+(?:\.[0-9]+){1,2})$/m,
    "application executable has no macOS deployment target",
  );
  const components = version.split(".").map(Number);
  while (components.length < 3) components.push(0);
  if (components[0] !== 15 || components[1] !== 0 || components[2] !== 0) {
    throw new Error(`application deployment target must be 15.0, found ${version}`);
  }
  return "15.0";
}

function assertCandidatePaths(applicationPath, diskImagePath) {
  if (!existsSync(applicationPath) || !lstatSync(applicationPath).isDirectory()) {
    throw new Error("public trust inspection requires a macOS application bundle");
  }
  if (!existsSync(diskImagePath) || !lstatSync(diskImagePath).isFile()) {
    throw new Error("public trust inspection requires a macOS disk image");
  }
}

function leafCertificateSha256(runCommand, candidatePath, prefix) {
  runCommand("codesign", ["--display", "--extract-certificates", prefix, candidatePath]);
  const certificatePath = `${prefix}0`;
  if (!existsSync(certificatePath) || !lstatSync(certificatePath).isFile()) {
    throw new Error("Developer ID leaf certificate extraction failed");
  }
  return createHash("sha256").update(readFileSync(certificatePath)).digest("hex");
}

export function inspectPublicMacosTrust({
  applicationPath,
  diskImagePath,
  expectedVersion,
  expectedTeamIdentifier,
  runCommand = execute,
}) {
  if (process.platform !== "darwin" && runCommand === execute) {
    throw new Error("public macOS trust inspection requires macOS");
  }
  if (!teamIdentifierPattern.test(expectedTeamIdentifier ?? "")) {
    throw new Error("public trust inspection requires an expected Apple team identifier");
  }
  assertCandidatePaths(applicationPath, diskImagePath);
  const infoPlist = path.join(applicationPath, "Contents", "Info.plist");
  const executable = path.join(applicationPath, "Contents", "MacOS", "fitfreed");
  if (!existsSync(infoPlist) || !existsSync(executable)) {
    throw new Error("public application bundle is incomplete");
  }

  runCommand("codesign", ["--verify", "--deep", "--strict", applicationPath]);
  const signatureDetails = runCommand("codesign", ["--display", "--verbose=4", applicationPath]);
  const signing = parseCodesignDetails(signatureDetails);
  if (signing.teamIdentifier !== expectedTeamIdentifier) {
    throw new Error("application signature uses an unexpected Apple team identifier");
  }
  runCommand("codesign", ["--verify", "--strict", diskImagePath]);

  const bundleIdentifier = runCommand("plutil", [
    "-extract",
    "CFBundleIdentifier",
    "raw",
    "-o",
    "-",
    infoPlist,
  ]).trim();
  if (bundleIdentifier !== "org.fitfreed.desktop") {
    throw new Error("public application bundle identifier is invalid");
  }
  const bundleVersion = runCommand("plutil", [
    "-extract",
    "CFBundleShortVersionString",
    "raw",
    "-o",
    "-",
    infoPlist,
  ]).trim();
  if (bundleVersion !== expectedVersion) {
    throw new Error(`public application version must be ${expectedVersion}`);
  }
  const plistMinimumVersion = runCommand("plutil", [
    "-extract",
    "LSMinimumSystemVersion",
    "raw",
    "-o",
    "-",
    infoPlist,
  ]).trim();
  if (plistMinimumVersion !== "15.0") {
    throw new Error("public application minimum system version must be 15.0");
  }
  const architectures = runCommand("lipo", ["-archs", executable]).trim().split(/\s+/);
  if (architectures.length !== 1 || architectures[0] !== "arm64") {
    throw new Error("public application executable must contain only arm64");
  }
  const minimumSystemVersion = parseMinimumSystemVersion(
    runCommand("vtool", ["-show-build", executable]),
  );

  const certificateDirectory = mkdtempSync(
    path.join(tmpdir(), "fitfreed-public-certificates-"),
  );
  try {
    const applicationCertificate = leafCertificateSha256(
      runCommand,
      applicationPath,
      path.join(certificateDirectory, "application-"),
    );
    const diskImageCertificate = leafCertificateSha256(
      runCommand,
      diskImagePath,
      path.join(certificateDirectory, "disk-image-"),
    );
    if (applicationCertificate !== diskImageCertificate) {
      throw new Error("application and disk image use different signing certificates");
    }

    runCommand("xcrun", ["stapler", "validate", applicationPath]);
    runCommand("xcrun", ["stapler", "validate", diskImagePath]);
    runCommand("spctl", ["--assess", "--type", "execute", applicationPath]);
    runCommand("spctl", [
      "--assess",
      "--type",
      "open",
      "--context",
      "context:primary-signature",
      diskImagePath,
    ]);

    return {
      identity: "developer-id-application",
      certificateSha256: applicationCertificate,
      teamIdentifier: signing.teamIdentifier,
      hardenedRuntime: signing.hardenedRuntime,
      secureTimestamp: signing.secureTimestamp,
      notarization: {
        service: "apple-notary-service",
        applicationStapled: true,
        diskImageStapled: true,
        gatekeeperAccepted: true,
      },
      bundleIdentifier,
      version: bundleVersion,
      architecture: "aarch64",
      minimumSystemVersion,
    };
  } finally {
    rmSync(certificateDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const [applicationPath, diskImagePath, expectedVersion, expectedTeamIdentifier] =
      process.argv.slice(2);
    if (!applicationPath || !diskImagePath || !expectedVersion || !expectedTeamIdentifier) {
      throw new Error(
        "usage: node scripts/macos-public-trust.mjs <application> <disk-image> <version> <team-id>",
      );
    }
    process.stdout.write(
      `${JSON.stringify(inspectPublicMacosTrust({
        applicationPath,
        diskImagePath,
        expectedVersion,
        expectedTeamIdentifier,
      }))}\n`,
    );
  } catch (error) {
    process.stderr.write(`Public macOS trust inspection failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
