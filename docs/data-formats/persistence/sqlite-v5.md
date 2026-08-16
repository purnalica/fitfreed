# SQLite Persistence Schema Version 5

## Status and boundary

Current local-library schema. Version 5 extends the immutable [version 4 schema](sqlite-v4.md) with the date-first canonical daily-activity query index required by the Insights overview. It changes no canonical field, stored value, identity, provenance, source-subject state, import behavior, or portable contract.

SQLite `PRAGMA user_version` stores value 5 after migration. New libraries apply all migrations through [`0005_activity_query_index.sql`](../../../src-tauri/migrations/0005_activity_query_index.sql) in one transaction. Existing versions apply only the ordered assets they lack. Any migration error or injected interruption rolls back the index and version marker together.

## `daily_activity_local_date_origin` index

The index orders `daily_activity` by (`local_date`, `origin_id`). It supports whole-library bounds and inclusive local-date range queries without changing the version 1 canonical ordering rule of local date followed by origin.

The existing `daily_activity` primary key remains (`origin_id`, `local_date`) and continues to enforce logical identity. The new index is a replaceable persistence optimization, not a second identity or a user-visible representation.

## Migration behavior

- Versions 1 through 4 retain every table, row, value, constraint, foreign key, and existing index before the new index is created.
- An interrupted version 4 upgrade retains `PRAGMA user_version = 4`, preserves daily history, and exposes no partial `daily_activity_local_date_origin` index.
- Recovery reapplies the immutable migration and advances directly to version 5.
- Version 5 open and backup paths verify the same schema marker and SQLite integrity boundary as earlier versions.

## Query responsibility

The SQLite adapter returns canonical activity bounds, the ordered distinct origin catalog, and range facts through the provider-neutral application port. Keeping origins independent of range facts lets Insights represent a selected period with no observations as missing dates for every known origin. SQLite does not validate user-selected ranges or calculate gaps, totals, averages, detail labels, or visual scales. Those rules belong to the versioned [daily activity overview read model](../insights/daily-activity-overview-v2.md).

## Verification evidence

Migration integration tests protect clean creation, interrupted version 4 upgrade, recovery, index existence, and retained history. Query integration tests protect empty and populated bounds, inclusive filtering, canonical order, and use of `daily_activity_local_date_origin` in the SQLite query plan. The data-contract gate requires contiguous immutable migrations and this versioned specification.
