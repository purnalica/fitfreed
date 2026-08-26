# Explore a Recorded Session Route

## Status

This guide describes the interactive route workbench implemented in the current FitFreed source. No
supported public binary is available yet. Use only independently generated synthetic data until the
version-matched release guidance explicitly opens a real-export boundary.

## Open the workbench

Open **History → Training → Sessions**, choose a session, and open its detail. FitFreed shows the route
workbench before the deeper detail sections only when that session contains recorded route geometry. It
does not reserve an empty map for an indoor or otherwise non-routed session.

The initial view fits the complete selected route. **Visible route** keeps each exercise's primary and
transition geometry separate; changing it never joins the two tracks. **Track display** offers only
relationships that an importer has explicitly certified. The current Polar Flow mapping does not establish
a shared route-and-signal clock, so its sole choice is **Recorded track**; FitFreed does not infer an overlay
from equal offsets, similar sample counts, or visual proximity.

## Investigate one position

- Click the recorded line to select its nearest returned evidence point.
- Use **Recorded position** with a pointer or keyboard to traverse every returned route point. The map
  marker, elapsed time, and altitude move together. A measurement value moves with them only when an importer
  supplied an exact recorded relationship.
- Use **Zoom in**, **Zoom out**, and **Show the complete track** without changing the selected evidence. The
  displayed **Map zoom** level is relative to this route, not a technical map scale. Zoom out stops while the
  recorded shape still has useful context, and zoom in stops before the view implies unsupported GPS precision.
  The corresponding action becomes unavailable at either limit.
- Choose **Focus the map** for a larger workspace. **Return to the session** or `Escape` restores the
  ordinary session view and the focus action without discarding the route, overlay, or selected point.
  While this workspace is open, background content and page scrolling are unavailable so keyboard and
  assistive-technology navigation remain inside the current map task.
- Focus the map itself to pan it with the arrow keys or zoom it with `+`, `-`, or the scroll wheel. The
  wheel remains inactive while the map is not focused so ordinary page scrolling cannot become trapped.
  Map keys navigate the viewport; the separate recorded-position control navigates evidence points. Buttons,
  keys, wheel, touch gestures, and the complete-track reset all obey the same route-relative limits.

An overlay's color scale is accompanied by its named recorded range and by the value strip at the
selected point. A missing value remains **Not recorded** or an explicit unavailable statement. FitFreed
does not interpolate it. When a displayed measurement is transformed from another recorded source, the
exact-evidence action names both meanings—for example, pace derived for display from recorded speed
samples.

## Keep part of a route

The map and **Your selection** inspector share the same personal-range state used by the **Personal ranges**
destination. Choose a timed route point and use **Create a range from this point**. The map remains visible
while the shared editor opens beside it on a wide window and below it at compact width or high content zoom.

Choose **Move range start** or **Move range end**, then click the recorded line to place that boundary on the
selected recorded point when that point has an exact elapsed value. An untimed point moves the exploration
cursor but does not become a range boundary. The separate **Range start on route** and **Range end on route**
controls expose the exact timed points to pointer and keyboard input. The highlighted line and two map markers
are projections of the shared draft; editing the elapsed fields directly never causes the map to guess a
nearest point. If an exact boundary is outside the bounded map projection, the saved value remains intact and
the inspector says why no marker is shown.

Saving creates the same session-owned object visible under **Personal ranges**. A saved range on the visible
route can be reopened with **Adjust on the map**. If a range on another coordinate is currently selected,
**Saved range** offers the ranges belonging to this visible route rather than hiding the only match. Route
changes, cancellation, conflicts, and reimport review continue through the one range controller; the workbench
does not own a second draft or persistence path. A point without recorded elapsed time cannot become a
boundary, and equal offsets on an independent signal never synchronize that signal with the map.

## Compare measurements along the route

Recorded measurements appear below the map only when an importer explicitly aligns them with route positions.
Every such lane keeps its own labelled axis, unit, recorded range, and source identity in one linked analytical
chart. Pace uses clock-like minutes and seconds rather than decimal minutes. The chart cursor is the same recorded
position used by the map and value strip. Choose a returned chart point to move the map to the nearest returned
route point on the application-established elapsed coordinate; this navigation does not claim that proximity is an
exact source relationship.

The **Shared map and measurement position** control is the complete pointer and keyboard alternative. Left and Right
move between recorded route positions, while Home and End move to the first or last timed position. Its accessible
value names the route point, elapsed time, and current value in every visible lane. The chart and control update the
existing local view rather than recreating it during traversal.

FitFreed initially shows at most three useful lanes. If more measurements are available, **Visible
measurements** lets you show up to four while keeping at least one. A line stops at a recorded unavailable
value or source gap. Dense lanes provide local horizontal zoom without changing their evidence domain. Displayed
ranges, selected values, source coverage, and exact-source actions remain structured HTML as well as graphics, and an
unaligned point remains explicitly unavailable.

The current Polar Flow importer does not provide the required route-and-signal relationship, even when both
sides contain elapsed values. Its map therefore remains available and its regular signal charts remain in
**Signals and zones**, while attached synchronized lanes and measurement overlays are absent. A route with no
recorded elapsed time has the same fail-closed result.

## Inspect exact evidence

**Inspect exact recorded route points** opens the existing Routes section at the page containing the selected
map point, marks its exact source row, and moves focus and the visible workspace to that row. A conditionally
available measurement lane offers the corresponding action for its source series only when an exact recorded
relationship exists. Independent regular signals remain available through **Signals and zones** without
pretending that one of their rows corresponds to the selected map point. These paths
retain source ordinals, coordinates, elapsed times, units, unavailable values, and gaps; the map and lanes are
not replacements for exact evidence.

## Privacy and current limits

The workbench renders only packaged code and local vector geometry. It requests no basemap tiles, place
names, geocoding, current-device location, or coordinate-bearing service. Route geometry and measurements
remain on the device. Update checks are a separate application capability and never receive imported
facts.

The current workbench deliberately has a neutral coordinate context rather than a street or terrain map.
Personal route-range editing and direct range entry from independent signal views, source structure, and exact
route or signal evidence are available through the same session-owned range controller. Each entry retains its
own application-established coordinate; an equal offset never makes independent evidence synchronized.

Never attach a screenshot, coordinate table, route, export, library, or diagnostic containing personal
history to a public issue. Use a synthetic package and follow the repository security and support
boundaries.
