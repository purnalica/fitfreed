# Self-Contained Report HTML Version 2

## Output contract

Version 2 retains the deterministic, UTF-8, self-contained `text/html` security and atomic-write guarantees
of [version 1](report-html-v1.md). The `data-fitfreed-report-version` value is `2` for output rendered from a
version-2 definition. Version-1 definitions continue to render version-1 output.

After the report header, selected blocks render in exact definition order:

- `session-evidence` renders the established recorded summary and reviewed physiological context;
- `narrative` renders escaped plain text with user attribution; and
- `route` renders an accessible local SVG projection, recorded route kind, source point count, and endpoint
  redaction, or an explicit omitted/fully-redacted statement.

Limitations and provenance follow the ordered composition. Labels are resolved in the report locale.

## Route projection and privacy

The application supplies at most 500 authorized endpoint-redacted recorded points. The HTML adapter unwraps
longitude only to avoid a visual antimeridian discontinuity, calculates a bounded local view box, and emits
normalized two-dimensional `polyline` and endpoint coordinates. It emits no recorded latitude, longitude,
altitude, elapsed point value, map tile, geographic metadata, remote image, or external URL.

Omitting geometry during privacy review leaves the route block visible with an omission statement. When
redaction removes every recorded point, the block states that it is fully redacted. Neither state is
misrepresented as a missing source route.

## Independence and verification

Repeated output from identical authorized input is byte-identical. Independent-output tests parse the file,
verify semantic block order and declared privacy metadata, reject recorded coordinate strings and every
external or active-content boundary, and confirm that omission and complete redaction remain explicit.
