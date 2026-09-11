import assert from "node:assert/strict";
import test from "node:test";

import {
  validateMacosCandidateAdmissionRequest,
  validateMacosCandidateAdmissionSource,
} from "./public-macos-candidate-admission-source.mjs";

const revision = "a".repeat(40);

function sourceEvidence() {
  return {
    artifact: {
      expired: false,
      id: 1234,
      name: `public-macos-candidate-0.1.7-${revision}`,
      size_in_bytes: 42,
      workflow_run: { head_sha: revision, id: 5678 },
    },
    jobs: {
      jobs: [
        { conclusion: "success", name: "Build the protected candidate", status: "completed" },
        { conclusion: null, name: "Promote the independently accepted candidate", status: "waiting" },
      ],
    },
    run: {
      conclusion: null,
      event: "workflow_dispatch",
      head_branch: "v0.1.7",
      head_sha: revision,
      id: 5678,
      path: ".github/workflows/public-release.yml",
      repository: { full_name: "purnalica/fitfreed" },
      status: "waiting",
    },
  };
}

test("accepts one closed request for an existing candidate artifact", () => {
  assert.deepEqual(validateMacosCandidateAdmissionRequest({
    artifactId: "1234",
    repository: "purnalica/fitfreed",
    revision,
    runId: "5678",
    version: "0.1.7",
  }), {
    artifactId: 1234,
    repository: "purnalica/fitfreed",
    revision,
    runId: 5678,
    version: "0.1.7",
  });
  for (const mutate of [
    (value) => ({ ...value, artifactId: "0" }),
    (value) => ({ ...value, repository: "fork/fitfreed" }),
    (value) => ({ ...value, revision: "not-a-revision" }),
    (value) => ({ ...value, runId: "5.5" }),
    (value) => ({ ...value, sourceRef: "refs/tags/v0.1.7" }),
    (value) => ({ ...value, version: "v0.1.7" }),
  ]) {
    assert.throws(
      () => validateMacosCandidateAdmissionRequest(mutate({
        artifactId: "1234",
        repository: "purnalica/fitfreed",
        revision,
        runId: "5678",
        version: "0.1.7",
      })),
      /admission request/,
    );
  }
});

test("binds the artifact to the successful protected build and still-blocked promotion", () => {
  const request = validateMacosCandidateAdmissionRequest({
    artifactId: "1234",
    repository: "purnalica/fitfreed",
    revision,
    runId: "5678",
    version: "0.1.7",
  });
  assert.deepEqual(validateMacosCandidateAdmissionSource(sourceEvidence(), request), {
    artifactId: 1234,
    buildAccepted: true,
    promotionBlocked: true,
    revision,
    runId: 5678,
    version: "0.1.7",
  });
  for (const mutate of [
    (value) => ({ ...value, artifact: { ...value.artifact, expired: true } }),
    (value) => ({ ...value, artifact: { ...value.artifact, name: "other" } }),
    (value) => ({ ...value, run: { ...value.run, head_branch: "main" } }),
    (value) => ({ ...value, run: { ...value.run, path: ".github/workflows/ci.yml" } }),
    (value) => ({ ...value, jobs: { jobs: value.jobs.jobs.map((job) => job.name === "Build the protected candidate" ? { ...job, conclusion: "failure" } : job) } }),
    (value) => ({ ...value, jobs: { jobs: value.jobs.jobs.map((job) => job.name === "Promote the independently accepted candidate" ? { ...job, status: "completed", conclusion: "success" } : job) } }),
  ]) {
    assert.throws(
      () => validateMacosCandidateAdmissionSource(mutate(sourceEvidence()), request),
      /candidate source/,
    );
  }
});
