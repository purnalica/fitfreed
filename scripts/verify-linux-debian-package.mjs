import { execFileSync } from "node:child_process";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  expectedLinuxDebianArtifactName,
  linuxPackageContract,
} from "./linux-package-contract.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");

export function parseDebianControl(text) {
  const fields = {};
  let currentField;
  for (const line of text.replaceAll("\r\n", "\n").split("\n")) {
    if (/^[ \t]/.test(line)) {
      if (!currentField) throw new Error("Debian control has a continuation without a field");
      const continuation = line.slice(1) === "." ? "" : line.slice(1);
      fields[currentField] += `\n${continuation}`;
      continue;
    }
    if (line.length === 0) {
      currentField = undefined;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) throw new Error(`invalid Debian control line: ${line}`);
    currentField = line.slice(0, separator);
    fields[currentField] = line.slice(separator + 1).trimStart();
  }
  return fields;
}

export function dependencyNames(value) {
  return [...new Set(
    (value ?? "")
      .split(",")
      .flatMap((group) => group.split("|"))
      .map((entry) => entry.trim().match(/^([a-z0-9][a-z0-9+.-]*)/)?.[1])
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right, "en"));
}

function parseDesktopEntry(text) {
  const values = {};
  for (const rawLine of text.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#") || line.startsWith("[")) continue;
    const separator = line.indexOf("=");
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

export function validateLinuxDebianPackageFacts(facts, expectedVersion) {
  const errors = [];
  const expectedArtifactName = expectedLinuxDebianArtifactName(expectedVersion);
  if (path.basename(facts.packagePath) !== expectedArtifactName) {
    errors.push(`Debian artifact name must be ${expectedArtifactName}`);
  }
  const requiredControl = {
    Package: [linuxPackageContract.packageName, "package name"],
    Version: [expectedVersion, "package version"],
    Architecture: [linuxPackageContract.architecture, "package architecture"],
    Maintainer: [linuxPackageContract.publisher, "package maintainer"],
    Section: [linuxPackageContract.section, "package section"],
    Priority: [linuxPackageContract.priority, "package priority"],
    Homepage: [linuxPackageContract.homepage, "package homepage"],
  };
  for (const [field, [expected, label]] of Object.entries(requiredControl)) {
    if (facts.control[field] !== expected) errors.push(`${label} must be ${expected}`);
  }
  if (!facts.control.Description?.startsWith(linuxPackageContract.shortDescription)) {
    errors.push("package description must identify fitness-history exploration");
  }

  const dependencies = dependencyNames(facts.control.Depends);
  for (const required of linuxPackageContract.requiredDependencies) {
    if (!dependencies.includes(required)) errors.push(`package dependency ${required} is required`);
  }

  const entries = new Set(
    facts.entries.map((entry) => entry.replace(/^\.\//, "").replaceAll("\\", "/")),
  );
  if (!entries.has(linuxPackageContract.executablePath) || (facts.executableMode & 0o111) === 0) {
    errors.push("production executable must be installed and executable at usr/bin/fitfreed");
  }
  if (!entries.has(linuxPackageContract.desktopEntryPath)) {
    errors.push(`desktop entry must be installed at ${linuxPackageContract.desktopEntryPath}`);
  }
  const desktop = parseDesktopEntry(facts.desktopEntry);
  for (const [field, expected] of Object.entries({
    Type: "Application",
    Name: "FitFreed",
    Exec: "fitfreed",
    Icon: "fitfreed",
    Terminal: "false",
  })) {
    if (desktop[field] !== expected) errors.push(`desktop entry ${field} must be ${expected}`);
  }
  for (const icon of linuxPackageContract.requiredIconPaths) {
    if (!entries.has(icon)) errors.push(`application icons must include ${icon}`);
  }
  if (!entries.has(linuxPackageContract.licensePath)
      || !/GNU GENERAL PUBLIC LICENSE[\s\S]*Version 3/i.test(facts.licenseText)) {
    errors.push("GPL-3.0 license text must be installed with the package");
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return {
    architecture: facts.control.Architecture,
    dependencyNames: dependencies,
    packageName: facts.control.Package,
    version: facts.control.Version,
  };
}

export function findLinuxDebianPackage(directory, expectedVersion) {
  const packages = readdirSync(directory)
    .filter((entry) => entry.endsWith(".deb"))
    .map((entry) => path.join(directory, entry));
  if (packages.length !== 1) {
    throw new Error(`expected exactly one Debian artifact, found ${packages.length}`);
  }
  const expectedName = expectedLinuxDebianArtifactName(expectedVersion);
  if (path.basename(packages[0]) !== expectedName) {
    throw new Error(`Debian artifact name must be ${expectedName}`);
  }
  return packages[0];
}

function extractedEntries(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else entries.push(path.relative(root, absolutePath));
    }
  };
  visit(root);
  return entries;
}

export function inspectLinuxDebianPackage({
  platform = process.platform,
  releaseDirectory = path.join(repositoryRoot, "src-tauri/target/release/bundle/deb"),
  version = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8")).version,
} = {}) {
  if (platform !== "linux") throw new Error("Debian package inspection requires Linux");
  const packagePath = findLinuxDebianPackage(releaseDirectory, version);
  const extractionDirectory = mkdtempSync(path.join(tmpdir(), "fitfreed-deb-inspection-"));
  try {
    const control = parseDebianControl(
      execFileSync("dpkg-deb", ["--field", packagePath], { encoding: "utf8" }),
    );
    execFileSync("dpkg-deb", ["--extract", packagePath, extractionDirectory], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const executablePath = path.join(extractionDirectory, linuxPackageContract.executablePath);
    return validateLinuxDebianPackageFacts({
      packagePath,
      control,
      entries: extractedEntries(extractionDirectory),
      executableMode: lstatSync(executablePath).mode & 0o777,
      desktopEntry: readFileSync(
        path.join(extractionDirectory, linuxPackageContract.desktopEntryPath),
        "utf8",
      ),
      licenseText: readFileSync(
        path.join(extractionDirectory, linuxPackageContract.licensePath),
        "utf8",
      ),
    }, version);
  } finally {
    rmSync(extractionDirectory, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    process.stdout.write(`${JSON.stringify(inspectLinuxDebianPackage())}\n`);
  } catch (error) {
    process.stderr.write(`Linux Debian package verification failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
