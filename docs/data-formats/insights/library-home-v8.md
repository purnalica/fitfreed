# Library Home Read Model Version 8

Version 8 retains every range, domain coverage, question, highlight, post-import, resumable exploration, bounding,
ordering, and privacy rule from [version 7](library-home-v7.md). It adopts the explicit projected relationships from
[training sports version 5](training-sports-v5.md).

`query_library_home` returns
[`library-home-v8.schema.json`](../../../schemas/library-home-v8.schema.json) with `version` 8.

## Sport relationship projection

Within `training`, `sportCollectionCount` remains the number of exact represented collections before any user-authored
relationship is projected. `representedCollectionCount` likewise counts those underlying collections rather than
visible cards. Their complete coverage therefore remains auditable after projection.

An active unified relationship contributes one visible sport summary. Its chosen primary member supplies the visible
identity, its counts and date span cover every member, and `sessionFilterRefs` contains every exact represented-session
filter in the relationship. Opening the summary consequently selects the complete combined history without sending
the synthetic relationship reference to session discovery. A summary aggregated further by identical visible meaning
retains every member filter and adds the underlying represented-collection counts.

A review-required relationship is not projected. Its surviving collections remain separate, so Home never presents a
partially applied relationship as though it were complete. Removing a relationship restores the separate summaries
without changing imported evidence or personal classifications.

Changing sport aggregation, relationship projection, identity meaning, retained Home behavior, or privacy requires a
new response version.
