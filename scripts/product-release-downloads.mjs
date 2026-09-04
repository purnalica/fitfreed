import path from "node:path";

import { expectedLinuxDebianArtifactName } from "./linux-package-contract.mjs";
import { expectedWindowsNsisArtifactName } from "./windows-package-contract.mjs";

const repositoryReleases = "https://github.com/purnalica/fitfreed/releases/";
const semanticVersion =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const platformContracts = Object.freeze({
  "darwin-aarch64": Object.freeze({
    artifactKind: "macos-disk-image",
    key: "macos",
    name: (version) => `FitFreed_${version}_aarch64.dmg`,
  }),
  "linux-x86_64-deb": Object.freeze({
    artifactKind: "linux-x86_64-deb",
    key: "linux",
    name: expectedLinuxDebianArtifactName,
  }),
  "windows-x86_64-nsis": Object.freeze({
    artifactKind: "windows-x86_64-nsis",
    key: "windows",
    name: expectedWindowsNsisArtifactName,
  }),
});

const manifestTargets = Object.freeze({
  3: Object.freeze(["darwin-aarch64"]),
  6: Object.freeze(["darwin-aarch64", "linux-x86_64-deb"]),
  7: Object.freeze([
    "darwin-aarch64",
    "linux-x86_64-deb",
    "windows-x86_64-nsis",
  ]),
});

function releaseAssetUrl(version, filename) {
  return new URL(
    `download/v${encodeURIComponent(version)}/${encodeURIComponent(filename)}`,
    repositoryReleases,
  ).toString();
}

function onlyArtifact(manifest, contract, version) {
  const artifacts = Array.isArray(manifest.artifacts)
    ? manifest.artifacts.filter(({ kind }) => kind === contract.artifactKind)
    : [];
  if (artifacts.length !== 1) {
    throw new Error(
      `public release download evidence must contain exactly one ${contract.artifactKind}`,
    );
  }
  const [artifact] = artifacts;
  const expectedName = contract.name(version);
  if (
    artifact.path !== expectedName
    || path.posix.basename(artifact.path) !== artifact.path
  ) {
    throw new Error(
      `public release download evidence requires the flat safe filename ${expectedName}`,
    );
  }
  return artifact;
}

export function createProductReleaseDownloads(manifest) {
  const targets = manifestTargets[manifest?.schemaVersion];
  if (targets === undefined) throw new Error("unsupported public release manifest");
  const version = manifest?.release?.version;
  if (
    manifest?.release?.channel !== "public-stable"
    || !semanticVersion.test(version ?? "")
  ) {
    throw new Error("product downloads require a public stable release");
  }
  const declaredTargets = manifest.schemaVersion === 3
    ? targets
    : manifest?.update?.targets;
  if (JSON.stringify(declaredTargets) !== JSON.stringify(targets)) {
    throw new Error("public release download target set does not match its manifest version");
  }
  const platforms = targets.map((target) => {
    const contract = platformContracts[target];
    const artifact = onlyArtifact(manifest, contract, version);
    return {
      artifact: artifact.path,
      key: contract.key,
      target,
      url: releaseAssetUrl(version, artifact.path),
    };
  });
  return {
    platforms,
    releaseUrl: new URL(`tag/v${encodeURIComponent(version)}`, repositoryReleases).toString(),
    version,
  };
}
