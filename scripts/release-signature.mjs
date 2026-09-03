import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

const publicKeyLength = 42;
const signatureLength = 74;
const globalSignatureLength = 64;
const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");

function canonicalBase64(value, label) {
  if (
    typeof value !== "string"
    || value.length === 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  ) {
    throw new Error(`${label} is not canonical Base64`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new Error(`${label} is not canonical Base64`);
  }
  return bytes;
}

function exactLines(value, count, label) {
  if (typeof value !== "string" || value.includes("\r")) {
    throw new Error(`${label} must use canonical UTF-8 lines`);
  }
  const lines = value.endsWith("\n") ? value.slice(0, -1).split("\n") : value.split("\n");
  if (lines.length !== count || lines.some((line) => line.length === 0)) {
    throw new Error(`${label} has an invalid line structure`);
  }
  return lines;
}

function publicKeyBytes(publicKeyText) {
  const [comment, encodedKey] = exactLines(publicKeyText, 2, "Minisign public key");
  if (!comment.startsWith("untrusted comment: ")) {
    throw new Error("Minisign public key has no untrusted comment");
  }
  const bytes = canonicalBase64(encodedKey, "Minisign public key");
  if (bytes.length !== publicKeyLength || !["Ed", "ED"].includes(bytes.subarray(0, 2).toString())) {
    throw new Error("Minisign public key has an unsupported encoding");
  }
  return bytes;
}

function parsedSignature(signatureText, allowLegacy) {
  const [untrustedComment, encodedSignature, trustedComment, encodedGlobalSignature] =
    exactLines(signatureText, 4, "Minisign signature");
  if (!untrustedComment.startsWith("untrusted comment: ")) {
    throw new Error("Minisign signature has no untrusted comment");
  }
  if (!trustedComment.startsWith("trusted comment: ")) {
    throw new Error("Minisign signature has no trusted comment");
  }
  const signature = canonicalBase64(encodedSignature, "Minisign signature");
  const globalSignature = canonicalBase64(
    encodedGlobalSignature,
    "Minisign global signature",
  );
  if (signature.length !== signatureLength || globalSignature.length !== globalSignatureLength) {
    throw new Error("Minisign signature has an invalid byte length");
  }
  const algorithm = signature.subarray(0, 2).toString();
  if (algorithm !== "ED" && !(allowLegacy && algorithm === "Ed")) {
    throw new Error("Minisign signature algorithm is unsupported");
  }
  return {
    algorithm,
    globalSignature,
    keyId: signature.subarray(2, 10),
    signature: signature.subarray(10),
    trustedComment: trustedComment.slice("trusted comment: ".length),
  };
}

export function decodeTauriSignatureText(signatureBase64) {
  const bytes = canonicalBase64(signatureBase64, "Tauri signature wrapper");
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new Error("Tauri signature wrapper is not UTF-8");
  }
  exactLines(text, 4, "Minisign signature");
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function decodeReleasePublicKey(publicKeyBase64) {
  const bytes = canonicalBase64(publicKeyBase64, "release public key wrapper");
  const text = bytes.toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes)) {
    throw new Error("release public key wrapper is not UTF-8");
  }
  publicKeyBytes(text);
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function releasePublicKeyFingerprint(publicKeyBase64) {
  const publicKeyText = decodeReleasePublicKey(publicKeyBase64);
  return createHash("sha256")
    .update(publicKeyBytes(publicKeyText).subarray(10))
    .digest("hex");
}

export function verifyMinisign({
  payload,
  publicKeyText,
  signatureText,
  allowLegacy = false,
}) {
  if (!Buffer.isBuffer(payload)) throw new Error("Minisign payload must be a byte buffer");
  const key = publicKeyBytes(publicKeyText);
  const signature = parsedSignature(signatureText, allowLegacy);
  if (!key.subarray(2, 10).equals(signature.keyId)) {
    throw new Error("Minisign signature key does not match the trusted public key");
  }

  const publicKey = createPublicKey({
    format: "der",
    key: Buffer.concat([ed25519SpkiPrefix, key.subarray(10)]),
    type: "spki",
  });
  const signedPayload = signature.algorithm === "ED"
    ? createHash("blake2b512").update(payload).digest()
    : payload;
  if (!verifySignature(null, signedPayload, publicKey, signature.signature)) {
    throw new Error("Minisign payload signature is invalid");
  }
  const globalSubject = Buffer.concat([
    signature.signature,
    Buffer.from(signature.trustedComment, "utf8"),
  ]);
  if (!verifySignature(null, globalSubject, publicKey, signature.globalSignature)) {
    throw new Error("Minisign trusted-comment signature is invalid");
  }
  return { trustedComment: signature.trustedComment };
}
