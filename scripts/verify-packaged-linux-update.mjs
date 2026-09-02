import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const artifactRoot = path.join(repositoryRoot, ".artifacts/linux-update-e2e");
const targetDirectory = path.join(artifactRoot, "target");
const packageDirectory = path.join(artifactRoot, "packages");
const variantDirectory = path.join(artifactRoot, "variants");
const generatedConfiguration = path.join(artifactRoot, "tauri-build.json");
const keyDirectory = path.join(artifactRoot, "signing");
const privateKeyPath = path.join(keyDirectory, "synthetic.key");
const publicKeyPath = `${privateKeyPath}.pub`;
const tlsDirectory = path.join(artifactRoot, "tls");
const certificatePath = path.join(tlsDirectory, "ca.crt");
const serverCertificatePath = path.join(tlsDirectory, "server.crt");
const serverKeyPath = path.join(tlsDirectory, "server.key");
const installedApplication = "/usr/bin/fitfreed";
const debianPackageTool = "/usr/bin/dpkg-deb";
const polkitRulePath = "/etc/polkit-1/rules.d/49-fitfreed-update-e2e.rules";
const keyId = "synthetic-linux-e2e-key";
const currentVersion = "0.1.0";
const candidateVersion = "0.2.0";
const productionIdentifier = JSON.parse(
  readFileSync(path.join(repositoryRoot, "src-tauri/tauri.conf.json"), "utf8"),
).identifier;

export function linuxUpdateBuildArguments(configurationPath) {
  if (!path.isAbsolute(configurationPath)) {
    throw new Error("The Linux update E2E configuration path must be absolute");
  }
  return [
    "build",
    "--features",
    "e2e",
    "--bundles",
    "deb",
    "--config",
    "src-tauri/tauri.e2e.conf.json",
    "--config",
    "src-tauri/tauri.linux.conf.json",
    "--config",
    configurationPath,
    "--ignore-version-mismatches",
  ];
}

export function debianPackageVariantArguments(extractionRoot, outputPath) {
  if (!path.isAbsolute(extractionRoot) || !path.isAbsolute(outputPath)) {
    throw new Error("Linux update E2E Debian variant paths must be absolute");
  }
  return ["--root-owner-group", "--build", extractionRoot, outputPath];
}

export function linuxInstallerFailureScript() {
  return "#!/bin/sh\nset -eu\nexit 42\n";
}

export function linuxUpdateScenarioPlan() {
  return [
    {
      name: "success",
      candidateVariant: "ordinary",
      expectedOutcome: "updated",
      expectedVersion: candidateVersion,
    },
    {
      name: "installer-failure",
      candidateVariant: "installer-failure",
      expectedOutcome: "recovered",
      expectedVersion: currentVersion,
    },
    {
      name: "candidate-failure",
      candidateVariant: "ordinary",
      expectedOutcome: "recovered",
      expectedVersion: currentVersion,
    },
  ];
}

export function createLinuxUpdatePolkitRule({ allowedRoot, user }) {
  if (!path.isAbsolute(allowedRoot)) {
    throw new Error("The Linux update E2E Polkit root must be absolute");
  }
  if (!/^[a-z_][a-z0-9_-]{0,63}$/i.test(user)) {
    throw new Error("The Linux update E2E Polkit user is invalid");
  }
  const commandPrefix = `/usr/bin/dpkg --install ${allowedRoot}/`;
  return [
    "polkit.addRule(function(action, subject) {",
    "  if (",
    '    action.id === "org.freedesktop.policykit.exec" &&',
    `    subject.user === ${JSON.stringify(user)} &&`,
    '    action.lookup("program") === "/usr/bin/dpkg"',
    "  ) {",
    '    var commandLine = action.lookup("command_line");',
    "    if (",
    '      typeof commandLine === "string" &&',
    `      commandLine.startsWith(${JSON.stringify(commandPrefix)}) &&`,
    '      new RegExp("/update-recovery/attempts/[0-9a-f]{64}/(candidate|previous)/package[.]deb$").test(commandLine)',
    "    ) {",
    "      return polkit.Result.YES;",
    "    }",
    "  }",
    "  return polkit.Result.NOT_HANDLED;",
    "});",
    "",
  ].join("\n");
}

export function validateLinuxUpdateEvidence(evidence) {
  const expected = linuxUpdateScenarioPlan().find(({ name }) => name === evidence?.scenario);
  const allowedFields = [
    "activeRecovery",
    "installedVersion",
    "libraryIntegrity",
    "locale",
    "outcome",
    "retainedAttempt",
    "scenario",
  ];
  if (
    !evidence
    || Object.keys(evidence).sort().join("\n") !== allowedFields.sort().join("\n")
  ) {
    throw new Error("Linux update E2E evidence contains unexpected fields");
  }
  if (
    !expected
    || evidence.outcome !== expected.expectedOutcome
    || evidence.installedVersion !== expected.expectedVersion
    || evidence.libraryIntegrity !== "ok"
    || evidence.locale !== "es-ES"
    || evidence.activeRecovery !== false
    || evidence.retainedAttempt !== false
  ) {
    throw new Error("Linux update E2E evidence is invalid");
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
    "CN = FitFreed synthetic Linux update E2E CA",
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

function generatedDebianPackage(version) {
  return path.join(
    targetDirectory,
    "release/bundle/deb",
    `FitFreed_${version}_amd64.deb`,
  );
}

function buildDebianPackage(version, publicKey) {
  const configuration = createUpdateBuildConfiguration({
    version,
    createUpdaterArtifacts: false,
    publicKey,
    productionIdentifier,
    bundleTarget: "deb",
  });
  writeFileSync(generatedConfiguration, `${JSON.stringify(configuration, null, 2)}\n`);
  run(
    path.join(repositoryRoot, "node_modules/.bin/tauri"),
    linuxUpdateBuildArguments(generatedConfiguration),
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
  const generated = generatedDebianPackage(version);
  if (!existsSync(generated)) {
    throw new Error(`Tauri did not create the expected Debian package for ${version}`);
  }
  const retained = path.join(packageDirectory, path.basename(generated));
  copyFileSync(generated, retained);
  signFile(retained);
  return retained;
}

function buildInstallerFailureCandidate(sourcePackage) {
  const extractionRoot = path.join(variantDirectory, "installer-failure/root");
  const controlDirectory = path.join(extractionRoot, "DEBIAN");
  const preinstallPath = path.join(controlDirectory, "preinst");
  const outputPath = path.join(packageDirectory, "candidate-installer-failure.deb");
  rmSync(path.dirname(extractionRoot), { recursive: true, force: true });
  mkdirSync(extractionRoot, { recursive: true, mode: 0o700 });
  run(debianPackageTool, ["--raw-extract", sourcePackage, extractionRoot]);
  if (existsSync(preinstallPath) || lstatSync(controlDirectory).isSymbolicLink()) {
    throw new Error("The synthetic installer-failure candidate has an unexpected preinstall boundary");
  }
  writeFileSync(preinstallPath, linuxInstallerFailureScript(), { mode: 0o755 });
  run(debianPackageTool, debianPackageVariantArguments(extractionRoot, outputPath));
  signFile(outputPath);
  return outputPath;
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

async function startUpdateServer(candidatePackages, predecessorPackage) {
  let envelopeBytes;
  const routes = new Map([["/predecessor.deb", predecessorPackage]]);
  for (const [variant, candidatePackage] of candidatePackages) {
    routes.set(`/candidate-${variant}.deb`, candidatePackage);
  }
  const server = https.createServer({
    key: readFileSync(serverKeyPath),
    cert: readFileSync(serverCertificatePath),
  }, (request, response) => {
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
        "content-type": "application/vnd.debian.binary-package",
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
    packageUrl: `https://127.0.0.1:${port}/candidate-${candidateVariant}.deb`,
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
    packageKind: "deb",
    url: `https://127.0.0.1:${port}/predecessor.deb`,
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

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function scopedProcessIds(databasePath) {
  const marker = Buffer.from(`FITFREED_E2E_DATABASE_PATH=${databasePath}`);
  return readdirSync("/proc", { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .filter((processId) => {
      try {
        return readFileSync(`/proc/${processId}/environ`).includes(marker);
      } catch {
        return false;
      }
    })
    .filter((processId) => processId !== process.pid);
}

async function stopScopedProcesses(databasePath) {
  for (const processId of scopedProcessIds(databasePath)) {
    try {
      process.kill(processId, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && scopedProcessIds(databasePath).length > 0) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  for (const processId of scopedProcessIds(databasePath)) {
    try {
      process.kill(processId, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

function installPolkitRule(scenarioRoot) {
  const source = path.join(scenarioRoot, "polkit.rules");
  writeFileSync(source, createLinuxUpdatePolkitRule({
    allowedRoot: scenarioRoot,
    user: process.env.USER,
  }), { mode: 0o600 });
  run("sudo", ["install", "--owner=root", "--group=root", "--mode=0644", source, polkitRulePath]);
}

function removePolkitRule() {
  run("sudo", ["rm", "--force", polkitRulePath], { allowFailure: true });
}

async function runScenario(
  scenario,
  endpoint,
  publicKey,
  predecessorPackage,
) {
  const scenarioRoot = path.join(artifactRoot, "scenarios", scenario.name);
  const databasePath = path.join(scenarioRoot, "app-data/fitfreed.sqlite");
  const recoveryRoot = path.join(scenarioRoot, "app-data/update-recovery");
  const evidencePath = path.join(artifactRoot, "evidence", scenario.name, "result.json");
  rmSync(scenarioRoot, { recursive: true, force: true });
  mkdirSync(path.dirname(databasePath), { recursive: true });
  try {
    run("sudo", ["dpkg", "--purge", "fitfreed"], { allowFailure: true });
    run("sudo", ["dpkg", "--install", predecessorPackage]);
    const installedVersion = run(
      "dpkg-query",
      ["--show", "--showformat=${Version}", "fitfreed"],
      { capture: true },
    ).stdout.trim();
    if (installedVersion !== currentVersion || !existsSync(installedApplication)) {
      throw new Error(`The ${scenario.name} scenario did not start from FitFreed ${currentVersion}`);
    }
    installPolkitRule(scenarioRoot);
    await runAsync("node", ["test/update-e2e/linux-update-journey.mjs"], {
      FITFREED_UPDATE_E2E_APPLICATION: installedApplication,
      FITFREED_UPDATE_E2E_SCENARIO: scenario.name,
      FITFREED_UPDATE_E2E_EXPECTED_OUTCOME: scenario.expectedOutcome,
      FITFREED_UPDATE_E2E_EXPECTED_VERSION: scenario.expectedVersion,
      FITFREED_UPDATE_E2E_DRIVER_PORT: String(await availableTcpPort()),
      FITFREED_UPDATE_E2E_RECOVERY_ROOT: recoveryRoot,
      FITFREED_UPDATE_E2E_EVIDENCE_PATH: evidencePath,
      FITFREED_E2E_DATABASE_PATH: databasePath,
      FITFREED_E2E_UPDATE_CONTRACT: "stable-v3",
      FITFREED_E2E_UPDATE_ENDPOINT: endpoint,
      FITFREED_E2E_UPDATE_KEY_ID: keyId,
      FITFREED_E2E_UPDATE_PUBLIC_KEY: publicKey,
      FITFREED_E2E_UPDATE_ROOT_CERTIFICATE_PATH: certificatePath,
      WDIO_LOG_LEVEL: "warn",
      ...(scenario.name === "candidate-failure"
        ? { FITFREED_E2E_REJECT_UPDATE_CANDIDATE: "1" }
        : {}),
    });
    validateLinuxUpdateEvidence(JSON.parse(readFileSync(evidencePath, "utf8")));
  } finally {
    await stopScopedProcesses(databasePath);
    removePolkitRule();
    run("sudo", ["dpkg", "--purge", "fitfreed"], { allowFailure: true });
  }
}

async function main() {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("Packaged Linux update E2E requires an x86-64 Linux host");
  }
  if (!process.env.USER) {
    throw new Error("Packaged Linux update E2E requires the current operating-system user");
  }
  removePolkitRule();
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(packageDirectory, { recursive: true });
  createTlsAuthority();
  const publicKey = generateSigningKey();
  const ordinaryCandidatePackage = buildDebianPackage(candidateVersion, publicKey);
  const candidatePackages = new Map([
    ["ordinary", ordinaryCandidatePackage],
    ["installer-failure", buildInstallerFailureCandidate(ordinaryCandidatePackage)],
  ]);
  const predecessorPackage = buildDebianPackage(currentVersion, publicKey);
  const updateServer = await startUpdateServer(candidatePackages, predecessorPackage);
  try {
    const endpoint = `https://127.0.0.1:${updateServer.port}/stable.json`;
    for (const scenario of linuxUpdateScenarioPlan()) {
      const candidatePackage = candidatePackages.get(scenario.candidateVariant);
      if (!candidatePackage) {
        throw new Error(`The ${scenario.name} scenario has no candidate package`);
      }
      updateServer.publish(createChannelDocuments({
        candidatePackage,
        candidateVariant: scenario.candidateVariant,
        predecessorPackage,
        port: updateServer.port,
        publicKey,
      }));
      await runScenario(scenario, endpoint, publicKey, predecessorPackage);
    }
  } finally {
    await closeServer(updateServer.server);
    removePolkitRule();
  }
  process.stdout.write(`${JSON.stringify({
    check: "packaged-linux-update-e2e",
    target: updateTarget(process.platform, process.arch),
    scenarios: linuxUpdateScenarioPlan().map(({ name }) => name),
    evidence: "synthetic-updater-mechanics",
    result: "passed",
  })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    try {
      removePolkitRule();
    } catch (cleanupError) {
      process.stderr.write(`Linux update E2E cleanup failed: ${String(cleanupError)}\n`);
    }
    process.stderr.write(`${error.stack ?? error}\n`);
    process.exitCode = 1;
  });
}
