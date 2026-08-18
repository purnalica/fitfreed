import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { publicOrigin } from "./public-origin.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { loadPublicReleasePolicy } from "./public-release-policy.mjs";
import { inspectPublicReleaseWorkflow } from "./public-release-workflow.mjs";
import { inspectUpgradeMatrix } from "./upgrade-matrix.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revisionPattern = /^[0-9a-f]{40,64}$/;
const releaseEnvironmentName = "public-macos-release";
const repositoryName = "purnalica/fitfreed";
const pagesUrl = publicOrigin;
const requiredWorkflows = ["ci.yml", "repository-safety.yml"];

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(`${path.basename(command)} public release preflight command failed`);
  }
}

export function validateProtectedReleaseEnvironment(environment, branchPolicies) {
  const errors = [];
  if (environment?.name !== releaseEnvironmentName) {
    errors.push(`protected environment must be named ${releaseEnvironmentName}`);
  }
  const reviewerRule = environment?.protection_rules?.find(
    ({ type }) => type === "required_reviewers",
  );
  if (!reviewerRule || !Array.isArray(reviewerRule.reviewers) || reviewerRule.reviewers.length < 1) {
    errors.push("protected environment must require at least one reviewer");
  }
  if (reviewerRule?.prevent_self_review !== true) {
    errors.push("protected environment must prevent self-review");
  }
  if (environment?.can_admins_bypass !== false) {
    errors.push("protected environment must disallow administrator bypass");
  }
  if (
    environment?.deployment_branch_policy?.protected_branches !== false
    || environment?.deployment_branch_policy?.custom_branch_policies !== true
  ) {
    errors.push("protected environment must use custom deployment tag policies");
  }
  const policies = branchPolicies?.branch_policies;
  if (
    !Array.isArray(policies)
    || policies.length !== 1
    || policies[0].name !== "v*"
    || (policies[0].type !== undefined && policies[0].type !== "tag")
  ) {
    errors.push("protected environment must admit only version tags through a v* tag policy");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    environment: releaseEnvironmentName,
    requiredReviewerCount: reviewerRule.reviewers.length,
    selfReview: false,
    administratorBypass: false,
    tagPolicy: "v*",
  };
}

export function validatePublicPagesConfiguration(pages) {
  const errors = [];
  if (pages?.build_type !== "workflow") {
    errors.push("GitHub Pages must use GitHub Actions as its source");
  }
  if (pages?.https_enforced !== true) errors.push("GitHub Pages must enforce HTTPS");
  if (pages?.html_url !== pagesUrl) errors.push("GitHub Pages URL is invalid");
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    source: "workflow",
    httpsEnforced: true,
    url: pagesUrl,
  };
}

export function validateRequiredWorkflowRuns(runsByWorkflow, sourceRevision) {
  const errors = [];
  for (const workflow of requiredWorkflows) {
    const runs = runsByWorkflow?.[workflow];
    const successfulRun = Array.isArray(runs) && runs.find((run) =>
      run.headSha === sourceRevision
      && run.event === "push"
      && run.status === "completed"
      && run.conclusion === "success"
    );
    if (!successfulRun) {
      errors.push(`${workflow} has no successful push run for the release revision`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    requiredWorkflows: [...requiredWorkflows],
    revision: sourceRevision,
  };
}

export function resolveRemoteTagRevision(output, version) {
  const expectedRef = `refs/tags/v${version}`;
  const revisions = new Map(output.split("\n").filter(Boolean).map((line) => {
    const [revision, ref, ...additional] = line.split(/\s+/);
    if (additional.length > 0 || !revisionPattern.test(revision ?? "") || !ref) {
      throw new Error("remote public release tag response is invalid");
    }
    return [ref, revision];
  }));
  const resolved = revisions.get(`${expectedRef}^{}`) ?? revisions.get(expectedRef);
  if (!resolved) throw new Error("public release tag is unavailable on origin");
  return resolved;
}

export function validatePublicReleaseInvocation({
  version,
  updateKeyId,
  releaseMetadata,
  upgradeMatrix,
  publicUpdateConfiguration,
  publicReleasePolicy,
  eventName,
  repository,
  repositoryVisibility,
  ref,
  headRevision,
  tagRevision,
  remoteTagRevision,
  clean,
  onMain,
  protectedEnvironment,
  publicPages,
  workflowEvidence,
}) {
  const errors = [];
  if (eventName !== "workflow_dispatch") errors.push("public release must be manually dispatched");
  if (repository !== repositoryName) errors.push("public release repository is invalid");
  if (repositoryVisibility !== "public") errors.push("public release repository must be public");
  if (ref !== `refs/tags/v${version}`) errors.push(`public release ref must be refs/tags/v${version}`);
  if (!revisionPattern.test(headRevision ?? "")) errors.push("public release revision is invalid");
  if (tagRevision !== headRevision) errors.push("public release tag does not identify the checked-out revision");
  if (remoteTagRevision !== headRevision) {
    errors.push("origin public release tag does not identify the checked-out revision");
  }
  if (!clean) errors.push("public release requires a clean source revision");
  if (!onMain) errors.push("public release revision must be reachable from origin/main");
  if (releaseMetadata?.version !== version) errors.push("release metadata version does not match input");
  if (upgradeMatrix?.releaseVersion !== version) errors.push("upgrade matrix version does not match input");
  if (publicReleasePolicy?.releaseVersion !== version) {
    errors.push("public release policy version does not match input");
  }
  if (publicUpdateConfiguration?.status !== "active") errors.push("public update channel is inactive");
  if (publicUpdateConfiguration?.contract !== "stable-v2") {
    errors.push("public update channel must use stable-v2");
  }
  if (!publicUpdateConfiguration?.keys?.some(({ id }) => id === updateKeyId)) {
    errors.push("selected update signing key is outside the active public trust set");
  }
  if (
    protectedEnvironment?.environment !== releaseEnvironmentName
    || !Number.isSafeInteger(protectedEnvironment?.requiredReviewerCount)
    || protectedEnvironment.requiredReviewerCount < 1
    || protectedEnvironment?.selfReview !== false
    || protectedEnvironment?.administratorBypass !== false
    || protectedEnvironment?.tagPolicy !== "v*"
  ) {
    errors.push("protected release environment evidence is invalid");
  }
  if (
    publicPages?.url !== pagesUrl
    || publicPages?.source !== "workflow"
    || publicPages?.httpsEnforced !== true
  ) {
    errors.push("public Pages evidence is invalid");
  }
  if (
    workflowEvidence?.revision !== headRevision
    || JSON.stringify(workflowEvidence?.requiredWorkflows) !== JSON.stringify(requiredWorkflows)
  ) {
    errors.push("required workflow evidence is invalid");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    version,
    revision: headRevision,
    tag: `v${version}`,
    updateContract: "stable-v2",
    updateKeyId,
    protectedEnvironment: releaseEnvironmentName,
  };
}

function readGithubReleasePlatform(sourceRevision) {
  const base = `repos/${repositoryName}/environments/${releaseEnvironmentName}`;
  let environment;
  let policies;
  let pages;
  const runsByWorkflow = {};
  try {
    environment = JSON.parse(run("gh", ["api", base]));
    policies = JSON.parse(run("gh", ["api", `${base}/deployment-branch-policies`]));
    pages = JSON.parse(run("gh", ["api", `repos/${repositoryName}/pages`]));
    for (const workflow of requiredWorkflows) {
      runsByWorkflow[workflow] = JSON.parse(run("gh", [
        "run",
        "list",
        "--repo",
        repositoryName,
        "--workflow",
        workflow,
        "--commit",
        sourceRevision,
        "--limit",
        "20",
        "--json",
        "headSha,event,status,conclusion",
      ]));
    }
  } catch {
    throw new Error("public release platform prerequisites are unavailable");
  }
  return {
    protectedEnvironment: validateProtectedReleaseEnvironment(environment, policies),
    publicPages: validatePublicPagesConfiguration(pages),
    workflowEvidence: validateRequiredWorkflowRuns(runsByWorkflow, sourceRevision),
  };
}

function revisionIsOnMain(revision) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", revision, "origin/main"], {
      cwd: repositoryRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

export function inspectPublicReleasePreflight({
  version,
  updateKeyId,
  environment = process.env,
}) {
  if (!version || !updateKeyId) {
    throw new Error("usage: npm run preflight:public-release -- <version> <update-key-id>");
  }
  const headRevision = run("git", ["rev-parse", "HEAD"]);
  const tagRevision = run("git", ["rev-list", "-n", "1", `refs/tags/v${version}`]);
  const remoteTagRevision = resolveRemoteTagRevision(run("git", [
    "ls-remote",
    "origin",
    `refs/tags/v${version}`,
    `refs/tags/v${version}^{}`,
  ]), version);
  const releaseMetadata = inspectReleaseContracts(repositoryRoot, version);
  const upgradeMatrix = inspectUpgradeMatrix(repositoryRoot);
  const publicReleasePolicy = loadPublicReleasePolicy(repositoryRoot, version, upgradeMatrix);
  const publicUpdateConfiguration = loadPublicUpdateConfiguration(repositoryRoot);
  const workflow = inspectPublicReleaseWorkflow(repositoryRoot);
  const platform = readGithubReleasePlatform(headRevision);
  const result = validatePublicReleaseInvocation({
    version,
    updateKeyId,
    releaseMetadata,
    upgradeMatrix,
    publicUpdateConfiguration,
    publicReleasePolicy,
    eventName: environment.GITHUB_EVENT_NAME,
    repository: environment.GITHUB_REPOSITORY,
    repositoryVisibility: environment.GITHUB_REPOSITORY_VISIBILITY,
    ref: environment.GITHUB_REF,
    headRevision,
    tagRevision,
    remoteTagRevision,
    clean: run("git", ["status", "--porcelain=v1", "--untracked-files=all"]).length === 0,
    onMain: revisionIsOnMain(headRevision),
    ...platform,
  });
  return {
    ...result,
    ...platform.protectedEnvironment,
    pagesSource: platform.publicPages.source,
    requiredWorkflows: platform.workflowEvidence.requiredWorkflows,
    workflow: workflow.workflow,
  };
}

function main() {
  const [version, updateKeyId] = process.argv.slice(2);
  process.stdout.write(
    `${JSON.stringify(inspectPublicReleasePreflight({ version, updateKeyId }))}\n`,
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Public release preflight failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
