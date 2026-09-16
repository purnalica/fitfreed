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
  if (/certificate|signpath|signing_policy|artifact_configuration/i.test(trigger)) {
    errors.push("Windows native trust cannot be selected through workflow dispatch");
  }
  requireWorkflowMatch(
    errors,
    source,
    /concurrency:\n  group: fitfreed-pages-publication\n  cancel-in-progress: false/,
    "Windows expansion concurrency must serialize publication without cancellation",
  );
  requireWorkflowPermissions(errors, source, 0, ["contents: read"], "workflow default");
  if (/continue-on-error:|pull_request_target|self-hosted/.test(source)) {
    errors.push("Windows expansion workflow contains a forbidden failure or runner boundary");
  }
  if (/signpath|FITFREED_WINDOWS_CERTIFICATE|public-windows-release|public-windows-product-acceptance/i.test(source)) {
    errors.push("Windows preview workflow retains retired signing or protected Windows authority");
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
  requireWorkflowMatch(errors, linuxInput, /npm run audit:dependencies/, "Linux input must audit production dependencies");
  requireWorkflowMatch(errors, linuxInput, /pack:linux-expansion-input/, "Linux input transport command is unavailable");
  requireNoProtectedValues(errors, linuxInput, "Linux input");

  const windowsInput = workflowSection(source, "build-windows-input");
  requireWorkflowPermissions(errors, windowsInput, 4, ["contents: read"], "Windows input build");
  requireWorkflowMatch(errors, windowsInput, /needs: preflight/, "Windows input must follow preflight");
  requireWorkflowMatch(errors, windowsInput, /runs-on: windows-2025/, "Windows input must use hosted Windows");
  requireWorkflowMatch(
    errors,
    windowsInput,
    /outputs:[\s\S]*windows-input-sha256:[\s\S]*windows-input-trust-profile:/,
    "Windows input must expose its sealed digest and trust profile",
  );
  requireWorkflowMatch(errors, windowsInput, /npm run audit:dependencies/, "Windows input must audit production dependencies");
  requireWorkflowMatch(
    errors,
    windowsInput,
    /prepare:windows-unsigned-preview-input --/,
    "Windows input must use the explicit unsigned preview profile",
  );
  requireWorkflowMatch(
    errors,
    windowsInput,
    /pack:windows-expansion-input --[\s\S]*public-unsigned-preview/,
    "Windows input transport must bind the unsigned preview profile",
  );
  requireWorkflowOrder(errors, windowsInput, [
    "Audit production dependencies",
    "Prepare the exact unsigned Windows preview input",
    "Seal the exact Windows input for protected composition",
    "Retain only the sealed Windows preview input",
  ]);
  requireNoProtectedValues(errors, windowsInput, "Windows input");
  if (/^    environment:/m.test(windowsInput)) {
    errors.push("unsigned Windows input cannot use a protected signing environment");
  }

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
  requireWorkflowMatch(errors, build, /environment: public-macos-release/, "complete-platform composition must use protected release authority");
  requireWorkflowMatch(errors, build, /needs\.build-windows-input\.outputs\.windows-input-sha256/, "composition must verify the Windows input digest");
  requireWorkflowMatch(errors, build, /needs\.build-linux-input\.outputs\.linux-input-sha256/, "composition must verify the Linux input digest");
  requireWorkflowMatch(
    errors,
    build,
    /unpack:windows-expansion-input --[\s\S]*public-unsigned-preview/,
    "composition must reopen the unsigned Windows input profile",
  );
  requireWorkflowMatch(
    errors,
    build,
    /prepare:complete-platform-release --[\s\S]*public-unsigned-preview/,
    "composition must create manifest version 8 through the unsigned preview profile",
  );
  requireWorkflowOrder(errors, build, [
    "Repeat the secret-free Windows expansion preflight after approval",
    "Require immutable GitHub Releases",
    "Download the authenticated predecessor release evidence",
    "Verify and reopen the exact native Linux input",
    "Verify and reopen the exact native Windows preview input",
    "Install ephemeral Apple, updater, and checksum release authority",
    "Build and verify the signed complete-platform candidate",
    "Reopen the complete local candidate",
    "Seal the complete candidate for independent admission and promotion",
    "Retain the sealed complete-platform candidate for admission",
    "Remove ephemeral release authority",
  ]);
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
  requireWorkflowMatch(
    errors,
    linuxAdmission,
    /at-spi2-core \\\n            dbus-daemon \\\n            fluxbox \\\n            sqlite3 \\\n            x11-utils \\\n            xauth \\\n            xvfb/,
    "Linux admission must install the bounded Ubuntu Desktop session tools",
  );
  if ([...linuxAdmission.matchAll(/WEBKIT_DISABLE_COMPOSITING_MODE: "1"/g)].length !== 2) {
    errors.push("both graphical Linux admission gates must use the hosted software-rendering boundary");
  }
  if ([...linuxAdmission.matchAll(/xvfb-run -a dbus-run-session --\n          scripts\/run-linux-desktop-session\.sh/g)].length !== 2) {
    errors.push("both graphical Linux admission gates must establish a bounded desktop session");
  }
  requireWorkflowMatch(errors, linuxAdmission, /verify:linux-candidate-installation/, "Linux admission must install the exact candidate");
  requireNoProtectedValues(errors, linuxAdmission, "Linux admission");

  const windowsAdmission = workflowSection(source, "admit-windows-candidate");
  requireWorkflowPermissions(
    errors,
    windowsAdmission,
    4,
    ["actions: read", "contents: read"],
    "hosted Windows candidate admission",
  );
  requireWorkflowMatch(errors, windowsAdmission, /needs: build-candidate/, "Windows admission must follow composition");
  requireWorkflowMatch(errors, windowsAdmission, /runs-on: windows-2025/, "Windows admission must use hosted Windows");
  requireWorkflowMatch(errors, windowsAdmission, /needs\.build-candidate\.outputs\.candidate-sha256/, "Windows admission must verify the sealed candidate digest");
  requireWorkflowOrder(errors, windowsAdmission, [
    "Download only the sealed complete candidate from this workflow run",
    "Verify and reopen the exact complete candidate",
    "Install, cold launch, preserve data, and remove the exact preview package",
    "Remove residual Windows candidate state after admission",
  ]);
  requireWorkflowMatch(errors, windowsAdmission, /verify:windows-cold-launch/, "Windows admission must launch the exact candidate package");
  requireWorkflowMatch(
    errors,
    windowsAdmission,
    /- name: Remove residual Windows candidate state after admission\n        if: always\(\)/,
    "Windows candidate cleanup must always execute",
  );
  requireWorkflowMatch(errors, windowsAdmission, /-Action remove/, "Windows cleanup must remove only owned package state");
  requireNoProtectedValues(errors, windowsAdmission, "Windows admission");
  if (/^    environment:/m.test(windowsAdmission)) {
    errors.push("Windows admission cannot use a protected release environment");
  }
  if (/verify:windows-e2e|verify:windows-update-e2e|verify:windows-filesystem-reliability|benchmark:(import|dense-history|insights)/.test(windowsAdmission)) {
    errors.push("Windows candidate admission repeats unrelated accepted product campaigns");
  }

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
    /needs: \[build-candidate, admit-linux-candidate, admit-windows-candidate\]/,
    "candidate promotion must follow every native admission",
  );
  requireWorkflowMatch(errors, publish, /environment: public-macos-release/, "candidate promotion must require protected release approval");
  requireNoProtectedValues(errors, publish, "candidate promotion");
  requireWorkflowOrder(errors, publish, [
    "Download only the admitted sealed complete candidate",
    "Verify and reopen the independently admitted complete candidate",
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
    protectedEnvironments: ["public-macos-release", "public-macos-release"],
    publicationOrder: "native-admission-before-release-before-pages",
    trigger: "workflow_dispatch",
    windowsRunners: ["windows-2025"],
    windowsTrustProfile: "public-unsigned-preview",
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
