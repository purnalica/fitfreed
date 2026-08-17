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
      reason: "documentation-only",
      changedPathCount: 7,
    },
  );
});

test("requires full verification when any executable or release input changes", () => {
  for (const changedPath of [
    "package.json",
    "schemas/release-manifest-v2.schema.json",
    "scripts/check-markdown-links.mjs",
    "src/App.tsx",
    "src-tauri/src/lib.rs",
    ".github/workflows/ci.yml",
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
      reason: "explicit-verification",
      changedPathCount: 1,
    },
  );
});

test("keys reusable evidence to every executable and release input", () => {
  const original = fingerprintExecutableEntries([
    "100644 blob source-hash\tsrc/App.tsx",
    "100644 blob readme-hash\tREADME.md",
    "100644 blob guide-hash\tdocs/user/README.md",
  ]);

  assert.equal(
    fingerprintExecutableEntries([
      "100644 blob source-hash\tsrc/App.tsx",
      "100644 blob changed-readme\tREADME.md",
      "100644 blob changed-guide\tdocs/user/README.md",
    ]),
    original,
  );
  assert.notEqual(
    fingerprintExecutableEntries([
      "100644 blob changed-source\tsrc/App.tsx",
      "100644 blob readme-hash\tREADME.md",
      "100644 blob guide-hash\tdocs/user/README.md",
    ]),
    original,
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

test("wires the fail-closed classifier into both hosted verification lanes", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /id: impact/);
  assert.match(workflow, /run: node scripts\/classify-ci-impact\.mjs/);
  assert.match(workflow, /uses: actions\/cache\/restore@[0-9a-f]{40}/);
  assert.match(workflow, /run: node scripts\/classify-ci-impact\.mjs resolve/);
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
  assert.match(workflow, /needs: \[quality, packaged-macos-e2e\]/);
  assert.match(workflow, /uses: actions\/cache\/save@[0-9a-f]{40}/);
});
