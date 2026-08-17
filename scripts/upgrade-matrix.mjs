import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

const schema = JSON.parse(
  readFileSync(new URL("../schemas/upgrade-matrix-v1.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);
const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseSemanticVersion(value) {
  const match = value.match(semanticVersion);
  if (!match) throw new Error(`invalid semantic version: ${value}`);
  return {
    core: match.slice(1, 4).map(Number),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function comparePrerelease(left, right) {
  if (left.length === 0 || right.length === 0) {
    return left.length === right.length ? 0 : left.length === 0 ? 1 : -1;
  }
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === undefined || right[index] === undefined) {
      return left[index] === right[index] ? 0 : left[index] === undefined ? -1 : 1;
    }
    const leftNumeric = /^\d+$/.test(left[index]);
    const rightNumeric = /^\d+$/.test(right[index]);
    if (leftNumeric && rightNumeric) {
      const difference = Number(left[index]) - Number(right[index]);
      if (difference !== 0) return Math.sign(difference);
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else {
      const difference = left[index].localeCompare(right[index], "en");
      if (difference !== 0) return Math.sign(difference);
    }
  }
  return 0;
}

function compareSemanticVersions(leftValue, rightValue) {
  const left = parseSemanticVersion(leftValue);
  const right = parseSemanticVersion(rightValue);
  for (let index = 0; index < left.core.length; index += 1) {
    const difference = left.core[index] - right.core[index];
    if (difference !== 0) return Math.sign(difference);
  }
  return comparePrerelease(left.prerelease, right.prerelease);
}

function isStrictlyOrdered(values, compare) {
  return values.every((value, index) => index === 0 || compare(values[index - 1], value) < 0);
}

function numericOrder(left, right) {
  return left - right;
}

function lexicalOrder(left, right) {
  return left.localeCompare(right, "en");
}

export function validateUpgradeMatrix(matrix, repository) {
  if (!validateSchema(matrix)) {
    throw new Error(
      validateSchema.errors
        .map(({ instancePath, message }) =>
          `upgrade matrix schema violation at ${instancePath || "/"}: ${message}`)
        .join("\n"),
    );
  }

  const errors = [];
  const requireValue = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const targetVersion = matrix.release.version;
  const targetSchema = matrix.release.librarySchemaVersion;
  const migrationVersions = new Set(repository.migrationVersions);
  const supportedLibrarySchemas = new Set(matrix.supportedLibrarySchemaVersions);

  requireValue(
    targetVersion === repository.releaseVersion,
    `target version ${targetVersion} does not match repository version ${repository.releaseVersion}`,
  );
  requireValue(
    targetSchema === repository.currentLibrarySchemaVersion,
    `target library schema ${targetSchema} does not match compiled schema ${repository.currentLibrarySchemaVersion}`,
  );
  requireValue(
    isStrictlyOrdered(matrix.supportedLibrarySchemaVersions, numericOrder),
    "supported library schemas must be ordered",
  );
  requireValue(
    supportedLibrarySchemas.has(targetSchema),
    `supported library schemas do not include target schema ${targetSchema}`,
  );
  for (const version of matrix.supportedLibrarySchemaVersions) {
    requireValue(
      version <= targetSchema,
      `supported library schema ${version} is newer than target schema ${targetSchema}`,
    );
    requireValue(
      migrationVersions.has(version),
      `supported library schema ${version} has no immutable migration`,
    );
  }
  requireValue(
    migrationVersions.has(targetSchema),
    `target library schema ${targetSchema} has no immutable migration`,
  );

  const applicationVersions = matrix.supportedApplicationBaselines.map(({ version }) => version);
  requireValue(
    isStrictlyOrdered(applicationVersions, compareSemanticVersions),
    "application baselines must be ordered by version",
  );
  const precedenceVersions = new Set();
  for (const baseline of matrix.supportedApplicationBaselines) {
    requireValue(
      compareSemanticVersions(baseline.version, targetVersion) < 0,
      `application baseline ${baseline.version} is not older than target ${targetVersion}`,
    );
    const precedenceIdentity = baseline.version.replace(/\+.*$/, "");
    requireValue(
      !precedenceVersions.has(precedenceIdentity),
      "application baseline versions must be unique by SemVer precedence",
    );
    precedenceVersions.add(precedenceIdentity);
    requireValue(
      isStrictlyOrdered(baseline.targets, lexicalOrder),
      `${baseline.version} targets must be ordered`,
    );
    requireValue(
      isStrictlyOrdered(baseline.librarySchemaVersions, numericOrder),
      `${baseline.version} library schemas must be ordered`,
    );
    for (const version of baseline.librarySchemaVersions) {
      requireValue(
        supportedLibrarySchemas.has(version),
        `application baseline ${baseline.version} uses unsupported library schema ${version}`,
      );
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    releaseVersion: targetVersion,
    currentLibrarySchemaVersion: targetSchema,
    applicationBaselineCount: matrix.supportedApplicationBaselines.length,
    applicationVersions,
    librarySchemaVersions: matrix.supportedLibrarySchemaVersions,
  };
}

export function inspectUpgradeMatrix(repositoryRoot) {
  const matrix = JSON.parse(
    readFileSync(path.join(repositoryRoot, "release/upgrade-matrix.json"), "utf8"),
  );
  const releaseVersion = JSON.parse(
    readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
  ).version;
  const infrastructure = readFileSync(
    path.join(repositoryRoot, "src-tauri/src/infrastructure.rs"),
    "utf8",
  );
  const schemaVersionMatch = infrastructure.match(/const SCHEMA_VERSION: i64 = (\d+);/);
  if (!schemaVersionMatch) throw new Error("compiled library schema version is unavailable");
  const migrationVersions = readdirSync(path.join(repositoryRoot, "src-tauri/migrations"))
    .map((name) => name.match(/^(\d{4})_[a-z0-9_]+\.sql$/))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort(numericOrder);
  return validateUpgradeMatrix(matrix, {
    releaseVersion,
    currentLibrarySchemaVersion: Number(schemaVersionMatch[1]),
    migrationVersions,
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    process.stdout.write(`${JSON.stringify(inspectUpgradeMatrix(repositoryRoot))}\n`);
  } catch (error) {
    process.stderr.write(`Upgrade matrix verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
