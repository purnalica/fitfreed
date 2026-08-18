import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { composePagesArtifact, relativeFiles } from "./pages-artifact.mjs";
import {
  preflightPagesPublication,
  verifyPublishedPages,
} from "./pages-publication.mjs";
import { publicOrigin } from "./public-origin.mjs";

const repositoryRoot = path.resolve(new URL("..", import.meta.url).pathname);
const baseUrl = publicOrigin;

function response(url, status, bytes = "") {
  return {
    status,
    redirected: false,
    url,
    arrayBuffer: async () => Buffer.from(bytes),
  };
}

function productArtifact() {
  const root = mkdtempSync(path.join(os.tmpdir(), "fitfreed-pages-publication-"));
  const pagesDirectory = path.join(root, "pages");
  composePagesArtifact({ repositoryRoot, outputDirectory: pagesDirectory });
  return { pagesDirectory, root };
}

test("permits the first product publication and verifies every public byte", async () => {
  const artifact = productArtifact();
  const fetchImpl = async (url) => {
    if (url.endsWith("updates/stable.json")) return response(url, 404);
    const relative = new URL(url).pathname.slice(1) || "index.html";
    return response(url, 200, readFileSync(path.join(artifact.pagesDirectory, relative)));
  };

  assert.deepEqual(
    await preflightPagesPublication({
      baseUrl,
      pagesDirectory: artifact.pagesDirectory,
      fetchImpl,
    }),
    { localUpdateSnapshot: false, remoteUpdateSnapshot: false },
  );
  const verified = await verifyPublishedPages({
    attempts: 1,
    baseUrl,
    pagesDirectory: artifact.pagesDirectory,
    fetchImpl,
  });
  assert.equal(verified.fileCount, relativeFiles(artifact.pagesDirectory).length - 1);
  assert.equal(verified.updateSnapshot, false);

  rmSync(artifact.root, { recursive: true, force: true });
});

test("fails closed before a product-only deployment can erase an active update snapshot", async () => {
  const artifact = productArtifact();
  await assert.rejects(
    () => preflightPagesPublication({
      baseUrl,
      pagesDirectory: artifact.pagesDirectory,
      fetchImpl: async (url) => response(url, 200, "active stable envelope"),
    }),
    /erase the active update snapshot/u,
  );
  rmSync(artifact.root, { recursive: true, force: true });
});

test("rejects redirects and remotely divergent product bytes", async () => {
  const artifact = productArtifact();
  await assert.rejects(
    () => verifyPublishedPages({
      attempts: 1,
      baseUrl,
      pagesDirectory: artifact.pagesDirectory,
      fetchImpl: async (url) => ({
        ...response(url, 200, "divergent"),
        redirected: url.endsWith("index.html"),
      }),
    }),
    /redirected|byte mismatch/u,
  );
  rmSync(artifact.root, { recursive: true, force: true });
});
