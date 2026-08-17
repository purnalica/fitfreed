import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createPublicReleaseManifest } from "./public-release-evidence.mjs";
import {
  assertGithubReleaseImmutability,
  publicReleaseAssets,
  publishVerifiedRelease,
  validateGithubRelease,
  validateImmutableReleaseSetting,
} from "./public-release-publication.mjs";
import { inspectArtifact, sha256File } from "./release-evidence.mjs";

function fixture() {
  const releaseDirectory = mkdtempSync(path.join(tmpdir(), "fitfreed-publication-"));
  mkdirSync(path.join(releaseDirectory, "FitFreed.app", "Contents"), { recursive: true });
  writeFileSync(path.join(releaseDirectory, "FitFreed.app", "Contents", "synthetic"), "app");
  const sources = {
    "FitFreed_0.1.0_aarch64.dmg": "disk image",
    "FitFreed_0.1.0_aarch64.app.tar.gz": "updater",
    "FitFreed_0.1.0_aarch64.app.tar.gz.sig": "signature",
    "stable.json": "stable envelope",
    "npm.cdx.json": "software inventory",
    "supported-upgrades.json": "upgrade matrix",
    "RELEASE_NOTES.md": "# FitFreed 0.1.0\n",
  };
  for (const [filename, content] of Object.entries(sources)) {
    writeFileSync(path.join(releaseDirectory, filename), content);
  }
  const artifacts = [
    inspectArtifact(releaseDirectory, "FitFreed.app", "macos-application-bundle"),
    inspectArtifact(releaseDirectory, "FitFreed_0.1.0_aarch64.dmg", "macos-disk-image"),
    inspectArtifact(
      releaseDirectory,
      "FitFreed_0.1.0_aarch64.app.tar.gz",
      "macos-updater-archive",
    ),
    inspectArtifact(
      releaseDirectory,
      "FitFreed_0.1.0_aarch64.app.tar.gz.sig",
      "updater-signature",
    ),
    inspectArtifact(releaseDirectory, "stable.json", "stable-update-envelope"),
    inspectArtifact(releaseDirectory, "npm.cdx.json", "cyclonedx-sbom"),
    inspectArtifact(releaseDirectory, "supported-upgrades.json", "upgrade-matrix"),
    inspectArtifact(releaseDirectory, "RELEASE_NOTES.md", "release-notes"),
  ];
  const revision = "a".repeat(40);
  const manifest = createPublicReleaseManifest({
    version: "0.1.0",
    revision,
    generatedAt: "2026-08-17T22:00:00.000Z",
    storageSchemaVersion: 1,
    certificateSha256: "b".repeat(64),
    teamIdentifier: "A1B2C3D4E5",
    updateKeyId: "stable.synthetic-1",
    updateSequence: 1,
    generators: { cargoCycloneDx: "0.5.9", npmCycloneDx: "6.0.1", tauri: "2.8.5" },
    artifacts,
  });
  writeFileSync(
    path.join(releaseDirectory, "release-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(path.join(releaseDirectory, "SHA256SUMS"), "synthetic checksum evidence\n");
  const assets = publicReleaseAssets(releaseDirectory, manifest);
  return { assets, manifest, releaseDirectory, revision };
}

function releaseRecord(input, draft) {
  return {
    tagName: "v0.1.0",
    name: "FitFreed 0.1.0",
    body: "# FitFreed 0.1.0\n",
    isDraft: draft,
    isPrerelease: false,
    isImmutable: !draft,
    publishedAt: draft ? null : "2026-08-17T22:10:00Z",
    assets: input.assets.map((asset) => ({
      name: asset.name,
      size: statSync(asset.path).size,
      digest: `sha256:${sha256File(asset.path)}`,
      state: "uploaded",
    })),
  };
}

function publicationRunner(input, initialRelease) {
  let release = initialRelease;
  const calls = [];
  return {
    calls,
    run(command, args, options = {}) {
      calls.push([command, ...args]);
      if (command === "git" && args[0] === "ls-remote") {
        return {
          success: true,
          output: `${input.revision}\trefs/tags/v0.1.0`,
        };
      }
      if (args[0] === "release" && args[1] === "view") {
        if (!release && options.allowFailure) return { success: false, output: "" };
        return { success: true, output: JSON.stringify(release) };
      }
      if (args[0] === "release" && args[1] === "create") {
        assert.equal(args.includes("--clobber"), false);
        release = releaseRecord(input, true);
      }
      if (args[0] === "release" && args[1] === "edit") release = releaseRecord(input, false);
      return { success: true, output: "" };
    },
  };
}

test("requires repository release immutability before protected work", () => {
  assert.deepEqual(validateImmutableReleaseSetting({
    enabled: true,
    enforced_by_owner: false,
  }), {
    enabled: true,
    enforcedByOwner: false,
  });
  assert.throws(
    () => validateImmutableReleaseSetting({ enabled: false }),
    /immutability is not enabled/,
  );
  assert.deepEqual(assertGithubReleaseImmutability(() => ({
    success: true,
    output: JSON.stringify({ enabled: true, enforced_by_owner: true }),
  })), {
    enabled: true,
    enforcedByOwner: true,
  });
});

test("creates a closed draft, verifies provenance, then publishes an immutable release", () => {
  const input = fixture();
  const runner = publicationRunner(input);
  const result = publishVerifiedRelease({
    releaseDirectory: input.releaseDirectory,
    manifest: input.manifest,
    verified: { version: "0.1.0", revision: input.revision },
    runCommand: runner.run,
  });

  assert.deepEqual(result, {
    tag: "v0.1.0",
    immutable: true,
    assetCount: input.assets.length,
    alreadyPublished: false,
    revision: input.revision,
  });
  assert.equal(runner.calls.filter(([, first, second]) =>
    first === "attestation" && second === "verify").length, input.assets.length);
  assert.equal(runner.calls.filter(([, first, second]) =>
    first === "release" && second === "verify-asset").length, input.assets.length);
  assert.equal(runner.calls.filter(([, first, second]) =>
    first === "release" && second === "create").length, 1);
  assert.equal(runner.calls.filter(([, first, second]) =>
    first === "release" && second === "edit").length, 1);
  assert.ok(runner.calls.filter(([, first, second]) =>
    first === "attestation" && second === "verify").every((args) => {
    const sourceRef = args.indexOf("--source-ref");
    return args[sourceRef + 1] === "refs/tags/v0.1.0";
  }));
});

test("reuses only an exact immutable publication and rejects draft or public drift", () => {
  const input = fixture();
  const publishedRunner = publicationRunner(input, releaseRecord(input, false));
  assert.equal(publishVerifiedRelease({
    releaseDirectory: input.releaseDirectory,
    manifest: input.manifest,
    verified: { version: "0.1.0", revision: input.revision },
    runCommand: publishedRunner.run,
  }).alreadyPublished, true);
  assert.equal(publishedRunner.calls.some(([, first, second]) =>
    first === "release" && ["create", "edit"].includes(second)), false);

  for (const [mutate, expected] of [
    [(record) => { record.assets[0].digest = `sha256:${"c".repeat(64)}`; }, /digest mismatch/],
    [(record) => { record.assets.push({ name: "unexpected", size: 1 }); }, /asset count|unexpected/],
    [(record) => { record.isImmutable = false; }, /not immutable/],
  ]) {
    const record = releaseRecord(input, false);
    mutate(record);
    assert.throws(() => validateGithubRelease(record, {
      version: "0.1.0",
      notes: "# FitFreed 0.1.0\n",
      assets: input.assets,
      draft: false,
    }), expected);
  }
});
