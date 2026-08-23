# Self-Contained Report HTML Version 4

## Output contract

Version 4 retains the deterministic UTF-8, self-contained `text/html`, semantic ordering, accessibility,
active-content prohibition, privacy review, atomic replacement, and cancellation guarantees of
[version 3](report-html-v3.md). `data-fitfreed-report-version` equals the source definition version.

The same renderer accepts all four version-4 origins:

- session reports may include reviewed session, physiology, route, analytical, and optional commentary sections;
- question and exploration reports include selected analytical and optional commentary sections without
  inventing a session;
- evidence-bearing blank reports include analytical and optional commentary sections; and
- narrative-only blank reports include authored content without inventing imported evidence.

The report title is always present. A version-4 definition with no narrative emits no authored-commentary
section and makes no claim that the user supplied an interpretation. The export review therefore names the
title independently and lists commentary only when that block is included.

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

Session evidence renders sport identity as a redundant inline SVG symbol plus visible text. The embedded
symbols come from the same versioned provider-neutral sprite as the application and make no external request.
A personal label takes precedence; otherwise a classified family uses the report locale's family name.
Personal-label-only classifications, unclassified sport evidence, and unavailable sport evidence each retain
a distinct non-empty symbol. Technical family codes are not visible output.
