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

import { composePagesArtifact, relativeFiles } from "./pages-artifact.mjs";
import { publicOrigin, publicUpdateUrl } from "./public-origin.mjs";
import {
  publicReleaseAssetNames,
  publicReleaseAssets,
  publicReleaseSignerWorkflow,
  validateGithubRelease,
  verifyGithubReleaseAssetLinks,
  verifyOriginReleaseTag,
  verifyPublicAssetProvenance,
} from "./public-release-publication.mjs";
import {
  readSupportedPublicReleaseManifest,
  verifySupportedPublicReleaseDistribution,
} from "./public-release-candidate-verification.mjs";
import {
  loadPublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { publicUpdatePackageName } from "./public-update-staging.mjs";

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
  const contentEncoding = response.headers.get("content-encoding");
  if (
    contentLength !== null
    && (contentEncoding === null || contentEncoding === "identity")
    && Number(contentLength) !== expected.size
  ) {
    throw new Error("public Pages content length mismatch");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== expected.size || sha256Bytes(bytes) !== expected.sha256) {
    throw new Error("public Pages content digest mismatch");
  }
  return bytes;
}

function publicPageUrl(relativePath) {
  const deployedPath = relativePath.split(path.sep).join("/");
  if (deployedPath === "index.html") return publicOrigin;
  if (deployedPath.endsWith("/index.html")) {
    return new URL(`${path.posix.dirname(deployedPath)}/`, publicOrigin).toString();
  }
  return new URL(deployedPath, publicOrigin).toString();
}

async function verifyProductPages(pagesDirectory, fetchImplementation) {
  const productFiles = relativeFiles(pagesDirectory).filter(
    (filename) => filename !== ".nojekyll" && !filename.startsWith(`updates${path.sep}`),
  );
  await Promise.all(productFiles.map(async (filename) => {
    const expectedBytes = readFileSync(path.join(pagesDirectory, filename));
    await fetchExactBytes(publicPageUrl(filename), {
      sha256: sha256Bytes(expectedBytes),
      size: expectedBytes.length,
    }, fetchImplementation);
  }));
  return productFiles.length;
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
  const currentPackages = manifest.artifacts.filter(({ kind }) =>
    ["macos-updater-archive", "linux-x86_64-deb"].includes(kind));
  if (!stable || currentPackages.length < 1) {
    throw new Error("public Pages manifest evidence is incomplete");
  }
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "fitfreed-remote-pages-"));
  const updateDirectory = path.join(temporaryRoot, "updates");

  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        rmSync(updateDirectory, { force: true, recursive: true });
        mkdirSync(updateDirectory, { recursive: true });
        const stableBytes = await fetchExactBytes(
          manifest.update.metadataEndpoint,
          stable,
          fetchImplementation,
        );
        const envelope = JSON.parse(stableBytes.toString("utf8"));
        const payload = JSON.parse(
          Buffer.from(envelope.fitfreed.payloadBase64, "base64").toString("utf8"),
        );
        const targets = currentPackages.map((artifact) => ({
          url: publicUpdateUrl(`${manifest.release.version}/${artifact.path}`),
          destination: path.join(
            updateDirectory,
            manifest.release.version,
            artifact.path,
          ),
          expected: artifact,
        }));
        for (const recovery of payload.release.recoveryArtifacts ?? []) {
          const packageName = publicUpdatePackageName(recovery.version, recovery.target);
          const url = publicUpdateUrl(`${recovery.version}/${packageName}`);
          if (recovery.url !== url) throw new Error("public recovery URL is not canonical");
          targets.push({
            url,
            destination: path.join(
              updateDirectory,
              recovery.version,
              packageName,
            ),
            expected: recovery,
          });
        }
        const results = await Promise.all(targets.map(({ url, expected }) =>
          fetchExactBytes(url, expected, fetchImplementation)));
        const stableDestination = path.join(updateDirectory, "stable.json");
        mkdirSync(path.dirname(stableDestination), { recursive: true });
        writeFileSync(stableDestination, stableBytes);
        for (const [index, { destination }] of targets.entries()) {
          mkdirSync(path.dirname(destination), { recursive: true });
          writeFileSync(destination, results[index]);
        }
        composePagesArtifact({
          repositoryRoot,
          outputDirectory: pagesDirectory,
          updateDirectory,
        });
        const productFileCount = await verifyProductPages(
          pagesDirectory,
          fetchImplementation,
        );
        return {
          attempts: attempt,
          fileCount: productFileCount + targets.length + 1,
        };
      } catch {
        rmSync(pagesDirectory, { force: true, recursive: true });
        rmSync(updateDirectory, { force: true, recursive: true });
        if (attempt === attempts) {
          throw new Error("public Pages did not converge to the expected release snapshot");
        }
        await wait(intervalMilliseconds);
      }
    }
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true });
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
  publicReleaseSigningConfiguration = loadPublicReleaseSigningConfiguration(repositoryRoot),
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
    const manifest = readSupportedPublicReleaseManifest(releaseDirectory);
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
    verifyPublicAssetProvenance(
      runCommand,
      tag,
      revision,
      assets,
      publicReleaseSignerWorkflow(manifest),
    );
    verifyGithubReleaseAssetLinks(runCommand, tag, assets);
    const pagesEvidence = await downloadVerifiedPagesSnapshot({
      pagesDirectory,
      manifest,
      fetchImplementation,
      ...(attempts === undefined ? {} : { attempts }),
      ...(intervalMilliseconds === undefined ? {} : { intervalMilliseconds }),
      ...(wait === undefined ? {} : { wait }),
    });
    const distribution = verifySupportedPublicReleaseDistribution({
      pagesDirectory,
      publicReleaseSigningConfiguration,
      publicUpdateConfiguration,
      releaseDirectory,
    });
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
