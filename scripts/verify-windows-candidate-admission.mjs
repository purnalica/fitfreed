import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { loadPublicReleaseSigningConfiguration } from "./public-release-signing-configuration.mjs";
import { verifySupportedPublicReleaseCandidate } from "./public-release-candidate-verification.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { verifyWindowsColdLaunch } from "./verify-windows-cold-launch.mjs";
import { verifyWindowsPackageInstallation } from "./verify-windows-package-installation.mjs";
import { windowsNativeToolEnvironment } from "./windows-native-environment.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const hostInspectionScript = path.join(
  repositoryRoot,
  "scripts/inspect-windows-11-candidate-host.ps1",
);
const policyPath = path.join(repositoryRoot, "release/windows-candidate-admission.json");
const policySchema = JSON.parse(readFileSync(
  new URL("../schemas/windows-candidate-admission-policy-v1.schema.json", import.meta.url),
  "utf8",
));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validatePolicySchema = ajv.compile(policySchema);
const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const revisionPattern = /^[0-9a-f]{40,64}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const targetSet = ["darwin-aarch64", "linux-x86_64-deb", "windows-x86_64-nsis"];
const policyFields = ["format", "releases", "reviewedAt", "schemaVersion", "sources"];
const releaseFields = ["build", "displayVersion", "editionIds", "supportEndsOn"];
const hostFields = [
  "currentBuildNumber",
  "displayVersion",
  "editionId",
  "installationType",
  "processorArchitecture",
  "productType",
  "schemaVersion",
  "signToolPath",
  "updateBuildRevision",
];
const maximumPolicyAgeDays = 45;

function byteOrder(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function exactFields(value, expected) {
  return JSON.stringify(Object.keys(value ?? {}).sort(byteOrder))
    === JSON.stringify([...expected].sort(byteOrder));
}

function parseInstant(value, message) {
  const parsed = Date.parse(value ?? "");
  if (!Number.isFinite(parsed)) throw new Error(message);
  return parsed;
}

function parseDate(value, message) {
  if (!datePattern.test(value ?? "")) throw new Error(message);
  const parsed = Date.parse(`${value}T23:59:59.999Z`);
  if (
    !Number.isFinite(parsed)
    || new Date(parsed).toISOString().slice(0, 10) !== value
  ) throw new Error(message);
  return parsed;
}

function releaseOrderKey(release) {
  return [
    release.displayVersion,
    String(release.build).padStart(8, "0"),
    release.supportEndsOn,
    release.editionIds.join("\0"),
  ].join("\0");
}

export function validateWindowsCandidateAdmissionPolicy(policy, issuedAt) {
  const issuance = parseInstant(issuedAt, "Windows candidate issuance time is invalid");
  const reviewed = parseDate(policy?.reviewedAt, "Windows candidate policy reviewed date is invalid");
  const age = issuance - reviewed;
  const errors = [];
  if (!validatePolicySchema(policy)) {
    errors.push(...validatePolicySchema.errors.map(
      ({ instancePath, message }) =>
        `Windows candidate admission policy violation at ${instancePath || "/"}: ${message}`,
    ));
  }
  if (
    !exactFields(policy, policyFields)
    || policy?.format !== "org.fitfreed.windows-candidate-admission-policy"
    || policy?.schemaVersion !== 1
  ) {
    errors.push("Windows candidate admission policy fields or identity are invalid");
  }
  if (age < -24 * 60 * 60 * 1000 || age > maximumPolicyAgeDays * 24 * 60 * 60 * 1000) {
    errors.push("Windows candidate admission policy was not reviewed near issuance");
  }
  if (
    !Array.isArray(policy?.sources)
    || policy.sources.length < 1
    || new Set(policy.sources).size !== policy.sources.length
    || JSON.stringify(policy.sources) !== JSON.stringify([...policy.sources].sort(byteOrder))
    || policy.sources.some((candidate) => {
      try {
        const source = new URL(candidate);
        return source.protocol !== "https:"
          || source.hostname !== "learn.microsoft.com"
          || source.username !== ""
          || source.password !== ""
          || source.search !== ""
          || source.hash !== "";
      } catch {
        return true;
      }
    })
  ) {
    errors.push("Windows candidate admission policy sources are not unique, ordered official Microsoft HTTPS documents");
  }
  if (!Array.isArray(policy?.releases) || policy.releases.length < 1) {
    errors.push("Windows candidate admission policy has no release rows");
  } else {
    const keys = policy.releases.map(releaseOrderKey);
    if (JSON.stringify(keys) !== JSON.stringify([...keys].sort(byteOrder))) {
      errors.push("Windows candidate admission policy releases are not byte ordered");
    }
    for (const release of policy.releases) {
      if (
        !exactFields(release, releaseFields)
        || !/^\d{2}H[12]$/.test(release.displayVersion ?? "")
        || !Number.isSafeInteger(release.build)
        || release.build < 22000
        || !datePattern.test(release.supportEndsOn ?? "")
      ) {
        errors.push("Windows candidate admission policy release fields are invalid");
        continue;
      }
      if (parseDate(release.supportEndsOn, "Windows support end date is invalid") < issuance) {
        errors.push("Windows candidate admission policy contains a release outside support");
      }
      if (
        !Array.isArray(release.editionIds)
        || release.editionIds.length < 1
        || release.editionIds.some((edition) => !/^[A-Za-z][A-Za-z0-9]{1,63}$/.test(edition))
        || new Set(release.editionIds).size !== release.editionIds.length
        || JSON.stringify(release.editionIds)
          !== JSON.stringify([...release.editionIds].sort(byteOrder))
      ) {
        errors.push("Windows candidate admission policy edition identifiers are invalid");
      }
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return policy;
}

export function validateWindowsCandidateAdmissionHost({
  architecture,
  facts,
  issuedAt,
  platform,
  policy,
}) {
  const validatedPolicy = validateWindowsCandidateAdmissionPolicy(policy, issuedAt);
  if (!exactFields(facts, hostFields)) {
    throw new Error("Windows candidate host evidence contains unexpected fields");
  }
  if (
    platform !== "win32"
    || architecture !== "x64"
    || facts.schemaVersion !== 1
    || facts.processorArchitecture !== "AMD64"
    || facts.installationType !== "Client"
    || facts.productType !== 1
    || !/^\d{2}H[12]$/.test(facts.displayVersion ?? "")
    || !Number.isSafeInteger(facts.currentBuildNumber)
    || facts.currentBuildNumber < 22000
    || !Number.isSafeInteger(facts.updateBuildRevision)
    || facts.updateBuildRevision < 0
    || typeof facts.editionId !== "string"
    || !path.win32.isAbsolute(facts.signToolPath ?? "")
    || path.win32.basename(facts.signToolPath).toLowerCase() !== "signtool.exe"
  ) {
    throw new Error("candidate admission host is not exact x86-64 Windows 11 Client");
  }
  const matching = validatedPolicy.releases.filter((release) =>
    release.displayVersion === facts.displayVersion
    && release.build === facts.currentBuildNumber
    && release.editionIds.includes(facts.editionId));
  if (matching.length !== 1) {
    throw new Error("Windows 11 host is not one supported release and edition at candidate issuance");
  }
  return {
    architecture: "x86_64",
    build: `${facts.currentBuildNumber}.${facts.updateBuildRevision}`,
    displayVersion: facts.displayVersion,
    editionId: facts.editionId,
    platform: "windows-11",
    policyReviewedAt: validatedPolicy.reviewedAt,
    supportEndsOn: matching[0].supportEndsOn,
  };
}

export function validateExactWindowsCandidate(
  candidate,
  expectedVersion,
  expectedRevision,
  expectedCertificateSha256,
) {
  const { manifest, verified } = candidate ?? {};
  if (
    !semanticVersion.test(expectedVersion ?? "")
    || !revisionPattern.test(expectedRevision ?? "")
    || !sha256Pattern.test(expectedCertificateSha256 ?? "")
    || manifest?.schemaVersion !== 7
    || manifest?.release?.version !== expectedVersion
    || manifest?.release?.revision !== expectedRevision
    || verified?.version !== expectedVersion
    || verified?.revision !== expectedRevision
    || verified?.storageSchemaVersion !== manifest?.application?.storageSchemaVersion
    || JSON.stringify(verified?.targets) !== JSON.stringify(targetSet)
    || verified?.windowsCertificateSha256 !== expectedCertificateSha256
    || !path.win32.isAbsolute(verified?.windowsPackage ?? "")
  ) {
    throw new Error("Windows admission requires the exact complete-platform candidate");
  }
  return verified;
}

function inspectNativeHost() {
  const result = spawnSync("powershell.exe", [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    hostInspectionScript,
  ], {
    encoding: "utf8",
    env: windowsNativeToolEnvironment(process.env),
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error("Windows 11 candidate host inspection failed");
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("Windows 11 candidate host inspection returned invalid evidence");
  }
}

function exactCandidate(candidateDirectory, version, certificateSha256) {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
  const dirty = execFileSync(
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  if (dirty !== "") {
    throw new Error("Windows candidate admission requires the exact clean tagged source");
  }
  const candidate = verifySupportedPublicReleaseCandidate({
    candidateDirectory,
    publicReleaseSigningConfiguration:
      loadPublicReleaseSigningConfiguration(repositoryRoot),
    publicUpdateConfiguration: loadPublicUpdateConfiguration(repositoryRoot),
  });
  return {
    revision,
    verified: validateExactWindowsCandidate(
      candidate,
      version,
      revision,
      certificateSha256,
    ),
  };
}

function main() {
  const [candidateDirectory, version, issuedAt, certificateSha256] = process.argv.slice(2);
  if (!candidateDirectory || !version || !issuedAt || !certificateSha256) {
    throw new Error(
      "usage: node scripts/verify-windows-candidate-admission.mjs <candidate-directory> <version> <issued-at> <certificate-sha256>",
    );
  }
  const facts = inspectNativeHost();
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  const host = validateWindowsCandidateAdmissionHost({
    architecture: process.arch,
    facts,
    issuedAt,
    platform: process.platform,
    policy,
  });
  const candidate = exactCandidate(candidateDirectory, version, certificateSha256);
  const installation = verifyWindowsPackageInstallation({
    certificateSha256,
    packagePath: candidate.verified.windowsPackage,
    signatureProfile: "public-authenticode",
    signToolPath: facts.signToolPath,
    version,
  });
  const coldLaunch = verifyWindowsColdLaunch({
    packagePath: candidate.verified.windowsPackage,
    version,
  });
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    host,
    installation: {
      installMode: installation.installMode,
      packageFormat: installation.packageFormat,
      removal: installation.removal,
      signatureProfile: installation.signatureProfile,
    },
    coldLaunch,
    revision: candidate.revision,
    version,
  })}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Windows candidate admission failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
