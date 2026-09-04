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
const workflowPath = ".github/workflows/public-windows-expansion.yml";

function validatePinnedActions(source, errors) {
  const uses = [...source.matchAll(/^\s+uses:\s+([^@\s]+)@([0-9a-f]+)(?:\s+#.*)?$/gm)];
  if (uses.length < 1) errors.push("Windows expansion workflow has no pinned actions");
  for (const [, action, revision] of uses) {
    if (revision.length !== 40) errors.push(`${action} is not pinned to a full commit`);
    if (publicReleaseActionPins.get(action) !== revision) {
      errors.push(`${action} uses an unreviewed revision`);
    }
  }
  if ([...source.matchAll(/^\s+uses:/gm)].length !== uses.length) {
    errors.push("Windows expansion workflow contains an unpinned or malformed action");
  }
  return uses.length;
}

function requireNoProtectedValues(errors, section, label) {
  if (/\$\{\{\s*(secrets|vars)\./.test(section)) {
    errors.push(`${label} cannot receive protected release authority`);
  }
}

export function validatePublicWindowsExpansionWorkflow(source) {
  const errors = [];
  const trigger = source.slice(source.indexOf("on:\n"), source.indexOf("\npermissions:\n"));
  requireWorkflowMatch(
    errors,
    trigger,
    /^on:\n  workflow_dispatch:\n/m,
    "Windows expansion workflow must be manually dispatched",
  );
  if (/^  (push|pull_request|pull_request_target|release|schedule):/m.test(trigger)) {
    errors.push("Windows expansion workflow has an automatic or untrusted trigger");
  }
  if (/windows_certificate_sha256/.test(trigger)) {
    errors.push("Windows certificate authority cannot be selected through workflow dispatch");
  }
  requireWorkflowMatch(
    errors,
    source,
    /concurrency:\n  group: fitfreed-pages-publication\n  cancel-in-progress: false/,
    "Windows expansion concurrency must serialize publication without cancellation",
  );
  requireWorkflowPermissions(errors, source, 0, ["contents: read"], "workflow default");
  if (/continue-on-error:|pull_request_target/.test(source)) {
    errors.push("Windows expansion workflow contains a forbidden failure boundary");
  }
  const actionReferenceCount = validatePinnedActions(source, errors);

  const preflight = workflowSection(source, "preflight");
  requireWorkflowPermissions(
    errors,
    preflight,
    4,
    ["actions: read", "contents: read", "pages: read"],
    "Windows expansion preflight",
  );
  requireWorkflowMatch(errors, preflight, /runs-on: ubuntu-latest/, "preflight must use hosted Linux");
  requireWorkflowMatch(errors, preflight, /preflight:windows-expansion/, "Windows preflight command is unavailable");
  requireNoProtectedValues(errors, preflight, "preflight");

  const linuxInput = workflowSection(source, "build-linux-input");
  requireWorkflowPermissions(errors, linuxInput, 4, ["contents: read"], "Linux input build");
  requireWorkflowMatch(errors, linuxInput, /needs: preflight/, "Linux input must follow preflight");
  requireWorkflowMatch(errors, linuxInput, /runs-on: ubuntu-24\.04/, "Linux input must use Ubuntu 24.04");
  requireWorkflowMatch(errors, linuxInput, /pack:linux-expansion-input/, "Linux input transport command is unavailable");
  requireNoProtectedValues(errors, linuxInput, "Linux input");

  const windowsInput = workflowSection(source, "build-windows-input");
  requireWorkflowPermissions(errors, windowsInput, 4, ["contents: read"], "Windows input build");
  requireWorkflowMatch(errors, windowsInput, /needs: preflight/, "Windows input must follow preflight");
  requireWorkflowMatch(
    errors,
    windowsInput,
    /runs-on: \[self-hosted, Windows, X64, fitfreed-windows-11-builder\]/,
    "Windows input runner must be the reviewed disposable Windows 11 builder",
  );
  requireWorkflowMatch(
    errors,
    windowsInput,
    /environment: public-windows-release/,
    "Windows input must use the protected Windows release environment",
  );
  requireWorkflowMatch(
    errors,
    windowsInput,
    /FITFREED_WINDOWS_CERTIFICATE_SHA256: \$\{\{ vars\.FITFREED_WINDOWS_CERTIFICATE_SHA256 \}\}/,
    "Windows input must use the protected certificate fingerprint",
  );
  requireWorkflowMatch(
    errors,
    windowsInput,
    /outputs:\n      windows-input-sha256:/,
    "Windows input must expose its sealed digest",
  );
  requireWorkflowOrder(errors, windowsInput, [
    "Install ephemeral Windows Authenticode authority",
    "Prepare the exact signed Windows input",
    "Seal the exact Windows input for protected composition",
    "Retain only the sealed Windows input",
    "Remove ephemeral Windows Authenticode authority",
  ]);
  requireWorkflowMatch(
    errors,
    windowsInput,
    /- name: Remove ephemeral Windows Authenticode authority\n        if: always\(\)/,
    "Windows authority cleanup must always execute",
  );

  const build = workflowSection(source, "build-candidate");
  requireWorkflowPermissions(
    errors,
    build,
    4,
    ["actions: read", "contents: read", "pages: read"],
    "protected complete-platform composition",
  );
  requireWorkflowMatch(
    errors,
    build,
    /needs: \[preflight, build-linux-input, build-windows-input\]/,
    "complete-platform composition must depend on both native inputs",
  );
  requireWorkflowMatch(errors, build, /runs-on: macos-15/, "complete-platform composition must use macOS");
  requireWorkflowMatch(errors, build, /environment: public-macos-release/, "complete-platform composition must use the macOS release environment");
  requireWorkflowMatch(
    errors,
    build,
    /needs\.build-windows-input\.outputs\.windows-input-sha256/,
    "complete-platform composition must verify the Windows input digest",
  );
  requireWorkflowMatch(
    errors,
    build,
    /needs\.build-linux-input\.outputs\.linux-input-sha256/,
    "complete-platform composition must verify the Linux input digest",
  );
  requireWorkflowOrder(errors, build, [
    "Repeat the secret-free Windows expansion preflight after approval",
    "Require immutable GitHub Releases",
    "Download the authenticated predecessor release evidence",
    "Download only the sealed native Linux input",
    "Verify and reopen the exact native Linux input",
    "Download only the sealed native Windows input",
    "Verify and reopen the exact native Windows input",
    "Install ephemeral Apple, updater, and checksum release authority",
    "Build and verify the signed complete-platform candidate",
    "Reopen the complete local candidate",
    "Seal the complete candidate for independent evaluation and promotion",
    "Retain the sealed complete-platform candidate for evaluation",
    "Remove ephemeral release authority",
  ]);
  requireWorkflowMatch(errors, build, /prepare:complete-platform-release/, "complete-platform preparation command is unavailable");
  requireWorkflowMatch(
    errors,
    build,
    /- name: Remove ephemeral release authority\n        if: always\(\)/,
    "complete-platform authority cleanup must always execute",
  );

  const linuxAdmission = workflowSection(source, "admit-linux-candidate");
  requireWorkflowPermissions(
    errors,
    linuxAdmission,
    4,
    ["actions: read", "contents: read"],
    "exact Linux candidate admission",
  );
  requireWorkflowMatch(errors, linuxAdmission, /needs: build-candidate/, "Linux admission must follow composition");
  requireWorkflowMatch(errors, linuxAdmission, /fail-fast: false/, "Linux admission must execute every row");
  requireWorkflowMatch(
    errors,
    linuxAdmission,
    /matrix:\n        ubuntu-version:\n          - "24\.04"\n          - "26\.04"\n    runs-on:/,
    "Linux admission must use Ubuntu 24.04 and 26.04",
  );
  requireNoProtectedValues(errors, linuxAdmission, "Linux admission");

  const windowsAdmission = workflowSection(source, "admit-windows-candidate");
  requireWorkflowPermissions(
    errors,
    windowsAdmission,
    4,
    ["actions: read", "contents: read"],
    "exact Windows candidate admission",
  );
  requireWorkflowMatch(errors, windowsAdmission, /needs: build-candidate/, "Windows admission must follow composition");
  requireWorkflowMatch(
    errors,
    windowsAdmission,
    /runs-on: \[self-hosted, Windows, X64, fitfreed-windows-11-admission\]/,
    "Windows admission runner must be the reviewed clean Windows 11 host",
  );
  requireWorkflowMatch(
    errors,
    windowsAdmission,
    /needs\.build-candidate\.outputs\.candidate-sha256/,
    "Windows admission must verify the sealed candidate digest",
  );
  requireWorkflowMatch(
    errors,
    windowsAdmission,
    /needs\.build-candidate\.outputs\.windows-certificate-sha256/,
    "Windows admission must use the certificate fingerprint bound by the native input",
  );
  requireWorkflowOrder(errors, windowsAdmission, [
    "Download only the sealed complete candidate from this workflow run",
    "Verify and reopen the exact complete candidate",
    "Reopen the complete candidate before native admission",
    "Verify exact Windows candidate installation and cold launch",
    "Verify packaged Windows capability and accessibility",
    "Verify native Windows update recovery",
    "Verify Windows filesystem recovery",
    "Verify Windows data performance budgets",
    "Remove residual Windows candidate state after admission",
  ]);
  requireWorkflowMatch(errors, windowsAdmission, /verify:windows-candidate-admission/, "exact Windows candidate admission command is unavailable");
  requireWorkflowMatch(errors, windowsAdmission, /verify:windows-update-e2e/, "Windows admission lacks update recovery");
  requireWorkflowMatch(errors, windowsAdmission, /verify:windows-filesystem-reliability/, "Windows admission lacks filesystem recovery");
  requireWorkflowMatch(
    errors,
    windowsAdmission,
    /- name: Remove residual Windows candidate state after admission\n        if: always\(\)/,
    "Windows candidate cleanup must always execute",
  );
  requireWorkflowMatch(
    errors,
    windowsAdmission,
    /-File scripts\/run-installed-windows-package\.ps1\n          -Action remove/,
    "Windows candidate cleanup must remove only the owned candidate state",
  );
  requireNoProtectedValues(errors, windowsAdmission, "Windows admission");
  if (/^    environment:/m.test(windowsAdmission)) {
    errors.push("Windows admission cannot use a protected release environment");
  }

  const acceptance = workflowSection(source, "accept-product-experience");
  requireWorkflowPermissions(errors, acceptance, 4, ["actions: read", "contents: read"], "product-owner acceptance");
  requireWorkflowMatch(
    errors,
    acceptance,
    /needs: \[build-candidate, admit-linux-candidate, admit-windows-candidate\]/,
    "product-owner gate must follow every technical admission",
  );
  requireWorkflowMatch(
    errors,
    acceptance,
    /environment: public-windows-product-acceptance/,
    "product-owner gate must use its distinct protected product-owner environment",
  );
  requireWorkflowMatch(errors, acceptance, /verify:public-release/, "product-owner gate must reopen the exact candidate");
  requireNoProtectedValues(errors, acceptance, "product-owner acceptance");

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
    /needs: \[build-candidate, accept-product-experience\]/,
    "candidate promotion must follow technical and product-owner acceptance",
  );
  requireWorkflowMatch(errors, publish, /environment: public-macos-release/, "candidate promotion must require a separate release approval");
  requireNoProtectedValues(errors, publish, "candidate promotion");
  requireWorkflowOrder(errors, publish, [
    "Download only the accepted sealed complete candidate",
    "Verify and reopen the independently accepted complete candidate",
    "Reopen the complete accepted candidate",
    "Attest every checksum-bound public asset",
    "Attest the final checksum inventory",
    "Attest the detached checksum signature",
    "Upload the exact complete-platform Pages deployment artifact",
    "Publish the immutable complete-platform GitHub Release",
  ]);

  const deploy = workflowSection(source, "deploy-pages");
  requireWorkflowPermissions(errors, deploy, 4, ["contents: read", "id-token: write", "pages: write"], "Pages deployment");
  requireWorkflowMatch(errors, deploy, /needs: publish-candidate/, "Pages must follow publication");
  requireWorkflowMatch(errors, deploy, /name: github-pages/, "Pages environment is unavailable");

  const verify = workflowSection(source, "verify-publication");
  requireWorkflowPermissions(errors, verify, 4, ["artifact-metadata: read", "attestations: read", "contents: read"], "remote Windows expansion verification");
  requireWorkflowMatch(errors, verify, /needs: deploy-pages/, "remote verification must follow Pages");
  requireWorkflowMatch(errors, verify, /verify:remote-public-release/, "remote complete-platform verification is unavailable");
  requireNoProtectedValues(errors, verify, "remote verification");

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    actionReferenceCount,
    nativeInputTarget: "windows-x86_64-nsis",
    protectedEnvironments: [
      "public-windows-release",
      "public-macos-release",
      "public-windows-product-acceptance",
      "public-macos-release",
    ],
    publicationOrder: "technical-and-human-acceptance-before-release-before-pages",
    trigger: "workflow_dispatch",
    windowsRunners: [
      "fitfreed-windows-11-builder",
      "fitfreed-windows-11-admission",
    ],
    workflow: workflowPath,
  };
}

export function inspectPublicWindowsExpansionWorkflow(root = repositoryRoot) {
  return validatePublicWindowsExpansionWorkflow(
    readFileSync(path.join(root, workflowPath), "utf8"),
  );
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(inspectPublicWindowsExpansionWorkflow())}\n`);
  } catch (error) {
    process.stderr.write(`Public Windows expansion workflow check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
