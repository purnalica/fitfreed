import assert from "node:assert/strict";
import test from "node:test";

import { publicOrigin } from "./public-origin.mjs";
import {
  validateProtectedReleaseEnvironment,
  validatePublicPagesConfiguration,
  validatePublicReleaseInvocation,
  validateRequiredWorkflowRuns,
  resolveRemoteTagRevision,
} from "./public-release-preflight.mjs";

function protectedEnvironment() {
  return {
    name: "public-macos-release",
    can_admins_bypass: false,
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: true,
        reviewers: [{ type: "User", reviewer: { login: "synthetic-reviewer" } }],
      },
      { type: "branch_policy" },
    ],
    deployment_branch_policy: {
      protected_branches: false,
      custom_branch_policies: true,
    },
  };
}

function invocation() {
  const revision = "a".repeat(40);
  return {
    version: "0.1.0",
    updateKeyId: "stable-2026-1",
    releaseMetadata: { version: "0.1.0" },
    upgradeMatrix: { releaseVersion: "0.1.0" },
    publicReleasePolicy: { releaseVersion: "0.1.0" },
    publicUpdateConfiguration: {
      status: "active",
      contract: "stable-v2",
      keys: [{ id: "stable-2026-1", publicKey: "synthetic-public-key" }],
    },
    eventName: "workflow_dispatch",
    repository: "purnalica/fitfreed",
    repositoryVisibility: "public",
    ref: "refs/tags/v0.1.0",
    headRevision: revision,
    tagRevision: revision,
    remoteTagRevision: revision,
    clean: true,
    onMain: true,
    protectedEnvironment: {
      environment: "public-macos-release",
      requiredReviewerCount: 1,
      selfReview: false,
      administratorBypass: false,
      tagPolicy: "v*",
    },
    publicPages: {
      source: "workflow",
      httpsEnforced: true,
      url: publicOrigin,
    },
    workflowEvidence: {
      requiredWorkflows: ["ci.yml", "repository-safety.yml"],
      revision,
    },
  };
}

test("accepts a reviewer-protected environment limited to version tags", () => {
  assert.deepEqual(
    validateProtectedReleaseEnvironment(protectedEnvironment(), {
      branch_policies: [{ name: "v*", type: "tag" }],
    }),
    {
      environment: "public-macos-release",
      requiredReviewerCount: 1,
      selfReview: false,
      administratorBypass: false,
      tagPolicy: "v*",
    },
  );
});

test("rejects an implicit, bypassable, unreviewed, or branch-open environment", () => {
  for (const mutate of [
    (environment) => { environment.can_admins_bypass = true; },
    (environment) => {
      environment.protection_rules.find(({ type }) => type === "required_reviewers")
        .prevent_self_review = false;
    },
    (environment) => { environment.protection_rules = [{ type: "branch_policy" }]; },
    (environment) => { environment.deployment_branch_policy.custom_branch_policies = false; },
  ]) {
    const environment = protectedEnvironment();
    mutate(environment);
    assert.throws(
      () => validateProtectedReleaseEnvironment(environment, {
        branch_policies: [{ name: "v*", type: "tag" }],
      }),
      /protected environment/,
    );
  }
  assert.throws(
    () => validateProtectedReleaseEnvironment(protectedEnvironment(), {
      branch_policies: [{ name: "main", type: "branch" }],
    }),
    /v\* tag policy/,
  );
  assert.throws(
    () => validateProtectedReleaseEnvironment(protectedEnvironment(), {
      branch_policies: [
        { name: "v*", type: "tag" },
        { name: "release/*", type: "branch" },
      ],
    }),
    /v\* tag policy/,
  );
});

test("accepts only the HTTPS Actions-backed project Pages site", () => {
  assert.deepEqual(validatePublicPagesConfiguration({
    build_type: "workflow",
    https_enforced: true,
    html_url: publicOrigin,
  }), {
    source: "workflow",
    httpsEnforced: true,
    url: publicOrigin,
  });

  for (const [mutate, expected] of [
    [(pages) => { pages.build_type = "legacy"; }, /GitHub Actions/],
    [(pages) => { pages.https_enforced = false; }, /enforce HTTPS/],
    [(pages) => { pages.html_url = "https://example.invalid/"; }, /URL is invalid/],
  ]) {
    const pages = {
      build_type: "workflow",
      https_enforced: true,
      html_url: publicOrigin,
    };
    mutate(pages);
    assert.throws(() => validatePublicPagesConfiguration(pages), expected);
  }
});

test("requires successful push checks for the exact release revision", () => {
  const revision = "a".repeat(40);
  const successfulRun = {
    headSha: revision,
    event: "push",
    status: "completed",
    conclusion: "success",
  };
  const evidence = validateRequiredWorkflowRuns({
    "ci.yml": [successfulRun],
    "repository-safety.yml": [successfulRun],
  }, revision);
  assert.deepEqual(evidence, {
    requiredWorkflows: ["ci.yml", "repository-safety.yml"],
    revision,
  });

  for (const [mutate, expected] of [
    [(runs) => { runs["ci.yml"][0].headSha = "b".repeat(40); }, /ci.yml/],
    [(runs) => { runs["ci.yml"][0].event = "workflow_dispatch"; }, /ci.yml/],
    [(runs) => { runs["repository-safety.yml"][0].conclusion = "failure"; }, /repository-safety/],
  ]) {
    const runs = {
      "ci.yml": [{ ...successfulRun }],
      "repository-safety.yml": [{ ...successfulRun }],
    };
    mutate(runs);
    assert.throws(() => validateRequiredWorkflowRuns(runs, revision), expected);
  }
});

test("resolves lightweight and annotated origin tags to their release commit", () => {
  const direct = "a".repeat(40);
  const tagObject = "b".repeat(40);
  assert.equal(
    resolveRemoteTagRevision(`${direct}\trefs/tags/v0.1.0\n`, "0.1.0"),
    direct,
  );
  assert.equal(resolveRemoteTagRevision(
    `${tagObject}\trefs/tags/v0.1.0\n${direct}\trefs/tags/v0.1.0^{}\n`,
    "0.1.0",
  ), direct);
  assert.throws(() => resolveRemoteTagRevision("", "0.1.0"), /unavailable on origin/);
  assert.throws(
    () => resolveRemoteTagRevision("malformed response\n", "0.1.0"),
    /response is invalid/,
  );
});

test("accepts only one exact manually dispatched tag and trusted update key", () => {
  const input = invocation();
  assert.deepEqual(validatePublicReleaseInvocation(input), {
    version: "0.1.0",
    revision: "a".repeat(40),
    tag: "v0.1.0",
    updateContract: "stable-v2",
    updateKeyId: "stable-2026-1",
    protectedEnvironment: "public-macos-release",
  });
});

test("rejects every route that bypasses exact source, active trust, or manual authority", () => {
  for (const [mutate, expected] of [
    [(input) => { input.eventName = "push"; }, /manually dispatched/],
    [(input) => { input.ref = "refs/heads/main"; }, /public release ref/],
    [(input) => { input.tagRevision = "b".repeat(40); }, /tag does not identify/],
    [(input) => { input.remoteTagRevision = "b".repeat(40); }, /origin public release tag/],
    [(input) => { input.clean = false; }, /clean source revision/],
    [(input) => { input.onMain = false; }, /reachable from origin\/main/],
    [(input) => { input.publicUpdateConfiguration.status = "inactive"; }, /channel is inactive/],
    [(input) => { input.updateKeyId = "stable-unknown"; }, /active public trust set/],
    [(input) => { input.protectedEnvironment = undefined; }, /environment evidence is invalid/],
    [(input) => { input.protectedEnvironment.administratorBypass = true; }, /environment evidence/],
    [(input) => { input.publicPages = undefined; }, /Pages evidence is invalid/],
    [(input) => { input.publicPages.httpsEnforced = false; }, /Pages evidence/],
    [(input) => { input.workflowEvidence.revision = "b".repeat(40); }, /workflow evidence/],
  ]) {
    const input = invocation();
    mutate(input);
    assert.throws(() => validatePublicReleaseInvocation(input), expected);
  }
});
