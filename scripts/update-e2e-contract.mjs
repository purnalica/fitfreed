export function assertSyntheticUpdateBoundary(matrixSummary) {
  if (matrixSummary.applicationBaselineCount > 0) {
    throw new Error(
      "Packaged update E2E must derive packaged cases from every declared application baseline",
    );
  }
  return {
    evidence: "synthetic-updater-mechanics",
    declaredApplicationBaselines: matrixSummary.applicationBaselineCount,
  };
}

export function updateTarget(platform, architecture) {
  if (platform === "darwin") {
    if (architecture === "arm64") return "darwin-aarch64";
    if (architecture === "x64") return "darwin-x86_64";
    throw new Error(`Unsupported macOS architecture: ${architecture}`);
  }
  if (platform === "linux") {
    if (architecture === "x64") return "linux-x86_64-deb";
    throw new Error(`Unsupported Linux architecture: ${architecture}`);
  }
  if (platform === "win32") {
    if (architecture === "x64") return "windows-x86_64-nsis";
    throw new Error(`Unsupported Windows architecture: ${architecture}`);
  }
  throw new Error(`Unsupported packaged update E2E platform: ${platform}`);
}

export function createUpdateBuildConfiguration({
  version,
  createUpdaterArtifacts,
  publicKey,
  productionIdentifier,
  bundleTarget = "app",
}) {
  if (typeof productionIdentifier !== "string" || productionIdentifier.trim() === "") {
    throw new Error("The production application identifier is required");
  }
  if (!["app", "deb", "nsis"].includes(bundleTarget)) {
    throw new Error("The packaged update E2E bundle target is unsupported");
  }
  return {
    identifier: productionIdentifier,
    version,
    bundle: {
      targets: [bundleTarget],
      createUpdaterArtifacts,
    },
    plugins: {
      updater: {
        pubkey: publicKey,
        endpoints: [],
      },
    },
  };
}

export function createUpdatePayload({
  contractSchemaVersion = 1,
  channel = "private-alpha",
  sequence = 1,
  releaseVersion = "0.2.0",
  issuedAt,
  publishedAt = issuedAt,
  minimumSupportedVersion = "0.1.0",
  releaseNotes = {
    "en-US": "Synthetic packaged update acceptance release.",
    "es-ES": "Versión sintética para aceptar la actualización empaquetada.",
  },
  withdrawnVersions = [],
  platforms,
  target,
  packageUrl,
  packageSize,
  packageSha256,
  packageSignature,
  minimumReadableSchemaVersion,
  schemaVersion,
  maximumReadableSchemaVersion = schemaVersion,
  targetSchemaVersion = schemaVersion,
  expiresAt,
}) {
  return {
    format: "org.fitfreed.update-channel",
    schemaVersion: contractSchemaVersion,
    channel,
    sequence,
    issuedAt,
    expiresAt,
    release: {
      version: releaseVersion,
      publishedAt,
      minimumSupportedVersion,
      librarySchema: {
        minimumReadableVersion: minimumReadableSchemaVersion,
        maximumReadableVersion: maximumReadableSchemaVersion,
        targetVersion: targetSchemaVersion,
      },
      releaseNotes,
      platforms: platforms ?? {
        [target]: {
          url: packageUrl,
          size: packageSize,
          sha256: packageSha256,
          tauriSignature: packageSignature,
        },
      },
    },
    withdrawnVersions,
  };
}

export function createUpdateEnvelope({
  payload,
  payloadBytes,
  metadataSignature,
  keyId,
}) {
  const platforms = Object.fromEntries(
    Object.entries(payload.release.platforms).map(([target, artifact]) => [
      target,
      {
        url: artifact.url,
        signature: artifact.tauriSignature,
      },
    ]),
  );
  return {
    version: payload.release.version,
    platforms,
    fitfreed: {
      format: "org.fitfreed.update-envelope",
      schemaVersion: payload.schemaVersion,
      algorithm: "minisign-ed25519",
      keyId,
      payloadBase64: payloadBytes.toString("base64"),
      signatureBase64: metadataSignature,
    },
  };
}
