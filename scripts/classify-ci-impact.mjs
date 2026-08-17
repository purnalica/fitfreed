import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const commitSha = /^[0-9a-f]{40}$/;

function documentationOnlyPath(candidatePath) {
  return (
    /^(?:AGENTS|CODE_OF_CONDUCT|CONTRIBUTING|DISCLAIMER|GOVERNANCE|README|SECURITY|SUPPORT)\.md$/.test(
      candidatePath,
    ) ||
    /^docs\/.*\.md$/.test(candidatePath) ||
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

export function classifyCiImpact({ eventName, comparisonAvailable, changedPaths }) {
  const uniquePaths = [...new Set(changedPaths)];
  const result = (fullVerification, reason) => ({
    fullVerification,
    reason,
    changedPathCount: uniquePaths.length,
  });

  if (eventName === "workflow_dispatch") return result(true, "explicit-verification");
  if (!comparisonAvailable) return result(true, "comparison-unavailable");
  if (uniquePaths.length === 0) return result(true, "empty-change-set");
  if (uniquePaths.every(documentationOnlyPath)) return result(false, "documentation-only");
  return result(true, "release-affecting-change");
}

export function resolveCiVerification({
  candidateFullVerification,
  classificationReason,
  evidenceAvailable,
}) {
  if (candidateFullVerification) {
    return { fullVerification: true, reason: classificationReason };
  }
  if (evidenceAvailable) {
    return { fullVerification: false, reason: "verified-inputs-unchanged" };
  }
  return { fullVerification: true, reason: "verification-evidence-unavailable" };
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
    ...comparison,
  });
  const fingerprint = executableFingerprint(environment.FITFREED_CI_HEAD || "HEAD");
  writeOutputs(environment, {
    "candidate-full-verification": result.fullVerification,
    "classification-reason": result.reason,
    "changed-path-count": result.changedPathCount,
    "executable-fingerprint": fingerprint,
  });
  process.stdout.write(`${JSON.stringify({ ...result, executableFingerprint: fingerprint })}\n`);
}

function runResolution(environment) {
  const result = resolveCiVerification({
    candidateFullVerification: environment.FITFREED_CI_CANDIDATE_FULL === "true",
    classificationReason: environment.FITFREED_CI_CLASSIFICATION_REASON,
    evidenceAvailable: environment.FITFREED_CI_EVIDENCE_AVAILABLE === "true",
  });
  writeOutputs(environment, {
    "full-verification": result.fullVerification,
    reason: result.reason,
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv[2] === "resolve") runResolution(process.env);
  else runClassification(process.env);
}
