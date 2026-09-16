# Public Linux 0.1.16 Guide

## Status

This is the operative version-matched Linux guide for FitFreed 0.1.16 once immutable `v0.1.16` GitHub Release exists
in the [canonical repository](https://github.com/purnalica/fitfreed/releases/tag/v0.1.16). Before that exact Release
exists, this document describes a candidate and is not permission to install another build.

FitFreed 0.1.16 supports x86-64 Ubuntu Desktop 24.04 and 26.04 LTS through a Debian package. It is experimental
GPL-3.0-or-later software provided without warranty and at the user's own risk. Read the
[project disclaimer](../../DISCLAIMER.md) before installation.

## Preserve the source data first

Keep every original provider ZIP unchanged in an independently protected location. FitFreed does not replace the
source export and does not yet provide a supported user-controlled library backup, restore, or portable normalized
export workflow. Do not use FitFreed as the only copy of important information or as medical, training, safety, or
legal advice.

## Download and verify

Download only `FitFreed_0.1.16_amd64.deb` from immutable Release `v0.1.16`. The same Release must contain its updater
signature, inventory, `release-manifest.json`, `supported-upgrades.json`, `RELEASE_NOTES.md`, `SHA256SUMS`,
`SHA256SUMS.minisig`, and the inventories named in the manifest. Verify `SHA256SUMS.minisig`, then verify the Debian
package digest and GitHub release provenance. Every check must identify version 0.1.16 and the exact package name.

## Install and first launch

Open the verified `FitFreed_0.1.16_amd64.deb` in Ubuntu App Center or another native graphical Debian installer and
approve the ordinary administrator authorization required by package management. Launch FitFreed from the desktop
application menu and confirm version 0.1.16 before importing data. Do not extract the package, copy files manually,
or substitute a third-party package.

## Language and first run

FitFreed supports English (United States) and Spanish (Spain). It selects a supported operating-system language on
first run and otherwise uses English. **Show me how** opens the bundled localized source-acquisition guide. Official
provider links open explicitly in the default browser; FitFreed never receives account credentials.

## Import, reimport, and exploration

Select the original ZIP. An exact reimport does not duplicate canonical history; compatible later exports and mapping
versions reconcile through documented source identities. FitFreed provides complete-history training exploration,
activity, sleep, recovery, routes, signals, zones, comparisons, and durable reports with self-contained HTML report export.
Missing evidence does not become zero, and correlation does not become diagnosis or training advice.

## Local data and privacy

FitFreed has no account, analytics, or synchronization service. The library is stored beneath `$XDG_DATA_HOME` when
set, otherwise beneath `~/.local/share/org.fitfreed.desktop`. Update checks transmit no imported facts, provider data,
locale, library schema, installation identifier, or usage data. Never publish personal exports or diagnostics.

## Updates and recovery

Settings provides an explicit update check and a quiet scheduled check. A compatible update uses the native Debian
package flow and can require administrator authorization. Before replacement, FitFreed preserves the installed
application and local library; failed confirmation triggers automatic recovery to the verified predecessor. Do not
delete recovery files while recovery is active.

## Remove the application or delete its data

Removing the Debian package removes the application and retains the separate local library. Permanent data deletion
is a distinct destructive choice made only after FitFreed is stopped and the original exports are preserved. Remove
the complete `org.fitfreed.desktop` application-data directory, never only the SQLite file or its sidecars.

## Unsupported systems

This release does not support ARM64 Linux, other distributions, AppImage, RPM, Flatpak, Snap, server-only sessions, or
system-wide shared libraries. Compatibility on another Debian-derived system must not be inferred from package
installation alone.

## Safe support and security reports

Use [SUPPORT.md](../../SUPPORT.md) for ordinary defects and [SECURITY.md](../../SECURITY.md) or GitHub private
vulnerability reporting for suspected vulnerabilities. Reproduce with synthetic data whenever possible and never
publish personal fitness evidence or credentials.
