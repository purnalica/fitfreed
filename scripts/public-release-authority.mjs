import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const authorityDirectoryName = "fitfreed-public-release-authority";
const sha1Pattern = /^[0-9a-fA-F]{40}$/;
const teamIdentifierPattern = /^[A-Z0-9]{10}$/;
const issuerPattern =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const keyIdentifierPattern = /^[A-Z0-9]{10}$/;
const privateKeyBoundary = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");

function requiredValue(environment, name, pattern) {
  const value = environment[name];
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error(`${name} is unavailable`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${name} is invalid`);
  return value;
}

function singleLineValue(environment, name, pattern) {
  const value = requiredValue(environment, name, pattern);
  if (value.includes("\n") || value.includes("\r")) throw new Error(`${name} is invalid`);
  return value;
}

function secureRunnerDirectory(environment, repositoryPath) {
  const runnerTemp = singleLineValue(environment, "RUNNER_TEMP");
  if (!path.isAbsolute(runnerTemp) || !existsSync(runnerTemp) || !lstatSync(runnerTemp).isDirectory()) {
    throw new Error("RUNNER_TEMP must identify an existing absolute directory");
  }
  if (lstatSync(runnerTemp).isSymbolicLink()) throw new Error("RUNNER_TEMP cannot be a symbolic link");
  const resolved = realpathSync(runnerTemp);
  const resolvedRepository = realpathSync(repositoryPath);
  const relative = path.relative(resolvedRepository, resolved);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..")) {
    throw new Error("RUNNER_TEMP must be outside the repository");
  }
  return resolved;
}

function decodeCertificate(encoded) {
  const canonical = encoded.replaceAll(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(canonical) || canonical.length % 4 !== 0) {
    throw new Error("Apple signing certificate encoding is invalid");
  }
  const certificate = Buffer.from(canonical, "base64");
  if (certificate.length === 0 || certificate.toString("base64") !== canonical) {
    throw new Error("Apple signing certificate encoding is invalid");
  }
  return certificate;
}

function validatePrivateKey(value, label) {
  if (!value.includes(privateKeyBoundary)) throw new Error(`${label} is invalid`);
  return value.endsWith("\n") ? value : `${value}\n`;
}

function parseKeychainList(output) {
  return output
    .split("\n")
    .map((line) => line.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function defaultSecurity(args, { capture = false, allowFailure = false } = {}) {
  try {
    return execFileSync("security", args, {
      encoding: "utf8",
      stdio: capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "ignore"],
    })?.trim() ?? "";
  } catch {
    if (allowFailure) return "";
    throw new Error("macOS release authority configuration failed");
  }
}

function restoreKeychains(state, runSecurity) {
  if (state?.previousSearchList?.length > 0) {
    runSecurity(["list-keychains", "-d", "user", "-s", ...state.previousSearchList], {
      allowFailure: true,
    });
  }
  if (state?.previousDefault) {
    runSecurity(["default-keychain", "-d", "user", "-s", state.previousDefault], {
      allowFailure: true,
    });
  }
}

function removeAuthority(authorityDirectory, state, runSecurity) {
  if (state?.keychainPath) {
    restoreKeychains(state, runSecurity);
    runSecurity(["delete-keychain", state.keychainPath], { allowFailure: true });
  }
  rmSync(authorityDirectory, { force: true, recursive: true });
}

export function installPublicReleaseAuthority(environment, options = {}) {
  const repositoryPath = options.repositoryPath ?? repositoryRoot;
  const runSecurity = options.runSecurity ?? defaultSecurity;
  const createPassword = options.createPassword ?? (() => randomBytes(32).toString("hex"));
  const runnerTemp = secureRunnerDirectory(environment, repositoryPath);
  const githubEnvironmentPath = singleLineValue(environment, "GITHUB_ENV");
  if (!path.isAbsolute(githubEnvironmentPath)) {
    throw new Error("GITHUB_ENV must identify an absolute file");
  }

  const certificatePassword = requiredValue(
    environment,
    "FITFREED_APPLE_CERTIFICATE_PASSWORD",
  );
  const certificate = decodeCertificate(
    requiredValue(environment, "FITFREED_APPLE_CERTIFICATE_BASE64"),
  );
  const signingIdentity = singleLineValue(environment, "APPLE_SIGNING_IDENTITY", sha1Pattern)
    .toLowerCase();
  const teamIdentifier = singleLineValue(
    environment,
    "FITFREED_EXPECTED_APPLE_TEAM_ID",
    teamIdentifierPattern,
  );
  const apiIssuer = singleLineValue(environment, "APPLE_API_ISSUER", issuerPattern);
  const apiKey = singleLineValue(environment, "APPLE_API_KEY", keyIdentifierPattern);
  const apiPrivateKey = validatePrivateKey(
    requiredValue(environment, "FITFREED_APPLE_API_PRIVATE_KEY"),
    "App Store Connect private key",
  );
  const updaterPrivateKey = requiredValue(environment, "FITFREED_UPDATER_PRIVATE_KEY");
  requiredValue(environment, "TAURI_SIGNING_PRIVATE_KEY_PASSWORD");

  const authorityDirectory = path.join(runnerTemp, authorityDirectoryName);
  const certificatePath = path.join(authorityDirectory, "developer-id.p12");
  const apiKeyPath = path.join(authorityDirectory, `AuthKey_${apiKey}.p8`);
  const updaterKeyPath = path.join(authorityDirectory, "updater.key");
  const keychainPath = path.join(authorityDirectory, "release.keychain-db");
  const statePath = path.join(authorityDirectory, "state.json");
  const keychainPassword = createPassword();
  if (typeof keychainPassword !== "string" || keychainPassword.length < 32) {
    throw new Error("ephemeral keychain password generation failed");
  }

  rmSync(authorityDirectory, { force: true, recursive: true });
  mkdirSync(authorityDirectory, { mode: 0o700 });
  const state = {
    keychainPath,
    previousDefault: runSecurity(["default-keychain", "-d", "user"], { capture: true })
      .replace(/^"|"$/g, ""),
    previousSearchList: parseKeychainList(
      runSecurity(["list-keychains", "-d", "user"], { capture: true }),
    ),
  };

  try {
    writeFileSync(certificatePath, certificate, { mode: 0o600 });
    writeFileSync(apiKeyPath, apiPrivateKey, { mode: 0o600 });
    writeFileSync(updaterKeyPath, updaterPrivateKey, { mode: 0o600 });
    writeFileSync(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 });
    for (const file of [certificatePath, apiKeyPath, updaterKeyPath, statePath]) chmodSync(file, 0o600);

    runSecurity(["create-keychain", "-p", keychainPassword, keychainPath]);
    runSecurity(["set-keychain-settings", "-lut", "21600", keychainPath]);
    runSecurity(["unlock-keychain", "-p", keychainPassword, keychainPath]);
    runSecurity([
      "import",
      certificatePath,
      "-k",
      keychainPath,
      "-P",
      certificatePassword,
      "-T",
      "/usr/bin/codesign",
      "-T",
      "/usr/bin/productsign",
    ]);
    runSecurity([
      "set-key-partition-list",
      "-S",
      "apple-tool:,apple:",
      "-s",
      "-k",
      keychainPassword,
      keychainPath,
    ]);
    runSecurity([
      "list-keychains",
      "-d",
      "user",
      "-s",
      keychainPath,
      ...state.previousSearchList.filter((candidate) => candidate !== keychainPath),
    ]);
    runSecurity(["default-keychain", "-d", "user", "-s", keychainPath]);
    const identities = runSecurity(
      ["find-identity", "-v", "-p", "codesigning", keychainPath],
      { capture: true },
    );
    const fingerprints = [...identities.matchAll(/^\s*\d+\)\s+([0-9A-F]{40})\s+/gim)]
      .map(([, fingerprint]) => fingerprint.toLowerCase());
    if (fingerprints.filter((fingerprint) => fingerprint === signingIdentity).length !== 1) {
      throw new Error("expected Apple signing identity is unavailable in the ephemeral keychain");
    }

    const exposedEnvironment = [
      ["APPLE_SIGNING_IDENTITY", signingIdentity],
      ["FITFREED_EXPECTED_APPLE_TEAM_ID", teamIdentifier],
      ["APPLE_API_ISSUER", apiIssuer],
      ["APPLE_API_KEY", apiKey],
      ["APPLE_API_KEY_PATH", apiKeyPath],
      ["TAURI_SIGNING_PRIVATE_KEY_PATH", updaterKeyPath],
    ];
    appendFileSync(
      githubEnvironmentPath,
      `${exposedEnvironment.map(([name, value]) => `${name}=${value}`).join("\n")}\n`,
    );
    return {
      authorityDirectory,
      signingIdentity,
      teamIdentifier,
      notarizationMode: "app-store-connect-api",
    };
  } catch (error) {
    removeAuthority(authorityDirectory, state, runSecurity);
    throw error;
  }
}

export function cleanPublicReleaseAuthority(environment, options = {}) {
  const repositoryPath = options.repositoryPath ?? repositoryRoot;
  const runSecurity = options.runSecurity ?? defaultSecurity;
  const runnerTemp = secureRunnerDirectory(environment, repositoryPath);
  const authorityDirectory = path.join(runnerTemp, authorityDirectoryName);
  if (!existsSync(authorityDirectory)) return { cleaned: false };
  const statePath = path.join(authorityDirectory, "state.json");
  let state;
  try {
    state = JSON.parse(readFileSync(statePath, "utf8"));
    if (state.keychainPath !== path.join(authorityDirectory, "release.keychain-db")) {
      throw new Error("release authority state identifies an unexpected keychain");
    }
  } catch {
    runSecurity(["delete-keychain", path.join(authorityDirectory, "release.keychain-db")], {
      allowFailure: true,
    });
    rmSync(authorityDirectory, { force: true, recursive: true });
    throw new Error("release authority cleanup state is invalid");
  }
  removeAuthority(authorityDirectory, state, runSecurity);
  return { cleaned: true };
}

function main() {
  const [operation] = process.argv.slice(2);
  if (operation === "install") {
    const result = installPublicReleaseAuthority(process.env);
    process.stdout.write(`${JSON.stringify({
      installed: true,
      signingIdentity: result.signingIdentity,
      teamIdentifier: result.teamIdentifier,
      notarizationMode: result.notarizationMode,
    })}\n`);
    return;
  }
  if (operation === "cleanup") {
    process.stdout.write(`${JSON.stringify(cleanPublicReleaseAuthority(process.env))}\n`);
    return;
  }
  throw new Error("usage: node scripts/public-release-authority.mjs <install|cleanup>");
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Public release authority command failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
