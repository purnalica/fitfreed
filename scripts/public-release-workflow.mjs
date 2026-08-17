import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = ".github/workflows/public-release.yml";
const actionPins = new Map([
  ["actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1"],
  ["actions/setup-node", "820762786026740c76f36085b0efc47a31fe5020"],
  ["actions/attest", "508db95dd578ae2727ebd6217d5ba78e4fbda05d"],
  ["actions/upload-pages-artifact", "fc324d3547104276b827a68afc52ff2a11cc49c9"],
  ["actions/deploy-pages", "cd2ce8fcbc39b97be8ca5fce6e763baed58fa128"],
]);

function section(source, name) {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && (!/^  [a-zA-Z0-9_-]+:$/.test(lines[end]) || lines[end].startsWith("    "))) {
    end += 1;
  }
  return lines.slice(start, end).join("\n");
}

function requireMatch(errors, source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

function requireOrder(errors, source, markers) {
  let previous = -1;
  for (const marker of markers) {
    const current = source.indexOf(marker);
    if (current < 0 || current <= previous) {
      errors.push(`public release workflow order is invalid at ${marker}`);
      return;
    }
    previous = current;
  }
}

function requirePermissions(errors, source, indentation, expected, label) {
  const prefix = " ".repeat(indentation);
  const entryPrefix = " ".repeat(indentation + 2);
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line === `${prefix}permissions:`);
  if (start < 0) {
    errors.push(`${label} permissions are unavailable`);
    return;
  }
  const actual = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith(entryPrefix) || line.startsWith(`${entryPrefix} `)) break;
    actual.push(line.slice(entryPrefix.length));
  }
  const canonicalActual = [...actual].sort((left, right) => left.localeCompare(right, "en"));
  const canonicalExpected = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(canonicalActual) !== JSON.stringify(canonicalExpected)) {
    errors.push(`${label} permissions exceed or omit the closed set`);
  }
}

export function validatePublicReleaseWorkflow(source) {
  const errors = [];
  const trigger = source.slice(source.indexOf("on:\n"), source.indexOf("\npermissions:\n"));
  requireMatch(errors, trigger, /^on:\n  workflow_dispatch:\n/m, "workflow must be manually dispatched");
  if (/^  (push|pull_request|pull_request_target|release|schedule):/m.test(trigger)) {
    errors.push("workflow has an automatic or untrusted trigger");
  }
  requireMatch(errors, source, /concurrency:\n  group: public-macos-release\n  cancel-in-progress: false/, "workflow concurrency must preserve an active release");
  requirePermissions(errors, source, 0, ["contents: read"], "workflow default");
  if (/continue-on-error:|self-hosted|pull_request_target/.test(source)) {
    errors.push("workflow contains a forbidden failure or runner boundary");
  }

  const uses = [...source.matchAll(/^\s+uses:\s+([^@\s]+)@([0-9a-f]+)(?:\s+#.*)?$/gm)];
  if (uses.length < 1) errors.push("workflow has no pinned actions");
  for (const [, action, revision] of uses) {
    if (revision.length !== 40) errors.push(`${action} is not pinned to a full commit`);
    if (actionPins.get(action) !== revision) errors.push(`${action} uses an unreviewed revision`);
  }
  const usesLineCount = [...source.matchAll(/^\s+uses:/gm)].length;
  if (usesLineCount !== uses.length) errors.push("workflow contains an unpinned or malformed action");

  const preflight = section(source, "preflight");
  requirePermissions(
    errors,
    preflight,
    4,
    ["actions: read", "contents: read", "pages: read"],
    "preflight",
  );
  requireMatch(errors, preflight, /runs-on: ubuntu-latest/, "preflight must use a hosted Linux runner");
  requireMatch(errors, preflight, /actions: read/, "preflight requires read-only Actions evidence");
  requireMatch(errors, preflight, /pages: read/, "preflight requires read-only Pages evidence");
  if (/\$\{\{\s*(secrets|vars)\./.test(preflight) || /environment: public-macos-release/.test(preflight)) {
    errors.push("preflight cannot receive protected release authority");
  }

  const build = section(source, "build-and-publish");
  requirePermissions(errors, build, 4, [
    "actions: read",
    "artifact-metadata: write",
    "attestations: write",
    "contents: write",
    "id-token: write",
    "pages: read",
  ], "protected build");
  requireMatch(errors, build, /needs: preflight/, "protected build must depend on preflight");
  requireMatch(errors, build, /runs-on: macos-15/, "public build must use the maintained macOS runner");
  requireMatch(errors, build, /environment: public-macos-release/, "public build must use the protected environment");
  for (const permission of [
    "actions: read",
    "artifact-metadata: write",
    "attestations: write",
    "contents: write",
    "id-token: write",
    "pages: read",
  ]) {
    requireMatch(errors, build, new RegExp(`^      ${permission}$`, "m"), `protected build lacks ${permission}`);
  }
  requireOrder(errors, build, [
    "Repeat the secret-free preflight after approval",
    "Require immutable GitHub Releases",
    "Install ephemeral Apple and updater release authority",
    "Build and verify the signed notarized public candidate",
    "Reopen the complete local candidate",
    "Attest every checksum-bound public asset",
    "Attest the final checksum inventory",
    "Upload the exact Pages deployment artifact",
    "Publish the immutable GitHub Release",
    "Remove ephemeral release authority",
  ]);
  requireMatch(errors, build, /- name: Remove ephemeral release authority\n        if: always\(\)/, "release authority cleanup must always execute");

  const deploy = section(source, "deploy-pages");
  requirePermissions(
    errors,
    deploy,
    4,
    ["contents: read", "id-token: write", "pages: write"],
    "Pages deployment",
  );
  requireMatch(errors, deploy, /needs: build-and-publish/, "Pages deployment must follow publication");
  requireMatch(errors, deploy, /name: github-pages/, "Pages deployment must use its environment");
  requireMatch(errors, deploy, /pages: write/, "Pages deployment lacks publication authority");

  const verify = section(source, "verify-publication");
  requirePermissions(
    errors,
    verify,
    4,
    ["artifact-metadata: read", "attestations: read", "contents: read"],
    "remote verification",
  );
  requireMatch(errors, verify, /needs: deploy-pages/, "remote verification must follow Pages");
  requireMatch(errors, verify, /artifact-metadata: read/, "remote verification lacks artifact metadata access");
  requireMatch(errors, verify, /attestations: read/, "remote verification lacks attestation access");
  requireMatch(errors, verify, /verify:remote-public-release/, "remote byte verification is unavailable");
  if (/\$\{\{\s*secrets\./.test(deploy) || /\$\{\{\s*secrets\./.test(verify)) {
    errors.push("deployment and remote verification cannot receive release secrets");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    workflow: workflowPath,
    trigger: "workflow_dispatch",
    protectedEnvironment: "public-macos-release",
    actionReferenceCount: uses.length,
    publicationOrder: "release-before-pages",
  };
}

export function inspectPublicReleaseWorkflow(root = repositoryRoot) {
  return validatePublicReleaseWorkflow(readFileSync(path.join(root, workflowPath), "utf8"));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(inspectPublicReleaseWorkflow())}\n`);
  } catch (error) {
    process.stderr.write(`Public release workflow check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
