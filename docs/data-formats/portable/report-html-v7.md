# Self-Contained Report HTML Version 7

## Output contract

Version 7 retains the deterministic UTF-8, self-contained `text/html`, semantic ordering, accessibility, static SVG,
active-content prohibition, external-request prohibition, atomic replacement, cancellation, route privacy, exact
recorded evidence, and locale behavior from [version 6](report-html-v6.md). The root `<main>` carries
`data-fitfreed-output-version="7"`; `data-fitfreed-report-version` independently identifies the source definition
version.

For a version-5 planned-training report, one semantic section renders the authorized target in report-block order. It
identifies the content as planned intent imported from the selected local planned-library revision and presents, when
available:

- target name, description, scheduled time, completion metadata, editability, mapping coverage, plan-shape counts,
  and session-relationship state;
- ordered exercises with kind, duration or distance goal, and provider-neutral sport identity;
- ordered phases with name, duration or distance goal, intensity absence or metric-and-zone bounds, and manual,
  automatic, or unmapped transition meaning; and
- repeat meaning as the one-based return phase and total iteration count without flattening the source graph.

Absent structure remains explicitly unavailable. Unmapped goals, intensity, transitions, and sport evidence remain
labelled unmapped rather than guessed. A related recorded-session capability is not exported as completion evidence,
and provider identifiers do not enter visible or hidden markup. User narrative remains a separate attributed section.

## Exact values and accessibility

Durations and distances use semantic `<data>` elements whose canonical values remain whole `milliseconds` and
`metres`. Visible formatting is localized and appropriately rounded without losing the exact machine-readable value.
Plan shape is represented through headings, description lists, articles, and phase lists in logical order; no giant
raw source table becomes the primary reading experience. Sport symbols come from the embedded provider-neutral SVG
sprite and have a visible trustworthy label.

Every heading and collection has a meaningful reading order without relying on color, pointer interaction, or
JavaScript. English (`en-US`) and Spanish (`es-ES`) output carry complete localized labels. Source revision,
definition version, report revision, locale, metric-unit contract, limitations, and planned-library provenance remain
visible.

## Independence, safety, and determinism

The renderer validates that one planned-training block, definition origin, resolved target, source snapshot, and
`planned-training-snapshot` provenance agree before producing bytes. Planned output contains no recorded session,
route, training comparison, physiological sensitivity, active content, external resource, remote font, telemetry, or
network request.

Rendering occurs only after application authorization and writes through a private staged file followed by atomic
replacement. Validation, cancellation, rendering, or output failure removes staging and preserves any complete
existing destination. Repeated export from identical authorized input remains byte-identical.

Exact normalized `planned-training export version 1` remains the data-exit authority. HTML version 7 is a useful user-authored
presentation, not a canonical archive or library backup. Changing output identification, structure meaning,
cross-field authorization, value units, accessibility, privacy, active-content, external-resource, or determinism
rules requires a new HTML contract version.
