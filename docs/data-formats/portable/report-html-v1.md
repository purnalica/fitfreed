# Self-Contained Report HTML Version 1

## Output contract

Version 1 is a single UTF-8 HTML5 document with media type `text/html`. The same authorized resolved input
must produce identical bytes. Generation uses no current time, random identity, machine path, application
theme, browser preference, or network result.

The document contains, in order:

1. `<!doctype html>`, locale-bearing `html`, UTF-8 metadata, viewport metadata, escaped title, and embedded
   deterministic CSS;
2. one `main` landmark carrying `data-fitfreed-report-version` with report title and a visible metadata
   definition list;
3. a session-evidence section with local start and stop values, explicit UTC offset when available, duration,
   optional distance and energy, optional reviewed heart-rate context, sport state, and exercise count;
4. a user-interpretation section containing the narrative as escaped plain text with authored attribution;
5. a limitations section, including an explicit no-known-limitations statement when empty; and
6. a provenance section naming the supported source, source revision, adapter and mapping versions, and
   complete evidence-event counts.

The visible report metadata carries the definition version and revision, resolved source snapshot, locale,
and units policy. Recorded-evidence attribution distinguishes source facts resolved by FitFreed from the
user-authored interpretation.

Units policy is `metric-v1`: duration in semantic day/hour/minute/second components, distance in kilometres
with exact metres available in machine-readable metadata, energy in kilocalories, and heart rate in beats
per minute. Locale controls visible labels and decimal formatting but never changes stored evidence.

## Security, privacy, and independence

All authored and resolved strings are HTML-escaped. Narrative line breaks are represented semantically
without interpreting markup. The output contains no `script`, event-handler attribute, form, frame, remote
font, URL fetch, external stylesheet, external image, telemetry, hidden local path, provider-account identity,
or source-subject evidence. The recorded source attribution remains visible. Embedded styling supports light
and dark browser preferences, printing, keyboard selection, and 200% text zoom without hiding exact content.

Physiological fields appear only when the authorized export choice includes them. Version 1 contains no
route geometry. A future route block must define endpoint redaction and precise-location review before its
HTML version can include coordinates.

## Atomicity

The adapter writes a private sibling staging file, flushes it, checks cancellation, atomically replaces the
chosen destination, and synchronizes the parent directory where the operating system supports it. Failure
or cancellation removes the staging file. Replacing an existing destination happens only after the complete
new document is durable enough to promote; the old destination otherwise remains intact.

Independent-output tests parse the completed document without FitFreed, disable networking, verify the
semantic order and exact authorized values, reject active or external content, and compare repeated output
byte for byte.
