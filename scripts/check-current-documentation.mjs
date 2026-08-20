import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function documentationPaths(releaseVersion) {
  return Object.freeze({
    readme: "README.md",
    storage: "docs/architecture/storage.md",
    releaseDelivery: "docs/architecture/release-delivery.md",
    upgradeMatrix: "docs/data-formats/release/upgrade-matrix-v1.md",
    developmentPreview: "docs/user/development-preview.md",
    publicGuide: `docs/user/public-macos-${releaseVersion}.md`,
    readiness: "docs/testing/public-release-readiness.md",
    releaseNotes: `release/notes/${releaseVersion}.md`,
  });
}

function requirePattern(errors, source, pattern, message) {
  if (!pattern.test(source)) errors.push(message);
}

function rejectPattern(errors, source, pattern, message) {
  if (pattern.test(source)) errors.push(message);
}

export function validateCurrentDocumentation({
  releaseVersion,
  matrixReleaseVersion,
  currentLibrarySchemaVersion,
  supportedLibrarySchemaVersions,
  sources,
}) {
  const errors = [];
  if (typeof releaseVersion !== "string" || releaseVersion.length === 0) {
    errors.push("repository release version must not be empty");
  }
  if (matrixReleaseVersion !== releaseVersion) {
    errors.push("upgrade matrix release version does not match the repository release version");
  }
  if (!Number.isInteger(currentLibrarySchemaVersion) || currentLibrarySchemaVersion <= 0) {
    errors.push("current library schema version must be a positive integer");
  }
  if (!Array.isArray(supportedLibrarySchemaVersions)
    || supportedLibrarySchemaVersions.length === 0) {
    errors.push("supported library schema versions must not be empty");
  }
  const paths = documentationPaths(releaseVersion);
  for (const [name, documentPath] of Object.entries(paths)) {
    if (typeof sources?.[documentPath] !== "string") {
      errors.push(`missing current documentation source ${name}: ${documentPath}`);
    }
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));

  const firstSupportedSchema = supportedLibrarySchemaVersions[0];
  const lastSupportedSchema = supportedLibrarySchemaVersions.at(-1);
  const storage = sources[paths.storage];
  const releaseNotes = sources[paths.releaseNotes];
  const fixedSchemaRange = /schemas 1 through \d+/i;

  requirePattern(
    errors,
    storage,
    new RegExp(
      `\\[SQLite version ${currentLibrarySchemaVersion} persistence specification\\]`
      + `\\(\\.\\./data-formats/persistence/sqlite-v${currentLibrarySchemaVersion}\\.md\\)`,
    ),
    `storage architecture does not identify SQLite schema ${currentLibrarySchemaVersion}`,
  );
  requirePattern(
    errors,
    releaseNotes,
    new RegExp(`schemas ${firstSupportedSchema} through ${lastSupportedSchema}`),
    "release notes do not match the current supported library schema range",
  );

  for (const documentPath of [
    paths.releaseDelivery,
    paths.upgradeMatrix,
    paths.developmentPreview,
  ]) {
    rejectPattern(
      errors,
      sources[documentPath],
      fixedSchemaRange,
      `${documentPath} duplicates the mutable current schema range`,
    );
  }

  const publicGuide = sources[paths.publicGuide];
  requirePattern(
    errors,
    publicGuide,
    /question-, exploration-, session-, and blank-start reports/i,
    "public guide does not describe every implemented report start",
  );
  requirePattern(
    errors,
    publicGuide,
    /deliberate evidence refresh/i,
    "public guide does not describe deliberate report evidence refresh",
  );
  rejectPattern(
    errors,
    publicGuide,
    /Report starts from a question, exploration, or blank canvas[^.]*outside 0\.1\.0/i,
    "public guide still presents implemented report starts as unavailable",
  );

  const developmentPreview = sources[paths.developmentPreview];
  rejectPattern(
    errors,
    developmentPreview,
    /remaining evidence-complete session layers remain E4 work/i,
    "development preview still presents completed E4 work as open",
  );

  const readiness = sources[paths.readiness];
  rejectPattern(
    errors,
    readiness,
    /accepted E1[–-]E6 experience scope[^.]*not implemented/i,
    "release readiness still presents the implemented experience as absent",
  );
  rejectPattern(
    errors,
    readiness,
    /Pages compositor (?:is|are) not (?:yet )?(?:implemented|accepted)/i,
    "release readiness still presents the accepted Pages compositor as absent",
  );

  const readme = sources[paths.readme];
  rejectPattern(
    errors,
    readme,
    /not presented\s+as already implemented production behavior/i,
    "README still presents the available source experience as a mock product direction",
  );

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    releaseVersion,
    currentLibrarySchemaVersion,
    supportedLibrarySchemaVersions,
    checkedDocuments: Object.keys(paths).length,
  };
}

export function loadCurrentDocumentation(repositoryRoot) {
  const releaseVersion = JSON.parse(readFileSync(
    path.join(repositoryRoot, "package.json"),
    "utf8",
  )).version;
  const matrix = JSON.parse(readFileSync(
    path.join(repositoryRoot, "release", "upgrade-matrix.json"),
    "utf8",
  ));
  const paths = documentationPaths(releaseVersion);
  return {
    releaseVersion,
    matrixReleaseVersion: matrix.release.version,
    currentLibrarySchemaVersion: matrix.release.librarySchemaVersion,
    supportedLibrarySchemaVersions: matrix.supportedLibrarySchemaVersions,
    sources: Object.fromEntries(Object.values(paths).map((documentPath) => [
      documentPath,
      readFileSync(path.join(repositoryRoot, documentPath), "utf8"),
    ])),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    process.stdout.write(
      `${JSON.stringify(validateCurrentDocumentation(loadCurrentDocumentation(repositoryRoot)))}\n`,
    );
  } catch (error) {
    process.stderr.write(`Current documentation check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
