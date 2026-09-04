# Public Windows 0.1.0 Guide

## Status

This inactive pre-publication guide is rendered against the repository's current unreleased 0.1.0 development
version so its exact names, links, and documentation contracts can be verified. It does not announce or reserve a
Windows 0.1.0 release. No public Windows binary is available while the
[Milestone 5 execution ledger](../plans/milestone-5.md) contains an open gate or before the public Linux release
permits Windows promotion.

Under [ADR 0044](../architecture/decisions/0044-publish-expanding-complete-platform-sets.md), the operative guide and
artifacts use the next unreleased semantic version after the first immutable public Linux Release and contain newly
built macOS, Linux, and Windows targets for that exact version. Release preparation regenerates every
version-specific name and piece of evidence together. This guide becomes operative only for Windows assets in an
immutable `v0.1.0` GitHub Release from `purnalica/fitfreed` when that is the version assigned to the expansion; source
archives, development packages, Actions artifacts, forks, and third-party packages are not that release.

FitFreed 0.1.0 will support x86-64 editions of Windows 11 that remain in Microsoft support when the exact candidate is
issued, through one current-user NSIS setup. It is experimental GPL-3.0-or-later software provided without warranty
and at the user's own risk. Read the [project disclaimer](../../DISCLAIMER.md) before installation.

## Preserve the source data first

Keep every original provider ZIP unchanged in an independently protected location. FitFreed does not replace the
source export, and version 0.1.0 has no supported user-controlled library backup, restore, or portable normalized
export workflow.

Do not use FitFreed as the only copy of important information. Verify consequential values against their source, and
do not treat any view as medical, health, training, safety, or legal advice.

## Download and verify

Download only from the immutable `FitFreed 0.1.0` Release in the
[canonical GitHub repository](https://github.com/purnalica/fitfreed/releases). The Windows release set must contain
these regular assets:

- `FitFreed_0.1.0_x64-setup.exe` and its updater signature `FitFreed_0.1.0_x64-setup.exe.sig`;
- `FitFreed_0.1.0_x64-setup.exe.inventory.json` and `FitFreed_0.1.0_x64-setup.exe.build.json`;
- `stable.json`, `supported-upgrades.json`, and `release-manifest.json`;
- `RELEASE_NOTES.md`, `SHA256SUMS`, and `SHA256SUMS.minisig`; and
- the npm and Cargo CycloneDX inventories named in the manifest.

The source ZIP and source tarball automatically shown by GitHub are not application installers. Do not install when
the Release is missing an expected asset, is marked as a draft or prerelease, does not report immutable protection,
or identifies another tag.

First verify the detached signature of `SHA256SUMS` with the public FitFreed release key and the exact `minisign`
command published in that Release. Then place the setup and authenticated checksum file in one directory and verify
the exact setup from PowerShell without changing either file:

```powershell
$package = "FitFreed_0.1.0_x64-setup.exe"
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

The command must print the single `OK` line. The manifest, setup inventory, build evidence, checksum entry,
release-note version, setup filename, and GitHub tag must all identify 0.1.0. A mismatch is a hard stop; do not rename
an asset or edit an inventory to make the check pass.

Verify Windows Authenticode policy and calculate the signer's SHA-256 certificate fingerprint from the unchanged
setup:

```powershell
$signature = Get-AuthenticodeSignature -LiteralPath ".\FitFreed_0.1.0_x64-setup.exe"
if ($signature.Status -ne "Valid" -or $null -eq $signature.SignerCertificate) {
  throw "The setup does not have a valid Windows Authenticode signature."
}
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
  $fingerprint = ([BitConverter]::ToString(
    $sha256.ComputeHash($signature.SignerCertificate.RawData)
  )).Replace("-", "").ToLowerInvariant()
} finally {
  $sha256.Dispose()
}
$signature.SignerCertificate.Subject
$fingerprint
```

The fingerprint must equal the lowercase `windows-x86_64-nsis` certificate fingerprint in
`release-manifest.json`. The signer identity must agree with the exact Release guidance. Digest, Authenticode,
signed-checksum, updater-signature, and GitHub-provenance checks have different purposes; success in one does not
replace the others.

GitHub CLI users can additionally verify that the immutable Release and setup are linked to GitHub's release
attestations:

```powershell
gh release verify v0.1.0 --repo purnalica/fitfreed
gh release verify-asset v0.1.0 FitFreed_0.1.0_x64-setup.exe --repo purnalica/fitfreed
```

## Install and first launch

1. Double-click the verified `FitFreed_0.1.0_x64-setup.exe`.
2. Confirm the file, version, and publisher agree with the exact Release evidence before permitting execution.
3. Complete the current-user installation. Ordinary setup does not require administrator authority and does not
   install FitFreed for other users.
4. Open FitFreed from the Start menu shortcut.
5. Confirm **Settings → Updates** identifies version 0.1.0 before importing anything.
6. Open **Settings → Windows help** to confirm the localized offline installation, recovery, removal, and data-lifecycle
   guidance is available from the installed application.

The setup installs FitFreed beneath `%LOCALAPPDATA%\FitFreed` and registers it for the current user in Windows **Apps
→ Installed apps**. It contains the bundled WebView2 offline installer, so clean setup and first launch do not depend
on downloading a browser runtime. The larger setup size is expected and remains covered by the authenticated digest.

Stop if setup requests a system-wide destination or administrator authority, reports a damaged package, presents a
different product or publisher, or cannot complete. Preserve the verified download and follow the support route; do
not extract the setup, copy installed files manually, or substitute an MSI package.

## SmartScreen and publisher identity

A SmartScreen reputation warning is not a trust result. A new publisher can have a valid Authenticode signature
without established reputation, but the warning itself neither authenticates nor condemns the file. Likewise,
selecting **Run anyway** does not verify the setup.

If SmartScreen appears, use **More info** only to inspect the displayed application and publisher. Do not continue
solely because this generic guide describes the message. Recheck the immutable Release, exact digest, `Valid`
Authenticode status, SHA-256 certificate fingerprint, and exact-version known limitations. A missing or different
publisher, invalid signature, digest mismatch, absent exact-version notice, or unexpected setup name is a hard stop.
If all independent checks agree but the reputation warning remains, consult the support information attached to that
exact Release before deciding whether to proceed.

## Language and first run

FitFreed initially supports English (United States) and Spanish (Spain). On first run it selects the first supported
operating-system language and otherwise falls back to English. A manual language change persists across restarts and
changes presentation only; it never rewrites imported facts.

The installer selects an English or Spanish interface from the operating-system locale without introducing a second
package identity. The installed application contains localized import, coverage, exploration, update, failure, and
recovery guidance for both supported locales. Its Windows-only Settings category also explains installation trust,
offline behavior, application removal, separate library deletion, and unsupported deployment modes without requiring
a browser. Canonical web and engineering documentation remains English so that it has one source of truth.

## Import, reimport, and exploration

Empty-library Home offers direct source guidance and ZIP selection. **Show me how** opens the bundled localized
source-acquisition guide. Official provider pages open explicitly in the default browser; FitFreed never receives
provider credentials, requests an export, monitors its preparation, or downloads it.

Choose the original ZIP itself. Do not unpack it, repack it, rename its members, or edit its JSON files. Keep
FitFreed open until the import reaches a terminal result. Cancellation before the final atomic visibility boundary
leaves no partial canonical history.

An exact reimport does not duplicate canonical history. The same bytes are reassessed after a relevant importer or
mapping contract changes, and later compatible exports add or revise facts through documented source identities
rather than ZIP order.

Version 0.1.0 provides local activity, sleep, recovery, and longitudinal views; complete-history training exploration
with sport recognition and personal classification; exact session structure, signals, zones, route shapes, personal
ranges, and source provenance where supported evidence exists; comparisons; durable reports; and privacy-reviewed
self-contained HTML report export. Every visual retains an exact-value or table path. Missing evidence does not become
zero, and recorded co-occurrence does not become diagnosis, readiness, causation, or training advice.

The [development preview guide](development-preview.md), [route guide](session-routes.md),
[personal-range guide](session-ranges.md), and [report guide](reports.md) document the shared application behavior in
detail.

## Local data and privacy

The current-user package and personal library have separate lifecycles:

- `%LOCALAPPDATA%\FitFreed\` contains the installed application and uninstaller;
- `%APPDATA%\org.fitfreed.desktop\fitfreed.sqlite` is the active SQLite library; and
- `%APPDATA%\org.fitfreed.desktop\` can also contain preferences, provenance, and private update-recovery state.

Treat the complete application-data directory as sensitive fitness, health, provenance, and machine-local
information even when individual filenames look harmless. FitFreed protects that directory for the current Windows
user and rejects redirected or multiply linked library boundaries rather than following them.

FitFreed has no account, analytics, or synchronization service. An update check contacts only the fixed public update
endpoint and sends no imported facts, provider data, locale, library schema, installation identifier, or usage data.
Import and exploration remain available offline; an unavailable update service does not block either.

Never attach a real export, library, route, screenshot, log, crash report, or diagnostic containing personal history
to a public issue.

## Updates and recovery

Open **Settings → Updates** for the installed version and an explicit update check. FitFreed also checks after ready
startup and every 24 hours while it remains open. Ordinary current, offline, dismissed, or postponed scheduled
outcomes stay quiet.

Only a newer compatible release authenticated by the embedded stable-channel trust can offer installation. Review
its localized notes before acting. A release can be dismissed or postponed for 24 hours. A withdrawn installed
version produces persistent guidance and cannot be treated as an ordinary optional candidate.

Before replacement, FitFreed verifies the exact NSIS setup and preserves the installed application, runnable
predecessor, native package, and SQLite library as one recovery set. Windows closes the initiating application during
native replacement; a separately preserved watchdog completes confirmation or automatic recovery. Import, locale
changes, and another update cannot overlap installation.

Ordinary current-user update and recovery do not require administrator authority. If native execution is temporarily
blocked, the preserved application and local library remain available to the bounded recovery path. After three
failed native attempts, FitFreed retains recovery evidence and provides manual reinstall guidance instead of
repeating indefinitely. A candidate that does not reopen and confirm its exact version and library triggers automatic
recovery to the verified predecessor.

If FitFreed does not reopen, wait for bounded automatic recovery and then open it once. If the recovery notice
remains, do not start another update, edit the database, delete recovery files, or install an unrelated setup over the
application. Preserve the complete application-data directory and follow the current Release guidance.

## Remove the application or delete its data

Removing FitFreed through **Settings → Apps → Installed apps** invokes the registered uninstaller. It removes the
application and intentionally retains the separate local library. Reinstalling the same or a compatible later version
can reopen that library.

Deleting personal FitFreed state is a separate destructive choice:

1. Remove FitFreed through Windows **Installed apps**, then confirm it is no longer running or updating.
2. Preserve the original provider ZIPs and any independent backups that must remain.
3. Enter `%APPDATA%` in File Explorer's address bar.
4. Locate the directory named exactly `org.fitfreed.desktop`.
5. Move that complete directory to the Recycle Bin only when permanent loss of the library, preferences, provenance,
   and recovery state is intended.
6. Enter `%LOCALAPPDATA%` in File Explorer and remove a remaining `org.fitfreed.desktop` directory only if it exists
   and the same permanent-deletion decision applies.
7. Empty the Recycle Bin only after confirming the exact targets. Backups or synchronized storage can retain other
   copies and require their own deletion controls.

There is no in-application deletion command in 0.1.0. Never delete only the SQLite file, its sidecars, or selected
recovery files as a repair technique. Do not delete `%LOCALAPPDATA%\FitFreed` manually instead of using the registered
uninstaller.

## Unsupported systems and deployment modes

The first Windows release does not support Windows 10, Windows on ARM, 32-bit Windows, Windows Server, or Windows 11
editions outside Microsoft support at candidate issuance. It also does not provide MSI, Microsoft Store, WinGet,
managed deployment, portable executable, per-machine, or shared multi-user installation modes. x86-64 emulation or a
setup that happens to run elsewhere does not inherit FitFreed's installation, WebView2, update, recovery,
accessibility, performance, or removal evidence.

Do not convert, repackage, or publish the NSIS setup under another format and describe the result as an official
FitFreed package. A future platform, architecture, package family, or deployment mode requires its own documented
support matrix and complete admission evidence.

## Safe support and security reports

A useful report contains the FitFreed version and public source revision, Windows edition and build, x86-64
architecture, the action that failed, stable interface text or a privacy-safe error code, the boundary before which
it failed, and whether a synthetic package reproduces it.

Use [GitHub Issues](https://github.com/purnalica/fitfreed/issues) for reproducible non-security defects. Suspected
vulnerabilities must use GitHub private vulnerability reporting as described in
[SECURITY.md](../../SECURITY.md). Do not include personal values, paths, provider identifiers, database contents,
tokens, signatures, keys, or screenshots containing history.
