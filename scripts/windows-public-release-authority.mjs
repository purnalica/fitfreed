import { spawnSync } from "node:child_process";
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

import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const authorityDirectoryName = "fitfreed-windows-public-release-authority";
const authorityScriptRelativePath = "scripts/windows-public-release-authority.ps1";
const authorityScript = path.join(repositoryRoot, authorityScriptRelativePath);
const certificateSha1Pattern = /^[0-9a-fA-F]{40}$/;
const certificateSha256Pattern = /^[0-9a-f]{64}$/;
const exposedAuthorityNames = [
  "FITFREED_WINDOWS_AUTHENTICODE_PROFILE",
  "FITFREED_WINDOWS_CERTIFICATE_SHA1",
  "FITFREED_WINDOWS_CERTIFICATE_SHA256",
  "FITFREED_WINDOWS_SIGNTOOL_PATH",
  "FITFREED_WINDOWS_TIMESTAMP_URL",
];

function requiredSingleLine(environment, name, pattern) {
  const value = environment[name];
  if (
    typeof value !== "string"
    || value.length === 0
    || value.includes("\0")
    || value.includes("\n")
    || value.includes("\r")
    || (pattern && !pattern.test(value))
  ) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function publicTimestampUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:"
      || url.username.length > 0
      || url.password.length > 0
      || url.search.length > 0
      || url.hash.length > 0
    ) {
      throw new Error("invalid URL boundary");
    }
    return url.href;
  } catch {
    throw new Error("Windows public release timestamp URL is invalid");
  }
}

function secureRunnerDirectory(environment, repositoryPath) {
  const runnerTemp = requiredSingleLine(environment, "RUNNER_TEMP");
  if (
    !path.isAbsolute(runnerTemp)
    || !existsSync(runnerTemp)
    || !lstatSync(runnerTemp).isDirectory()
    || lstatSync(runnerTemp).isSymbolicLink()
  ) {
    throw new Error("RUNNER_TEMP must identify an existing absolute directory");
  }
  const resolved = realpathSync(runnerTemp);
  const resolvedRepository = realpathSync(repositoryPath);
  const relative = path.relative(resolvedRepository, resolved);
  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..")) {
    throw new Error("RUNNER_TEMP must be outside the repository");
  }
  return resolved;
}

function githubEnvironmentPath(environment) {
  const candidate = requiredSingleLine(environment, "GITHUB_ENV");
  if (
    !path.isAbsolute(candidate)
    || !existsSync(candidate)
    || !lstatSync(candidate).isFile()
    || lstatSync(candidate).isSymbolicLink()
  ) {
    throw new Error("GITHUB_ENV must identify an existing absolute regular file");
  }
  return candidate;
}

function decodeCertificate(encoded) {
  const canonical = encoded.replaceAll(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(canonical) || canonical.length % 4 !== 0) {
    throw new Error("Windows signing certificate encoding is invalid");
  }
  const certificate = Buffer.from(canonical, "base64");
  if (certificate.length === 0 || certificate.toString("base64") !== canonical) {
    throw new Error("Windows signing certificate encoding is invalid");
  }
  return certificate;
}

function requireWindowsHost(platform, architecture) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Windows public release authority requires x86-64 Windows");
  }
}

function defaultRunPowerShell(operation) {
  const arguments_ = [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    authorityScript,
    "-Operation",
    operation.operation === "cleanup" ? "Cleanup" : "Install",
    "-StatePath",
    operation.statePath,
  ];
  if (operation.operation === "install") {
    arguments_.push(
      "-CertificatePath",
      operation.certificatePath,
      "-ExpectedCertificateSha256",
      operation.expectedCertificateSha256,
    );
  }
  const environment = windowsNativeToolEnvironment(operation.environment);
  if (operation.operation === "install") {
    environment.FITFREED_WINDOWS_CERTIFICATE_PASSWORD = operation.certificatePassword;
  }
  const result = spawnSync("powershell.exe", arguments_, {
    encoding: "utf8",
    env: environment,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    const phase = result.stderr?.match(/FITFREED_WINDOWS_AUTHORITY_PHASE=([a-z-]+)/)?.[1]
      ?? "native-adapter";
    throw new Error(`Windows public release authority failed during ${phase}`);
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("Windows public release authority returned invalid evidence");
  }
}

function validateInstallEvidence(facts, expectedCertificateSha256) {
  const allowed = [
    "certificateSha1",
    "certificateSha256",
    "operation",
    "schemaVersion",
    "signToolPath",
  ];
  if (
    Object.keys(facts ?? {}).sort().join("\n") !== allowed.sort().join("\n")
    || facts.schemaVersion !== 1
    || facts.operation !== "installed"
    || !certificateSha1Pattern.test(facts.certificateSha1 ?? "")
    || facts.certificateSha256 !== expectedCertificateSha256
    || typeof facts.signToolPath !== "string"
    || !path.win32.isAbsolute(facts.signToolPath)
    || path.win32.basename(facts.signToolPath).toLowerCase() !== "signtool.exe"
  ) {
    throw new Error("Windows public release authority installation evidence is invalid");
  }
  return facts;
}

function validateCleanupEvidence(facts) {
  const allowed = ["authorityRemoved", "operation", "schemaVersion"];
  if (
    Object.keys(facts ?? {}).sort().join("\n") !== allowed.sort().join("\n")
    || facts.schemaVersion !== 1
    || facts.operation !== "cleaned"
    || facts.authorityRemoved !== true
  ) {
    throw new Error("Windows public release authority cleanup evidence is invalid");
  }
  return facts;
}

function exposeAuthority(githubEnvironment, facts, timestampUrl) {
  appendFileSync(githubEnvironment, [
    "FITFREED_WINDOWS_AUTHENTICODE_PROFILE=public",
    `FITFREED_WINDOWS_CERTIFICATE_SHA1=${facts.certificateSha1}`,
    `FITFREED_WINDOWS_CERTIFICATE_SHA256=${facts.certificateSha256}`,
    `FITFREED_WINDOWS_SIGNTOOL_PATH=${facts.signToolPath}`,
    `FITFREED_WINDOWS_TIMESTAMP_URL=${timestampUrl}`,
    "",
  ].join("\n"));
}

function clearExposedAuthority(githubEnvironment) {
  appendFileSync(
    githubEnvironment,
    `${exposedAuthorityNames.map((name) => `${name}=`).join("\n")}\n`,
  );
}

export function installWindowsPublicReleaseAuthority(environment, options = {}) {
  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  const repositoryPath = options.repositoryPath ?? repositoryRoot;
  const runPowerShell = options.runPowerShell ?? defaultRunPowerShell;
  requireWindowsHost(platform, architecture);
  const runnerTemp = secureRunnerDirectory(environment, repositoryPath);
  const githubEnvironment = githubEnvironmentPath(environment);
  const certificatePassword = requiredSingleLine(
    environment,
    "FITFREED_WINDOWS_CERTIFICATE_PASSWORD",
  );
  const expectedCertificateSha256 = requiredSingleLine(
    environment,
    "FITFREED_WINDOWS_CERTIFICATE_SHA256",
    certificateSha256Pattern,
  );
  const timestampUrl = publicTimestampUrl(
    requiredSingleLine(environment, "FITFREED_WINDOWS_TIMESTAMP_URL"),
  );
  const certificate = decodeCertificate(
    requiredSingleLine(environment, "FITFREED_WINDOWS_CERTIFICATE_BASE64"),
  );
  const authorityDirectory = path.join(runnerTemp, authorityDirectoryName);
  const certificatePath = path.join(authorityDirectory, "authenticode.pfx");
  const statePath = path.join(authorityDirectory, "state.json");
  rmSync(authorityDirectory, { force: true, recursive: true });
  mkdirSync(authorityDirectory, { mode: 0o700 });
  try {
    writeFileSync(certificatePath, certificate, { mode: 0o600 });
    chmodSync(certificatePath, 0o600);
    const facts = validateInstallEvidence(runPowerShell({
      certificatePassword,
      certificatePath,
      environment,
      expectedCertificateSha256,
      operation: "install",
      statePath,
    }), expectedCertificateSha256);
    if (!existsSync(statePath) || !lstatSync(statePath).isFile()) {
      throw new Error("Windows public release authority state is unavailable");
    }
    rmSync(certificatePath, { force: true });
    exposeAuthority(githubEnvironment, facts, timestampUrl);
    return { ...facts, authorityDirectory, timestampUrl };
  } catch {
    const cleanupStateAvailable = existsSync(statePath)
      && lstatSync(statePath).isFile()
      && !lstatSync(statePath).isSymbolicLink();
    if (cleanupStateAvailable) {
      try {
        validateCleanupEvidence(runPowerShell({
          environment,
          operation: "cleanup",
          statePath,
        }));
        rmSync(authorityDirectory, { force: true, recursive: true });
      } catch {
        // Preserve the state required for an unconditional workflow cleanup retry.
      }
    } else {
      rmSync(authorityDirectory, { force: true, recursive: true });
    }
    try {
      clearExposedAuthority(githubEnvironment);
    } catch {
      // The generic failure below remains the only emitted diagnostic.
    }
    throw new Error("Windows public release authority installation failed");
  } finally {
    rmSync(certificatePath, { force: true });
  }
}

export function cleanWindowsPublicReleaseAuthority(environment, options = {}) {
  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  const repositoryPath = options.repositoryPath ?? repositoryRoot;
  const runPowerShell = options.runPowerShell ?? defaultRunPowerShell;
  requireWindowsHost(platform, architecture);
  const runnerTemp = secureRunnerDirectory(environment, repositoryPath);
  const githubEnvironment = githubEnvironmentPath(environment);
  const authorityDirectory = path.join(runnerTemp, authorityDirectoryName);
  const statePath = path.join(authorityDirectory, "state.json");
  if (!existsSync(authorityDirectory)) {
    clearExposedAuthority(githubEnvironment);
    return { cleaned: false };
  }
  try {
    if (!existsSync(statePath) || !lstatSync(statePath).isFile()) {
      throw new Error("Windows public release authority cleanup state is unavailable");
    }
    const facts = validateCleanupEvidence(runPowerShell({
      environment,
      operation: "cleanup",
      statePath,
    }));
    rmSync(authorityDirectory, { force: true, recursive: true });
    clearExposedAuthority(githubEnvironment);
    return { authorityRemoved: facts.authorityRemoved, cleaned: true };
  } catch {
    try {
      clearExposedAuthority(githubEnvironment);
    } catch {
      // Preserve the original cleanup failure as the public diagnostic.
    }
    throw new Error("Windows public release authority cleanup failed");
  }
}

function main() {
  const [operation] = process.argv.slice(2);
  if (operation === "install") {
    const result = installWindowsPublicReleaseAuthority(process.env);
    process.stdout.write(`${JSON.stringify({
      certificateSha256: result.certificateSha256,
      installed: true,
      profile: "public",
    })}\n`);
    return;
  }
  if (operation === "cleanup") {
    process.stdout.write(`${JSON.stringify(cleanWindowsPublicReleaseAuthority(process.env))}\n`);
    return;
  }
  throw new Error(
    "usage: node scripts/windows-public-release-authority.mjs <install|cleanup>",
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
