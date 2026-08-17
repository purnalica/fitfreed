import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { publicReleaseAssets } from "./public-release-publication.mjs";
import {
  downloadVerifiedPagesSnapshot,
  verifyRemotePublicRelease,
} from "./public-release-remote.mjs";
import { sha256File } from "./release-evidence.mjs";
import {
  createPublicReleaseCandidateFixture,
  publicUpdateConfiguration,
} from "./test-support/public-release-candidate.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fixture() {
  const stableBytes = Buffer.from("current stable envelope");
  const archiveBytes = Buffer.from("current updater archive");
  const version = "0.1.0";
  const archiveName = "FitFreed_0.1.0_aarch64.app.tar.gz";
  return {
    archiveBytes,
    archiveUrl: `https://purnalica.github.io/fitfreed/updates/${version}/${archiveName}`,
    pagesDirectory: mkdtempSync(path.join(tmpdir(), "fitfreed-pages-verification-")),
    stableBytes,
    stableUrl: "https://purnalica.github.io/fitfreed/updates/stable.json",
    manifest: {
      release: { version },
      update: { metadataEndpoint: "https://purnalica.github.io/fitfreed/updates/stable.json" },
      artifacts: [
        {
          kind: "stable-update-envelope",
          path: "stable.json",
          size: stableBytes.length,
          sha256: sha256(stableBytes),
        },
        {
          kind: "macos-updater-archive",
          path: archiveName,
          size: archiveBytes.length,
          sha256: sha256(archiveBytes),
        },
      ],
    },
  };
}

function response(url, bytes, overrides = {}) {
  return {
    status: 200,
    redirected: false,
    url,
    headers: new Headers({ "content-length": String(bytes.length) }),
    arrayBuffer: async () => bytes,
    ...overrides,
  };
}

test("waits for both direct Pages objects to converge to exact release bytes", async () => {
  const input = fixture();
  let stableRequests = 0;
  let waits = 0;
  const fetchImplementation = async (url, options) => {
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    if (url === input.stableUrl) {
      stableRequests += 1;
      return response(url, stableRequests === 1 ? Buffer.from("previous") : input.stableBytes);
    }
    assert.equal(url, input.archiveUrl);
    return response(url, input.archiveBytes);
  };

  const result = await downloadVerifiedPagesSnapshot({
    pagesDirectory: input.pagesDirectory,
    manifest: input.manifest,
    fetchImplementation,
    attempts: 2,
    intervalMilliseconds: 1,
    wait: async () => { waits += 1; },
  });
  assert.deepEqual(result, { attempts: 2, fileCount: 2 });
  assert.equal(waits, 1);
  assert.deepEqual(
    readFileSync(path.join(input.pagesDirectory, "updates", "stable.json")),
    input.stableBytes,
  );
  assert.deepEqual(
    readFileSync(path.join(
      input.pagesDirectory,
      "updates",
      "0.1.0",
      "FitFreed_0.1.0_aarch64.app.tar.gz",
    )),
    input.archiveBytes,
  );
});

test("rejects redirects and mismatched bytes without retaining a partial snapshot", async () => {
  for (const responseFactory of [
    (url, bytes) => response(url, bytes, { redirected: true }),
    (url) => response(url, Buffer.from("mutated")),
  ]) {
    const input = fixture();
    await assert.rejects(() => downloadVerifiedPagesSnapshot({
      pagesDirectory: input.pagesDirectory,
      manifest: input.manifest,
      fetchImplementation: async (url) => responseFactory(
        url,
        url === input.stableUrl ? input.stableBytes : input.archiveBytes,
      ),
      attempts: 1,
      wait: async () => {},
    }), /did not converge/);
    assert.throws(
      () => readFileSync(path.join(input.pagesDirectory, "updates", "stable.json")),
      /ENOENT/,
    );
  }
});

test("verifies one immutable public distribution from its remote boundaries", async () => {
  const input = createPublicReleaseCandidateFixture();
  const sourceAssets = publicReleaseAssets(input.releaseDirectory, input.manifest);
  const calls = [];
  let temporaryReleaseDirectory;
  const release = {
    tagName: "v0.1.0",
    name: "FitFreed 0.1.0",
    body: readFileSync(path.join(input.releaseDirectory, "RELEASE_NOTES.md"), "utf8"),
    isDraft: false,
    isPrerelease: false,
    isImmutable: true,
    publishedAt: "2026-08-18T00:00:00Z",
    assets: sourceAssets.map(({ name, path: assetPath }) => ({
      name,
      size: statSync(assetPath).size,
      digest: `sha256:${sha256File(assetPath)}`,
      state: "uploaded",
    })),
  };
  const runCommand = (command, args) => {
    calls.push([command, ...args]);
    if (command === "git" && args[0] === "ls-remote") {
      return {
        success: true,
        output: `${input.revision}\trefs/tags/v0.1.0`,
      };
    }
    if (command === "gh" && args[0] === "release" && args[1] === "download") {
      temporaryReleaseDirectory = args[args.indexOf("--dir") + 1];
      const patterns = args
        .map((value, index) => args[index - 1] === "--pattern" ? value : undefined)
        .filter(Boolean);
      for (const filename of patterns) {
        copyFileSync(
          path.join(input.releaseDirectory, filename),
          path.join(temporaryReleaseDirectory, filename),
        );
      }
      return { success: true, output: "" };
    }
    if (command === "gh" && args[0] === "release" && args[1] === "view") {
      return { success: true, output: JSON.stringify(release) };
    }
    return { success: true, output: "" };
  };
  const stableUrl = input.manifest.update.metadataEndpoint;
  const archive = input.manifest.artifacts.find(
    ({ kind }) => kind === "macos-updater-archive",
  );
  const archiveUrl = `https://purnalica.github.io/fitfreed/updates/0.1.0/${archive.path}`;
  const fetchImplementation = async (url) => {
    const source = url === stableUrl
      ? path.join(input.pagesDirectory, "updates", "stable.json")
      : path.join(input.pagesDirectory, "updates", "0.1.0", archive.path);
    assert.ok([stableUrl, archiveUrl].includes(url));
    const bytes = readFileSync(source);
    return response(url, bytes);
  };

  const result = await verifyRemotePublicRelease({
    version: "0.1.0",
    revision: input.revision,
    runCommand,
    fetchImplementation,
    attempts: 1,
    wait: async () => {},
    publicUpdateConfiguration,
  });

  assert.deepEqual(result, {
    version: "0.1.0",
    revision: input.revision,
    immutableRelease: true,
    attestedAssetCount: sourceAssets.length,
    pagesFileCount: 2,
    pagesVerificationAttempts: 1,
  });
  assert.equal(existsSync(temporaryReleaseDirectory), false);
  assert.equal(calls.filter(([command, first]) =>
    command === "git" && first === "ls-remote").length, 2);
  const provenanceCalls = calls.filter(([, first, second]) =>
    first === "attestation" && second === "verify");
  assert.equal(provenanceCalls.length, sourceAssets.length);
  assert.ok(provenanceCalls.every((args) =>
    args[args.indexOf("--source-ref") + 1] === "refs/tags/v0.1.0"
    && args[args.indexOf("--source-digest") + 1] === input.revision));
});
