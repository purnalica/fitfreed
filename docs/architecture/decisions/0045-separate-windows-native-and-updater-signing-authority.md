# ADR 0045: Separate Windows native and updater signing authority

- **Status:** Accepted
- **Date:** 2026-09-04
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Release delivery](../release-delivery.md), [update trust](../update-trust.md), [Milestone 5 plan](../../plans/milestone-5.md)

## Context

The first public Windows package requires two independent signatures over the same final NSIS setup: Authenticode
establishes native Windows publisher trust, while the Tauri updater signature authenticates the exact bytes accepted by
the application updater. Authenticode must run on Windows through the selected certificate and SignTool. The expanding
complete-platform release compositor already owns the updater authority needed to sign macOS, Linux, and Windows
packages and to create one authenticated stable-channel target set.

A single Windows build job could receive both authorities and ask Tauri to emit the updater signature after applying
Authenticode. That would produce valid ordering, but it would distribute updater private authority to another protected
environment and let the native job create release-channel material before its setup, installation, removal, and
transport evidence had crossed an independent boundary.

This decision concerns authority placement and exact-byte handoff only. It does not change Windows package identity,
the complete-platform publication order, updater trust, certificate selection, or release authorization.

## Decision drivers

- Give each protected job only the private authority required for its native responsibility.
- Ensure the updater signature covers the final Authenticode-signed setup bytes.
- Keep one complete-platform compositor responsible for updater targets, sequence, signatures, and release evidence.
- Transfer Windows native results without transferring private credentials or machine identity.
- Reject substitution or mutation between native signing and complete candidate composition.

## Considered alternatives

### Give the Windows native builder both signing authorities

Tauri can apply Authenticode while constructing NSIS and then sign the completed setup for the updater. This keeps the
operations in one job but unnecessarily exposes updater private authority to the Windows environment and creates
channel material before the native result has been sealed and independently reopened.

### Build an unsigned setup and apply both signatures in the compositor

This centralizes private authority but cannot apply the required Windows-native Authenticode policy from the existing
non-Windows compositor. Moving complete composition to Windows would in turn require distributing the signing and
notarization authority for previously supported platforms to that environment.

### Apply Authenticode on Windows and updater signing in the complete-platform compositor

The Windows builder needs only native certificate authority and public updater trust. It can prove the final setup,
installed binaries, removal, and embedded channel configuration, then transfer those sealed bytes. The compositor can
reopen the exact input and add the updater signature together with every other platform target and release statement.

## Decision

Windows native signing and updater signing use separate protected authority boundaries.

- The x86-64 Windows builder receives public Authenticode authority and the source-controlled public updater trust set.
  It rejects every updater private-key input.
- Tauri applies Authenticode during NSIS construction. The native builder independently verifies the final setup,
  installed executable, and uninstaller against one admitted certificate fingerprint and timestamp policy.
- The builder stages exactly the setup, complete package inventory, and source-bound Windows public build evidence.
  Those files bind version, revision, storage schema, package and inventory digests, certificate fingerprint, and
  embedded updater trust identifiers without retaining private authority or machine paths.
- The handoff is sealed and reopened by exact transport digest before the complete-platform compositor receives updater
  authority.
- The compositor signs the unchanged Authenticode-signed setup for the updater and binds it to the complete macOS,
  Linux, and Windows stable target set, checksums, provenance, and publication snapshot.
- No Windows build evidence, transport artifact, or successful verification authorizes candidate promotion.

## Consequences

### Positive

- Compromise of the Windows native build boundary does not directly expose updater private authority.
- The updater signature covers the exact native-trusted setup that passed installation and removal verification.
- Stable metadata and all platform updater signatures remain under one composition boundary.
- Retained Windows input evidence is public, portable, deterministic, and independently verifiable.

### Negative

- Windows preparation and complete-platform composition require an additional sealed transport boundary.
- The compositor must verify Windows build evidence and the admitted certificate fingerprint before signing the setup.
- Candidate assembly cannot begin until the protected Windows native job has completed successfully.

### Risks and mitigations

- A setup could change in transit. The closed input, transport digest, inventory, and build evidence all bind its exact
  SHA-256 digest and reject additional or multiply linked files.
- A different certificate could be presented consistently inside self-declared evidence. The protected preparation
  compares setup and installed signature facts with the independently admitted certificate fingerprint, and the
  compositor requires that same expected public fingerprint when reopening the input.
- Update trust could change between build and composition. The evidence records the sorted key identifiers and stable
  endpoint embedded by the build; composition rejects drift from the source-controlled configuration at the same
  revision.

## Verification

Automation tests must reject updater private authority on the Windows builder, inactive or legacy updater trust,
unsigned or differently signed native artifacts, missing timestamps, changed digests, unexpected files, unsafe links,
and version, revision, schema, certificate, or updater-trust drift. The protected native workflow must prove public
installation and removal before sealing the three-file input. The compositor must reopen its exact transport digest,
verify the build evidence before receiving updater authority, sign the unchanged setup, and include every Windows
subject in the complete candidate's manifest, checksums, provenance, stable metadata, and Pages snapshot.
