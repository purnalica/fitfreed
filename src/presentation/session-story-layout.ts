import type { SessionStory } from "./session-story";

export type SessionDetailSection =
  | "overview"
  | "structure"
  | "signals"
  | "routes"
  | "provenance";

export type SessionLeadingEvidence = "route" | "signal" | "structure" | "zones";

export interface SessionStoryLayout {
  leadingEvidence: SessionLeadingEvidence | null;
  sections: SessionDetailSection[];
}

function hasVisualRoute(story: SessionStory): boolean {
  return story.exercises.some((exercise) => (
    (exercise.primary.route?.visualPoints.length ?? 0) > 0
      || (exercise.transition.route?.visualPoints.length ?? 0) > 0
  ));
}

function hasVisualSignal(story: SessionStory): boolean {
  return story.exercises.some((exercise) => (
    (["primary", "transition"] as const).some((role) => (
      exercise[role].eligibleOverlays.some((overlay) => (
        exercise[role].signals.some((signal) => (
          signal.signalRef === overlay.signalRef && signal.availableSampleCount > 0
        ))
      ))
    ))
  ));
}

function hasRecordedStructure(story: SessionStory): boolean {
  return story.exercises.some((exercise) => exercise.structure !== null);
}

function hasVisualZones(story: SessionStory): boolean {
  return story.exercises.some((exercise) => (
    exercise.zones?.groups.some((group) => (group.zones?.length ?? 0) > 0) ?? false
  ));
}

function hasSignalOrZoneDetail(story: SessionStory): boolean {
  return story.exercises.some((exercise) => (
    exercise.primary.evidence.signalSeriesCount > 0
      || exercise.primary.evidence.unsupportedSignalSeriesCount > 0
      || exercise.transition.evidence.signalSeriesCount > 0
      || exercise.transition.evidence.unsupportedSignalSeriesCount > 0
      || exercise.evidence.zoneGroupCount > 0
      || exercise.evidence.unsupportedZoneGroupCount > 0
  ));
}

function hasRouteDetail(story: SessionStory): boolean {
  return story.exercises.some((exercise) => (
    exercise.primary.route !== null || exercise.transition.route !== null
  ));
}

export function sessionStoryLayout(story: SessionStory | undefined): SessionStoryLayout {
  if (!story) {
    return {
      leadingEvidence: null,
      sections: ["overview", "structure", "signals", "routes", "provenance"],
    };
  }

  const leadingEvidence = hasVisualRoute(story) ? "route"
    : hasVisualSignal(story) ? "signal"
      : hasRecordedStructure(story) ? "structure"
        : hasVisualZones(story) ? "zones"
          : null;

  return {
    leadingEvidence,
    sections: [
      "overview",
      "structure",
      ...(hasSignalOrZoneDetail(story) ? ["signals" as const] : []),
      ...(hasRouteDetail(story) ? ["routes" as const] : []),
      "provenance",
    ],
  };
}
