import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveRemoteTagRevision } from "./public-release-preflight.mjs";
import {
  readSupportedPublicReleaseManifest,
  validateSupportedPublicReleaseManifest,
  verifySupportedPublicReleaseCandidate,
} from "./public-release-candidate-verification.mjs";
import { loadPublicReleaseSigningConfiguration } from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { sha256File } from "./release-evidence.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryName = "purnalica/fitfreed";
const macosSignerWorkflow = "purnalica/fitfreed/.github/workflows/public-release.yml";
const linuxExpansionSignerWorkflow =
  "purnalica/fitfreed/.github/workflows/public-linux-expansion.yml";

function defaultRun(command, args, { allowFailure = false } = {}) {
  try {
    return {
      success: true,
      output: execFileSync(command, args, {
        cwd: repositoryRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }).trim(),
    };
  } catch {
    if (allowFailure) return { success: false, output: "" };
    throw new Error(`${path.basename(command)} public release publication command failed`);
  }
}

export function validateImmutableReleaseSetting(setting) {
  if (setting?.enabled !== true) throw new Error("GitHub release immutability is not enabled");
  return {
    enabled: true,
    enforcedByOwner: setting.enforced_by_owner === true,
  };
}

export function publicReleaseAssetNames(manifest) {
  validateSupportedPublicReleaseManifest(manifest);
  return [
    ...manifest.artifacts
      .filter(({ kind }) => kind !== "macos-application-bundle")
      .map(({ path: artifactPath }) => artifactPath),
    ...manifest.provenanceRequirements.generatedSubjects,
  ].sort((left, right) => left.localeCompare(right, "en"));
}

export function publicReleaseAssets(releaseDirectory, manifest) {
  const expectedNames = publicReleaseAssetNames(manifest);
  const actualNames = readdirSync(releaseDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map(({ name }) => name)
    .sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error("public release asset set does not match the closed manifest");
  }
  return expectedNames.map((name) => {
    const artifactPath = path.join(releaseDirectory, name);
    return {
      name,
      path: artifactPath,
      size: statSync(artifactPath).size,
      sha256: sha256File(artifactPath),
    };
  });
}

export function publicReleaseSignerWorkflow(manifest) {
  validateSupportedPublicReleaseManifest(manifest);
  return manifest.schemaVersion === 6 ? linuxExpansionSignerWorkflow : macosSignerWorkflow;
}

export function validateGithubRelease(record, expected) {
  const errors = [];
  if (record?.tagName !== `v${expected.version}`) errors.push("GitHub Release tag mismatch");
  if (record?.name !== `FitFreed ${expected.version}`) errors.push("GitHub Release title mismatch");
  if (record?.body !== expected.notes) errors.push("GitHub Release notes mismatch");
  if (record?.isPrerelease !== false) errors.push("stable GitHub Release cannot be a prerelease");
  if (record?.isDraft !== expected.draft) errors.push("GitHub Release draft state mismatch");
  if (!expected.draft && record?.isImmutable !== true) {
    errors.push("published GitHub Release is not immutable");
  }
  if (!expected.draft && typeof record?.publishedAt !== "string") {
    errors.push("published GitHub Release has no publication time");
  }

  const expectedAssets = new Map(expected.assets.map((asset) => [asset.name, asset]));
  const actualAssets = Array.isArray(record?.assets) ? record.assets : [];
  if (actualAssets.length !== expectedAssets.size) errors.push("GitHub Release asset count mismatch");
  for (const asset of actualAssets) {
    const expectedAsset = expectedAssets.get(asset.name);
    if (!expectedAsset) {
      errors.push(`unexpected GitHub Release asset: ${asset.name}`);
      continue;
    }
    expectedAssets.delete(asset.name);
    if (asset.state !== "uploaded") errors.push(`GitHub Release asset is not uploaded: ${asset.name}`);
    if (asset.size !== expectedAsset.size) errors.push(`GitHub Release asset size mismatch: ${asset.name}`);
    if (asset.digest !== `sha256:${expectedAsset.sha256}`) {
      errors.push(`GitHub Release asset digest mismatch: ${asset.name}`);
    }
  }
  for (const missing of expectedAssets.keys()) errors.push(`missing GitHub Release asset: ${missing}`);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    tag: record.tagName,
    immutable: record.isImmutable === true,
    assetCount: expected.assets.length,
  };
}

function readRelease(runCommand, tag, allowFailure = false) {
  const result = runCommand("gh", [
    "release",
    "view",
    tag,
    "--repo",
    repositoryName,
    "--json",
    "tagName,name,body,isDraft,isPrerelease,isImmutable,publishedAt,assets",
  ], { allowFailure });
  return result.success ? JSON.parse(result.output) : undefined;
}

export function verifyPublicAssetProvenance(
  runCommand,
  tag,
  revision,
  assets,
  signerWorkflow = macosSignerWorkflow,
) {
  for (const asset of assets) {
    runCommand("gh", [
      "attestation",
      "verify",
      asset.path,
      "--repo",
      repositoryName,
      "--signer-workflow",
      signerWorkflow,
      "--source-ref",
      `refs/tags/${tag}`,
      "--source-digest",
      revision,
      "--deny-self-hosted-runners",
    ]);
  }
}

export function verifyOriginReleaseTag(runCommand, tag, version, revision) {
  const result = runCommand("git", [
    "ls-remote",
    "origin",
    `refs/tags/${tag}`,
    `refs/tags/${tag}^{}`,
  ]);
  if (resolveRemoteTagRevision(result.output, version) !== revision) {
    throw new Error("origin release tag changed before publication");
  }
}

export function verifyGithubReleaseAssetLinks(runCommand, tag, assets) {
  for (const asset of assets) {
    runCommand("gh", [
      "release",
      "verify-asset",
      tag,
      asset.path,
      "--repo",
      repositoryName,
    ]);
  }
}

export function assertGithubReleaseImmutability(runCommand = defaultRun) {
  const result = runCommand("gh", [
    "api",
    "-H",
    "X-GitHub-Api-Version: 2026-03-10",
    `repos/${repositoryName}/immutable-releases`,
  ]);
  return validateImmutableReleaseSetting(JSON.parse(result.output));
}

export function publishVerifiedRelease({
  releaseDirectory,
  manifest,
  verified,
  runCommand = defaultRun,
}) {
  const assets = publicReleaseAssets(releaseDirectory, manifest);
  const notes = readFileSync(path.join(releaseDirectory, "RELEASE_NOTES.md"), "utf8");
  const tag = `v${verified.version}`;
  const expected = { version: verified.version, notes, assets };
  const signerWorkflow = publicReleaseSignerWorkflow(manifest);
  verifyOriginReleaseTag(runCommand, tag, verified.version, verified.revision);
  let release = readRelease(runCommand, tag, true);

  if (release && !release.isDraft) {
    const result = validateGithubRelease(release, { ...expected, draft: false });
    verifyPublicAssetProvenance(runCommand, tag, verified.revision, assets, signerWorkflow);
    verifyGithubReleaseAssetLinks(runCommand, tag, assets);
    verifyOriginReleaseTag(runCommand, tag, verified.version, verified.revision);
    return { ...result, alreadyPublished: true, revision: verified.revision };
  }
  if (release) {
    validateGithubRelease(release, { ...expected, draft: true });
  } else {
    runCommand("gh", [
      "release",
      "create",
      tag,
      ...assets.map(({ path: assetPath }) => assetPath),
      "--repo",
      repositoryName,
      "--verify-tag",
      "--draft",
      "--title",
      `FitFreed ${verified.version}`,
      "--notes-file",
      path.join(releaseDirectory, "RELEASE_NOTES.md"),
    ]);
    release = readRelease(runCommand, tag);
    validateGithubRelease(release, { ...expected, draft: true });
  }

  verifyPublicAssetProvenance(runCommand, tag, verified.revision, assets, signerWorkflow);
  runCommand("gh", [
    "release",
    "edit",
    tag,
    "--repo",
    repositoryName,
    "--verify-tag",
    "--draft=false",
    "--latest",
  ]);
  release = readRelease(runCommand, tag);
  const result = validateGithubRelease(release, { ...expected, draft: false });
  verifyGithubReleaseAssetLinks(runCommand, tag, assets);
  verifyOriginReleaseTag(runCommand, tag, verified.version, verified.revision);
  return { ...result, alreadyPublished: false, revision: verified.revision };
}

export function publishPublicRelease(candidateDirectory, runCommand = defaultRun) {
  const configuration = loadPublicUpdateConfiguration(repositoryRoot);
  const releaseSigningConfiguration = loadPublicReleaseSigningConfiguration(repositoryRoot);
  const { manifest, verified } = verifySupportedPublicReleaseCandidate({
    candidateDirectory,
    publicReleaseSigningConfiguration: releaseSigningConfiguration,
    publicUpdateConfiguration: configuration,
  });
  const releaseDirectory = path.resolve(candidateDirectory, "release");
  const reopenedManifest = readSupportedPublicReleaseManifest(releaseDirectory);
  if (JSON.stringify(reopenedManifest) !== JSON.stringify(manifest)) {
    throw new Error("verified public release manifest changed before publication");
  }
  if (manifest.release.version !== verified.version || manifest.release.revision !== verified.revision) {
    throw new Error("verified public release identity changed before publication");
  }
  return publishVerifiedRelease({ releaseDirectory, manifest, verified, runCommand });
}

function main() {
  const [operation, candidateDirectory] = process.argv.slice(2);
  if (operation === "check-immutability") {
    process.stdout.write(`${JSON.stringify(assertGithubReleaseImmutability())}\n`);
    return;
  }
  if (operation === "publish" && candidateDirectory) {
    process.stdout.write(`${JSON.stringify(publishPublicRelease(candidateDirectory))}\n`);
    return;
  }
  throw new Error(
    "usage: node scripts/public-release-publication.mjs <check-immutability|publish> [candidate]",
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Public release publication failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
