# Library Home Read Model Version 6

## Status and boundary

Normative provider-neutral Home contract. Version 6 retains temporal ranges, domain coverage, questions,
highlights, post-import reveal, resumable exploration, summary bounds, and ordering from
[version 5](library-home-v5.md). `query_library_home` continues to accept its version-1 query and returns
[`library-home-v6.schema.json`](../../../schemas/library-home-v6.schema.json) with `version` 6.

Every bounded `training.sports` summary adds non-empty unique `sessionFilterRefs`. The values are exact
represented-session collection capabilities and open the complete corresponding History result. A summary
can contain several values when Home combines collections by effective recognized or personal meaning.
`sportRef` remains the independent nullable classification capability and may also be null for recognized or
ambiguous exact evidence without a source profile.

`sportCollectionCount` counts every exact represented collection before Home's bounded semantic
grouping, and `omittedSportCollectionCount` counts collections outside that bound. Each summary reports its
`representedCollectionCount`; these are collection counts rather than claims about provider profiles.

Recent sessions adopt [training sport identity version 2](training-sport-identity-v2.md). Home still omits
diagnostic recognition provenance and raw provider identity. Collection capabilities and classification
capabilities remain opaque and are never rendered as labels.

Changing temporal meaning, summary reduction, collection counts, `sessionFilterRefs`, classification capability meaning,
recognition projection, or navigation behavior requires a new Home version.
