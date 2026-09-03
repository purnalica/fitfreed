import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { publicUpdateEndpoint, publicUpdateUrl } from "./public-origin.mjs";
import { stageStableUpdateChannel } from "./public-update-staging.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-update-"));
  const packagePath = path.join(root, "FitFreed.app.tar.gz");
  const packageBytes = Buffer.from("synthetic signed updater package");
  writeFileSync(packagePath, packageBytes);
  writeFileSync(`${packagePath}.sig`, "U3ludGhldGljIHBhY2thZ2Ugc2lnbmF0dXJl\n");
  return {
    root,
    packagePath,
    packageBytes,
    outputDirectory: path.join(root, "pages"),
    configuration: {
      format: "org.fitfreed.public-update-configuration",
      schemaVersion: 1,
      status: "active",
      contract: "stable-v2",
      metadataEndpoint: publicUpdateEndpoint,
      keys: [
        {
          id: "stable.synthetic-1",
          publicKey: "U3ludGhldGljIHB1YmxpYyBrZXkgZm9yIGNvbnRyYWN0IHRlc3RzLg==",
        },
      ],
    },
  };
}

function stageArguments(fixtureValues) {
  return {
    ...fixtureValues,
    packages: [
      {
        packagePath: fixtureValues.packagePath,
        packageSignaturePath: `${fixtureValues.packagePath}.sig`,
        target: "darwin-aarch64",
      },
    ],
    signingKeyId: "stable.synthetic-1",
    version: "0.2.0",
    sequence: 2,
    issuedAt: "2026-08-17T10:00:00Z",
    expiresAt: "2026-08-24T10:00:00Z",
    publishedAt: "2026-08-17T09:00:00Z",
    minimumSupportedVersion: "0.1.0",
    minimumReadableSchemaVersion: 1,
    maximumReadableSchemaVersion: 9,
    targetSchemaVersion: 9,
    releaseNotes: {
      "en-US": "Synthetic public update.",
      "es-ES": "Actualización pública sintética.",
    },
    withdrawnVersions: [],
    signPayload(payloadBytes) {
      const payload = JSON.parse(payloadBytes);
      assert.equal(payload.schemaVersion, 2);
      assert.equal(payload.channel, "stable");
      return "U3ludGhldGljIG1ldGFkYXRhIHNpZ25hdHVyZQ==";
    },
  };
}

function relativeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else files.push(path.relative(root, entryPath));
    }
  };
  visit(root);
  return files.sort();
}

test("stages one atomic Pages snapshot with exact stable metadata and package bytes", () => {
  const values = fixture();
  const result = stageStableUpdateChannel(stageArguments(values));

  assert.deepEqual(relativeFiles(values.outputDirectory), [
    "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
    "updates/stable.json",
  ]);
  const envelope = JSON.parse(
    readFileSync(path.join(values.outputDirectory, "updates/stable.json"), "utf8"),
  );
  const payloadBytes = Buffer.from(envelope.fitfreed.payloadBase64, "base64");
  const payload = JSON.parse(payloadBytes);
  const artifact = payload.release.platforms["darwin-aarch64"];
  assert.equal(envelope.fitfreed.schemaVersion, 2);
  assert.equal(envelope.fitfreed.keyId, "stable.synthetic-1");
  assert.equal(payload.sequence, 2);
  assert.equal(payload.release.version, "0.2.0");
  assert.equal(
    artifact.url,
    publicUpdateUrl("0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz"),
  );
  assert.equal(artifact.size, values.packageBytes.length);
  assert.equal(artifact.sha256, createHash("sha256").update(values.packageBytes).digest("hex"));
  assert.deepEqual(
    readFileSync(
      path.join(
        values.outputDirectory,
        "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
      ),
    ),
    values.packageBytes,
  );
  assert.equal(result.payloadSha256, createHash("sha256").update(payloadBytes).digest("hex"));
});

test("stages exact macOS and Debian updater artifacts in one signed snapshot", () => {
  const values = fixture();
  const arguments_ = stageArguments(values);
  const linuxPackagePath = path.join(values.root, "FitFreed.deb");
  writeFileSync(linuxPackagePath, "synthetic Debian package");
  writeFileSync(`${linuxPackagePath}.sig`, "U3ludGhldGljIERlYmlhbiBzaWduYXR1cmU=\n");
  arguments_.packages.push({
    packagePath: linuxPackagePath,
    packageSignaturePath: `${linuxPackagePath}.sig`,
    target: "linux-x86_64-deb",
  });

  const result = stageStableUpdateChannel(arguments_);

  const linuxPackageName = "FitFreed_0.2.0_amd64.deb";
  assert.deepEqual(relativeFiles(values.outputDirectory), [
    "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
    `updates/0.2.0/${linuxPackageName}`,
    "updates/stable.json",
  ]);
  const envelope = JSON.parse(
    readFileSync(path.join(values.outputDirectory, "updates/stable.json"), "utf8"),
  );
  const payload = JSON.parse(
    Buffer.from(envelope.fitfreed.payloadBase64, "base64"),
  );
  assert.deepEqual(Object.keys(envelope.platforms), [
    "darwin-aarch64",
    "linux-x86_64-deb",
  ]);
  assert.deepEqual(Object.keys(payload.release.platforms), [
    "darwin-aarch64",
    "linux-x86_64-deb",
  ]);
  assert.equal(
    payload.release.platforms["linux-x86_64-deb"].url,
    publicUpdateUrl(`0.2.0/${linuxPackageName}`),
  );
  assert.deepEqual(result.targets, ["darwin-aarch64", "linux-x86_64-deb"]);
});

test("stages the complete macOS, Linux, and Windows updater set", () => {
  const values = fixture();
  const arguments_ = stageArguments(values);
  arguments_.configuration = {
    ...values.configuration,
    schemaVersion: 2,
    contract: "stable-v3",
  };
  const linuxPackagePath = path.join(values.root, "FitFreed.deb");
  const windowsPackagePath = path.join(values.root, "FitFreed-setup.exe");
  writeFileSync(linuxPackagePath, "synthetic Debian package");
  writeFileSync(`${linuxPackagePath}.sig`, "U3ludGhldGljIERlYmlhbiBzaWduYXR1cmU=\n");
  writeFileSync(windowsPackagePath, "synthetic NSIS package");
  writeFileSync(`${windowsPackagePath}.sig`, "U3ludGhldGljIE5TSVMgc2lnbmF0dXJl\n");
  arguments_.packages.push(
    {
      packagePath: linuxPackagePath,
      packageSignaturePath: `${linuxPackagePath}.sig`,
      target: "linux-x86_64-deb",
    },
    {
      packagePath: windowsPackagePath,
      packageSignaturePath: `${windowsPackagePath}.sig`,
      target: "windows-x86_64-nsis",
    },
  );
  arguments_.recoveryPackages = [];
  arguments_.expectedRecoveryArtifacts = [];
  arguments_.signPayload = () => "U3ludGhldGljIG1ldGFkYXRhIHNpZ25hdHVyZQ==";

  const result = stageStableUpdateChannel(arguments_);

  const windowsPackageName = "FitFreed_0.2.0_x64-setup.exe";
  assert.deepEqual(relativeFiles(values.outputDirectory), [
    "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
    "updates/0.2.0/FitFreed_0.2.0_amd64.deb",
    `updates/0.2.0/${windowsPackageName}`,
    "updates/stable.json",
  ]);
  const envelope = JSON.parse(
    readFileSync(path.join(values.outputDirectory, "updates/stable.json"), "utf8"),
  );
  const payload = JSON.parse(Buffer.from(envelope.fitfreed.payloadBase64, "base64"));
  assert.equal(
    payload.release.platforms["windows-x86_64-nsis"].url,
    publicUpdateUrl(`0.2.0/${windowsPackageName}`),
  );
  assert.deepEqual(result.targets, [
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]);
});

test("stages authenticated predecessor packages for recoverable stable updates", () => {
  const values = fixture();
  const arguments_ = stageArguments(values);
  arguments_.configuration = {
    ...values.configuration,
    schemaVersion: 2,
    contract: "stable-v3",
  };
  const predecessorPath = path.join(values.root, "FitFreed-predecessor.deb");
  const predecessorBytes = Buffer.from("synthetic predecessor Debian package");
  writeFileSync(predecessorPath, predecessorBytes);
  writeFileSync(`${predecessorPath}.sig`, "U3ludGhldGljIHByZWRlY2Vzc29yIHNpZ25hdHVyZQ==\n");
  const linuxPackagePath = path.join(values.root, "FitFreed-current.deb");
  writeFileSync(linuxPackagePath, "synthetic current Debian package");
  writeFileSync(`${linuxPackagePath}.sig`, "U3ludGhldGljIGN1cnJlbnQgc2lnbmF0dXJl\n");
  arguments_.packages.push({
    packagePath: linuxPackagePath,
    packageSignaturePath: `${linuxPackagePath}.sig`,
    target: "linux-x86_64-deb",
  });
  arguments_.recoveryPackages = [{
    version: "0.1.0",
    target: "linux-x86_64-deb",
    librarySchemaVersions: [7, 8],
    packagePath: predecessorPath,
    packageSignaturePath: `${predecessorPath}.sig`,
  }];
  arguments_.expectedRecoveryArtifacts = [{
    version: "0.1.0",
    target: "linux-x86_64-deb",
    librarySchemaVersions: [7, 8],
  }];
  arguments_.signPayload = (payloadBytes) => {
    assert.equal(JSON.parse(payloadBytes).schemaVersion, 3);
    return "U3ludGhldGljIG1ldGFkYXRhIHNpZ25hdHVyZQ==";
  };

  const result = stageStableUpdateChannel(arguments_);
  const envelope = JSON.parse(
    readFileSync(path.join(values.outputDirectory, "updates/stable.json"), "utf8"),
  );
  const payload = JSON.parse(Buffer.from(envelope.fitfreed.payloadBase64, "base64"));

  assert.equal(envelope.fitfreed.schemaVersion, 3);
  assert.deepEqual(payload.release.recoveryArtifacts, [{
    version: "0.1.0",
    target: "linux-x86_64-deb",
    packageKind: "deb",
    librarySchemaVersions: [7, 8],
    url: publicUpdateUrl("0.1.0/FitFreed_0.1.0_amd64.deb"),
    size: predecessorBytes.length,
    sha256: createHash("sha256").update(predecessorBytes).digest("hex"),
    tauriSignature: "U3ludGhldGljIHByZWRlY2Vzc29yIHNpZ25hdHVyZQ==",
  }]);
  assert.deepEqual(relativeFiles(values.outputDirectory), [
    "updates/0.1.0/FitFreed_0.1.0_amd64.deb",
    "updates/0.2.0/FitFreed_0.2.0_aarch64.app.tar.gz",
    "updates/0.2.0/FitFreed_0.2.0_amd64.deb",
    "updates/stable.json",
  ]);
  assert.deepEqual(result.recoveryTargets, ["0.1.0:linux-x86_64-deb"]);

  const missingBaseline = { ...arguments_, expectedRecoveryArtifacts: [] };
  assert.throws(
    () => stageStableUpdateChannel(missingBaseline),
    /does not match the declared application baselines/,
  );
});

test("keeps recovery evidence out of the closed stable version 2 generator", () => {
  const values = fixture();
  const arguments_ = stageArguments(values);
  arguments_.recoveryPackages = [{
    version: "0.1.0",
    target: "linux-x86_64-deb",
    librarySchemaVersions: [1],
    packagePath: values.packagePath,
    packageSignaturePath: `${values.packagePath}.sig`,
  }];
  arguments_.expectedRecoveryArtifacts = [{
    version: "0.1.0",
    target: "linux-x86_64-deb",
    librarySchemaVersions: [1],
  }];

  assert.throws(
    () => stageStableUpdateChannel(arguments_),
    /stable-v2 cannot carry recovery packages/,
  );
});

test("rejects an omitted or unsupported public update target", () => {
  const values = fixture();
  const missing = stageArguments(values);
  delete missing.packages[0].target;
  const unsupported = stageArguments(values);
  unsupported.packages[0].target = "linux-aarch64-deb";
  const duplicate = stageArguments(values);
  duplicate.packages.push({ ...duplicate.packages[0] });
  const linuxWithoutMacos = stageArguments(values);
  linuxWithoutMacos.packages[0].target = "linux-x86_64-deb";
  const windowsWithoutExistingTargets = stageArguments(values);
  windowsWithoutExistingTargets.packages[0].target = "windows-x86_64-nsis";
  const windowsWithoutLinux = stageArguments(values);
  windowsWithoutLinux.configuration = {
    ...values.configuration,
    schemaVersion: 2,
    contract: "stable-v3",
  };
  windowsWithoutLinux.packages.push({
    ...windowsWithoutLinux.packages[0],
    target: "windows-x86_64-nsis",
  });
  windowsWithoutLinux.recoveryPackages = [];
  windowsWithoutLinux.expectedRecoveryArtifacts = [];
  const windowsWithoutRecoveryContract = stageArguments(values);
  windowsWithoutRecoveryContract.packages.push(
    { ...windowsWithoutRecoveryContract.packages[0], target: "linux-x86_64-deb" },
    { ...windowsWithoutRecoveryContract.packages[0], target: "windows-x86_64-nsis" },
  );

  assert.throws(() => stageStableUpdateChannel(missing), /target is unsupported/);
  assert.throws(() => stageStableUpdateChannel(unsupported), /target is unsupported/);
  assert.throws(() => stageStableUpdateChannel(duplicate), /target is duplicated/);
  assert.throws(
    () => stageStableUpdateChannel(linuxWithoutMacos),
    /requires the existing macOS target/,
  );
  assert.throws(
    () => stageStableUpdateChannel(windowsWithoutExistingTargets),
    /requires the existing macOS and Linux targets/,
  );
  assert.throws(
    () => stageStableUpdateChannel(windowsWithoutLinux),
    /requires the existing macOS and Linux targets/,
  );
  assert.throws(
    () => stageStableUpdateChannel(windowsWithoutRecoveryContract),
    /requires stable-v3/,
  );
});

test("preserves the previous Pages snapshot when staging cannot be signed", () => {
  const values = fixture();
  mkdirSync(values.outputDirectory, { recursive: true });
  writeFileSync(path.join(values.outputDirectory, "previous-snapshot"), "preserved\n");
  const arguments_ = stageArguments(values);
  arguments_.signPayload = () => {
    throw new Error("synthetic signing failure");
  };

  assert.throws(() => stageStableUpdateChannel(arguments_), /synthetic signing failure/);
  assert.deepEqual(relativeFiles(values.outputDirectory), ["previous-snapshot"]);
  assert.equal(readFileSync(path.join(values.outputDirectory, "previous-snapshot"), "utf8"), "preserved\n");
});

test("rejects a signing key outside the active public trust set", () => {
  const values = fixture();
  const arguments_ = stageArguments(values);
  arguments_.signingKeyId = "stable.unknown";

  assert.throws(() => stageStableUpdateChannel(arguments_), /active public trust set/);
});
