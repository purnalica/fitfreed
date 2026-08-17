import assert from "node:assert/strict";
import test from "node:test";

import {
  validateProtectedReleaseEnvironment,
  validatePublicReleaseInvocation,
} from "./public-release-preflight.mjs";

function protectedEnvironment() {
  return {
    name: "public-macos-release",
    can_admins_bypass: false,
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: false,
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
    clean: true,
    onMain: true,
    protectedEnvironment: {
      environment: "public-macos-release",
      requiredReviewerCount: 1,
      administratorBypass: false,
      tagPolicy: "v*",
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
      administratorBypass: false,
      tagPolicy: "v*",
    },
  );
});

test("rejects an implicit, bypassable, unreviewed, or branch-open environment", () => {
  for (const mutate of [
    (environment) => { environment.can_admins_bypass = true; },
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
    [(input) => { input.clean = false; }, /clean source revision/],
    [(input) => { input.onMain = false; }, /reachable from origin\/main/],
    [(input) => { input.publicUpdateConfiguration.status = "inactive"; }, /channel is inactive/],
    [(input) => { input.updateKeyId = "stable-unknown"; }, /active public trust set/],
    [(input) => { input.protectedEnvironment = undefined; }, /environment evidence is invalid/],
  ]) {
    const input = invocation();
    mutate(input);
    assert.throws(() => validatePublicReleaseInvocation(input), expected);
  }
});
