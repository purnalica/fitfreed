import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertCompletePlatformCertificateSha256,
  assertCompletePlatformPublicReleaseOutput,
  prepareCompletePlatformRelease,
} from "./prepare-complete-platform-release.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";

function fixture(context) {
  const repositoryPath = mkdtempSync(path.join(tmpdir(), "fitfreed-complete-preparation-"));
  context.after(() => rmSync(repositoryPath, { force: true, recursive: true }));
  const version = "0.3.0";
  const outputDirectory = path.join(
    repositoryPath,
    ".artifacts",
    "public-releases",
    version,
  );
  const linuxInputDirectory = path.join(repositoryPath, "linux-input");
  const windowsInputDirectory = path.join(repositoryPath, "windows-input");
  const predecessorEvidenceDirectory = path.join(repositoryPath, "predecessors");
  mkdirSync(linuxInputDirectory);
  mkdirSync(windowsInputDirectory);
  mkdirSync(predecessorEvidenceDirectory);
  mkdirSync(path.join(repositoryPath, "release", "notes"), { recursive: true });
  writeFileSync(
    path.join(repositoryPath, "release", "notes", `${version}.md`),
    "reviewed notes",
  );

  const updateAuthority = createSyntheticMinisignAuthority();
  const releaseAuthority = createSyntheticMinisignAuthority();
  const updateConfiguration = {
    format: "org.fitfreed.public-update-configuration",
    schemaVersion: 2,
    status: "active",
    contract: "stable-v3",
    metadataEndpoint: "https://fitfreed.org/updates/stable.json",
    keys: [{ id: "update.synthetic-1", publicKey: updateAuthority.publicKey }],
  };
  const releaseSigningConfiguration = {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 2,
    status: "active",
    purpose: "public-release-checksums",
    algorithm: "minisign-ed25519",
    keys: [{ id: "release.synthetic-1", publicKey: releaseAuthority.publicKey }],
  };
  const upgradeMatrix = {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 2,
    release: { version, librarySchemaVersion: 37 },
    supportedApplicationBaselines: [{
      version: "0.2.0",
      targets: ["darwin-aarch64", "linux-x86_64-deb"],
      librarySchemaVersions: [36, 37],
    }],
    supportedLibrarySchemaVersions: Array.from({ length: 37 }, (_, index) => index + 1),
  };
  return {
    input: {
      environment: {},
      issuedAt: "2026-09-04T08:00:00.000Z",
      linuxInputDirectory,
      outputDirectory,
      predecessorEvidenceDirectory,
      releaseKeyId: "release.synthetic-1",
      repositoryPath,
      runtime: { arch: "arm64", platform: "darwin" },
      updateKeyId: "update.synthetic-1",
      version,
      windowsCertificateSha256: "c".repeat(64),
      windowsInputDirectory,
    },
    outputDirectory,
    releaseSigningConfiguration,
    repositoryPath,
    updateConfiguration,
    upgradeMatrix,
  };
}

function operations(candidate, events) {
  const revision = "a".repeat(40);
  return {
    assertCleanRevision() {
      events.push("source");
      return { revision, sourceDateEpoch: 1_786_003_200 };
    },
    assertSigningEnvironment() {
      events.push("signing-environment");
      return {
        expectedTeamIdentifier: "A1B2C3D4E5",
        releaseKeyPath: "/protected/release.key",
        updaterKeyPath: "/protected/updater.key",
      };
    },
    buildMacosCandidate(version) {
      events.push("build-macos");
      return {
        applicationPath: `/build/${version}/FitFreed.app`,
        diskImagePath: `/build/${version}/FitFreed_${version}_aarch64.dmg`,
        updaterArchivePath: `/build/${version}/FitFreed.app.tar.gz`,
        updaterSignaturePath: `/build/${version}/FitFreed.app.tar.gz.sig`,
      };
    },
    composeCompletePlatformCandidate(input) {
      events.push("compose");
      assert.equal(input.windowsTrust.certificateSha256, "c".repeat(64));
      assert.equal(input.recoveryPackages.length, 1);
      assert.equal(input.recoveryPackages[0].target, "linux-x86_64-deb");
      assert.equal(typeof input.signLinuxPackage, "function");
      assert.equal(typeof input.signWindowsPackage, "function");
      assert.equal(typeof input.signUpdatePayload, "function");
      assert.equal(typeof input.signReleaseChecksums, "function");
      mkdirSync(input.candidateDirectory, { recursive: true });
      return { revision, targets: ["darwin-aarch64", "linux-x86_64-deb", "windows-x86_64-nsis"] };
    },
    copyUpgradeMatrix(evidenceDirectory) {
      events.push("upgrade-copy");
      writeFileSync(
        path.join(evidenceDirectory, "supported-upgrades.json"),
        `${JSON.stringify(candidate.upgradeMatrix)}\n`,
      );
      return "supported-upgrades.json";
    },
    createCargoSboms(evidenceDirectory) {
      events.push("cargo-sboms");
      writeFileSync(path.join(evidenceDirectory, "cargo.cdx.json"), "{}\n");
      return ["cargo.cdx.json"];
    },
    createNpmSbom(evidenceDirectory) {
      events.push("npm-sbom");
      writeFileSync(path.join(evidenceDirectory, "npm.cdx.json"), "{}\n");
      return "npm.cdx.json";
    },
    discoverRecoveryPackages({ evidenceDirectory }) {
      events.push("recovery");
      assert.equal(evidenceDirectory, candidate.input.predecessorEvidenceDirectory);
      return {
        recoveryPackages: [{
          librarySchemaVersions: [36, 37],
          packagePath: "/predecessor/FitFreed_0.2.0_amd64.deb",
          packageSignaturePath: "/predecessor/FitFreed_0.2.0_amd64.deb.sig",
          target: "linux-x86_64-deb",
          version: "0.2.0",
        }],
      };
    },
    generatedAt() {
      return "2026-09-04T08:00:00.000Z";
    },
    generatorVersions() {
      return { tauri: "2.11.4" };
    },
    inspectMacosTrust() {
      events.push("macos-trust");
      return { certificateSha256: "d".repeat(64), teamIdentifier: "A1B2C3D4E5" };
    },
    inspectReleaseContracts() {
      events.push("contracts");
      return { releaseNotesSource: `release/notes/${candidate.input.version}.md` };
    },
    inspectUpgradeMatrix() {
      events.push("matrix");
      return candidate.upgradeMatrix;
    },
    loadReleasePolicy() {
      events.push("policy");
      return {
        update: {
          minimumSupportedVersion: "0.2.0",
          releaseNotes: { "en-US": "Release.", "es-ES": "Release." },
          sequence: 3,
          withdrawnVersions: [],
        },
      };
    },
    loadReleaseSigningConfiguration() {
      events.push("release-trust");
      return candidate.releaseSigningConfiguration;
    },
    loadUpdateConfiguration() {
      events.push("update-trust");
      return candidate.updateConfiguration;
    },
    publicChannelTimes() {
      return {
        expiresAt: "2026-09-11T08:00:00.000Z",
        issuedAt: "2026-09-04T08:00:00.000Z",
        publishedAt: "2026-09-04T08:00:00.000Z",
      };
    },
    readStorageSchemaVersion() {
      return 37;
    },
    renderReleaseNotes(_, notes) {
      assert.equal(notes, "reviewed notes");
      return "generated complete-platform notes\n";
    },
    runDependencyAudit() {
      events.push("audit");
    },
    scanStagedEvidence(directory) {
      events.push("scan");
      assert.equal(directory, candidate.outputDirectory);
    },
    verifyLinuxInput() {
      events.push("verify-linux");
    },
    verifyWindowsInput({ authenticodeCertificateSha256 }) {
      events.push("verify-windows");
      assert.equal(authenticodeCertificateSha256, "c".repeat(64));
    },
  };
}

test("confines a complete-platform candidate to its exact version directory", (context) => {
  const candidate = fixture(context);
  const outputRoot = path.join(candidate.repositoryPath, ".artifacts", "public-releases");

  assert.equal(
    assertCompletePlatformPublicReleaseOutput(
      candidate.outputDirectory,
      outputRoot,
      candidate.input.version,
    ),
    candidate.outputDirectory,
  );
  assert.throws(
    () => assertCompletePlatformPublicReleaseOutput(
      path.join(outputRoot, "another-version"),
      outputRoot,
      candidate.input.version,
    ),
    /exact version directory/,
  );
});

test("requires one canonical lowercase Windows certificate fingerprint", () => {
  assert.equal(
    assertCompletePlatformCertificateSha256("a".repeat(64)),
    "a".repeat(64),
  );
  for (const candidate of ["a".repeat(63), "A".repeat(64), "g".repeat(64), undefined]) {
    assert.throws(
      () => assertCompletePlatformCertificateSha256(candidate),
      /Windows certificate SHA-256 fingerprint/,
    );
  }
});

test("authenticates both native inputs and predecessor bytes before composition", (context) => {
  const candidate = fixture(context);
  const events = [];

  const result = prepareCompletePlatformRelease(candidate.input, operations(candidate, events));

  assert.equal(result.revision, "a".repeat(40));
  assert.deepEqual(events, [
    "contracts",
    "matrix",
    "policy",
    "update-trust",
    "release-trust",
    "signing-environment",
    "source",
    "verify-linux",
    "verify-windows",
    "recovery",
    "audit",
    "build-macos",
    "macos-trust",
    "npm-sbom",
    "cargo-sboms",
    "upgrade-copy",
    "compose",
    "scan",
  ]);
  assert.equal(existsSync(candidate.outputDirectory), true);
  assert.equal(
    existsSync(path.join(candidate.repositoryPath, ".artifacts", "complete-release-evidence")),
    false,
  );
});

test("removes owned output after post-composition admission failure", (context) => {
  const candidate = fixture(context);
  const events = [];
  const adapters = operations(candidate, events);
  adapters.scanStagedEvidence = () => {
    throw new Error("synthetic evidence failure");
  };

  assert.throws(
    () => prepareCompletePlatformRelease(candidate.input, adapters),
    /synthetic evidence failure/,
  );
  assert.equal(existsSync(candidate.outputDirectory), false);
});

test("preserves a destination that appears before atomic composition", (context) => {
  const candidate = fixture(context);
  const events = [];
  const adapters = operations(candidate, events);
  adapters.composeCompletePlatformCandidate = ({ candidateDirectory }) => {
    mkdirSync(candidateDirectory, { recursive: true });
    writeFileSync(path.join(candidateDirectory, "retained"), "not owned by preparation");
    throw new Error("complete-platform public candidate already exists");
  };

  assert.throws(
    () => prepareCompletePlatformRelease(candidate.input, adapters),
    /already exists/,
  );
  assert.equal(
    existsSync(path.join(candidate.outputDirectory, "retained")),
    true,
  );
});

test("rejects unsupported hosts before inspecting release inputs", (context) => {
  const candidate = fixture(context);
  const events = [];
  candidate.input.runtime = { arch: "x64", platform: "win32" };

  assert.throws(
    () => prepareCompletePlatformRelease(candidate.input, operations(candidate, events)),
    /requires Apple Silicon macOS/,
  );
  assert.deepEqual(events, []);
});

test("exposes and documents the complete-platform preparation and reopening commands", () => {
  const packageJson = JSON.parse(readFileSync(
    new URL("../package.json", import.meta.url),
    "utf8",
  ));
  assert.equal(
    packageJson.scripts["prepare:complete-platform-release"],
    "node scripts/prepare-complete-platform-release.mjs",
  );
  assert.equal(
    packageJson.scripts["verify:complete-platform-release"],
    "node scripts/verify-complete-platform-release.mjs",
  );

  const guide = readFileSync(
    new URL("../docs/development/public-release.md", import.meta.url),
    "utf8",
  );
  for (const required of [
    "prepare:complete-platform-release",
    "predecessor evidence",
    "manifest version 7",
    "does not publish",
  ]) assert.match(guide, new RegExp(required));
});
