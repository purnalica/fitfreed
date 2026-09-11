import assert from "node:assert/strict";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import test from "node:test";

import { publicReleaseAssets } from "./public-release-publication.mjs";
import { prepareCurrentPublicPages } from "./public-release-remote.mjs";
import { sha256File } from "./release-evidence.mjs";
import { createPublicReleaseCandidateFixture } from "./test-support/public-release-candidate.mjs";

function response(url, bytes) {
  return {
    status: 200,
    redirected: false,
    url,
    headers: new Headers({ "content-length": String(bytes.length) }),
    arrayBuffer: async () => bytes,
  };
}

function remotePagesFile(pagesDirectory, url) {
  const pathname = new URL(url).pathname;
  const relativePath = pathname === "/"
    ? "index.html"
    : pathname.endsWith("/")
      ? `${pathname.slice(1)}index.html`
      : pathname.slice(1);
  return path.join(pagesDirectory, ...relativePath.split("/"));
}

function publicReleaseHarness(input, { immutable = true } = {}) {
  const version = input.manifest.release.version;
  const tag = `v${version}`;
  const sourceAssets = publicReleaseAssets(input.releaseDirectory, input.manifest);
  const calls = [];
  const release = {
    tagName: tag,
    name: `FitFreed ${version}`,
    body: readFileSync(path.join(input.releaseDirectory, "RELEASE_NOTES.md"), "utf8"),
    isDraft: false,
    isPrerelease: false,
    isImmutable: immutable,
    publishedAt: "2026-09-12T00:00:00Z",
    assets: sourceAssets.map(({ name, path: assetPath }) => ({
      name,
      size: statSync(assetPath).size,
      digest: `sha256:${sha256File(assetPath)}`,
      state: "uploaded",
    })),
  };
  return {
    calls,
    sourceAssets,
    runCommand(command, args) {
      calls.push([command, ...args]);
      if (command === "git" && args[0] === "ls-remote") {
        return { success: true, output: `${input.revision}\trefs/tags/${tag}` };
      }
      if (command === "gh" && args[0] === "release" && args[1] === "view") {
        return { success: true, output: JSON.stringify(release) };
      }
      if (command === "gh" && args[0] === "release" && args[1] === "download") {
        const destination = args[args.indexOf("--dir") + 1];
        const patterns = args
          .map((value, index) => args[index - 1] === "--pattern" ? value : undefined)
          .filter(Boolean);
        for (const filename of patterns) {
          copyFileSync(
            path.join(input.releaseDirectory, filename),
            path.join(destination, filename),
          );
        }
        return { success: true, output: "" };
      }
      return { success: true, output: "" };
    },
  };
}

test("composes current product sources with the authenticated active update snapshot", async () => {
  const input = createPublicReleaseCandidateFixture();
  const harness = publicReleaseHarness(input);
  const pagesDirectory = path.join(input.root, "prepared-product-pages");
  const result = await prepareCurrentPublicPages({
    pagesDirectory,
    runCommand: harness.runCommand,
    fetchImplementation: async (url) => response(
      url,
      readFileSync(remotePagesFile(input.pagesDirectory, url)),
    ),
    attempts: 1,
    wait: async () => {},
  });

  assert.deepEqual(result, {
    version: input.manifest.release.version,
    revision: input.revision,
    immutableRelease: true,
    attestedAssetCount: harness.sourceAssets.length,
    pagesFileCount: 10,
    productFileCount: 9,
    updateFileCount: 2,
  });
  assert.ok(existsSync(path.join(pagesDirectory, "updates", "stable.json")));
  assert.ok(existsSync(path.join(
    pagesDirectory,
    "updates",
    input.manifest.release.version,
    "FitFreed_0.1.0_aarch64.app.tar.gz",
  )));
  assert.equal(harness.calls.filter(
    ([command, first, second]) => command === "gh" && first === "attestation" && second === "verify",
  ).length, harness.sourceAssets.length);
});

test("refuses to preserve a release that is not immutable", async () => {
  const input = createPublicReleaseCandidateFixture();
  const harness = publicReleaseHarness(input, { immutable: false });
  await assert.rejects(() => prepareCurrentPublicPages({
    pagesDirectory: path.join(input.root, "rejected-product-pages"),
    runCommand: harness.runCommand,
    fetchImplementation: async () => {
      throw new Error("update bytes must not be fetched");
    },
    attempts: 1,
    wait: async () => {},
  }), /not immutable/u);
});
