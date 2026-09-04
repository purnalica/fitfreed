import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function documentationPaths(releaseVersion) {
  return Object.freeze({
    readme: "README.md",
    automation: "docs/automation-strategy.md",
    storage: "docs/architecture/storage.md",
    releaseDelivery: "docs/architecture/release-delivery.md",
    experienceSpecification: "docs/design/experience-specification.md",
    upgradeMatrix: "docs/data-formats/release/upgrade-matrix-v1.md",
    redesignPlan: "docs/plans/ui-redesign.md",
    roadmap: "docs/roadmap.md",
    gettingStarted: "docs/development/getting-started.md",
    performanceBenchmarks: "docs/development/performance-benchmarks.md",
    troubleshooting: "docs/development/troubleshooting.md",
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

  rejectPattern(
    errors,
    sources[paths.experienceSpecification],
    /does not describe the current production presentation/i,
    "experience specification still disclaims production implementation",
  );
  rejectPattern(
    errors,
    sources[paths.redesignPlan],
    /X4 derives[^.]*before X5 changes (?:the )?(?:ordinary )?production/i,
    "redesign plan still presents X5 implementation as future",
  );
  rejectPattern(
    errors,
    sources[paths.roadmap],
    /X5 is migrating the public entrance and ordinary application/i,
    "roadmap still presents the implemented X5 increments as future",
  );

  const readiness = sources[paths.readiness];
  rejectPattern(
    errors,
    readiness,
    /PX-01 and PX-02 still require correction/i,
    "readiness ledger still reports the pre-migration audit state",
  );
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

  requirePattern(
    errors,
    sources[paths.gettingStarted],
    /npm run verify:linux-filesystem-reliability/,
    "contributor setup omits the Linux filesystem reliability command",
  );
  requirePattern(
    errors,
    sources[paths.automation],
    /isolated 32 MiB `tmpfs`/,
    "automation strategy omits the isolated Linux filesystem boundary",
  );
  requirePattern(
    errors,
    sources[paths.performanceBenchmarks],
    /committed history remains byte-for-byte visible/,
    "performance guidance omits committed-history recovery",
  );
  requirePattern(
    errors,
    sources[paths.troubleshooting],
    /Linux disk-exhaustion gate fails/,
    "troubleshooting omits the Linux disk-exhaustion boundary",
  );
  requirePattern(
    errors,
    sources[paths.gettingStarted],
    /npm run verify:windows-cold-launch/,
    "contributor setup omits the Windows cold-launch command",
  );
  requirePattern(
    errors,
    sources[paths.automation],
    /\.github\/workflows\/windows-performance\.yml/,
    "automation strategy omits the explicit Windows performance workflow",
  );
  requirePattern(
    errors,
    sources[paths.performanceBenchmarks],
    /%LOCALAPPDATA%\\FitFreed\\fitfreed\.exe/,
    "performance guidance omits the fixed installed Windows executable",
  );
  requirePattern(
    errors,
    sources[paths.troubleshooting],
    /Installed Windows cold launch or a Windows data budget fails/,
    "troubleshooting omits the Windows performance boundary",
  );
  requirePattern(
    errors,
    sources[paths.gettingStarted],
    /npm run verify:windows-filesystem-reliability/,
    "contributor setup omits the Windows filesystem reliability command",
  );
  requirePattern(
    errors,
    sources[paths.automation],
    /isolated 64 MiB NTFS VHD/,
    "automation strategy omits the isolated Windows filesystem boundary",
  );
  requirePattern(
    errors,
    sources[paths.performanceBenchmarks],
    /actual Windows disk-full failure/,
    "performance guidance omits the Windows disk-full boundary",
  );
  requirePattern(
    errors,
    sources[paths.troubleshooting],
    /Windows disk-exhaustion gate fails/,
    "troubleshooting omits the Windows disk-exhaustion boundary",
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
