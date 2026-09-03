import assert from "node:assert/strict";
import {
  cpSync,
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

import { composeLinuxExpansionCandidate } from "./expanding-public-release-composition.mjs";
import { publicUpdateEndpoint } from "./public-origin.mjs";
import { stageLinuxExpansionInput } from "./prepare-linux-expansion-input.mjs";
import { createSyntheticLinuxPackageInventory } from "./test-support/linux-public-release-candidate.mjs";
import { createSyntheticMinisignAuthority } from "./test-support/minisign.mjs";

function writeJson(filename, value) {
  writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-expansion-composition-"));
  context.after(() => rmSync(root, { force: true, recursive: true }));
  const version = "0.2.0";
  const revision = "a".repeat(40);
  const sourceDirectory = path.join(root, "source");
  const linuxBuildDirectory = path.join(root, "linux-build");
  const linuxInputDirectory = path.join(root, "linux-input");
  const candidateDirectory = path.join(root, "candidate");
  mkdirSync(sourceDirectory);
  mkdirSync(linuxBuildDirectory);

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

  const updaterAuthority = createSyntheticMinisignAuthority();
  writeFileSync(
    macos.updaterSignaturePath,
    updaterAuthority.signTauri(
      readFileSync(macos.updaterArchivePath),
      path.basename(macos.updaterArchivePath),
    ),
  );
  const packageName = `FitFreed_${version}_amd64.deb`;
  const packagePath = path.join(linuxBuildDirectory, packageName);
  const inventoryPath = `${packagePath}.inventory.json`;
  writeFileSync(packagePath, "unsigned exact Linux package");
  writeJson(
    inventoryPath,
    createSyntheticLinuxPackageInventory(
      packageName,
      readFileSync(packagePath),
      version,
    ),
  );
  stageLinuxExpansionInput({
    generatedAt: "2026-09-03T08:00:00.000Z",
    inventoryPath,
    outputDirectory: linuxInputDirectory,
    packagePath,
    revision,
    storageSchemaVersion: 37,
    version,
  });

  const upgradeMatrixPath = path.join(sourceDirectory, "supported-upgrades.json");
  writeJson(upgradeMatrixPath, {
    format: "org.fitfreed.upgrade-matrix",
    schemaVersion: 2,
    release: { version, librarySchemaVersion: 37 },
    supportedApplicationBaselines: [{
      version: "0.1.0",
      targets: ["darwin-aarch64"],
      librarySchemaVersions: [36, 37],
    }],
    supportedLibrarySchemaVersions: Array.from({ length: 37 }, (_, index) => index + 1),
  });
  const releaseNotesPath = path.join(sourceDirectory, "RELEASE_NOTES.md");
  writeFileSync(releaseNotesPath, "# FitFreed 0.2.0\n\nmacOS and Linux.\n");
  const sbomPath = path.join(sourceDirectory, "npm.cdx.json");
  writeJson(sbomPath, { bomFormat: "CycloneDX" });
  const releaseAuthority = createSyntheticMinisignAuthority();
  const updateConfiguration = {
    format: "org.fitfreed.public-update-configuration",
    schemaVersion: 2,
    status: "active",
    contract: "stable-v3",
    metadataEndpoint: publicUpdateEndpoint,
    keys: [{ id: "stable.synthetic-1", publicKey: updaterAuthority.publicKey }],
  };
  const releaseSigningConfiguration = {
    format: "org.fitfreed.release-signing-configuration",
    schemaVersion: 2,
    status: "active",
    purpose: "public-release-checksums",
    algorithm: "minisign-ed25519",
    keys: [{ id: "release.synthetic-1", publicKey: releaseAuthority.publicKey }],
  };
  return {
    candidateDirectory,
    generatedAt: "2026-09-03T08:00:00.000Z",
    generators: {
      cargoCycloneDx: "0.5.9",
      linuxBuildEvidence: "1",
      linuxPackageInventory: "1",
      npmCycloneDx: "6.0.1",
      tauri: "2.11.4",
    },
    linuxInputDirectory,
    macos,
    macosTrust: {
      certificateSha256: "d".repeat(64),
      teamIdentifier: "A1B2C3D4E5",
    },
    policy: {
      minimumSupportedVersion: "0.1.0",
      releaseNotes: {
        "en-US": "macOS and Linux release.",
        "es-ES": "Versión para macOS y Linux.",
      },
      withdrawnVersions: [],
    },
    releaseKeyId: "release.synthetic-1",
    releaseNotesPath,
    releaseSigningConfiguration,
    revision,
    sbomPaths: [sbomPath],
    signLinuxPackage: (bytes, filename) => updaterAuthority.signTauri(bytes, filename),
    signReleaseChecksums: (bytes) => releaseAuthority.signRelease(bytes),
    signUpdatePayload: (bytes) => updaterAuthority.signTauri(bytes, "stable-payload.json"),
    storageSchemaVersion: 37,
    times: {
      expiresAt: "2026-09-10T08:00:00.000Z",
      issuedAt: "2026-09-03T08:00:00.000Z",
      publishedAt: "2026-09-03T08:00:00.000Z",
    },
    updateConfiguration,
    updateKeyId: "stable.synthetic-1",
    updateSequence: 2,
    upgradeMatrixPath,
    version,
  };
}

test("composes and reopens one complete macOS and Linux candidate", (context) => {
  const input = fixture(context);
  let applicationCopied = false;
  input.copyMacosApplication = (source, destination) => {
    applicationCopied = true;
    cpSync(source, destination, { recursive: true });
  };
  const result = composeLinuxExpansionCandidate(input);

  assert.equal(applicationCopied, true);
  assert.deepEqual(result.targets, ["darwin-aarch64", "linux-x86_64-deb"]);
  assert.equal(result.version, input.version);
  assert.equal(result.revision, input.revision);
  assert.equal(
    JSON.parse(readFileSync(
      path.join(input.candidateDirectory, "release", "release-manifest.json"),
      "utf8",
    )).schemaVersion,
    6,
  );
  assert.deepEqual(
    readdirSync(path.join(input.candidateDirectory, "pages", "updates", input.version)).sort(),
    [
      `FitFreed_${input.version}_aarch64.app.tar.gz`,
      `FitFreed_${input.version}_amd64.deb`,
    ],
  );
});

test("rejects mixed Linux identity and preserves an existing destination", (context) => {
  const mixed = fixture(context);
  mixed.revision = "b".repeat(40);
  assert.throws(
    () => composeLinuxExpansionCandidate(mixed),
    /Linux expansion input revision does not match/,
  );

  const existing = fixture(context);
  mkdirSync(existing.candidateDirectory);
  writeFileSync(path.join(existing.candidateDirectory, "retained"), "retained");
  assert.throws(
    () => composeLinuxExpansionCandidate(existing),
    /already exists/,
  );
  assert.equal(
    readFileSync(path.join(existing.candidateDirectory, "retained"), "utf8"),
    "retained",
  );
});

test("fails closed when either detached signing authority is unavailable", (context) => {
  const updater = fixture(context);
  updater.signLinuxPackage = undefined;
  assert.throws(() => composeLinuxExpansionCandidate(updater), /signing authority/);

  const release = fixture(context);
  release.signReleaseChecksums = undefined;
  assert.throws(() => composeLinuxExpansionCandidate(release), /signing authority/);
});
