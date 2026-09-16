# FitFreed Windows Package Inventory Version 2

## Purpose and authority

Version 2 records one public unsigned Windows preview package. It extends the installed-layout, identity, digest,
removal, and data-preservation contract of [version 1](windows-package-inventory-v1.md) without reinterpreting that
immutable schema. The structural authority is
[`windows-package-inventory-v2.schema.json`](../../../schemas/windows-package-inventory-v2.schema.json).

## Compatibility

The format remains `org.fitfreed.windows-package-inventory`; `schemaVersion: 2` selects this contract. Artifact naming, target,
identity, installation, installed entries, deterministic ordering, privacy, and removal semantics are unchanged from
version 1. Consumers must select validation by `schemaVersion` and reject unsupported versions.

## Public preview trust profile

`signatures.profile` is exactly `public-unsigned-preview`. The setup, installed `fitfreed.exe`, and installed
`uninstall.exe` must each report:

- `status`: `NotSigned`;
- `certificateSha256`: `null`; and
- `timestamped`: `false`.

This is positive evidence that all three public trust surfaces are unsigned; it is not missing evidence and cannot be
substituted with the version 1 `unsigned-engineering` profile. The inventory does not claim Authenticode identity,
Windows reputation, exact Windows 11 admission, or universal installability.

The exact setup digest remains bound to the inventory and later release manifest. Tauri updater signatures, signed
release checksums, source provenance, immutable release origin, SBOMs, clean removal, and application-data
preservation remain independent mandatory controls.
