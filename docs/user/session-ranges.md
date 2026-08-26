# Name and Revisit Part of a Session

## Status

This guide describes the personal-range library and editor implemented in the current FitFreed source. No
supported public binary is available yet. Use only independently generated synthetic data until the
version-matched release guidance explicitly opens a real-export boundary.

Personal ranges are an Alpha experience. Their ownership, persistence, exact-coordinate, reimport, summary,
route-map, independent-signal, source-structure, exact-evidence boundary, cross-representation interaction, and
acceptance contracts are implemented and pass locally. Public release evidence remains a separate release gate.

## Open personal ranges

Open **History → Training → Sessions**, choose a session, and open **Personal ranges** in session detail. This
destination remains available whether the source provided a route, measurements, or laps because the range is
authored by the person rather than supplied by a provider.

The initial view lists saved ranges. Opening one leads with its name, exact timeline, elapsed duration, recorded
distance or measurement where supported, and evidence coverage. **Evidence and limits** then reveals boundary
quality, complete measurement detail, overlapping source laps on the same exact timeline, and every calculation
that remains unavailable. Selecting a saved range moves keyboard focus to that result and, in the stacked compact
or high-zoom layout, scrolls it into view below the range list. Every list choice shows its exact start and end;
when two ranges share a name, those boundaries also distinguish their accessible action names. Opaque storage,
provider, session, exercise, route, signal, and range identifiers never become labels.

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

When a route is the session's leading evidence, the map offers the same creation task beside the recorded
track. Its two boundary controls visit only exact timed route points, and a map click moves the boundary chosen
in the inspector. The map and **Personal ranges** destination compose one draft and one command lifecycle, so a
range saved or adjusted in either place is immediately the same durable object in the other.

When a regular measurement is the session's leading evidence, its chart offers the equivalent task beside the
signal. The recorded-position control visits source samples with pointer or keyboard, including samples whose
value is missing but whose elapsed position was recorded. Creating from that position chooses it and the next
exact visible elapsed sample, or the preceding one when the position is the last sample. The two boundary
controls move only through exact samples represented in the bounded chart. A boundary typed into the shared
editor remains exact and unmarked when that particular sample is outside the bounded projection; FitFreed does
not snap it to a nearby sample. The route and signal boundary controls support arrow, Home, and End keys through
the same bounded behavior used by their pointer interaction. When a range is shown on the signal chart, its
accessible description includes the range name and exact elapsed boundaries as well as the measurement coverage.

Each regular signal retains its own recorded elapsed coordinate. Equal elapsed numbers do not synchronize the
range with a route or another signal. Opening exact samples from the chart reveals and focuses the currently
selected source sample, while the saved range remains the same object available under **Personal ranges**.

Recorded structure offers the complete exercise, each source lap, and each automatic lap as explicit interval
choices when their recorded elapsed boundaries are valid. Choosing one copies those boundaries into a new,
unnamed personal draft; the imported interval, title, and attribution remain unchanged and visible.

The paginated exact route and measurement tables offer one compact selector rather than an action in every row.
Choosing a timed point or sample uses it and the following timed entry as a new draft's boundaries, or the
preceding entry when it is the last available position. While that draft is open, another selected entry can
replace either boundary deliberately. An entry without an explicit recorded elapsed position is never offered,
and FitFreed does not derive a boundary from coordinates, table order, or an independent clock. The shared editor
appears before detail navigation, receives focus, and scrolls into view; the selected exact row remains recorded
evidence below it.

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

The editor is one shared session-detail task composed by the route map, independent signal workbench, source
structure, and exact-evidence tables. None creates another range state or invents cross-clock alignment.

Never attach a screenshot, coordinate table, route, export, library, or diagnostic containing personal history to
a public issue. Use a synthetic package and follow the repository security and support boundaries.
