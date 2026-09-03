import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  composePagesArtifact,
  relativeFiles,
  verifyPagesArtifact,
} from "./pages-artifact.mjs";
import { publicUpdateUrl } from "./public-origin.mjs";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function syntheticUpdateSnapshot(root) {
  const updateDirectory = path.join(root, "updates-source");
  const packageBytes = Buffer.from("synthetic updater package");
  const packageName = "FitFreed_0.1.0_aarch64.app.tar.gz";
  const packageDirectory = path.join(updateDirectory, "0.1.0");
  mkdirSync(packageDirectory, { recursive: true });
  writeFileSync(path.join(packageDirectory, packageName), packageBytes);
  const payloadBytes = Buffer.from(JSON.stringify({
    release: {
      version: "0.1.0",
      platforms: {
        "darwin-aarch64": {
          url: publicUpdateUrl(`0.1.0/${packageName}`),
          size: packageBytes.length,
          sha256: sha256(packageBytes),
        },
      },
    },
  }));
  writeFileSync(path.join(updateDirectory, "stable.json"), `${JSON.stringify({
    fitfreed: { payloadBase64: payloadBytes.toString("base64") },
  })}\n`);
  return updateDirectory;
}

function syntheticExpandedUpdateSnapshot(root) {
  const updateDirectory = path.join(root, "expanded-updates-source");
  const version = "0.2.0";
  const artifacts = [
    {
      bytes: Buffer.from("synthetic macOS updater package"),
      name: `FitFreed_${version}_aarch64.app.tar.gz`,
      target: "darwin-aarch64",
      version,
    },
    {
      bytes: Buffer.from("synthetic Linux updater package"),
      name: `FitFreed_${version}_amd64.deb`,
      target: "linux-x86_64-deb",
      version,
    },
    {
      bytes: Buffer.from("synthetic predecessor Linux package"),
      name: "FitFreed_0.1.0_amd64.deb",
      target: "linux-x86_64-deb",
      version: "0.1.0",
    },
  ];
  for (const artifact of artifacts) {
    const directory = path.join(updateDirectory, artifact.version);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, artifact.name), artifact.bytes);
  }
  const current = artifacts.slice(0, 2);
  const predecessor = artifacts[2];
  const payloadBytes = Buffer.from(JSON.stringify({
    release: {
      version,
      platforms: Object.fromEntries(current.map((artifact) => [artifact.target, {
        url: publicUpdateUrl(`${artifact.version}/${artifact.name}`),
        size: artifact.bytes.length,
        sha256: sha256(artifact.bytes),
      }])),
      recoveryArtifacts: [{
        version: predecessor.version,
        target: predecessor.target,
        url: publicUpdateUrl(`${predecessor.version}/${predecessor.name}`),
        size: predecessor.bytes.length,
        sha256: sha256(predecessor.bytes),
      }],
    },
  }));
  writeFileSync(path.join(updateDirectory, "stable.json"), `${JSON.stringify({
    fitfreed: { payloadBase64: payloadBytes.toString("base64") },
  })}\n`);
  return updateDirectory;
}

test("composes the canonical product root without an unsupported update channel", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fitfreed-pages-"));
  const outputDirectory = path.join(root, "pages");

  const result = composePagesArtifact({ repositoryRoot, outputDirectory });

  assert.deepEqual(result.files, [
    ".nojekyll",
    "assets/brand/fitfreed-favicon.svg",
    "assets/brand/fitfreed-logo-dark.svg",
    "assets/brand/fitfreed-logo-mono.svg",
    "assets/brand/fitfreed-logo.svg",
    "es/index.html",
    "index.html",
    "locale.js",
    "styles.css",
  ]);
  const page = readFileSync(path.join(outputDirectory, "index.html"), "utf8");
  const spanishPage = readFileSync(path.join(outputDirectory, "es", "index.html"), "utf8");
  assert.match(page, /href="assets\/brand\/fitfreed-favicon\.svg"/u);
  assert.match(spanishPage, /href="\.\.\/assets\/brand\/fitfreed-favicon\.svg"/u);
  assert.match(page, /srcset="assets\/brand\/fitfreed-logo-dark\.svg"/u);
  assert.match(spanishPage, /srcset="\.\.\/assets\/brand\/fitfreed-logo-dark\.svg"/u);
  assert.match(spanishPage, /<html lang="es-ES"/u);
  assert.match(spanishPage, /<h1[^>]*>.*historial deportivo/isu);
  assert.match(
    page,
    /href="https:\/\/github\.com\/purnalica\/fitfreed\/blob\/main\/docs\/roadmap\.md#milestone-2--mvp"/u,
  );
  assert.doesNotMatch(page, /(?:href|src|srcset)="\.\.\//u);
  for (const [outputFile, output] of [["index.html", page], ["es/index.html", spanishPage]]) {
    for (const [, reference] of output.matchAll(/(?:href|src|srcset)="([^"\n]+)"/gu)) {
      if (/^(?:#|\/|https:\/\/)/u.test(reference)) continue;
      const deployedPath = new URL(reference, new URL(outputFile, "https://pages.invalid/")).pathname;
      const target = path.resolve(outputDirectory, deployedPath.slice(1));
      assert.ok(existsSync(target), `missing deployed page dependency: ${outputFile} -> ${reference}`);
    }
  }
  const styles = readFileSync(path.join(outputDirectory, "styles.css"), "utf8");
  for (const [, reference] of styles.matchAll(/url\(["']?([^"')]+)["']?\)/gu)) {
    const deployedPath = new URL(reference, "https://pages.invalid/styles.css").pathname;
    assert.ok(
      existsSync(path.resolve(outputDirectory, deployedPath.slice(1))),
      `missing deployed stylesheet dependency: ${reference}`,
    );
  }
  assert.deepEqual(relativeFiles(outputDirectory), result.files);

  rmSync(root, { recursive: true, force: true });
});

test("preserves one complete digest-bound update snapshot and rejects partial input", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fitfreed-pages-updates-"));
  const updateDirectory = syntheticUpdateSnapshot(root);
  const outputDirectory = path.join(root, "pages");

  const result = composePagesArtifact({ repositoryRoot, outputDirectory, updateDirectory });
  assert.equal(result.updateSnapshot, "0.1.0");
  assert.deepEqual(
    readFileSync(path.join(outputDirectory, "updates", "stable.json")),
    readFileSync(path.join(updateDirectory, "stable.json")),
  );

  writeFileSync(path.join(updateDirectory, "unexpected"), "partial or divergent");
  assert.throws(
    () => composePagesArtifact({
      repositoryRoot,
      outputDirectory: path.join(root, "rejected"),
      updateDirectory,
    }),
    /unexpected update snapshot file set/u,
  );

  rmSync(root, { recursive: true, force: true });
});

test("preserves every current and recovery package in a platform expansion", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fitfreed-pages-expansion-"));
  const updateDirectory = syntheticExpandedUpdateSnapshot(root);
  const outputDirectory = path.join(root, "pages");

  const result = composePagesArtifact({ repositoryRoot, outputDirectory, updateDirectory });

  assert.equal(result.updateSnapshot, "0.2.0");
  assert.deepEqual(
    relativeFiles(outputDirectory).filter((entry) => entry.startsWith(`updates${path.sep}`)),
    [
      "updates/0.1.0/FitFreed_0.1.0_amd64.deb",
      "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
      "updates/0.2.0/FitFreed_0.2.0_amd64.deb",
      "updates/stable.json",
    ],
  );

  rmSync(root, { recursive: true, force: true });
});

test("reopens the canonical product site and complete update snapshot", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "fitfreed-pages-reopening-"));
  const updateDirectory = syntheticExpandedUpdateSnapshot(root);
  const outputDirectory = path.join(root, "pages");
  composePagesArtifact({ repositoryRoot, outputDirectory, updateDirectory });

  const verified = verifyPagesArtifact({ repositoryRoot, pagesDirectory: outputDirectory });
  assert.equal(verified.updateSnapshot, "0.2.0");
  assert.equal(verified.productFileCount, 9);
  assert.equal(verified.updateFileCount, 4);

  writeFileSync(path.join(outputDirectory, "index.html"), "mutated product page");
  assert.throws(
    () => verifyPagesArtifact({ repositoryRoot, pagesDirectory: outputDirectory }),
    /product file mismatch/,
  );

  rmSync(root, { recursive: true, force: true });
});
