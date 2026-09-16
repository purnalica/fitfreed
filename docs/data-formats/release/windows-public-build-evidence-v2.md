# FitFreed Windows Public Build Evidence Version 2

## Purpose and authority

Version 2 transfers one accepted public unsigned Windows preview package into complete-platform composition. It binds
the exact NSIS setup, package inventory version 2, source revision, application version, storage schema, update trust,
and the limitations that distinguish preview availability from stable Windows support. The structural authority is
[`windows-public-build-evidence-v2.schema.json`](../../../schemas/windows-public-build-evidence-v2.schema.json).

Artifact naming, target identity, deterministic encoding, privacy, and update-key ordering retain version 1 semantics.
The format is `org.fitfreed.windows-public-build-evidence` and `schemaVersion` is `2`.

## Trust and limitations

`trust.profile` is `public-unsigned-preview`. `trust.authenticode` records `status` `not-provided`,
`publisherIdentity` `unknown`, and reason `unsigned-preview`. No certificate field is permitted.

`limitations` is a closed object whose `exactWindows11Admission` value is `false`; SmartScreen continuation may be
required, managed policy may block execution, and Smart App Control may block the package. These values are release
facts carried into the product site and release notes, not optional warnings.

## Verification set

The ordered verification list records passed package contract, unsigned setup inspection, current-user installation,
unsigned installed-binary inspection, package inventory, and clean removal. It proves the exact bytes are deliberately
unsigned and that the native package lifecycle passed on the pinned hosted Windows environment. It does not transform
hosted Windows Server evidence into Windows 11 client evidence.

The independent `stable-v3` updater trust and later checksum signature, provenance, immutable-release, and remote-byte
verification remain mandatory. Version 1 remains the immutable Authenticode build-evidence contract.
