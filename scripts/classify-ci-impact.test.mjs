import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyCiImpact,
  fingerprintExecutableEntries,
  resolveCiVerification,
} from "./classify-ci-impact.mjs";

test("reuses packaged evidence for an explicit documentation-only change", () => {
  assert.deepEqual(
    classifyCiImpact({
      eventName: "push",
      comparisonAvailable: true,
      changedPaths: [
        "AGENTS.md",
        "GOVERNANCE.md",
        "README.md",
        "SUPPORT.md",
        "docs/architecture/storage.md",
        ".github/ISSUE_TEMPLATE/bug_report.yml",
        ".github/PULL_REQUEST_TEMPLATE.md",
      ],
    }),
    {
      fullVerification: false,
      productSurfaceVerification: true,
      automationVerification: false,
      reason: "documentation-only",
      changedPathCount: 7,
    },
  );
});

test("requires full verification when any executable or release input changes", () => {
  for (const changedPath of [
    "package.json",
    "schemas/release-manifest-v2.schema.json",
    "src/App.tsx",
    "src-tauri/src/lib.rs",
    "site/app.js",
    ".github/workflows/ci.yml",
    ".github/workflows/repository-safety.yml",
    "scripts/classify-ci-impact.mjs",
    "scripts/classify-ci-impact.test.mjs",
    "docs/art/proposed-logo.svg",
  ]) {
    assert.deepEqual(
      classifyCiImpact({
        eventName: "push",
        comparisonAvailable: true,
        changedPaths: ["docs/README.md", changedPath],
      }),
      {
        fullVerification: true,
        productSurfaceVerification: false,
        automationVerification: false,
        reason: "release-affecting-change",
        changedPathCount: 2,
      },
      changedPath,
    );
  }
});

test("fails closed when comparison evidence is missing or empty", () => {
  assert.equal(
    classifyCiImpact({
      eventName: "push",
      comparisonAvailable: false,
      changedPaths: ["docs/README.md"],
    }).reason,
    "comparison-unavailable",
  );
  assert.equal(
    classifyCiImpact({
      eventName: "push",
      comparisonAvailable: true,
      changedPaths: [],
    }).reason,
    "empty-change-set",
  );
});

test("always performs an explicitly requested hosted verification", () => {
  assert.deepEqual(
    classifyCiImpact({
      eventName: "workflow_dispatch",
      comparisonAvailable: true,
      changedPaths: ["docs/README.md"],
    }),
    {
      fullVerification: true,
      productSurfaceVerification: false,
      automationVerification: false,
      reason: "explicit-verification",
      changedPathCount: 1,
    },
  );
});

test("verifies product surfaces without rebuilding unchanged executable inputs", () => {
  assert.deepEqual(
    classifyCiImpact({
      eventName: "push",
      comparisonAvailable: true,
      changedPaths: [
        "README.md",
        "docs/product-status.json",
        "site/index.html",
        "site/styles.css",
        "site/locales/config.json",
        "site/locales/es-ES.json",
        "scripts/check-product-page.mjs",
        "scripts/pages-artifact.mjs",
        "scripts/pages-artifact.test.mjs",
        "scripts/pages-publication.mjs",
        "scripts/pages-publication.test.mjs",
        "scripts/pages-workflow.mjs",
        "scripts/pages-workflow.test.mjs",
        "scripts/product-page-localization.mjs",
        "scripts/product-page-localization.test.mjs",
        "scripts/render-product-surfaces.mjs",
        "scripts/render-product-surfaces.test.mjs",
        ".github/workflows/pages.yml",
      ],
    }),
    {
      fullVerification: false,
      productSurfaceVerification: true,
      automationVerification: false,
      reason: "documentation-only",
      changedPathCount: 18,
    },
  );
});

test("verifies documentation automation without rebuilding unchanged application inputs", () => {
  assert.deepEqual(
    classifyCiImpact({
      eventName: "push",
      comparisonAvailable: true,
      changedPaths: [
        "docs/testing/public-release-readiness.md",
        "scripts/check-current-documentation.mjs",
        "scripts/check-current-documentation.test.mjs",
        "scripts/check-markdown-links.mjs",
        "scripts/check-public-documentation.mjs",
        "scripts/check-public-documentation.test.mjs",
      ],
    }),
    {
      fullVerification: false,
      productSurfaceVerification: false,
      automationVerification: true,
      reason: "documentation-only",
      changedPathCount: 6,
    },
  );
});

test("keys reusable evidence to every executable and release input", () => {
  const original = fingerprintExecutableEntries([
    "100644 blob source-hash\tsrc/App.tsx",
    "100644 blob readme-hash\tREADME.md",
    "100644 blob status-hash\tdocs/product-status.json",
    "100644 blob guide-hash\tdocs/user/README.md",
    "100644 blob site-hash\tsite/index.html",
    "100644 blob pages-hash\tscripts/pages-artifact.mjs",
  ]);

  assert.equal(
    fingerprintExecutableEntries([
      "100644 blob source-hash\tsrc/App.tsx",
      "100644 blob changed-readme\tREADME.md",
      "100644 blob changed-status\tdocs/product-status.json",
      "100644 blob changed-guide\tdocs/user/README.md",
      "100644 blob changed-site\tsite/index.html",
      "100644 blob changed-pages\tscripts/pages-artifact.mjs",
    ]),
    original,
  );
  assert.notEqual(
    fingerprintExecutableEntries([
      "100644 blob changed-source\tsrc/App.tsx",
      "100644 blob readme-hash\tREADME.md",
      "100644 blob status-hash\tdocs/product-status.json",
      "100644 blob guide-hash\tdocs/user/README.md",
      "100644 blob site-hash\tsite/index.html",
    ]),
    original,
  );
  assert.equal(
    fingerprintExecutableEntries([
      "100644 blob source-hash\tsrc/App.tsx",
      "100644 blob changed-documentation-test\tscripts/check-current-documentation.test.mjs",
    ]),
    fingerprintExecutableEntries([
      "100644 blob source-hash\tsrc/App.tsx",
      "100644 blob documentation-test\tscripts/check-current-documentation.test.mjs",
    ]),
  );
});

test("reuses a documentation-only result only with matching successful evidence", () => {
  assert.deepEqual(
    resolveCiVerification({
      candidateFullVerification: false,
      classificationReason: "documentation-only",
      evidenceAvailable: true,
    }),
    { fullVerification: false, reason: "verified-inputs-unchanged" },
  );
  assert.deepEqual(
    resolveCiVerification({
      candidateFullVerification: false,
      classificationReason: "documentation-only",
      evidenceAvailable: false,
    }),
    { fullVerification: true, reason: "verification-evidence-unavailable" },
  );
  assert.deepEqual(
    resolveCiVerification({
      candidateFullVerification: true,
      classificationReason: "release-affecting-change",
      evidenceAvailable: true,
    }),
    { fullVerification: true, reason: "release-affecting-change" },
  );
});

test("wires the fail-closed classifier into every hosted verification lane", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  const qualityJob = workflow.match(
    /  quality:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body;
  const packagedMacosJob = workflow.match(
    /  packaged-macos-e2e:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body;
  const packagedLinuxUpdateJob = workflow.match(
    /  packaged-linux-update-e2e:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body;
  const packagedLinuxJob = workflow.match(
    /  packaged-linux-e2e:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body;
  const windowsHostJob = workflow.match(
    /  windows-host:\n(?<body>[\s\S]*?)(?=\n  [a-z][\w-]+:\n)/,
  )?.groups?.body;

  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /id: impact/);
  assert.match(workflow, /run: node scripts\/classify-ci-impact\.mjs/);
  assert.match(workflow, /uses: actions\/cache\/restore@[0-9a-f]{40}/);
  assert.match(workflow, /run: node scripts\/classify-ci-impact\.mjs resolve/);
  assert.match(workflow, /npm run check:product-surfaces/);
  assert.match(workflow, /npm run check:site/);
  assert.match(workflow, /npm run test:product-site/);
  assert.match(workflow, /npm run build:pages/);
  assert.match(workflow, /npm run verify:pages:preflight/);
  assert.match(workflow, /steps\.impact\.outputs\.automation-verification == 'true'/);
  assert.match(workflow, /node --test scripts\/classify-ci-impact\.test\.mjs/);
  assert.match(workflow, /npm run check:workflows/);
  assert.match(workflow, /npm run check:public-release-workflow/);
  assert.match(
    workflow,
    /full-verification: \$\{\{ steps\.decision\.outputs\.full-verification \}\}/,
  );
  assert.match(workflow, /needs: quality/);
  assert.match(
    workflow,
    /if: needs\.quality\.outputs\.full-verification == 'true'/,
  );
  assert.match(
    workflow,
    /needs: \[quality, windows-host, packaged-macos-e2e, packaged-linux-e2e, packaged-linux-update-e2e\]/,
  );
  assert.match(workflow, /needs\.windows-host\.result == 'success'/);
  assert.match(workflow, /needs\.packaged-linux-e2e\.result == 'success'/);
  assert.match(
    workflow,
    /needs\.packaged-linux-update-e2e\.result == 'success'/,
  );
  assert.match(workflow, /uses: actions\/cache\/save@[0-9a-f]{40}/);
  assert.match(qualityJob ?? "", /^    runs-on: ubuntu-24\.04$/m);
  assert.match(qualityJob ?? "", /npm run test:rust/);
  assert.match(qualityJob ?? "", /npm run lint:rust/);
  assert.match(qualityJob ?? "", /npm run package:linux/);
  assert.match(qualityJob ?? "", /npm run verify:linux-package/);
  assert.match(qualityJob ?? "", /npm run inventory:linux-package/);
  assert.match(qualityJob ?? "", /npm run verify:linux-installation/);
  assert.doesNotMatch(qualityJob ?? "", /actions\/upload-artifact/);
  assert.doesNotMatch(
    qualityJob ?? "",
    /cargo test --manifest-path src-tauri\/Cargo\.toml -p fitfreed-domain -p fitfreed-application/,
  );
  assert.match(packagedMacosJob ?? "", /^    timeout-minutes: 95$/m);
  assert.match(packagedLinuxUpdateJob ?? "", /^    needs: quality$/m);
  assert.match(
    packagedLinuxUpdateJob ?? "",
    /^    if: needs\.quality\.outputs\.full-verification == 'true'$/m,
  );
  assert.match(packagedLinuxUpdateJob ?? "", /^    runs-on: ubuntu-24\.04$/m);
  assert.match(packagedLinuxUpdateJob ?? "", /npm run verify:linux-update-e2e/);
  assert.match(packagedLinuxJob ?? "", /^    needs: quality$/m);
  assert.match(
    packagedLinuxJob ?? "",
    /^    if: needs\.quality\.outputs\.full-verification == 'true'$/m,
  );
  assert.match(packagedLinuxJob ?? "", /^    runs-on: ubuntu-24\.04$/m);
  assert.match(packagedLinuxJob ?? "", /npm run verify:linux-e2e/);
  assert.match(windowsHostJob ?? "", /^    needs: quality$/m);
  assert.match(windowsHostJob ?? "", /^    runs-on: windows-2025$/m);
  assert.match(
    windowsHostJob ?? "",
    /fitfreed-windows-host-v1-\$\{\{ needs\.quality\.outputs\.executable-fingerprint \}\}/,
  );
  assert.match(windowsHostJob ?? "", /npm run test:windows-scripts/);
  assert.match(windowsHostJob ?? "", /npm run test:rust/);
  assert.match(windowsHostJob ?? "", /npm run lint:rust/);
  assert.match(windowsHostJob ?? "", /npm run build:windows-host/);
});
