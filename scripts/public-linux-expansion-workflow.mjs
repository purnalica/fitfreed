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

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = ".github/workflows/public-linux-expansion.yml";

function validatePinnedActions(source, errors) {
  const uses = [...source.matchAll(/^\s+uses:\s+([^@\s]+)@([0-9a-f]+)(?:\s+#.*)?$/gm)];
  if (uses.length < 1) errors.push("platform-expansion workflow has no pinned actions");
  for (const [, action, revision] of uses) {
    if (revision.length !== 40) errors.push(`${action} is not pinned to a full commit`);
    if (publicReleaseActionPins.get(action) !== revision) {
      errors.push(`${action} uses an unreviewed revision`);
    }
  }
  if ([...source.matchAll(/^\s+uses:/gm)].length !== uses.length) {
    errors.push("platform-expansion workflow contains an unpinned or malformed action");
  }
  return uses.length;
}

export function validatePublicLinuxExpansionWorkflow(source) {
  const errors = [];
  const trigger = source.slice(source.indexOf("on:\n"), source.indexOf("\npermissions:\n"));
  requireWorkflowMatch(
    errors,
    trigger,
    /^on:\n  workflow_dispatch:\n/m,
    "platform-expansion workflow must be manually dispatched",
  );
  if (/^  (push|pull_request|pull_request_target|release|schedule):/m.test(trigger)) {
    errors.push("platform-expansion workflow has an automatic or untrusted trigger");
  }
  requireWorkflowMatch(
    errors,
    source,
    /concurrency:\n  group: fitfreed-pages-publication\n  cancel-in-progress: false/,
    "platform-expansion concurrency must serialize publication without cancellation",
  );
  requireWorkflowPermissions(errors, source, 0, ["contents: read"], "workflow default");
  if (/continue-on-error:|self-hosted|pull_request_target/.test(source)) {
    errors.push("platform-expansion workflow contains a forbidden failure or runner boundary");
  }
  const actionReferenceCount = validatePinnedActions(source, errors);

  const preflight = workflowSection(source, "preflight");
  requireWorkflowPermissions(
    errors,
    preflight,
    4,
    ["actions: read", "contents: read", "pages: read"],
    "expansion preflight",
  );
  requireWorkflowMatch(errors, preflight, /runs-on: ubuntu-latest/, "preflight must use hosted Linux");
  requireWorkflowMatch(
    errors,
    preflight,
    /preflight:linux-expansion/,
    "expansion preflight command is unavailable",
  );

  const linuxInput = workflowSection(source, "build-linux-input");
  requireWorkflowPermissions(errors, linuxInput, 4, ["contents: read"], "Linux input build");
  requireWorkflowMatch(errors, linuxInput, /needs: preflight/, "Linux input must follow preflight");
  requireWorkflowMatch(errors, linuxInput, /runs-on: ubuntu-24\.04/, "Linux input must use Ubuntu 24.04");
  requireWorkflowMatch(
    errors,
    linuxInput,
    /outputs:\n      linux-input-sha256:/,
    "Linux input must expose its sealed digest",
  );
  requireWorkflowOrder(errors, linuxInput, [
    "Prepare the exact clean-installed Linux input",
    "Seal the exact Linux input for protected composition",
    "Retain only the sealed Linux input",
  ]);
  requireWorkflowMatch(
    errors,
    linuxInput,
    /pack:linux-expansion-input/,
    "Linux input transport command is unavailable",
  );
  requireWorkflowMatch(
    errors,
    linuxInput,
    /uses: actions\/upload-artifact@/,
    "sealed Linux input is not retained",
  );
  if (
    /\$\{\{\s*(secrets|vars)\./.test(preflight)
    || /\$\{\{\s*(secrets|vars)\./.test(linuxInput)
    || /environment: public-macos-release/.test(linuxInput)
  ) {
    errors.push("preflight or Linux input cannot receive protected release authority");
  }

  const build = workflowSection(source, "build-candidate");
  requireWorkflowPermissions(
    errors,
    build,
    4,
    ["actions: read", "contents: read", "pages: read"],
    "protected expansion composition",
  );
  requireWorkflowMatch(
    errors,
    build,
    /needs: \[preflight, build-linux-input\]/,
    "protected composition must depend on preflight and Linux input",
  );
  requireWorkflowMatch(errors, build, /runs-on: macos-15/, "protected composition must use macOS");
  requireWorkflowMatch(
    errors,
    build,
    /environment: public-macos-release/,
    "protected composition must use the release environment",
  );
  requireWorkflowMatch(
    errors,
    build,
    /needs\.build-linux-input\.outputs\.linux-input-sha256/,
    "protected composition must verify the Linux input digest",
  );
  requireWorkflowOrder(errors, build, [
    "Repeat the secret-free expansion preflight after approval",
    "Require immutable GitHub Releases",
    "Download only the sealed native Linux input",
    "Verify and reopen the exact native Linux input",
    "Install ephemeral Apple, updater, and checksum release authority",
    "Build and verify the signed notarized complete-platform candidate",
    "Reopen the complete local candidate",
    "Seal the complete candidate for independent evaluation and promotion",
    "Retain the sealed complete-platform candidate for evaluation",
    "Remove ephemeral release authority",
  ]);
  requireWorkflowMatch(
    errors,
    build,
    /- name: Remove ephemeral release authority\n        if: always\(\)/,
    "release authority cleanup must always execute",
  );

  const publish = workflowSection(source, "publish-candidate");
  requireWorkflowPermissions(errors, publish, 4, [
    "actions: read",
    "artifact-metadata: write",
    "attestations: write",
    "contents: write",
    "id-token: write",
    "pages: read",
  ], "complete candidate promotion");
  requireWorkflowMatch(
    errors,
    publish,
    /needs: build-candidate/,
    "candidate promotion must follow protected composition",
  );
  requireWorkflowMatch(errors, publish, /runs-on: macos-15/, "candidate promotion must use macOS");
  requireWorkflowMatch(
    errors,
    publish,
    /environment: public-macos-release/,
    "candidate promotion must require a second protected approval",
  );
  requireWorkflowMatch(
    errors,
    publish,
    /needs\.build-candidate\.outputs\.candidate-sha256/,
    "candidate promotion must verify the sealed digest",
  );
  requireWorkflowOrder(errors, publish, [
    "Download only the sealed complete candidate from this workflow run",
    "Verify and reopen the independently accepted complete candidate",
    "Reopen the complete accepted candidate",
    "Attest every checksum-bound public asset",
    "Attest the final checksum inventory",
    "Attest the detached checksum signature",
    "Upload the exact complete-platform Pages deployment artifact",
    "Publish the immutable complete-platform GitHub Release",
  ]);
  requireWorkflowMatch(
    errors,
    publish,
    /- name: Attest the detached checksum signature[\s\S]*?subject-path: \.artifacts\/accepted-public-release\/\$\{\{ inputs\.version \}\}\/release\/SHA256SUMS\.minisig/,
    "detached checksum signature has no source-bound attestation",
  );
  if (/\$\{\{\s*(secrets|vars)\./.test(publish)) {
    errors.push("candidate promotion cannot receive signing or notarization authority");
  }

  const deploy = workflowSection(source, "deploy-pages");
  requireWorkflowPermissions(
    errors,
    deploy,
    4,
    ["contents: read", "id-token: write", "pages: write"],
    "Pages deployment",
  );
  requireWorkflowMatch(errors, deploy, /needs: publish-candidate/, "Pages must follow publication");
  requireWorkflowMatch(errors, deploy, /name: github-pages/, "Pages environment is unavailable");

  const verify = workflowSection(source, "verify-publication");
  requireWorkflowPermissions(
    errors,
    verify,
    4,
    ["artifact-metadata: read", "attestations: read", "contents: read"],
    "remote expansion verification",
  );
  requireWorkflowMatch(errors, verify, /needs: deploy-pages/, "remote verification must follow Pages");
  requireWorkflowMatch(
    errors,
    verify,
    /verify:remote-public-release/,
    "remote complete-platform verification is unavailable",
  );
  if (/\$\{\{\s*secrets\./.test(deploy) || /\$\{\{\s*secrets\./.test(verify)) {
    errors.push("deployment and remote verification cannot receive release secrets");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    workflow: workflowPath,
    trigger: "workflow_dispatch",
    protectedEnvironment: "public-macos-release",
    approvalBoundaries: 2,
    nativeInputTarget: "linux-x86_64-deb",
    actionReferenceCount,
    publicationOrder: "complete-platform-candidate-before-release-before-pages",
  };
}

export function inspectPublicLinuxExpansionWorkflow(root = repositoryRoot) {
  return validatePublicLinuxExpansionWorkflow(
    readFileSync(path.join(root, workflowPath), "utf8"),
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(inspectPublicLinuxExpansionWorkflow())}\n`);
  } catch (error) {
    process.stderr.write(`Public platform-expansion workflow check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
