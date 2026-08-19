# Self-Contained Report HTML Version 4

## Output contract

Version 4 retains the deterministic UTF-8, self-contained `text/html`, semantic ordering, accessibility,
active-content prohibition, privacy review, atomic replacement, and cancellation guarantees of
[version 3](report-html-v3.md). `data-fitfreed-report-version` equals the source definition version.

The same renderer accepts all four version-4 origins:

- session reports may include reviewed session, physiology, route, analytical, and narrative sections;
- question and exploration reports include selected analytical and narrative sections without inventing a
  session;
- evidence-bearing blank reports include analytical and narrative sections; and
- narrative-only blank reports include authored content without inventing imported evidence.

## Provenance boundary

Session output names the current contributing provider and mapping version. Analytical non-session output
states that calculations use the identified revision of the locally imported training library. Authored-only
output explicitly states that it contains no imported evidence. Provider, session, and source-adapter fields
are absent when that evidence relationship does not exist.

These two non-session provenance variants are `library-snapshot` and `authored-only`.

All user-authored title and narrative values are HTML-escaped. Analytical blocks retain exact `<data>`
values and accessible tables. Output contains no script, event handler, external URL, remote font, source
filename, provider account, opaque series identity, copied database result, or unreviewed route coordinate.
Repeated output from identical authorized input is byte-identical.
