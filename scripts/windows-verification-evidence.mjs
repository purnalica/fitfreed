import {
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const markerName = "windows-host.json";
const lane = "windows-2025-x86_64-host";
const fingerprintPattern = /^[0-9a-f]{64}$/;

function marker(fingerprint) {
  if (!fingerprintPattern.test(fingerprint ?? "")) {
    throw new Error("Windows verification evidence requires an executable fingerprint");
  }
  return {
    executableFingerprint: fingerprint,
    lane,
    schemaVersion: 1,
  };
}

export function recordWindowsVerificationEvidence(directory, fingerprint) {
  const evidence = marker(fingerprint);
  const root = path.resolve(directory);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  const temporary = path.join(root, `.${markerName}-${process.pid}`);
  writeFileSync(temporary, `${JSON.stringify(evidence)}\n`, { flag: "wx" });
  renameSync(temporary, path.join(root, markerName));
  return evidence;
}

export function verifyWindowsVerificationEvidence(directory, fingerprint) {
  try {
    const expected = marker(fingerprint);
    const root = path.resolve(directory);
    if (JSON.stringify(readdirSync(root).sort()) !== JSON.stringify([markerName])) return false;
    const actual = JSON.parse(readFileSync(path.join(root, markerName), "utf8"));
    return JSON.stringify(actual) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) writeFileSync(outputPath, `${name}=${value}\n`, { flag: "a" });
}

function main() {
  const [action, directory, fingerprint] = process.argv.slice(2);
  if (!directory || !fingerprint || !["record", "verify"].includes(action)) {
    throw new Error(
      "usage: node scripts/windows-verification-evidence.mjs <record|verify> <directory> <fingerprint>",
    );
  }
  if (action === "record") {
    process.stdout.write(`${JSON.stringify(recordWindowsVerificationEvidence(directory, fingerprint))}\n`);
    return;
  }
  const valid = verifyWindowsVerificationEvidence(directory, fingerprint);
  writeOutput("evidence-valid", valid);
  process.stdout.write(`${JSON.stringify({ evidenceValid: valid, lane })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Windows verification evidence failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
