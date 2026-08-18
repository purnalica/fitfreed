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

import { composePagesArtifact, relativeFiles } from "./pages-artifact.mjs";
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
  assert.match(spanishPage, /<html lang="es-ES"/u);
  assert.match(spanishPage, /<h1[^>]*>.*historial deportivo/isu);
  assert.match(
    page,
    /href="https:\/\/github\.com\/purnalica\/fitfreed\/blob\/main\/docs\/roadmap\.md"/u,
  );
  assert.doesNotMatch(page, /(?:href|src)="\.\.\//u);
  for (const [outputFile, output] of [["index.html", page], ["es/index.html", spanishPage]]) {
    for (const [, reference] of output.matchAll(/(?:href|src)="([^"\n]+)"/gu)) {
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
