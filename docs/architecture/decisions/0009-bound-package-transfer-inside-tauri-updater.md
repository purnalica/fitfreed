# ADR 0009: Bound package transfer inside the Tauri updater

- **Status:** Accepted
- **Date:** 2026-08-17
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [Product requirements](../../requirements.md)
- **Related architecture:** [Update trust](../update-trust.md), [ADR 0008](0008-authenticate-update-policy-above-tauri.md)

## Context

ADR 0008 requires the official Tauri updater to verify the package signature and perform native replacement, while FitFreed binds those package bytes to authenticated URL, size, SHA-256 digest, version, target, and compatibility policy. The package transfer must also have a hard byte limit before allocation can grow beyond the signed expectation.

The pinned `tauri-plugin-updater` 2.10.1 Rust API exposes `Update::download`, which returns a fully buffered `Vec<u8>`, and `Update::install`, which installs those returned bytes. Inspection of the [official implementation](https://docs.rs/tauri-plugin-updater/2.10.1/src/tauri_plugin_updater/updater.rs.html) shows that `download` invokes an infallible progress callback, appends every response chunk, and verifies the package signature only after the response ends. Neither the callback nor the public API can stop a response that exceeds authenticated expectations. A malicious or broken artifact endpoint therefore need not forge a signature to cause unbounded memory growth.

The updater also creates its native `Update` installation object only after fetching and parsing an endpoint. Repeating that fetch after FitFreed authenticates a snapshot would introduce a second unbounded metadata read and a time-of-check/time-of-use boundary. Reimplementing platform replacement would discard the maintained cross-platform installer selected in ADR 0008.

## Decision drivers

- Abort transfer before buffering more than the exact signed package size.
- Preserve Tauri's package-signature verification and native installers.
- Construct the native update only from the release already authorized by FitFreed.
- Keep all package authority in Rust; React must not receive updater permissions, URLs, signatures, paths, or bytes.
- Make the deviation from upstream small, reproducible, reviewable, and removable.

## Considered alternatives

### Use the unmodified download and validate afterward

FitFreed could compare size and digest after `Update::download` returns. This detects substitution but does not bound memory before signature verification. Content length, timeouts, or the progress callback do not provide a hard streamed-byte limit. This does not meet the requirement.

### Download independently and reimplement verification or native installation

A separate bounded HTTP client can validate size and digest, but `Update::install` requires an updater-owned object that cannot be constructed through the public API. Reimplementing Minisign policy or each operating system's replacement behavior creates parallel security and installation code and weakens the selected maintenance boundary.

### Maintain a minimal, pinned source refinement of the official updater

The published updater source can remain intact except for two narrow Rust APIs: prepare an `Update` from an explicitly supplied `RemoteRelease` without network access, and download with an expected byte limit that terminates before appending an excess chunk. The existing updater continues to verify its configured package public key and perform native installation.

## Decision

FitFreed will maintain a minimal source refinement of the official `tauri-plugin-updater` 2.10.1 crate until equivalent upstream APIs are available.

- The vendored crate records the upstream version, crate archive SHA-256 `806d9dac662c2e4594ff03c647a552f2c9bd544e7d0f683ec58f872f952ce4af`, original licenses, source location, and exact FitFreed changes.
- A repository check rejects missing provenance, unexpected vendored files, upstream drift, or a dependency that bypasses the reviewed local source.
- `UpdaterBuilder` may build without a metadata endpoint only for the authenticated-release path. `Updater` may then prepare one native `Update` directly from a `RemoteRelease` built from the fresh `UpdateInstallationAuthorization`. Neither operation performs an endpoint request or applies a second version comparator.
- The authorization retains the authenticated signing-key identifier. The native adapter resolves only that active public key from the same configured trust set, and the prepared update must exactly match the authorization's version, target, URL, and package signature before any transfer.
- The bounded download rejects a declared length different from the signed size and aborts before appending a chunk that would exceed it. Completion requires exact length. Tauri's existing package-signature verification still runs over the resulting bytes.
- FitFreed compares the exact byte length and SHA-256 digest again before calling Tauri's existing `Update::install`.
- The Rust host owns the updater plug-in. No JavaScript updater package or updater capability is added.
- Ordinary builds remain unconfigured until real endpoint and public-key authority are supplied.

Updating the vendored dependency requires a dedicated review of upstream source changes, rebuilding the minimal refinement, all update and recovery evidence, license and dependency scans, and removal of any refinement that the new public API makes unnecessary.

## Consequences

### Positive

- Untrusted package bytes cannot grow memory beyond the signed expectation plus one incoming chunk that is rejected before copying.
- The exact authenticated release creates the native installer object without a second network read.
- Tauri continues to own package signature semantics and operating-system replacement.
- The security-critical difference from upstream is explicit and locally reviewable.

### Negative

- FitFreed temporarily owns a small dependency fork and its update discipline.
- Upstream updater upgrades require more review than a normal dependency version change.
- The updater still returns verified package bytes in memory because its native installation API consumes bytes; the signed package maximum and release process must keep that bound appropriate for supported machines.

### Risks and mitigations

- A large or stale fork could diverge from security fixes. The source is pinned, changes are narrowly documented, automated provenance checks fail closed, and dependency updates remain release blockers until reviewed.
- An upstream API change could make the refinement obsolete. Every updater upgrade must explicitly check for an abortable bounded download and construction from authenticated metadata.
- An incoming network chunk can itself be larger than the remaining allowance. The adapter rejects it before copying; the HTTP library owns only that current chunk.

## Verification

Tests must reject declared lengths below and above the signed expectation, absent lengths with short and excess streams, read failures, redirects, non-success responses, malformed package trust, invalid signatures, wrong digests, and changed version, target, URL, or signature. A valid synthetic package must pass Tauri's signature verifier and exact FitFreed size and digest checks before an instrumented installer receives the bytes. Repository automation must verify provenance and execute the vendored crate tests. Release-shaped E2E must additionally exercise interruption, replacement failure, migration failure, and recovery before this path is considered complete.
