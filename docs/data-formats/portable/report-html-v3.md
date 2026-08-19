# Self-Contained Report HTML Version 3

## Output contract

Version 3 retains the deterministic UTF-8, self-contained `text/html`, active-content prohibition, semantic
ordering, accessibility, privacy review, and atomic-write guarantees of [version 2](report-html-v2.md).
`data-fitfreed-report-version` equals the definition version. Older definitions retain their own declared
version.

Version-3 analytical blocks render from one authorized comparison result:

- `training-finding` emits exact baseline, comparison, and signed change text for its selected metric;
- `training-comparison` emits exact core-volume values in a semantic table;
- `training-chart` emits `CSS-only` proportional bars and a visible exact table alternative;
- `training-exact-table` emits every supported exact comparison metric; and
- `training-coverage` emits calendar, training-day, and measurement-availability counts.

Each block states both inclusive ranges, identifies the values as FitFreed calculations from the current
local library, keeps imported source series separate, and includes a descriptive-only limitation. Missing
distance or energy is explicit; it is never serialized as zero. Exact integral values use `<data>` elements
whose `value` is canonical decimal text.

## Security and independence

Analytical output contains no script, event handler, external URL, remote font, hidden source identity,
copied database result, or exact training sample. CSS bar widths are a presentation derived from the
authorized totals; the adjacent table is the exact accessible value authority.

Repeated output from identical authorized input is byte-identical. Independent-output tests verify block
order, both locales, exact values and units, missing-data language, range labels, absence of opaque series
references, and every established active-content and external-resource prohibition.
