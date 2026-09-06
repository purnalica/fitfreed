import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const commitSha = /^[0-9a-f]{40}$/;
const focusedVerificationScopes = new Set([
  "linux-capability",
  "linux-insights",
  "linux-update",
  "macos-package",
  "windows-capability",
  "windows-host",
  "windows-package",
  "windows-update",
]);

function productSurfacePath(candidatePath) {
  return (
    [
      ".github/workflows/pages.yml",
      "README.md",
      "docs/product-status.json",
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
      "site/README.md",
      "site/index.html",
      "site/styles.css",
    ].includes(candidatePath) || /^site\/locales\/[^/]+\.json$/.test(candidatePath)
  );
}

function automationVerificationPath(candidatePath) {
  return [
    "scripts/check-current-documentation.mjs",
    "scripts/check-current-documentation.test.mjs",
    "scripts/check-markdown-links.mjs",
    "scripts/check-public-documentation.mjs",
    "scripts/check-public-documentation.test.mjs",
  ].includes(candidatePath);
}

function documentationOnlyPath(candidatePath) {
  return (
    /^(?:AGENTS|CODE_OF_CONDUCT|CONTRIBUTING|DISCLAIMER|GOVERNANCE|README|SECURITY|SUPPORT)\.md$/.test(
      candidatePath,
    ) ||
    /^docs\/.*\.md$/.test(candidatePath) ||
    productSurfacePath(candidatePath) ||
    automationVerificationPath(candidatePath) ||
    /^\.github\/ISSUE_TEMPLATE\/[^/]+\.(?:md|ya?ml)$/.test(candidatePath) ||
    candidatePath === ".github/PULL_REQUEST_TEMPLATE.md"
  );
}

export function fingerprintExecutableEntries(entries) {
  const executableEntries = entries
    .filter((entry) => {
      const pathSeparator = entry.indexOf("\t");
      if (pathSeparator < 0) throw new Error(`Invalid Git tree entry: ${entry}`);
      return !documentationOnlyPath(entry.slice(pathSeparator + 1));
    })
    .sort();
  const fingerprint = createHash("sha256");
  for (const entry of executableEntries) fingerprint.update(entry).update("\0");
  return fingerprint.digest("hex");
}

export function classifyCiImpact({
  eventName,
  comparisonAvailable,
  changedPaths,
  requestedScope = "candidate",
}) {
  const uniquePaths = [...new Set(changedPaths)];
  const result = (fullVerification, qualityVerification, focusedVerification, reason) => ({
    fullVerification,
    qualityVerification,
    focusedVerification,
    productSurfaceVerification: uniquePaths.some(productSurfacePath),
    automationVerification: uniquePaths.some(automationVerificationPath),
    reason,
    changedPathCount: uniquePaths.length,
  });

  if (eventName === "workflow_dispatch") {
    if (requestedScope === "candidate") {
      return result(true, true, "", "explicit-verification");
    }
    if (!focusedVerificationScopes.has(requestedScope)) {
      throw new Error(`Unsupported focused verification scope: ${requestedScope}`);
    }
    return result(false, false, requestedScope, `focused-${requestedScope}`);
  }
  if (!comparisonAvailable) return result(false, true, "", "comparison-unavailable");
  if (uniquePaths.length === 0) return result(false, true, "", "empty-change-set");
  if (uniquePaths.every(documentationOnlyPath)) {
    return result(false, false, "", "documentation-only");
  }
  return result(false, true, "", "executable-increment");
}

export function resolveCiVerification({
  candidateFullVerification,
  candidateQualityVerification,
  classificationReason,
  evidenceAvailable,
}) {
  if (candidateFullVerification) {
    return {
      fullVerification: true,
      qualityVerification: true,
      reason: classificationReason,
    };
  }
  if (candidateQualityVerification) {
    return {
      fullVerification: false,
      qualityVerification: true,
      reason: classificationReason,
    };
  }
  if (evidenceAvailable) {
    return {
      fullVerification: false,
      qualityVerification: false,
      reason: "verified-inputs-unchanged",
    };
  }
  return {
    fullVerification: false,
    qualityVerification: false,
    reason: "verification-evidence-unavailable",
  };
}

function changedPathsFromEnvironment(environment) {
  if (environment.FITFREED_CI_EVENT === "workflow_dispatch") {
    return { comparisonAvailable: true, changedPaths: [] };
  }

  const base = environment.FITFREED_CI_BASE ?? "";
  const head = environment.FITFREED_CI_HEAD ?? "";
  if (!commitSha.test(base) || !commitSha.test(head) || /^0+$/.test(base)) {
    return { comparisonAvailable: false, changedPaths: [] };
  }

  const separator = environment.FITFREED_CI_EVENT === "pull_request" ? "..." : "..";
  const difference = spawnSync(
    "git",
    ["diff", "--name-only", "-z", `${base}${separator}${head}`],
    { encoding: "buffer" },
  );
  if (difference.status !== 0 || difference.error) {
    return { comparisonAvailable: false, changedPaths: [] };
  }

  const changedPaths = difference.stdout
    .toString("utf8")
    .split("\0")
    .filter((candidatePath) => candidatePath.length > 0);
  return { comparisonAvailable: true, changedPaths };
}

function executableFingerprint(revision) {
  const tree = spawnSync("git", ["ls-tree", "-r", "-z", "--full-tree", revision], {
    encoding: "buffer",
  });
  if (tree.status !== 0 || tree.error) {
    throw new Error(`Unable to fingerprint executable inputs at ${revision}`);
  }
  const entries = tree.stdout
    .toString("utf8")
    .split("\0")
    .filter((entry) => entry.length > 0);
  return fingerprintExecutableEntries(entries);
}

function writeOutputs(environment, outputs) {
  const output = Object.entries(outputs)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  if (environment.GITHUB_OUTPUT) appendFileSync(environment.GITHUB_OUTPUT, `${output}\n`);
}

function runClassification(environment) {
  const comparison = changedPathsFromEnvironment(environment);
  const result = classifyCiImpact({
    eventName: environment.FITFREED_CI_EVENT,
    requestedScope: environment.FITFREED_CI_SCOPE || "candidate",
    ...comparison,
  });
  const fingerprint = executableFingerprint(environment.FITFREED_CI_HEAD || "HEAD");
  writeOutputs(environment, {
    "candidate-full-verification": result.fullVerification,
    "candidate-quality-verification": result.qualityVerification,
    "classification-reason": result.reason,
    "changed-path-count": result.changedPathCount,
    "executable-fingerprint": fingerprint,
    "focused-verification": result.focusedVerification,
    "product-surface-verification": result.productSurfaceVerification,
    "automation-verification": result.automationVerification,
  });
  process.stdout.write(`${JSON.stringify({ ...result, executableFingerprint: fingerprint })}\n`);
}

function runResolution(environment) {
  const result = resolveCiVerification({
    candidateFullVerification: environment.FITFREED_CI_CANDIDATE_FULL === "true",
    candidateQualityVerification: environment.FITFREED_CI_CANDIDATE_QUALITY === "true",
    classificationReason: environment.FITFREED_CI_CLASSIFICATION_REASON,
    evidenceAvailable: environment.FITFREED_CI_EVIDENCE_AVAILABLE === "true",
  });
  writeOutputs(environment, {
    "full-verification": result.fullVerification,
    "quality-verification": result.qualityVerification,
    reason: result.reason,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2] === "resolve") runResolution(process.env);
  else runClassification(process.env);
}
