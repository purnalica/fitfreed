import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePublicReleaseManifest } from "./public-release-evidence.mjs";
import {
  publicReleaseAssetNames,
  publicReleaseAssets,
  validateGithubRelease,
  verifyGithubReleaseAssetLinks,
  verifyOriginReleaseTag,
  verifyPublicAssetProvenance,
} from "./public-release-publication.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { verifyPublicReleaseDistribution } from "./verify-public-release.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryName = "purnalica/fitfreed";
const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const revisionPattern = /^[0-9a-f]{40,64}$/;

function defaultRun(command, args) {
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
    throw new Error(`${path.basename(command)} remote public release command failed`);
  }
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fetchExactBytes(url, expected, fetchImplementation) {
  const response = await fetchImplementation(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (
    response.status !== 200
    || response.redirected !== false
    || response.url !== url
  ) {
    throw new Error("public Pages response boundary mismatch");
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== expected.size) {
    throw new Error("public Pages content length mismatch");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== expected.size || sha256Bytes(bytes) !== expected.sha256) {
    throw new Error("public Pages content digest mismatch");
  }
  return bytes;
}

export async function downloadVerifiedPagesSnapshot({
  pagesDirectory,
  manifest,
  fetchImplementation = fetch,
  attempts = 24,
  intervalMilliseconds = 5_000,
  wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
}) {
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 60) {
    throw new Error("public Pages verification attempt count is invalid");
  }
  if (
    !Number.isSafeInteger(intervalMilliseconds)
    || intervalMilliseconds < 0
    || intervalMilliseconds > 30_000
  ) {
    throw new Error("public Pages verification interval is invalid");
  }
  rmSync(pagesDirectory, { force: true, recursive: true });
  const stable = manifest.artifacts.find(({ kind }) => kind === "stable-update-envelope");
  const archive = manifest.artifacts.find(({ kind }) => kind === "macos-updater-archive");
  const targets = [
    {
      url: manifest.update.metadataEndpoint,
      destination: path.join(pagesDirectory, "updates", "stable.json"),
      expected: stable,
    },
    {
      url: `https://purnalica.github.io/fitfreed/updates/${manifest.release.version}/${archive.path}`,
      destination: path.join(
        pagesDirectory,
        "updates",
        manifest.release.version,
        archive.path,
      ),
      expected: archive,
    },
  ];

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const results = await Promise.all(targets.map(({ url, expected }) =>
        fetchExactBytes(url, expected, fetchImplementation)));
      for (const [index, { destination }] of targets.entries()) {
        mkdirSync(path.dirname(destination), { recursive: true });
        writeFileSync(destination, results[index]);
      }
      return { attempts: attempt, fileCount: targets.length };
    } catch {
      if (attempt === attempts) {
        throw new Error("public Pages did not converge to the expected release snapshot");
      }
      await wait(intervalMilliseconds);
    }
  }
  throw new Error("public Pages verification did not execute");
}

function readRelease(runCommand, tag) {
  return JSON.parse(runCommand("gh", [
    "release",
    "view",
    tag,
    "--repo",
    repositoryName,
    "--json",
    "tagName,name,body,isDraft,isPrerelease,isImmutable,publishedAt,assets",
  ]).output);
}

export async function verifyRemotePublicRelease({
  version,
  revision,
  runCommand = defaultRun,
  fetchImplementation = fetch,
  attempts,
  intervalMilliseconds,
  wait,
  publicUpdateConfiguration = loadPublicUpdateConfiguration(repositoryRoot),
}) {
  if (!semanticVersion.test(version ?? "")) throw new Error("remote release version is invalid");
  if (!revisionPattern.test(revision ?? "")) throw new Error("remote release revision is invalid");
  const tag = `v${version}`;
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "fitfreed-remote-release-"));
  const releaseDirectory = path.join(temporaryRoot, "release");
  const pagesDirectory = path.join(temporaryRoot, "pages");
  mkdirSync(releaseDirectory);

  try {
    verifyOriginReleaseTag(runCommand, tag, version, revision);
    runCommand("gh", [
      "release",
      "download",
      tag,
      "--repo",
      repositoryName,
      "--dir",
      releaseDirectory,
      "--pattern",
      "release-manifest.json",
    ]);
    const manifest = validatePublicReleaseManifest(JSON.parse(
      readFileSync(path.join(releaseDirectory, "release-manifest.json"), "utf8"),
    ));
    if (manifest.release.version !== version || manifest.release.revision !== revision) {
      throw new Error("remote release manifest does not identify the authorized source");
    }
    const assetNames = publicReleaseAssetNames(manifest);
    runCommand("gh", [
      "release",
      "download",
      tag,
      "--repo",
      repositoryName,
      "--dir",
      releaseDirectory,
      "--clobber",
      ...assetNames.flatMap((name) => ["--pattern", name]),
    ]);
    const assets = publicReleaseAssets(releaseDirectory, manifest);
    const release = readRelease(runCommand, tag);
    const releaseEvidence = validateGithubRelease(release, {
      version,
      notes: readFileSync(path.join(releaseDirectory, "RELEASE_NOTES.md"), "utf8"),
      assets,
      draft: false,
    });
    verifyPublicAssetProvenance(runCommand, tag, revision, assets);
    verifyGithubReleaseAssetLinks(runCommand, tag, assets);
    const pagesEvidence = await downloadVerifiedPagesSnapshot({
      pagesDirectory,
      manifest,
      fetchImplementation,
      ...(attempts === undefined ? {} : { attempts }),
      ...(intervalMilliseconds === undefined ? {} : { intervalMilliseconds }),
      ...(wait === undefined ? {} : { wait }),
    });
    const distribution = verifyPublicReleaseDistribution(
      releaseDirectory,
      pagesDirectory,
      publicUpdateConfiguration,
    );
    verifyOriginReleaseTag(runCommand, tag, version, revision);
    return {
      version: distribution.version,
      revision: distribution.revision,
      immutableRelease: releaseEvidence.immutable,
      attestedAssetCount: releaseEvidence.assetCount,
      pagesFileCount: pagesEvidence.fileCount,
      pagesVerificationAttempts: pagesEvidence.attempts,
    };
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

async function main() {
  const [version, revision] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(await verifyRemotePublicRelease({ version, revision }))}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`Remote public release verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
