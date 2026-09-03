import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { composeCompletePlatformCandidate } from "./complete-platform-release-composition.mjs";
import { stageLinuxExpansionInput } from "./prepare-linux-expansion-input.mjs";
import { stageWindowsExpansionInput } from "./prepare-windows-expansion-input.mjs";
import { publicUpdateEndpoint } from "./public-origin.mjs";
import { createLinuxExpansionInputFixture } from "./test-support/linux-expansion-input.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";
import { createWindowsExpansionInputFixture } from "./test-support/windows-expansion-input.mjs";

function writeJson(filename, value) {
  writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-complete-composition-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const version = "0.3.0";
  const revision = "a".repeat(40);
  const generatedAt = "2026-09-04T08:00:00.000Z";
  const storageSchemaVersion = 37;
  const sourceDirectory = path.join(root, "source");
  const inputsDirectory = path.join(root, "inputs");
  const linuxInputDirectory = path.join(inputsDirectory, "linux");
  const windowsInputDirectory = path.join(inputsDirectory, "windows");
  const candidateDirectory = path.join(root, "candidate");
  mkdirSync(sourceDirectory);
  mkdirSync(inputsDirectory);

  const updaterAuthority = createSyntheticMinisignAuthority();
  const releaseAuthority = createSyntheticMinisignAuthority();
  const updateConfiguration = {
    format: "org.fitfreed.public-update-configuration",
    schemaVersion: 2,
    status: "active",
    contract: "stable-v3",
    metadataEndpoint: publicUpdateEndpoint,
    keys: [{ id: "complete.synthetic-1", publicKey: updaterAuthority.publicKey }],
  };
  const releaseSigningConfiguration = {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 2,
    status: "active",
    purpose: "public-release-checksums",
    algorithm: "minisign-ed25519",
    keys: [{ id: "complete-release.synthetic-1", publicKey: releaseAuthority.publicKey }],
  };

  const macos = {
    applicationPath: path.join(sourceDirectory, "FitFreed.app"),
    diskImagePath: path.join(sourceDirectory, `FitFreed_${version}_aarch64.dmg`),
    updaterArchivePath: path.join(sourceDirectory, "FitFreed.app.tar.gz"),
    updaterSignaturePath: path.join(sourceDirectory, "FitFreed.app.tar.gz.sig"),
  };
  mkdirSync(path.join(macos.applicationPath, "Contents"), { recursive: true });
  writeFileSync(path.join(macos.applicationPath, "Contents", "binary"), "signed application");
  writeFileSync(macos.diskImagePath, "signed disk image");
  writeFileSync(macos.updaterArchivePath, "signed macOS updater");
  writeFileSync(
    macos.updaterSignaturePath,
    updaterAuthority.signTauri(
      readFileSync(macos.updaterArchivePath),
      path.basename(macos.updaterArchivePath),
    ),
  );

  const linux = createLinuxExpansionInputFixture({ revision, version });
  context.after(() => rmSync(linux.root, { force: true, recursive: true }));
  stageLinuxExpansionInput({
    generatedAt,
    inventoryPath: linux.inventoryPath,
    outputDirectory: linuxInputDirectory,
    packagePath: linux.packagePath,
    revision,
    storageSchemaVersion,
    version,
  });

  const windowsCertificateSha256 = "c".repeat(64);
  const windows = createWindowsExpansionInputFixture({
    certificateSha256: windowsCertificateSha256,
    revision,
    updateConfiguration,
    version,
  });
  context.after(() => rmSync(windows.root, { force: true, recursive: true }));
  stageWindowsExpansionInput({
    authenticodeCertificateSha256: windowsCertificateSha256,
    generatedAt,
    inventoryPath: windows.inventoryPath,
    outputDirectory: windowsInputDirectory,
    packagePath: windows.packagePath,
    revision,
    storageSchemaVersion,
    updateConfiguration,
    version,
  });

  const predecessorVersion = "0.2.0";
  const recoveryPackages = [
    {
      version: predecessorVersion,
      target: "linux-x86_64-deb",
      librarySchemaVersions: [36, 37],
      name: `FitFreed_${predecessorVersion}_amd64.deb`,
    },
    {
      version: predecessorVersion,
      target: "windows-x86_64-nsis",
      librarySchemaVersions: [36, 37],
      name: `FitFreed_${predecessorVersion}_x64-setup.exe`,
    },
  ].map((recovery) => {
    const packagePath = path.join(sourceDirectory, recovery.name);
    const packageSignaturePath = `${packagePath}.sig`;
    writeFileSync(packagePath, `synthetic predecessor bytes: ${recovery.target}`);
    writeFileSync(
      packageSignaturePath,
      updaterAuthority.signTauri(readFileSync(packagePath), recovery.name),
    );
    return { ...recovery, packagePath, packageSignaturePath };
  });

  const upgradeMatrixPath = path.join(sourceDirectory, "supported-upgrades.json");
  writeJson(upgradeMatrixPath, {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 2,
    release: { version, librarySchemaVersion: storageSchemaVersion },
    supportedApplicationBaselines: [{
      version: predecessorVersion,
      targets: ["darwin-aarch64", "linux-x86_64-deb", "windows-x86_64-nsis"],
      librarySchemaVersions: [36, 37],
    }],
    supportedLibrarySchemaVersions: Array.from(
      { length: storageSchemaVersion },
      (_, index) => index + 1,
    ),
  });
  const releaseNotesPath = path.join(sourceDirectory, "RELEASE_NOTES.md");
  writeFileSync(releaseNotesPath, `# FitFreed ${version}\n\nComplete platform set.\n`);
  const sbomPath = path.join(sourceDirectory, "npm.cdx.json");
  writeJson(sbomPath, { bomFormat: "CycloneDX" });

  return {
    candidateDirectory,
    generatedAt,
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxBuildEvidence: "1",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.11.4",
      windowsBuildEvidence: "1",
      windowsPackageInventory: "1",
    },
    linuxInputDirectory,
    macos,
    macosTrust: {
      certificateSha256: "d".repeat(64),
      teamIdentifier: "A1B2C3D4E5",
    },
    policy: {
      minimumSupportedVersion: predecessorVersion,
      releaseNotes: {
        "en-US": "Complete-platform release.",
        "es-ES": "Complete-platform release.",
      },
      withdrawnVersions: [],
    },
    recoveryPackages: recoveryPackages.map(({ name: _name, ...recovery }) => recovery),
    releaseKeyId: "complete-release.synthetic-1",
    releaseNotesPath,
    releaseSigningConfiguration,
    revision,
    sbomPaths: [sbomPath],
    signLinuxPackage: (bytes, filename) => updaterAuthority.signTauri(bytes, filename),
    signReleaseChecksums: (bytes) => releaseAuthority.signRelease(bytes),
    signUpdatePayload: (bytes) => updaterAuthority.signTauri(bytes, "stable-payload.json"),
    signWindowsPackage: (bytes, filename) => updaterAuthority.signTauri(bytes, filename),
    storageSchemaVersion,
    times: {
      expiresAt: "2026-09-11T08:00:00.000Z",
      issuedAt: generatedAt,
      publishedAt: generatedAt,
    },
    updateConfiguration,
    updateKeyId: "complete.synthetic-1",
    updateSequence: 3,
    upgradeMatrixPath,
    version,
    windowsInputDirectory,
    windowsTrust: { certificateSha256: windowsCertificateSha256 },
  };
}

test("composes and reopens one complete macOS, Linux, and Windows candidate", (context) => {
  const input = fixture(context);

  const result = composeCompletePlatformCandidate(input);

  assert.deepEqual(result.targets, [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]);
  assert.equal(result.version, input.version);
  assert.equal(result.revision, input.revision);
  assert.equal(
    JSON.parse(readFileSync(
      path.join(input.candidateDirectory, "release", "release-manifest.json"),
      "utf8",
    )).schemaVersion,
    7,
  );
  assert.deepEqual(
    readdirSync(path.join(input.candidateDirectory, "pages", "updates", input.version)).sort(),
    [
      `FitFreed_${input.version}_aarch64.app.tar.gz`,
      `FitFreed_${input.version}_amd64.deb`,
      `FitFreed_${input.version}_x64-setup.exe`,
    ],
  );
  assert.deepEqual(
    readdirSync(path.join(input.candidateDirectory, "pages", "updates", "0.2.0")).sort(),
    ["FitFreed_0.2.0_amd64.deb", "FitFreed_0.2.0_x64-setup.exe"],
  );
});

test("signs the exact Authenticode-admitted setup bytes for updates", (context) => {
  const input = fixture(context);
  const expectedPackagePath = path.join(
    input.windowsInputDirectory,
    `FitFreed_${input.version}_x64-setup.exe`,
  );
  const expectedBytes = readFileSync(expectedPackagePath);
  const fixtureAuthority = createSyntheticMinisignAuthority();
  let signedName;
  input.signWindowsPackage = (bytes, filename) => {
    assert.deepEqual(bytes, expectedBytes);
    signedName = filename;
    return fixtureAuthority.signTauri(bytes, filename);
  };
  input.updateConfiguration.keys[0].publicKey = fixtureAuthority.publicKey;
  input.signLinuxPackage = (bytes, filename) => fixtureAuthority.signTauri(bytes, filename);
  input.signUpdatePayload = (bytes) => fixtureAuthority.signTauri(bytes, "stable-payload.json");
  writeFileSync(
    input.macos.updaterSignaturePath,
    fixtureAuthority.signTauri(
      readFileSync(input.macos.updaterArchivePath),
      path.basename(input.macos.updaterArchivePath),
    ),
  );
  for (const recovery of input.recoveryPackages) {
    writeFileSync(
      recovery.packageSignaturePath,
      fixtureAuthority.signTauri(
        readFileSync(recovery.packagePath),
        path.basename(recovery.packagePath),
      ),
    );
  }

  composeCompletePlatformCandidate(input);

  assert.equal(signedName, `FitFreed_${input.version}_x64-setup.exe`);
});

test("rejects mixed Windows identity and preserves an existing destination", (context) => {
  const mixed = fixture(context);
  mixed.windowsTrust.certificateSha256 = "e".repeat(64);
  assert.throws(
    () => composeCompletePlatformCandidate(mixed),
    /Windows expansion inventory Authenticode trust does not match|Windows expansion.*trust/,
  );
  assert.equal(
    readdirSync(path.dirname(mixed.candidateDirectory))
      .some((name) => name.startsWith("candidate.tmp-")),
    false,
  );

  const existing = fixture(context);
  mkdirSync(existing.candidateDirectory);
  writeFileSync(path.join(existing.candidateDirectory, "retained"), "retained");
  assert.throws(
    () => composeCompletePlatformCandidate(existing),
    /already exists/,
  );
  assert.equal(
    readFileSync(path.join(existing.candidateDirectory, "retained"), "utf8"),
    "retained",
  );
});

test("fails closed when the Windows input or any detached signer is unavailable", (context) => {
  const missingInput = fixture(context);
  rmSync(missingInput.windowsInputDirectory, { force: true, recursive: true });
  assert.throws(() => composeCompletePlatformCandidate(missingInput), /ENOENT|Windows expansion/);

  for (const signer of [
    "signLinuxPackage",
    "signWindowsPackage",
    "signUpdatePayload",
    "signReleaseChecksums",
  ]) {
    const missingSigner = fixture(context);
    missingSigner[signer] = undefined;
    assert.throws(
      () => composeCompletePlatformCandidate(missingSigner),
      /signing authority/,
    );
    assert.equal(existsSync(missingSigner.candidateDirectory), false);
  }
});

test("removes the private candidate after updater-signature verification fails", (context) => {
  const input = fixture(context);
  input.signWindowsPackage = () => Buffer.from("invalid updater signature").toString("base64");

  assert.throws(
    () => composeCompletePlatformCandidate(input),
    /signature|Minisign/,
  );
  assert.equal(existsSync(input.candidateDirectory), false);
  assert.equal(
    readdirSync(path.dirname(input.candidateDirectory))
      .some((name) => name.startsWith("candidate.tmp-")),
    false,
  );
});
