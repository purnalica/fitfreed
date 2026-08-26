# Self-Contained Report HTML Version 6

## Output contract

Version 6 retains the deterministic UTF-8, self-contained `text/html`, semantic ordering, accessibility,
active-content prohibition, atomic replacement, cancellation, route privacy, exact evidence, sport identity,
and all four report origins from [version 5](report-html-v5.md). The root `<main>` carries
`data-fitfreed-output-version="6"`; `data-fitfreed-report-version` continues to identify the unchanged source
definition version.

A `training-chart` block now contains one fixed-size inline `static SVG` comparison plot for each authorized
source series. The plot provides a visible title, baseline and comparison categories, a labelled numeric axis,
localized decimal punctuation, and distinct fixed colors. Duration is plotted in hours and distance in
kilometres; counts and energy retain their documented display units. An unavailable value remains a labelled
gap and is never plotted as zero.

Every SVG has an accessible name and description. The adjacent semantic exact-value table remains the value
authority and is derived from the same comparison projection. Its canonical `<data>` values and units remain
`milliseconds`, `metres`, and `kilocalories` where applicable, so the visual scaling causes no precision loss.

## Independence, safety, and bounds

Static SVG is rendered entirely inside the native report adapter after application authorization. It contains
no script, event handler, animation, external reference, embedded resource, remote font, runtime dependency,
or opaque source identity. The adapter validates that boundary before the SVG enters the document and limits
each generated chart to `96 KiB`. A rendering, validation, cancellation, or output failure aborts the complete
staged export and preserves any existing destination.

Repeated export from identical authorized input remains byte-identical. Changing output-version
identification, visual units, missing-value semantics, exact-table authority, accessibility, active-content,
external-resource, privacy, or determinism rules requires a new HTML contract version.
