# Public Windows 0.1.21 Guide

## Status

This is the operative version-matched guide for the public unsigned Windows preview in FitFreed 0.1.21 once immutable `v0.1.21` GitHub Release exists in the
[canonical repository](https://github.com/purnalica/fitfreed/releases/tag/v0.1.21). Before that exact Release exists,
this document describes a candidate and is not permission to install another build.

The preview is intended for x86-64 editions of Windows 11 that remain in Microsoft support. Its exact setup is built,
installed, cold-launched, removed, and checked for local-library preservation on GitHub-hosted `windows-2025`. That is
useful native evidence, but it is not exact Windows 11 client, Smart App Control, or managed-enterprise admission.

This preview deliberately has no Authenticode publisher signature. Windows therefore reports an unknown publisher;
SmartScreen, Smart App Control, or organizational policy may block it. FitFreed is experimental GPL-3.0-or-later
software provided without warranty and at the user's own risk. Read the [project disclaimer](../../DISCLAIMER.md)
before installation.

## Preserve the source data first

Keep every original provider ZIP unchanged in an independently protected location. FitFreed does not replace the
source export and does not yet provide a supported user-controlled library backup, restore, or portable normalized
export workflow. Do not use FitFreed as the only copy of important information or as medical, training, safety, or
legal advice.

## Download and verify

Download only `FitFreed_0.1.21_x64-setup.exe` from immutable Release `v0.1.21`. The same Release must contain:

- `FitFreed_0.1.21_x64-setup.exe.sig`;
- `FitFreed_0.1.21_x64-setup.exe.inventory.json` and `FitFreed_0.1.21_x64-setup.exe.build.json`;
- `release-manifest.json`, `stable.json`, and `supported-upgrades.json`;
- `RELEASE_NOTES.md`, `SHA256SUMS`, and `SHA256SUMS.minisig`; and
- the npm and Cargo CycloneDX inventories named in the manifest.

Authenticate `SHA256SUMS.minisig` with the FitFreed release key and exact Minisign command published in the Release.
Then verify the setup digest from PowerShell:

```powershell
$package = "FitFreed_0.1.21_x64-setup.exe"
$entries = @(Get-Content -LiteralPath ".\SHA256SUMS" |
  Where-Object { $_.EndsWith("  $package", [StringComparison]::Ordinal) })
if ($entries.Count -ne 1 -or $entries[0] -notmatch '^([0-9a-f]{64})  (.+)$') {
  throw "The checksum inventory does not contain exactly one valid setup entry."
}
$expected = $Matches[1]
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath ".\$package").Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "The setup digest does not match SHA256SUMS." }
"OK  $package"
```

The command must print one `OK` line. The manifest, inventory, build evidence, checksums, release notes, filename, and
tag must all identify 0.1.21. GitHub CLI users can additionally run:

```powershell
gh release verify v0.1.21 --repo purnalica/fitfreed
gh release verify-asset v0.1.21 FitFreed_0.1.21_x64-setup.exe --repo purnalica/fitfreed
```

The absence of Authenticode is intentional and must be confirmed rather than mistaken for a valid publisher:

```powershell
$signature = Get-AuthenticodeSignature -LiteralPath ".\FitFreed_0.1.21_x64-setup.exe"
if ($signature.Status -ne "NotSigned") {
  throw "This preview does not match its declared unsigned trust profile."
}
$signature.Status
```

A different signature state, digest mismatch, missing evidence, mutable Release, or renamed setup is a hard stop.

## Install and first launch

1. Double-click the verified setup.
2. If Windows offers a per-file SmartScreen continuation, inspect the exact application and filename before deciding
   whether to use **More info** and **Run anyway**.
3. Complete the current-user installation; it must not request a system-wide destination or administrator authority.
4. Launch FitFreed from the Start menu and confirm version 0.1.21 before importing data.
5. Open **Settings → Windows help** to retain the offline lifecycle guidance.

The setup installs beneath `%LOCALAPPDATA%\FitFreed` and registers FitFreed in **Apps → Installed apps**. It includes
the bundled WebView2 offline installer, so first launch does not require downloading a browser runtime.

## SmartScreen and publisher identity

A SmartScreen reputation warning is not a trust result. This preview has no publisher identity, so the native dialog
cannot authenticate FitFreed. The independent immutable Release, signed checksum inventory, exact digest, build
evidence, updater signature, and GitHub provenance checks remain mandatory.

Continue only when Windows itself offers the bounded per-file choice and every independent check agrees. If Smart App
Control or organizational policy blocks the setup, stop. Do not disable system-wide protections, change enterprise
policy, disable SmartScreen, use developer mode, or copy installed files manually. Wait for a later signed Windows
release or use a supported macOS or Linux package instead.

## Language and first run

FitFreed supports English (United States) and Spanish (Spain). It selects a supported operating-system language on
first run and otherwise uses English. **Show me how** opens the bundled localized source-acquisition guide. Official
provider links open explicitly in the default browser; FitFreed never receives account credentials.

## Import, reimport, and exploration

Select the original provider ZIP. Reconciliation preserves the existing library until the final atomic commit. An
exact reimport does not duplicate canonical history; compatible later exports and mapping versions reconcile through
documented source identities.

FitFreed provides complete-history training exploration with sport recognition, sessions, route shapes, signals,
zones, structure, personal ranges, comparisons, activity, sleep, recovery, and durable reports with self-contained HTML report export.
Missing evidence does not become zero, and correlation does not become diagnosis or training advice.

## Local data and privacy

The current-user application and personal library have separate lifecycles:

- `%LOCALAPPDATA%\FitFreed\` contains the installed application and uninstaller; and
- `%APPDATA%\org.fitfreed.desktop\` contains the SQLite library, preferences, provenance, and recovery state.

FitFreed has no account, analytics, or synchronization service. Update checks transmit no imported facts, provider
data, locale, library schema, installation identifier, or usage data. Never attach a real export, library, route,
screenshot, crash report, or log containing personal history to a public report.

## Updates and recovery

Settings provides an explicit update check and a quiet scheduled check. Only a newer compatible package authenticated
by embedded update trust can be offered. Before replacement, FitFreed preserves the installed application, runnable
predecessor, package, and local library as one recovery set. Windows closes the initiating application during native
replacement; a separate watchdog confirms the new version or performs automatic recovery.

Do not edit the database, delete recovery files, or start another update while recovery is active. After bounded
failed attempts, retain the evidence and follow the exact Release guidance rather than repeatedly reinstalling.

## Remove the application or delete its data

Removing FitFreed through **Settings → Apps → Installed apps** invokes the registered uninstaller. This removes the
application and retains the separate local library. Permanent data deletion is a distinct destructive choice: stop
FitFreed, preserve the original exports, and move the complete `%APPDATA%\org.fitfreed.desktop` directory to the
Recycle Bin. Never delete only the SQLite file, sidecars, or selected recovery files as a repair technique.

## Unsupported systems and deployment modes

This preview does not support Windows 10, Windows on ARM, 32-bit Windows, Windows Server, MSI, Microsoft Store,
WinGet, managed deployment, portable executable, per-machine installation, or shared multi-user libraries. Exact
Windows 11 client behavior, Smart App Control acceptance, and organizational-policy compatibility remain unadmitted.

## Safe support and security reports

Use [SUPPORT.md](../../SUPPORT.md) for ordinary defects and [SECURITY.md](../../SECURITY.md) or GitHub private
vulnerability reporting for suspected vulnerabilities. State the Windows edition and build, whether policy blocked
installation, the exact release version, and synthetic reproduction steps. Never publish personal fitness evidence,
credentials, or full machine diagnostics.
