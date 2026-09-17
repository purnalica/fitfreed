# Public macOS 0.1.20 Guide

## Status

This is the operative version-matched macOS guide for FitFreed 0.1.20 once immutable `v0.1.20` GitHub Release
exists in the [canonical repository](https://github.com/purnalica/fitfreed/releases/tag/v0.1.20). Before that exact
Release exists, this document describes a candidate and is not permission to install another build.

FitFreed 0.1.20 supports Apple Silicon on macOS 15.0 or later. It is experimental GPL-3.0-or-later software provided
without warranty and at the user's own risk. Read the [project disclaimer](../../DISCLAIMER.md) before installation.

## Preserve the source data first

Keep every original provider ZIP unchanged in an independently protected location. FitFreed does not replace the
source export and does not yet provide a supported user-controlled library backup, restore, or portable normalized
export workflow. Do not use FitFreed as the only copy of important information or as medical, training, safety, or
legal advice.

## Download and verify

Download only `FitFreed_0.1.20_aarch64.dmg` from immutable Release `v0.1.20`. The same Release must contain the updater
archive and signature, `release-manifest.json`, `supported-upgrades.json`, `RELEASE_NOTES.md`, `SHA256SUMS`,
`SHA256SUMS.minisig`, and the inventories named in the manifest. Verify the signed checksum inventory, the DMG digest,
and GitHub release provenance before opening it. A missing asset, mismatched version, mutable Release, or renamed file
is a hard stop.

## Install and launch

Open the verified DMG, drag FitFreed to Applications, eject the image, and launch that installed copy. macOS must
identify the expected Developer ID publisher and accept the notarized application through Gatekeeper. Do not bypass a
damaged, unidentified, differently signed, or quarantined package. Confirm FitFreed reports version 0.1.20 before
importing data.

## Language and first run

FitFreed supports English (United States) and Spanish (Spain). It selects a supported operating-system language on
first run and otherwise uses English. Language and appearance changes affect presentation only and persist locally.

When the library is empty, **Show me how** opens the bundled localized guide for obtaining a provider export. Official
provider links open explicitly in the default browser; FitFreed never receives account credentials.

## Import and reimport

Select the original ZIP. Validation and reconciliation preserve the existing library until the final atomic commit.
An exact reimport does not duplicate canonical history; a later compatible export adds or enriches facts, and a newer
mapping version may reassess the same source. The result exposes imported coverage and technical detail on demand.

## Explore the local history

FitFreed provides activity, sleep, recovery, aligned history, and complete-history training sport discovery with
sport naming, sessions, route shapes, signals, zones, source structure, comparisons, and user-authored segmentation
where supported evidence exists. Missing evidence does not become zero, and correlation does not become diagnosis or
training advice.

Reports support question-, exploration-, session-, and blank-start reports, deliberate evidence refresh, source
navigation, exact values, and privacy-reviewed self-contained HTML export. Every visualization retains an accessible
exact-value or table path.

## Local data and privacy

FitFreed has no account, analytics, or synchronization service. Imported history remains in the local application-data
directory identified by `org.fitfreed.desktop`. Update checks transmit no imported facts, provider data, locale,
library schema, installation identifier, or usage data. Never attach a real export, library, route, screenshot, or log
containing personal history to a public report.

## Updates and automatic recovery

Settings provides an explicit update check; a quiet scheduled check also runs after startup and at most once every 24
hours. Only a compatible package authenticated by embedded update trust can be offered. Before replacement, FitFreed
preserves the installed application and local library as bounded recovery state. Failed confirmation triggers
automatic recovery to the verified predecessor. Do not delete or edit recovery files while recovery is active.

## Remove the application or delete its data

Moving FitFreed from Applications to the Trash removes the application and retains the separate local library. Data
deletion is a distinct destructive action: stop FitFreed, preserve the original exports and any independent backups,
then move the complete `org.fitfreed.desktop` application-data directory to the Trash. Never delete only the SQLite
file or its sidecars as a repair technique.

## Safe support and security reports

Use [SUPPORT.md](../../SUPPORT.md) for ordinary defects and [SECURITY.md](../../SECURITY.md) or GitHub private
vulnerability reporting for suspected vulnerabilities. Reproduce with synthetic data whenever possible and never
publish personal fitness evidence or credentials.
