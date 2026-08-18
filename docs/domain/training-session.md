# Training Session Domain

## Purpose

A Training Session is one provider-neutral observation of a recorded workout from one verified source subject. Its aggregate summary supports trustworthy longitudinal history, while evaluated detail can expose source exercises, manual and automatic laps, pauses, and recorded routes without changing aggregate meaning.

The complete normative contracts live in [canonical training-session summary version 1](../data-formats/canonical/training-session.md), [canonical training-session structure version 1](../data-formats/canonical/training-session-structure.md), and [canonical training-session route version 1](../data-formats/canonical/training-session-route.md). This document explains the domain boundary rather than repeating those specifications.

## Aggregate boundary

The session is the aggregate root. Source exercises, laps, pauses, zones, routes, and samples are children or supporting measurements; they are not interchangeable identities. A provider may report no child exercises, one child whose values differ from the aggregate, or several exercises with different sports. Summary behavior therefore uses the aggregate values supplied by the source adapter.

## Source and identity boundary

A session identity is local to an observation origin. Two providers can report the same real-world workout as two observations without FitFreed silently merging them. Future cross-source composition requires explicit evidence and remains outside import parsing.

The provider session identifier and unresolved sport reference are opaque evidence. They are not user names, globally stable FitFreed identifiers, or display labels. Presentation uses localized neutral language until an independently documented sport catalogue mapping exists.

## Time boundary

Training uses source-local wall time because it answers when the person experienced the session. An optional UTC offset can establish an instant but does not establish a named time zone. Declared duration remains its own measurement and can differ from wall-clock subtraction because of pauses, source behavior, or clock transitions that FitFreed must not guess.

## Privacy boundary

Mapped primary and transition route coordinates remain sensitive local evidence. FitFreed stores them in
the canonical library, queries bounded visual selections or exact pages, and renders them with local SVG;
the route path contacts no tile service, geocoder, or other external location service. Import does not grant
authority to export or expose a route through MCP, telemetry, synchronization, or remote cartography.

Zones, notes, comments, device identifiers, physical snapshots, and full-resolution physiological signal
series remain excluded from the current mapping. Those fields may remain in the user's original archive.
Source exercise identifiers remain protected persistence evidence; presentation receives only
domain-separated opaque session, exercise, and route capabilities.
