import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { verifyWindowsFilesystemReliability } from "./verify-windows-filesystem-reliability.mjs";

const powershell = readFileSync(
  new URL("./verify-windows-filesystem-reliability.ps1", import.meta.url),
  "utf8",
);
const localLibrary = readFileSync(
  new URL("../src-tauri/src/infrastructure/local_library.rs", import.meta.url),
  "utf8",
);

test("runs only the native Windows NTFS admission adapter", () => {
  const calls = [];
  assert.deepEqual(
    verifyWindowsFilesystemReliability({
      architecture: "x64",
      environment: {
        PATH: "C:\\Windows\\System32",
        FITFREED_WINDOWS_CERTIFICATE_SHA1: "protected",
      },
      platform: "win32",
      run(file, arguments_, options) {
        calls.push({ file, arguments_, options });
        return { error: undefined, signal: null, status: 0 };
      },
    }),
    { result: "passed" },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, "powershell.exe");
  assert.deepEqual(calls[0].arguments_.slice(0, 5), [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
  ]);
  assert.equal(calls[0].arguments_[5], "-File");
  assert.equal(
    calls[0].arguments_[6],
    path.resolve("scripts/verify-windows-filesystem-reliability.ps1"),
  );
  assert.equal(calls[0].options.env.FITFREED_WINDOWS_CERTIFICATE_SHA1, undefined);
});

test("rejects unsupported hosts and failed native admission", () => {
  assert.throws(
    () => verifyWindowsFilesystemReliability({ architecture: "x64", platform: "darwin" }),
    /requires x86-64 Windows/,
  );
  assert.throws(
    () => verifyWindowsFilesystemReliability({ architecture: "arm64", platform: "win32" }),
    /requires x86-64 Windows/,
  );
  assert.throws(
    () => verifyWindowsFilesystemReliability({
      architecture: "x64",
      platform: "win32",
      run() {
        return { error: undefined, signal: null, status: 7 };
      },
    }),
    /filesystem reliability admission failed/,
  );
});

test("creates one bounded isolated NTFS VHD and detaches it unconditionally", () => {
  assert.match(powershell, /create vdisk file=.* maximum=64 type=expandable/);
  assert.match(powershell, /format fs=ntfs label=`"FitFreedAdmission`" quick/);
  assert.match(powershell, /Get-Volume -DriveLetter/);
  assert.match(powershell, /FileSystem\s+-ne\s+"NTFS"/);
  assert.match(powershell, /finally\s*\{/);
  assert.match(powershell, /detach vdisk/);
  assert.doesNotMatch(powershell, /Clear-Disk|Remove-Partition|Format-Volume|rm -r|rm -rf/);
});

test("runs only the exact ignored Windows disk-exhaustion recovery test", () => {
  assert.match(powershell, /FITFREED_WINDOWS_FILESYSTEM_TEST_ROOT/);
  assert.match(powershell, /"test",/);
  assert.match(powershell, /& cargo\.exe @arguments/);
  assert.match(powershell, /--release/);
  assert.match(powershell, /--lib/);
  assert.match(
    powershell,
    /infrastructure::tests::recovers_from_windows_disk_exhaustion_without_losing_committed_history/,
  );
  assert.match(powershell, /--ignored/);
  assert.match(powershell, /--exact/);
});

test("protects the Windows library with no-follow, SQLite-compatible sharing, link, and ACL checks", () => {
  assert.match(localLibrary, /FILE_FLAG_OPEN_REPARSE_POINT/);
  assert.match(localLibrary, /FILE_ATTRIBUTE_REPARSE_POINT/);
  assert.match(
    localLibrary,
    /share_mode\(FILE_SHARE_READ \| FILE_SHARE_WRITE\)/,
  );
  assert.match(localLibrary, /GetFileInformationByHandle/);
  assert.match(localLibrary, /nNumberOfLinks/);
  assert.match(localLibrary, /PROTECTED_DACL_SECURITY_INFORMATION/);
  assert.match(localLibrary, /SetSecurityInfo/);
  assert.match(localLibrary, /recovers_from_transient_windows_file_denial/);
  assert.match(localLibrary, /admits_validation_while_sqlite_has_the_library_open/);
});

test("exercises a real Windows junction and the native path matrix", () => {
  assert.match(powershell, /New-Item\s+-ItemType Junction/);
  assert.match(powershell, /FITFREED_WINDOWS_JUNCTION_TEST_PATH/);
  assert.match(
    powershell,
    /Invoke-RustTests "infrastructure::local_library::windows_tests::" \$false \$false/,
  );
  assert.match(
    powershell,
    /local_library::windows_tests::validates_windows_library_filesystem_boundaries/,
  );
});
