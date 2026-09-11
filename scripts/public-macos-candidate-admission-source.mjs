import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const revisionPattern = /^[0-9a-f]{40,64}$/;
const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function positiveInteger(value) {
  if (!/^[1-9]\d*$/.test(value ?? "")) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function validateMacosCandidateAdmissionRequest({
  artifactId,
  repository,
  revision,
  runId,
  sourceRef = "refs/heads/main",
  version,
}) {
  const parsedArtifactId = positiveInteger(artifactId);
  const parsedRunId = positiveInteger(runId);
  if (
    !parsedArtifactId
    || repository !== "purnalica/fitfreed"
    || !revisionPattern.test(revision ?? "")
    || !parsedRunId
    || sourceRef !== "refs/heads/main"
    || !semanticVersion.test(version ?? "")
  ) {
    throw new Error("macOS candidate admission request is invalid");
  }
  return {
    artifactId: parsedArtifactId,
    repository,
    revision,
    runId: parsedRunId,
    version,
  };
}

function exactJob(jobs, name) {
  const matches = jobs?.jobs?.filter((job) => job.name === name) ?? [];
  return matches.length === 1 ? matches[0] : null;
}

export function validateMacosCandidateAdmissionSource({ artifact, jobs, run }, request) {
  const build = exactJob(jobs, "Build the protected candidate");
  const promotion = exactJob(jobs, "Promote the independently accepted candidate");
  if (
    artifact?.id !== request.artifactId
    || artifact?.name !== `public-macos-candidate-${request.version}-${request.revision}`
    || artifact?.expired !== false
    || !Number.isSafeInteger(artifact?.size_in_bytes)
    || artifact.size_in_bytes < 1
    || artifact?.workflow_run?.id !== request.runId
    || artifact?.workflow_run?.head_sha !== request.revision
    || run?.id !== request.runId
    || run?.repository?.full_name !== request.repository
    || run?.path !== ".github/workflows/public-release.yml"
    || run?.event !== "workflow_dispatch"
    || run?.head_branch !== `v${request.version}`
    || run?.head_sha !== request.revision
    || run?.status !== "waiting"
    || run?.conclusion !== null
    || build?.status !== "completed"
    || build?.conclusion !== "success"
    || promotion?.status !== "waiting"
    || promotion?.conclusion !== null
  ) {
    throw new Error("macOS candidate source is not the successful protected build awaiting promotion");
  }
  return {
    artifactId: request.artifactId,
    buildAccepted: true,
    promotionBlocked: true,
    revision: request.revision,
    runId: request.runId,
    version: request.version,
  };
}

function githubJson(endpoint) {
  return JSON.parse(execFileSync("gh", ["api", endpoint], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  }));
}

function main() {
  const [repository, runId, artifactId, version, revision] = process.argv.slice(2);
  const request = validateMacosCandidateAdmissionRequest({
    artifactId,
    repository,
    revision,
    runId,
    sourceRef: process.env.GITHUB_REF,
    version,
  });
  const evidence = validateMacosCandidateAdmissionSource({
    artifact: githubJson(`repos/${repository}/actions/artifacts/${request.artifactId}`),
    jobs: githubJson(`repos/${repository}/actions/runs/${request.runId}/jobs?filter=latest&per_page=100`),
    run: githubJson(`repos/${repository}/actions/runs/${request.runId}`),
  }, request);
  process.stdout.write(`${JSON.stringify(evidence)}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`macOS candidate source verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
