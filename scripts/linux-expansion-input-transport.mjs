import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { linuxPackageInventoryName } from "./linux-package-inventory.mjs";
import { verifyLinuxExpansionInput } from "./prepare-linux-expansion-input.mjs";
import { sha256File } from "./release-evidence.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256Pattern = /^[0-9a-f]{64}$/;

function expectedEntries(version) {
  const packageName = expectedLinuxDebianArtifactName(version);
  return [
    packageName,
    `${packageName}.build.json`,
    linuxPackageInventoryName(version),
  ].sort((left, right) => left.localeCompare(right, "en"));
}

function defaultRun(command, arguments_, options = {}) {
  return execFileSync(command, arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "pipe"],
  })?.trim() ?? "";
}

export function validateLinuxExpansionArchiveEntries(output, version) {
  const entries = output.split("\n").filter(Boolean);
  const expected = expectedEntries(version);
  const errors = [];
  for (const entry of entries) {
    if (
      path.posix.isAbsolute(entry)
      || entry.includes("\\")
      || entry.split("/").includes("..")
    ) {
      errors.push(`unsafe Linux expansion transport entry: ${entry}`);
    }
  }
  const actual = [...entries].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push("Linux expansion transport does not contain the closed entry set");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { entryCount: entries.length };
}

export function packLinuxExpansionInput({
  archivePath,
  inputDirectory,
  revision,
  runCommand = defaultRun,
  storageSchemaVersion,
  version,
}) {
  const input = path.resolve(inputDirectory);
  const archive = path.resolve(archivePath);
  if (existsSync(archive)) throw new Error("Linux expansion transport archive already exists");
  const verified = verifyLinuxExpansionInput({
    directory: input,
    revision,
    storageSchemaVersion,
    version,
  });
  mkdirSync(path.dirname(archive), { recursive: true });
  try {
    runCommand("tar", ["-czf", archive, "-C", input, ...expectedEntries(version)]);
    validateLinuxExpansionArchiveEntries(
      runCommand("tar", ["-tzf", archive], { capture: true }),
      version,
    );
    return { ...verified, archiveSha256: sha256File(archive) };
  } catch (error) {
    rmSync(archive, { force: true });
    throw error;
  }
}

export function unpackLinuxExpansionInput({
  archivePath,
  expectedSha256,
  outputDirectory,
  revision,
  runCommand = defaultRun,
  storageSchemaVersion,
  version,
}) {
  const archive = path.resolve(archivePath);
  const output = path.resolve(outputDirectory);
  if (!sha256Pattern.test(expectedSha256 ?? "")) {
    throw new Error("Linux expansion transport digest is invalid");
  }
  if (!existsSync(archive) || sha256File(archive) !== expectedSha256) {
    throw new Error("Linux expansion transport digest mismatch");
  }
  if (existsSync(output)) throw new Error("Linux expansion input destination already exists");
  validateLinuxExpansionArchiveEntries(
    runCommand("tar", ["-tzf", archive], { capture: true }),
    version,
  );
  mkdirSync(output, { recursive: true });
  try {
    runCommand("tar", ["-xzf", archive, "-C", output]);
    const verified = verifyLinuxExpansionInput({
      directory: output,
      revision,
      storageSchemaVersion,
      version,
    });
    return { ...verified, archiveSha256: expectedSha256 };
  } catch (error) {
    rmSync(output, { force: true, recursive: true });
    throw error;
  }
}

function emitResult(result) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `linux_input_sha256=${result.archiveSha256}\n`);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function parseSchemaVersion(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error("Linux expansion storage schema version is invalid");
  }
  return parsed;
}

function main() {
  const [operation, ...arguments_] = process.argv.slice(2);
  if (operation === "pack" && arguments_.length === 5) {
    const [inputDirectory, archivePath, version, revision, schemaVersion] = arguments_;
    emitResult(packLinuxExpansionInput({
      archivePath,
      inputDirectory,
      revision,
      storageSchemaVersion: parseSchemaVersion(schemaVersion),
      version,
    }));
    return;
  }
  if (operation === "unpack" && arguments_.length === 6) {
    const [archivePath, expectedSha256, outputDirectory, version, revision, schemaVersion] =
      arguments_;
    emitResult(unpackLinuxExpansionInput({
      archivePath,
      expectedSha256,
      outputDirectory,
      revision,
      storageSchemaVersion: parseSchemaVersion(schemaVersion),
      version,
    }));
    return;
  }
  throw new Error(
    "usage: node scripts/linux-expansion-input-transport.mjs <pack input archive version revision schema|unpack archive sha256 output version revision schema>",
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Linux expansion transport failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
