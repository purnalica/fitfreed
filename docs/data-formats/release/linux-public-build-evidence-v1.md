# Linux Public Build Evidence Version 1

## Purpose and boundary

Linux public build evidence version 1 transfers one exact, unsigned Debian build from the source-bound Ubuntu 24.04
builder into the protected macOS composition job without transferring credentials or relying on a filename alone. The
statement becomes the `linux-build-evidence` artifact in an expanding public Release and is authenticated by that
Release's signed checksums and `github-artifact-attestations` provenance.

[`linux-public-build-evidence-v1.schema.json`](../../../schemas/linux-public-build-evidence-v1.schema.json) is the
normative machine-readable JSON Schema. The expected filename is
`FitFreed_<version>_amd64.deb.build.json`. Unknown fields, unknown checks, altered ordering, mismatched versions,
unsafe paths, invalid digests, or incomplete evidence are rejected.

## Identity

`release` contains the semantic application version, exact 40–64 character lowercase Git revision, and deterministic
generation time. `target` is fixed to the `linux-x86_64-deb` target built on Ubuntu 24.04. `application` binds the
provider-neutral FitFreed identity, executable, and storage schema.

This statement does not claim Ubuntu 26.04 acceptance. That supported-system claim requires the separate clean
candidate gate in Milestone 4.6.

## Artifact binding

`artifacts.package` is exactly `FitFreed_<version>_amd64.deb` with kind `linux-x86_64-deb`, byte size, and SHA-256.
`artifacts.inventory` is the corresponding `.deb.inventory.json` contract with its own byte size and SHA-256. The
inventory reopens the package identity, dependency expression, installed paths, permissions, file digests, launcher,
icons, license, and removal ownership; the build statement never replaces that detailed contract.

The protected composer verifies both files against this statement, verifies that the inventory binds the package, and
then signs the package for the updater. A changed package, inventory, version, revision, or schema requires a new build
statement and invalidates the prior composition input.

## Closed verification set

`verification` contains exactly these ordered successful checks:

1. `linux-package-contract` — package name, architecture, version, metadata, dependencies, and external identity;
2. `linux-package-inventory` — exact extracted layout and package digest;
3. `ubuntu-24.04-clean-installation` — installation and launch prerequisites without development tooling; and
4. `ubuntu-24.04-clean-removal` — package-owned removal while the separate local library remains retained.

The builder writes the statement only after all four commands pass in the same job against the artifact it transfers.
A text value cannot turn a failed or skipped command into evidence; workflow ordering and the final source-bound
GitHub provenance remain mandatory.

## Privacy and security

The statement contains no runner name, workflow identifier, host details, filesystem path, user data, provider export,
credential, signing material, or personal identity. It is not an updater signature, release signature, platform-native
signature, publication authorization, Ubuntu 26.04 support claim, or product-owner acceptance.
