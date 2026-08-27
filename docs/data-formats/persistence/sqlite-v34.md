# SQLite Persistence Schema Version 34

## Status and migration

Schema version 34 applies `0034_import_package_identity.sql` atomically after version 33. It adds an independent
package-identity classification to each import operation without changing canonical fitness data, coverage,
reconciliation, or the terminal reason. Versions 1 through 34 remain direct supported baselines.

The migration adds one nullable, constrained column. An interruption rolls back both the column addition and schema
marker, leaving the complete version-33 library available for retry.

## `import_operation.package_identity`

| SQLite type | Null | Allowed value | Contract |
|---|---|---|---|
| TEXT | yes | `expected-provider-export` | the central-directory inventory matches the current selected provider grammar |
| TEXT | yes | `unsupported-provider-export` | provider-shaped inventory evidence exists outside the current adapter grammar |
| TEXT | yes | `unrecognized` | the inventory contains no recognized evidence for the selected provider |
| TEXT | yes | null | historical outcome or failure before identity could be established |

The value is provider-neutral operation evidence. It is established before the complete archive-protection scan and
therefore survives a later typed safety or resource-limit rejection. It does not authorize extraction, replace the
terminal code, weaken any protection, or imply that unrecognized input is dangerous. No path, member name, personal
value, provider account evidence, or source fingerprint is stored in the column.

An exact-repeat operation copies the source operation's validated identity together with its terminal-independent
classification evidence. Unknown stored tokens fail closed when an outcome is reconstructed.

## Verification

Migration evidence covers a populated version-33 library, injected interruption, successful retry, historical null,
all three accepted tokens, rejection of an unknown token, SQLite integrity, and migration from every declared
baseline. Import evidence covers expected-provider and unrelated inventories that both exceed the same per-member
expanded-size limit, proving that the identity remains distinct while the terminal protection remains identical.
