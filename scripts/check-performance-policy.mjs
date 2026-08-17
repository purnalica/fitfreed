import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentPolicyPaths = [
  "README.md",
  "SUPPORT.md",
  "docs/development/performance-benchmarks.md",
  "docs/plans/milestone-2.md",
  "docs/quality-targets.md",
  "docs/requirements.md",
  "docs/roadmap.md",
  "docs/testing/private-alpha-readiness.md",
  "docs/user/private-alpha-candidate.md",
  "release/notes/0.1.0.md",
];

const fixedMemoryGate =
  /(?:\b8\s+(?:GB|GiB)\b[\s\S]{0,80}\b(?:acceptance|minimum|reference)\b|\b(?:acceptance|minimum|reference)\b[\s\S]{0,80}\b8\s+(?:GB|GiB)\b)/i;

export function validatePerformancePolicy(documents) {
  const errors = [];
  const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
  };

  for (const [documentPath, content] of documents) {
    requireValue(
      !fixedMemoryGate.test(content),
      `${documentPath} retains an unavailable fixed-memory performance gate`,
    );
  }

  const qualityTargets = documents.get("docs/quality-targets.md") ?? "";
  const requirements = documents.get("docs/requirements.md") ?? "";
  requireValue(
    /hosted macOS/i.test(qualityTargets),
    "docs/quality-targets.md must name hosted macOS",
  );
  requireValue(
    /local Apple Silicon/i.test(qualityTargets),
    "docs/quality-targets.md must name local Apple Silicon",
  );
  requireValue(
    /0015-qualify-performance-evidence-by-execution-environment\.md/.test(qualityTargets) ||
      /ADR 0015/.test(qualityTargets),
    "docs/quality-targets.md must link ADR 0015",
  );
  requireValue(
    /0015-qualify-performance-evidence-by-execution-environment\.md/.test(requirements) ||
      /ADR 0015/.test(requirements),
    "docs/requirements.md must link ADR 0015",
  );

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { checkedDocuments: documents.size, model: "environment-qualified" };
}

export function inspectPerformancePolicy(repositoryRoot) {
  return validatePerformancePolicy(
    new Map(
      currentPolicyPaths.map((relativePath) => [
        relativePath,
        readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
      ]),
    ),
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  process.stdout.write(`${JSON.stringify(inspectPerformancePolicy(repositoryRoot))}\n`);
}
