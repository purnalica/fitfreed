import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  validateExactMacosPublicCandidate,
  validateMacosCandidateApplication,
  validateMacosCandidateHost,
  validateMacosCandidateLibrary,
  validateRemovedMacosCandidate,
} from "./verify-macos-public-candidate.mjs";

const revision = "a".repeat(40);

function candidate() {
  return {
    manifest: {
      application: {
        bundleIdentifier: "org.fitfreed.desktop",
        executable: "fitfreed",
        storageSchemaVersion: 37,
      },
      artifacts: [
        {
          kind: "macos-application-bundle",
          path: "FitFreed.app",
          sha256: "b".repeat(64),
        },
        {
          kind: "macos-disk-image",
          path: "FitFreed_0.1.7_aarch64.dmg",
          sha256: "c".repeat(64),
        },
      ],
      release: { notarized: true, revision, signed: true, version: "0.1.7" },
      schemaVersion: 3,
      target: {
        architecture: "aarch64",
        minimumSystemVersion: "15.0",
        os: "macos",
      },
      trust: {
        codeSigning: {
          certificateSha256: "d".repeat(64),
          teamIdentifier: "EA6MTPV45T",
        },
      },
    },
    verified: {
      diskImage: "/candidate/release/FitFreed_0.1.7_aarch64.dmg",
      revision,
      version: "0.1.7",
    },
  };
}

test("admits only Apple Silicon hosts inside the supported macOS boundary", () => {
  assert.deepEqual(
    validateMacosCandidateHost({ architecture: "arm64", operatingSystemVersion: "15.0", platform: "darwin" }),
    { architecture: "aarch64", minimumSystemVersion: "15.0", operatingSystem: "macos" },
  );
  assert.deepEqual(
    validateMacosCandidateHost({ architecture: "arm64", operatingSystemVersion: "26.5.2", platform: "darwin" }),
    { architecture: "aarch64", minimumSystemVersion: "15.0", operatingSystem: "macos" },
  );
  for (const input of [
    { architecture: "x64", operatingSystemVersion: "15.0", platform: "darwin" },
    { architecture: "arm64", operatingSystemVersion: "14.7", platform: "darwin" },
    { architecture: "arm64", operatingSystemVersion: "15.0", platform: "linux" },
    { architecture: "arm64", operatingSystemVersion: "invalid", platform: "darwin" },
  ]) {
    assert.throws(() => validateMacosCandidateHost(input), /candidate admission host/);
  }
});

test("binds admission to one exact initial public macOS candidate", () => {
  const candidateDirectory = "/candidate";
  assert.deepEqual(
    validateExactMacosPublicCandidate(candidate(), candidateDirectory, "0.1.7", revision),
    {
      applicationBundle: path.join(candidateDirectory, "release", "FitFreed.app"),
      applicationSha256: "b".repeat(64),
      certificateSha256: "d".repeat(64),
      diskImage: "/candidate/release/FitFreed_0.1.7_aarch64.dmg",
      revision,
      storageSchemaVersion: 37,
      teamIdentifier: "EA6MTPV45T",
      version: "0.1.7",
    },
  );
  for (const mutate of [
    (value) => ({ ...value, manifest: { ...value.manifest, schemaVersion: 6 } }),
    (value) => ({ ...value, manifest: { ...value.manifest, target: { ...value.manifest.target, architecture: "x86_64" } } }),
    (value) => ({ ...value, verified: { ...value.verified, revision: "e".repeat(40) } }),
    (value) => ({ ...value, verified: { ...value.verified, diskImage: "relative.dmg" } }),
    (value) => ({ ...value, manifest: { ...value.manifest, artifacts: value.manifest.artifacts.filter(({ kind }) => kind !== "macos-application-bundle") } }),
  ]) {
    assert.throws(
      () => validateExactMacosPublicCandidate(mutate(candidate()), candidateDirectory, "0.1.7", revision),
      /exact initial public macOS candidate/,
    );
  }
});

test("requires the installed application to preserve the sealed bundle identity", () => {
  const facts = {
    applicationSha256: "b".repeat(64),
    bundleExecutable: "fitfreed",
    bundleIdentifier: "org.fitfreed.desktop",
    bundleVersion: "0.1.7",
    executable: "regular-executable",
  };
  assert.deepEqual(
    validateMacosCandidateApplication(facts, {
      applicationSha256: "b".repeat(64),
      version: "0.1.7",
    }),
    { bundleIdentifier: "org.fitfreed.desktop", version: "0.1.7" },
  );
  for (const mutate of [
    (value) => ({ ...value, applicationSha256: "c".repeat(64) }),
    (value) => ({ ...value, bundleIdentifier: "org.fitfreed.desktop.e2e" }),
    (value) => ({ ...value, bundleVersion: "0.1.6" }),
    (value) => ({ ...value, executable: "symbolic-link" }),
  ]) {
    assert.throws(
      () => validateMacosCandidateApplication(mutate(facts), {
        applicationSha256: "b".repeat(64),
        version: "0.1.7",
      }),
      /installed macOS candidate/,
    );
  }
});

test("requires a private integral library and preserves it after application removal", () => {
  const library = {
    exists: true,
    integrity: "ok",
    links: 1,
    mode: 0o600,
    parentMode: 0o700,
    schemaVersion: 37,
    sha256: "f".repeat(64),
    type: "regular",
  };
  assert.deepEqual(validateMacosCandidateLibrary(library, 37), {
    integrity: "ok",
    schemaVersion: 37,
    sha256: "f".repeat(64),
  });
  for (const mutate of [
    (value) => ({ ...value, integrity: "malformed" }),
    (value) => ({ ...value, links: 2 }),
    (value) => ({ ...value, mode: 0o644 }),
    (value) => ({ ...value, parentMode: 0o755 }),
    (value) => ({ ...value, schemaVersion: 36 }),
    (value) => ({ ...value, type: "symbolic-link" }),
  ]) {
    assert.throws(() => validateMacosCandidateLibrary(mutate(library), 37), /candidate library/);
  }

  assert.deepEqual(validateRemovedMacosCandidate({
    applicationExists: false,
    library: { ...library },
  }, 37, "f".repeat(64)), {
    libraryRetained: true,
    removed: true,
  });
  assert.throws(() => validateRemovedMacosCandidate({
    applicationExists: true,
    library,
  }, 37, "f".repeat(64)), /candidate removal/);
  assert.throws(() => validateRemovedMacosCandidate({
    applicationExists: false,
    library: { ...library, sha256: "0".repeat(64) },
  }, 37, "f".repeat(64)), /candidate removal/);
});
