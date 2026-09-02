import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeReleasePublicKey,
  decodeTauriSignatureText,
  verifyMinisign,
} from "./release-signature.mjs";

const publicKeyText = `untrusted comment: synthetic upstream Minisign verification key
RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3
`;
const signatureText = `untrusted comment: synthetic upstream Minisign signature
RUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=
trusted comment: timestamp:1556193335\tfile:test
y/rUw2y8/hOUYjZU71eHp/Wo1KZ40fGy2VJEDl34XMJM+TX48Ss/17u3IvIfbVR1FkZZSNCisQbuQY+bHwhEBg==
`;

test("verifies a complete prehashed Minisign signature", () => {
  assert.deepEqual(
    verifyMinisign({
      payload: Buffer.from("test"),
      publicKeyText,
      signatureText,
    }),
    { trustedComment: "timestamp:1556193335\tfile:test" },
  );
});

test("rejects payload, signature, key, and line-structure mutations", () => {
  assert.throws(
    () => verifyMinisign({
      payload: Buffer.from("mutated"),
      publicKeyText,
      signatureText,
    }),
    /payload signature is invalid/,
  );
  assert.throws(
    () => verifyMinisign({
      payload: Buffer.from("test"),
      publicKeyText,
      signatureText: signatureText.replace("timestamp:1556193335", "timestamp:1556193336"),
    }),
    /trusted-comment signature is invalid/,
  );
  const keyLines = publicKeyText.trimEnd().split("\n");
  const decodedKey = Buffer.from(keyLines[1], "base64");
  decodedKey[2] ^= 1;
  const differentKey = `${keyLines[0]}\n${decodedKey.toString("base64")}\n`;
  assert.throws(
    () => verifyMinisign({
      payload: Buffer.from("test"),
      publicKeyText: differentKey,
      signatureText,
    }),
    /public key|trusted public key/,
  );
  assert.throws(
    () => verifyMinisign({
      payload: Buffer.from("test"),
      publicKeyText,
      signatureText: `${signatureText}unexpected\n`,
    }),
    /line structure/,
  );
});

test("decodes only canonical Tauri signatures and configured public keys", () => {
  assert.equal(
    decodeTauriSignatureText(Buffer.from(signatureText).toString("base64")),
    signatureText,
  );
  assert.equal(
    decodeReleasePublicKey(Buffer.from(publicKeyText).toString("base64")),
    publicKeyText,
  );
  assert.throws(
    () => decodeTauriSignatureText(` ${Buffer.from(signatureText).toString("base64")}`),
    /canonical Base64/,
  );
  assert.throws(
    () => decodeReleasePublicKey(Buffer.from("not a key").toString("base64")),
    /line structure/,
  );
});
