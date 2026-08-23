# Name and Revisit Part of a Session

## Status

This guide describes the personal-range library and editor implemented in the current FitFreed source. No
supported public binary is available yet. Use only independently generated synthetic data until the
version-matched release guidance explicitly opens a real-export boundary.

Personal ranges are an Alpha experience. Their ownership, persistence, exact-coordinate, reimport, and summary
contracts are implemented; direct boundary handles on the route map, signal lanes, source structure, and exact
evidence remain active MVP work.

## Open personal ranges

Open **History → Training → Sessions**, choose a session, and open **Personal ranges** in session detail. This
destination remains available whether the source provided a route, measurements, or laps because the range is
authored by the person rather than supplied by a provider.

The initial view lists saved ranges. Opening one leads with its name, exact timeline, elapsed duration, recorded
distance or measurement where supported, and evidence coverage. **Evidence and limits** then reveals boundary
quality, complete measurement detail, overlapping source laps on the same exact timeline, and every calculation
that remains unavailable. Selecting a saved range moves keyboard focus to that result and, in the stacked compact
or high-zoom layout, scrolls it into view below the range list. Opaque storage, provider, session, exercise, route,
signal, and range identifiers never become labels.

## Create a range

Choose **Create a range**, then select an exercise and one of its available exact timelines:

- **Exercise timeline** uses declared exercise elapsed time and can relate exact source-lap boundaries.
- A **route timeline** uses only recorded route-point elapsed positions and geometry.
- A named **measurement timeline** uses only that regular recorded series.

Enter a name of 1 to 80 characters and ordered elapsed boundaries as `h:mm:ss` or `h:mm:ss.mmm`. A comma is also
accepted as the fractional separator. The end must be after the start and no later than the recorded extent shown
for that timeline. Exact milliseconds remain exact internally even when they exceed JavaScript's safe integer
range. A zero-length timeline is not offered for creation.

Save creates one user-authored object without modifying the imported session, its laps, route, or measurements.
Overlapping ranges and duplicate names are valid because the range identity is independent from its title or
position. Cancel creates nothing.

## Rename, adjust, and remove

**Rename** changes only the authored title. **Adjust boundaries** keeps an established range on its original
exercise and exact timeline; it cannot silently redirect equal elapsed numbers to a route or measurement with a
different clock. **Remove** opens a local confirmation before removing only the personal range. The imported
session remains unchanged.

Every edit uses the latest optimistic revision. If another edit wins first, FitFreed reloads that revision and
keeps the unsaved draft for deliberate review. A local failure also keeps the draft and states that imported
history is unchanged.

## Reimport review

Compatible enrichment can retain a current range without moving either boundary. If reimport removes or changes
the owning evidence, FitFreed preserves the authored range as **Review required** instead of clamping, discarding,
or redirecting it.

A preserved legacy session range can be deliberately anchored to one current exercise and exact timeline by
reviewing both boundaries. A range that already named an exercise and timeline keeps that ownership immutable. If
that same timeline is absent, the range remains readable as unavailable evidence and can still be renamed or
removed, but it cannot be reopened by selecting unrelated evidence.

## Different objects remain different

- A personal range names one contiguous part of one session.
- A source or automatic lap remains attributed provider evidence.
- A reusable segmentation criterion is a rule that can derive multiple sections and be applied to compatible
  exercises.
- A report is a durable analytical document and an export boundary, not a range or a saved screen.

Equal numeric boundaries do not merge these objects or their authorship.

## Privacy and current limits

Range queries, edits, summaries, and persistence stay inside the local application and library. They make no map,
geocoding, account, provider-API, or other external request. Update checks are a separate application capability
and never receive imported facts.

The current editor is a dedicated session-detail task. The accepted next increment connects the same draft and
saved selection to the dominant route map, compatible signal lanes, source structure, and exact evidence without
creating a second range state or inventing cross-clock alignment.

Never attach a screenshot, coordinate table, route, export, library, or diagnostic containing personal history to
a public issue. Use a synthetic package and follow the repository security and support boundaries.
