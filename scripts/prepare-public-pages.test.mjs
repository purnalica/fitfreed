import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { publicReleaseAssets } from "./public-release-publication.mjs";
import {
  prepareCurrentPublicPages,
  stageReleaseUpdateSnapshot,
} from "./public-release-remote.mjs";
import { productPagesDeploymentDecision } from "./prepare-public-pages.mjs";
import { sha256File } from "./release-evidence.mjs";
import { createPublicReleaseCandidateFixture } from "./test-support/public-release-candidate.mjs";

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

test("composes current product sources from the authenticated immutable Release without reading Pages", async () => {
  const input = createPublicReleaseCandidateFixture();
  const harness = publicReleaseHarness(input);
  const pagesDirectory = path.join(input.root, "prepared-product-pages");
  const result = await prepareCurrentPublicPages({
    pagesDirectory,
    runCommand: harness.runCommand,
    fetchImplementation: async () => {
      throw new Error("mutable Pages must not supply the authoritative update snapshot");
    },
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

test("sources a recovery package only from its exact immutable predecessor Release", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-release-pages-recovery-"));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const releaseDirectory = path.join(root, "release");
  mkdirSync(releaseDirectory);
  const currentName = "FitFreed_0.1.12_aarch64.app.tar.gz";
  const recoveryName = "FitFreed_0.1.7_aarch64.app.tar.gz";
  const currentBytes = Buffer.from("current package");
  const recoveryBytes = Buffer.from("recovery package");
  const recovery = {
    target: "darwin-aarch64",
    version: "0.1.7",
    url: `https://fitfreed.org/updates/0.1.7/${recoveryName}`,
    size: recoveryBytes.length,
    sha256: sha256(recoveryBytes),
    tauriSignature: "synthetic recovery signature",
  };
  const stableBytes = Buffer.from(JSON.stringify({
    fitfreed: {
      payloadBase64: Buffer.from(JSON.stringify({
        release: { recoveryArtifacts: [recovery] },
      })).toString("base64"),
    },
  }));
  writeFileSync(path.join(releaseDirectory, currentName), currentBytes);
  writeFileSync(path.join(releaseDirectory, "stable.json"), stableBytes);
  const sourceRecovery = path.join(root, recoveryName);
  writeFileSync(sourceRecovery, recoveryBytes);
  const manifest = {
    release: { version: "0.1.12" },
    artifacts: [
      {
        kind: "stable-update-envelope",
        path: "stable.json",
        size: stableBytes.length,
        sha256: sha256(stableBytes),
      },
      {
        kind: "macos-updater-archive",
        path: currentName,
        size: currentBytes.length,
        sha256: sha256(currentBytes),
      },
    ],
  };
  const runCommand = (command, args) => {
    assert.equal(command, "gh");
    if (args[0] === "release" && args[1] === "view") {
      return { success: true, output: JSON.stringify({
        tagName: "v0.1.7",
        isDraft: false,
        isPrerelease: false,
        isImmutable: true,
        assets: [{
          name: recoveryName,
          size: recoveryBytes.length,
          digest: `sha256:${sha256(recoveryBytes)}`,
          state: "uploaded",
        }],
      }) };
    }
    if (args[0] === "release" && args[1] === "download") {
      copyFileSync(sourceRecovery, path.join(args[args.indexOf("--dir") + 1], recoveryName));
      return { success: true, output: "" };
    }
    throw new Error("unexpected immutable Release operation");
  };

  const updateDirectory = stageReleaseUpdateSnapshot({
    manifest,
    releaseDirectory,
    runCommand,
    temporaryRoot: root,
  });
  assert.deepEqual(
    readFileSync(path.join(updateDirectory, "0.1.7", recoveryName)),
    recoveryBytes,
  );
});

test("deploys product pages only from a revision whose version is already public", () => {
  assert.deepEqual(
    productPagesDeploymentDecision({
      publicVersion: "0.1.12",
      sourceVersion: "0.1.12",
    }),
    { deploy: true, reason: "source-version-is-public" },
  );
  assert.deepEqual(
    productPagesDeploymentDecision({
      publicVersion: "0.1.12",
      sourceVersion: "0.1.13",
    }),
    { deploy: false, reason: "source-version-is-unreleased" },
  );
});

test("rejects invalid product or public release versions before deployment", () => {
  assert.throws(
    () => productPagesDeploymentDecision({
      publicVersion: "0.1.12",
      sourceVersion: "next",
    }),
    /source version/u,
  );
  assert.throws(
    () => productPagesDeploymentDecision({
      publicVersion: "public",
      sourceVersion: "0.1.12",
    }),
    /public version/u,
  );
});
