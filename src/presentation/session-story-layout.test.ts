import { describe, expect, it } from "vitest";

import type { SessionStory } from "./session-story";
import { sessionStoryLayout } from "./session-story-layout";

const roleEvidence = {
  routePointCount: 0,
  signalSeriesCount: 0,
  signalSeriesWithValuesCount: 0,
  partialSignalSeriesCount: 0,
  unavailableSignalSeriesCount: 0,
  emptySignalSeriesCount: 0,
  unsupportedSignalSeriesCount: 0,
  signalSampleCount: 0,
  availableSignalSampleCount: 0,
  unavailableSignalSampleCount: 0,
};

function story(options: {
  route?: "visual" | "empty";
  signal?: "visual" | "unsupported";
  structure?: boolean;
  zones?: "bands" | "unsupported";
} = {}): SessionStory {
  const route = options.route ? {
    routeRef: "route-1",
    kind: "primary" as const,
    startedAtLocal: "2026-08-22T10:00:00",
    pointCount: options.route === "visual" ? 1 : 0,
    altitudePointCount: 0,
    elapsedPointCount: 0,
    projection: "source-ordinal-v1" as const,
    visualPoints: options.route === "visual" ? [{
      ordinal: 0,
      latitudeDegrees: 40,
      longitudeDegrees: -3,
      altitudeMeters: null,
      elapsedMilliseconds: null,
    }] : [],
  } : null;
  const signal = options.signal === "visual" ? {
    signalRef: "signal-1",
    ordinal: 0,
    role: "primary" as const,
    kind: "heart-rate" as const,
    unit: "beats-per-minute" as const,
    intervalMilliseconds: "1000",
    sampleCount: 1,
    availableSampleCount: 1,
    projection: "source-ordinal-v1" as const,
    visualSamples: [{
      ordinal: 0,
      elapsedMilliseconds: "0",
      value: 140,
      gapBefore: false,
    }],
  } : null;
  const overlay = signal ? {
    signalRef: signal.signalRef,
    metric: "heart-rate" as const,
    sourceKind: signal.kind,
    sourceUnit: signal.unit,
    valueTransform: "identity" as const,
    alignmentState: "unavailable" as const,
    alignedSamples: [],
  } : null;
  const structure = options.structure ? {
    exerciseRef: "exercise-1",
    ordinal: 0,
    startedAtLocal: "2026-08-22T10:00:00",
    stoppedAtLocal: "2026-08-22T11:00:00",
    utcOffsetMinutes: 120,
    durationMilliseconds: "3600000",
    distanceMeters: null,
    energyKilocalories: null,
    sport: {
      sportRef: "sport-1",
      state: "personally-overridden" as const,
      classification: {
        canonicalFamily: "running" as const,
        displayLabel: "Running",
        authorship: "user" as const,
        revision: 1,
      },
      recognition: null,
      recognitionCandidateCount: 0,
    },
    manualLaps: [],
    automaticLaps: [],
    pauses: [],
  } : null;
  const zones = options.zones ? {
    groups: options.zones === "bands" ? [{
      zoneGroupRef: "zone-group-1",
      ordinal: 0,
      kind: "heart-rate" as const,
      unit: "beats-per-minute" as const,
      zones: [{
        zoneRef: "zone-1",
        ordinal: 0,
        lowerLimit: 120,
        higherLimit: 140,
        timeInZoneMilliseconds: null,
        distanceMeters: null,
        muscleLoad: null,
      }],
    }] : [],
    unsupportedGroupCount: options.zones === "unsupported" ? 1 : 0,
  } : null;
  const unsupportedSignals = options.signal === "unsupported" ? 1 : 0;

  return {
    schemaVersion: 4,
    snapshotRef: "snapshot-1",
    session: {
      sessionRef: "session-1",
      sourceIndex: 1,
      startedAtLocal: "2026-08-22T10:00:00",
      stoppedAtLocal: "2026-08-22T11:00:00",
      utcOffsetMinutes: 120,
      durationMilliseconds: "3600000",
      distanceMeters: null,
      energyKilocalories: null,
      averageHeartRateBpm: null,
      maximumHeartRateBpm: null,
      exerciseCount: 1,
      sport: structure?.sport ?? {
        sportRef: null,
        state: "unavailable",
        classification: null,
        recognition: null,
        recognitionCandidateCount: 0,
      },
    },
    structure: { exercises: structure ? [structure] : null },
    routes: { exercises: null },
    signals: { exercises: null },
    zones: { exercises: null },
    provenance: {
      totalEventCount: 1,
      current: {
        provider: "polar-flow",
        sourceModifiedAtUtc: "2026-08-22T09:00:00Z",
        sourceAdapterVersion: "polar-flow-archive@11",
        mappingVersion: "polar-flow-training-session@6",
        contributingEventCount: 1,
        nonContributingEventCount: 0,
      },
    },
    composition: {
      structureState: structure ? "source-present" : "source-absent",
      routeState: route ? "source-present" : "source-absent",
      signalState: options.signal ? "source-present" : "source-absent",
      zoneState: zones ? "source-present" : "source-absent",
      exerciseCount: 1,
    },
    exercises: [{
      exerciseRef: "exercise-1",
      ordinal: 0,
      sport: structure?.sport ?? null,
      structure,
      zones,
      evidence: {
        hasStructure: structure !== null,
        manualLapCount: 0,
        automaticLapCount: 0,
        pauseCount: 0,
        zoneGroupCount: zones?.groups.length ?? 0,
        zoneCount: zones?.groups.flatMap((group) => group.zones ?? []).length ?? 0,
        timedZoneCount: 0,
        unsupportedZoneGroupCount: zones?.unsupportedGroupCount ?? 0,
      },
      primary: {
        route,
        signals: signal ? [signal] : [],
        evidence: {
          ...roleEvidence,
          routePointCount: route?.pointCount ?? 0,
          signalSeriesCount: signal ? 1 : 0,
          signalSeriesWithValuesCount: signal ? 1 : 0,
          unsupportedSignalSeriesCount: unsupportedSignals,
          signalSampleCount: signal?.sampleCount ?? 0,
          availableSignalSampleCount: signal?.availableSampleCount ?? 0,
        },
        primaryMetric: signal ? "heart-rate" : null,
        eligibleOverlays: overlay ? [overlay] : [],
        exactRoute: route ? { routeRef: route.routeRef, pointCount: route.pointCount } : null,
        exactSignals: signal ? [{
          signalRef: signal.signalRef,
          kind: signal.kind,
          unit: signal.unit,
          sampleCount: signal.sampleCount,
        }] : [],
      },
      transition: {
        route: null,
        signals: [],
        evidence: roleEvidence,
        primaryMetric: null,
        eligibleOverlays: [],
        exactRoute: null,
        exactSignals: [],
      },
    }],
  };
}

describe("sessionStoryLayout", () => {
  it("keeps the loading navigation complete until the story establishes capabilities", () => {
    expect(sessionStoryLayout(undefined)).toEqual({
      leadingEvidence: null,
      sections: ["overview", "ranges", "structure", "signals", "routes", "provenance"],
    });
  });

  it.each([
    [{ route: "visual", signal: "visual", structure: true, zones: "bands" }, "route"],
    [{ signal: "visual", structure: true, zones: "bands" }, "signal"],
    [{ structure: true, zones: "bands" }, "structure"],
    [{ zones: "bands" }, "zones"],
  ] as const)("selects the first useful leading evidence for %o", (options, expected) => {
    expect(sessionStoryLayout(story(options)).leadingEvidence).toBe(expected);
  });

  it("keeps exact route detail when an empty bounded route cannot lead", () => {
    expect(sessionStoryLayout(story({ route: "empty", signal: "visual" }))).toEqual({
      leadingEvidence: "signal",
      sections: ["overview", "ranges", "structure", "signals", "routes", "provenance"],
    });
  });

  it("offers unsupported evidence detail without fabricating a leading visual", () => {
    expect(sessionStoryLayout(story({ signal: "unsupported", zones: "unsupported" }))).toEqual({
      leadingEvidence: null,
      sections: ["overview", "ranges", "structure", "signals", "provenance"],
    });
  });

  it("removes unsupported destinations from a summary-only session", () => {
    expect(sessionStoryLayout(story())).toEqual({
      leadingEvidence: null,
      sections: ["overview", "ranges", "structure", "provenance"],
    });
  });
});
