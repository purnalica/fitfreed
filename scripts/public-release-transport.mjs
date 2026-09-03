import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { loadPublicReleaseSigningConfiguration } from "./public-release-signing-configuration.mjs";
import { verifySupportedPublicReleaseCandidate } from "./public-release-candidate-verification.mjs";
import { sha256File } from "./release-evidence.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256Pattern = /^[0-9a-f]{64}$/;

function defaultRun(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "pipe"],
  })?.trim() ?? "";
}

export function validatePublicCandidateArchiveEntries(output) {
  const entries = output.split("\n").filter(Boolean);
  const errors = [];
  if (entries.length === 0) errors.push("public candidate transport archive is empty");
  for (const entry of entries) {
    const normalized = entry.replace(/\/$/, "");
    const components = normalized.split("/");
    if (
      path.posix.isAbsolute(normalized)
      || normalized.includes("\\")
      || components.includes("..")
      || !["release", "pages"].includes(components[0])
    ) {
      errors.push(`unsafe public candidate transport entry: ${entry}`);
    }
  }
  if (!entries.some((entry) => entry === "release/" || entry.startsWith("release/"))) {
    errors.push("public candidate transport has no release tree");
  }
  if (!entries.some((entry) => entry === "pages/" || entry.startsWith("pages/"))) {
    errors.push("public candidate transport has no Pages tree");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { entryCount: entries.length };
}

export function packPublicReleaseCandidate({
  candidateDirectory,
  archivePath,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
  runCommand = defaultRun,
}) {
  const candidate = path.resolve(candidateDirectory);
  const archive = path.resolve(archivePath);
  if (existsSync(archive)) throw new Error("public candidate transport archive already exists");
  const { verified } = verifySupportedPublicReleaseCandidate({
    candidateDirectory: candidate,
    publicReleaseSigningConfiguration,
    publicUpdateConfiguration,
  });
  mkdirSync(path.dirname(archive), { recursive: true });
  try {
    runCommand("tar", ["-czf", archive, "-C", candidate, "release", "pages"]);
    validatePublicCandidateArchiveEntries(runCommand("tar", ["-tzf", archive], { capture: true }));
    const archiveSha256 = sha256File(archive);
    return {
      version: verified.version,
      revision: verified.revision,
      ...(verified.targets ? { targets: verified.targets } : {}),
      archiveSha256,
    };
  } catch (error) {
    rmSync(archive, { force: true });
    throw error;
  }
}

export function unpackPublicReleaseCandidate({
  archivePath,
  expectedSha256,
  candidateDirectory,
  publicUpdateConfiguration,
  publicReleaseSigningConfiguration,
  runCommand = defaultRun,
}) {
  const archive = path.resolve(archivePath);
  const candidate = path.resolve(candidateDirectory);
  if (!sha256Pattern.test(expectedSha256 ?? "")) {
    throw new Error("public candidate transport digest is invalid");
  }
  if (!existsSync(archive) || sha256File(archive) !== expectedSha256) {
    throw new Error("public candidate transport digest mismatch");
  }
  if (existsSync(candidate)) throw new Error("public candidate destination already exists");
  validatePublicCandidateArchiveEntries(runCommand("tar", ["-tzf", archive], { capture: true }));
  mkdirSync(candidate, { recursive: true });
  try {
    runCommand("tar", ["-xzf", archive, "-C", candidate]);
    const { verified } = verifySupportedPublicReleaseCandidate({
      candidateDirectory: candidate,
      publicReleaseSigningConfiguration,
      publicUpdateConfiguration,
    });
    return {
      version: verified.version,
      revision: verified.revision,
      ...(verified.targets ? { targets: verified.targets } : {}),
      archiveSha256: expectedSha256,
    };
  } catch (error) {
    rmSync(candidate, { force: true, recursive: true });
    throw error;
  }
}

function emitResult(result) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `candidate_sha256=${result.archiveSha256}\n`);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function main() {
  const [operation, firstPath, secondValue, thirdPath] = process.argv.slice(2);
  const configuration = loadPublicUpdateConfiguration(repositoryRoot);
  const releaseSigningConfiguration = loadPublicReleaseSigningConfiguration(repositoryRoot);
  if (operation === "pack" && firstPath && secondValue && !thirdPath) {
    emitResult(packPublicReleaseCandidate({
      candidateDirectory: firstPath,
      archivePath: secondValue,
      publicUpdateConfiguration: configuration,
      publicReleaseSigningConfiguration: releaseSigningConfiguration,
    }));
    return;
  }
  if (operation === "unpack" && firstPath && secondValue && thirdPath) {
    emitResult(unpackPublicReleaseCandidate({
      archivePath: firstPath,
      expectedSha256: secondValue,
      candidateDirectory: thirdPath,
      publicUpdateConfiguration: configuration,
      publicReleaseSigningConfiguration: releaseSigningConfiguration,
    }));
    return;
  }
  throw new Error(
    "usage: node scripts/public-release-transport.mjs <pack candidate archive|unpack archive sha256 candidate>",
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Public release transport failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
