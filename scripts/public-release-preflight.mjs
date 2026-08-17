import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { inspectUpgradeMatrix } from "./upgrade-matrix.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const revisionPattern = /^[0-9a-f]{40,64}$/;
const releaseEnvironmentName = "public-macos-release";

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
    || !policies.some(({ name, type }) => name === "v*" && (type === undefined || type === "tag"))
  ) {
    errors.push("protected environment must admit only version tags through a v* tag policy");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    environment: releaseEnvironmentName,
    requiredReviewerCount: reviewerRule.reviewers.length,
    administratorBypass: false,
    tagPolicy: "v*",
  };
}

export function validatePublicReleaseInvocation({
  version,
  updateKeyId,
  releaseMetadata,
  upgradeMatrix,
  publicUpdateConfiguration,
  eventName,
  repository,
  repositoryVisibility,
  ref,
  headRevision,
  tagRevision,
  clean,
  onMain,
  protectedEnvironment,
}) {
  const errors = [];
  if (eventName !== "workflow_dispatch") errors.push("public release must be manually dispatched");
  if (repository !== "purnalica/fitfreed") errors.push("public release repository is invalid");
  if (repositoryVisibility !== "public") errors.push("public release repository must be public");
  if (ref !== `refs/tags/v${version}`) errors.push(`public release ref must be refs/tags/v${version}`);
  if (!revisionPattern.test(headRevision ?? "")) errors.push("public release revision is invalid");
  if (tagRevision !== headRevision) errors.push("public release tag does not identify the checked-out revision");
  if (!clean) errors.push("public release requires a clean source revision");
  if (!onMain) errors.push("public release revision must be reachable from origin/main");
  if (releaseMetadata?.version !== version) errors.push("release metadata version does not match input");
  if (upgradeMatrix?.releaseVersion !== version) errors.push("upgrade matrix version does not match input");
  if (publicUpdateConfiguration?.status !== "active") errors.push("public update channel is inactive");
  if (publicUpdateConfiguration?.contract !== "stable-v2") {
    errors.push("public update channel must use stable-v2");
  }
  if (!publicUpdateConfiguration?.keys?.some(({ id }) => id === updateKeyId)) {
    errors.push("selected update signing key is outside the active public trust set");
  }
  if (protectedEnvironment?.environment !== releaseEnvironmentName) {
    errors.push("protected release environment evidence is invalid");
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

function readGithubEnvironment() {
  const base = `repos/purnalica/fitfreed/environments/${releaseEnvironmentName}`;
  let environment;
  let policies;
  try {
    environment = JSON.parse(run("gh", ["api", base]));
    policies = JSON.parse(run("gh", ["api", `${base}/deployment-branch-policies`]));
  } catch {
    throw new Error("protected public release environment is unavailable");
  }
  return validateProtectedReleaseEnvironment(environment, policies);
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

function main() {
  const [version, updateKeyId] = process.argv.slice(2);
  if (!version || !updateKeyId) {
    throw new Error("usage: npm run preflight:public-release -- <version> <update-key-id>");
  }
  const headRevision = run("git", ["rev-parse", "HEAD"]);
  const tagRevision = run("git", ["rev-list", "-n", "1", `refs/tags/v${version}`]);
  const releaseMetadata = inspectReleaseContracts(repositoryRoot, version);
  const upgradeMatrix = inspectUpgradeMatrix(repositoryRoot);
  const publicUpdateConfiguration = loadPublicUpdateConfiguration(repositoryRoot);
  const protectedEnvironment = readGithubEnvironment();
  const result = validatePublicReleaseInvocation({
    version,
    updateKeyId,
    releaseMetadata,
    upgradeMatrix,
    publicUpdateConfiguration,
    eventName: process.env.GITHUB_EVENT_NAME,
    repository: process.env.GITHUB_REPOSITORY,
    repositoryVisibility: process.env.GITHUB_REPOSITORY_VISIBILITY,
    ref: process.env.GITHUB_REF,
    headRevision,
    tagRevision,
    clean: run("git", ["status", "--porcelain=v1", "--untracked-files=all"]).length === 0,
    onMain: revisionIsOnMain(headRevision),
    protectedEnvironment,
  });
  process.stdout.write(`${JSON.stringify({ ...result, ...protectedEnvironment })}\n`);
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
