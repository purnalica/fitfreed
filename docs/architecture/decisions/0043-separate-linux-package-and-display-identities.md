# ADR 0043: Separate Linux package and display identities

- **Status:** Accepted
- **Date:** 2026-09-03
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [update trust](../update-trust.md)

## Context

The canonical product name is `FitFreed` and the canonical Debian package identity is `fitfreed`. Tauri 2.11.4 uses
one `productName` input for three different purposes: it preserves that value when naming the generated Debian
artifact and desktop file, converts it to kebab case for the Debian control `Package` field, and exposes it to the
default desktop-entry template as the visible application name. A Linux overlay containing `FitFreed` therefore
produces the unintended package identity `fit-freed`.

The public release and update contracts already bind the external artifact name
`FitFreed_<version>_amd64.deb`. Rebuilding the Debian archive after Tauri signs it would change the package bytes and
invalidate the mandatory updater signature. Accepting `fit-freed` would instead contradict the technical identity,
native update recovery, and package-manager contracts.

This decision concerns Linux packaging only. It does not change the public product name, application identifiers,
executable name, update URLs, or another platform's package contract.

## Decision drivers

- Preserve the canonical `fitfreed` Debian package and executable identities.
- Keep `FitFreed` as the visible product name and external release artifact identity.
- Preserve the exact bytes covered by Tauri's updater signature.
- Keep generated and public package names deterministic and fail closed on unexpected bundle output.

## Considered alternatives

### Adopt `fit-freed` as the Debian package name

This would accept Tauri's derived value but create a platform-specific identity that conflicts with native recovery,
installation, and removal contracts.

### Rebuild the Debian archive after Tauri packaging

The control record could be rewritten to `fitfreed`, but the rebuilt bytes would no longer match the updater
signature produced by Tauri. Re-signing a modified package outside the source build would introduce a second package
construction boundary and weaken artifact provenance.

### Set a technical bundle identity before packaging and separate display and release names

The Linux overlay can use `fitfreed` as Tauri's technical `productName`, while a reviewed desktop template retains
`Name=FitFreed`. Tauri then creates the correct Debian control identity and unchanged package bytes. A constrained
post-build operation changes only the generated filesystem name, together with its detached updater signature when
present, to the already versioned public artifact name.

## Decision

FitFreed uses the technical Linux bundle identity `fitfreed` before Tauri packages the application.

- The Linux Tauri overlay sets `productName` to `fitfreed`. Tauri therefore emits Debian `Package: fitfreed`, the
  executable `/usr/bin/fitfreed`, and `/usr/share/applications/fitfreed.desktop`.
- The versioned Debian desktop template fixes the visible launcher name to `FitFreed`. It does not add a generic ZIP
  association.
- The supported external artifact remains `FitFreed_<version>_amd64.deb`. After a successful Tauri build, the build
  wrapper admits only the exact generated `fitfreed_<version>_amd64.deb` and changes its filename without reading or
  rewriting its bytes.
- A public candidate requires recoverable `stable-v3` update trust and the exact updater signature generated beside
  the package. The wrapper changes the package and signature filenames as one recoverable pair; their contents remain
  unchanged.
- The installed E2E package uses the separate technical product name `fitfreed-e2e`, package name `fitfreed-e2e`,
  executable `/usr/bin/fitfreed-e2e`, and application identity `org.fitfreed.desktop.e2e`.
- Unexpected Debian artifacts, non-regular destinations, an absent required signature, or evidence of an interrupted
  prior filename transition fail before a result is admitted.

## Consequences

### Positive

- Debian package-manager identity agrees with installation and recovery contracts.
- The launcher and public artifact retain the approved product name.
- Updater signatures continue to cover the exact package bytes that are distributed.
- Tauri-specific name derivation remains confined to the Linux packaging adapter.

### Negative

- Linux packaging owns a custom desktop template and a post-build filename transition.
- A Tauri upgrade must revalidate its package-name, desktop-template, artifact-name, and signature-output behavior.

### Risks and mitigations

- A case-insensitive development filesystem can treat the generated and canonical filenames as one file. The
  transition compares filesystem identity and is tested on that boundary without assuming case-sensitive paths.
- Stale or unrelated Debian output could be renamed accidentally. The wrapper accepts only the version-derived
  generated and replaceable canonical filenames and rejects every additional Debian artifact.
- A partial two-file transition could separate a package from its signature. Existing canonical files are retained
  under private temporary names until both moves succeed, and a later run rejects leftover transition evidence.

## Verification

Automation tests prove the technical package derivation, closed Tauri overlay, visible desktop name, byte-preserving
unsigned and signed filename transitions, rejection of unknown output, required public signature, build ordering, and
failure behavior. Hosted Ubuntu packaging must additionally inspect the real Debian control record, installed desktop
path and display name, executable, external artifact name, and clean package-manager lifecycle. The installed Linux
capability and update-recovery E2E campaigns must use the exact technical package identities defined here.
