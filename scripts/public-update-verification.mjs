import { readFileSync } from "node:fs";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { publicUpdateUrl } from "./public-origin.mjs";
import { validatePublicUpdateConfiguration } from "./public-update-configuration.mjs";
import {
  decodeReleasePublicKey,
  decodeTauriSignatureText,
  verifyMinisign,
} from "./release-signature.mjs";
import {
  deriveRecoveryArtifactRequirements,
  validateStableUpdateV3Envelope,
  validateStableUpdateV3Payload,
} from "./update-channel-v3.mjs";

function validators() {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return {
    envelope: ajv.compile(JSON.parse(readFileSync(
      new URL("../schemas/update-channel-envelope-v2.schema.json", import.meta.url),
      "utf8",
    ))),
    payload: ajv.compile(JSON.parse(readFileSync(
      new URL("../schemas/update-channel-payload-v2.schema.json", import.meta.url),
      "utf8",
    ))),
    errorsText: (errors) => ajv.errorsText(errors),
  };
}

const updateValidators = validators();

function onlyArtifact(manifest, kind) {
  const matches = manifest.artifacts.filter((artifact) => artifact.kind === kind);
  if (matches.length !== 1) throw new Error(`public release must contain exactly one ${kind}`);
  return matches[0];
}

function validateUpdateDocument(validator, document, name) {
  if (!validator(document)) {
    throw new Error(`${name} failed its JSON Schema: ${updateValidators.errorsText(validator.errors)}`);
  }
}

export function verifyStableUpdateEvidence({
  releaseDirectory,
  manifest,
  publicUpdateConfiguration,
  packageKind,
  signatureKind = "updater-signature",
  target,
  upgradeMatrix,
}) {
  const configuration = validatePublicUpdateConfiguration(publicUpdateConfiguration);
  if (configuration.status !== "active") throw new Error("public update channel is inactive");
  if (manifest.update.contract !== configuration.contract) {
    throw new Error("public release and update configuration contracts do not match");
  }
  const envelopeArtifact = onlyArtifact(manifest, "stable-update-envelope");
  const packageArtifact = onlyArtifact(manifest, packageKind);
  const signatureArtifact = onlyArtifact(manifest, signatureKind);
  const envelope = JSON.parse(
    readFileSync(path.join(releaseDirectory, envelopeArtifact.path), "utf8"),
  );
  if (configuration.contract === "stable-v2") {
    validateUpdateDocument(updateValidators.envelope, envelope, "stable envelope");
  }
  const payloadBytes = Buffer.from(envelope.fitfreed.payloadBase64, "base64");
  if (payloadBytes.toString("base64") !== envelope.fitfreed.payloadBase64) {
    throw new Error("stable payload uses a non-canonical Base64 representation");
  }
  const payload = JSON.parse(payloadBytes.toString("utf8"));
  if (configuration.contract === "stable-v3") {
    const expectedRecoveryArtifacts = deriveRecoveryArtifactRequirements(upgradeMatrix);
    validateStableUpdateV3Payload(payload, expectedRecoveryArtifacts);
    validateStableUpdateV3Envelope(envelope, payload);
  } else {
    validateUpdateDocument(updateValidators.payload, payload, "stable payload");
  }

  const trustedKey = configuration.keys.find(({ id }) => id === envelope.fitfreed.keyId);
  if (!trustedKey || envelope.fitfreed.keyId !== manifest.update.keyId) {
    throw new Error("stable key identifier is outside configured trust");
  }
  const publicKeyText = decodeReleasePublicKey(trustedKey.publicKey);
  verifyMinisign({
    payload: payloadBytes,
    publicKeyText,
    signatureText: decodeTauriSignatureText(envelope.fitfreed.signatureBase64),
  });

  const packageSignature = readFileSync(
    path.join(releaseDirectory, signatureArtifact.path),
    "utf8",
  ).trim();
  verifyMinisign({
    payload: readFileSync(path.join(releaseDirectory, packageArtifact.path)),
    publicKeyText,
    signatureText: decodeTauriSignatureText(packageSignature),
  });

  const selectedTarget = payload.release.platforms[target];
  const selectedMirror = envelope.platforms[target];
  if (!selectedTarget || !selectedMirror) throw new Error(`stable update target is absent: ${target}`);
  const expectedUrl = publicUpdateUrl(`${manifest.release.version}/${packageArtifact.path}`);
  if (envelope.version !== manifest.release.version) throw new Error("stable envelope version mismatch");
  if (payload.release.version !== manifest.release.version) throw new Error("stable payload version mismatch");
  if (payload.sequence !== manifest.update.sequence) throw new Error("stable sequence mismatch");
  if (selectedTarget.url !== expectedUrl) throw new Error("stable updater URL mismatch");
  if (selectedTarget.size !== packageArtifact.size) throw new Error("stable updater size mismatch");
  if (selectedTarget.sha256 !== packageArtifact.sha256) throw new Error("stable updater digest mismatch");
  if (selectedTarget.tauriSignature !== packageSignature) {
    throw new Error("stable updater detached signature mismatch");
  }
  if (
    selectedMirror.url !== selectedTarget.url
    || selectedMirror.signature !== selectedTarget.tauriSignature
  ) {
    throw new Error("stable Tauri compatibility mirror mismatch");
  }
  if (payload.release.librarySchema.targetVersion !== manifest.application.storageSchemaVersion) {
    throw new Error("stable target storage schema mismatch");
  }
  for (const [platform, platformEvidence] of Object.entries(payload.release.platforms)) {
    const mirror = envelope.platforms[platform];
    if (
      !mirror
      || mirror.url !== platformEvidence.url
      || mirror.signature !== platformEvidence.tauriSignature
    ) {
      throw new Error("stable Tauri compatibility target set mismatch");
    }
  }
  if (
    Object.keys(envelope.platforms).length
    !== Object.keys(payload.release.platforms).length
  ) {
    throw new Error("stable Tauri compatibility target set mismatch");
  }
  return { envelope, payload };
}
