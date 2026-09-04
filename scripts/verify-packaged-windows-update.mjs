import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createUpdateBuildConfiguration,
  createUpdateEnvelope,
  createUpdatePayload,
  updateTarget,
} from "./update-e2e-contract.mjs";
import {
  validateStableUpdateV3Envelope,
  validateStableUpdateV3Payload,
} from "./update-channel-v3.mjs";
import { nodePackageScriptPath } from "./node-package-script.mjs";
import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";
import { windowsInstalledPackageActionCommand } from "./windows-installed-package.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const artifactRoot = path.join(repositoryRoot, ".artifacts/windows-update-e2e");
const targetDirectory = path.join(artifactRoot, "target");
const packageDirectory = path.join(artifactRoot, "packages");
const generatedConfiguration = path.join(artifactRoot, "tauri-build.json");
const keyDirectory = path.join(artifactRoot, "signing");
const privateKeyPath = path.join(keyDirectory, "synthetic.key");
const publicKeyPath = `${privateKeyPath}.pub`;
const tlsDirectory = path.join(artifactRoot, "tls");
const certificatePath = path.join(tlsDirectory, "ca.crt");
const serverCertificatePath = path.join(tlsDirectory, "server.crt");
const serverKeyPath = path.join(tlsDirectory, "server.key");
const installerFailureHookPath = path.join(artifactRoot, "installer-failure.nsh");
const predecessorGateHookPath = path.join(artifactRoot, "predecessor-gate.nsh");
const keyId = "synthetic-windows-e2e-key";
const currentVersion = "0.1.0";
const candidateVersion = "0.2.0";
const productionIdentifier = JSON.parse(
  readFileSync(path.join(repositoryRoot, "src-tauri/tauri.conf.json"), "utf8"),
).identifier;

export function windowsUpdateScenarioPlan() {
  return [
    {
      name: "success",
      candidateVariant: "ordinary",
      rejectCandidate: false,
      interruptWatchdog: false,
      expectedOutcome: "updated",
      expectedVersion: candidateVersion,
    },
    {
      name: "installer-failure",
      candidateVariant: "installer-failure",
      rejectCandidate: false,
      interruptWatchdog: false,
      expectedOutcome: "recovered",
      expectedVersion: currentVersion,
    },
    {
      name: "candidate-failure",
      candidateVariant: "ordinary",
      rejectCandidate: true,
      interruptWatchdog: false,
      expectedOutcome: "recovered",
      expectedVersion: currentVersion,
    },
    {
      name: "recovery-retry",
      candidateVariant: "ordinary",
      gatePredecessor: true,
      rejectCandidate: true,
      interruptWatchdog: false,
      expectedOutcome: "recovered",
      expectedVersion: currentVersion,
    },
    {
      name: "recovery-exhaustion",
      candidateVariant: "ordinary",
      gatePredecessor: true,
      rejectCandidate: true,
      interruptWatchdog: false,
      expectedOutcome: "manual-reinstall-required",
      expectedVersion: candidateVersion,
    },
    {
      name: "restart-resumption",
      candidateVariant: "ordinary",
      rejectCandidate: false,
      interruptWatchdog: true,
      expectedOutcome: "updated",
      expectedVersion: candidateVersion,
    },
  ];
}

export function windowsInstallerFailureHook() {
  return [
    "!macro NSIS_HOOK_PREINSTALL",
    "  SetErrorLevel 1",
    "  Quit",
    "!macroend",
    "",
  ].join("\n");
}

export function windowsPredecessorGateHook() {
  return [
    "!macro NSIS_HOOK_PREINSTALL",
    '  ReadEnvStr $0 "FITFREED_E2E_WINDOWS_PREDECESSOR_INSTALL_READY"',
    '  StrCmp $0 "" fitfreed_predecessor_install_allowed',
    '  IfFileExists "$0" fitfreed_predecessor_install_allowed',
    "  SetErrorLevel 5",
    "  Quit",
    "fitfreed_predecessor_install_allowed:",
    "!macroend",
    "",
  ].join("\n");
}

export function createWindowsUpdateTransportGate() {
  let open = true;
  let requestsWhileClosed = 0;
  return Object.freeze({
    allowRequest() {
      if (open) return true;
      requestsWhileClosed += 1;
      return false;
    },
    close() {
      open = false;
      requestsWhileClosed = 0;
    },
    open() {
      open = true;
    },
    assertUnusedWhileClosed() {
      if (requestsWhileClosed !== 0) {
        throw new Error("Windows recovery reached update transport while it was unavailable");
      }
    },
  });
}

export async function coordinateWindowsOfflineRecoveryRetry({
  updateTransport,
  grantRecovery,
  waitForRecoveryCompletion,
  releaseNoticeVerification,
}) {
  updateTransport.closeTransport();
  try {
    await grantRecovery();
    await waitForRecoveryCompletion();
    updateTransport.assertOfflineRecoveryUsedNoTransport();
  } finally {
    updateTransport.openTransport();
    releaseNoticeVerification();
  }
}

export function windowsUpdateBuildArguments(
  configurationPath,
  platform = process.platform,
  architecture = process.arch,
) {
  if (platform !== "win32" || architecture !== "x64") {
    throw new Error("Packaged update E2E requires x86-64 Windows");
  }
  if (!path.isAbsolute(configurationPath)) {
    throw new Error("The Windows update E2E configuration path must be absolute");
  }
  return [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "nsis",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    "--config",
    "src-tauri/tauri.windows.conf.json",
    "--config",
    configurationPath,
    "--ignore-version-mismatches",
  ];
}

export function expectedWindowsUpdatePackageName(version) {
  return expectedWindowsNsisArtifactName(version);
}

export function windowsUpdatePackageActionCommand({
  action,
  architecture = process.arch,
  packagePath,
  platform = process.platform,
  version,
}) {
  return windowsInstalledPackageActionCommand({
    action,
    architecture,
    packagePath,
    platform,
    version,
  });
}

export function validateWindowsUpdateEvidence(evidence) {
  const expected = windowsUpdateScenarioPlan().find(({ name }) => name === evidence?.scenario);
  const retainsRecovery = expected?.expectedOutcome === "manual-reinstall-required";
  const allowedFields = [
    "activeRecovery",
    "installedVersion",
    "libraryState",
    "locale",
    "outcome",
    "retainedAttempt",
    "scenario",
  ];
  if (
    !evidence
    || Object.keys(evidence).sort().join("\n") !== allowedFields.sort().join("\n")
  ) {
    throw new Error("Windows update E2E evidence contains unexpected fields");
  }
  if (
    !expected
    || evidence.outcome !== expected.expectedOutcome
    || evidence.installedVersion !== expected.expectedVersion
    || evidence.libraryState !== "locale-preserved"
    || evidence.locale !== "es-ES"
    || evidence.activeRecovery !== retainsRecovery
    || evidence.retainedAttempt !== retainsRecovery
  ) {
    throw new Error("Windows update E2E evidence is invalid");
  }
  return evidence;
}

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.signal !== null) {
    throw new Error(`${command} was terminated by ${result.signal}`);
  }
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture
      ? `: ${(result.stderr || result.stdout).trim()}`
      : "";
    throw new Error(`${command} failed with status ${result.status}${detail}`);
  }
  return result;
}

function runAsync(command, arguments_, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: repositoryRoot,
      env: { ...process.env, ...environment },
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(
        `${command} failed${signal ? ` with signal ${signal}` : ` with status ${code}`}`,
      ));
    });
  });
}

function runPackageAction(action, options = {}) {
  const command = windowsUpdatePackageActionCommand({
    action,
    packagePath: options.packagePath,
    version: options.version,
  });
  return run(command.file, command.arguments, {
    allowFailure: options.allowFailure,
    capture: options.capture,
    env: options.env,
  });
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function currentStorageSchemaVersion() {
  const versions = readdirSync(path.join(repositoryRoot, "src-tauri/migrations"))
    .map((name) => name.match(/^(\d{4})_[a-z0-9_]+\.sql$/))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  if (versions.length === 0 || versions.some((version) => !Number.isSafeInteger(version))) {
    throw new Error("No versioned SQLite migration was found");
  }
  return Math.max(...versions);
}

function createTlsAuthority() {
  mkdirSync(tlsDirectory, { recursive: true, mode: 0o700 });
  const caConfiguration = path.join(tlsDirectory, "ca.cnf");
  const serverConfiguration = path.join(tlsDirectory, "server.cnf");
  const serverExtensions = path.join(tlsDirectory, "server.ext");
  writeFileSync(caConfiguration, [
    "[req]",
    "distinguished_name = subject",
    "x509_extensions = extensions",
    "prompt = no",
    "[subject]",
    "CN = FitFreed synthetic Windows update E2E CA",
    "[extensions]",
    "basicConstraints = critical,CA:TRUE,pathlen:0",
    "keyUsage = critical,keyCertSign,cRLSign",
    "subjectKeyIdentifier = hash",
    "authorityKeyIdentifier = keyid:always",
    "",
  ].join("\n"), { mode: 0o600 });
  writeFileSync(serverConfiguration, [
    "[req]",
    "distinguished_name = subject",
    "prompt = no",
    "[subject]",
    "CN = 127.0.0.1",
    "",
  ].join("\n"), { mode: 0o600 });
  writeFileSync(serverExtensions, [
    "basicConstraints = critical,CA:FALSE",
    "keyUsage = critical,digitalSignature,keyEncipherment",
    "extendedKeyUsage = serverAuth",
    "subjectAltName = IP:127.0.0.1",
    "subjectKeyIdentifier = hash",
    "authorityKeyIdentifier = keyid,issuer",
    "",
  ].join("\n"), { mode: 0o600 });
  run("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-sha256", "-nodes", "-days", "2",
    "-keyout", path.join(tlsDirectory, "ca.key"),
    "-out", certificatePath,
    "-config", caConfiguration,
  ], { capture: true });
  run("openssl", [
    "req", "-new", "-newkey", "rsa:2048", "-sha256", "-nodes",
    "-keyout", serverKeyPath,
    "-out", path.join(tlsDirectory, "server.csr"),
    "-config", serverConfiguration,
  ], { capture: true });
  run("openssl", [
    "x509", "-req", "-sha256", "-days", "2",
    "-in", path.join(tlsDirectory, "server.csr"),
    "-CA", certificatePath,
    "-CAkey", path.join(tlsDirectory, "ca.key"),
    "-CAcreateserial",
    "-out", serverCertificatePath,
    "-extfile", serverExtensions,
  ], { capture: true });
}

function generateSigningKey() {
  mkdirSync(keyDirectory, { recursive: true, mode: 0o700 });
  run("npm", [
    "run", "tauri", "--", "signer", "generate", "--ci", "--write-keys", privateKeyPath,
  ], { capture: true, env: { CI: "true" } });
  return readFileSync(publicKeyPath, "utf8").trim();
}

function signFile(filePath) {
  rmSync(`${filePath}.sig`, { force: true });
  run("npm", [
    "run", "tauri", "--", "signer", "sign",
    "--private-key-path", privateKeyPath,
    "--password", "",
    filePath,
  ], { capture: true });
  return readFileSync(`${filePath}.sig`, "utf8").trim();
}

function retainBuiltPackage(version, retainedName) {
  const bundleDirectory = path.join(targetDirectory, "release/bundle/nsis");
  const expectedName = expectedWindowsNsisArtifactName(version);
  const executableArtifacts = readdirSync(bundleDirectory)
    .filter((name) => name.toLowerCase().endsWith(".exe"));
  if (executableArtifacts.length !== 1 || executableArtifacts[0] !== expectedName) {
    throw new Error(`The Windows update build must produce exactly ${expectedName}`);
  }
  const source = path.join(bundleDirectory, expectedName);
  const retained = path.join(packageDirectory, retainedName);
  if (!statSync(source).isFile() || existsSync(retained)) {
    throw new Error("The Windows update package retention boundary is invalid");
  }
  renameSync(source, retained);
  return retained;
}

function buildNsisPackage(version, publicKey, packageVariant = "ordinary") {
  if (!new Set(["ordinary", "installer-failure", "predecessor-gated"]).has(packageVariant)) {
    throw new Error("The Windows update package variant is unsupported");
  }
  let configuration = createUpdateBuildConfiguration({
    version,
    createUpdaterArtifacts: false,
    publicKey,
    productionIdentifier,
    bundleTarget: "nsis",
  });
  if (packageVariant === "installer-failure") {
    writeFileSync(installerFailureHookPath, windowsInstallerFailureHook(), { mode: 0o600 });
    configuration = {
      ...configuration,
      bundle: {
        ...configuration.bundle,
        windows: {
          nsis: {
            installerHooks: installerFailureHookPath,
          },
        },
      },
    };
  } else if (packageVariant === "predecessor-gated") {
    writeFileSync(predecessorGateHookPath, windowsPredecessorGateHook(), { mode: 0o600 });
    configuration = {
      ...configuration,
      bundle: {
        ...configuration.bundle,
        windows: {
          nsis: {
            installerHooks: predecessorGateHookPath,
          },
        },
      },
    };
  }
  writeFileSync(generatedConfiguration, `${JSON.stringify(configuration, null, 2)}\n`);
  run(
    process.execPath,
    [
      nodePackageScriptPath("@tauri-apps/cli", "tauri"),
      ...windowsUpdateBuildArguments(generatedConfiguration),
    ],
    {
      env: {
        CI: "true",
        CARGO_TARGET_DIR: targetDirectory,
        VITE_FITFREED_E2E: "true",
        TAURI_SIGNING_PRIVATE_KEY: readFileSync(privateKeyPath, "utf8").trim(),
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
      },
    },
  );
  const retained = retainBuiltPackage(
    version,
    packageVariant !== "installer-failure"
      ? expectedWindowsNsisArtifactName(version)
      : "candidate-installer-failure.exe",
  );
  signFile(retained);
  return retained;
}

async function startUpdateServer(candidatePackages, predecessorPackage) {
  let envelopeBytes;
  const transportGate = createWindowsUpdateTransportGate();
  const routes = new Map([["/predecessor.exe", predecessorPackage]]);
  for (const [variant, candidatePackage] of candidatePackages) {
    routes.set(`/candidate-${variant}.exe`, candidatePackage);
  }
  const server = https.createServer({
    key: readFileSync(serverKeyPath),
    cert: readFileSync(serverCertificatePath),
  }, (request, response) => {
    if (!transportGate.allowRequest()) {
      response.writeHead(503, { "content-length": "0" });
      response.end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { "content-length": "0" });
      response.end();
      return;
    }
    if (request.url === "/stable.json" && envelopeBytes) {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": String(envelopeBytes.length),
        "cache-control": "no-store",
      });
      response.end(envelopeBytes);
      return;
    }
    const artifact = routes.get(request.url);
    if (artifact) {
      response.writeHead(200, {
        "content-type": "application/vnd.microsoft.portable-executable",
        "content-length": String(statSync(artifact).size),
        "cache-control": "no-store",
      });
      createReadStream(artifact).pipe(response);
      return;
    }
    response.writeHead(404, { "content-length": "0" });
    response.end();
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    server,
    port: server.address().port,
    publish(bytes) {
      envelopeBytes = bytes;
    },
    closeTransport() {
      transportGate.close();
    },
    openTransport() {
      transportGate.open();
    },
    assertOfflineRecoveryUsedNoTransport() {
      transportGate.assertUnusedWhileClosed();
    },
  };
}

function createChannelDocuments({
  candidatePackage,
  candidateVariant,
  predecessorPackage,
  port,
  publicKey,
}) {
  const target = updateTarget(process.platform, process.arch);
  const issuedAt = new Date(Date.now() - 1_000).toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000).toISOString();
  const schemaVersion = currentStorageSchemaVersion();
  const payload = createUpdatePayload({
    contractSchemaVersion: 3,
    channel: "stable",
    sequence: 1,
    releaseVersion: candidateVersion,
    target,
    packageUrl: `https://127.0.0.1:${port}/candidate-${candidateVariant}.exe`,
    packageSize: statSync(candidatePackage).size,
    packageSha256: sha256(candidatePackage),
    packageSignature: readFileSync(`${candidatePackage}.sig`, "utf8").trim(),
    minimumReadableSchemaVersion: schemaVersion,
    maximumReadableSchemaVersion: schemaVersion,
    targetSchemaVersion: schemaVersion,
    schemaVersion,
    issuedAt,
    publishedAt: issuedAt,
    expiresAt,
    minimumSupportedVersion: currentVersion,
  });
  const recoveryRequirement = {
    version: currentVersion,
    target,
    librarySchemaVersions: [schemaVersion],
  };
  payload.release.recoveryArtifacts = [{
    ...recoveryRequirement,
    packageKind: "nsis",
    url: `https://127.0.0.1:${port}/predecessor.exe`,
    size: statSync(predecessorPackage).size,
    sha256: sha256(predecessorPackage),
    tauriSignature: readFileSync(`${predecessorPackage}.sig`, "utf8").trim(),
  }];
  validateStableUpdateV3Payload(payload, [recoveryRequirement]);
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  const payloadPath = path.join(artifactRoot, "channel-payload.json");
  writeFileSync(payloadPath, payloadBytes, { mode: 0o600 });
  const envelope = createUpdateEnvelope({
    payload,
    payloadBytes,
    metadataSignature: signFile(payloadPath),
    keyId,
  });
  validateStableUpdateV3Envelope(envelope, payload);
  if (!publicKey) throw new Error("The synthetic package trust key is unavailable");
  return Buffer.from(JSON.stringify(envelope));
}

async function availableTcpPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function waitForScenarioMarker(markerPath, description, signal) {
  const deadline = Date.now() + 120_000;
  while (!signal.aborted && Date.now() < deadline) {
    if (existsSync(markerPath)) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  if (!signal.aborted) {
    throw new Error(`The Windows update E2E did not ${description}`);
  }
}

async function provideOfflineRecoveryRetry({
  authorizationReady,
  authorizationRequest,
  installReady,
  noticeVerificationReady,
  recoveryCompleted,
  signal,
  updateServer,
}) {
  await waitForScenarioMarker(
    authorizationRequest,
    "publish the recovery retry request",
    signal,
  );
  if (signal.aborted) return;
  await coordinateWindowsOfflineRecoveryRetry({
    updateTransport: updateServer,
    async grantRecovery() {
      writeFileSync(installReady, "ready\n", { flag: "wx", mode: 0o600 });
      writeFileSync(authorizationReady, "ready\n", { flag: "wx", mode: 0o600 });
    },
    waitForRecoveryCompletion() {
      return waitForScenarioMarker(
        recoveryCompleted,
        "complete recovery while update transport was unavailable",
        signal,
      );
    },
    releaseNoticeVerification() {
      writeFileSync(noticeVerificationReady, "ready\n", { flag: "wx", mode: 0o600 });
    },
  });
}

async function runScenario(
  scenario,
  endpoint,
  publicKey,
  predecessorPackage,
  updateServer,
) {
  const scenarioRoot = path.join(artifactRoot, "scenarios", scenario.name);
  const applicationData = path.join(process.env.APPDATA, productionIdentifier);
  const databasePath = path.join(applicationData, "fitfreed.sqlite");
  const recoveryRoot = path.join(applicationData, "update-recovery");
  const evidencePath = path.join(artifactRoot, "evidence", scenario.name, "result.json");
  const interruptionReady = path.join(scenarioRoot, "watchdog-interruption.ready");
  const interruptionContinue = path.join(scenarioRoot, "watchdog-interruption.continue");
  const predecessorInstallReady = path.join(scenarioRoot, "predecessor-install.ready");
  const recoveryRetryRequest = path.join(scenarioRoot, "recovery-retry.request");
  const recoveryRetryReady = path.join(scenarioRoot, "recovery-retry.ready");
  const offlineRecoveryCompleted = path.join(scenarioRoot, "offline-recovery.completed");
  const noticeVerificationReady = path.join(scenarioRoot, "notice-verification.ready");
  rmSync(scenarioRoot, { recursive: true, force: true });
  mkdirSync(scenarioRoot, { recursive: true });
  runPackageAction("preflight");
  let installationOwned = false;
  try {
    installationOwned = true;
    runPackageAction("install", {
      packagePath: predecessorPackage,
      version: currentVersion,
      env: { FITFREED_E2E_WINDOWS_PREDECESSOR_INSTALL_READY: "" },
    });
    const controller = new AbortController();
    const offlineRecovery = scenario.name === "recovery-retry"
      ? provideOfflineRecoveryRetry({
        authorizationReady: recoveryRetryReady,
        authorizationRequest: recoveryRetryRequest,
        installReady: predecessorInstallReady,
        noticeVerificationReady,
        recoveryCompleted: offlineRecoveryCompleted,
        signal: controller.signal,
        updateServer,
      })
      : Promise.resolve();
    try {
      await Promise.all([
        runAsync("node", ["test/update-e2e/windows-update-journey.mjs"], {
          FITFREED_UPDATE_E2E_APPLICATION:
            path.join(process.env.LOCALAPPDATA, "FitFreed", "fitfreed.exe"),
          FITFREED_UPDATE_E2E_SCENARIO: scenario.name,
          FITFREED_UPDATE_E2E_EXPECTED_OUTCOME: scenario.expectedOutcome,
          FITFREED_UPDATE_E2E_EXPECTED_VERSION: scenario.expectedVersion,
          FITFREED_UPDATE_E2E_DRIVER_PORT: String(await availableTcpPort()),
          FITFREED_UPDATE_E2E_RECOVERY_ROOT: recoveryRoot,
          FITFREED_UPDATE_E2E_EVIDENCE_PATH: evidencePath,
          FITFREED_UPDATE_E2E_PACKAGE_SCRIPT: packageActionScript,
          FITFREED_E2E_DATABASE_PATH: databasePath,
          FITFREED_E2E_UPDATE_CONTRACT: "stable-v3",
          FITFREED_E2E_UPDATE_ENDPOINT: endpoint,
          FITFREED_E2E_UPDATE_KEY_ID: keyId,
          FITFREED_E2E_UPDATE_PUBLIC_KEY: publicKey,
          FITFREED_E2E_UPDATE_ROOT_CERTIFICATE_PATH: certificatePath,
          WDIO_LOG_LEVEL: "warn",
          ...(scenario.gatePredecessor
            ? {
              FITFREED_E2E_WINDOWS_PREDECESSOR_INSTALL_READY: predecessorInstallReady,
            }
            : {}),
          ...(scenario.name === "recovery-retry"
            ? {
              FITFREED_UPDATE_E2E_RECOVERY_RETRY_REQUEST: recoveryRetryRequest,
              FITFREED_UPDATE_E2E_RECOVERY_RETRY_READY: recoveryRetryReady,
              FITFREED_UPDATE_E2E_OFFLINE_RECOVERY_COMPLETED: offlineRecoveryCompleted,
              FITFREED_UPDATE_E2E_NOTICE_VERIFICATION_READY: noticeVerificationReady,
            }
            : {}),
          ...(scenario.rejectCandidate
            ? { FITFREED_E2E_REJECT_UPDATE_CANDIDATE: "1" }
            : {}),
          ...(scenario.interruptWatchdog
            ? {
              FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_READY: interruptionReady,
              FITFREED_E2E_WINDOWS_UPDATE_INTERRUPTION_CONTINUE: interruptionContinue,
            }
            : {}),
        }),
        offlineRecovery,
      ]);
    } finally {
      controller.abort();
    }
    validateWindowsUpdateEvidence(JSON.parse(readFileSync(evidencePath, "utf8")));
  } finally {
    updateServer.openTransport();
    if (installationOwned) runPackageAction("remove");
  }
}

async function main() {
  if (process.platform !== "win32" || process.arch !== "x64") {
    throw new Error("Packaged Windows update E2E requires an x86-64 Windows host");
  }
  if (!process.env.APPDATA || !process.env.LOCALAPPDATA) {
    throw new Error("Windows application data roots are unavailable");
  }
  runPackageAction("preflight");
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(packageDirectory, { recursive: true });
  createTlsAuthority();
  const publicKey = generateSigningKey();
  const candidatePackages = new Map([
    ["ordinary", buildNsisPackage(candidateVersion, publicKey)],
    [
      "installer-failure",
      buildNsisPackage(candidateVersion, publicKey, "installer-failure"),
    ],
  ]);
  const predecessorPackage = buildNsisPackage(currentVersion, publicKey, "predecessor-gated");
  const updateServer = await startUpdateServer(candidatePackages, predecessorPackage);
  try {
    const endpoint = `https://127.0.0.1:${updateServer.port}/stable.json`;
    for (const scenario of windowsUpdateScenarioPlan()) {
      const candidatePackage = candidatePackages.get(scenario.candidateVariant);
      if (!candidatePackage) {
        throw new Error(`The ${scenario.name} candidate package is unavailable`);
      }
      updateServer.publish(createChannelDocuments({
        candidatePackage,
        candidateVariant: scenario.candidateVariant,
        predecessorPackage,
        port: updateServer.port,
        publicKey,
      }));
      await runScenario(scenario, endpoint, publicKey, predecessorPackage, updateServer);
    }
  } finally {
    await closeServer(updateServer.server);
  }
  process.stdout.write(`${JSON.stringify({
    check: "packaged-windows-update-e2e",
    target: updateTarget(process.platform, process.arch),
    scenarios: windowsUpdateScenarioPlan().map(({ name }) => name),
    evidence: "synthetic-updater-mechanics",
    result: "passed",
  })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
