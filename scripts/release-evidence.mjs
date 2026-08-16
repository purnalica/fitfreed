import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const sha256Pattern = /^[0-9a-f]{64}$/;
const revisionPattern = /^[0-9a-f]{40,64}$/;
const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const artifactKinds = new Set([
  "macos-application-bundle",
  "macos-disk-image",
  "cyclonedx-sbom",
]);
const releaseManifestSchema = JSON.parse(
  readFileSync(new URL("../schemas/release-manifest-v1.schema.json", import.meta.url), "utf8"),
);
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateReleaseManifestSchema = ajv.compile(releaseManifestSchema);

function declaredLicense(component) {
  return component.licenses?.some(
    (entry) =>
      entry.expression?.trim() || entry.license?.id?.trim() || entry.license?.name?.trim(),
  );
}

function visitComponents(component, visitor) {
  visitor(component);
  for (const child of component.components ?? []) visitComponents(child, visitor);
}

export function normalizeCargoSbom(sbom) {
  const replacements = new Map();
  const roots = [sbom.metadata?.component, ...(sbom.components ?? [])].filter(Boolean);

  for (const root of roots) {
    const normalizeComponent = (component, parentReference, index) => {
      const reference = component["bom-ref"];
      const isLocal =
        reference?.startsWith("path+file://") || component.purl?.includes("download_url=file://");
      const canonicalReference = parentReference
        ? `${parentReference}#target-${index}-${encodeURIComponent(component.name)}`
        : `pkg:cargo/${component.name}@${component.version}`;
      if (isLocal || parentReference) {
        if (reference) replacements.set(reference, canonicalReference);
        component["bom-ref"] = canonicalReference;
        component.purl = canonicalReference;
      }
      const childParentReference = isLocal || parentReference ? canonicalReference : undefined;
      for (const [childIndex, child] of (component.components ?? []).entries()) {
        child.licenses ??= component.licenses;
        normalizeComponent(child, childParentReference, childIndex);
      }
    };
    normalizeComponent(root);
  }

  for (const dependency of sbom.dependencies ?? []) {
    dependency.ref = replacements.get(dependency.ref) ?? dependency.ref;
    dependency.dependsOn = (dependency.dependsOn ?? []).map(
      (reference) => replacements.get(reference) ?? reference,
    );
  }

  return sbom;
}

export function validateCycloneDxSbom(
  sbom,
  { expectedRoot, requiredComponents = [], excludedComponents = [], forbiddenText = [] },
) {
  const errors = [];
  if (sbom.bomFormat !== "CycloneDX") errors.push("SBOM format must be CycloneDX");
  if (sbom.specVersion !== "1.5") errors.push("SBOM specification must be version 1.5");
  if (sbom.metadata?.component?.name !== expectedRoot) {
    errors.push(`SBOM root must be ${expectedRoot}`);
  }

  const components = [];
  for (const root of [sbom.metadata?.component, ...(sbom.components ?? [])].filter(Boolean)) {
    visitComponents(root, (component) => components.push(component));
  }
  const names = new Set(
    components.flatMap(({ group, name }) => (group ? [name, `${group}/${name}`] : [name])),
  );
  for (const required of requiredComponents) {
    if (!names.has(required)) errors.push(`SBOM is missing production component ${required}`);
  }
  for (const excluded of excludedComponents) {
    if (names.has(excluded)) errors.push(`SBOM contains excluded development component ${excluded}`);
  }
  for (const component of components) {
    if (!declaredLicense(component)) {
      errors.push(`SBOM component ${component.name}@${component.version} has no declared license`);
    }
  }

  const serialized = JSON.stringify(sbom);
  for (const forbidden of ["file://", ...forbiddenText].filter(Boolean)) {
    if (serialized.includes(forbidden)) errors.push(`SBOM contains forbidden local text: ${forbidden}`);
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { root: expectedRoot, componentCount: components.length - 1 };
}

export function sha256File(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function inspectArtifact(root, relativePath, kind) {
  const absolutePath = path.join(root, relativePath);
  const metadata = lstatSync(absolutePath);
  if (metadata.isFile()) {
    return {
      path: relativePath,
      kind,
      size: metadata.size,
      sha256: sha256File(absolutePath),
    };
  }
  if (!metadata.isDirectory()) throw new Error(`unsupported release artifact: ${relativePath}`);

  const digest = createHash("sha256");
  let size = 0;
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name, "en"),
    )) {
      const entryPath = path.join(directory, entry.name);
      const relativeEntry = path.posix.join(prefix, entry.name);
      const entryMetadata = lstatSync(entryPath);
      if (entry.isDirectory()) {
        walk(entryPath, relativeEntry);
      } else if (entry.isFile()) {
        const content = readFileSync(entryPath);
        size += content.length;
        digest.update(`file\0${relativeEntry}\0${entryMetadata.mode & 0o777}\0${content.length}\0`);
        digest.update(content);
      } else if (entry.isSymbolicLink()) {
        const target = readlinkSync(entryPath);
        digest.update(`link\0${relativeEntry}\0${target}\0`);
      } else {
        throw new Error(`unsupported entry in release artifact: ${relativeEntry}`);
      }
    }
  };
  walk(absolutePath, relativePath);
  return { path: relativePath, kind, size, sha256: digest.digest("hex") };
}

export function createReleaseManifest({
  version,
  revision,
  generatedAt,
  architecture,
  storageSchemaVersion,
  generators,
  artifacts,
}) {
  const manifest = {
    format: "org.fitfreed.release-manifest",
    schemaVersion: 1,
    release: {
      version,
      revision,
      generatedAt,
      channel: "private-development",
      signed: false,
      notarized: false,
    },
    target: { os: "macos", architecture },
    application: {
      productName: "FitFreed",
      bundleIdentifier: "org.fitfreed.desktop",
      executable: "fitfreed",
      storageSchemaVersion,
    },
    generators,
    artifacts: [...artifacts].sort((left, right) => left.path.localeCompare(right.path, "en")),
  };
  validateReleaseManifest(manifest);
  return manifest;
}

export function validateReleaseManifest(manifest) {
  const errors = [];
  if (!validateReleaseManifestSchema(manifest)) {
    errors.push(
      ...validateReleaseManifestSchema.errors.map(
        ({ instancePath, message }) =>
          `manifest schema violation at ${instancePath || "/"}: ${message}`,
      ),
    );
  }
  if (manifest.format !== "org.fitfreed.release-manifest") errors.push("invalid manifest format");
  if (manifest.schemaVersion !== 1) errors.push("unsupported manifest schema version");
  if (!semanticVersionPattern.test(manifest.release?.version ?? "")) errors.push("invalid release version");
  if (!revisionPattern.test(manifest.release?.revision ?? "")) errors.push("invalid Git revision");
  if (Number.isNaN(Date.parse(manifest.release?.generatedAt ?? ""))) {
    errors.push("invalid release generation time");
  }
  if (manifest.release?.channel !== "private-development") errors.push("invalid release channel");
  if (manifest.release?.signed !== false || manifest.release?.notarized !== false) {
    errors.push("development release must be unsigned and non-notarized");
  }
  if (manifest.target?.os !== "macos") errors.push("release target must be macOS");
  if (!["aarch64", "x86_64"].includes(manifest.target?.architecture)) {
    errors.push("unsupported macOS architecture");
  }
  if (manifest.application?.bundleIdentifier !== "org.fitfreed.desktop") {
    errors.push("invalid application bundle identifier");
  }
  if (manifest.application?.productName !== "FitFreed") errors.push("invalid product name");
  if (manifest.application?.executable !== "fitfreed") errors.push("invalid application executable");
  if (
    !Number.isInteger(manifest.application?.storageSchemaVersion) ||
    manifest.application.storageSchemaVersion < 1
  ) {
    errors.push("invalid storage schema version");
  }
  for (const generator of ["cargoCycloneDx", "npmCycloneDx", "tauri"]) {
    if (!manifest.generators?.[generator]?.trim()) errors.push(`missing generator version: ${generator}`);
  }

  const paths = new Set();
  const kinds = new Map();
  for (const artifact of manifest.artifacts ?? []) {
    if (
      !artifact.path ||
      path.isAbsolute(artifact.path) ||
      artifact.path.includes("/") ||
      artifact.path.split("/").includes("..")
    ) {
      errors.push(`invalid artifact path: ${artifact.path}`);
    }
    if (paths.has(artifact.path)) errors.push(`duplicate artifact path: ${artifact.path}`);
    paths.add(artifact.path);
    if (!artifactKinds.has(artifact.kind)) errors.push(`invalid artifact kind: ${artifact.kind}`);
    kinds.set(artifact.kind, (kinds.get(artifact.kind) ?? 0) + 1);
    if (!Number.isInteger(artifact.size) || artifact.size < 0) {
      errors.push(`invalid artifact size: ${artifact.path}`);
    }
    if (!sha256Pattern.test(artifact.sha256 ?? "")) {
      errors.push(`invalid artifact digest: ${artifact.path}`);
    }
  }
  if (paths.size === 0) errors.push("release manifest has no artifacts");
  for (const requiredKind of artifactKinds) {
    if (!kinds.has(requiredKind)) errors.push(`release manifest has no ${requiredKind}`);
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return manifest;
}

export function renderChecksumFile(root, relativePaths) {
  return [...relativePaths]
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((relativePath) => `${sha256File(path.join(root, relativePath))}  ${relativePath}`)
    .join("\n") + "\n";
}

export function renderDraftReleaseNotes(manifest) {
  return `# FitFreed ${manifest.release.version} private development package

Source revision: \`${manifest.release.revision}\`
Target: macOS ${manifest.target.architecture}
Storage schema: ${manifest.application.storageSchemaVersion}

This package is unsigned, non-notarized development material. It is not a public release and is provided without warranty under the project disclaimer. Verify \`SHA256SUMS\` before mounting the disk image.
`;
}

export function promoteStagedDirectory(stagingDirectory, finalDirectory, operationId) {
  const previousDirectory = `${finalDirectory}.previous-${operationId}`;
  rmSync(previousDirectory, { recursive: true, force: true });
  const hadPrevious = existsSync(finalDirectory);
  if (hadPrevious) renameSync(finalDirectory, previousDirectory);
  try {
    renameSync(stagingDirectory, finalDirectory);
  } catch (error) {
    if (hadPrevious) renameSync(previousDirectory, finalDirectory);
    throw error;
  }
  rmSync(previousDirectory, { recursive: true, force: true });
}
