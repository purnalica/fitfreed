# Self-Contained Report HTML Version 8

Version 8 retains the deterministic, local, self-contained, accessible, privacy-reviewed output behavior from
[version 7](report-html-v7.md). It adopts [report workflow version 9](../insights/report-v9.md) and
[training sport identity version 3](../insights/training-sport-identity-v3.md).

The output MIME type remains `text/html`.

The root `<main>` carries `data-fitfreed-output-version="8"`; the authored definition version remains independently
recorded in `data-fitfreed-report-version`. A rendered exact sport identity is never replaced by a fallback
source-profile classification. The internal classification scope is not promotional copy and does not expose source
identifiers in HTML.

Changing deterministic structure, sport identity meaning, privacy review, numeric evidence, or output metadata
requires a new output version.
