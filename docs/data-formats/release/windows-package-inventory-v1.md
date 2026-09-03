# FitFreed Windows Package Inventory Version 1

## Purpose and authority

The Windows package inventory binds one x86-64 NSIS setup to its exact bytes, installed file set, native identity,
signature state, and verified removal outcome. It is release evidence used to detect package drift before candidate
admission or publication. This document is the normative human-readable contract.
[`windows-package-inventory-v1.schema.json`](../../../schemas/windows-package-inventory-v1.schema.json) is its
structural JSON Schema.

The inventory describes an observed installation of exact package bytes. It is not a software bill of materials,
proof of a trusted certificate chain, update metadata, a publication decision, or permission to publish. CycloneDX
evidence remains authoritative for software dependencies. Authenticode trust inspection remains authoritative for the
meaning of a `public-authenticode` signature claim.

## Encoding and compatibility

- File name: `<NSIS setup name>.inventory.json`; for release `0.1.0` this is
  `FitFreed_0.1.0_x64-setup.exe.inventory.json`.
- Media type: `application/json`.
- Encoding: UTF-8 with a final newline.
- Format identifier: `org.fitfreed.windows-package-inventory`.
- Schema selector: integer `schemaVersion`; version 1 is the only current value.
- Unknown top-level or nested properties are invalid.

A consumer must reject an unsupported schema version. Any incompatible target, identity, installation, signature, or
entry representation requires a new schema and normative document. Version 1 remains an immutable description of the
initial NSIS evidence boundary.

## Target and artifact

`target.platform` is `windows`, `target.architecture` is `x86_64`, `target.packageFormat` is `nsis`, and
`target.installMode` is `currentUser`. These closed values describe the first Windows package contract rather than
every possible Windows target.

`artifact.path` is the exact top-level setup filename derived from `identity.version`. `artifact.size` is its positive
byte length and `artifact.sha256` is the lowercase SHA-256 digest of the complete setup bytes. No artifact or installed
entry contains an absolute machine path.

## Product and installation identity

The `identity` object binds the application identifier `org.fitfreed.desktop`, visible product name `FitFreed`,
semantic version, public publisher value `FitFreed contributors`, canonical homepage `https://fitfreed.org/`, and the
ordered NSIS languages `English` and `Spanish`.

The `installation` object records only portable path tokens and closed package behavior:

| Field | Contract |
|---|---|
| `applicationDataDirectory` | `%APPDATA%\org.fitfreed.desktop`; application-owned user data remains separate from package files. |
| `installDirectory` | `%LOCALAPPDATA%\FitFreed`; the current-user package root. |
| `executable` | `fitfreed.exe`. |
| `uninstaller` | `uninstall.exe`. |
| `uninstallRegistry` | The exact `HKCU` Add or Remove Programs registration for `FitFreed`. |
| `startMenuShortcut` | The exact per-user Start Menu shortcut token. |
| `desktopShortcut` | The exact per-user desktop shortcut token. |
| `webviewInstallMode` | `offlineInstaller`. |
| `webview2Available` | Always `true`; native inspection found an installed WebView2 runtime after setup completed. |

The native installation adapter also validates display name, version, publisher, homepage, update and help links,
modification policy, executable metadata, shortcut targets, and uninstaller registration before it emits evidence.
Those duplicate native values are validation inputs rather than additional inventory fields.

## Signatures

`signatures.profile` distinguishes two closed evidence profiles:

- `unsigned-engineering` requires `setup`, `executable`, and `uninstaller` to have status `NotSigned`, a null
  `certificateSha256`, and `timestamped` set to `false`. Ordinary CI produces only this profile and it cannot become a
  public candidate.
- `public-authenticode` requires all three objects to have status `Valid`, the lowercase SHA-256 fingerprint of the
leaf code-signing certificate in `certificateSha256`, and `timestamped` set to `true`.

All three public signature objects must identify the same admitted certificate fingerprint.

A structurally valid public claim is not proof of trust by itself. The public profile may be emitted only after the
protected Windows trust inspector verifies each unchanged file through Windows Authenticode policy, validates its
trusted chain and RFC 3161 timestamp, matches the admitted certificate fingerprint and product identity, and preserves
the artifact and installed-file digests recorded here. Certificate subjects, account names, private keys, passwords,
certificate-store paths, tool paths, and timestamp-service credentials never enter this document.

## Installed file entries

`entries` is derived from the native adapter's complete `installedEntries` observation before removal. It contains
every regular file below the installation directory exactly once, sorted by UTF-8 path bytes. Every path is relative,
uses `/`, excludes empty, `.` and `..` components, excludes Windows-reserved filename characters, control characters,
backslashes, drive prefixes, and alternate-data-stream separators, and remains inside the package root.

Each entry contains `path`, a non-negative byte `size`, and the lowercase SHA-256 digest `sha256`. The set must contain
both `fitfreed.exe` and `uninstall.exe`. A duplicate, unsafe or unordered path, unsupported reparse point, missing
required binary, invalid length, or invalid digest rejects the inventory.

## Removal evidence

The `removal` object contains four required true outcomes:

- `packageFilesRemoved`: the complete installation directory disappeared;
- `registrationRemoved`: the Add or Remove Programs key disappeared;
- `shortcutsRemoved`: both package-created shortcuts disappeared;
- `applicationDataPreserved`: a pre-existing sentinel under the application-data directory survived uninstall
  unchanged.

This proves package ownership and the data-preservation boundary for the inspected setup. It does not claim that a
user has asked FitFreed to delete a library; uninstall and library deletion remain separate operations.

## Determinism, privacy, and failure behavior

Generation selects exactly one version-named setup, performs one native install-inspect-remove cycle, validates the
complete in-memory document, and atomically replaces the adjacent inventory only after success. A failed selection,
installation, validation, removal, or write preserves prior valid evidence and removes temporary state. Repeating the
operation against identical package and installed bytes produces identical inventory bytes.

The document contains no absolute path, host identifier, timestamp, user data, provider export, credential, private
email address, or signing secret. Command output reports only public product identity, artifact and inventory digests,
entry count, version, and the top-level inventory filename. The generated inventory remains engineering evidence until
release-manifest, checksum, SBOM, signing, provenance, exact-candidate, and publication gates explicitly admit the
same bytes.
