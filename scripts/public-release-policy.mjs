import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(
  readFileSync(new URL("../schemas/public-release-policy-v1.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);

export function validatePublicReleasePolicy(policy, upgradeMatrix) {
  const errors = [];
  if (!validateSchema(policy)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `public release policy violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  if (policy?.releaseVersion !== upgradeMatrix?.releaseVersion) {
    errors.push("public release policy and upgrade matrix versions do not match");
  }
  const applicationBaselines = upgradeMatrix?.applicationVersions ?? [];
  const expectedMinimum = applicationBaselines[0] ?? policy?.releaseVersion;
  if (policy?.update?.minimumSupportedVersion !== expectedMinimum) {
    errors.push(`public minimum supported version must be ${expectedMinimum}`);
  }
  const withdrawn = new Set();
  for (const withdrawal of policy?.update?.withdrawnVersions ?? []) {
    if (withdrawn.has(withdrawal.version)) {
      errors.push(`duplicate withdrawn version: ${withdrawal.version}`);
    }
    withdrawn.add(withdrawal.version);
    if (withdrawal.version === policy?.releaseVersion) {
      errors.push("current public release cannot be withdrawn by its own policy");
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return policy;
}

export function loadPublicReleasePolicy(repositoryRoot, version, upgradeMatrix) {
  const policyPath = path.join(repositoryRoot, "release", "publication", `${version}.json`);
  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  return validatePublicReleasePolicy(policy, upgradeMatrix);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const version = process.argv[2];
    if (!version) throw new Error("usage: node scripts/public-release-policy.mjs <version>");
    const matrix = JSON.parse(readFileSync(path.join(repositoryRoot, "release/upgrade-matrix.json")));
    const policy = loadPublicReleasePolicy(repositoryRoot, version, {
      releaseVersion: matrix.release.version,
      applicationVersions: matrix.supportedApplicationBaselines.map(({ version }) => version),
    });
    process.stdout.write(
      `${JSON.stringify({
        releaseVersion: policy.releaseVersion,
        sequence: policy.update.sequence,
        minimumSupportedVersion: policy.update.minimumSupportedVersion,
        locales: Object.keys(policy.update.releaseNotes).sort(),
        withdrawnVersionCount: policy.update.withdrawnVersions.length,
      })}\n`,
    );
  } catch (error) {
    process.stderr.write(`Public release policy check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
