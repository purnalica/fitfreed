# Training-Session Range Draft Summary Read Model Version 1

`query_training_session_range_draft_summary` calculates an exact answer for a bounded personal selection before the
person names or saves it. The operation accepts
[`training-session-range-draft-summary-query-v1.schema.json`](../../../schemas/training-session-range-draft-summary-query-v1.schema.json)
and returns
[`training-session-range-draft-summary-v1.schema.json`](../../../schemas/training-session-range-draft-summary-v1.schema.json).

The request identifies one current exercise coordinate and two strictly increasing non-negative elapsed boundaries.
It intentionally contains no `rangeRef`, title, authorship, state, or revision. Reading a draft never creates,
adjusts, or removes a personal range.

The response reuses the exact coordinate-evidence, geometry, coverage, boundary, source-overlap, limitation, and
provider rules of [training-session range summary version 3](training-session-range-summary-v3.md). It echoes the
current coordinate and boundaries instead of inventing a stored aggregate identity. Snapshot and evidence changes
fail closed; a caller must request a fresh draft against current evidence.

All elapsed values cross the command boundary as canonical decimal strings. Route distance is calculated from the
complete ordered recorded-point stream in the application layer. A bounded visual projection must never calculate or
substitute that result; in particular, the `visualPoints` projection is not calculation evidence. Independent source
ranges and signal coordinates remain limitations, not implicitly aligned measurements.
