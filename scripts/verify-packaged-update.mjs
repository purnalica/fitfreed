import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  createReadStream,
  existsSync,
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

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  assertSyntheticUpdateBoundary,
  createUpdateEnvelope,
  createUpdatePayload,
  updateTarget,
} from "./update-e2e-contract.mjs";
import { inspectUpgradeMatrix } from "./upgrade-matrix.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(repositoryRoot, ".artifacts/update-e2e");
const generatedConfiguration = path.join(artifactRoot, "tauri-build.json");
const keyDirectory = path.join(artifactRoot, "signing");
const privateKeyPath = path.join(keyDirectory, "synthetic.key");
const publicKeyPath = `${privateKeyPath}.pub`;
const tlsDirectory = path.join(artifactRoot, "tls");
const certificatePath = path.join(tlsDirectory, "ca.crt");
const serverCertificatePath = path.join(tlsDirectory, "server.crt");
const serverKeyPath = path.join(tlsDirectory, "server.key");
const targetBundleDirectory = path.join(
  repositoryRoot,
  "src-tauri/target/release/bundle/macos",
);
const generatedApplication = path.join(targetBundleDirectory, "FitFreed.app");
const generatedUpdaterPackage = `${generatedApplication}.tar.gz`;
const generatedUpdaterSignature = `${generatedUpdaterPackage}.sig`;
const candidatePackage = path.join(artifactRoot, "builds/candidate/FitFreed.app.tar.gz");
const currentApplication = path.join(artifactRoot, "builds/current/FitFreed.app");
const keyId = "synthetic-e2e-key";

function run(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, ...options.env },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = options.capture
      ? `: ${(result.stderr || result.stdout).trim()}`
      : "";
    throw new Error(`${command} failed with status ${result.status}${detail}`);
  }
  return result.stdout?.trim() ?? "";
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

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function scopedApplicationProcesses() {
  const processTable = run("ps", ["-axo", "pid=,command="], { capture: true });
  return processTable
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(.+)$/))
    .filter(Boolean)
    .filter(([, command]) => (
      command.includes(artifactRoot)
      && command.includes("/FitFreed.app/Contents/MacOS/fitfreed")
    ))
    .map(([, processId]) => Number(processId))
    .filter((processId) => processId !== process.pid);
}

async function stopScopedApplicationProcesses() {
  for (const processId of scopedApplicationProcesses()) {
    try {
      process.kill(processId, "SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline && scopedApplicationProcesses().length > 0) {
    await delay(100);
  }
  for (const processId of scopedApplicationProcesses()) {
    try {
      process.kill(processId, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
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
    "CN = FitFreed synthetic update E2E CA",
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

function buildApplication(version, createUpdaterArtifacts, publicKey) {
  writeFileSync(generatedConfiguration, `${JSON.stringify({
    version,
    bundle: {
      targets: ["app"],
      createUpdaterArtifacts,
    },
    plugins: {
      updater: {
        pubkey: publicKey,
        endpoints: [],
      },
    },
  }, null, 2)}\n`);
  run("npm", [
    "run", "tauri", "--", "build",
    "--features", "e2e",
    "--bundles", "app",
    "--config", "src-tauri/tauri.e2e.conf.json",
    "--config", generatedConfiguration,
    "--ignore-version-mismatches",
  ], {
    env: {
      CI: "true",
      VITE_FITFREED_E2E: "true",
      TAURI_SIGNING_PRIVATE_KEY: readFileSync(privateKeyPath, "utf8").trim(),
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
    },
  });
  if (bundleVersion(generatedApplication) !== version) {
    throw new Error(`Tauri generated an unexpected application version for ${version}`);
  }
}

function bundleVersion(applicationPath) {
  return run("plutil", [
    "-extract", "CFBundleShortVersionString", "raw", "-o", "-",
    path.join(applicationPath, "Contents/Info.plist"),
  ], { capture: true });
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

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function compileDocumentValidators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return {
    payload: ajv.compile(JSON.parse(readFileSync(
      path.join(repositoryRoot, "schemas/update-channel-payload-v2.schema.json"),
      "utf8",
    ))),
    envelope: ajv.compile(JSON.parse(readFileSync(
      path.join(repositoryRoot, "schemas/update-channel-envelope-v2.schema.json"),
      "utf8",
    ))),
    errorsText: (errors) => ajv.errorsText(errors),
  };
}

function validateDocument(validator, document, errorsText, name) {
  if (!validator(document)) {
    throw new Error(`${name} failed its JSON Schema: ${errorsText(validator.errors)}`);
  }
}

function createChannelDocuments({ target, port, validators, matrix }) {
  const packageSignature = readFileSync(`${candidatePackage}.sig`, "utf8").trim();
  const packageUrl = `https://127.0.0.1:${port}/package.tar.gz`;
  const now = Date.now();
  const issuedAt = new Date(now - 1_000).toISOString().replace(".000Z", "Z");
  const expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1_000)
    .toISOString()
    .replace(".000Z", "Z");
  const payload = createUpdatePayload({
    contractSchemaVersion: 2,
    channel: "stable",
    target,
    packageUrl,
    packageSize: statSync(candidatePackage).size,
    packageSha256: sha256(candidatePackage),
    packageSignature,
    minimumReadableSchemaVersion: matrix.librarySchemaVersions[0],
    schemaVersion: matrix.currentLibrarySchemaVersion,
    issuedAt,
    expiresAt,
  });
  validateDocument(validators.payload, payload, validators.errorsText, "Synthetic update payload");
  const payloadPath = path.join(artifactRoot, "channel-payload.json");
  const payloadBytes = Buffer.from(JSON.stringify(payload));
  writeFileSync(payloadPath, payloadBytes, { mode: 0o600 });
  const metadataSignature = signFile(payloadPath);
  const envelope = createUpdateEnvelope({
    payload,
    payloadBytes,
    metadataSignature,
    keyId,
  });
  validateDocument(
    validators.envelope,
    envelope,
    validators.errorsText,
    "Synthetic update envelope",
  );
  return Buffer.from(JSON.stringify(envelope));
}

async function startUpdateServer() {
  let envelopeBytes;
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
    if (request.url === "/package.tar.gz") {
      const packageSize = statSync(candidatePackage).size;
      response.writeHead(200, {
        "content-type": "application/gzip",
        "content-length": String(packageSize),
        "cache-control": "no-store",
      });
      createReadStream(candidatePackage).pipe(response);
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

async function closeServer(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
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

async function runScenario(scenario, endpoint, publicKey, driverPort) {
  const scenarioRoot = path.join(artifactRoot, "scenarios", scenario);
  const applicationBundle = path.join(scenarioRoot, "installed/FitFreed.app");
  const applicationBinary = path.join(applicationBundle, "Contents/MacOS/fitfreed");
  const databasePath = path.join(scenarioRoot, "app-data/fitfreed.sqlite");
  const recoveryRoot = path.join(scenarioRoot, "app-data/update-recovery");
  rmSync(scenarioRoot, { recursive: true, force: true });
  mkdirSync(path.dirname(applicationBundle), { recursive: true });
  mkdirSync(path.dirname(databasePath), { recursive: true });
  run("ditto", [currentApplication, applicationBundle]);
  if (!existsSync(applicationBinary) || bundleVersion(applicationBundle) !== "0.1.0") {
    throw new Error(`The ${scenario} scenario did not start from FitFreed 0.1.0`);
  }
  try {
    await runAsync("node", ["test/update-e2e/update-journey.mjs"], {
      FITFREED_UPDATE_E2E_APPLICATION: applicationBinary,
      FITFREED_UPDATE_E2E_APPLICATION_BUNDLE: applicationBundle,
      FITFREED_UPDATE_E2E_SCENARIO: scenario,
      FITFREED_UPDATE_E2E_DRIVER_PORT: String(driverPort),
      TAURI_WEBDRIVER_PORT: String(driverPort),
      FITFREED_UPDATE_E2E_RECOVERY_ROOT: recoveryRoot,
      FITFREED_E2E_DATABASE_PATH: databasePath,
      FITFREED_E2E_UPDATE_CONTRACT: "stable-v2",
      FITFREED_E2E_UPDATE_ENDPOINT: endpoint,
      FITFREED_E2E_UPDATE_KEY_ID: keyId,
      FITFREED_E2E_UPDATE_PUBLIC_KEY: publicKey,
      FITFREED_E2E_UPDATE_ROOT_CERTIFICATE_PATH: certificatePath,
      WDIO_LOG_LEVEL: "warn",
      ...(scenario === "failure" ? { FITFREED_E2E_REJECT_UPDATE_CANDIDATE: "1" } : {}),
    });
  } finally {
    await stopScopedApplicationProcesses();
  }
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("Packaged update E2E is supported only on macOS");
  }
  const matrix = inspectUpgradeMatrix(repositoryRoot);
  const evidenceBoundary = assertSyntheticUpdateBoundary(matrix);
  if (currentStorageSchemaVersion() !== matrix.currentLibrarySchemaVersion) {
    throw new Error("Packaged update E2E storage schema does not match the upgrade matrix");
  }
  await stopScopedApplicationProcesses();
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });
  createTlsAuthority();
  const publicKey = generateSigningKey();
  rmSync(generatedUpdaterPackage, { force: true });
  rmSync(generatedUpdaterSignature, { force: true });
  buildApplication("0.2.0", true, publicKey);
  if (!existsSync(generatedUpdaterPackage) || !existsSync(generatedUpdaterSignature)) {
    throw new Error("Tauri did not create the expected signed macOS updater package");
  }
  mkdirSync(path.dirname(candidatePackage), { recursive: true });
  cpSync(generatedUpdaterPackage, candidatePackage);
  cpSync(generatedUpdaterSignature, `${candidatePackage}.sig`);
  buildApplication("0.1.0", false, publicKey);
  mkdirSync(path.dirname(currentApplication), { recursive: true });
  run("ditto", [generatedApplication, currentApplication]);

  const target = updateTarget(process.platform, process.arch);
  const validators = compileDocumentValidators();
  const updateServer = await startUpdateServer();
  try {
    updateServer.publish(createChannelDocuments({
      target,
      port: updateServer.port,
      validators,
      matrix,
    }));
    const endpoint = `https://127.0.0.1:${updateServer.port}/stable.json`;
    await runScenario("success", endpoint, publicKey, await availableTcpPort());
    await runScenario("failure", endpoint, publicKey, await availableTcpPort());
  } finally {
    await closeServer(updateServer.server);
    await stopScopedApplicationProcesses();
  }
  process.stdout.write(`${JSON.stringify({
    check: "packaged-update-e2e",
    target,
    scenarios: ["success", "failure"],
    ...evidenceBoundary,
    result: "passed",
  })}\n`);
}

main().catch(async (error) => {
  try {
    await stopScopedApplicationProcesses();
  } catch (cleanupError) {
    process.stderr.write(`Scoped process cleanup failed: ${String(cleanupError)}\n`);
  }
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
