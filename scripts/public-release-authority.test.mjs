import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  cleanPublicReleaseAuthority,
  installPublicReleaseAuthority,
} from "./public-release-authority.mjs";

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-release-authority-"));
  const repositoryPath = path.join(root, "repository");
  const runnerTemp = path.join(root, "runner");
  const githubEnvironmentPath = path.join(runnerTemp, "github-environment");
  mkdirSync(repositoryPath);
  mkdirSync(runnerTemp);
  writeFileSync(githubEnvironmentPath, "");
  const signingIdentity = "a".repeat(40);
  const privateKey = `${["-----BEGIN", "PRIVATE KEY-----"].join(" ")}\nsynthetic\n`
    + `${["-----END", "PRIVATE KEY-----"].join(" ")}\n`;
  const environment = {
    RUNNER_TEMP: runnerTemp,
    GITHUB_ENV: githubEnvironmentPath,
    FITFREED_APPLE_CERTIFICATE_BASE64: Buffer.from("synthetic certificate").toString("base64"),
    FITFREED_APPLE_CERTIFICATE_PASSWORD: "synthetic certificate password",
    APPLE_SIGNING_IDENTITY: signingIdentity,
    FITFREED_EXPECTED_APPLE_TEAM_ID: "A1B2C3D4E5",
    APPLE_API_ISSUER: "11111111-2222-3333-4444-555555555555",
    APPLE_API_KEY: "A1B2C3D4E5",
    FITFREED_APPLE_API_PRIVATE_KEY: privateKey,
    FITFREED_UPDATER_PRIVATE_KEY: "synthetic encrypted updater authority",
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "synthetic updater password",
  };
  const calls = [];
  const runSecurity = (args) => {
    calls.push(args);
    if (args[0] === "default-keychain" && args.length === 3) {
      return path.join(runnerTemp, "login.keychain-db");
    }
    if (args[0] === "list-keychains" && args.length === 3) {
      return `"${path.join(runnerTemp, "login.keychain-db")}"`;
    }
    if (args[0] === "find-identity") return `  1) ${signingIdentity.toUpperCase()} "Synthetic"`;
    return "";
  };
  return {
    calls,
    environment,
    githubEnvironmentPath,
    repositoryPath,
    runSecurity,
    runnerTemp,
    signingIdentity,
  };
}

test("materializes protected inputs only in a private runner directory", () => {
  const input = fixture();
  const result = installPublicReleaseAuthority(input.environment, {
    repositoryPath: input.repositoryPath,
    runSecurity: input.runSecurity,
    createPassword: () => "e".repeat(64),
  });

  assert.equal(result.signingIdentity, input.signingIdentity);
  assert.equal(result.notarizationMode, "app-store-connect-api");
  assert.equal(path.dirname(result.authorityDirectory), realpathSync(input.runnerTemp));
  for (const filename of [
    "developer-id.p12",
    "AuthKey_A1B2C3D4E5.p8",
    "updater.key",
    "state.json",
  ]) {
    const materialized = path.join(result.authorityDirectory, filename);
    assert.equal(statSync(materialized).mode & 0o777, 0o600);
  }

  const githubEnvironment = readFileSync(input.githubEnvironmentPath, "utf8");
  assert.match(githubEnvironment, new RegExp(`APPLE_SIGNING_IDENTITY=${input.signingIdentity}`));
  assert.match(githubEnvironment, /APPLE_API_KEY_PATH=.*AuthKey_A1B2C3D4E5\.p8/);
  assert.match(githubEnvironment, /TAURI_SIGNING_PRIVATE_KEY_PATH=.*updater\.key/);
  for (const secret of [
    input.environment.FITFREED_APPLE_CERTIFICATE_PASSWORD,
    input.environment.FITFREED_APPLE_API_PRIVATE_KEY,
    input.environment.FITFREED_UPDATER_PRIVATE_KEY,
    input.environment.TAURI_SIGNING_PRIVATE_KEY_PASSWORD,
  ]) {
    assert.equal(githubEnvironment.includes(secret), false);
  }
  assert.ok(input.calls.some((args) => args[0] === "set-key-partition-list"));
  assert.ok(input.calls.some((args) => args[0] === "find-identity"));

  assert.deepEqual(cleanPublicReleaseAuthority(input.environment, {
    repositoryPath: input.repositoryPath,
    runSecurity: input.runSecurity,
  }), { cleaned: true });
  assert.equal(existsSync(result.authorityDirectory), false);
  assert.ok(input.calls.some((args) => args[0] === "delete-keychain"));
});

test("fails closed and removes materialized authority when identity inspection fails", () => {
  const input = fixture();
  const runSecurity = (args) => {
    if (args[0] === "default-keychain" && args.length === 3) return "synthetic-login";
    if (args[0] === "list-keychains" && args.length === 3) return "synthetic-login";
    if (args[0] === "find-identity") return "0 valid identities found";
    return "";
  };
  assert.throws(() => installPublicReleaseAuthority(input.environment, {
    repositoryPath: input.repositoryPath,
    runSecurity,
    createPassword: () => "e".repeat(64),
  }), /expected Apple signing identity/);
  assert.equal(
    existsSync(path.join(input.runnerTemp, "fitfreed-public-release-authority")),
    false,
  );
});

test("removes private files even when cleanup state cannot be trusted", () => {
  const input = fixture();
  const authorityDirectory = path.join(
    realpathSync(input.runnerTemp),
    "fitfreed-public-release-authority",
  );
  mkdirSync(authorityDirectory);
  writeFileSync(path.join(authorityDirectory, "state.json"), "invalid");

  assert.throws(() => cleanPublicReleaseAuthority(input.environment, {
    repositoryPath: input.repositoryPath,
    runSecurity: input.runSecurity,
  }), /cleanup state is invalid/);
  assert.equal(existsSync(authorityDirectory), false);
  assert.ok(input.calls.some((args) => args[0] === "delete-keychain"));
});

test("rejects incomplete, malformed, or repository-contained authority inputs", () => {
  for (const [mutate, expected] of [
    [(input) => { input.environment.APPLE_SIGNING_IDENTITY = "subject name"; }, /IDENTITY is invalid/],
    [(input) => { input.environment.FITFREED_APPLE_CERTIFICATE_BASE64 = "not base64"; }, /encoding/],
    [(input) => { input.environment.FITFREED_APPLE_API_PRIVATE_KEY = "opaque"; }, /private key/],
    [(input) => { input.environment.RUNNER_TEMP = input.repositoryPath; }, /outside the repository/],
    [(input) => { input.environment.APPLE_API_ISSUER = "contains\nnewline"; }, /invalid/],
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => installPublicReleaseAuthority(input.environment, {
      repositoryPath: input.repositoryPath,
      runSecurity: input.runSecurity,
      createPassword: () => "e".repeat(64),
    }), expected);
  }
});
