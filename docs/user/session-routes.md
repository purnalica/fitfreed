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
transition geometry separate; changing it never joins the two tracks. **Track display** selects the
recorded line or one supported measurement aligned to it. The default follows the session's
sport-specific primary evidence when that measurement was recorded.

## Investigate one position

- Click the recorded line to select its nearest returned evidence point.
- Use **Recorded position** with a pointer or keyboard to traverse every returned route point. The map
  marker, elapsed time, altitude, and available measurement values move together.
- Use **Zoom in**, **Zoom out**, and **Show the complete track** without changing the selected evidence.
- Choose **Focus the map** for a larger workspace. **Return to the session** or `Escape` restores the
  ordinary session view and the focus action without discarding the route, overlay, or selected point.
  While this workspace is open, background content and page scrolling are unavailable so keyboard and
  assistive-technology navigation remain inside the current map task.
- Focus the map itself to pan it with the arrow keys or zoom it with `+`, `-`, or the scroll wheel. The
  wheel remains inactive while the map is not focused so ordinary page scrolling cannot become trapped.
  Map keys navigate the viewport; the separate recorded-position control navigates evidence points.

An overlay's color scale is accompanied by its named recorded range and by the value strip at the
selected point. A missing value remains **Not recorded** or an explicit unavailable statement. FitFreed
does not interpolate it. When a displayed measurement is transformed from another recorded source, the
exact-evidence action names both meanings—for example, pace derived for display from recorded speed
samples.

## Inspect exact evidence

**Inspect exact recorded route points** opens the existing Routes section and its paginated coordinate
table, then moves focus and the visible workspace to that result. The measurement action does the same in
Signals and zones at the corresponding exact source series. These
paths retain source ordinals, coordinates, elapsed times, units, unavailable values, and gaps; the map is
not a replacement for exact evidence.

## Privacy and current limits

The workbench renders only packaged code and local vector geometry. It requests no basemap tiles, place
names, geocoding, current-device location, or coordinate-bearing service. Route geometry and measurements
remain on the device. Update checks are a separate application capability and never receive imported
facts.

The current workbench deliberately has a neutral coordinate context rather than a street or terrain map.
Full synchronized signal lanes, personal range editing inside the map, and source-attributed range
exploration remain active MVP work. The existing exact tables, signal views, and personal segmentation
criteria remain available in their current detail sections while that integration is completed.

Never attach a screenshot, coordinate table, route, export, library, or diagnostic containing personal
history to a public issue. Use a synthetic package and follow the repository security and support
boundaries.
