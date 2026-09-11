import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  validatedExternalPublicKey,
  writeConfigurationAtomically,
} from "./activate-public-update-key.mjs";
import {
  validatePublicReleaseSigningConfiguration,
} from "./public-release-signing-configuration.mjs";
import { loadPublicUpdateConfiguration } from "./public-update-configuration.mjs";
import { releasePublicKeyFingerprint } from "./release-signature.mjs";

const keyIdentifierPattern = /^[a-z0-9][a-z0-9._-]*$/u;

export function activatePublicReleaseKey({
  configurationPath,
  keyId,
  publicKeyPath,
  repositoryRoot,
  updateConfiguration,
}) {
  if (
    typeof keyId !== "string"
    || keyId.length > 128
    || !keyIdentifierPattern.test(keyId)
  ) {
    throw new Error("public release-checksum key identifier is invalid");
  }
  const publicKey = validatedExternalPublicKey(
    publicKeyPath,
    repositoryRoot,
    "public release-checksum key",
  );
  const configuration = validatePublicReleaseSigningConfiguration(
    JSON.parse(readFileSync(configurationPath, "utf8")),
  );
  const fingerprint = releasePublicKeyFingerprint(publicKey);
  if ((updateConfiguration?.keys ?? []).some(
    ({ publicKey: updateKey }) => releasePublicKeyFingerprint(updateKey) === fingerprint,
  )) {
    throw new Error("public update and release-checksum keys must be independent");
  }

  if (configuration.status === "active") {
    if (
      configuration.keys.length === 1
      && configuration.keys[0].id === keyId
      && configuration.keys[0].publicKey === publicKey
    ) {
      return {
        changed: false,
        fingerprint,
        keyCount: 1,
        keyId,
        status: "active",
      };
    }
    throw new Error("public release-checksum trust is already active; use the reviewed rotation procedure");
  }

  const activated = validatePublicReleaseSigningConfiguration({
    ...configuration,
    status: "active",
    keys: [{ id: keyId, publicKey }],
  });
  writeConfigurationAtomically(configurationPath, activated);
  return {
    changed: true,
    fingerprint,
    keyCount: activated.keys.length,
    keyId,
    status: activated.status,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    if (process.argv.length !== 4) {
      throw new Error(
        "usage: npm run activate:public-release-key -- <key-id> <absolute-public-key-path>",
      );
    }
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const result = activatePublicReleaseKey({
      configurationPath: path.join(
        repositoryRoot,
        "release",
        "public-release-signing.json",
      ),
      keyId: process.argv[2],
      publicKeyPath: process.argv[3],
      repositoryRoot,
      updateConfiguration: loadPublicUpdateConfiguration(repositoryRoot),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Public release key activation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
