import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
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
          url: `https://purnalica.github.io/fitfreed/updates/0.1.0/${packageName}`,
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
    "assets/brand/fitfreed-logo-mono.svg",
    "assets/brand/fitfreed-logo.svg",
    "index.html",
    "styles.css",
  ]);
  const page = readFileSync(path.join(outputDirectory, "index.html"), "utf8");
  assert.match(page, /href="assets\/brand\/fitfreed-favicon\.svg"/u);
  assert.match(
    page,
    /href="https:\/\/github\.com\/purnalica\/fitfreed\/blob\/main\/docs\/roadmap\.md"/u,
  );
  assert.doesNotMatch(page, /(?:href|src)="\.\.\//u);
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
