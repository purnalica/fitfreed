import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";

const sha1Pattern = /^[0-9a-f]{40}$/;
const appStoreConnectIssuerPattern = /^[0-9a-fA-F-]{36}$/;
const appStoreConnectKeyPattern = /^[A-Z0-9]{10}$/;
const diskImageIdentifier = "org.fitfreed.desktop.dmg";

function execute(stage, command, arguments_) {
  const result = spawnSync(command, arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const status = Number.isInteger(result.status) ? result.status : "unknown";
    throw new Error(`${stage} failed with exit status ${status}`);
  }
  return result.stdout ?? "";
}

function notarizationArguments(signing, environment) {
  if (signing.notarizationMode === "app-store-connect-api") {
    if (
      typeof signing.apiKeyPath !== "string"
      || !existsSync(signing.apiKeyPath)
      || !lstatSync(signing.apiKeyPath).isFile()
      || !appStoreConnectKeyPattern.test(environment.APPLE_API_KEY ?? "")
      || !appStoreConnectIssuerPattern.test(environment.APPLE_API_ISSUER ?? "")
    ) {
      throw new Error("disk-image notarization authority is incomplete");
    }
    return [
      "--key",
      signing.apiKeyPath,
      "--key-id",
      environment.APPLE_API_KEY,
      "--issuer",
      environment.APPLE_API_ISSUER,
    ];
  }
  if (
    signing.notarizationMode !== "apple-id"
    || typeof environment.APPLE_ID !== "string"
    || environment.APPLE_ID.length === 0
    || typeof environment.APPLE_PASSWORD !== "string"
    || environment.APPLE_PASSWORD.length === 0
    || typeof environment.APPLE_TEAM_ID !== "string"
    || environment.APPLE_TEAM_ID.length === 0
    || environment.APPLE_TEAM_ID !== signing.expectedTeamIdentifier
  ) {
    throw new Error("disk-image notarization authority is incomplete");
  }
  return [
    "--apple-id",
    environment.APPLE_ID,
    "--password",
    environment.APPLE_PASSWORD,
    "--team-id",
    environment.APPLE_TEAM_ID,
  ];
}

function parseJson(output, label) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`${label} did not return valid JSON`);
  }
}

export function finalizePublicMacosDiskImage({
  diskImagePath,
  environment,
  signing,
  runCommand = execute,
}) {
  if (process.platform !== "darwin" && runCommand === execute) {
    throw new Error("public macOS disk-image finalization requires macOS");
  }
  if (!existsSync(diskImagePath) || !lstatSync(diskImagePath).isFile()) {
    throw new Error("public macOS disk-image finalization requires a regular file");
  }
  if (!sha1Pattern.test(signing?.signingIdentity ?? "")) {
    throw new Error("disk-image signing identity must be a certificate SHA-1 fingerprint");
  }
  const authorityArguments = notarizationArguments(signing, environment);

  runCommand("disk-image-integrity", "hdiutil", ["verify", diskImagePath]);
  runCommand("disk-image-signature", "codesign", [
    "--force",
    "--sign",
    signing.signingIdentity,
    "--timestamp",
    "--identifier",
    diskImageIdentifier,
    diskImagePath,
  ]);
  runCommand("disk-image-signature-verification", "codesign", [
    "--verify",
    "--strict",
    diskImagePath,
  ]);

  const submission = parseJson(runCommand("disk-image-notarization", "xcrun", [
    "notarytool",
    "submit",
    diskImagePath,
    "--output-format",
    "json",
    "--wait",
    "--timeout",
    "20m",
    ...authorityArguments,
  ]), "disk-image notarization submission");
  if (submission.status !== "Accepted" || typeof submission.id !== "string") {
    throw new Error("disk-image notarization was not accepted");
  }

  const log = parseJson(runCommand("disk-image-notarization-log", "xcrun", [
    "notarytool",
    "log",
    submission.id,
    ...authorityArguments,
  ]), "disk-image notarization log");
  if (log.status !== "Accepted") {
    throw new Error("disk-image notarization log does not confirm acceptance");
  }
  if (Array.isArray(log.issues) && log.issues.length > 0) {
    throw new Error("disk-image notarization log reported issues");
  }
  if (log.issues !== null && !Array.isArray(log.issues)) {
    throw new Error("disk-image notarization log has an invalid issues field");
  }

  runCommand("disk-image-stapling", "xcrun", ["stapler", "staple", "-v", diskImagePath]);
  runCommand("disk-image-ticket-validation", "xcrun", [
    "stapler",
    "validate",
    diskImagePath,
  ]);
  return {
    identifier: diskImageIdentifier,
    notarized: true,
    stapled: true,
  };
}
