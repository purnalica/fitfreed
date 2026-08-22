# Training-Session Range Summary Read Model Version 1

## Purpose

This read model answers one deliberately named selection inside one training exercise without pretending that
independent source clocks are interchangeable. `query_training_session_range_summary` accepts the exact
`sessionRef`, required `snapshotRef`, `rangeRef`, and `expectedRangeRevision` defined by
`training-session-range-summary-query-v1.schema.json`. It returns
`training-session-range-summary-v1.schema.json` only when the discovery snapshot and authored range revision
still match.

This is an application read model, not another stored aggregate. The domain owns the user-authored range;
provider adapters expose raw evidence through application ports; the application validates and streams that
evidence, computes the answer, and returns provider-neutral capabilities. SQLite does not join unrelated
timelines or calculate presentation metrics.

## Identity and revision boundary

The result repeats `snapshotRef`, `sessionRef`, `evidenceRevision`, the complete canonical `range`, and its
public `sourceProvider`. A current range has one matching `exercise` and one exact `coordinateEvidence` object.
A review-required range may retain a matching exercise while its exact route or signal coordinate is no longer
available; the authored coordinate remains in `range`, its prior revision remains untouched, and
`coordinateEvidence` has scope `unavailable`. If that owned exercise itself disappeared, `range.exerciseRef`
still preserves the authored owner while the projected `exercise` is null. A preserved review-required legacy
range also has no provable exercise or current coordinate. FitFreed never guesses an exercise or redirects a
range to different evidence.
The remaining top-level members are `elapsedDurationMilliseconds`, `movingDurationMilliseconds`,
`pausedDurationMilliseconds`, `distance`, `direction`, `measurements`, `boundaries`, `coverage`, `sourceRanges`,
`independentEvidence`, and `limitations`.

The failure classes are stable desktop boundary codes:

- `invalid-training-session-range-summary` means the request or returned evidence violates the contract;
- `training-session-range-not-found` means the opaque range or its owning session does not exist;
- `training-session-range-summary-changed` means the snapshot or optimistic range revision no longer matches;
- `training-session-range-summary-failed` means the local query could not complete.

No provider record identifier, source filename, database key, `originId`, or `seriesId` crosses this boundary.

## Coordinate authority

The selected `coordinateEvidence` determines what may be summarized:

- `exercise-elapsed` uses the exercise endpoints and source-authored manual or automatic lap endpoints. It may
  report overlapping `sourceRanges`, but it does not align route or signal evidence merely because their
  elapsed values look similar.
- `route-elapsed` streams one exact route in source-ordinal order. Geometry between the selected exact route
  boundaries supplies distance, initial `direction`, and recorded altitude `measurements`. Points without an
  elapsed value remain part of the recorded geometry between those boundaries and are counted explicitly as
  missing elapsed evidence. No waypoint or boundary is interpolated.
- `signal-elapsed` streams one exact regular series. Metric aggregation uses the half-open interval
  `[start, end)`; the sample at `end` remains boundary evidence and may complete an exact distance-series delta.
  Missing slots create bounded `missingIntervals`; omitted intervals remain counted.
- `unavailable` produces no metric claim and is reserved for review-required evidence lacking a proven current
  coordinate.

The application reports other source laps, routes, and signals only in `independentEvidence` and the relevant
`limitations`. It never correlates separate route, signal, lap, or local civil-time coordinates without an
explicit recorded relationship.

## Measurements, boundaries, and coverage

`elapsedDurationMilliseconds` is the exact range end minus start. `movingDurationMilliseconds` and
`pausedDurationMilliseconds` remain null until recorded evidence can prove those values in the selected
coordinate. Absence is not estimated from speed, gaps, or timestamps.

`distance` carries meters and either complete or partial metric coverage. Route distance is the Haversine sum
over selected recorded geometry. Exercise distance is available only when the selection is the complete
exercise with a recorded exercise distance or when one exact source range supplies it; an ambiguous or merely
overlapping lap does not become a derived distance. Signal distance is available only from exact nondecreasing
start and end values of a distance series. `direction` is the initial bearing between distinct selected route
endpoints. Each item in `measurements` preserves kind, unit, minimum, maximum, mean, available and missing
evidence counts, and exact boundary values when present.

`boundaries.start` and `boundaries.end` each distinguish `exact`, `between-evidence`,
`outside-recorded-evidence`, and `no-evidence`. Exact matches retain their public evidence capability and source
ordinal. At most 25 matches are returned while `exactMatchCount` retains the complete count. `preceding` and
`following` identify the nearest recorded evidence without inventing a value at the boundary.

`coverage` distinguishes complete, partial, empty, and unavailable answers and reports recorded, selected,
available, missing-value, and missing-elapsed counts. At most 1,000 missing intervals are returned;
`omittedMissingIntervalCount` records the remainder. `limitations` are machine-readable reasons for unavailable
or intentionally unaligned claims. Presentation should disclose them in context and on demand, not repeat a
generic warning across unrelated screens.

Coverage counts retain one unit within each selected coordinate: exercise coverage counts recorded exercise
and source-lap boundary observations, route coverage counts recorded waypoints, and signal coverage counts
regular sample slots. Overlapping source ranges remain separately counted in `sourceRanges` and
`independentEvidence`; they are not mixed into the exercise boundary-observation counts.

## Numeric and compatibility rules

Elapsed millisecond values are non-negative decimal strings so signed 64-bit values remain exact through the
JavaScript boundary. Revisions, ordinals, and counts are non-negative JSON integers, with range revisions
starting at one. Measurements are finite JSON numbers. Provider-neutral opaque capabilities use their
documented digest prefixes.

Version 1 is additive beside the immutable training-session range version 3 contract. A future model that can
prove a shared timeline, moving time, or another metric must publish a new version or make a strictly additive
change that preserves every meaning above. It must never reinterpret an unavailable alignment as exact.
