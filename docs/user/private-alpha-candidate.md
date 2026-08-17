# Private macOS Alpha Candidate Guide

## Status

This is version-matched candidate documentation for FitFreed 0.1.0. It does not announce an available release or authorize use of any development package. The private alpha boundary opens only after the exact candidate passes every release gate, an authorized participant receives it through the controlled distribution process, and the participant is given the matching integrity and support information.

FitFreed 0.1.0 is intended to be an unsigned, non-notarized private macOS evaluation. It must not be uploaded to a public release channel. The supported platform boundary is Apple Silicon on macOS 15.0 or later. Read the [project disclaimer](../../DISCLAIMER.md) before deciding whether to participate.

## Before installation

An authorized handoff must provide one complete version directory containing the DMG, `SHA256SUMS`, `release-manifest.json`, `supported-upgrades.json`, release notes, and the production dependency inventories. The version, source revision, architecture, unsigned status, library-schema support, and digest of every artifact must agree with the manifest.

Do not install when:

- the handoff is not explicitly authorized for the evaluation;
- any evidence file is missing or its verification fails;
- the package architecture does not match the Mac;
- the release notes or known limitations do not identify version 0.1.0;
- macOS refuses the application and no participant-specific, non-global launch procedure has been supplied; or
- the original provider ZIP is not preserved independently.

Never disable Gatekeeper globally, remove quarantine metadata, or change system-wide security settings to open FitFreed. A private-alpha launch exception, if accepted for the evaluated candidate, must be limited to that exact verified application and documented by the controlled distribution process.

## Installation and first launch

The candidate uses the familiar macOS DMG drag-copy layout. After the authorized integrity check succeeds:

1. Open the verified FitFreed DMG.
2. Drag `FitFreed.app` to the Applications destination shown by the image.
3. Eject the image.
4. Open FitFreed through the participant-specific approved macOS procedure.
5. Confirm that the application identifies itself as version 0.1.0 before importing anything.
6. Select English (United States) or Spanish (Spain). The selection persists across restarts and does not alter imported facts.

Installation must not require a development toolchain. If the supplied procedure asks for source code, npm, Rust, database editing, a global security change, or an unverified replacement application, stop and report the mismatch.

## Import and reimport

Keep every original Polar Flow export unchanged and outside FitFreed. Select the ZIP itself; do not unpack, rename members, edit JSON, or construct a replacement package from extracted files.

1. Choose the ZIP package.
2. Review the selected package state and start the import.
3. Keep FitFreed open while assessment, mapping, reconciliation, and committing progress is shown.
4. Cancellation is safe before the final atomic visibility boundary. A request made after committing begins waits for that boundary to finish.
5. Review the terminal outcome and all five coverage categories: supported, unsupported, deliberately ignored, unrecognized, and invalid.
6. Review each family reason and next action. Recognition is not the same as support, and an invalid supported family rejects the package without exposing partial canonical changes.

An exact reimport does not duplicate canonical history. Fast reuse is allowed only when the previous import completed with full coverage and the provider, importer, mapping, and source-subject evidence contracts still match. The same ZIP is reassessed after one of those compatibility contracts changes. A later or different ZIP is reconciled by the logical identity of each supported observation, so new facts can be added, equivalent facts preserved, documented revisions amended, and incompatible facts retained as conflicts rather than selected by archive order.

## Exploration boundary

Version 0.1.0 provides:

- daily-activity overview, range, exact day detail, and period comparison;
- training-summary overview, range, exact session detail, and period comparison;
- primary-sleep overview, range, phases, timeline and score detail, and period comparison;
- dated nightly-recovery overview, range, exact source-context detail, and period comparison; and
- one provider-neutral longitudinal dashboard with a shared range, aligned exact day synopsis, navigation, and period comparison.

Every visual has exact values or a table alternative. Missing and unavailable observations do not become zero. Histories from different opaque origins remain separate. The longitudinal view reports recorded co-occurrence only; it does not infer causation, readiness, diagnosis, or advice.

Routes, full-resolution training and physiological samples, undated recovery samples, additional providers, portable normalized export, and user-controlled backup and restore are not included. Consult the [Polar Flow compatibility reference](../data-formats/providers/polar-flow.md) for the exact evaluated families and shapes.

## Local data and privacy

Imported history and application state remain local by default in:

`~/Library/Application Support/org.fitfreed.desktop/`

The active SQLite library is `fitfreed.sqlite`. The directory may also contain private update-recovery state. It can contain sensitive fitness, health, provenance, and machine-local information even when filenames appear harmless.

The ordinary 0.1.0 build has no analytics, account, synchronization service, configured update endpoint, or production trust key. An activated private-alpha build may contact only its configured update service. Update checks do not send imported facts, provider data, locale, library schema, installation identifier, or usage data.

FitFreed does not replace the original ZIP and does not provide a supported user-controlled normalized backup or restore procedure in 0.1.0. Preserve every original export and keep it in the participant's existing protected backup process. Automatic preservation created immediately before an authorized application update is narrowly scoped update-recovery state, not a general backup.

Never attach a real ZIP, FitFreed library, route, screenshot, log, or diagnostic containing personal data to a public issue. Follow [SECURITY.md](../../SECURITY.md) for suspected vulnerabilities.

## Updates and recovery

The Application updates panel shows the installed version and always permits an explicit check. A configured private-alpha build checks after ready startup and every 24 hours while it remains open. Offline or unconfigured checks do not block import or exploration and do not generate repeated intrusive notices.

Only a newer compatible release from the authenticated channel can offer installation. Its localized release notes may be dismissed or postponed for 24 hours. Before native replacement, FitFreed verifies the exact package and preserves the installed application and SQLite library as one recovery pair. Import, language changes, and another update cannot overlap installation.

After replacement, the new application must reopen and confirm its exact version and library. Otherwise the independent watchdog restores the verified previous pair. The next ready startup reports either the successful update or automatic recovery; retain that notice until acknowledgement succeeds.

If FitFreed does not reopen, wait for bounded automatic recovery and then open it once. If the problem remains, quit further installation attempts and preserve the complete application-data directory. Do not edit `fitfreed.sqlite`, delete update-recovery files, reinstall over the existing library, or retry with an unverified package.

## Removal and deletion

Moving `FitFreed.app` to the Trash removes the application but intentionally leaves the separate library intact. Reinstalling the same or a compatible later version can therefore reopen it.

Deleting personal FitFreed state is a distinct destructive action:

1. Quit FitFreed and confirm that it is no longer running.
2. Preserve the original provider ZIPs and any independently required evidence.
3. In Finder, choose **Go → Go to Folder** and enter `~/Library/Application Support/`.
4. Locate the directory named exactly `org.fitfreed.desktop`.
5. Move that complete directory to the Trash only when permanent loss of the FitFreed library, preferences, provenance, and recovery state is intended.
6. Empty the Trash only after checking the exact target. macOS backups or synchronized storage may retain separate copies and must be handled through their own controls.

There is no in-application deletion command in 0.1.0. Never delete only the SQLite file, its sidecars, or selected recovery files as a repair technique.

## Safe problem reports

A useful private report contains:

- FitFreed version and source revision from the manifest;
- macOS version and processor architecture;
- the action that failed and its stable localized error text;
- whether the failure occurred before import visibility or application replacement; and
- whether the issue reproduces with an independently generated synthetic package.

Do not include personal values, archive or library names, filesystem paths, provider identifiers, package fingerprints, database contents, private update URLs, signatures, keys, or screenshots containing history. Preserve the first failure and avoid cleanup experiments until the participant support contact supplies a bounded procedure.

## Known acceptance gates

The [private alpha readiness ledger](../testing/private-alpha-readiness.md) records why this proposed private profile was not accepted. The consolidated [public-release ledger](../testing/public-release-readiness.md) is the canonical current status, and the [public macOS guide](public-macos-0.1.0.md) owns the intended release journey. This private guide would have become active only if all of the following had been true for one exact private candidate:

- the complete local and hosted release gates pass from its clean source revision;
- the complete hosted macOS and clean local Apple Silicon campaigns pass the required import, query, rendering, migration, and recovery budgets;
- the private update endpoint and protected production signing authority are configured and verified;
- the controlled handoff defines integrity verification and the exact unsigned macOS launch procedure without a global security change;
- the participant understands that no supported user backup/restore or portable normalized export exists in 0.1.0; and
- the controlled [realistic usability, keyboard, VoiceOver, scaling, contrast, and recovery evaluation](../testing/macos-candidate-manual-evaluation.md) is ready.

Until then, use the [synthetic development preview](development-preview.md), not a personal export.
