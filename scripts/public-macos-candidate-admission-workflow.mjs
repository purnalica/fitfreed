import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  publicReleaseActionPins,
  requireWorkflowMatch,
  requireWorkflowOrder,
  requireWorkflowPermissions,
  workflowSection,
} from "./public-release-workflow.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const workflowPath = ".github/workflows/public-macos-candidate-admission.yml";

export function validatePublicMacosCandidateAdmissionWorkflow(source) {
  const errors = [];
  const trigger = source.slice(source.indexOf("on:\n"), source.indexOf("\npermissions:\n"));
  requireWorkflowMatch(
    errors,
    trigger,
    /^on:\n  workflow_dispatch:\n/m,
    "candidate admission workflow must be manually dispatched",
  );
  if (/^  (push|pull_request|pull_request_target|release|schedule):/m.test(trigger)) {
    errors.push("candidate admission workflow has an automatic or untrusted trigger");
  }
  requireWorkflowPermissions(errors, source, 0, ["contents: read"], "workflow default");
  requireWorkflowMatch(
    errors,
    source,
    /concurrency:\n  group: fitfreed-public-macos-admission-\$\{\{ inputs\.version \}\}-\$\{\{ inputs\.revision \}\}\n  cancel-in-progress: false/,
    "candidate admission workflow must serialize one exact candidate without cancellation",
  );
  if (/continue-on-error:|self-hosted|pull_request_target|\$\{\{\s*(secrets|vars)\.|environment:/.test(source)) {
    errors.push("candidate admission workflow contains protected authority or a forbidden failure boundary");
  }

  const uses = [...source.matchAll(/^\s+uses:\s+([^@\s]+)@([0-9a-f]+)(?:\s+#.*)?$/gm)];
  if (uses.length !== 3) errors.push("candidate admission workflow must use exactly three reviewed actions");
  for (const [, action, revision] of uses) {
    if (revision.length !== 40 || publicReleaseActionPins.get(action) !== revision) {
      errors.push(`${action} uses an unpinned or unreviewed revision`);
    }
  }
  if ([...source.matchAll(/^\s+uses:/gm)].length !== uses.length) {
    errors.push("candidate admission workflow contains an unpinned or malformed action");
  }

  const admission = workflowSection(source, "admit-candidate");
  requireWorkflowPermissions(
    errors,
    admission,
    4,
    ["actions: read", "contents: read"],
    "candidate admission job",
  );
  requireWorkflowMatch(
    errors,
    admission,
    /runs-on: macos-15/,
    "candidate admission must use the maintained Apple Silicon runner",
  );
  requireWorkflowMatch(
    errors,
    admission,
    /timeout-minutes: 15/,
    "candidate admission must remain bounded",
  );
  requireWorkflowOrder(errors, admission, [
    "Verify the originating protected candidate",
    "Download only that sealed candidate artifact",
    "Reopen the digest-bound candidate",
    "Admit the installed candidate",
  ]);
  requireWorkflowMatch(
    errors,
    admission,
    /verify:macos-public-candidate-source/,
    "candidate admission must authenticate the originating protected build",
  );
  requireWorkflowMatch(
    errors,
    admission,
    /artifact-ids: \$\{\{ inputs\.artifact_id \}\}/,
    "candidate admission must download one exact artifact ID",
  );
  requireWorkflowMatch(
    errors,
    admission,
    /run-id: \$\{\{ inputs\.build_run_id \}\}/,
    "candidate admission must bind the artifact to its build run",
  );
  requireWorkflowMatch(
    errors,
    admission,
    /digest-mismatch: error/,
    "candidate admission must reject a GitHub artifact digest mismatch",
  );
  requireWorkflowMatch(
    errors,
    admission,
    /unpack:public-release/,
    "candidate admission must reopen the transport digest and complete manifest",
  );
  requireWorkflowMatch(
    errors,
    admission,
    /verify:macos-public-candidate --/,
    "candidate admission must execute native admission against the reopened bytes",
  );
  if (/\b(contents|pages|id-token|attestations|artifact-metadata): write\b/.test(admission)) {
    errors.push("candidate admission job permissions include publication authority");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    actionReferenceCount: uses.length,
    candidateBoundary: "downloaded-sealed-public-macos-candidate",
    publicationAuthority: false,
    trigger: "workflow_dispatch",
  };
}

export function inspectPublicMacosCandidateAdmissionWorkflow(root = repositoryRoot) {
  return validatePublicMacosCandidateAdmissionWorkflow(
    readFileSync(path.join(root, workflowPath), "utf8"),
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(inspectPublicMacosCandidateAdmissionWorkflow())}\n`);
  } catch (error) {
    process.stderr.write(`Public macOS candidate admission workflow check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
