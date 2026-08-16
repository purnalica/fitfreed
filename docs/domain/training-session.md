# Training Session Domain

## Purpose

A Training Session is one provider-neutral summary of a recorded workout from one verified source subject. It gives the user trustworthy longitudinal training history before routes, high-resolution samples, detailed exercise segments, or cross-provider workout matching enter the product.

The complete normative field and reconciliation contract lives in [canonical training session summary version 1](../data-formats/canonical/training-session.md). This document explains the domain boundary rather than repeating that specification.

## Aggregate boundary

The session is the aggregate root. Source exercises, laps, pauses, zones, routes, and samples are children or supporting measurements; they are not interchangeable identities. A provider may report no child exercises, one child whose values differ from the aggregate, or several exercises with different sports. Summary behavior therefore uses the aggregate values supplied by the source adapter.

## Source and identity boundary

A session identity is local to an observation origin. Two providers can report the same real-world workout as two observations without FitFreed silently merging them. Future cross-source composition requires explicit evidence and remains outside import parsing.

The provider session identifier and unresolved sport reference are opaque evidence. They are not user names, globally stable FitFreed identifiers, or display labels. Presentation uses localized neutral language until an independently documented sport catalogue mapping exists.

## Time boundary

Training uses source-local wall time because it answers when the person experienced the session. An optional UTC offset can establish an instant but does not establish a named time zone. Declared duration remains its own measurement and can differ from wall-clock subtraction because of pauses, source behavior, or clock transitions that FitFreed must not guess.

## Privacy boundary

The MVP summary excludes coordinates, routes, notes, comments, device identifiers, physical snapshots, and full-resolution physiological samples. Those fields may remain in the user's original archive but are not copied into the canonical training library by summary version 1.
