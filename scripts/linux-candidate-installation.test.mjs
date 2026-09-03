import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCandidateCommandOutput,
  parseLinuxOsRelease,
  validateExactLinuxCandidate,
  validateInstalledLinuxCandidate,
  validateLinuxCandidateAdmissionHost,
  validateRemovedLinuxCandidate,
  validateRetainedLinuxCandidateLibrary,
} from "./verify-linux-candidate-installation.mjs";

const osRelease = (version) => [
  "NAME=Ubuntu",
  "ID=ubuntu",
  `VERSION_ID=\"${version}\"`,
  "",
].join("\n");

test("normalizes captured output and accepts inherited command output", () => {
  assert.equal(normalizeCandidateCommandOutput("  installed\n"), "installed");
  assert.equal(normalizeCandidateCommandOutput(null), "");
  assert.throws(() => normalizeCandidateCommandOutput(Buffer.from("unexpected")), /command output/);
});

test("admits only the declared x86-64 Ubuntu candidate host", () => {
  assert.deepEqual(parseLinuxOsRelease(osRelease("26.04")), {
    ID: "ubuntu",
    NAME: "Ubuntu",
    VERSION_ID: "26.04",
  });
  assert.deepEqual(validateLinuxCandidateAdmissionHost({
    architecture: "x64",
    expectedUbuntuVersion: "24.04",
    osRelease: osRelease("24.04"),
    platform: "linux",
  }), {
    architecture: "amd64",
    distribution: "ubuntu",
    version: "24.04",
  });
  for (const input of [
    { architecture: "arm64", expectedUbuntuVersion: "24.04", osRelease: osRelease("24.04"), platform: "linux" },
    { architecture: "x64", expectedUbuntuVersion: "26.04", osRelease: osRelease("24.04"), platform: "linux" },
    { architecture: "x64", expectedUbuntuVersion: "25.10", osRelease: osRelease("25.10"), platform: "linux" },
    { architecture: "x64", expectedUbuntuVersion: "24.04", osRelease: osRelease("24.04"), platform: "darwin" },
  ]) {
    assert.throws(() => validateLinuxCandidateAdmissionHost(input), /candidate admission host/);
  }
});

test("requires one verified expanding candidate with its exact Debian artifact", () => {
  const candidate = {
    manifest: {
      release: {
        revision: "a".repeat(40),
        version: "0.2.0",
      },
      schemaVersion: 6,
      application: { storageSchemaVersion: 37 },
    },
    verified: {
      debianPackage: "/candidate/release/FitFreed_0.2.0_amd64.deb",
      revision: "a".repeat(40),
      storageSchemaVersion: 37,
      targets: ["darwin-aarch64", "linux-x86_64-deb"],
      version: "0.2.0",
    },
  };
  assert.deepEqual(
    validateExactLinuxCandidate(candidate, "0.2.0", "a".repeat(40)),
    candidate.verified,
  );
  for (const mutate of [
    (value) => ({ ...value, manifest: { ...value.manifest, schemaVersion: 5 } }),
    (value) => ({ ...value, verified: { ...value.verified, debianPackage: undefined } }),
    (value) => ({ ...value, verified: { ...value.verified, revision: "b".repeat(40) } }),
    (value) => ({ ...value, verified: { ...value.verified, storageSchemaVersion: 36 } }),
    (value) => ({ ...value, verified: { ...value.verified, targets: ["linux-x86_64-deb"] } }),
  ]) {
    assert.throws(
      () => validateExactLinuxCandidate(mutate(candidate), "0.2.0", "a".repeat(40)),
      /exact expanding Linux candidate/,
    );
  }
});

test("requires the exact installed Debian identity and native files", () => {
  const facts = {
    architecture: "amd64",
    desktopEntry: "regular",
    dynamicLibrariesMissing: [],
    executable: "regular-executable",
    icons: ["regular", "regular"],
    license: "regular",
    maintainer: "FitFreed contributors",
    packageName: "fitfreed",
    status: "install ok installed",
    version: "0.2.0",
  };
  assert.deepEqual(validateInstalledLinuxCandidate(facts, "0.2.0"), {
    architecture: "amd64",
    packageName: "fitfreed",
    version: "0.2.0",
  });
  for (const mutate of [
    (value) => ({ ...value, version: "0.1.0" }),
    (value) => ({ ...value, packageName: "fit-freed" }),
    (value) => ({ ...value, executable: "symbolic-link" }),
    (value) => ({ ...value, icons: ["regular", "symbolic-link"] }),
    (value) => ({ ...value, dynamicLibrariesMissing: ["libwebkit.so"] }),
  ]) {
    assert.throws(
      () => validateInstalledLinuxCandidate(mutate(facts), "0.2.0"),
      /installed Linux candidate/,
    );
  }
});

test("requires one private, integral library before and after package removal", () => {
  const library = {
    exists: true,
    integrity: "ok",
    links: 1,
    parentMode: 0o700,
    schemaVersion: 37,
    type: "regular",
    mode: 0o600,
  };
  assert.deepEqual(validateRetainedLinuxCandidateLibrary(library, 37), {
    integrity: "ok",
    retained: true,
    schemaVersion: 37,
  });
  for (const mutate of [
    (value) => ({ ...value, integrity: "malformed" }),
    (value) => ({ ...value, links: 2 }),
    (value) => ({ ...value, mode: 0o644 }),
    (value) => ({ ...value, type: "symbolic-link" }),
  ]) {
    assert.throws(
      () => validateRetainedLinuxCandidateLibrary(mutate(library), 37),
      /candidate library/,
    );
  }
  assert.throws(
    () => validateRetainedLinuxCandidateLibrary({ ...library, schemaVersion: 36 }, 37),
    /candidate library/,
  );

  assert.deepEqual(validateRemovedLinuxCandidate({
    desktopEntryExists: false,
    executableExists: false,
    iconsExist: [false, false],
    licenseExists: false,
    packageInstalled: false,
  }), { removed: true });
  assert.throws(() => validateRemovedLinuxCandidate({
    desktopEntryExists: false,
    executableExists: true,
    iconsExist: [false, false],
    licenseExists: false,
    packageInstalled: false,
  }), /Linux candidate removal/);
  assert.throws(() => validateRemovedLinuxCandidate({
    desktopEntryExists: false,
    executableExists: false,
    iconsExist: [false, true],
    licenseExists: false,
    packageInstalled: false,
  }), /Linux candidate removal/);
});
