# ADR 0025: Normalize dense signal storage by series identity

- **Status:** Accepted
- **Date:** 2026-08-20
- **Decision owners:** FitFreed maintainers
- **Related requirements:** [NFR-023](../../requirements.md#nfr-023--measurable-quality-targets), [NFR-025](../../requirements.md#nfr-025--no-replacement-lock-in)
- **Related delivery plan:** [MVP experience delivery](../../plans/mvp-experience-delivery.md)
- **Related architecture:** [Storage](../storage.md), [SQLite version 24](../../data-formats/persistence/sqlite-v24.md)

## Context

The independent MVP experience audit found that existing performance gates did not represent supported
regular signals distributed through a long training history. The version-17 persistence shape repeated
`origin_id`, `session_id`, `exercise_id`, `role`, and series ordinal in every exact sample row. Its composite
primary key and an equivalent explicit ordering index stored the same long identity more than once.

An independently authored ten-year workload now imports 520 weekly one-hour sessions, four supported
one-second series per session, and 7,490,080 exact slots. A release-mode diagnostic through the production
importer showed that import time, memory, bounded overview, exact pagination, and exact reimport were within
their existing budgets, while the resulting library exceeded the new 512 MiB storage envelope by more than
five times. The failure was therefore a physical identity problem rather than an archive, application-query,
or presentation problem.

Three structural representations were evaluated:

1. retain the repeated natural identity in every sample and only remove equivalent indexes;
2. keep logical series identity on the series row and give exact samples a compact internal series identity;
3. encode each complete series as a compressed binary value and reconstruct pages or gaps outside SQLite.

The first representation retains the dominant repeated text cost. The third makes bounded exact pages,
gap queries, migration inspection, and independent recovery depend on a new binary codec. The second keeps
the existing relational and query contracts while removing repetition from the dense row set.

## Decision

SQLite schema version 24 separates logical and physical signal identity:

- `training_signal_series` retains the complete provider-neutral logical identity and constrains it with a
  unique key. An integer `series_id` is private storage identity and never crosses the infrastructure port.
- `training_signal_sample` stores only `series_id`, exact source ordinal, and nullable exact value. It is a
  `WITHOUT ROWID` table keyed by `(series_id, ordinal)`.
- The sample primary key serves stable selection and pagination. A partial `(series_id, ordinal)` index for
  null values preserves bounded gap detection. Equivalent full-row ordering indexes are not duplicated.
- Deleting a series cascades to its samples. Reconciliation still replaces one session's complete signal
  evidence atomically and never appends an alternative sample history.
- Migration copies every series and exact slot inside the schema transaction. A durable maintenance marker
  then requires `VACUUM` outside that transaction to reclaim pages left by the old dense tables. The marker
  is removed only after compaction succeeds, so interruption or insufficient space leaves an intact library
  and a retryable task.
- The canonical training-signal, mapping, application read-model, opaque capability, exact-value,
  reconciliation, and portable boundaries do not change.
- Complete verification adds the deterministic dense-history gate on maintained local Apple Silicon and
  hosted macOS environments. It enforces the existing import, exact-repeat, memory, and 500 ms query budgets
  plus a 512 MiB maximum database size for this exact workload.

## Consequences

- Dense storage scales with compact series identity rather than repeated provider-neutral text identities.
- Existing libraries migrate without changing logical evidence and reclaim obsolete pages before ordinary
  reads or writes resume.
- The internal numeric identity is intentionally replaceable and cannot be used as a domain, application,
  transport, report, navigation, or portable identifier.
- Migration may need temporary free space for the compact live copy. Failure is non-destructive and blocks
  normal use until the retryable maintenance task succeeds.
- Any future change to sample encoding must preserve exact ordinal/value access, explicit gaps,
  deterministic reconciliation, migration recovery, and the same public data contracts.

## Verification

Acceptance requires:

1. schema migration tests prove atomic rollback, lossless logical evidence, foreign-key integrity, and
   completion of the retryable compaction task;
2. import, amendment, mapping-enrichment, segmentation, bounded-overview, exact-page, and restart tests use
   the compact tables through production adapters;
3. the dense-history campaign runs three fresh processes and fails on incomplete counts or any exceeded
   import, exact-repeat, memory, database-size, session-discovery, overview, or exact-pagination budget; and
4. the same versioned command passes on maintained local Apple Silicon and hosted macOS before PX-03 can
   close.
