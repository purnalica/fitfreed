# Library Home Read Model Version 7

Version 7 retains every range, domain coverage, question, highlight, post-import, resumable exploration, bounding,
ordering, and privacy rule from [version 6](library-home-v6.md). It adopts
[training sport identity version 3](training-sport-identity-v3.md) and exact collections from
[training sports version 4](training-sports-v4.md).

`query_library_home` returns
[`library-home-v7.schema.json`](../../../schemas/library-home-v7.schema.json) with `version` 7. A Home sport summary
never combines an exact recognized collection with the source-profile remainder merely because the person classified
that remainder. Its `sessionFilterRefs`, count, state, and navigation therefore remain stable after classification.

Changing sport aggregation, identity meaning, retained Home behavior, or privacy requires a new response version.
