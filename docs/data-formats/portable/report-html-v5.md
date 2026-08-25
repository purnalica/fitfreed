# Self-Contained Report HTML Version 5

## Output contract

Version 5 retains deterministic UTF-8, self-contained `text/html`, semantic ordering, accessibility,
active-content prohibition, atomic replacement, cancellation, route privacy, exact evidence, and all four
version-4 report origins from [version 4](report-html-v4.md). The root `<main>` now carries
`data-fitfreed-output-version="5"`; `data-fitfreed-report-version` continues to identify the unchanged source
definition version.

Session sport identity follows
[training sport identity version 1](../insights/training-sport-identity-v1.md). Visible precedence is:

1. personal display label;
2. personal provider-neutral family localized to the report locale;
3. recognized localized provider name using exact locale, base language, `en`, then deterministic first-name
   fallback;
4. recognized provider-neutral family localized to the report locale;
5. localized ambiguous or unknown wording; and
6. localized unavailable wording when the source recorded no sport.

The redundant embedded SVG uses the personal or recognized family when available and distinct custom,
unknown, and unavailable symbols otherwise. Output never contains raw provider identifiers, provider name
keys, catalogue hierarchy, evidence references, opaque sport capabilities, ambiguous candidate names, remote
resources, scripts, event handlers, or unreviewed location.

Repeated export from identical authorized input remains byte-identical. Recognition and personal meaning are
part of the reviewed snapshot, so importing or activating a catalogue cannot silently change an already
accepted export. Changing output-version identification, sport precedence, privacy, active-content, or
determinism requires a new HTML contract version.
