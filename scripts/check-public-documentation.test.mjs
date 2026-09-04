import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  loadPublicDocumentationBundle,
  validatePublicDocumentationBundle,
} from "./check-public-documentation.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function bundle() {
  return structuredClone(loadPublicDocumentationBundle(repositoryRoot));
}

test("accepts the complete version-matched public documentation set", () => {
  assert.deepEqual(validatePublicDocumentationBundle(bundle()), {
    version: "0.1.0",
    documents: 10,
    locales: ["en-US", "es-ES"],
    catalogGuidanceKeys: 17,
  });
});

test("rejects incomplete Windows contributor and release-operator guidance", () => {
  const candidate = bundle();
  const operationsPath = "docs/development/public-release-operations.md";
  const architecturePath = "docs/development/public-release.md";
  candidate.documents[operationsPath] = candidate.documents[operationsPath]
    .replaceAll("native x86-64 Windows PowerShell", "a Windows host")
    .replaceAll("FITFREED_WINDOWS_AUTHENTICODE_PROFILE", "WINDOWS_SIGNING_PROFILE")
    .replaceAll("complete-platform manifest version 7", "the release manifest")
    .replaceAll("Windows Authenticode certificate rotation", "certificate maintenance")
    .replaceAll(
      "public Windows expansion workflow is not yet implemented",
      "public Windows expansion is available",
    );
  candidate.documents[architecturePath] = candidate.documents[architecturePath]
    .replaceAll("manifest version 7", "the complete manifest")
    .replaceAll("Windows Authenticode authority", "Windows build authority")
    .replaceAll(
      "public Windows expansion workflow is not yet implemented",
      "public Windows expansion is available",
    )
    .replace(
      /never\s+rebuilt as a substitute for the sealed bytes/i,
      "rebuilt when downstream work fails",
    );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /operations does not document native Windows operator boundary/);
      assert.match(error.message, /operations does not document Windows Authenticode authority profile/);
      assert.match(error.message, /operations does not document complete Windows candidate contract/);
      assert.match(error.message, /operations does not document Windows certificate rotation procedure/);
      assert.match(error.message, /operations does not document inactive Windows workflow boundary/);
      assert.match(error.message, /releaseArchitecture does not document complete Windows manifest/);
      assert.match(error.message, /releaseArchitecture does not document separate Windows signing authority/);
      assert.match(error.message, /releaseArchitecture does not document inactive Windows workflow boundary/);
      assert.match(error.message, /releaseArchitecture does not document exact Windows candidate preservation/);
      return true;
    },
  );
});

test("rejects Linux guidance that weakens the exact support and package boundary", () => {
  const candidate = bundle();
  const guidePath = "docs/user/public-linux-0.1.0.md";
  candidate.documents[guidePath] = candidate.documents[guidePath]
    .replace("x86-64 Ubuntu Desktop 24.04 and 26.04 LTS", "Linux desktops")
    .replaceAll("FitFreed_0.1.0_amd64.deb", "FitFreed.AppImage");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /linuxUserGuide does not document supported Linux boundary/);
      assert.match(error.message, /linuxUserGuide does not document exact Debian package/);
      return true;
    },
  );
});

test("rejects Windows guidance that weakens trust, installation, and support boundaries", () => {
  const candidate = bundle();
  const guidePath = "docs/user/public-windows-0.1.0.md";
  candidate.documents[guidePath] = candidate.documents[guidePath]
    .replace("x86-64 editions of Windows 11", "Windows computers")
    .replaceAll("FitFreed_0.1.0_x64-setup.exe", "FitFreed.msi")
    .replace("current-user installation", "system-wide installation")
    .replace("A SmartScreen reputation warning is not a trust result", "Choose Run anyway");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /windowsUserGuide does not document supported Windows boundary/);
      assert.match(error.message, /windowsUserGuide does not document exact NSIS setup/);
      assert.match(error.message, /windowsUserGuide does not document current-user installation/);
      assert.match(error.message, /windowsUserGuide does not document SmartScreen interpretation/);
      return true;
    },
  );
});

test("rejects a support entry point that hides the Windows guide", () => {
  const candidate = bundle();
  candidate.documents["SUPPORT.md"] = candidate.documents["SUPPORT.md"].replace(
    "docs/user/public-windows-0.1.0.md",
    "docs/user/README.md",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    /SUPPORT\.md is missing required public guidance.*public-windows/,
  );
});

test("rejects version drift and an incomplete public operations procedure", () => {
  const candidate = bundle();
  candidate.version = "0.2.0";
  candidate.documents["docs/development/public-release-operations.md"] = candidate.documents[
    "docs/development/public-release-operations.md"
  ].replace("## Exact-candidate evaluation", "## Candidate review");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /missing public documentation: docs\/user\/public-macos-0\.2\.0\.md/);
      assert.match(error.message, /policy version does not match package version/);
      assert.match(error.message, /operations section order/);
      return true;
    },
  );
});

test("rejects missing locale guidance and distribution state in reviewed notes", () => {
  const candidate = bundle();
  delete candidate.catalogs["es-ES"].updates.recovery;
  delete candidate.catalogs["es-ES"].settings.localeSpanish;
  delete candidate.policy.update.releaseNotes["es-ES"];
  candidate.reviewedReleaseNotes = candidate.reviewedReleaseNotes.replace(
    "FitFreed 0.1.0 supports Apple Silicon",
    "This public release supports Apple Silicon",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /policy locales must be exactly: en-US, es-ES/);
      assert.match(error.message, /es-ES catalog is missing public guidance: updates\.recovery\.updated/);
      assert.match(error.message, /es-ES catalog is missing public guidance: settings\.localeSpanish/);
      assert.match(error.message, /generated public-release state/);
      return true;
    },
  );
});

test("rejects guidance that no longer declares the inactive release boundary", () => {
  const candidate = bundle();
  const guidePath = "docs/user/public-macos-0.1.0.md";
  candidate.documents[guidePath] = candidate.documents[guidePath].replace(
    "No public binary is available while",
    "A public binary is available while",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    /userGuide does not document inactive public-release status/,
  );
});

test("rejects public guidance or evaluation that drops implemented MVP journeys", () => {
  const candidate = bundle();
  const guidePath = "docs/user/public-macos-0.1.0.md";
  const evaluationPath = "docs/testing/macos-candidate-manual-evaluation.md";
  candidate.documents[guidePath] = candidate.documents[guidePath]
    .replace("**Show me how**", "**Continue**")
    .replace("user-authored segmentation", "personal views")
    .replace("privacy-reviewed self-contained HTML export", "local output");
  candidate.documents[evaluationPath] = candidate.documents[evaluationPath]
    .replace("Inspect one training session", "Inspect one library item")
    .replace("Find or create one relevant report", "Find or create one relevant note");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /userGuide does not document bundled source acquisition/);
      assert.match(error.message, /userGuide does not document implemented training exploration/);
      assert.match(error.message, /userGuide does not document implemented report export/);
      assert.match(error.message, /manualEvaluation does not document training-depth experience review/);
      assert.match(error.message, /manualEvaluation does not document report experience review/);
      return true;
    },
  );
});

test("rejects a candidate procedure that transfers deterministic verification to the product owner", () => {
  const candidate = bundle();
  const evaluationPath = "docs/testing/macos-candidate-manual-evaluation.md";
  candidate.documents[evaluationPath] = candidate.documents[evaluationPath]
    .replace(
      "not asked to execute a control matrix",
      "asked to execute a control matrix",
    )
    .replace(
      "Functional correctness belongs to automated unit, integration, contract, packaged end-to-end (E2E)",
      "Functional correctness may be checked manually after unit, integration, contract, and packaged E2E",
    );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /manualEvaluation does not document product-owner scope boundary/);
      assert.match(error.message, /manualEvaluation does not document automated functional responsibility/);
      return true;
    },
  );
});
