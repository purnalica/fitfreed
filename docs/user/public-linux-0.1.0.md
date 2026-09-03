# Public Linux 0.1.0 Guide

## Status

This inactive pre-publication guide is rendered against the repository's current unreleased 0.1.0 development
version so its exact names, commands, links, and documentation contracts can be verified. It does not announce or
reserve a Linux 0.1.0 release. No public Linux binary is available while the
[Milestone 4 execution ledger](../plans/milestone-4.md) contains an open gate or before the public macOS release
permits Linux promotion.

Under [ADR 0044](../architecture/decisions/0044-publish-expanding-complete-platform-sets.md), the operative guide and
artifacts use the next unreleased semantic version after the first immutable public macOS Release and contain newly
built macOS and Linux targets for that exact version. Release preparation regenerates every version-specific name and
piece of evidence together. This guide becomes operative only for Linux assets in an immutable `v0.1.0` GitHub
Release from `purnalica/fitfreed` when that is the version assigned to the expansion; source archives, development
packages, Actions artifacts, forks, and third-party packages are not that release.

FitFreed 0.1.0 will support x86-64 Ubuntu Desktop 24.04 and 26.04 LTS through one Debian package only after the exact candidate passes both clean-desktop matrices. It is experimental GPL-3.0-or-later software provided without warranty and at the user's own risk. Read the [project disclaimer](../../DISCLAIMER.md) before installation.

## Preserve the source data first

Keep every original provider ZIP unchanged in an independently protected location. FitFreed does not replace the source export, and version 0.1.0 has no supported user-controlled library backup, restore, or portable normalized export workflow.

Do not use FitFreed as the only copy of important information. Verify consequential values against their source, and do not treat any view as medical, health, training, safety, or legal advice.

## Download and verify

Download only from the immutable `FitFreed 0.1.0` Release in the [canonical GitHub repository](https://github.com/purnalica/fitfreed/releases). The Linux release set must contain these regular assets:

- `FitFreed_0.1.0_amd64.deb` and its updater signature `FitFreed_0.1.0_amd64.deb.sig`;
- `FitFreed_0.1.0_amd64.deb.inventory.json`;
- `stable.json`, `supported-upgrades.json`, and `release-manifest.json`;
- `RELEASE_NOTES.md`, `SHA256SUMS`, and `SHA256SUMS.minisig`; and
- the npm and Cargo CycloneDX inventories named in the manifest.

The source ZIP and source tarball automatically shown by GitHub are not application installers. Do not install when the Release is missing an expected asset, is marked as a draft or prerelease, does not report immutable protection, or identifies another tag.

After downloading every regular asset into one otherwise empty directory, first verify the detached signature of the checksum inventory with the public FitFreed release key and the exact command published in that Release. Then verify the files listed by the authenticated inventory:

```sh
sha256sum --check SHA256SUMS
```

Every line must report `OK`. The manifest, package inventory, checksum file, release-note version, Debian filename, and GitHub tag must all identify 0.1.0. A mismatch is a hard stop; do not rename an asset or edit the inventory to make the check pass.

GitHub CLI users can additionally verify that the immutable Release and the Debian package are linked to GitHub's release attestations:

```sh
gh release verify v0.1.0 --repo purnalica/fitfreed
gh release verify-asset v0.1.0 FitFreed_0.1.0_amd64.deb \
  --repo purnalica/fitfreed
```

The published release notes identify the exact source revision and explain the stricter build-provenance check. The checksum signature, artifact digest, updater signature, and GitHub attestation serve different trust purposes; success in one check does not replace the others.

## Install and first launch

1. Open the verified `FitFreed_0.1.0_amd64.deb` in Ubuntu App Center or the graphical software installer.
2. Confirm the proposed application is named FitFreed, identifies version 0.1.0, and comes from the package just verified.
3. Choose **Install**. Ubuntu may request administrator authorization for this native package operation.
4. Open FitFreed from the desktop application launcher.
5. Confirm **Settings → Updates** identifies version 0.1.0 before importing anything.

The package installs the technical executable at `/usr/bin/fitfreed` and exposes the visible application name FitFreed. No development toolchain, npm, Rust, project checkout, database editor, or project-authored installation script belongs in the user procedure.

Stop if the graphical installer reports an unsatisfied dependency, wrong architecture, damaged package, conflicting package identity, or incomplete installation. Preserve the verified download and follow the support route; do not extract the Debian package and copy individual files into the operating system.

## Language and first run

FitFreed initially supports English (United States) and Spanish (Spain). On first run it selects the first supported operating-system language and otherwise falls back to English. A manual language change persists across restarts and changes presentation only; it never rewrites imported facts.

The installed application contains localized import, coverage, exploration, update, failure, and recovery guidance for both supported locales. Canonical web and engineering documentation remains English so that it has one source of truth.

## Import, reimport, and exploration

Empty-library Home offers direct source guidance and ZIP selection. **Show me how** opens the bundled localized source-acquisition guide. Official provider pages open explicitly in the default browser; FitFreed never receives provider credentials, requests an export, monitors its preparation, or downloads it.

Choose the original ZIP itself. Do not unpack it, repack it, rename its members, or edit its JSON files. Keep FitFreed open until the import reaches a terminal result. Cancellation before the final atomic visibility boundary leaves no partial canonical history.

An exact reimport does not duplicate canonical history. The same bytes are reassessed after a relevant importer or mapping contract changes, and later compatible exports add or revise facts through documented source identities rather than ZIP order.

Version 0.1.0 provides local activity, sleep, recovery, and longitudinal views; complete-history training exploration with sport recognition and personal classification; exact session structure, signals, zones, route shapes, and personal ranges where the source contains supported evidence; comparisons; durable reports; and privacy-reviewed self-contained HTML report export. Every visual retains an exact-value or table path. Missing evidence does not become zero, and recorded co-occurrence does not become diagnosis, readiness, causation, or training advice.

The [development preview guide](development-preview.md), [route guide](session-routes.md), [personal-range guide](session-ranges.md), and [report guide](reports.md) document the shared application behavior in detail.

## Local data and privacy

FitFreed resolves its Linux application-data directory as follows:

- `$XDG_DATA_HOME/org.fitfreed.desktop/` when `XDG_DATA_HOME` is an absolute path; or
- `$HOME/.local/share/org.fitfreed.desktop/` otherwise.

The active SQLite library is `fitfreed.sqlite`. The same directory can contain preferences and private update-recovery state. Treat the whole directory as sensitive fitness, health, provenance, and machine-local information even when individual filenames look harmless.

FitFreed has no account, analytics, or synchronization service. An update check contacts only the fixed public update endpoint and sends no imported facts, provider data, locale, library schema, installation identifier, or usage data. Import and exploration remain available offline; an unavailable update service does not block either.

Never attach a real export, library, route, screenshot, log, crash report, or diagnostic containing personal history to a public issue.

## Updates and recovery

Open **Settings → Updates** for the installed version and an explicit update check. FitFreed also checks after ready startup and every 24 hours while it remains open. Ordinary current, offline, dismissed, or postponed scheduled outcomes stay quiet.

Only a newer compatible release authenticated by the embedded stable-channel trust can offer installation. Review its localized notes before acting. A release can be dismissed or postponed for 24 hours. A withdrawn installed version produces persistent guidance and cannot be treated as an ordinary optional candidate.

Before replacement, FitFreed verifies the exact Debian package and preserves the installed application, predecessor package, and SQLite library as one recovery set. Ubuntu may request administrator authorization to install or restore the native package. Import, locale changes, and another update cannot overlap installation.

If native authorization is temporarily unavailable, the preserved application and local library remain usable and **Settings → Updates** offers the bounded recovery retry. After three failed native attempts, FitFreed retains the recovery evidence and provides manual reinstall guidance instead of repeating indefinitely. A candidate that does not reopen and confirm its exact version and library triggers automatic recovery to the verified predecessor.

If FitFreed does not reopen, wait for bounded automatic recovery and then open it once. If the recovery notice remains, do not start another update, edit the database, delete recovery files, or install an unrelated package over the application. Preserve the complete application-data directory and follow the current Release guidance.

## Remove the application or delete its data

Removing FitFreed through Ubuntu App Center or the graphical software manager removes the application and intentionally retains the separate local library. Reinstalling the same or a compatible later version can reopen that library.

Deleting personal FitFreed state is a separate destructive choice:

1. Quit FitFreed and confirm it is no longer running or updating.
2. Preserve the original provider ZIPs and any independent backups that must remain.
3. In the file manager, show hidden files and open `.local/share` under the home directory, or open the absolute directory configured by `XDG_DATA_HOME`.
4. Locate the directory named exactly `org.fitfreed.desktop`.
5. Move that complete directory to the desktop trash only when permanent loss of the library, preferences, provenance, and recovery state is intended.
6. Empty the trash only after confirming the exact target. Backups or synchronized storage can retain other copies and require their own deletion controls.

There is no in-application deletion command in 0.1.0. Never delete only the SQLite file, its sidecars, or selected recovery files as a repair technique.

## Unsupported systems

The first Linux release does not support Ubuntu versions outside the admitted 24.04 and 26.04 LTS desktop boundary, other distribution families, ARM64 or another architecture, or AppImage, RPM, Flatpak, Snap, AUR, and other packaging formats. A package that happens to install elsewhere has not inherited FitFreed's installation, WebView, update, recovery, accessibility, performance, or removal evidence.

Do not convert, repackage, or publish the Debian artifact under another format and describe the result as an official FitFreed package. A future platform or package family requires its own documented support matrix and complete admission evidence.

## Safe support and security reports

A useful report contains the FitFreed version and public source revision, Ubuntu version and x86-64 architecture, the action that failed, stable interface text or a privacy-safe error code, the boundary before which it failed, and whether a synthetic package reproduces it.

Use [GitHub Issues](https://github.com/purnalica/fitfreed/issues) for reproducible non-security defects. Suspected vulnerabilities must use GitHub private vulnerability reporting as described in [SECURITY.md](../../SECURITY.md). Do not include personal values, paths, provider identifiers, database contents, tokens, signatures, keys, or screenshots containing history.
