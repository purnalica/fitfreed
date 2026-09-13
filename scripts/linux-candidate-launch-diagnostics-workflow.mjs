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
const workflowPath = ".github/workflows/linux-candidate-launch-diagnostics.yml";

export function validateLinuxCandidateLaunchDiagnosticsWorkflow(source) {
  const errors = [];
  const trigger = source.slice(source.indexOf("on:\n"), source.indexOf("\npermissions:\n"));
  requireWorkflowMatch(
    errors,
    trigger,
    /^on:\n  workflow_dispatch:\n/m,
    "Linux launch diagnostics must be manually dispatched",
  );
  if (/^  (push|pull_request|pull_request_target|release|schedule):/m.test(trigger)) {
    errors.push("Linux launch diagnostics has an automatic or untrusted trigger");
  }
  requireWorkflowPermissions(errors, source, 0, ["contents: read"], "workflow default");
  requireWorkflowMatch(
    errors,
    source,
    /concurrency:\n  group: fitfreed-linux-launch-diagnostics-\$\{\{ inputs\.version \}\}-\$\{\{ inputs\.revision \}\}\n  cancel-in-progress: false/,
    "Linux launch diagnostics must serialize one exact candidate without cancellation",
  );
  if (/continue-on-error:|self-hosted|pull_request_target|\$\{\{\s*(secrets|vars)\.|environment:/.test(source)) {
    errors.push("Linux launch diagnostics contains protected authority or a forbidden failure boundary");
  }

  const uses = [...source.matchAll(/^\s+uses:\s+([^@\s]+)@([0-9a-f]+)(?:\s+#.*)?$/gm)];
  if (uses.length !== 3) errors.push("Linux launch diagnostics must use exactly three reviewed actions");
  for (const [, action, revision] of uses) {
    if (revision.length !== 40 || publicReleaseActionPins.get(action) !== revision) {
      errors.push(`${action} uses an unpinned or unreviewed revision`);
    }
  }
  if ([...source.matchAll(/^\s+uses:/gm)].length !== uses.length) {
    errors.push("Linux launch diagnostics contains an unpinned or malformed action");
  }

  const diagnostic = workflowSection(source, "diagnose-candidate");
  requireWorkflowPermissions(
    errors,
    diagnostic,
    4,
    ["actions: read", "contents: read"],
    "Linux launch diagnostic job",
  );
  requireWorkflowMatch(errors, diagnostic, /runs-on: ubuntu-24\.04/, "diagnostics must use Ubuntu 24.04");
  requireWorkflowMatch(errors, diagnostic, /timeout-minutes: 15/, "diagnostics must remain bounded");
  requireWorkflowMatch(
    errors,
    diagnostic,
    /WEBKIT_DISABLE_COMPOSITING_MODE: "1"/,
    "diagnostics must isolate the hosted Xvfb software-compositing boundary",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /at-spi2-core \\\n            dbus-daemon \\\n            fluxbox \\\n            sqlite3 \\\n            x11-utils \\\n            xauth \\\n            xvfb/,
    "diagnostics must install the bounded Ubuntu Desktop session tools",
  );
  requireWorkflowOrder(errors, diagnostic, [
    "Download only the exact sealed candidate artifact",
    "Reopen the digest-bound candidate",
    "Verify the signed exact candidate",
    "Observe one exact Debian first launch",
    "Remove residual candidate package after diagnosis",
  ]);
  requireWorkflowMatch(
    errors,
    diagnostic,
    /artifact-ids: \$\{\{ inputs\.artifact_id \}\}/,
    "diagnostics must download one exact artifact ID",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /run-id: \$\{\{ inputs\.source_run_id \}\}/,
    "diagnostics must bind the artifact to its source run",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /digest-mismatch: error/,
    "diagnostics must reject a GitHub artifact digest mismatch",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /unpack:public-release/,
    "diagnostics must reopen the candidate transport digest",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /verify:public-release/,
    "diagnostics must verify the signed candidate",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /xvfb-run -a dbus-run-session --\n          scripts\/run-linux-desktop-session\.sh/,
    "diagnostics must establish one bounded desktop session",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /npm run diagnose:linux-candidate-launch --/,
    "diagnostics must observe only one exact installed launch",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /"\$FITFREED_REVISION"\n          "24\.04"/,
    "diagnostics must bind the launch to its revision and Ubuntu boundary",
  );
  requireWorkflowMatch(
    errors,
    diagnostic,
    /- name: Remove residual candidate package after diagnosis\n        if: always\(\)/,
    "diagnostic package cleanup must always execute",
  );
  if (/\b(contents|pages|id-token|attestations|artifact-metadata): write\b/.test(diagnostic)) {
    errors.push("Linux launch diagnostics includes publication authority");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    actionReferenceCount: uses.length,
    candidateBoundary: "downloaded-sealed-linux-candidate",
    launchCount: 1,
    publicationAuthority: false,
    runner: "ubuntu-24.04",
    trigger: "workflow_dispatch",
  };
}

export function inspectLinuxCandidateLaunchDiagnosticsWorkflow(root = repositoryRoot) {
  return validateLinuxCandidateLaunchDiagnosticsWorkflow(
    readFileSync(path.join(root, workflowPath), "utf8"),
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(inspectLinuxCandidateLaunchDiagnosticsWorkflow())}\n`);
  } catch (error) {
    process.stderr.write(`Linux candidate launch diagnostic workflow check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
