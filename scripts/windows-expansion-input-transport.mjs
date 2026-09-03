import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyWindowsExpansionInput } from "./prepare-windows-expansion-input.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { sha256File } from "./release-evidence.mjs";
import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";
import { windowsPackageInventoryName } from "./windows-package-inventory.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const sha256Pattern = /^[0-9a-f]{64}$/;

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function expectedEntries(version) {
  const packageName = expectedWindowsNsisArtifactName(version);
  return [
    packageName,
    `${packageName}.build.json`,
    windowsPackageInventoryName(version),
  ].sort(byteOrder);
}

function defaultRun(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "pipe"],
  })?.trim() ?? "";
}

function requireCertificateFingerprint(value) {
  if (!sha256Pattern.test(value ?? "")) {
    throw new Error("Windows expansion Authenticode certificate fingerprint is invalid");
  }
}

export function validateWindowsExpansionArchiveEntries(output, version) {
  const entries = output.split(/\r?\n/u).filter(Boolean);
  const expected = expectedEntries(version);
  const errors = [];
  for (const entry of entries) {
    if (
      path.posix.isAbsolute(entry)
      || entry.includes("\\")
      || entry.split("/").includes("..")
    ) {
      errors.push(`unsafe Windows expansion transport entry: ${entry}`);
    }
  }
  const actual = [...entries].sort(byteOrder);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push("Windows expansion transport does not contain the closed entry set");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { entryCount: entries.length };
}

export function windowsExpansionArchiveCreateArguments({
  archive,
  dialect,
  input,
  version,
}) {
  const ownershipArguments = dialect === "bsdtar"
    ? ["--uid", "0", "--gid", "0", "--uname", "", "--gname", ""]
    : ["--owner=0", "--group=0", "--numeric-owner"];
  if (dialect !== "bsdtar" && dialect !== "gnu") {
    throw new Error("Windows expansion transport requires GNU tar or bsdtar");
  }
  return [
    "--format=ustar",
    ...ownershipArguments,
    "-czf",
    archive,
    "-C",
    input,
    ...expectedEntries(version),
  ];
}

export function detectWindowsExpansionTarDialect(versionOutput) {
  const normalized = versionOutput.toLowerCase();
  if (normalized.includes("bsdtar") || normalized.includes("libarchive")) return "bsdtar";
  if (normalized.includes("gnu tar")) return "gnu";
  throw new Error("Windows expansion transport requires GNU tar or bsdtar");
}

export function packWindowsExpansionInput({
  archivePath,
  authenticodeCertificateSha256,
  inputDirectory,
  revision,
  runCommand = defaultRun,
  storageSchemaVersion,
  updateConfiguration,
  version,
}) {
  requireCertificateFingerprint(authenticodeCertificateSha256);
  const input = path.resolve(inputDirectory);
  const archive = path.resolve(archivePath);
  if (existsSync(archive)) throw new Error("Windows expansion transport archive already exists");
  const verified = verifyWindowsExpansionInput({
    authenticodeCertificateSha256,
    directory: input,
    revision,
    storageSchemaVersion,
    updateConfiguration,
    version,
  });
  const archiveParent = path.dirname(archive);
  mkdirSync(archiveParent, { recursive: true });
  const staging = mkdtempSync(
    path.join(archiveParent, `.${path.basename(archive)}.tmp-`),
  );
  const stagedArchive = path.join(staging, path.basename(archive));
  let promoted = false;
  try {
    const dialect = detectWindowsExpansionTarDialect(
      runCommand("tar", ["--version"], { capture: true }),
    );
    runCommand("tar", windowsExpansionArchiveCreateArguments({
      archive: stagedArchive,
      dialect,
      input,
      version,
    }));
    validateWindowsExpansionArchiveEntries(
      runCommand("tar", ["-tzf", stagedArchive], { capture: true }),
      version,
    );
    renameSync(stagedArchive, archive);
    promoted = true;
    return { ...verified, archiveSha256: sha256File(archive) };
  } catch (error) {
    if (promoted) rmSync(archive, { force: true });
    throw error;
  } finally {
    rmSync(staging, { force: true, recursive: true });
  }
}

export function unpackWindowsExpansionInput({
  archivePath,
  authenticodeCertificateSha256,
  expectedSha256,
  outputDirectory,
  revision,
  runCommand = defaultRun,
  storageSchemaVersion,
  updateConfiguration,
  version,
}) {
  requireCertificateFingerprint(authenticodeCertificateSha256);
  const archive = path.resolve(archivePath);
  const output = path.resolve(outputDirectory);
  if (!sha256Pattern.test(expectedSha256 ?? "")) {
    throw new Error("Windows expansion transport digest is invalid");
  }
  if (!existsSync(archive) || sha256File(archive) !== expectedSha256) {
    throw new Error("Windows expansion transport digest mismatch");
  }
  if (existsSync(output)) throw new Error("Windows expansion input destination already exists");
  validateWindowsExpansionArchiveEntries(
    runCommand("tar", ["-tzf", archive], { capture: true }),
    version,
  );
  const outputParent = path.dirname(output);
  mkdirSync(outputParent, { recursive: true });
  const staging = mkdtempSync(
    path.join(outputParent, `.${path.basename(output)}.tmp-`),
  );
  let promoted = false;
  try {
    runCommand("tar", ["-xzf", archive, "-C", staging]);
    verifyWindowsExpansionInput({
      authenticodeCertificateSha256,
      directory: staging,
      revision,
      storageSchemaVersion,
      updateConfiguration,
      version,
    });
    renameSync(staging, output);
    promoted = true;
    const verified = verifyWindowsExpansionInput({
      authenticodeCertificateSha256,
      directory: output,
      revision,
      storageSchemaVersion,
      updateConfiguration,
      version,
    });
    return { ...verified, archiveSha256: expectedSha256 };
  } catch (error) {
    rmSync(staging, { force: true, recursive: true });
    if (promoted) rmSync(output, { force: true, recursive: true });
    throw error;
  }
}

function emitResult(result) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `windows_input_sha256=${result.archiveSha256}\n`);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function parseSchemaVersion(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Windows expansion storage schema version is invalid");
  }
  return parsed;
}

function main() {
  const [operation, ...arguments_] = process.argv.slice(2);
  const updateConfiguration = loadPublicUpdateConfiguration(repositoryRoot);
  if (operation === "pack" && arguments_.length === 6) {
    const [
      inputDirectory,
      archivePath,
      version,
      revision,
      schemaVersion,
      authenticodeCertificateSha256,
    ] = arguments_;
    emitResult(packWindowsExpansionInput({
      archivePath,
      authenticodeCertificateSha256,
      inputDirectory,
      revision,
      storageSchemaVersion: parseSchemaVersion(schemaVersion),
      updateConfiguration,
      version,
    }));
    return;
  }
  if (operation === "unpack" && arguments_.length === 7) {
    const [
      archivePath,
      expectedSha256,
      outputDirectory,
      version,
      revision,
      schemaVersion,
      authenticodeCertificateSha256,
    ] = arguments_;
    emitResult(unpackWindowsExpansionInput({
      archivePath,
      authenticodeCertificateSha256,
      expectedSha256,
      outputDirectory,
      revision,
      storageSchemaVersion: parseSchemaVersion(schemaVersion),
      updateConfiguration,
      version,
    }));
    return;
  }
  throw new Error(
    "usage: node scripts/windows-expansion-input-transport.mjs <pack input archive version revision schema certificate-sha256|unpack archive sha256 output version revision schema certificate-sha256>",
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Windows expansion transport failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
