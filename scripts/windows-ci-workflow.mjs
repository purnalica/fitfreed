import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

function jobSection(source, name) {
  const heading = `  ${name}:\n`;
  const start = source.indexOf(heading);
  if (start < 0) throw new Error(`Windows CI workflow is missing ${name}`);
  const bodyStart = start + heading.length;
  const remaining = source.slice(bodyStart);
  const nextJob = remaining.search(/^  [a-z][\w-]+:\n/m);
  return nextJob < 0 ? remaining : remaining.slice(0, nextJob);
}

function requireMatch(errors, source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

export function validateWindowsCiWorkflow(source) {
  const errors = [];
  const windows = jobSection(source, "windows-host");
  const packagedCapability = jobSection(source, "packaged-windows-e2e");
  const completeEvidence = jobSection(source, "verification-evidence");

  requireMatch(errors, windows, /^    runs-on: windows-2025$/m, "Windows host must use windows-2025");
  requireMatch(errors, windows, /^    needs: quality$/m, "Windows host must follow impact classification");
  requireMatch(
    errors,
    windows,
    /permissions:\n      contents: read/,
    "Windows host permissions must remain read-only",
  );
  requireMatch(
    errors,
    windows,
    /fitfreed-windows-host-package-v1-\$\{\{ needs\.quality\.outputs\.executable-fingerprint \}\}/,
    "Windows evidence cache must bind the executable fingerprint",
  );
  requireMatch(
    errors,
    windows,
    /node scripts\/windows-verification-evidence\.mjs verify/,
    "Windows host must reopen cached evidence",
  );
  requireMatch(
    errors,
    windows,
    /node scripts\/classify-ci-impact\.mjs resolve/,
    "Windows host must resolve evidence reuse through the fail-closed classifier",
  );
  requireMatch(
    errors,
    windows,
    /FITFREED_CI_CLASSIFICATION_REASON: \$\{\{ needs\.quality\.outputs\.verification-reason \}\}/,
    "Windows host must preserve the shared verification reason",
  );
  requireMatch(
    errors,
    windows,
    /npm run package:windows/,
    "Windows host must build the complete release-shaped NSIS package",
  );
  requireMatch(
    errors,
    windows,
    /npm run inventory:windows-package/,
    "Windows host must inventory one native NSIS installation and removal",
  );
  requireMatch(
    errors,
    windows,
    /npm run verify:windows-authenticode-smoke/,
    "Windows host must verify synthetic Authenticode orchestration and cleanup",
  );
  for (const command of [
    "npm run doctor",
    "npm run check:architecture",
    "npm run check:vendored-updater",
    "npm run check:data-contracts",
    "npm run check:i18n",
    "npm run check:ui-contracts",
    "npm run test:windows-scripts",
    "npm test",
    "npm run format:check",
    "npm run test:rust",
    "npm run lint:rust",
    "npm run test:vendor-updater",
  ]) {
    requireMatch(
      errors,
      windows,
      new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${command} is missing from Windows host verification`,
    );
  }
  requireMatch(
    errors,
    windows,
    /node scripts\/windows-verification-evidence\.mjs record/,
    "Windows host must record exact successful evidence",
  );
  requireMatch(
    errors,
    completeEvidence,
    /needs: \[quality, windows-host, packaged-macos-e2e, packaged-linux-e2e, packaged-linux-update-e2e, packaged-windows-e2e\]/,
    "complete verification evidence must depend on Windows host verification",
  );
  requireMatch(
    errors,
    completeEvidence,
    /needs\.windows-host\.result == 'success'/,
    "complete verification evidence must require a successful Windows host",
  );
  requireMatch(
    errors,
    packagedCapability,
    /^    runs-on: windows-2025$/m,
    "packaged Windows capability must use windows-2025",
  );
  requireMatch(
    errors,
    packagedCapability,
    /^    needs: quality$/m,
    "packaged Windows capability must follow impact classification",
  );
  requireMatch(
    errors,
    packagedCapability,
    /^    if: needs\.quality\.outputs\.full-verification == 'true'$/m,
    "packaged Windows capability must run only for complete verification",
  );
  requireMatch(
    errors,
    packagedCapability,
    /permissions:\n      contents: read/,
    "packaged Windows capability permissions must remain read-only",
  );
  requireMatch(
    errors,
    packagedCapability,
    /npm run verify:windows-e2e/,
    "packaged Windows capability must build, install, and exercise the isolated NSIS package",
  );
  requireMatch(
    errors,
    packagedCapability,
    /path: \.artifacts\/e2e\/evidence/,
    "packaged Windows capability must retain privacy-safe failure evidence",
  );
  requireMatch(
    errors,
    completeEvidence,
    /needs\.packaged-windows-e2e\.result == 'success'/,
    "complete verification evidence must require packaged Windows capability evidence",
  );

  const evidenceVerification = windows.indexOf(
    "node scripts/windows-verification-evidence.mjs verify",
  );
  const impactResolution = windows.indexOf("node scripts/classify-ci-impact.mjs resolve");
  const evidenceRecord = windows.indexOf(
    "node scripts/windows-verification-evidence.mjs record",
  );
  const evidenceSave = windows.indexOf("uses: actions/cache/save@");
  if (!(evidenceVerification < impactResolution)) {
    errors.push("Windows evidence must be reopened before impact resolution");
  }
  for (const command of [
    "npm run doctor",
    "npm run check:architecture",
    "npm run test:windows-scripts",
    "npm test",
    "npm run build",
    "npm run format:check",
    "npm run test:rust",
    "npm run lint:rust",
    "npm run test:vendor-updater",
    "npm run package:windows",
    "npm run inventory:windows-package",
    "npm run verify:windows-authenticode-smoke",
  ]) {
    if (windows.indexOf(command) > evidenceRecord) {
      errors.push("Windows evidence must be recorded after every required verification command");
      break;
    }
  }
  if (!(evidenceRecord < evidenceSave)) {
    errors.push("Windows evidence must be recorded before it is saved");
  }

  const unixOnly = new RegExp([
    "\\bbash\\b",
    "\\bsudo\\b",
    "\\bapt-get\\b",
    "\\bxvfb-run\\b",
    "\\bchmod\\b",
    "\\bmkdir -p\\b",
    "\\brm -[rf]",
    "/usr/",
    "/bin/",
    "\\bCARGO_TARGET_DIR=",
  ].join("|"));
  if (unixOnly.test(windows)) errors.push("Windows host contains a Unix-only command");
  if (unixOnly.test(packagedCapability)) {
    errors.push("packaged Windows capability contains a Unix-only command");
  }
  if (/\$\{\{\s*(?:secrets|vars)\./.test(windows) || /^    environment:/m.test(windows)) {
    errors.push("Windows host cannot receive protected authority");
  }
  if (
    /\$\{\{\s*(?:secrets|vars)\./.test(packagedCapability)
    || /^    environment:/m.test(packagedCapability)
  ) {
    errors.push("packaged Windows capability cannot receive protected authority");
  }
  for (const [job, label] of [
    [windows, "Windows host"],
    [packagedCapability, "packaged Windows capability"],
  ]) {
    for (const match of job.matchAll(/^\s+uses:\s+([^\s#]+)/gm)) {
      if (!/@[0-9a-f]{40}$/.test(match[1])) {
        errors.push(`${label} action is not pinned: ${match[1]}`);
      }
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    evidenceLane: "windows-2025-x86_64-host-package",
    executable: "fitfreed.exe",
    runner: "windows-2025",
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const workflow = readFileSync(
      path.join(repositoryRoot, ".github", "workflows", "ci.yml"),
      "utf8",
    );
    process.stdout.write(`${JSON.stringify(validateWindowsCiWorkflow(workflow))}\n`);
  } catch (error) {
    process.stderr.write(`Windows CI workflow verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
