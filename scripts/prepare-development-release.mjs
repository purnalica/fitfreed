import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { inspectReleaseContracts } from "./check-release-contracts.mjs";
import { inspectUpgradeMatrix } from "./upgrade-matrix.mjs";
import { nodePackageScriptPath } from "./node-package-script.mjs";
import {
  createReleaseManifest,
  inspectArtifact,
  normalizeCargoSbom,
  promoteStagedDirectory,
  renderChecksumFile,
  renderDraftReleaseNotes,
  validateCycloneDxSbom,
} from "./release-evidence.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cargoCycloneDxVersion = "0.5.9";
const excludedNpmComponents = [
  "@wdio/cli",
  "@wdio/local-runner",
  "@wdio/mocha-framework",
  "@wdio/tauri-service",
  "webdriverio",
  "vitest",
  "vite",
  "typescript",
  "jsdom",
  "axe-core",
];
const excludedDirectCargoComponents = [
  "tauri-plugin-wdio",
  "tauri-plugin-wdio-webdriver",
  "tempfile",
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    env: { ...process.env, ...options.env },
  })?.trim();
}

export function assertCleanRevision() {
  const status = run("git", ["status", "--porcelain=v1", "--untracked-files=all"], { capture: true });
  if (status) throw new Error("release preparation requires a clean Git revision");
  return {
    revision: run("git", ["rev-parse", "HEAD"], { capture: true }),
    sourceDateEpoch: run("git", ["show", "-s", "--format=%ct", "HEAD"], { capture: true }),
  };
}

function findGeneratedCargoSboms(directory, generatedFilename, results = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".artifacts", ".tools", "node_modules", "target"].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) findGeneratedCargoSboms(entryPath, generatedFilename, results);
    else if (entry.name === generatedFilename) results.push(entryPath);
  }
  return results;
}

function productionCargoDependencies() {
  const metadata = JSON.parse(
    run(
      "cargo",
      ["metadata", "--manifest-path", "src-tauri/Cargo.toml", "--format-version", "1", "--no-deps"],
      { capture: true },
    ),
  );
  return new Map(
    metadata.packages
      .filter(({ id }) => metadata.workspace_members.includes(id))
      .map((cargoPackage) => [
        cargoPackage.name,
        cargoPackage.dependencies
          .filter(({ kind, optional }) => kind === null && !optional)
          .map(({ name }) => name),
      ]),
  );
}

function cargoGenerator() {
  const configured = process.env.FITFREED_CARGO_CYCLONEDX;
  const local = path.join(repositoryRoot, ".tools/cargo-cyclonedx/bin/cargo-cyclonedx");
  const binary = configured || (existsSync(local) ? local : "cargo-cyclonedx");
  const versionOutput = run(binary, ["cyclonedx", "--version"], { capture: true });
  if (!versionOutput.endsWith(` ${cargoCycloneDxVersion}`)) {
    throw new Error(
      `cargo-cyclonedx ${cargoCycloneDxVersion} is required; run npm run install:release-tools`,
    );
  }
  return binary;
}

export function generatedAt(sourceDateEpoch) {
  const value = Number.parseInt(sourceDateEpoch, 10);
  if (!Number.isSafeInteger(value)) throw new Error("Git commit timestamp is invalid");
  return new Date(value * 1000).toISOString();
}

function macosArchitecture() {
  if (process.arch === "arm64") return { manifest: "aarch64", tauri: "aarch64" };
  if (process.arch === "x64") return { manifest: "x86_64", tauri: "x64" };
  throw new Error(`unsupported macOS architecture: ${process.arch}`);
}

export function readStorageSchemaVersion() {
  const result = JSON.parse(run("node", ["scripts/check-data-contracts.mjs"], { capture: true }));
  return result.schemaVersion;
}

function copyProductionArtifacts(stagingDirectory, version, tauriArchitecture) {
  const bundleRoot = path.join(repositoryRoot, "src-tauri/target/release/bundle");
  const applicationSource = path.join(bundleRoot, "macos/FitFreed.app");
  const dmgName = `FitFreed_${version}_${tauriArchitecture}.dmg`;
  const dmgSource = path.join(bundleRoot, "dmg", dmgName);
  if (!existsSync(applicationSource) || !existsSync(dmgSource)) {
    throw new Error(`Tauri did not produce the expected application and ${dmgName}`);
  }
  run("ditto", [applicationSource, path.join(stagingDirectory, "FitFreed.app")]);
  cpSync(dmgSource, path.join(stagingDirectory, dmgName));
  return dmgName;
}

export function createNpmSbom(stagingDirectory, repositoryPath) {
  const outputPath = path.join(stagingDirectory, "npm.cdx.json");
  run(
    process.execPath,
    [
      nodePackageScriptPath("@cyclonedx/cyclonedx-npm", "cyclonedx-npm"),
      "--omit",
      "dev",
      "--package-lock-only",
      "--sv",
      "1.5",
      "--output-reproducible",
      "--validate",
      "--of",
      "JSON",
      "-o",
      outputPath,
    ],
  );
  const sbom = JSON.parse(readFileSync(outputPath, "utf8"));
  const npmPackage = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
  validateCycloneDxSbom(sbom, {
    expectedRoot: "fitfreed",
    requiredComponents: Object.keys(npmPackage.dependencies),
    excludedComponents: excludedNpmComponents,
    forbiddenText: [repositoryPath],
  });
  writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`);
  return "npm.cdx.json";
}

export function copyUpgradeMatrix(stagingDirectory) {
  const filename = "supported-upgrades.json";
  cpSync(
    path.join(repositoryRoot, "release/upgrade-matrix.json"),
    path.join(stagingDirectory, filename),
  );
  return filename;
}

export function createCargoSboms(stagingDirectory, repositoryPath, sourceDateEpoch) {
  const generator = cargoGenerator();
  const prefix = `.fitfreed-release-${process.pid}`;
  const generatedFilename = `${prefix}.json`;
  const productionDependencies = productionCargoDependencies();
  const createdPaths = [];
  try {
    run(
      generator,
      [
        "cyclonedx",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--format",
        "json",
        "--no-build-deps",
        "--spec-version",
        "1.5",
        "--override-filename",
        prefix,
      ],
      { env: { SOURCE_DATE_EPOCH: sourceDateEpoch } },
    );
    createdPaths.push(...findGeneratedCargoSboms(path.join(repositoryRoot, "src-tauri"), generatedFilename));
    if (createdPaths.length !== productionDependencies.size) {
      throw new Error(
        `cargo-cyclonedx produced ${createdPaths.length} documents for ${productionDependencies.size} workspace packages`,
      );
    }

    const staged = [];
    for (const sourcePath of createdPaths) {
      const sbom = normalizeCargoSbom(JSON.parse(readFileSync(sourcePath, "utf8")));
      const packageName = sbom.metadata?.component?.name;
      if (!productionDependencies.has(packageName)) {
        throw new Error(`unexpected Cargo SBOM root: ${packageName}`);
      }
      validateCycloneDxSbom(sbom, {
        expectedRoot: packageName,
        requiredDirectComponents: productionDependencies.get(packageName),
        excludedDirectComponents: excludedDirectCargoComponents,
        forbiddenText: [repositoryPath],
      });
      const filename = `cargo-${packageName}.cdx.json`;
      writeFileSync(path.join(stagingDirectory, filename), `${JSON.stringify(sbom, null, 2)}\n`);
      staged.push(filename);
    }
    return staged.sort((left, right) => left.localeCompare(right, "en"));
  } finally {
    const remainingPaths = findGeneratedCargoSboms(
      path.join(repositoryRoot, "src-tauri"),
      generatedFilename,
    );
    for (const generatedPath of new Set([...createdPaths, ...remainingPaths])) {
      rmSync(generatedPath, { force: true });
    }
  }
}

export function generatorVersions() {
  const npmCycloneDx = JSON.parse(
    readFileSync(path.join(repositoryRoot, "node_modules/@cyclonedx/cyclonedx-npm/package.json"), "utf8"),
  ).version;
  const tauri = JSON.parse(
    readFileSync(path.join(repositoryRoot, "node_modules/@tauri-apps/cli/package.json"), "utf8"),
  ).version;
  return { cargoCycloneDx: cargoCycloneDxVersion, npmCycloneDx, tauri };
}

export function scanStagedEvidence(stagingDirectory) {
  const gitleaks = run(path.join(repositoryRoot, "scripts/install-gitleaks.sh"), [], {
    capture: true,
  });
  run(gitleaks, [
    "dir",
    "--no-banner",
    "--no-color",
    "--redact",
    "--max-target-megabytes",
    "100",
    stagingDirectory,
  ]);
}

function main() {
  const version = process.argv[2];
  if (!version) throw new Error("usage: npm run prepare:development-release -- <version>");
  if (process.platform !== "darwin") throw new Error("development release preparation requires macOS");
  const releaseContracts = inspectReleaseContracts(repositoryRoot, version);
  inspectUpgradeMatrix(repositoryRoot);
  const reviewedReleaseNotes = readFileSync(
    path.join(repositoryRoot, releaseContracts.releaseNotesSource),
    "utf8",
  );
  const { revision, sourceDateEpoch } = assertCleanRevision();
  const architecture = macosArchitecture();
  const stagingRoot = path.join(repositoryRoot, ".artifacts/releases");
  const stagingDirectory = path.join(stagingRoot, `.${version}-${process.pid}.tmp`);
  const finalDirectory = path.join(stagingRoot, version);
  rmSync(stagingDirectory, { recursive: true, force: true });
  mkdirSync(stagingDirectory, { recursive: true });

  try {
    run("npm", ["run", "audit:dependencies"]);
    run("npm", ["run", "package"]);
    run("npm", ["run", "check:production-bundle"]);
    const dmgName = copyProductionArtifacts(stagingDirectory, version, architecture.tauri);
    const npmSbom = createNpmSbom(stagingDirectory, repositoryRoot);
    const cargoSboms = createCargoSboms(stagingDirectory, repositoryRoot, sourceDateEpoch);
    const upgradeMatrix = copyUpgradeMatrix(stagingDirectory);
    const evidenceFiles = [npmSbom, ...cargoSboms, upgradeMatrix];
    const artifacts = [
      inspectArtifact(stagingDirectory, "FitFreed.app", "macos-application-bundle"),
      inspectArtifact(stagingDirectory, dmgName, "macos-disk-image"),
      ...[npmSbom, ...cargoSboms].map((filename) =>
        inspectArtifact(stagingDirectory, filename, "cyclonedx-sbom"),
      ),
      inspectArtifact(stagingDirectory, upgradeMatrix, "upgrade-matrix"),
    ];
    const manifest = createReleaseManifest({
      version,
      revision,
      generatedAt: generatedAt(sourceDateEpoch),
      architecture: architecture.manifest,
      storageSchemaVersion: readStorageSchemaVersion(),
      generators: generatorVersions(),
      artifacts,
    });
    writeFileSync(
      path.join(stagingDirectory, "release-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    writeFileSync(
      path.join(stagingDirectory, "RELEASE_NOTES.md"),
      renderDraftReleaseNotes(manifest, reviewedReleaseNotes),
    );
    writeFileSync(
      path.join(stagingDirectory, "SHA256SUMS"),
      renderChecksumFile(stagingDirectory, [
        dmgName,
        ...evidenceFiles,
        "release-manifest.json",
        "RELEASE_NOTES.md",
      ]),
    );

    const stagedText = [
      ...evidenceFiles,
      "release-manifest.json",
      "RELEASE_NOTES.md",
      "SHA256SUMS",
    ]
      .map((filename) => readFileSync(path.join(stagingDirectory, filename), "utf8"))
      .join("\n");
    if (stagedText.includes(repositoryRoot) || stagedText.includes("file://")) {
      throw new Error("release evidence contains a machine-local path");
    }
    scanStagedEvidence(stagingDirectory);

    promoteStagedDirectory(stagingDirectory, finalDirectory, process.pid);
    process.stdout.write(
      `${JSON.stringify({ version, revision, outputDirectory: path.relative(repositoryRoot, finalDirectory) })}\n`,
    );
  } catch (error) {
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Release preparation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
