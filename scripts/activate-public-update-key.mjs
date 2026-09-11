import { randomUUID } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  publicUpdateBuildEnvironment,
  validatePublicUpdateConfiguration,
} from "./public-update-configuration.mjs";
import {
  decodeReleasePublicKey,
  releasePublicKeyFingerprint,
} from "./release-signature.mjs";

const keyIdentifierPattern = /^[a-z0-9][a-z0-9._-]*$/;

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function validatedExternalPublicKey(
  publicKeyPath,
  repositoryRoot,
  description = "public updater key",
) {
  if (!path.isAbsolute(publicKeyPath)) {
    throw new Error(`${description} path must be absolute`);
  }
  const keyMetadata = lstatSync(publicKeyPath);
  if (keyMetadata.isSymbolicLink() || !keyMetadata.isFile()) {
    throw new Error(`${description} must be a non-symbolic regular file`);
  }
  const resolvedKeyPath = realpathSync(publicKeyPath);
  const resolvedRepositoryRoot = realpathSync(repositoryRoot);
  if (isInside(resolvedRepositoryRoot, resolvedKeyPath)) {
    throw new Error(`${description} source must remain outside the repository`);
  }

  const rawKey = readFileSync(resolvedKeyPath, "utf8");
  const encodedKey = rawKey.endsWith("\n") ? rawKey.slice(0, -1) : rawKey;
  if (
    encodedKey.length === 0
    || encodedKey.includes("\n")
    || encodedKey.includes("\r")
    || encodedKey.trim() !== encodedKey
  ) {
    throw new Error(`${description} file is not canonical Base64 text`);
  }
  try {
    decodeReleasePublicKey(encodedKey);
  } catch (error) {
    throw new Error(`${description} is invalid: ${error.message}`);
  }
  return encodedKey;
}

export function writeConfigurationAtomically(configurationPath, configuration) {
  const temporaryPath = `${configurationPath}.${process.pid}.${randomUUID()}.tmp`;
  const mode = statSync(configurationPath).mode & 0o777;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(configuration, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode,
    });
    renameSync(temporaryPath, configurationPath);
  } catch (error) {
    try {
      unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    }
    throw error;
  }
}

export function activatePublicUpdateKey({
  configurationPath,
  keyId,
  publicKeyPath,
  repositoryRoot,
}) {
  if (
    typeof keyId !== "string"
    || keyId.length > 128
    || !keyIdentifierPattern.test(keyId)
  ) {
    throw new Error("public updater key identifier is invalid");
  }
  const publicKey = validatedExternalPublicKey(publicKeyPath, repositoryRoot);
  const configuration = validatePublicUpdateConfiguration(
    JSON.parse(readFileSync(configurationPath, "utf8")),
  );
  const fingerprint = releasePublicKeyFingerprint(publicKey);

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
    throw new Error("public update trust is already active; use the reviewed rotation procedure");
  }

  const activated = validatePublicUpdateConfiguration({
    ...configuration,
    status: "active",
    keys: [{ id: keyId, publicKey }],
  });
  publicUpdateBuildEnvironment(activated, true);
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
      throw new Error("usage: npm run activate:public-update-key -- <key-id> <absolute-public-key-path>");
    }
    const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const result = activatePublicUpdateKey({
      configurationPath: path.join(repositoryRoot, "release", "public-update-channel.json"),
      keyId: process.argv[2],
      publicKeyPath: process.argv[3],
      repositoryRoot,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`Public update key activation failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
