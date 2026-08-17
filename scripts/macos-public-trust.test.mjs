import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  inspectPublicMacosTrust,
  parseCodesignDetails,
  parseMinimumSystemVersion,
} from "./macos-public-trust.mjs";

const validCodesignDetails = `
Identifier=org.fitfreed.desktop
Format=app bundle with Mach-O thin (arm64)
CodeDirectory v=20500 size=123 flags=0x10000(runtime) hashes=1+7 location=embedded
Authority=Developer ID Application: Redacted Identity (A1B2C3D4E5)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
Timestamp=Aug 17, 2026 at 8:00:00 PM
TeamIdentifier=A1B2C3D4E5
`;

test("extracts only privacy-safe Developer ID evidence", () => {
  assert.deepEqual(parseCodesignDetails(validCodesignDetails), {
    teamIdentifier: "A1B2C3D4E5",
    hardenedRuntime: true,
    secureTimestamp: true,
  });
});

test("rejects ad hoc, non-Developer-ID, non-runtime, and untimestamped signatures", () => {
  for (const [details, error] of [
    ["Signature=adhoc\n", /ad hoc/],
    [validCodesignDetails.replace("Developer ID Application:", "Apple Development:"), /Developer ID/],
    [validCodesignDetails.replace("flags=0x10000(runtime)", "flags=0x0(none)"), /hardened runtime/],
    [validCodesignDetails.replace(/^Timestamp=.*$/m, "Timestamp=none"), /secure timestamp/],
  ]) {
    assert.throws(() => parseCodesignDetails(details), error);
  }
});

test("accepts only the exact supported Mach-O deployment target", () => {
  assert.equal(parseMinimumSystemVersion(" platform MACOS\n    minos 15.0\n"), "15.0");
  assert.throws(
    () => parseMinimumSystemVersion(" platform MACOS\n    minos 14.5\n"),
    /must be 15.0/,
  );
});

test("checks the complete application, disk image, notarization, and Gatekeeper boundary", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-trust-test-"));
  const applicationPath = path.join(root, "FitFreed.app");
  const infoPlist = path.join(applicationPath, "Contents", "Info.plist");
  const executable = path.join(applicationPath, "Contents", "MacOS", "fitfreed");
  const diskImagePath = path.join(root, "FitFreed.dmg");
  mkdirSync(path.dirname(executable), { recursive: true });
  writeFileSync(infoPlist, "synthetic plist");
  writeFileSync(executable, "synthetic executable");
  writeFileSync(diskImagePath, "synthetic disk image");
  const invocations = [];
  const runCommand = (command, args) => {
    invocations.push([command, ...args]);
    if (command === "codesign" && args.includes("--extract-certificates")) {
      const prefix = args[args.indexOf("--extract-certificates") + 1];
      writeFileSync(`${prefix}0`, "same synthetic leaf certificate");
      return "";
    }
    if (command === "codesign" && args.includes("--verbose=4")) return validCodesignDetails;
    if (command === "plutil" && args.includes("CFBundleIdentifier")) return "org.fitfreed.desktop\n";
    if (command === "plutil" && args.includes("CFBundleShortVersionString")) return "0.1.0\n";
    if (command === "plutil" && args.includes("LSMinimumSystemVersion")) return "15.0\n";
    if (command === "lipo") return "arm64\n";
    if (command === "vtool") return " platform MACOS\n    minos 15.0\n";
    return "";
  };

  const evidence = inspectPublicMacosTrust({
    applicationPath,
    diskImagePath,
    expectedVersion: "0.1.0",
    expectedTeamIdentifier: "A1B2C3D4E5",
    runCommand,
  });

  assert.equal(evidence.certificateSha256.length, 64);
  assert.equal(evidence.teamIdentifier, "A1B2C3D4E5");
  assert.equal(evidence.notarization.applicationStapled, true);
  assert.equal(evidence.notarization.diskImageStapled, true);
  assert.equal(evidence.notarization.gatekeeperAccepted, true);
  assert.equal(
    invocations.some(([command, ...args]) =>
      command === "spctl" && args.includes("execute")),
    true,
  );
  assert.equal(
    invocations.some(([command, ...args]) =>
      command === "spctl" && args.includes("context:primary-signature")),
    true,
  );
  assert.equal(
    invocations.filter(([command, ...args]) => command === "xcrun" && args[0] === "stapler").length,
    2,
  );
});

test("rejects application and disk image certificates that do not match", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-trust-mismatch-"));
  const applicationPath = path.join(root, "FitFreed.app");
  const infoPlist = path.join(applicationPath, "Contents", "Info.plist");
  const executable = path.join(applicationPath, "Contents", "MacOS", "fitfreed");
  const diskImagePath = path.join(root, "FitFreed.dmg");
  mkdirSync(path.dirname(executable), { recursive: true });
  writeFileSync(infoPlist, "synthetic plist");
  writeFileSync(executable, "synthetic executable");
  writeFileSync(diskImagePath, "synthetic disk image");
  const runCommand = (command, args) => {
    if (command === "codesign" && args.includes("--extract-certificates")) {
      const prefix = args[args.indexOf("--extract-certificates") + 1];
      writeFileSync(`${prefix}0`, prefix.includes("application-") ? "application" : "disk image");
      return "";
    }
    if (command === "codesign" && args.includes("--verbose=4")) return validCodesignDetails;
    if (command === "plutil" && args.includes("CFBundleIdentifier")) return "org.fitfreed.desktop";
    if (command === "plutil" && args.includes("CFBundleShortVersionString")) return "0.1.0";
    if (command === "plutil" && args.includes("LSMinimumSystemVersion")) return "15.0";
    if (command === "lipo") return "arm64";
    if (command === "vtool") return " platform MACOS\n    minos 15.0\n";
    return "";
  };

  assert.throws(
    () => inspectPublicMacosTrust({
      applicationPath,
      diskImagePath,
      expectedVersion: "0.1.0",
      expectedTeamIdentifier: "A1B2C3D4E5",
      runCommand,
    }),
    /different signing certificates/,
  );
});

test("rejects a valid Developer ID signature from an unexpected Apple team", () => {
  const root = mkdtempSync(path.join(tmpdir(), "fitfreed-public-trust-team-"));
  const applicationPath = path.join(root, "FitFreed.app");
  const infoPlist = path.join(applicationPath, "Contents", "Info.plist");
  const executable = path.join(applicationPath, "Contents", "MacOS", "fitfreed");
  const diskImagePath = path.join(root, "FitFreed.dmg");
  mkdirSync(path.dirname(executable), { recursive: true });
  writeFileSync(infoPlist, "synthetic plist");
  writeFileSync(executable, "synthetic executable");
  writeFileSync(diskImagePath, "synthetic disk image");
  const runCommand = (command, args) => {
    if (command === "codesign" && args.includes("--verbose=4")) return validCodesignDetails;
    return "";
  };

  assert.throws(
    () => inspectPublicMacosTrust({
      applicationPath,
      diskImagePath,
      expectedVersion: "0.1.0",
      expectedTeamIdentifier: "Z9Y8X7W6V5",
      runCommand,
    }),
    /unexpected Apple team identifier/,
  );
});
