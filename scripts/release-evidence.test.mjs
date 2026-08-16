import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  createReleaseManifest,
  inspectArtifact,
  normalizeCargoSbom,
  promoteStagedDirectory,
  renderChecksumFile,
  validateCycloneDxSbom,
  validateReleaseManifest,
} from "./release-evidence.mjs";

function licensedComponent(name, version = "1.0.0") {
  return {
    type: "library",
    name,
    version,
    "bom-ref": `pkg:generic/${name}@${version}`,
    licenses: [{ license: { id: "MIT" } }],
  };
}

test("normalizes local Cargo references without breaking dependency edges", () => {
  const localReference = "path+file:///private/example/project/src-tauri#fitfreed@0.1.0";
  const sbom = {
    metadata: {
      component: {
        ...licensedComponent("fitfreed", "0.1.0"),
        "bom-ref": localReference,
        purl: "pkg:cargo/fitfreed@0.1.0?download_url=file://.",
        components: [
          {
            type: "application",
            name: "fitfreed",
            version: "0.1.0",
            "bom-ref": `${localReference} bin-target-0`,
            purl: "pkg:cargo/fitfreed@0.1.0?download_url=file://.#src/main.rs",
          },
        ],
      },
    },
    dependencies: [
      {
        ref: localReference,
        dependsOn: [`${localReference} bin-target-0`, "pkg:cargo/serde@1.0.0"],
      },
    ],
  };

  normalizeCargoSbom(sbom);

  assert.equal(sbom.metadata.component["bom-ref"], "pkg:cargo/fitfreed@0.1.0");
  assert.equal(sbom.metadata.component.purl, "pkg:cargo/fitfreed@0.1.0");
  assert.equal(sbom.dependencies[0].ref, "pkg:cargo/fitfreed@0.1.0");
  assert.equal(
    sbom.dependencies[0].dependsOn[0],
    "pkg:cargo/fitfreed@0.1.0#target-0-fitfreed",
  );
  assert.deepEqual(
    sbom.metadata.component.components[0].licenses,
    sbom.metadata.component.licenses,
  );
  assert.doesNotMatch(JSON.stringify(sbom), /file:\/\//);
});

test("rejects incomplete, development-contaminated, or machine-local SBOMs", () => {
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    metadata: { component: licensedComponent("fitfreed", "0.1.0") },
    components: [
      licensedComponent("react"),
      { ...licensedComponent("api"), group: "@tauri-apps" },
      { ...licensedComponent("webdriverio"), description: "/private/example/project" },
      { name: "unlicensed", version: "1.0.0" },
    ],
  };

  assert.throws(
    () =>
      validateCycloneDxSbom(sbom, {
        expectedRoot: "fitfreed",
        requiredComponents: ["react", "@tauri-apps/api", "react-dom"],
        excludedComponents: ["webdriverio"],
        forbiddenText: ["/private/example/project"],
      }),
    (error) => {
      assert.match(error.message, /missing production component react-dom/);
      assert.match(error.message, /excluded development component webdriverio/);
      assert.match(error.message, /unlicensed@1\.0\.0 has no declared license/);
      assert.match(error.message, /forbidden local text/);
      return true;
    },
  );
});

test("creates deterministic file and application-tree evidence", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-evidence-"));
  context.after(() => rmSync(root, { recursive: true }));
  mkdirSync(path.join(root, "FitFreed.app", "Contents"), { recursive: true });
  writeFileSync(path.join(root, "artifact.txt"), "release artifact\n");
  writeFileSync(path.join(root, "FitFreed.app", "Contents", "binary"), "binary");
  symlinkSync("binary", path.join(root, "FitFreed.app", "Contents", "current"));

  const file = inspectArtifact(root, "artifact.txt", "evidence");
  const application = inspectArtifact(root, "FitFreed.app", "macos-application-bundle");

  assert.equal(file.size, 17);
  assert.match(file.sha256, /^[0-9a-f]{64}$/);
  assert.equal(application.size, 6);
  assert.match(application.sha256, /^[0-9a-f]{64}$/);
  assert.equal(
    renderChecksumFile(root, ["artifact.txt"]),
    `${file.sha256}  artifact.txt\n`,
  );
});

test("builds and validates the documented private release manifest", () => {
  const manifest = createReleaseManifest({
    version: "0.1.0",
    revision: "a".repeat(40),
    generatedAt: "2026-08-16T16:00:00.000Z",
    architecture: "aarch64",
    storageSchemaVersion: 3,
    generators: { cargoCycloneDx: "0.5.9", npmCycloneDx: "6.0.1", tauri: "2.8.5" },
    artifacts: [
      { path: "FitFreed.app", kind: "macos-application-bundle", size: 6, sha256: "b".repeat(64) },
      { path: "FitFreed.dmg", kind: "macos-disk-image", size: 8, sha256: "c".repeat(64) },
      { path: "npm.cdx.json", kind: "cyclonedx-sbom", size: 10, sha256: "d".repeat(64) },
    ],
  });

  assert.equal(validateReleaseManifest(manifest), manifest);
  assert.equal(manifest.release.channel, "private-development");
  assert.equal(manifest.release.signed, false);
  assert.equal(manifest.application.storageSchemaVersion, 3);

  const schema = JSON.parse(
    readFileSync(new URL("../schemas/release-manifest-v1.schema.json", import.meta.url), "utf8"),
  );
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  assert.equal(ajv.validate(schema, manifest), true, JSON.stringify(ajv.errors));

  manifest.artifacts[0].path = "/tmp/FitFreed.app";
  assert.throws(() => validateReleaseManifest(manifest), /invalid artifact path/);
  assert.equal(ajv.validate(schema, manifest), false);
});

test("rejects manifest extensions not defined by the selected schema version", () => {
  const manifest = createReleaseManifest({
    version: "0.1.0",
    revision: "a".repeat(40),
    generatedAt: "2026-08-16T16:00:00.000Z",
    architecture: "aarch64",
    storageSchemaVersion: 3,
    generators: { cargoCycloneDx: "0.5.9", npmCycloneDx: "6.0.1", tauri: "2.8.5" },
    artifacts: [
      { path: "FitFreed.app", kind: "macos-application-bundle", size: 6, sha256: "b".repeat(64) },
      { path: "FitFreed.dmg", kind: "macos-disk-image", size: 8, sha256: "c".repeat(64) },
      { path: "npm.cdx.json", kind: "cyclonedx-sbom", size: 10, sha256: "d".repeat(64) },
    ],
  });
  manifest.release.unreviewedField = true;

  assert.throws(
    () => validateReleaseManifest(manifest),
    /manifest schema violation at \/release: must NOT have additional properties/,
  );
});

test("promotes complete staging while replacing only generated prior evidence", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-release-promotion-"));
  context.after(() => rmSync(root, { recursive: true }));
  const staging = path.join(root, "staging");
  const final = path.join(root, "0.1.0");
  mkdirSync(staging);
  mkdirSync(final);
  writeFileSync(path.join(staging, "release-manifest.json"), "new\n");
  writeFileSync(path.join(final, "release-manifest.json"), "previous\n");

  promoteStagedDirectory(staging, final, "test");

  assert.equal(readFileSync(path.join(final, "release-manifest.json"), "utf8"), "new\n");
  assert.equal(existsSync(staging), false);
  assert.equal(existsSync(`${final}.previous-test`), false);
});
