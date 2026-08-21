import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { promoteStagedDirectory } from "./release-evidence.mjs";
import {
  loadProductPageLocalization,
  renderLocaleRuntime,
  renderLocalizedProductPages,
} from "./product-page-localization.mjs";
import { publicOrigin, publicUpdateUrl } from "./public-origin.mjs";

const repositoryUrl = "https://github.com/purnalica/fitfreed/blob/main/";
const pagesOrigin = new URL(publicOrigin).origin;
const pagesUpdatePrefix = new URL("updates/", publicOrigin).pathname;
const productAssets = Object.freeze([
  "fitfreed-favicon.svg",
  "fitfreed-logo-dark.svg",
  "fitfreed-logo-mono.svg",
  "fitfreed-logo.svg",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function relativeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile()) files.push(path.relative(root, entryPath));
      else throw new Error(`unsupported Pages artifact entry: ${entry.name}`);
    }
  };
  visit(root);
  return files.sort();
}

function deployedProductPage(source, outputFile) {
  const pageDirectory = path.posix.dirname(outputFile);
  const artifactReference = (target) => path.posix.relative(pageDirectory, target) || path.posix.basename(target);
  const deployedReference = (target) => {
    let destination = target;
    if (target === "styles.css") destination = artifactReference("styles.css");
    else if (target.endsWith("locale.js")) destination = artifactReference("locale.js");
    else if (target.startsWith("../assets/")) destination = artifactReference(target.slice(3));
    else if (target.startsWith("../")) destination = new URL(target.slice(3), repositoryUrl).toString();
    return destination;
  };
  const deployedSourceSet = (sourceSet) => sourceSet.split(",").map((candidate) => {
    const [, target, descriptor = ""] = candidate.trim().match(/^(\S+)(.*)$/u);
    return `${deployedReference(target)}${descriptor}`;
  }).join(", ");

  return source.replaceAll(/(href|src|srcset)="([^"\n]+)"/gu, (_match, attribute, target) => {
    const destination = attribute === "srcset" ? deployedSourceSet(target) : deployedReference(target);
    return `${attribute}="${destination}"`;
  });
}

function validateUpdateSnapshot(updateDirectory) {
  const stablePath = path.join(updateDirectory, "stable.json");
  const envelopeBytes = readFileSync(stablePath);
  const envelope = JSON.parse(envelopeBytes);
  const payloadBase64 = envelope?.fitfreed?.payloadBase64;
  if (typeof payloadBase64 !== "string" || payloadBase64.length === 0) {
    throw new Error("update snapshot envelope has no payload");
  }
  const payloadBytes = Buffer.from(payloadBase64, "base64");
  if (payloadBytes.toString("base64") !== payloadBase64) {
    throw new Error("update snapshot payload is not canonical base64");
  }
  const payload = JSON.parse(payloadBytes);
  const platforms = Object.values(payload?.release?.platforms ?? {});
  if (platforms.length !== 1) {
    throw new Error("update snapshot must describe exactly one platform package");
  }
  const artifact = platforms[0];
  const artifactUrl = new URL(artifact.url);
  if (artifactUrl.origin !== pagesOrigin || !artifactUrl.pathname.startsWith(pagesUpdatePrefix)) {
    throw new Error("update snapshot package URL is outside the canonical Pages origin");
  }
  const packagePath = decodeURIComponent(artifactUrl.pathname.slice(pagesUpdatePrefix.length));
  if (
    packagePath.length === 0
    || path.posix.normalize(packagePath) !== packagePath
    || packagePath.startsWith("../")
    || path.isAbsolute(packagePath)
  ) {
    throw new Error("update snapshot package path is unsafe");
  }
  const packageBytes = readFileSync(path.join(updateDirectory, ...packagePath.split("/")));
  if (
    packageBytes.length !== artifact.size
    || sha256(packageBytes) !== artifact.sha256
  ) {
    throw new Error("update snapshot package does not match its payload");
  }
  const expectedFiles = ["stable.json", packagePath].sort();
  if (JSON.stringify(relativeFiles(updateDirectory)) !== JSON.stringify(expectedFiles)) {
    throw new Error("unexpected update snapshot file set");
  }
  if (payload.release.version !== packagePath.split("/")[0]) {
    throw new Error("update snapshot version directory does not match its payload");
  }
  if (artifact.url !== publicUpdateUrl(packagePath)) {
    throw new Error("update snapshot package URL is not canonical");
  }
  return payload.release.version;
}

function assertSafeOutput(outputDirectory) {
  const resolved = path.resolve(outputDirectory);
  if (resolved === path.parse(resolved).root || resolved === path.resolve(".")) {
    throw new Error("Pages artifact output directory is unsafe");
  }
  return resolved;
}

export function composePagesArtifact({
  repositoryRoot,
  outputDirectory,
  updateDirectory,
}) {
  const resolvedRoot = path.resolve(repositoryRoot);
  const resolvedOutput = assertSafeOutput(outputDirectory);
  const operationId = randomUUID();
  const stagingDirectory = `${resolvedOutput}.staging-${operationId}`;
  const updateSnapshot = updateDirectory
    ? validateUpdateSnapshot(path.resolve(updateDirectory))
    : null;

  rmSync(stagingDirectory, { recursive: true, force: true });
  mkdirSync(path.join(stagingDirectory, "assets", "brand"), { recursive: true });
  try {
    const localization = loadProductPageLocalization(resolvedRoot);
    const localizedPages = renderLocalizedProductPages(localization);
    for (const [outputFile, page] of Object.entries(localizedPages)) {
      const outputPath = path.join(stagingDirectory, ...outputFile.split("/"));
      mkdirSync(path.dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, deployedProductPage(page, outputFile));
    }
    writeFileSync(
      path.join(stagingDirectory, "locale.js"),
      renderLocaleRuntime(localization.config),
    );
    copyFileSync(
      path.join(resolvedRoot, "site", "styles.css"),
      path.join(stagingDirectory, "styles.css"),
    );
    for (const asset of productAssets) {
      const source = path.join(resolvedRoot, "assets", "brand", asset);
      if (!statSync(source).isFile()) throw new Error(`product asset is not a file: ${asset}`);
      copyFileSync(source, path.join(stagingDirectory, "assets", "brand", asset));
    }
    writeFileSync(path.join(stagingDirectory, ".nojekyll"), "");
    if (updateDirectory) {
      cpSync(path.resolve(updateDirectory), path.join(stagingDirectory, "updates"), {
        recursive: true,
      });
    }
    promoteStagedDirectory(stagingDirectory, resolvedOutput, operationId);
  } catch (error) {
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }

  return {
    files: relativeFiles(resolvedOutput),
    outputDirectory: resolvedOutput,
    updateSnapshot,
  };
}

function run() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const [output = ".artifacts/pages", updateDirectory] = process.argv.slice(2);
  process.stdout.write(`${JSON.stringify(composePagesArtifact({
    repositoryRoot,
    outputDirectory: path.resolve(repositoryRoot, output),
    updateDirectory,
  }))}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) run();
