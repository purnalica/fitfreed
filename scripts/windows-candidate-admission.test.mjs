import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  validateExactWindowsCandidate,
  validateWindowsCandidateAdmissionHost,
  validateWindowsCandidateAdmissionPolicy,
} from "./verify-windows-candidate-admission.mjs";

const issuedAt = "2026-09-04T08:00:00.000Z";

function policy() {
  return {
    format: "org.fitfreed.windows-candidate-admission-policy",
    schemaVersion: 1,
    reviewedAt: "2026-09-04",
    sources: [
      "https://learn.microsoft.com/en-us/windows/release-health/supported-versions-windows-client",
    ],
    releases: [
      {
        displayVersion: "24H2",
        build: 26100,
        supportEndsOn: "2026-10-13",
        editionIds: ["Core", "Professional"],
      },
      {
        displayVersion: "24H2",
        build: 26100,
        supportEndsOn: "2027-10-12",
        editionIds: ["Education", "Enterprise"],
      },
      {
        displayVersion: "25H2",
        build: 26200,
        supportEndsOn: "2027-10-12",
        editionIds: ["Core", "Professional"],
      },
    ],
  };
}

function host() {
  return {
    schemaVersion: 1,
    processorArchitecture: "AMD64",
    installationType: "Client",
    productType: 1,
    displayVersion: "24H2",
    currentBuildNumber: 26100,
    updateBuildRevision: 6584,
    editionId: "Professional",
    signToolPath: "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe",
  };
}

test("accepts one fresh, official, byte-ordered Windows 11 admission policy", () => {
  assert.deepEqual(validateWindowsCandidateAdmissionPolicy(policy(), issuedAt), policy());

  for (const [mutate, expected] of [
    [(value) => { value.schemaVersion = 2; }, /policy/],
    [(value) => { value.reviewedAt = "2026-02-31"; }, /reviewed/],
    [(value) => { value.reviewedAt = "2026-07-01"; }, /reviewed/],
    [(value) => { value.sources[0] = "https://example.com/windows"; }, /source/],
    [(value) => { value.sources.push(value.sources[0]); }, /source/],
    [(value) => { value.releases.reverse(); }, /ordered/],
    [(value) => { value.releases[0].editionIds.reverse(); }, /edition/],
    [(value) => { value.releases[1].supportEndsOn = "2026-08-01"; }, /support/],
    [(value) => { value.unexpected = true; }, /fields/],
  ]) {
    const invalid = policy();
    mutate(invalid);
    assert.throws(
      () => validateWindowsCandidateAdmissionPolicy(invalid, issuedAt),
      expected,
    );
  }
});

test("the repository policy satisfies its schema and semantic admission rules", () => {
  const repositoryPolicy = JSON.parse(readFileSync(
    new URL("../release/windows-candidate-admission.json", import.meta.url),
    "utf8",
  ));
  assert.equal(
    validateWindowsCandidateAdmissionPolicy(repositoryPolicy, issuedAt),
    repositoryPolicy,
  );
});

test("documents and indexes the Windows candidate admission contract", () => {
  const index = readFileSync(new URL("../docs/data-formats/README.md", import.meta.url), "utf8");
  const documentation = readFileSync(
    new URL("../docs/data-formats/release/windows-candidate-admission-policy-v1.md", import.meta.url),
    "utf8",
  );
  assert.match(index, /windows-candidate-admission-policy-v1\.md/);
  assert.match(documentation, /windows-candidate-admission-policy-v1\.schema\.json/);
  assert.match(documentation, /release\/windows-candidate-admission\.json/);
  assert.match(documentation, /more than 45 days/);
});

test("admits only an exact supported x86-64 Windows 11 client host", () => {
  assert.deepEqual(
    validateWindowsCandidateAdmissionHost({
      architecture: "x64",
      facts: host(),
      issuedAt,
      platform: "win32",
      policy: policy(),
    }),
    {
      architecture: "x86_64",
      build: "26100.6584",
      displayVersion: "24H2",
      editionId: "Professional",
      platform: "windows-11",
      policyReviewedAt: "2026-09-04",
      supportEndsOn: "2026-10-13",
    },
  );

  for (const [mutate, expected] of [
    [(input) => { input.platform = "linux"; }, /Windows 11/],
    [(input) => { input.architecture = "arm64"; }, /Windows 11/],
    [(input) => { input.facts.installationType = "Server"; }, /Windows 11/],
    [(input) => { input.facts.productType = 3; }, /Windows 11/],
    [(input) => { input.facts.processorArchitecture = "ARM64"; }, /Windows 11/],
    [(input) => { input.facts.currentBuildNumber = 22621; }, /supported release/],
    [(input) => { input.facts.editionId = "ServerStandard"; }, /supported release/],
    [(input) => { input.facts.updateBuildRevision = -1; }, /Windows 11/],
    [(input) => { input.facts.computerName = "private-host"; }, /fields/],
  ]) {
    const input = {
      architecture: "x64",
      facts: host(),
      issuedAt,
      platform: "win32",
      policy: policy(),
    };
    mutate(input);
    assert.throws(() => validateWindowsCandidateAdmissionHost(input), expected);
  }
});

test("requires the exact three-platform candidate and its public Windows package", () => {
  const candidate = {
    manifest: {
      application: { storageSchemaVersion: 37 },
      release: { revision: "a".repeat(40), version: "0.3.0" },
      schemaVersion: 7,
    },
    verified: {
      revision: "a".repeat(40),
      storageSchemaVersion: 37,
      targets: ["darwin-aarch64", "linux-x86_64-deb", "windows-x86_64-nsis"],
      version: "0.3.0",
      windowsCertificateSha256: "c".repeat(64),
      windowsPackage: "C:\\candidate\\release\\FitFreed_0.3.0_x64-setup.exe",
    },
  };
  assert.deepEqual(
    validateExactWindowsCandidate(candidate, "0.3.0", "a".repeat(40), "c".repeat(64)),
    candidate.verified,
  );

  for (const mutate of [
    (value) => { value.manifest.schemaVersion = 6; },
    (value) => { value.verified.targets = ["windows-x86_64-nsis"]; },
    (value) => { value.verified.windowsCertificateSha256 = "d".repeat(64); },
    (value) => { value.verified.windowsPackage = "FitFreed_0.3.0_x64-setup.exe"; },
    (value) => { value.verified.storageSchemaVersion = 36; },
  ]) {
    const invalid = structuredClone(candidate);
    mutate(invalid);
    assert.throws(
      () => validateExactWindowsCandidate(
        invalid,
        "0.3.0",
        "a".repeat(40),
        "c".repeat(64),
      ),
      /exact complete-platform candidate/,
    );
  }
});
