# Training-Session Signal Read Models Version 1

## Purpose and commands

These provider-neutral read models make recorded temporal measurements explorable without loading complete
series into the session workspace.

- `query_training_session_signals` accepts
  [`training-session-signals-query-v1.schema.json`](../../../schemas/training-session-signals-query-v1.schema.json)
  and returns
  [`training-session-signals-v1.schema.json`](../../../schemas/training-session-signals-v1.schema.json).
- `query_training_signal_samples` accepts
  [`training-signal-samples-query-v1.schema.json`](../../../schemas/training-signal-samples-query-v1.schema.json)
  and returns
  [`training-signal-samples-v1.schema.json`](../../../schemas/training-signal-samples-v1.schema.json).

The commands consume only opaque `sessionRef`, `signalRef`, and optional `snapshotRef` capabilities. Source
identifiers, artifact locators, hashes, provider tokens, device identifiers, and account evidence never cross
the presentation boundary.

The overview response contains `snapshotRef`, `sessionRef`, and `signals`. Null `signals`, null or empty
`exercises`, and each exercise's null or empty nested collections preserve the canonical assessment states.

## Bounded overview

`maxVisualSamples` is from 2 through 500. Each series returns exact `sampleCount`,
`availableSampleCount`, positive decimal-text `intervalMilliseconds`, `kind`, `unit`, role, ordinal, and at
most the requested number of `visualSamples`. Projection `source-ordinal-v1` selects ordinal
`floor(i * (sampleCount - 1) / (selectedCount - 1))`, retaining both endpoints when at least two samples
exist. Zero- and one-sample series remain exact.

Every visual sample contains its original `ordinal`, derived exact decimal-text `elapsedMilliseconds`,
finite numeric or null `value`, and boolean `gapBefore`. Null means the selected source slot was explicitly
unavailable. For every selected sample after the first, `gapBefore` is true exactly when at least one source
slot in `(previous selected ordinal, current selected ordinal]` is unavailable. The first sample always has
`gapBefore: false`. Consequently, a bounded trace cannot bridge a source gap that projection omitted. The
projection never replaces the exact series and never invents values between selected slots.

Assessment states, independent `primary` and `transition` collections,
`unsupportedPrimarySeriesCount`, `unsupportedTransitionSeriesCount`, `role`, `kind`, `unit`, exercise
order, and duplicate-kind series follow the canonical
[training-session signal contract](../canonical/training-session-signal.md).
Each exercise exposes only its opaque `exerciseRef`, its structural `ordinal`, and its signal assessment;
provider exercise identifiers remain private.

## Exact pages

`query_training_signal_samples` accepts a zero-based `offset` and a `limit` from 1 through 250. It returns
the exact series identity and metadata, total `sampleCount`, requested offset, contiguous source slots, and
`samples` with `nextOffset`. `nextOffset` is null exactly when the page reaches the end. An offset beyond the
end returns an empty page and null continuation without changing identity.

Every item ordinal equals `offset + page index`; elapsed time is checked multiplication of ordinal and the
series interval. A page never skips unavailable slots.

## Snapshot and failure semantics

When `snapshotRef` is supplied, it must still identify the current coherent training-discovery snapshot.
Every response returns that exact snapshot. A library revision, stale capability, unknown series, invalid
bound, malformed transport value, inconsistent projection, impossible count, invalid kind/unit pair,
non-finite value, or discontinuous exact page fails the complete query. Presentation retains the previously
valid workspace and offers retry; it never combines signal evidence from different revisions.

Malformed query input fails as `invalid-training-session-detail`, a stale snapshot fails as
`training-session-detail-changed`, and an unavailable or inconsistent local read fails as
`training-session-detail-failed`.

## Presentation obligations

The workspace names role, signal kind, unit, exact coverage, interval, and unsupported-series limitations.
Each chart has an accessible exact table path and starts a new trace after every null sample or
`gapBefore: true` marker. Local rendering makes no network request and provides no diagnosis, training
advice, or claim that one signal caused another.

When at least one series in the same role contains visible recorded values, presentation may offer a
progressive cross-signal view from this existing bounded response. A person selects one through four series.
The view uses separate numeric scales with horizontal lane identities and a shared elapsed-time axis fixed by
all eligible series in that role. Presentation may rank the existing series by canonical sport family and signal
kind and may omit a source ordinal from an ordinary unique-kind label, but it does not change or discard source
ordinals or make the presentation order canonical evidence. Repeated kinds remain qualified by source ordinal. It never combines
primary and transition evidence, joins values into synthetic rows,
interpolates missing timestamps, bridges gaps, or treats normalized chart height as a comparable unit. Every
selected lane links to the existing exact paginated table for that source series. Presentation may omit individual
point markers from a dense bounded projection to prevent visual noise; it may not remove points from this response,
change the line's source-gap boundaries, or weaken the exact path. This view is visual
co-occurrence evidence only and does not assert correlation or causation.
