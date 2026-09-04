import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  cleanWindowsPublicReleaseAuthority,
  installWindowsPublicReleaseAuthority,
} from "./windows-public-release-authority.mjs";

const certificateSha1 = "1".repeat(40);
const certificateSha256 = "2".repeat(64);
const signToolPath = "C:\\Program Files (x86)\\Windows Kits\\10\\bin\\x64\\signtool.exe";
const repositoryRoot = path.resolve(import.meta.dirname, "..");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-windows-authority-"));
  const repositoryPath = path.join(root, "repository");
  const runnerTemp = path.join(root, "runner");
  const githubEnvironmentPath = path.join(runnerTemp, "github-environment");
  mkdirSync(repositoryPath);
  mkdirSync(runnerTemp);
  writeFileSync(githubEnvironmentPath, "");
  return {
    environment: {
      FITFREED_WINDOWS_CERTIFICATE_BASE64: Buffer.from("synthetic pfx").toString("base64"),
      FITFREED_WINDOWS_CERTIFICATE_PASSWORD: "synthetic password",
      FITFREED_WINDOWS_CERTIFICATE_SHA256: certificateSha256,
      FITFREED_WINDOWS_TIMESTAMP_URL: "https://timestamp.example.invalid/rfc3161",
      GITHUB_ENV: githubEnvironmentPath,
      RUNNER_TEMP: runnerTemp,
    },
    githubEnvironmentPath,
    repositoryPath,
    runnerTemp,
  };
}

test("installs only the admitted certificate and exposes no private input", () => {
  const input = fixture();
  const calls = [];
  const runPowerShell = (operation) => {
    calls.push(operation);
    assert.equal(existsSync(operation.certificatePath), true);
    assert.equal(
      readFileSync(operation.certificatePath, "utf8"),
      "synthetic pfx",
    );
    assert.equal(operation.certificatePassword, "synthetic password");
    writeFileSync(operation.statePath, `${JSON.stringify({ certificateSha1 })}\n`);
    return {
      certificateSha1,
      certificateSha256,
      operation: "installed",
      schemaVersion: 1,
      signToolPath,
    };
  };

  const result = installWindowsPublicReleaseAuthority(input.environment, {
    architecture: "x64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell,
  });

  assert.equal(result.certificateSha1, certificateSha1);
  assert.equal(result.certificateSha256, certificateSha256);
  assert.equal(result.signToolPath, signToolPath);
  assert.equal(calls.length, 1);
  assert.equal(existsSync(calls[0].certificatePath), false);
  const exposed = readFileSync(input.githubEnvironmentPath, "utf8");
  assert.match(exposed, /FITFREED_WINDOWS_AUTHENTICODE_PROFILE=public/);
  assert.match(exposed, new RegExp(`FITFREED_WINDOWS_CERTIFICATE_SHA1=${certificateSha1}`));
  assert.match(exposed, new RegExp(`FITFREED_WINDOWS_CERTIFICATE_SHA256=${certificateSha256}`));
  assert.match(exposed, /FITFREED_WINDOWS_SIGNTOOL_PATH=C:\\Program Files/);
  assert.match(exposed, /FITFREED_WINDOWS_TIMESTAMP_URL=https:\/\/timestamp\.example\.invalid\/rfc3161/);
  assert.equal(exposed.includes(input.environment.FITFREED_WINDOWS_CERTIFICATE_BASE64), false);
  assert.equal(exposed.includes(input.environment.FITFREED_WINDOWS_CERTIFICATE_PASSWORD), false);
});

test("removes the imported authority and clears the process contract", () => {
  const input = fixture();
  let authorityDirectory;
  installWindowsPublicReleaseAuthority(input.environment, {
    architecture: "x64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell(operation) {
      authorityDirectory = path.dirname(operation.statePath);
      writeFileSync(operation.statePath, `${JSON.stringify({ certificateSha1 })}\n`);
      return {
        certificateSha1,
        certificateSha256,
        operation: "installed",
        schemaVersion: 1,
        signToolPath,
      };
    },
  });

  const result = cleanWindowsPublicReleaseAuthority(input.environment, {
    architecture: "x64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell(operation) {
      assert.equal(operation.operation, "cleanup");
      assert.equal(existsSync(operation.statePath), true);
      return {
        authorityRemoved: true,
        operation: "cleaned",
        schemaVersion: 1,
      };
    },
  });

  assert.deepEqual(result, { authorityRemoved: true, cleaned: true });
  assert.equal(existsSync(authorityDirectory), false);
  const exposed = readFileSync(input.githubEnvironmentPath, "utf8");
  for (const name of [
    "FITFREED_WINDOWS_AUTHENTICODE_PROFILE",
    "FITFREED_WINDOWS_CERTIFICATE_SHA1",
    "FITFREED_WINDOWS_CERTIFICATE_SHA256",
    "FITFREED_WINDOWS_SIGNTOOL_PATH",
    "FITFREED_WINDOWS_TIMESTAMP_URL",
  ]) {
    assert.match(exposed, new RegExp(`${name}=\\r?$`, "m"));
  }
});

test("fails closed without exposing or retaining private authority", () => {
  const input = fixture();
  assert.throws(() => installWindowsPublicReleaseAuthority(input.environment, {
    architecture: "x64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell() {
      throw new Error("private certificate detail");
    },
  }), /installation failed/);

  assert.equal(
    existsSync(path.join(input.runnerTemp, "fitfreed-windows-public-release-authority")),
    false,
  );
  const exposed = readFileSync(input.githubEnvironmentPath, "utf8");
  assert.equal(exposed.includes("synthetic password"), false);
  assert.equal(exposed.includes(input.environment.FITFREED_WINDOWS_CERTIFICATE_BASE64), false);
  for (const name of [
    "FITFREED_WINDOWS_AUTHENTICODE_PROFILE",
    "FITFREED_WINDOWS_CERTIFICATE_SHA1",
    "FITFREED_WINDOWS_CERTIFICATE_SHA256",
    "FITFREED_WINDOWS_SIGNTOOL_PATH",
    "FITFREED_WINDOWS_TIMESTAMP_URL",
  ]) {
    assert.match(exposed, new RegExp(`${name}=\\r?$`, "m"));
  }
});

test("removes an imported authority when post-import validation fails", () => {
  const input = fixture();
  const operations = [];

  assert.throws(() => installWindowsPublicReleaseAuthority(input.environment, {
    architecture: "x64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell(operation) {
      operations.push(operation.operation);
      if (operation.operation === "install") {
        writeFileSync(operation.statePath, `${JSON.stringify({ certificateSha1 })}\n`);
        return {
          certificateSha1,
          certificateSha256: "3".repeat(64),
          operation: "installed",
          schemaVersion: 1,
          signToolPath,
        };
      }
      return {
        authorityRemoved: true,
        operation: "cleaned",
        schemaVersion: 1,
      };
    },
  }), /installation failed/);

  assert.deepEqual(operations, ["install", "cleanup"]);
  assert.equal(
    existsSync(path.join(input.runnerTemp, "fitfreed-windows-public-release-authority")),
    false,
  );
});

test("preserves retry authority and disables signing after cleanup failure", () => {
  const input = fixture();
  let authorityDirectory;
  installWindowsPublicReleaseAuthority(input.environment, {
    architecture: "x64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell(operation) {
      authorityDirectory = path.dirname(operation.statePath);
      writeFileSync(operation.statePath, `${JSON.stringify({ certificateSha1 })}\n`);
      return {
        certificateSha1,
        certificateSha256,
        operation: "installed",
        schemaVersion: 1,
        signToolPath,
      };
    },
  });

  assert.throws(() => cleanWindowsPublicReleaseAuthority(input.environment, {
    architecture: "x64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell() {
      throw new Error("native cleanup failed");
    },
  }), /cleanup failed/);

  assert.equal(existsSync(authorityDirectory), true);
  assert.equal(existsSync(path.join(authorityDirectory, "state.json")), true);
  const exposed = readFileSync(input.githubEnvironmentPath, "utf8");
  for (const name of [
    "FITFREED_WINDOWS_AUTHENTICODE_PROFILE",
    "FITFREED_WINDOWS_CERTIFICATE_SHA1",
    "FITFREED_WINDOWS_CERTIFICATE_SHA256",
    "FITFREED_WINDOWS_SIGNTOOL_PATH",
    "FITFREED_WINDOWS_TIMESTAMP_URL",
  ]) {
    assert.match(exposed, new RegExp(`${name}=\\r?$`, "m"));
  }
});

test("rejects malformed, unsafe, or non-Windows authority inputs", () => {
  for (const [mutate, expected] of [
    [(input) => { input.environment.FITFREED_WINDOWS_CERTIFICATE_BASE64 = "not base64"; }, /encoding/],
    [(input) => { input.environment.FITFREED_WINDOWS_CERTIFICATE_SHA256 = "A".repeat(64); }, /CERTIFICATE_SHA256/],
    [(input) => { input.environment.FITFREED_WINDOWS_TIMESTAMP_URL = "http://timestamp.invalid"; }, /timestamp/],
    [(input) => { input.environment.RUNNER_TEMP = input.repositoryPath; }, /outside the repository/],
    [(input) => { input.environment.FITFREED_WINDOWS_CERTIFICATE_PASSWORD = "contains\nnewline"; }, /invalid/],
  ]) {
    const input = fixture();
    mutate(input);
    assert.throws(() => installWindowsPublicReleaseAuthority(input.environment, {
      architecture: "x64",
      platform: "win32",
      repositoryPath: input.repositoryPath,
      runPowerShell: () => assert.fail("PowerShell must not run"),
    }), expected);
  }

  const input = fixture();
  assert.throws(() => installWindowsPublicReleaseAuthority(input.environment, {
    architecture: "arm64",
    platform: "win32",
    repositoryPath: input.repositoryPath,
    runPowerShell: () => assert.fail("PowerShell must not run"),
  }), /x86-64 Windows/);
});

test("keeps the native authority non-exportable, purpose-bound, and recoverable", () => {
  const source = readFileSync(
    path.join(repositoryRoot, "scripts", "windows-public-release-authority.ps1"),
    "utf8",
  );
  assert.match(source, /Cert:\\CurrentUser\\My/);
  assert.match(source, /Import-PfxCertificate/);
  assert.match(source, /X509Certificate2Collection/);
  assert.match(source, /EphemeralKeySet/);
  assert.match(source, /certificate bundle must contain exactly one certificate/);
  assert.match(source, /certificate already exists in the current-user store/);
  assert.match(source, /function Remove-Certificate\(\[string\]\$Thumbprint, \[string\]\$ExpectedSha256\)/);
  assert.match(source, /Get-CertificateSha256 \$certificate\) -ne \$ExpectedSha256/);
  assert.doesNotMatch(source, /-Exportable/);
  assert.match(source, /1\.3\.6\.1\.5\.5\.7\.3\.3/);
  assert.match(source, /Remove-Item -LiteralPath \$candidate -Force -DeleteKey/);
  assert.match(source, /if \(\$Operation -eq "Cleanup".*Test-Path -LiteralPath \$StatePath -PathType Leaf/s);
  assert.match(source, /Test-Path -LiteralPath "Cert:\\CurrentUser\\My\\\$thumbprint"/);
  assert.ok(
    source.indexOf("certificate already exists in the current-user store")
      < source.indexOf("Import-PfxCertificate"),
  );

  const packageJson = JSON.parse(readFileSync(path.join(repositoryRoot, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["authority:windows-public-release"],
    "node scripts/windows-public-release-authority.mjs",
  );
  assert.match(
    packageJson.scripts["test:windows-scripts"],
    /scripts\/windows-public-release-authority\.test\.mjs/,
  );
});
