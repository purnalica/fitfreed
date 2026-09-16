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
  const candidate = bundle();
  assert.deepEqual(validatePublicDocumentationBundle(candidate), {
    version: candidate.version,
    documents: 12,
    locales: ["en-US", "es-ES"],
    catalogGuidanceKeys: 36,
  });
});

test("rejects readiness copy that loses the public macOS and Linux availability decision", () => {
  const candidate = bundle();
  const readinessPath = "docs/testing/public-release-readiness.md";
  candidate.documents[readinessPath] = candidate.documents[readinessPath].replace(
    "supported public release for Apple Silicon on macOS 15.0 or later and x86-64 Ubuntu Desktop",
    "accepted product baseline for desktop systems",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    /readiness does not document supported public macOS and Linux decision/,
  );
});

test("rejects incomplete Windows contributor and release-operator guidance", () => {
  const candidate = bundle();
  const operationsPath = "docs/development/public-release-operations.md";
  const architecturePath = "docs/development/public-release.md";
  candidate.documents[operationsPath] = candidate.documents[operationsPath]
    .replaceAll("GitHub-hosted `windows-2025`", "an unspecified Windows host")
    .replace(
      /needs no additional protected environment,[\s\S]*?without protected values\./i,
      "requires an Authenticode environment and protected values.",
    )
    .replaceAll("public-unsigned-preview", "windows-preview")
    .replaceAll("complete-platform manifest version 8", "the release manifest")
    .replace("HARICA activation requires a later ADR", "HARICA activation is automatic")
    .replace(
      "Retired SignPath commands are historical compatibility code",
      "SignPath commands remain an active release route",
    );
  candidate.documents[architecturePath] = candidate.documents[architecturePath]
    .replaceAll("manifest version 8", "the complete manifest")
    .replaceAll("no additional signing authority", "a Windows signing authority")
    .replace(/does not claim exact[\s\S]*?compatibility\./i, "claims exact Windows 11 compatibility.")
    .replace(
      /never\s+rebuilt as a substitute for the sealed bytes/i,
      "rebuilt when downstream work fails",
    );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /operations does not document hosted Windows preview boundary/);
      assert.match(error.message, /operations does not document authority-free Windows builder/);
      assert.match(error.message, /operations does not document explicit Windows preview trust/);
      assert.match(error.message, /operations does not document complete Windows preview candidate contract/);
      assert.match(error.message, /operations does not document deferred Windows signing authority/);
      assert.match(error.message, /operations does not document retired SignPath boundary/);
      assert.match(error.message, /releaseArchitecture does not document complete Windows preview manifest/);
      assert.match(error.message, /releaseArchitecture does not document authority-free Windows preview/);
      assert.match(error.message, /releaseArchitecture does not document hosted Windows limitation/);
      assert.match(error.message, /releaseArchitecture does not document exact Windows candidate preservation/);
      return true;
    },
  );
});

test("rejects an incomplete code signing policy", () => {
  const candidate = bundle();
  candidate.documents["CODE_SIGNING.md"] = candidate.documents["CODE_SIGNING.md"]
    .replace("Every production signing request required manual approval", "Release signing could be automatic")
    .replace("the installed `uninstall.exe`", "no installed uninstaller")
    .replace("no more than once every 24 hours", "periodically");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /CODE_SIGNING\.md is missing required public guidance.*manual approval/);
      assert.match(error.message, /CODE_SIGNING\.md is missing required public guidance.*uninstall/);
      assert.match(error.message, /CODE_SIGNING\.md is missing required public guidance.*24 hours/);
      return true;
    },
  );
});

test("rejects Linux guidance that weakens the exact support and package boundary", () => {
  const candidate = bundle();
  const guidePath = `docs/user/public-linux-${candidate.version}.md`;
  candidate.documents[guidePath] = candidate.documents[guidePath]
    .replace("x86-64 Ubuntu Desktop 24.04 and 26.04 LTS", "Linux desktops")
    .replaceAll(`FitFreed_${candidate.version}_amd64.deb`, "FitFreed.AppImage");

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
  const guidePath = `docs/user/public-windows-${candidate.version}.md`;
  candidate.documents[guidePath] = candidate.documents[guidePath]
    .replace("x86-64 editions of Windows 11", "Windows computers")
    .replace("GitHub-hosted `windows-2025`", "an unspecified Windows host")
    .replaceAll(`FitFreed_${candidate.version}_x64-setup.exe`, "FitFreed.msi")
    .replace('"NotSigned"', '"Valid"')
    .replace("unknown publisher", "verified publisher")
    .replace("Do not disable system-wide protections", "Disable system-wide protections")
    .replace("current-user installation", "system-wide installation")
    .replace("A SmartScreen reputation warning is not a trust result", "Choose Run anyway");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /windowsUserGuide does not document supported Windows boundary/);
      assert.match(error.message, /windowsUserGuide does not document hosted admission limitation/);
      assert.match(error.message, /windowsUserGuide does not document exact NSIS setup/);
      assert.match(error.message, /windowsUserGuide does not document declared absent Authenticode identity/);
      assert.match(error.message, /windowsUserGuide does not document unknown-publisher warning/);
      assert.match(error.message, /windowsUserGuide does not document native-protection boundary/);
      assert.match(error.message, /windowsUserGuide does not document current-user installation/);
      assert.match(error.message, /windowsUserGuide does not document SmartScreen interpretation/);
      return true;
    },
  );
});

test("rejects a support entry point that hides the Windows guide", () => {
  const candidate = bundle();
  candidate.documents["SUPPORT.md"] = candidate.documents["SUPPORT.md"].replace(
    `docs/user/public-windows-${candidate.version}.md`,
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
  delete candidate.catalogs["es-ES"].settings.windowsHelp.update.recovery;
  delete candidate.policy.update.releaseNotes["es-ES"];
  candidate.reviewedReleaseNotes = candidate.reviewedReleaseNotes.replace(
    `FitFreed ${candidate.version} supports Apple Silicon`,
    "This public release supports Apple Silicon",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /policy locales must be exactly: en-US, es-ES/);
      assert.match(error.message, /es-ES catalog is missing public guidance: updates\.recovery\.updated/);
      assert.match(error.message, /es-ES catalog is missing public guidance: settings\.localeSpanish/);
      assert.match(
        error.message,
        /es-ES catalog is missing public guidance: settings\.windowsHelp\.update\.recovery/,
      );
      assert.match(error.message, /generated public-release state/);
      return true;
    },
  );
});

test("rejects a macOS guide that loses its conditional operative boundary", () => {
  const candidate = bundle();
  const guidePath = `docs/user/public-macos-${candidate.version}.md`;
  candidate.documents[guidePath] = candidate.documents[guidePath].replace(
    "operative version-matched macOS guide",
    "general guide",
  );

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    /userGuide does not document supported public macOS release status/,
  );
});

test("rejects public guidance or evaluation that drops implemented MVP journeys", () => {
  const candidate = bundle();
  const guidePath = `docs/user/public-macos-${candidate.version}.md`;
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
  const windowsEvaluationPath = "docs/testing/windows-candidate-manual-evaluation.md";
  candidate.documents[evaluationPath] = candidate.documents[evaluationPath]
    .replace(
      "not asked to execute a control matrix",
      "asked to execute a control matrix",
    )
    .replace(
      "Functional correctness belongs to automated unit, integration, contract, packaged end-to-end (E2E)",
      "Functional correctness may be checked manually after unit, integration, contract, and packaged E2E",
    );
  candidate.documents[windowsEvaluationPath] = candidate.documents[windowsEvaluationPath]
    .replace("product owner is not a manual QA operator", "product owner is the manual QA operator")
    .replace("exact sealed complete-platform candidate", "similar complete-platform candidate")
    .replace("GitHub-hosted `windows-2025`", "an unspecified Windows host")
    .replace("does not require a second product-owner evaluation", "requires repeated manual evaluation");

  assert.throws(
    () => validatePublicDocumentationBundle(candidate),
    (error) => {
      assert.match(error.message, /manualEvaluation does not document product-owner scope boundary/);
      assert.match(error.message, /manualEvaluation does not document automated functional responsibility/);
      assert.match(error.message, /windowsManualEvaluation does not document product-owner scope boundary/);
      assert.match(error.message, /windowsManualEvaluation does not document exact candidate boundary/);
      assert.match(error.message, /windowsManualEvaluation does not document hosted native boundary/);
      assert.match(error.message, /windowsManualEvaluation does not document unchanged product-experience boundary/);
      return true;
    },
  );
});
