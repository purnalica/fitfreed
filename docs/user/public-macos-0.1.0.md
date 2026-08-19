# Public macOS 0.1.0 Guide

## Status

This is the version-matched guide for a future FitFreed 0.1.0 public macOS release. No public binary is available while the [public-release readiness ledger](../testing/public-release-readiness.md) contains an open gate. This guide becomes operative only for an immutable `v0.1.0` GitHub Release published by `purnalica/fitfreed`; source archives, development packages, Actions artifacts, forks, and third-party packages are not that release.

FitFreed 0.1.0 supports Apple Silicon on macOS 15.0 or later. It is experimental GPL-3.0-or-later software provided without warranty and at the user's own risk. Read the [project disclaimer](../../DISCLAIMER.md) before installation.

## Preserve the source data first

Keep every original provider ZIP unchanged in an independently protected location. FitFreed does not replace the source export, and version 0.1.0 has no supported user-controlled library backup, restore, or portable normalized export workflow.

Do not use FitFreed as the only copy of important information. Verify consequential values against their source, and do not treat any view as medical, health, training, safety, or legal advice.

## Download and verify

Download only from the immutable `FitFreed 0.1.0` Release in the [canonical GitHub repository](https://github.com/purnalica/fitfreed/releases). The release must contain these regular assets:

- `FitFreed_0.1.0_aarch64.dmg`;
- `FitFreed_0.1.0_aarch64.app.tar.gz` and its `.sig` file;
- `stable.json`, `supported-upgrades.json`, and `release-manifest.json`;
- `RELEASE_NOTES.md` and `SHA256SUMS`; and
- the npm and Cargo CycloneDX inventories named in the manifest.

The source ZIP and source tarball automatically shown by GitHub are not application installers. Do not install when the Release is missing an expected asset, is marked as a draft or prerelease, does not report immutable protection, or identifies another tag.

After downloading every regular asset into one otherwise empty directory, verify the checksum inventory:

```sh
shasum -a 256 -c SHA256SUMS
```

Every line must report `OK`. The manifest, checksum file, release-note version, DMG name, and GitHub tag must all identify 0.1.0. A mismatch is a hard stop; do not rename an asset or edit the inventory to make the check pass.

GitHub CLI users can additionally verify that the immutable Release and a selected asset are linked to GitHub's release attestations:

```sh
gh release verify v0.1.0 --repo purnalica/fitfreed
gh release verify-asset v0.1.0 FitFreed_0.1.0_aarch64.dmg \
  --repo purnalica/fitfreed
```

The published release notes contain the exact source revision and explain how to perform the stricter build-provenance check. Checksum or attestation success does not replace macOS code-signing and notarization checks.

## Install and launch

1. Open the verified `FitFreed_0.1.0_aarch64.dmg`.
2. Drag `FitFreed.app` to the Applications destination shown by the disk image.
3. Eject the disk image.
4. Open FitFreed from Applications.
5. Confirm the interface identifies version 0.1.0 before importing anything.

The public package must open through the ordinary macOS path because it is Developer ID signed and Apple notarized. If macOS reports an unidentified developer, a damaged application, or another trust failure, stop. Never disable Gatekeeper globally, remove quarantine attributes, apply an ad-hoc signature, or use a terminal bypass.

No development toolchain, administrator script, npm, Rust, database editor, or manual application-bundle modification belongs in the installation procedure.

## Language and first run

FitFreed initially supports English (United States) and Spanish (Spain). On first run it selects the first supported operating-system language and otherwise falls back to English. A manual language change persists across restarts and changes presentation only; it never rewrites imported facts.

The application contains the complete localized import, coverage, exploration, update, failure, and recovery guidance for both supported locales. Canonical web and engineering documentation remains English so that it has one source of truth.

## Import and reimport

Choose the original ZIP itself. Do not unpack it, repack it, rename its members, or edit its JSON files.

1. Choose the ZIP package and start the import.
2. Keep FitFreed open while package assessment, mapping, reconciliation, and committing progress is displayed.
3. Review the terminal outcome and all five coverage categories: supported, unsupported, deliberately ignored, unrecognized, and invalid.
4. Review every family reason and next action. Recognized does not mean imported.

Cancellation before the final atomic visibility boundary leaves no partial canonical history. A request made after committing starts waits for that boundary to finish.

An exact reimport does not duplicate canonical history. Prior evidence is reused only while the provider, importer, mapping, coverage, and source-subject contracts still agree. The same bytes are reassessed after a relevant contract changes. A later export is reconciled by each observation's logical identity: new facts are added, equivalent facts are preserved, documented revisions can amend prior facts, and incompatible alternatives remain explicit conflicts rather than being selected by ZIP order.

The [Polar Flow compatibility reference](../data-formats/providers/polar-flow.md) defines the evaluated export families, shapes, exclusions, and known variations.

## Explore the local history

Version 0.1.0 provides provider-neutral views for:

- daily activity overview, range, exact day detail, and period comparison;
- training overview, range, exact session summary, exercise/lap/pause structure, bounded local primary and transition route traces, paginated exact route points, gap-aware supported signal charts, paginated exact signal samples, and period comparison;
- primary sleep overview, range, phases, timeline, score detail, and period comparison;
- dated nightly recovery overview, range, exact source-context detail, and period comparison; and
- one longitudinal dashboard with a shared range, aligned day synopsis, navigation, and period comparison.

Every visual has exact values or a table alternative. Missing and unavailable observations do not become zero. Histories from different opaque origins stay separate. Aligned observations establish recorded co-occurrence only; FitFreed does not infer causation, readiness, diagnosis, or advice.

External route maps, provider-defined zones, unsupported training-signal types, undated recovery samples, other providers, portable normalized export, and user-controlled backup and restore are outside 0.1.0.

## Local data and privacy

The application library and preferences remain local by default under:

`~/Library/Application Support/org.fitfreed.desktop/`

The active SQLite library is `fitfreed.sqlite`. The same directory can contain private update-recovery state. Treat the whole directory as sensitive fitness, health, provenance, and machine-local information even when individual filenames look harmless.

FitFreed has no account, analytics, or synchronization service. An update check contacts only the fixed public update endpoint and sends no imported facts, provider data, locale, library schema, installation identifier, or usage data. Import and exploration remain available offline; an unavailable update service does not block either.

Never attach a real export, library, route, screenshot, log, crash report, or diagnostic containing personal history to a public issue.

## Updates and automatic recovery

The Application updates panel always permits an explicit check. FitFreed also checks after ready startup and every 24 hours while it remains open. Ordinary current, offline, dismissed, or postponed scheduled outcomes stay quiet.

Only a newer compatible release authenticated by the embedded stable-channel trust can offer installation. Review its localized notes before acting. A release can be dismissed or postponed for 24 hours. A withdrawn installed version produces persistent guidance and cannot be treated as an ordinary optional candidate.

Before replacement, FitFreed verifies the exact package and preserves the installed application and SQLite library as one recovery pair. Import, locale changes, and another update cannot overlap installation. The replacement must reopen and confirm its exact application version and library; otherwise the independent watchdog restores the verified previous pair. The next ready launch reports `updated` or `recovered` until acknowledgement succeeds.

If FitFreed does not reopen, wait for bounded automatic recovery and then open it once. If the problem remains, stop update attempts and preserve the complete application-data directory. Do not edit the database, delete recovery files, reinstall over the existing library, or retry from an unverified package. Follow the current Release guidance and [support boundary](../../SUPPORT.md).

## Remove the application or delete its data

Moving `FitFreed.app` to the Trash removes the application and intentionally leaves the separate library. Reinstalling the same or a compatible later version can reopen it.

Deleting personal FitFreed state is a separate destructive choice:

1. Quit FitFreed and confirm it is no longer running or updating.
2. Preserve the original provider ZIPs and any independent backups that must remain.
3. In Finder, choose **Go → Go to Folder** and enter `~/Library/Application Support/`.
4. Locate the directory named exactly `org.fitfreed.desktop`.
5. Move that complete directory to the Trash only when permanent loss of the library, preferences, provenance, and recovery state is intended.
6. Empty the Trash only after confirming the exact target. macOS backups or synchronized storage can retain other copies and require their own deletion controls.

There is no in-application deletion command in 0.1.0. Never delete only the SQLite file, its sidecars, or selected recovery files as a repair technique.

## Safe support and security reports

A useful report contains the FitFreed version and public source revision, the broad supported platform classification, the action that failed, stable interface text or a privacy-safe error code, the boundary before which it failed, and whether a synthetic package reproduces it.

Use [GitHub Issues](https://github.com/purnalica/fitfreed/issues) for reproducible non-security defects. Suspected vulnerabilities must use the confidential route in [SECURITY.md](../../SECURITY.md). Do not include personal values, paths, provider identifiers, database contents, tokens, signatures, keys, or screenshots containing history.
