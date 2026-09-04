import assert from "node:assert/strict";
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

import {
  publicOrigin,
  publicUpdateEndpoint,
  publicUpdateUrl,
} from "./public-origin.mjs";
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
import {
  completePlatformReleaseSigningConfiguration,
  completePlatformUpdateConfiguration,
  createCompletePlatformReleaseCandidateFixture,
} from "./test-support/complete-platform-release-candidate.mjs";
import {
  createExpandingPublicReleaseCandidateFixture,
  expandingPublicReleaseSigningConfiguration,
  expandingPublicUpdateConfiguration,
} from "./test-support/expanding-public-release-candidate.mjs";

function fixture() {
  const candidate = createPublicReleaseCandidateFixture();
  const { manifest, pagesDirectory: productPagesDirectory, releaseDirectory, root } = candidate;
  const version = manifest.release.version;
  const archive = manifest.artifacts.find(({ kind }) => kind === "macos-updater-archive");
  const stable = manifest.artifacts.find(({ kind }) => kind === "stable-update-envelope");
  const archiveBytes = readFileSync(path.join(releaseDirectory, archive.path));
  const stableBytes = readFileSync(path.join(releaseDirectory, stable.path));
  return {
    archiveBytes,
    archiveUrl: publicUpdateUrl(`${version}/${archive.path}`),
    pagesDirectory: path.join(root, "downloaded-pages"),
    productPagesDirectory,
    stableBytes,
    stableUrl: publicUpdateEndpoint,
    manifest,
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

function remoteReleaseHarness(input, publishedAt) {
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
    isImmutable: true,
    publishedAt,
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
      if (command === "gh" && args[0] === "release" && args[1] === "view") {
        return { success: true, output: JSON.stringify(release) };
      }
      return { success: true, output: "" };
    },
  };
}

test("waits for update objects and the complete product site to converge", async () => {
  const input = fixture();
  let stableRequests = 0;
  let waits = 0;
  const productRequests = new Set();
  const fetchImplementation = async (url, options) => {
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    if (url === input.stableUrl) {
      stableRequests += 1;
      return response(url, stableRequests === 1 ? Buffer.from("previous") : input.stableBytes);
    }
    if (url === input.archiveUrl) return response(url, input.archiveBytes);
    productRequests.add(url);
    const bytes = readFileSync(remotePagesFile(input.productPagesDirectory, url));
    return response(url, bytes);
  };

  const result = await downloadVerifiedPagesSnapshot({
    pagesDirectory: input.pagesDirectory,
    manifest: input.manifest,
    fetchImplementation,
    attempts: 2,
    intervalMilliseconds: 1,
    wait: async () => { waits += 1; },
  });
  assert.deepEqual(result, { attempts: 2, fileCount: 10 });
  assert.equal(waits, 1);
  assert.equal(productRequests.size, 8);
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

test("verifies decoded response bytes independently of compressed transfer length", async () => {
  const input = fixture();
  const fetchImplementation = async (url) => {
    const bytes = url === input.stableUrl
      ? input.stableBytes
      : url === input.archiveUrl
        ? input.archiveBytes
        : readFileSync(remotePagesFile(input.productPagesDirectory, url));
    return response(url, bytes, {
      headers: new Headers({
        "content-encoding": "br",
        "content-length": String(Math.max(1, bytes.length - 1)),
      }),
    });
  };

  const result = await downloadVerifiedPagesSnapshot({
    attempts: 1,
    fetchImplementation,
    manifest: input.manifest,
    pagesDirectory: input.pagesDirectory,
    wait: async () => {},
  });

  assert.deepEqual(result, { attempts: 1, fileCount: 10 });
});

test("rejects a remote product page that diverges from the exact release source", async () => {
  const input = fixture();
  await assert.rejects(() => downloadVerifiedPagesSnapshot({
    pagesDirectory: input.pagesDirectory,
    manifest: input.manifest,
    fetchImplementation: async (url) => {
      if (url === input.stableUrl) return response(url, input.stableBytes);
      if (url === input.archiveUrl) return response(url, input.archiveBytes);
      const bytes = url === publicOrigin
        ? Buffer.from("mutated product page")
        : readFileSync(remotePagesFile(input.productPagesDirectory, url));
      return response(url, bytes);
    },
    attempts: 1,
    wait: async () => {},
  }), /did not converge/);
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

test("downloads every current platform in an expanding Pages snapshot", async () => {
  const input = createExpandingPublicReleaseCandidateFixture();
  const pagesDirectory = mkdtempSync(path.join(tmpdir(), "fitfreed-expanding-pages-"));
  const fetchImplementation = async (url) => {
    const bytes = readFileSync(remotePagesFile(input.pagesDirectory, url));
    return response(url, bytes);
  };

  const result = await downloadVerifiedPagesSnapshot({
    attempts: 1,
    fetchImplementation,
    manifest: input.manifest,
    pagesDirectory,
    wait: async () => {},
  });

  assert.deepEqual(result, { attempts: 1, fileCount: 12 });
  assert.ok(existsSync(path.join(
    pagesDirectory,
    "updates",
    input.manifest.release.version,
    input.linuxPackageName,
  )));
  assert.ok(existsSync(path.join(
    pagesDirectory,
    "updates",
    input.manifest.release.version,
    input.macosUpdaterName,
  )));
  assert.ok(existsSync(path.join(
    pagesDirectory,
    "updates",
    "0.1.0",
    "FitFreed_0.1.0_amd64.deb",
  )));
});

test("downloads every current and recovery platform in a complete Pages snapshot", async () => {
  const input = createCompletePlatformReleaseCandidateFixture();
  const pagesDirectory = mkdtempSync(path.join(tmpdir(), "fitfreed-complete-pages-"));
  const result = await downloadVerifiedPagesSnapshot({
    attempts: 1,
    fetchImplementation: async (url) => response(
      url,
      readFileSync(remotePagesFile(input.pagesDirectory, url)),
    ),
    manifest: input.manifest,
    pagesDirectory,
    wait: async () => {},
  });

  assert.deepEqual(result, { attempts: 1, fileCount: 14 });
  for (const artifact of [
    `FitFreed_${input.version}_aarch64.app.tar.gz`,
    input.linuxPackageName,
    input.windowsPackageName,
  ]) {
    assert.ok(existsSync(path.join(
      pagesDirectory,
      "updates",
      input.version,
      artifact,
    )));
  }
  assert.ok(existsSync(path.join(
    pagesDirectory,
    "updates",
    "0.2.0",
    "FitFreed_0.2.0_amd64.deb",
  )));
  assert.ok(existsSync(path.join(
    pagesDirectory,
    "updates",
    "0.2.0",
    "FitFreed_0.2.0_x64-setup.exe",
  )));
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
  const fetchImplementation = async (url) => {
    assert.equal(new URL(url).origin, new URL(publicOrigin).origin);
    const bytes = readFileSync(remotePagesFile(input.pagesDirectory, url));
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
    pagesFileCount: 10,
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

test("verifies a complete macOS and Linux distribution through its expansion workflow", async () => {
  const input = createExpandingPublicReleaseCandidateFixture();
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
    isImmutable: true,
    publishedAt: "2026-09-03T08:00:00Z",
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
      return { success: true, output: `${input.revision}\trefs/tags/${tag}` };
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
    if (command === "gh" && args[0] === "release" && args[1] === "view") {
      return { success: true, output: JSON.stringify(release) };
    }
    return { success: true, output: "" };
  };

  const result = await verifyRemotePublicRelease({
    attempts: 1,
    fetchImplementation: async (url) => response(
      url,
      readFileSync(remotePagesFile(input.pagesDirectory, url)),
    ),
    publicReleaseSigningConfiguration: expandingPublicReleaseSigningConfiguration,
    publicUpdateConfiguration: expandingPublicUpdateConfiguration,
    revision: input.revision,
    runCommand,
    version,
    wait: async () => {},
  });

  assert.equal(result.version, version);
  assert.equal(result.pagesFileCount, 12);
  const provenanceCalls = calls.filter(([, first, second]) =>
    first === "attestation" && second === "verify");
  assert.equal(provenanceCalls.length, sourceAssets.length);
  assert.ok(provenanceCalls.every((args) =>
    args[args.indexOf("--signer-workflow") + 1]
      === "purnalica/fitfreed/.github/workflows/public-linux-expansion.yml"));
});

test("verifies a complete three-platform distribution through its Windows workflow", async () => {
  const input = createCompletePlatformReleaseCandidateFixture();
  const harness = remoteReleaseHarness(input, "2026-09-04T08:00:00Z");

  const result = await verifyRemotePublicRelease({
    attempts: 1,
    fetchImplementation: async (url) => response(
      url,
      readFileSync(remotePagesFile(input.pagesDirectory, url)),
    ),
    publicReleaseSigningConfiguration: completePlatformReleaseSigningConfiguration,
    publicUpdateConfiguration: completePlatformUpdateConfiguration,
    revision: input.revision,
    runCommand: harness.runCommand,
    version: input.version,
    wait: async () => {},
  });

  assert.equal(result.version, input.version);
  assert.equal(result.pagesFileCount, 14);
  assert.equal(result.attestedAssetCount, harness.sourceAssets.length);
  const provenanceCalls = harness.calls.filter(([, first, second]) =>
    first === "attestation" && second === "verify");
  assert.equal(provenanceCalls.length, harness.sourceAssets.length);
  assert.ok(provenanceCalls.every((args) =>
    args[args.indexOf("--signer-workflow") + 1]
      === "purnalica/fitfreed/.github/workflows/public-windows-expansion.yml"));
});
