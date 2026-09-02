import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";

function signatureText({ keyId, payload, privateKey, trustedComment }) {
  const payloadSignature = sign(
    null,
    createHash("blake2b512").update(payload).digest(),
    privateKey,
  );
  const signatureRecord = Buffer.concat([
    Buffer.from("ED"),
    keyId,
    payloadSignature,
  ]);
  const globalSignature = sign(
    null,
    Buffer.concat([payloadSignature, Buffer.from(trustedComment)]),
    privateKey,
  );
  return `untrusted comment: synthetic test signature
${signatureRecord.toString("base64")}
trusted comment: ${trustedComment}
${globalSignature.toString("base64")}
`;
}

export function createSyntheticMinisignAuthority() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const rawPublicKey = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  const keyId = Buffer.from("0102030405060708", "hex");
  const publicKeyText = `untrusted comment: synthetic test public key
${Buffer.concat([Buffer.from("Ed"), keyId, rawPublicKey]).toString("base64")}
`;
  return {
    publicKey: Buffer.from(publicKeyText).toString("base64"),
    signRelease(payload, filename = "SHA256SUMS") {
      return signatureText({
        keyId,
        payload,
        privateKey,
        trustedComment: `timestamp:0\tfile:${filename}`,
      });
    },
    signTauri(payload, filename) {
      return Buffer.from(signatureText({
        keyId,
        payload,
        privateKey,
        trustedComment: `timestamp:0\tfile:${filename}`,
      })).toString("base64");
    },
  };
}
