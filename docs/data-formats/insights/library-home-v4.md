# Library Home Read Model Version 4

## Status and boundary

Normative provider-neutral contract for the temporal meaning presented by Library Home. Version 4
retains the complete identity, question, training, highlight, post-import, ordering, revision, and
navigation rules from [version 3](library-home-v3.md). It replaces the ambiguous `availableRange`
with explicit recorded, usable, and primary ranges.

The Tauri `query_library_home` command continues to accept
[`library-home-query-v1.schema.json`](../../../schemas/library-home-query-v1.schema.json) and now
returns [`library-home-v4.schema.json`](../../../schemas/library-home-v4.schema.json). Versions 1,
2, and 3 remain immutable historical contracts. Version 4 remains a disposable projection rather
than canonical history or persistence.

## Three distinct temporal meanings

`recordedRange` spans every retained canonical observation in every domain. It reports source
evidence honestly even when the current product cannot yet answer a useful question from that
observation. It must not be presented beside a narrower domain count without its recorded-evidence
meaning.

`usableRange` spans observations that contain the current domain's core supported measurement:

- every canonical training session contributes training duration;
- daily activity contributes only when `stepCount` is present, including zero;
- every canonical sleep period contributes sleep duration; and
- every canonical recovery night contributes beat-to-beat and breathing interval evidence.

Missing values do not become zero and do not extend `usableRange`. A valid response can therefore
have a non-null `recordedRange` and null `usableRange`.

`primaryRange` gives one explicitly scoped range for the leading Home summary. Its domain scopes
are `training`, `activity`, `sleep`, and `recovery`. When training is usable, its scope is
`training` and its range is the complete training range. Without training, one usable domain
produces its own scope. Two or more usable non-training domains produce `combined`
and use the global `usableRange`. Null `usableRange` requires null `primaryRange`.

## Domain coverage

Every domain replaces `availableRange` with `recordedRange` and `usableRange`. `recordedRange`
contains all canonical observations for that domain. `usableRange` applies the core-measurement rule
above. `selectedRange` is null when `usableRange` is null and otherwise describes the usable range
queried for this Home projection.

An empty domain has null ranges, zero origins and observations, and no measurement entries. A
recorded domain has at least one origin and observation and retains its complete domain-specific
measurement coverage even when every `availableRecords` value is zero.

## Presentation and navigation obligations

The leading date range must carry a visible localized label derived from `primaryRange.scope`, such
as “Training history”; placement alone must never imply its meaning. Library exploration is
available only when `usableRange` is non-null.

Null `recordedRange` is the pristine first-run state. Non-null `recordedRange` with null
`usableRange` is a distinct source-review state: presentation explains that records were retained,
links to exact import coverage, and must not invite the user as though no archive had been imported.
Questions and resumable exploration remain absent because no current question is answerable.

The non-training `library-history` highlight uses the latest usable date rather than a
recorded-only boundary. Exact source coverage remains available from Sources.

## Compatibility

Changing the definitions, precedence, scope labels, null relationships, usable-measurement rules,
or any retained version-3 behavior requires a new Library Home contract version. Application,
SQLite integration, transport, schema, presentation, localization, packaged E2E, and
dense-history tests protect this contract.
