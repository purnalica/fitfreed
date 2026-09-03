import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { compareSemanticVersions } from "./upgrade-matrix.mjs";

const schema = JSON.parse(
  readFileSync(new URL("../schemas/update-recovery-v3.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const semanticVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;
const transitions = new Map([
  ["prepared", new Set(["replacement-started"])],
  ["replacement-started", new Set(["replacement-installed", "recovering"])],
  ["replacement-installed", new Set(["launching", "recovering"])],
  ["launching", new Set(["confirmed", "recovering"])],
  ["recovering", new Set(["recovered", "native-recovery-unavailable", "recovery-failed"])],
  ["native-recovery-unavailable", new Set(["recovering"])],
  ["confirmed", new Set()],
  ["recovered", new Set()],
  ["recovery-failed", new Set()],
]);

function credentialFreeHttps(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.username === ""
      && url.password === ""
      && url.search === ""
      && url.hash === "";
  } catch {
    return false;
  }
}

function sameWindowsPath(left, right) {
  return typeof left === "string"
    && typeof right === "string"
    && left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
}

function childWindowsPath(parent, name) {
  return typeof parent === "string" ? `${parent}\\${name}` : "";
}

export function validateWindowsUpdateRecoveryV3(manifest) {
  const errors = [];
  if (!validateSchema(manifest)) {
    errors.push(
      ...validateSchema.errors.map(
        ({ instancePath, message }) =>
          `Windows update recovery v3 schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }

  const nativePackage = manifest?.source?.nativePackage;
  if (nativePackage?.version !== manifest?.source?.version) {
    errors.push("source native package version must match the source application version");
  }
  if (manifest?.predecessorPackage?.version !== manifest?.source?.version) {
    errors.push("predecessor package version must match the source application version");
  }
  if (manifest?.targetPackage?.version !== manifest?.target?.version) {
    errors.push("target package version must match the target application version");
  }
  const sourceVersion = manifest?.source?.version ?? "";
  const targetVersion = manifest?.target?.version ?? "";
  if (
    semanticVersion.test(sourceVersion)
    && semanticVersion.test(targetVersion)
    && compareSemanticVersions(targetVersion, sourceVersion) <= 0
  ) {
    errors.push("target application version must be newer than the source");
  }
  if ((manifest?.target?.librarySchemaVersion ?? 0) < (manifest?.source?.librarySchemaVersion ?? 1)) {
    errors.push("target library schema cannot precede the source schema");
  }
  if (
    manifest?.runnablePredecessor?.sourcePackageSha256
    !== manifest?.predecessorPackage?.sha256
  ) {
    errors.push("runnable predecessor must bind the predecessor package digest");
  }
  for (const packageEvidence of [manifest?.predecessorPackage, manifest?.targetPackage]) {
    if (!credentialFreeHttps(packageEvidence?.sourceUrl)) {
      errors.push("preserved package URL must be credential-free HTTPS without a query or fragment");
    }
  }

  if (
    !sameWindowsPath(
      nativePackage?.executablePath,
      childWindowsPath(nativePackage?.installDirectory, "fitfreed.exe"),
    )
  ) {
    errors.push("native executable path must belong to the recorded install directory");
  }
  if (
    !sameWindowsPath(
      nativePackage?.uninstallerPath,
      childWindowsPath(nativePackage?.installDirectory, "uninstall.exe"),
    )
  ) {
    errors.push("native uninstaller path must belong to the recorded install directory");
  }
  if (
    !sameWindowsPath(
      manifest?.source?.libraryPath,
      childWindowsPath(nativePackage?.applicationDataDirectory, "fitfreed.sqlite"),
    )
  ) {
    errors.push("source library path must belong to the recorded application-data directory");
  }

  const phase = manifest?.phase;
  const process = manifest?.replacementProcess;
  if (["launching", "confirmed"].includes(phase) && process === null) {
    errors.push(`${phase} requires replacement process evidence`);
  }
  if (["prepared", "replacement-started", "replacement-installed"].includes(phase) && process !== null) {
    errors.push(`${phase} cannot contain replacement process evidence`);
  }
  if (
    process !== null
    && !sameWindowsPath(process?.executablePath, nativePackage?.executablePath)
  ) {
    errors.push("replacement executable path must match the native package executable");
  }

  const attempts = manifest?.nativeRecovery?.attempts;
  const failure = manifest?.nativeRecovery?.lastFailure;
  if (
    ["prepared", "replacement-started", "replacement-installed", "launching", "confirmed"].includes(phase)
    && (attempts !== 0 || failure !== null)
  ) {
    errors.push(`${phase} cannot contain a native rollback attempt`);
  }
  if (phase === "native-recovery-unavailable" && (!(attempts >= 1) || failure === null)) {
    errors.push("unavailable native recovery requires a persisted failed attempt");
  }
  if (phase === "recovery-failed" && (attempts !== 3 || failure === null)) {
    errors.push("failed native recovery requires three persisted attempts and a failure reason");
  }
  if (phase === "recovered" && (!(attempts >= 1) || failure !== null)) {
    errors.push("recovered native state requires a successful persisted attempt");
  }
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return manifest;
}

export function assertWindowsUpdateRecoveryTransition(currentPhase, nextPhase) {
  const permitted = transitions.get(currentPhase);
  if (!permitted || !transitions.has(nextPhase) || !permitted.has(nextPhase)) {
    throw new Error(`invalid Windows update recovery transition: ${currentPhase} -> ${nextPhase}`);
  }
  return nextPhase;
}
