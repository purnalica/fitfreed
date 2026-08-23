import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type {
  TrainingDiscoveryWorkspace,
  TrainingSessionCalendar,
  TrainingSessionSearchItem,
  TrainingSessionSearchPage,
  TrainingSessionSearchRequest,
} from "./training-session-search";
import type {
  TrainingExerciseStructure,
  TrainingSessionStructureResult,
} from "./training-session-detail";
import type { SessionStory } from "./session-story";
import type { TrainingSessionRangesResult } from "./training-session-range";
import type {
  TrainingRoutePointsResult,
  TrainingRouteOverview,
  TrainingSessionRoutesResult,
} from "./training-session-route";
import type {
  TrainingSignalSamplesResult,
  TrainingSessionSignalsResult,
  TrainingSignalSeriesOverview,
} from "./training-session-signal";
import type { TrainingSessionSegmentationResult } from "./training-session-segmentation";
import type { TrainingSessionProvenanceResult } from "./training-session-provenance";
import type {
  TrainingSessionZonesResult,
  TrainingZoneCollection,
} from "./training-session-zone";
import { TrainingSessionLibraryPanel } from "./TrainingSessionLibraryPanel";
import type {
  SavedTrainingSportClassification,
  TrainingSportsOverview,
} from "./training-sports";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
const routeViewport = vi.hoisted(() => ({
  create: vi.fn(),
  controller: {
    updateSelection: vi.fn(),
    updateOverlay: vi.fn(),
    updateRangeSelection: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitTrack: vi.fn(),
    invalidateSize: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("./leaflet-route-adapter", () => ({
  createLocalRouteViewport: routeViewport.create,
}));

const snapshotRef = `training-snapshot-${"a".repeat(64)}`;

function emptyWorkspaceCommand(command: string, arguments_: unknown) {
  if (command === "load_training_discovery_workspace") return Promise.resolve(null);
  if (command === "save_training_discovery_workspace") {
    return Promise.resolve((arguments_ as { workspace: TrainingDiscoveryWorkspace }).workspace);
  }
  if (command === "query_session_story") {
    const query = (arguments_ as { query: { sessionRef: string; snapshotRef: string } }).query;
    return Promise.resolve(trainingStory(query.sessionRef, query.snapshotRef));
  }
  if (command === "query_training_route_points") {
    const query = (arguments_ as {
      query: { sessionRef: string; routeRef: string; offset: number; limit: number };
    }).query;
    return Promise.resolve(trainingRoutePoints(
      query.sessionRef,
      query.routeRef,
      query.offset,
      query.limit,
    ));
  }
  if (command === "query_training_signal_samples") {
    const query = (arguments_ as {
      query: { sessionRef: string; signalRef: string; offset: number; limit: number };
    }).query;
    return Promise.resolve(trainingSignalSamples(
      query.sessionRef,
      query.signalRef,
      query.offset,
      query.limit,
    ));
  }
  if (command === "query_training_session_segmentation") {
    const query = (arguments_ as { query: { sessionRef: string } }).query;
    return Promise.resolve(trainingSegmentation(query.sessionRef));
  }
  if (command === "query_training_session_provenance") {
    const query = (arguments_ as { query: { sessionRef: string } }).query;
    return Promise.resolve(trainingProvenance(query.sessionRef));
  }
  if (command === "query_training_session_ranges") {
    const query = (arguments_ as { query: { sessionRef: string; snapshotRef: string } }).query;
    const story = trainingStory(query.sessionRef, query.snapshotRef);
    const ranges: TrainingSessionRangesResult = {
      snapshotRef: query.snapshotRef,
      sessionRef: query.sessionRef,
      sessionDurationMilliseconds: story.session.durationMilliseconds,
      evidenceRevision: `range-evidence-${"8".repeat(64)}`,
      exercises: story.exercises.map((exercise) => ({
        exerciseRef: exercise.exerciseRef,
        ordinal: exercise.ordinal,
        coordinates: [{
          coordinate: { scope: "exercise-elapsed" as const },
          maximumElapsedMilliseconds: exercise.structure?.durationMilliseconds ?? "0",
        }, ...([exercise.primary, exercise.transition] as const).flatMap((role) => {
          const routeCoordinate = role.exactRoute && role.route
            ? [{
              coordinate: {
                scope: "route-elapsed" as const,
                routeRef: role.exactRoute.routeRef,
              },
              maximumElapsedMilliseconds: role.route.visualPoints
                .flatMap((point) => point.elapsedMilliseconds ?? [])
                .at(-1) ?? "0",
            }]
            : [];
          const signalCoordinates = role.exactSignals.flatMap((exactSignal) => {
            const signal = role.signals.find(
              (candidate) => candidate.signalRef === exactSignal.signalRef,
            );
            return signal ? [{
              coordinate: {
                scope: "signal-elapsed" as const,
                signalRef: signal.signalRef,
              },
              maximumElapsedMilliseconds: (
                BigInt(Math.max(0, signal.sampleCount - 1))
                * BigInt(signal.intervalMilliseconds)
              ).toString(),
            }] : [];
          });
          return [...routeCoordinate, ...signalCoordinates];
        })],
      })),
      ranges: [],
    };
    return Promise.resolve(ranges);
  }
  return undefined;
}

const sports: TrainingSportsOverview = {
  originCount: 2,
  sessionCount: 26,
  sports: [
    {
      sportRef: `sport-${"c".repeat(64)}`,
      sourceIndex: 1,
      state: "classified",
      classification: {
        canonicalFamily: "running",
        displayLabel: "Trail running",
        authorship: "user",
        revision: 1,
      },
      firstLocalDate: "2024-01-01",
      lastLocalDate: "2026-08-18",
      coverage: {
        sessionCount: 25,
        totalDurationMilliseconds: "90000000",
        distanceSessionCount: 24,
        heartRateSessionCount: 23,
      },
    },
    {
      sportRef: `sport-${"d".repeat(64)}`,
      sourceIndex: 2,
      state: "unknown",
      classification: {
        canonicalFamily: null,
        displayLabel: null,
        authorship: null,
        revision: 0,
      },
      firstLocalDate: "2025-01-01",
      lastLocalDate: "2026-01-01",
      coverage: {
        sessionCount: 1,
        totalDurationMilliseconds: "1800000",
        distanceSessionCount: 0,
        heartRateSessionCount: 0,
      },
    },
  ],
};

function session(
  token: string,
  startedAtLocal: string,
  sourceIndex = 1,
): TrainingSessionSearchItem {
  return {
    sessionRef: `session-${token.repeat(64)}`,
    sourceIndex,
    startedAtLocal,
    stoppedAtLocal: `${startedAtLocal.slice(0, 11)}08:30:00`,
    utcOffsetMinutes: 120,
    durationMilliseconds: "3600000",
    distanceMeters: 10000.5,
    energyKilocalories: "650",
    averageHeartRateBpm: "145",
    maximumHeartRateBpm: "175",
    exerciseCount: 2,
    sport: {
      sportRef: sports.sports[0].sportRef,
      state: "classified",
      classification: sports.sports[0].classification,
    },
  };
}

const newest = session("b", "2026-08-18T07:30:00");
const second = session("e", "2026-08-17T07:30:00");
const oldest = session("f", "2024-01-01T07:30:00");
const unknownSession: TrainingSessionSearchItem = {
  ...session("9", "2026-01-01T07:30:00", 2),
  sport: {
    sportRef: sports.sports[1].sportRef,
    state: "unknown",
    classification: sports.sports[1].classification,
  },
};

function trainingStructure(sessionRef: string): TrainingSessionStructureResult {
  return {
    snapshotRef,
    sessionRef,
    structure: {
      exercises: [{
        exerciseRef: `exercise-${"1".repeat(64)}`,
        ordinal: 0,
        startedAtLocal: "2026-08-18T07:30:00",
        stoppedAtLocal: "2026-08-18T08:30:00",
        utcOffsetMinutes: 120,
        durationMilliseconds: "3600000",
        distanceMeters: 10000.5,
        energyKilocalories: "650",
        sport: {
          sportRef: `sport-${"9".repeat(64)}`,
          state: "unknown",
          classification: {
            canonicalFamily: null,
            displayLabel: "Intervals",
            authorship: "user",
            revision: 1,
          },
        },
        manualLaps: [{
          lapRef: `lap-${"2".repeat(64)}`,
          ordinal: 0,
          splitTimeMilliseconds: "0",
          durationMilliseconds: "1800000",
          distanceMeters: 5000.25,
        }],
        automaticLaps: [],
        pauses: [{
          pauseRef: `pause-${"3".repeat(64)}`,
          ordinal: 0,
          startedAtLocal: "2026-08-18T07:50:00",
          endedAtLocal: "2026-08-18T07:51:00",
        }],
      }, {
        exerciseRef: `exercise-${"4".repeat(64)}`,
        ordinal: 1,
        startedAtLocal: "2026-08-18T08:30:00",
        stoppedAtLocal: "2026-08-18T08:45:00",
        utcOffsetMinutes: 120,
        durationMilliseconds: "900000",
        distanceMeters: null,
        energyKilocalories: null,
        sport: {
          sportRef: sports.sports[1].sportRef,
          state: "unknown",
          classification: sports.sports[1].classification,
        },
        manualLaps: null,
        automaticLaps: null,
        pauses: null,
      }],
    },
  };
}

const primaryRouteRef = `route-${"5".repeat(64)}`;
const primaryRoutePoints = Array.from({ length: 101 }, (_, ordinal) => ({
  ordinal,
  latitudeDegrees: 40 + ordinal / 1_000,
  longitudeDegrees: -3 - ordinal / 1_000,
  altitudeMeters: ordinal % 2 === 0 ? 650 + ordinal : null,
  elapsedMilliseconds: String(ordinal * 1_000),
}));

function trainingRoutes(sessionRef: string): TrainingSessionRoutesResult {
  return {
    snapshotRef,
    sessionRef,
    routes: {
      exercises: [{
        exerciseRef: `exercise-${"1".repeat(64)}`,
        ordinal: 0,
        routes: {
          primary: {
            routeRef: primaryRouteRef,
            kind: "primary",
            startedAtLocal: "2026-08-18T07:30:00",
            pointCount: primaryRoutePoints.length,
            altitudePointCount: 51,
            elapsedPointCount: primaryRoutePoints.length,
            projection: "source-ordinal-v1",
            visualPoints: primaryRoutePoints,
          },
          transition: null,
        },
      }, {
        exerciseRef: `exercise-${"4".repeat(64)}`,
        ordinal: 1,
        routes: null,
      }],
    },
  };
}

function trainingRoutePoints(
  sessionRef: string,
  routeRef: string,
  offset: number,
  limit: number,
): TrainingRoutePointsResult {
  const points = primaryRoutePoints.slice(offset, offset + limit);
  return {
    snapshotRef,
    sessionRef,
    routeRef,
    pointCount: primaryRoutePoints.length,
    offset,
    points,
    nextOffset: offset + points.length < primaryRoutePoints.length
      ? offset + points.length
      : null,
  };
}

const heartRateSignalRef = `signal-${"6".repeat(64)}`;
const speedSignalRef = `signal-${"7".repeat(64)}`;
const heartRateSamples = Array.from({ length: 601 }, (_, ordinal) => ({
  ordinal,
  elapsedMilliseconds: String(ordinal * 1_000),
  value: ordinal === 51 ? null : 120 + ordinal / 2,
}));
const speedSamples = Array.from({ length: 301 }, (_, ordinal) => ({
  ordinal,
  elapsedMilliseconds: String(ordinal * 2_000),
  value: 10 + ordinal / 100,
}));

function visualSamples(samples: typeof heartRateSamples) {
  const selectedCount = Math.min(samples.length, 300);
  return Array.from({ length: selectedCount }, (_, index) => {
    const ordinal = selectedCount === 1
      ? 0
      : Math.floor(index * (samples.length - 1) / (selectedCount - 1));
    const sample = samples[ordinal]!;
    const previousOrdinal = index === 0
      ? undefined
      : Math.floor((index - 1) * (samples.length - 1) / (selectedCount - 1));
    return {
      ...sample,
      gapBefore: previousOrdinal !== undefined
        && samples.slice(previousOrdinal + 1, ordinal + 1)
          .some(({ value }) => value === null),
    };
  });
}

const heartRateVisualSamples = visualSamples(heartRateSamples);
const speedVisualSamples = visualSamples(speedSamples);
const signalOnlyGapOrdinals = new Set([
  speedVisualSamples[80]!.ordinal,
  speedVisualSamples[220]!.ordinal,
]);

function trainingSignals(sessionRef: string): TrainingSessionSignalsResult {
  return {
    snapshotRef,
    sessionRef,
    signals: {
      exercises: [{
        exerciseRef: `exercise-${"1".repeat(64)}`,
        ordinal: 0,
        signals: {
          primary: [{
            signalRef: heartRateSignalRef,
            ordinal: 0,
            role: "primary",
            kind: "heart-rate",
            unit: "beats-per-minute",
            intervalMilliseconds: "1000",
            sampleCount: heartRateSamples.length,
            availableSampleCount: 600,
            projection: "source-ordinal-v1",
            visualSamples: heartRateVisualSamples,
          }, {
            signalRef: speedSignalRef,
            ordinal: 1,
            role: "primary",
            kind: "speed",
            unit: "kilometers-per-hour",
            intervalMilliseconds: "2000",
            sampleCount: speedSamples.length,
            availableSampleCount: speedSamples.length,
            projection: "source-ordinal-v1",
            visualSamples: speedVisualSamples,
          }],
          transition: [],
          unsupportedPrimarySeriesCount: 1,
          unsupportedTransitionSeriesCount: 0,
        },
      }, {
        exerciseRef: `exercise-${"4".repeat(64)}`,
        ordinal: 1,
        signals: null,
      }],
    },
  };
}

function trainingZones(sessionRef: string): TrainingSessionZonesResult {
  return {
    snapshotRef,
    sessionRef,
    zones: {
      exercises: [{
        exerciseRef: `exercise-${"1".repeat(64)}`,
        ordinal: 0,
        zones: {
          groups: [{
            zoneGroupRef: `zone-group-${"7".repeat(64)}`,
            ordinal: 0,
            kind: "heart-rate",
            unit: "beats-per-minute",
            zones: [{
              zoneRef: `zone-${"8".repeat(64)}`,
              ordinal: 0,
              lowerLimit: 120,
              higherLimit: 139,
              timeInZoneMilliseconds: "900000",
              distanceMeters: null,
              muscleLoad: null,
            }, {
              zoneRef: `zone-${"9".repeat(64)}`,
              ordinal: 1,
              lowerLimit: 140,
              higherLimit: 159,
              timeInZoneMilliseconds: null,
              distanceMeters: null,
              muscleLoad: null,
            }],
          }],
          unsupportedGroupCount: 1,
        },
      }, {
        exerciseRef: `exercise-${"4".repeat(64)}`,
        ordinal: 1,
        zones: null,
      }],
    },
  };
}

function trainingSignalSamples(
  sessionRef: string,
  signalRef: string,
  offset: number,
  limit: number,
): TrainingSignalSamplesResult {
  const speed = signalRef === speedSignalRef;
  const sourceSamples = speed ? speedSamples : heartRateSamples;
  const samples = sourceSamples.slice(offset, offset + limit);
  return {
    snapshotRef,
    sessionRef,
    signalRef,
    exerciseRef: `exercise-${"1".repeat(64)}`,
    ordinal: speed ? 1 : 0,
    role: "primary",
    kind: speed ? "speed" : "heart-rate",
    unit: speed ? "kilometers-per-hour" : "beats-per-minute",
    intervalMilliseconds: speed ? "2000" : "1000",
    sampleCount: sourceSamples.length,
    offset,
    samples,
    nextOffset: offset + samples.length < sourceSamples.length
      ? offset + samples.length
      : null,
  };
}

function trainingSegmentation(sessionRef: string): TrainingSessionSegmentationResult {
  return {
    snapshotRef,
    sessionRef,
    availableCriteria: [],
    exercises: [{
      exerciseRef: `exercise-${"1".repeat(64)}`,
      ordinal: 0,
      durationMilliseconds: "3600000",
      appliedCriteria: [],
    }, {
      exerciseRef: `exercise-${"4".repeat(64)}`,
      ordinal: 1,
      durationMilliseconds: "900000",
      appliedCriteria: [],
    }],
  };
}

function trainingProvenance(sessionRef: string): TrainingSessionProvenanceResult {
  return {
    snapshotRef,
    sessionRef,
    totalEventCount: 1,
    offset: 0,
    limit: 10,
    nextOffset: null,
    current: {
      provider: "polar-flow",
      sourceModifiedAtUtc: "2026-08-17T18:30:00Z",
      sourceAdapterVersion: "polar-flow-archive@11",
      mappingVersion: "polar-flow-training-session@6",
      contributingEventCount: 1,
      nonContributingEventCount: 0,
    },
    events: [{
      ordinal: 0,
      observedAtUtc: "2026-08-17T18:31:00Z",
      sourceModifiedAtUtc: "2026-08-17T18:30:00Z",
      provider: "polar-flow",
      sourceAdapterVersion: "polar-flow-archive@11",
      mappingVersion: "polar-flow-training-session@6",
      decision: "create",
      contributesToVisibleState: true,
    }],
  };
}

function storySession(sessionRef: string): TrainingSessionSearchItem {
  return [newest, second, oldest, unknownSession].find(
    (candidate) => candidate.sessionRef === sessionRef,
  ) ?? { ...newest, sessionRef };
}

function storyRoleEvidence(
  route: TrainingRouteOverview | null,
  series: TrainingSignalSeriesOverview[],
  unsupportedSignalSeriesCount: number,
): SessionStory["exercises"][number]["primary"]["evidence"] {
  const signalSampleCount = series.reduce((total, signal) => total + signal.sampleCount, 0);
  const availableSignalSampleCount = series.reduce(
    (total, signal) => total + signal.availableSampleCount,
    0,
  );
  return {
    routePointCount: route?.pointCount ?? 0,
    signalSeriesCount: series.length,
    signalSeriesWithValuesCount: series.filter(
      (signal) => signal.availableSampleCount > 0,
    ).length,
    partialSignalSeriesCount: series.filter(
      (signal) => signal.availableSampleCount > 0
        && signal.availableSampleCount < signal.sampleCount,
    ).length,
    unavailableSignalSeriesCount: series.filter(
      (signal) => signal.sampleCount > 0 && signal.availableSampleCount === 0,
    ).length,
    emptySignalSeriesCount: series.filter((signal) => signal.sampleCount === 0).length,
    unsupportedSignalSeriesCount,
    signalSampleCount,
    availableSignalSampleCount,
    unavailableSignalSampleCount: signalSampleCount - availableSignalSampleCount,
  };
}

function storyExerciseEvidence(
  structure: TrainingExerciseStructure | null,
  zones: TrainingZoneCollection | null,
): SessionStory["exercises"][number]["evidence"] {
  const zoneValues = zones?.groups.flatMap((group) => group.zones ?? []) ?? [];
  return {
    hasStructure: structure !== null,
    manualLapCount: structure?.manualLaps?.length ?? 0,
    automaticLapCount: structure?.automaticLaps?.length ?? 0,
    pauseCount: structure?.pauses?.length ?? 0,
    zoneGroupCount: zones?.groups.length ?? 0,
    zoneCount: zoneValues.length,
    timedZoneCount: zoneValues.filter((zone) => zone.timeInZoneMilliseconds !== null).length,
    unsupportedZoneGroupCount: zones?.unsupportedGroupCount ?? 0,
  };
}

function trainingStory(
  sessionRef: string,
  acceptedSnapshotRef = snapshotRef,
): SessionStory {
  const structure = trainingStructure(sessionRef).structure;
  const routes = trainingRoutes(sessionRef).routes;
  const signals = trainingSignals(sessionRef).signals;
  const zones = trainingZones(sessionRef).zones;
  const provenance = trainingProvenance(sessionRef);
  const firstStructure = structure?.exercises?.[0] ?? null;
  const secondStructure = structure?.exercises?.[1] ?? null;
  const firstRoute = routes?.exercises?.[0]?.routes?.primary ?? null;
  const firstSignals = signals?.exercises?.[0]?.signals?.primary ?? [];
  const firstZones = zones?.exercises?.[0]?.zones ?? null;

  const overlays = firstSignals.map((signal) => {
    const samplesByElapsed = new Map(signal.visualSamples.map(
      (sample) => [sample.elapsedMilliseconds, sample],
    ));
    return {
      signalRef: signal.signalRef,
      metric: signal.kind === "speed" ? "pace" as const : "heart-rate" as const,
      sourceKind: signal.kind,
      sourceUnit: signal.unit,
      valueTransform: signal.kind === "speed"
        ? "kilometers-per-hour-to-minutes-per-kilometer" as const
        : "identity" as const,
      alignmentState: "exact-recorded" as const,
      alignedSamples: firstRoute?.visualPoints.flatMap((point) => {
        if (point.elapsedMilliseconds === null) return [];
        const sample = samplesByElapsed.get(point.elapsedMilliseconds);
        return sample ? [{
          routePointOrdinal: point.ordinal,
          signalSampleOrdinal: sample.ordinal,
          elapsedMilliseconds: point.elapsedMilliseconds,
          value: sample.value,
          gapBefore: sample.gapBefore,
        }] : [];
      }) ?? [],
    };
  });
  const exactSignals = firstSignals.map((signal) => ({
    signalRef: signal.signalRef,
    kind: signal.kind,
    unit: signal.unit,
    sampleCount: signal.sampleCount,
  }));

  return {
    schemaVersion: 3,
    snapshotRef: acceptedSnapshotRef,
    session: storySession(sessionRef),
    structure,
    routes,
    signals,
    zones,
    provenance: {
      totalEventCount: provenance.totalEventCount,
      current: provenance.current,
    },
    composition: {
      structureState: structure?.exercises === null ? "source-absent"
        : structure?.exercises.length === 0 ? "source-empty" : "source-present",
      routeState: routes?.exercises === null ? "source-absent"
        : routes?.exercises.length === 0 ? "source-empty" : "source-present",
      signalState: signals?.exercises === null ? "source-absent"
        : signals?.exercises.length === 0 ? "source-empty" : "source-present",
      zoneState: zones?.exercises === null ? "source-absent"
        : zones?.exercises.length === 0 ? "source-empty" : "source-present",
      exerciseCount: 2,
    },
    exercises: [{
      exerciseRef: firstStructure?.exerciseRef ?? `exercise-${"1".repeat(64)}`,
      ordinal: 0,
      sport: firstStructure?.sport ?? null,
      structure: firstStructure,
      zones: firstZones,
      evidence: storyExerciseEvidence(firstStructure, firstZones),
      primary: {
        route: firstRoute,
        signals: firstSignals,
        evidence: storyRoleEvidence(
          firstRoute,
          firstSignals,
          signals?.exercises?.[0]?.signals?.unsupportedPrimarySeriesCount ?? 0,
        ),
        primaryMetric: "heart-rate",
        eligibleOverlays: overlays,
        exactRoute: firstRoute ? {
          routeRef: firstRoute.routeRef,
          pointCount: firstRoute.pointCount,
        } : null,
        exactSignals,
      },
      transition: {
        route: routes?.exercises?.[0]?.routes?.transition ?? null,
        signals: signals?.exercises?.[0]?.signals?.transition ?? [],
        evidence: storyRoleEvidence(
          routes?.exercises?.[0]?.routes?.transition ?? null,
          signals?.exercises?.[0]?.signals?.transition ?? [],
          signals?.exercises?.[0]?.signals?.unsupportedTransitionSeriesCount ?? 0,
        ),
        primaryMetric: null,
        eligibleOverlays: [],
        exactRoute: null,
        exactSignals: [],
      },
    }, {
      exerciseRef: secondStructure?.exerciseRef ?? `exercise-${"4".repeat(64)}`,
      ordinal: 1,
      sport: secondStructure?.sport ?? null,
      structure: secondStructure,
      zones: zones?.exercises?.[1]?.zones ?? null,
      evidence: storyExerciseEvidence(
        secondStructure,
        zones?.exercises?.[1]?.zones ?? null,
      ),
      primary: {
        route: routes?.exercises?.[1]?.routes?.primary ?? null,
        signals: signals?.exercises?.[1]?.signals?.primary ?? [],
        evidence: storyRoleEvidence(
          routes?.exercises?.[1]?.routes?.primary ?? null,
          signals?.exercises?.[1]?.signals?.primary ?? [],
          signals?.exercises?.[1]?.signals?.unsupportedPrimarySeriesCount ?? 0,
        ),
        primaryMetric: null,
        eligibleOverlays: [],
        exactRoute: null,
        exactSignals: [],
      },
      transition: {
        route: routes?.exercises?.[1]?.routes?.transition ?? null,
        signals: signals?.exercises?.[1]?.signals?.transition ?? [],
        evidence: storyRoleEvidence(
          routes?.exercises?.[1]?.routes?.transition ?? null,
          signals?.exercises?.[1]?.signals?.transition ?? [],
          signals?.exercises?.[1]?.signals?.unsupportedTransitionSeriesCount ?? 0,
        ),
        primaryMetric: null,
        eligibleOverlays: [],
        exactRoute: null,
        exactSignals: [],
      },
    }],
  };
}

function signalOnlyTrainingStory(
  sessionRef: string,
  acceptedSnapshotRef = snapshotRef,
): SessionStory {
  const story = trainingStory(sessionRef, acceptedSnapshotRef);
  const exercise = story.exercises[0]!;
  const sourceSignal = exercise.primary.signals.find((signal) => signal.kind === "speed")!;
  const signal = {
    ...sourceSignal,
    availableSampleCount: sourceSignal.sampleCount - signalOnlyGapOrdinals.size,
    visualSamples: sourceSignal.visualSamples.map((sample) => ({
      ...sample,
      value: signalOnlyGapOrdinals.has(sample.ordinal) ? null : sample.value,
      gapBefore: signalOnlyGapOrdinals.has(sample.ordinal),
    })),
  };
  const overlay = exercise.primary.eligibleOverlays.find(
    (candidate) => candidate.signalRef === signal.signalRef,
  )!;
  const roleEvidence = storyRoleEvidence(null, [signal], 1);

  return {
    ...story,
    session: { ...story.session, exerciseCount: 1 },
    structure: null,
    routes: { exercises: null },
    signals: {
      exercises: [{
        exerciseRef: exercise.exerciseRef,
        ordinal: 0,
        signals: {
          primary: [signal],
          transition: [],
          unsupportedPrimarySeriesCount: 1,
          unsupportedTransitionSeriesCount: 0,
        },
      }],
    },
    zones: { exercises: null },
    composition: {
      structureState: "not-evaluated",
      routeState: "source-absent",
      signalState: "source-present",
      zoneState: "source-absent",
      exerciseCount: 1,
    },
    exercises: [{
      ...exercise,
      structure: null,
      zones: null,
      evidence: {
        hasStructure: false,
        manualLapCount: 0,
        automaticLapCount: 0,
        pauseCount: 0,
        zoneGroupCount: 0,
        zoneCount: 0,
        timedZoneCount: 0,
        unsupportedZoneGroupCount: 0,
      },
      primary: {
        route: null,
        signals: [signal],
        evidence: roleEvidence,
        primaryMetric: "pace",
        eligibleOverlays: [{
          ...overlay,
          alignmentState: "unavailable",
          alignedSamples: [],
        }],
        exactRoute: null,
        exactSignals: [{
          signalRef: signal.signalRef,
          kind: signal.kind,
          unit: signal.unit,
          sampleCount: signal.sampleCount,
        }],
      },
      transition: {
        route: null,
        signals: [],
        evidence: storyRoleEvidence(null, [], 0),
        primaryMetric: null,
        eligibleOverlays: [],
        exactRoute: null,
        exactSignals: [],
      },
    }],
  };
}

function structureOnlyTrainingStory(
  sessionRef: string,
  acceptedSnapshotRef = snapshotRef,
): SessionStory {
  const story = trainingStory(sessionRef, acceptedSnapshotRef);
  const exercise = story.exercises[0]!;
  const emptyRole = {
    route: null,
    signals: [],
    evidence: storyRoleEvidence(null, [], 0),
    primaryMetric: null,
    eligibleOverlays: [],
    exactRoute: null,
    exactSignals: [],
  };

  return {
    ...story,
    session: { ...story.session, exerciseCount: 1 },
    structure: { exercises: [exercise.structure!] },
    routes: { exercises: null },
    signals: { exercises: null },
    zones: { exercises: null },
    composition: {
      structureState: "source-present",
      routeState: "source-absent",
      signalState: "source-absent",
      zoneState: "source-absent",
      exerciseCount: 1,
    },
    exercises: [{
      ...exercise,
      zones: null,
      evidence: storyExerciseEvidence(exercise.structure, null),
      primary: emptyRole,
      transition: emptyRole,
    }],
  };
}

function zoneOnlyTrainingStory(
  sessionRef: string,
  acceptedSnapshotRef = snapshotRef,
): SessionStory {
  const story = trainingStory(sessionRef, acceptedSnapshotRef);
  const exercise = story.exercises[0]!;
  const zoneCollection: TrainingZoneCollection = {
    ...exercise.zones!,
    groups: [...exercise.zones!.groups, {
      zoneGroupRef: `zone-group-${"6".repeat(64)}`,
      ordinal: 1,
      kind: "speed",
      unit: "kilometers-per-hour",
      zones: [{
        zoneRef: `zone-${"5".repeat(64)}`,
        ordinal: 0,
        lowerLimit: 8,
        higherLimit: 10,
        timeInZoneMilliseconds: null,
        distanceMeters: 3000,
        muscleLoad: null,
      }, {
        zoneRef: `zone-${"4".repeat(64)}`,
        ordinal: 1,
        lowerLimit: 10,
        higherLimit: 12,
        timeInZoneMilliseconds: null,
        distanceMeters: 7000,
        muscleLoad: null,
      }],
    }],
  };
  const emptyRole = {
    route: null,
    signals: [],
    evidence: storyRoleEvidence(null, [], 0),
    primaryMetric: null,
    eligibleOverlays: [],
    exactRoute: null,
    exactSignals: [],
  };

  return {
    ...story,
    session: { ...story.session, exerciseCount: 1 },
    structure: { exercises: null },
    routes: { exercises: null },
    signals: { exercises: null },
    zones: { exercises: [{
      exerciseRef: exercise.exerciseRef,
      ordinal: exercise.ordinal,
      zones: zoneCollection,
    }] },
    composition: {
      structureState: "source-absent",
      routeState: "source-absent",
      signalState: "source-absent",
      zoneState: "source-present",
      exerciseCount: 1,
    },
    exercises: [{
      ...exercise,
      structure: null,
      zones: zoneCollection,
      evidence: storyExerciseEvidence(null, zoneCollection),
      primary: emptyRole,
      transition: emptyRole,
    }],
  };
}

const calendar: TrainingSessionCalendar = {
  availableRange: { from: "2024-01-01", through: "2026-08-18" },
  snapshotRef,
  month: "2026-08",
  days: [
    {
      localDate: "2026-08-17",
      sourceIndex: 1,
      sessionCount: 1,
      totalDurationMilliseconds: "3600000",
      distanceSessionCount: 1,
      totalDistanceMeters: 10000.5,
      heartRateSessionCount: 1,
    },
    {
      localDate: "2026-08-18",
      sourceIndex: 1,
      sessionCount: 1,
      totalDurationMilliseconds: "3600000",
      distanceSessionCount: 1,
      totalDistanceMeters: 10000.5,
      heartRateSessionCount: 1,
    },
  ],
};

function page(
  sessions: TrainingSessionSearchItem[],
  offset: number,
  totalCount: number,
  nextOffset: number | null,
): TrainingSessionSearchPage {
  return {
    availableRange: { from: "2024-01-01", through: "2026-08-18" },
    snapshotRef,
    totalCount,
    offset,
    limit: 25,
    nextOffset,
    summaries: totalCount === 0 ? [] : [{
      sourceIndex: 1,
      trainingDays: totalCount === 1 ? 1 : 25,
      sessionCount: totalCount,
      totalDurationMilliseconds: totalCount === 1 ? "3600000" : "91800000",
      distanceSessionCount: totalCount === 1 ? 1 : 25,
      totalDistanceMeters: totalCount === 1 ? 10000.5 : 250012.5,
      energySessionCount: totalCount === 1 ? 1 : 24,
      totalEnergyKilocalories: totalCount === 1 ? "650" : "15600",
      heartRateSessionCount: totalCount === 1 ? 1 : 23,
    }],
    sessions,
  };
}

function renderPanel(
  onError = vi.fn(),
  properties: Partial<ComponentProps<typeof TrainingSessionLibraryPanel>> = {},
) {
  const onAvailableRange = vi.fn();
  const onCreateReport = vi.fn();
  const rendered = render(
    <TrainingSessionLibraryPanel
      locale="en-US"
      messages={catalogs["en-US"]}
      refreshToken={0}
      onAvailableRange={onAvailableRange}
      onCreateReport={onCreateReport}
      onError={onError}
      {...properties}
    />,
  );
  return { onAvailableRange, onCreateReport, onError, ...rendered };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
  Object.values(routeViewport.controller).forEach((mock) => mock.mockReset());
  routeViewport.create.mockReset().mockResolvedValue(routeViewport.controller);
});

describe("TrainingSessionLibraryPanel", () => {
  it("names one unresolved sport in context through the shared classification task", async () => {
    const namedSport = {
      ...sports.sports[1],
      state: "classified" as const,
      classification: {
        canonicalFamily: "water-sport" as const,
        displayLabel: "River paddling",
        authorship: "user" as const,
        revision: 1,
      },
    };
    const namedOverview: TrainingSportsOverview = {
      ...sports,
      sports: [sports.sports[0], namedSport],
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([unknownSession], 0, 1, null));
      }
      if (command === "save_training_sport_classification") {
        return Promise.resolve(({
          outcome: "changed",
          overview: namedOverview,
        }) satisfies SavedTrainingSportClassification);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const onSportClassificationChange = vi.fn();
    const user = userEvent.setup();
    renderPanel(vi.fn(), { onSportClassificationChange });

    const sportSummary = await screen.findByRole("region", { name: "Sports in this history" });
    const unknownIdentity = within(sportSummary).getByText("Unknown sport 1");
    const unknownItem = unknownIdentity.closest("li");
    expect(unknownItem).not.toBeNull();
    const action = within(unknownItem!).getByRole("button", { name: "Name this sport" });
    await user.click(action);
    let editor = within(sportSummary).getByRole("form", { name: "Classify Unknown sport 1" });
    expect(within(editor).getByLabelText("Broad sport family")).toBeVisible();
    expect(within(editor).getByLabelText("Your sport name")).toBeVisible();

    await user.type(within(editor).getByLabelText("Your sport name"), "Discarded draft");
    await user.click(within(editor).getByRole("button", { name: "Cancel editing" }));
    await waitFor(() => expect(action).toHaveFocus());
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "save_training_sport_classification",
    )).toHaveLength(0);

    await user.click(action);
    editor = within(sportSummary).getByRole("form", { name: "Classify Unknown sport 1" });
    await user.selectOptions(within(editor).getByLabelText("Broad sport family"), "water-sport");
    await user.type(within(editor).getByLabelText("Your sport name"), "River paddling");
    await user.click(within(editor).getByRole("button", { name: "Save sport classification" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "save_training_sport_classification",
      {
        request: {
          sportRef: sports.sports[1].sportRef,
          expectedRevision: 0,
          canonicalFamily: "water-sport",
          displayLabel: "River paddling",
        },
      },
    ));
    const namedIdentity = await within(sportSummary).findByText("River paddling");
    expect(namedIdentity).toHaveFocus();
    expect(within(screen.getByRole("list", { name: "Training sessions" }))
      .getByText("River paddling")).toBeVisible();
    expect(onSportClassificationChange).toHaveBeenCalledWith(expect.objectContaining({
      outcome: "changed",
    }));
  });

  it("refreshes the classification snapshot without losing page, calendar, selection, or detail context", async () => {
    const nextSnapshotRef = `training-snapshot-${"e".repeat(64)}`;
    const namedSport = {
      ...sports.sports[1],
      state: "classified" as const,
      classification: {
        canonicalFamily: "water-sport" as const,
        displayLabel: "River paddling",
        authorship: "user" as const,
        revision: 1,
      },
    };
    const namedOverview: TrainingSportsOverview = {
      ...sports,
      sports: [sports.sports[0], namedSport],
    };
    const namedSession: TrainingSessionSearchItem = {
      ...unknownSession,
      sport: {
        sportRef: namedSport.sportRef,
        state: namedSport.state,
        classification: namedSport.classification,
      },
    };
    const restoredWorkspace: TrainingDiscoveryWorkspace = {
      version: 1,
      snapshotRef,
      from: null,
      through: null,
      sportRefs: [],
      requiredMeasurements: [],
      text: null,
      sort: "started-desc",
      offset: 25,
      limit: 25,
      view: "calendar",
      calendarMonth: "2026-01",
      calendarDay: "2026-01-01",
      selectedSessionRefs: [second.sessionRef, unknownSession.sessionRef],
      openSessionRef: unknownSession.sessionRef,
    };
    let classificationSaved = false;
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "load_training_discovery_workspace") {
        return Promise.resolve(restoredWorkspace);
      }
      if (command === "save_training_discovery_workspace") {
        return Promise.resolve(arguments_.workspace);
      }
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        if (!classificationSaved) {
          return Promise.resolve({
            ...page([unknownSession], 25, 26, null),
            snapshotRef,
          });
        }
        return Promise.resolve({
          ...page([namedSession], 25, 26, null),
          snapshotRef: nextSnapshotRef,
        });
      }
      if (command === "query_training_session_calendar") {
        return Promise.resolve({
          ...calendar,
          snapshotRef: classificationSaved ? nextSnapshotRef : snapshotRef,
          month: "2026-01",
          days: [{ ...calendar.days[0], localDate: "2026-01-01" }],
        });
      }
      if (command === "query_training_session_selection") {
        return Promise.resolve({
          snapshotRef: classificationSaved ? nextSnapshotRef : snapshotRef,
          sessions: classificationSaved ? [second, namedSession] : [second, unknownSession],
        });
      }
      if (command === "query_session_story") {
        return Promise.resolve(trainingStory(
          arguments_.query.sessionRef,
          arguments_.query.snapshotRef,
        ));
      }
      if (command === "query_training_session_segmentation") {
        return Promise.resolve({
          ...trainingSegmentation(arguments_.query.sessionRef),
          snapshotRef: arguments_.query.snapshotRef,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const onAvailableRange = vi.fn();
    const onCreateReport = vi.fn();
    const onError = vi.fn();
    function Harness() {
      const [classificationChange, setClassificationChange] = useState<{
        requestId: number;
        source: "sports";
        result: SavedTrainingSportClassification;
      }>();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              classificationSaved = true;
              setClassificationChange({
                requestId: 1,
                source: "sports",
                result: { outcome: "changed", overview: namedOverview },
              });
            }}
          >
            Apply external classification
          </button>
          <TrainingSessionLibraryPanel
            locale="en-US"
            messages={catalogs["en-US"]}
            refreshToken={0}
            classificationChange={classificationChange}
            onAvailableRange={onAvailableRange}
            onCreateReport={onCreateReport}
            onError={onError}
          />
        </>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(within(region).getByRole("heading", { name: "Session summary" })).toBeVisible();
    await user.click(within(region).getByRole("button", {
      name: "Structure and segments",
    }));
    expect(await within(region).findByRole("heading", { name: "Recorded structure" }))
      .toBeVisible();

    await user.click(screen.getByRole("button", { name: "Apply external classification" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_sessions",
      {
        request: {
          from: "2026-01-01",
          through: "2026-01-01",
          sportRefs: [],
          requiredMeasurements: [],
          text: null,
          sort: "started-desc",
          offset: 25,
          limit: 25,
          snapshotRef: null,
        },
      },
    ));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_session_calendar",
      {
        request: expect.objectContaining({
          month: "2026-01",
          snapshotRef: nextSnapshotRef,
        }),
      },
    ));
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_selection", {
      request: {
        sessionRefs: [second.sessionRef, unknownSession.sessionRef],
        snapshotRef: nextSnapshotRef,
      },
    });
    const refreshedDetail = within(region).getByRole("heading", { name: "Session summary" })
      .closest("section");
    expect(refreshedDetail).not.toBeNull();
    expect(within(region).getByRole("heading", { name: "Recorded structure" })).toBeVisible();
    expect(within(refreshedDetail!).getByText("River paddling", { selector: "p.eyebrow" }))
      .toBeVisible();
    await user.click(within(region).getByRole("button", { name: "Back to calendar" }));
    expect(within(region).getByText("2 sessions selected")).toBeVisible();
    expect(within(region).getByRole("heading", { name: "January 2026" })).toBeVisible();
    expect(within(region).queryByText(
      "Your library changed, so results restarted from the first page.",
    )).not.toBeInTheDocument();
  });

  it("keeps the saved identity and offers recovery when its snapshot refresh fails", async () => {
    const namedSport = {
      ...sports.sports[1],
      state: "classified" as const,
      classification: {
        canonicalFamily: "water-sport" as const,
        displayLabel: "River paddling",
        authorship: "user" as const,
        revision: 1,
      },
    };
    const namedOverview: TrainingSportsOverview = {
      ...sports,
      sports: [sports.sports[0], namedSport],
    };
    const namedSession: TrainingSessionSearchItem = {
      ...unknownSession,
      sport: {
        sportRef: namedSport.sportRef,
        state: namedSport.state,
        classification: namedSport.classification,
      },
    };
    let classificationSaved = false;
    let refreshAttempts = 0;
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        if (!classificationSaved) return Promise.resolve(page([unknownSession], 0, 1, null));
        refreshAttempts += 1;
        if (refreshAttempts === 1) return Promise.reject({ code: "library-query-failed" });
        return Promise.resolve({
          ...page([namedSession], 0, 1, null),
          snapshotRef: `training-snapshot-${"f".repeat(64)}`,
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const onAvailableRange = vi.fn();
    const onCreateReport = vi.fn();
    const onError = vi.fn();

    function Harness() {
      const [classificationChange, setClassificationChange] = useState<{
        requestId: number;
        source: "sports";
        result: SavedTrainingSportClassification;
      }>();
      return (
        <>
          <button
            type="button"
            onClick={() => {
              classificationSaved = true;
              setClassificationChange({
                requestId: 1,
                source: "sports",
                result: { outcome: "changed", overview: namedOverview },
              });
            }}
          >
            Apply external classification
          </button>
          <TrainingSessionLibraryPanel
            locale="en-US"
            messages={catalogs["en-US"]}
            refreshToken={0}
            classificationChange={classificationChange}
            onAvailableRange={onAvailableRange}
            onCreateReport={onCreateReport}
            onError={onError}
          />
        </>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(screen.getByRole("button", { name: "Apply external classification" }));

    const recovery = await within(region).findByRole("alert");
    expect(recovery).toHaveTextContent(
      "The sport identity was saved, but this view could not refresh. Your saved identity is safe.",
    );
    expect(within(region).getAllByText("River paddling").length).toBeGreaterThan(1);
    expect(onError).not.toHaveBeenCalledWith("library-query-failed");

    await user.click(within(recovery).getByRole("button", { name: "Refresh this history" }));
    await waitFor(() => expect(within(region).queryByRole("alert")).not.toBeInTheDocument());
    expect(refreshAttempts).toBe(2);
  });

  it("opens on recognizable sports and session results while refinements stay secondary", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    const sportSummary = within(region).getByRole("region", { name: "Sports in this history" });
    expect(within(sportSummary).getByText("Trail running")).toBeVisible();
    expect(within(sportSummary).getByText("Unknown sport 1")).toBeVisible();
    expect(within(sportSummary).getAllByTestId("sport-family-icon")).toHaveLength(2);

    const resultList = within(region).getByRole("list", { name: "Training sessions" });
    const resultArticles = within(resultList).getAllByRole("article");
    expect(resultArticles).toHaveLength(2);
    expect(within(resultArticles[0]).getByText("Trail running")).toBeVisible();
    expect(within(resultArticles[0]).getByTestId("sport-family-icon")).toBeVisible();

    const refinements = within(region).getByRole("group", { name: "Refine sessions" });
    expect(refinements).not.toHaveAttribute("open");
    expect(within(refinements).getByRole("form", { name: "Filter sessions", hidden: true }))
      .not.toBeVisible();
    expect(within(region).getByRole("group", { name: "Result summary" }))
      .not.toHaveAttribute("open");

    await user.click(within(refinements).getByText("Refine sessions"));
    expect(refinements).toHaveAttribute("open");
    expect(within(refinements).getByRole("form", { name: "Filter sessions" })).toBeVisible();
  });

  it("presents every available sport identity as an explicit refinement", async () => {
    const fourSports: TrainingSportsOverview = {
      ...sports,
      sports: [
        sports.sports[0],
        {
          ...sports.sports[0],
          sportRef: `sport-${"e".repeat(64)}`,
          sourceIndex: 2,
          classification: {
            canonicalFamily: "cycling",
            displayLabel: null,
            authorship: "user",
            revision: 1,
          },
        },
        sports.sports[1],
        {
          ...sports.sports[1],
          sportRef: `sport-${"f".repeat(64)}`,
          sourceIndex: 1,
        },
      ],
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(fourSports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel();

    const summary = await screen.findByRole("region", { name: "Sports in this history" });
    expect(within(summary).getAllByRole("listitem")).toHaveLength(4);
    for (const label of ["Trail running", "Cycling", "Unknown sport 1", "Unknown sport 2"]) {
      expect(within(summary).getByText(label)).toBeVisible();
    }
    expect(within(summary).getAllByRole("button", { name: "Name this sport" }))
      .toHaveLength(2);
  });

  it("composes each result card from available evidence at a human scale", async () => {
    const recognizableSession: TrainingSessionSearchItem = {
      ...newest,
      startedAtLocal: "2026-08-18T07:30:47.123",
      durationMilliseconds: "3723456",
      distanceMeters: 10_000.5,
      energyKilocalories: null,
      averageHeartRateBpm: null,
      maximumHeartRateBpm: null,
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([recognizableSession], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    renderPanel();

    const resultList = await screen.findByRole("list", { name: "Training sessions" });
    const card = within(resultList).getByRole("article");
    expect(card).toHaveTextContent("Aug 18, 2026");
    expect(card).toHaveTextContent("7:30 AM");
    expect(card).not.toHaveTextContent("7:30:47");
    expect(card).toHaveTextContent("1 h 2 min");
    expect(card).toHaveTextContent("10 km");
    expect(card).not.toHaveTextContent("10,000.5 m");
    expect(card).not.toHaveTextContent("Source 1");
    expect(card).not.toHaveTextContent("Not recorded");
    expect(within(card).getByText("Duration")).toBeVisible();
    expect(within(card).getByText("Distance")).toBeVisible();
    expect(within(card).queryByText("Energy")).not.toBeInTheDocument();
    expect(within(card).queryByText("Average heart rate")).not.toBeInTheDocument();
    expect(card.querySelectorAll("dl > div")).toHaveLength(2);
  });

  it("keeps the applied query distinct from its draft and removes every refinement independently", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        const filtered = request.from !== null
          || request.through !== null
          || request.sportRefs.length > 0
          || request.requiredMeasurements.length > 0
          || request.text !== null
          || request.sort !== "started-desc";
        return Promise.resolve(filtered
          ? page([newest], 0, 1, null)
          : page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    const appliedQuery = await within(region).findByRole("region", {
      name: "Applied refinements",
    });
    expect(appliedQuery).toHaveTextContent("26 matching sessions");
    expect(appliedQuery).toHaveTextContent("All sessions · newest first");

    const refinements = within(region).getByRole("group", { name: "Refine sessions" });
    await user.click(within(refinements).getByText("Refine sessions"));
    const form = within(refinements).getByRole("form", { name: "Filter sessions" });
    expect(form).toHaveTextContent("No start-date limit");
    expect(form).toHaveTextContent("No end-date limit");
    await user.type(within(form).getByLabelText("From date"), "2025-01-01");
    await user.type(within(form).getByLabelText("Through date"), "2026-08-18");
    expect(form).not.toHaveTextContent("No start-date limit");
    expect(form).not.toHaveTextContent("No end-date limit");
    await user.type(within(form).getByRole("textbox", {
      name: /^Your sport name contains/,
    }), " Trail ");
    await user.click(within(form).getByRole("checkbox", { name: "Trail running" }));
    await user.click(within(form).getByRole("checkbox", { name: "Unknown sport 1" }));
    await user.click(within(form).getByRole("checkbox", { name: "Distance" }));
    await user.click(within(form).getByRole("checkbox", { name: "Energy" }));
    await user.click(within(form).getByRole("checkbox", { name: "Heart rate" }));
    await user.selectOptions(within(form).getByLabelText("Order"), "distance-desc");

    expect(appliedQuery).toHaveTextContent("All sessions · newest first");
    expect(appliedQuery).not.toHaveTextContent("Trail running");
    await user.click(within(form).getByRole("button", { name: "Apply filters" }));

    expect(await within(appliedQuery).findByText("1 matching session")).toBeVisible();
    await waitFor(() => expect(within(appliedQuery).getByText("1 matching session"))
      .toHaveFocus());
    const refinementNames = [
      "From date: January 1, 2025",
      "Through date: August 18, 2026",
      "Sport: Trail running",
      "Sport: Unknown sport 1",
      "Recorded measurement: Distance",
      "Recorded measurement: Energy",
      "Recorded measurement: Heart rate",
      "Sport name: Trail",
      "Order: Farthest first",
    ];
    refinementNames.forEach((name) => {
      expect(within(appliedQuery).getByRole("button", { name: `Remove ${name}` }))
        .toBeVisible();
    });

    await user.click(within(appliedQuery).getByRole("button", {
      name: "Remove Sport: Trail running",
    }));
    expect(within(appliedQuery).queryByText("Sport: Trail running")).not.toBeInTheDocument();
    expect(within(appliedQuery).getByText("Sport: Unknown sport 1")).toBeVisible();
    expect(within(form).getByRole("checkbox", { name: "Trail running" })).not.toBeChecked();
    expect(within(form).getByRole("checkbox", { name: "Unknown sport 1" })).toBeChecked();
    await waitFor(() => expect(within(appliedQuery).getByText("1 matching session"))
      .toHaveFocus());
    expect(mocks.invoke).toHaveBeenLastCalledWith("query_training_sessions", {
      request: expect.objectContaining({
        sportRefs: [sports.sports[1].sportRef],
        offset: 0,
        snapshotRef: null,
      }),
    });

    for (const name of refinementNames.filter((candidate) => (
      candidate !== "Sport: Trail running" && candidate !== "Sport: Unknown sport 1"
    ))) {
      await user.click(within(appliedQuery).getByRole("button", { name: `Remove ${name}` }));
    }
    expect(within(appliedQuery).getByText("Sport: Unknown sport 1")).toBeVisible();
    expect(within(appliedQuery).getByRole("button", { name: "Clear all" })).toBeVisible();
    await user.click(within(appliedQuery).getByRole("button", { name: "Clear all" }));

    expect(await within(appliedQuery).findByText("26 matching sessions")).toBeVisible();
    expect(appliedQuery).toHaveTextContent("All sessions · newest first");
    expect(within(form).getByLabelText("From date")).toHaveValue("");
    expect(within(form).getByLabelText("Through date")).toHaveValue("");
    expect(form).toHaveTextContent("No start-date limit");
    expect(form).toHaveTextContent("No end-date limit");
    expect(within(form).getByRole("textbox", { name: /^Your sport name contains/ }))
      .toHaveValue("");
    expect(within(form).getByLabelText("Order")).toHaveValue("started-desc");
    expect(within(form).queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
  });

  it("explains an empty refined result and clears it without implying data loss", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        return Promise.resolve(request.text === null
          ? page([newest, second], 0, 26, 25)
          : page([], 0, 0, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    const refinements = within(region).getByRole("group", { name: "Refine sessions" });
    await user.click(within(refinements).getByText("Refine sessions"));
    await user.type(within(refinements).getByRole("textbox", {
      name: /^Your sport name contains/,
    }), "Rowing");
    await user.click(within(refinements).getByRole("button", { name: "Apply filters" }));

    const emptyResult = await within(region).findByRole("region", {
      name: "No sessions match the applied refinements",
    });
    expect(emptyResult).toHaveTextContent("Your imported history is unchanged.");
    expect(within(region).getByRole("region", { name: "Applied refinements" }))
      .toHaveTextContent("Sport name: Rowing");
    expect(within(region).queryByRole("button", { name: "Clear all" }))
      .not.toBeInTheDocument();
    await user.click(within(emptyResult).getByRole("button", { name: "Clear refinements" }));

    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
    expect(within(region).queryByRole("region", {
      name: "No sessions match the applied refinements",
    })).not.toBeInTheDocument();
  });

  it("gives an empty refined calendar the same direct recovery as chronology", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        return Promise.resolve(request.text === null
          ? page([newest, second], 0, 26, 25)
          : page([], 0, 0, null));
      }
      if (command === "query_training_session_calendar") {
        return Promise.resolve(arguments_.request.text === null
          ? calendar
          : { ...calendar, days: [] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(await within(region).findByRole("radio", { name: "Calendar" }));
    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    const refinements = within(region).getByRole("group", { name: "Refine sessions" });
    await user.click(within(refinements).getByText("Refine sessions"));
    await user.type(within(refinements).getByRole("textbox", {
      name: /^Your sport name contains/,
    }), "Rowing");
    await user.click(within(refinements).getByRole("button", { name: "Apply filters" }));

    const emptyResult = await within(region).findByRole("region", {
      name: "No sessions match the applied refinements",
    });
    expect(within(region).queryByRole("heading", { name: "August 2026" }))
      .not.toBeInTheDocument();
    await user.click(within(emptyResult).getByRole("button", { name: "Clear refinements" }));

    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    expect(within(region).getByRole("button", {
      name: /August 18, 2026.*1 session/,
    })).toBeVisible();
  });

  it("applies every stable order and exposes only a non-default order as removable", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    const refinements = within(region).getByRole("group", { name: "Refine sessions" });
    const appliedQuery = within(region).getByRole("region", { name: "Applied refinements" });
    for (const [value, label] of [
      ["started-asc", "Oldest first"],
      ["duration-desc", "Longest first"],
      ["distance-desc", "Farthest first"],
      ["started-desc", "Newest first"],
    ] as const) {
      if (!refinements.hasAttribute("open")) {
        await user.click(within(refinements).getByText("Refine sessions"));
      }
      await user.selectOptions(within(refinements).getByLabelText("Order"), value);
      await user.click(within(refinements).getByRole("button", { name: "Apply filters" }));
      await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
        "query_training_sessions",
        { request: expect.objectContaining({ sort: value, offset: 0, snapshotRef: null }) },
      ));
      if (value === "started-desc") {
        expect(appliedQuery).toHaveTextContent("All sessions · newest first");
        expect(within(appliedQuery).queryByRole("button", {
          name: `Remove Order: ${label}`,
        })).not.toBeInTheDocument();
      } else {
        expect(within(appliedQuery).getByRole("button", {
          name: `Remove Order: ${label}`,
        })).toBeVisible();
      }
    }
  });

  it("localizes the complete applied query in Spanish", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel(vi.fn(), { locale: "es-ES", messages: catalogs["es-ES"] });

    const region = await screen.findByRole("region", {
      name: "Encontrar una sesión de entrenamiento",
    });
    const refinements = within(region).getByRole("group", { name: "Acotar sesiones" });
    await user.click(within(refinements).getByText("Acotar sesiones"));
    await user.type(within(refinements).getByLabelText("Fecha inicial"), "2025-01-01");
    await user.click(within(refinements).getByRole("checkbox", { name: "Trail running" }));
    await user.selectOptions(within(refinements).getByLabelText("Orden"), "duration-desc");
    await user.click(within(refinements).getByRole("button", { name: "Aplicar filtros" }));

    const appliedQuery = within(region).getByRole("region", { name: "Filtros aplicados" });
    expect(appliedQuery).toHaveTextContent("1 sesión coincidente");
    expect(within(appliedQuery).getByRole("button", {
      name: "Quitar Fecha inicial: 1 de enero de 2025",
    })).toBeVisible();
    expect(within(appliedQuery).getByRole("button", {
      name: "Quitar Deporte: Trail running",
    })).toBeVisible();
    expect(within(appliedQuery).getByRole("button", {
      name: "Quitar Orden: Más largas primero",
    })).toBeVisible();
  });

  it("keeps an unavailable saved sport refinement explicit and removable without exposing its ref", async () => {
    const savedSportRef = `sport-${"9".repeat(64)}`;
    const workspace: TrainingDiscoveryWorkspace = {
      version: 1,
      snapshotRef,
      from: null,
      through: null,
      sportRefs: [savedSportRef],
      requiredMeasurements: [],
      text: null,
      sort: "started-desc",
      offset: 0,
      limit: 25,
      view: "chronology",
      calendarMonth: null,
      calendarDay: null,
      selectedSessionRefs: [],
      openSessionRef: null,
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_training_sports") {
        return Promise.reject({ code: "training-sports-query-failed" });
      }
      if (command === "load_training_discovery_workspace") return Promise.resolve(workspace);
      if (command === "save_training_discovery_workspace") return Promise.resolve(arguments_.workspace);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    const appliedQuery = within(region).getByRole("region", { name: "Applied refinements" });
    expect(appliedQuery).not.toHaveTextContent(savedSportRef);
    const remove = within(appliedQuery).getByRole("button", {
      name: "Remove Sport: Unavailable saved sport 1",
    });
    expect(remove).toBeVisible();
    await user.click(remove);
    await waitFor(() => expect(mocks.invoke).toHaveBeenLastCalledWith(
      "query_training_sessions",
      { request: expect.objectContaining({ sportRefs: [], offset: 0, snapshotRef: null }) },
    ));
  });

  it("opens and focuses an exact session reached from a report", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        expect(arguments_.request).toEqual({
          from: "2026-08-18",
          through: "2026-08-18",
          sportRefs: [],
          requiredMeasurements: [],
          text: null,
          sort: "started-desc",
          offset: 0,
          limit: 25,
          snapshotRef: null,
        });
        return Promise.resolve(page([newest], 0, 1, null));
      }
      if (command === "query_training_session_selection") {
        expect(arguments_.request).toEqual({
          sessionRefs: [newest.sessionRef],
          snapshotRef,
        });
        return Promise.resolve({ snapshotRef, sessions: [newest] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const rendered = renderPanel(vi.fn(), {
      initialDate: "2026-08-18",
      initialSessionRef: newest.sessionRef,
      navigationRequestId: 7,
    });

    const detailHeading = await screen.findByRole("heading", { name: "Session summary" });
    await waitFor(() => expect(detailHeading).toHaveFocus());
    const detail = screen.getByRole("region", { name: "Session summary" });
    const detailIdentity = detail.querySelector<HTMLElement>(".training-detail-identity");
    expect(detailIdentity).not.toBeNull();
    expect(within(detailIdentity!).getByTestId("sport-family-icon")).toBeVisible();
    expect(within(detailIdentity!).getByText("Trail running")).toBeVisible();
    expect(within(detail).getAllByText("Aug 18, 2026, 7:30 AM")[0]).toBeVisible();
    expect(mocks.invoke).not.toHaveBeenCalledWith("load_training_discovery_workspace");
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "save_training_discovery_workspace",
      { workspace: expect.objectContaining({ openSessionRef: newest.sessionRef }) },
    ));

    within(detail).getByRole("button", { name: "Back to session results" }).focus();
    rendered.rerender(
      <TrainingSessionLibraryPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        initialDate="2026-08-18"
        initialSessionRef={newest.sessionRef}
        navigationRequestId={7}
        createReportFocusRequestId={1}
        onAvailableRange={vi.fn()}
        onCreateReport={vi.fn()}
        onError={vi.fn()}
      />,
    );
    await waitFor(() => expect(within(detail).getByRole("button", {
      name: "Build a report from this session",
    })).toHaveFocus());
  });

  it("switches chronology and calendar, selects comparisons, and returns to the exact calendar origin", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_session_calendar") {
        const month = arguments_.request.month as string;
        return Promise.resolve({
          ...calendar,
          month,
          days: month === "2026-08" ? calendar.days : [],
        });
      }
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        if (request.from === "2026-08-18" && request.through === "2026-08-18") {
          return Promise.resolve(page([newest], 0, 1, null));
        }
        return Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onCreateReport } = renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });

    await user.click(within(region).getByRole("checkbox", {
      name: /Add .*18.*comparison/,
    }));
    await user.click(within(region).getByRole("checkbox", {
      name: /Add .*17.*comparison/,
    }));
    const comparison = within(region).getByRole("region", { name: "Session comparison" });
    expect(comparison).toHaveTextContent("2 sessions selected");
    expect(within(comparison).getByRole("table")).toHaveTextContent("10,000.5 m");
    expect(within(comparison).getAllByTestId("sport-family-icon")).toHaveLength(2);
    expect(within(comparison).getAllByText("Trail running")).toHaveLength(2);
    await user.click(within(comparison).getByRole("button", { name: "Clear comparison" }));
    expect(within(region).queryByRole("region", { name: "Session comparison" }))
      .not.toBeInTheDocument();

    await user.click(within(region).getByRole("radio", { name: "Calendar" }));
    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    const calendarDay = within(region).getByRole("button", {
      name: /August 18, 2026.*1 session/,
    });
    expect(calendarDay).not.toHaveTextContent("Source 1");
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_calendar", {
      request: {
        month: "2026-08",
        from: null,
        through: null,
        sportRefs: [],
        requiredMeasurements: [],
        text: null,
        snapshotRef,
      },
    });
    await user.click(within(region).getByRole("button", { name: "Previous month" }));
    expect(await within(region).findByRole("heading", { name: "July 2026" })).toBeVisible();
    await user.click(within(region).getByRole("button", { name: "Next month" }));
    await user.click(await within(region).findByRole("button", {
      name: /August 18, 2026.*1 session/,
    }));
    expect(await within(region).findByText("1–1 of 1 matching sessions")).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_sessions", {
      request: expect.objectContaining({
        from: "2026-08-18",
        through: "2026-08-18",
        offset: 0,
      }),
    });
    const calendarDetailOrigin = within(region).getByRole("button", {
      name: /View session details for/,
    });
    await user.click(calendarDetailOrigin);
    expect(within(region).getByRole("heading", { name: "Session summary" })).toBeVisible();
    const createReport = within(region).getByRole("button", {
      name: "Build a report from this session",
    });
    await user.click(createReport);
    expect(onCreateReport).toHaveBeenCalledWith({
      kind: "session",
      snapshotRef,
      session: newest,
    });
    await user.click(within(region).getByRole("button", { name: "Back to calendar" }));
    expect(within(region).getByRole("heading", { name: "August 2026" })).toBeVisible();
    expect(within(region).queryByRole("heading", { name: "Session summary" }))
      .not.toBeInTheDocument();
    await waitFor(() => expect(calendarDetailOrigin).toHaveFocus());
    await user.click(within(region).getByRole("radio", { name: "Chronology" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_training_sessions", {
      request: expect.objectContaining({
        from: null,
        through: null,
        offset: 0,
        snapshotRef,
      }),
    }));
    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
  });

  it("keeps source-separated calendar evidence legible without opaque ordinals", async () => {
    const twoHistoryCalendar: TrainingSessionCalendar = {
      ...calendar,
      days: [
        calendar.days[1],
        {
          ...calendar.days[1],
          sourceIndex: 2,
        },
      ],
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      if (command === "query_training_session_calendar") {
        return Promise.resolve(twoHistoryCalendar);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(within(region).getByRole("radio", { name: "Calendar" }));

    const day = await within(region).findByRole("button", {
      name: /August 18, 2026.*2 sessions/,
    });
    expect(day).toHaveTextContent("2 separate histories");
    expect(day).not.toHaveTextContent("Source 1");
    expect(day).not.toHaveTextContent("Source 2");
  });

  it("opens the calendar inside the applied search window", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([oldest], 0, 1, null));
      }
      if (command === "query_training_session_calendar") {
        const month = arguments_.request.month as string;
        return Promise.resolve({ ...calendar, month, days: [] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });

    await user.type(within(region).getByLabelText("From date"), "2024-01-01");
    await user.type(within(region).getByLabelText("Through date"), "2024-01-31");
    await user.click(within(region).getByRole("button", { name: "Apply filters" }));
    await user.click(within(region).getByRole("radio", { name: "Calendar" }));

    expect(await within(region).findByRole("heading", { name: "January 2024" })).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_calendar", {
      request: expect.objectContaining({
        month: "2024-01",
        from: "2024-01-01",
        through: "2024-01-31",
      }),
    });
  });

  it("keeps an open calendar inside a newly applied search window", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([oldest], 0, 1, null));
      }
      if (command === "query_training_session_calendar") {
        const month = arguments_.request.month as string;
        return Promise.resolve({ ...calendar, month, days: [] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });

    await user.click(within(region).getByRole("radio", { name: "Calendar" }));
    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    await user.type(within(region).getByLabelText("From date"), "2024-01-01");
    await user.type(within(region).getByLabelText("Through date"), "2024-01-31");
    await user.click(within(region).getByRole("button", { name: "Apply filters" }));

    expect(await within(region).findByRole("heading", { name: "January 2024" })).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_calendar", {
      request: expect.objectContaining({
        month: "2024-01",
        from: "2024-01-01",
        through: "2024-01-31",
      }),
    });
  });

  it("filters real fields against a stable snapshot", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        if (request.offset === 25) return Promise.resolve(page([oldest], 25, 26, null));
        if (request.text === "Trail") return Promise.resolve(page([newest], 0, 1, null));
        return Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onAvailableRange, onError } = renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(within(region).getByText("1–2 of 26 matching sessions")).toBeVisible();
    const completeSummary = within(region).getByRole("list", { name: "Training summary" });
    expect(completeSummary).toHaveTextContent("26 sessions");
    expect(completeSummary).toHaveTextContent("25 training days");
    expect(completeSummary).toHaveTextContent("25 h 30 min");
    expect(completeSummary).toHaveTextContent("Recorded distance · 25 of 26");
    expect(completeSummary).toHaveTextContent("Recorded energy · 24 of 26");
    expect(completeSummary).toHaveTextContent("23 of 26");
    expect(within(region).getAllByText("Trail running")).not.toHaveLength(0);
    expect(region).not.toHaveTextContent("sport-");
    expect(region).not.toHaveTextContent("session-");
    expect(onAvailableRange).toHaveBeenCalledWith({
      from: "2024-01-01",
      through: "2026-08-18",
    });

    await user.type(within(region).getByLabelText("From date"), "2025-01-01");
    await user.type(within(region).getByLabelText("Through date"), "2026-08-18");
    await user.type(
      within(region).getByRole("textbox", {
        name: /^Your sport name contains/,
      }),
      " Trail ",
    );
    await user.click(within(region).getByRole("checkbox", { name: "Trail running" }));
    await user.click(within(region).getByRole("checkbox", { name: "Distance" }));
    await user.click(within(region).getByRole("checkbox", { name: "Energy" }));
    await user.click(within(region).getByRole("checkbox", { name: "Heart rate" }));
    await user.selectOptions(within(region).getByLabelText("Order"), "distance-desc");
    await user.click(within(region).getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_sessions",
      {
        request: {
          from: "2025-01-01",
          through: "2026-08-18",
          sportRefs: [sports.sports[0].sportRef],
          requiredMeasurements: ["distance", "energy", "heart-rate"],
          text: "Trail",
          sort: "distance-desc",
          offset: 0,
          limit: 25,
          snapshotRef: null,
        },
      },
    ));
    expect(await within(region).findByText("1–1 of 1 matching sessions")).toBeVisible();
    const filteredSummary = within(region).getByRole("list", { name: "Training summary" });
    expect(filteredSummary).toHaveTextContent("1 session");
    expect(filteredSummary).toHaveTextContent("1 training day");
    expect(filteredSummary).toHaveTextContent("1 h");
    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it("paginates a stable snapshot and opens and closes exact summary detail", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        if (request.offset === 25) return Promise.resolve(page([oldest], 25, 26, null));
        return Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onError } = renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });

    const detailOrigin = within(region).getByRole("button", {
      name: "View session details for Aug 18, 2026, 7:30 AM",
    });
    await user.click(detailOrigin);
    const detail = within(region).getByRole("heading", { name: "Session summary" })
      .closest("section");
    expect(detail).not.toBeNull();
    await waitFor(() => expect(within(detail!).getByRole("heading", {
      name: "Session summary",
    })).toHaveFocus());
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "query_session_story",
      {
        query: {
          sessionRef: newest.sessionRef,
          snapshotRef,
          maxVisualPoints: 400,
          maxVisualSamples: 400,
        },
      },
    ));
    expect(mocks.invoke.mock.calls.some(([command]) => [
      "query_training_session_structure",
      "query_training_session_routes",
      "query_training_session_signals",
      "query_training_session_zones",
    ].includes(command))).toBe(false);
    const detailNavigation = within(detail!).getByRole("navigation", {
      name: "Session detail",
    });
    const workbench = await within(detail!).findByRole("region", {
      name: "Recorded route workbench",
    });
    expect(within(workbench).getByRole("region", { name: "Recorded route map" }))
      .toBeVisible();
    expect(within(workbench).getByText("Point 1 of 101")).toBeVisible();
    expect(within(workbench).getByText("Heart rate on the recorded track")).toBeVisible();
    expect(workbench.compareDocumentPosition(detailNavigation))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(detail).toHaveTextContent("10,000.5 m");
    expect(detail).toHaveTextContent("650 kcal");
    expect(detail).toHaveTextContent("145 bpm");
    expect(detail).toHaveTextContent("175 bpm");
    expect(detail).toHaveTextContent("UTC+02:00");
    expect(within(detailNavigation).getByRole("button", { name: "Overview" }))
      .toHaveAttribute("aria-current", "page");
    expect(within(region).queryByRole("form", { name: "Filter sessions" }))
      .not.toBeInTheDocument();
    expect(within(detail!).queryByRole("heading", { name: "Recorded structure" }))
      .not.toBeInTheDocument();

    const rangesSection = detail!.querySelector<HTMLElement>("#training-detail-ranges");
    expect(rangesSection).not.toBeNull();
    rangesSection!.scrollIntoView = vi.fn();
    await user.click(within(detailNavigation).getByRole("button", {
      name: "Personal ranges",
    }));
    expect(await within(detail!).findByRole("heading", { name: "Your ranges" })).toBeVisible();
    await waitFor(() => expect(rangesSection).toHaveFocus());
    expect(rangesSection!.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      inline: "nearest",
    });
    expect(within(detail!).getByText("No personal ranges yet.")).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_ranges", {
      query: { sessionRef: newest.sessionRef, snapshotRef },
    });

    const structureSection = detail!.querySelector<HTMLElement>("#training-detail-structure");
    expect(structureSection).not.toBeNull();
    structureSection!.scrollIntoView = vi.fn();
    await user.click(within(detailNavigation).getByRole("button", {
      name: "Structure and segments",
    }));
    expect(await within(detail!).findByRole("heading", { name: "Recorded structure" }))
      .toBeVisible();
    await waitFor(() => expect(structureSection).toHaveFocus());
    expect(structureSection!.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      inline: "nearest",
    });
    const firstExercise = within(detail!).getByRole("heading", { name: "Exercise 1" })
      .closest("article");
    expect(firstExercise).not.toBeNull();
    expect(within(firstExercise!).getByTestId("sport-family-icon")).toBeVisible();
    expect(within(firstExercise!).getByText("Intervals")).toBeVisible();
    expect(within(detail!).getByRole("heading", { name: "Exercise 2" })).toBeVisible();
    expect(detail).toHaveTextContent("Intervals");
    expect(detail).toHaveTextContent("Unknown sport 1");
    expect(detail).not.toHaveTextContent("Unknown sport 2");
    expect(within(firstExercise!).getByRole("heading", { name: "Source laps" })).toBeVisible();
    expect(within(firstExercise!).getByRole("heading", { name: "Automatic laps" })).toBeVisible();
    expect(within(firstExercise!).getByRole("heading", { name: "Pauses" })).toBeVisible();

    fireEvent.change(within(workbench).getByRole("slider", {
      name: "Recorded position",
    }), { target: { value: "100" } });
    expect(await within(workbench).findByText("Point 101 of 101")).toBeVisible();
    await user.click(within(workbench).getByRole("button", {
      name: "Inspect exact recorded route points",
    }));
    expect(within(detailNavigation).getByRole("button", { name: "Routes" }))
      .toHaveAttribute("aria-current", "page");
    const routeExercise = within(detail!).getByRole("heading", { name: "Exercise 1" })
      .closest("article");
    expect(routeExercise).not.toBeNull();
    expect(await within(routeExercise!).findByRole("heading", { name: "Primary route" }))
      .toBeVisible();
    expect(within(routeExercise!).getByRole("img", {
      name: /Primary route with 101 recorded points/,
    })).toBeVisible();
    expect(routeExercise).toHaveTextContent("Route geometry stays on this device");
    const exactRegion = await within(routeExercise!).findByRole("region", {
      name: "Exact recorded route points",
    });
    const selectedRouteRow = await within(exactRegion).findByRole("row", {
      name: /101/,
    });
    await waitFor(() => expect(selectedRouteRow).toHaveFocus());
    expect(selectedRouteRow).toHaveAttribute("aria-current", "true");
    expect(within(exactRegion).getAllByRole("row")).toHaveLength(2);
    expect(exactRegion).toHaveTextContent("Point 101 of 101");
    expect(exactRegion).toHaveTextContent("40");
    expect(exactRegion).toHaveTextContent("-3");
    await user.click(within(exactRegion).getByRole("button", { name: "Previous route points" }));
    expect(await within(exactRegion).findByText("Points 1–100 of 101")).toBeVisible();
    const exactRouteEvidence = within(exactRegion).getByRole("combobox", {
      name: "Exact recorded point",
    });
    await user.selectOptions(exactRouteEvidence, "point-1");
    await user.click(within(exactRegion).getByRole("button", {
      name: "Create a personal range",
    }));
    const routeRangeEditor = within(detail!).getByRole("form", {
      name: "Create a personal range",
    });
    await waitFor(() => expect(within(routeRangeEditor).getByRole("heading", {
      name: "Create a personal range",
    })).toHaveFocus());
    expect(within(routeRangeEditor).getByLabelText("Start")).toHaveValue("0:00:01");
    expect(within(routeRangeEditor).getByLabelText("End")).toHaveValue("0:00:02");
    expect(within(routeRangeEditor).queryByRole("combobox", { name: "Timeline" }))
      .not.toBeInTheDocument();
    expect(within(exactRegion).getByRole("rowheader", { name: "2" }).closest("tr"))
      .toBeVisible();
    await user.click(within(routeRangeEditor).getByRole("button", { name: "Cancel" }));
    await user.click(within(routeExercise!).getByRole("button", {
      name: "Hide exact recorded points",
    }));
    expect(within(routeExercise!).queryByRole("region", {
      name: "Exact recorded route points",
    })).not.toBeInTheDocument();

    await user.click(within(workbench).getByRole("button", {
      name: "Inspect exact Heart rate samples",
    }));
    expect(within(detailNavigation).getByRole("button", { name: "Signals and zones" }))
      .toHaveAttribute("aria-current", "page");
    const signalExercise = within(detail!).getByRole("heading", { name: "Exercise 1" })
      .closest("article");
    expect(signalExercise).not.toBeNull();
    expect(await within(signalExercise!).findByRole("heading", { name: "Recorded signals" }))
      .toBeVisible();
    expect(within(signalExercise!).getByRole("heading", { name: "Heart rate" })).toBeVisible();
    expect(within(signalExercise!).getByRole("img", {
      name: /Heart rate chart with 600 recorded values out of 601 samples/,
    })).toBeVisible();
    expect(within(signalExercise!).getByRole("img", {
      name: /Heart rate chart/,
    }).querySelectorAll("polyline")).toHaveLength(2);
    const crossSignal = within(signalExercise!).getByRole("region", {
      name: "Explore signals together",
    });
    expect(within(crossSignal).getAllByRole("checkbox", { checked: true })).toHaveLength(2);
    expect(within(crossSignal).getAllByRole("img")).toHaveLength(2);
    expect(crossSignal).toHaveTextContent("Elapsed time 0–10 min");
    const workbenchExactSignal = await within(signalExercise!).findByRole("region", {
      name: "Exact Heart rate samples",
    });
    const selectedSignalRow = await within(workbenchExactSignal).findByRole("row", {
      name: /101/,
    });
    await waitFor(() => expect(selectedSignalRow).toHaveFocus());
    expect(selectedSignalRow).toHaveAttribute("aria-current", "true");
    expect(workbenchExactSignal).toHaveTextContent("Samples 101–200 of 601");
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_signal_samples", {
      query: {
        sessionRef: newest.sessionRef,
        signalRef: heartRateSignalRef,
        snapshotRef,
        offset: 100,
        limit: 100,
      },
    });
    await user.click(within(signalExercise!).getByRole("button", {
      name: "Hide exact Heart rate samples",
    }));
    await user.click(within(crossSignal).getByRole("button", {
      name: "Open exact samples for Speed · series 2",
    }));
    const exactSpeedRegion = await within(signalExercise!).findByRole("region", {
      name: "Exact Speed samples",
    });
    await waitFor(() => expect(within(exactSpeedRegion).getByRole("heading", {
      name: "Exact Speed samples",
    })).toHaveFocus());
    expect(exactSpeedRegion).toHaveTextContent("10 km/h");
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_signal_samples", {
      query: {
        sessionRef: newest.sessionRef,
        signalRef: speedSignalRef,
        snapshotRef,
        offset: 0,
        limit: 100,
      },
    });
    await user.click(within(signalExercise!).getByRole("button", {
      name: "Hide exact Speed samples",
    }));
    expect(signalExercise).toHaveTextContent("1 recorded signal series is not shown in this view");
    await user.click(within(signalExercise!).getByRole("button", {
      name: "Inspect exact Heart rate samples",
    }));
    const exactSignalRegion = await within(signalExercise!).findByRole("region", {
      name: "Exact Heart rate samples",
    });
    expect(within(exactSignalRegion).getAllByRole("row")).toHaveLength(101);
    expect(exactSignalRegion).toHaveTextContent("Not recorded");
    const exactSignalEvidence = within(exactSignalRegion).getByRole("combobox", {
      name: "Exact recorded sample",
    });
    await user.selectOptions(exactSignalEvidence, "sample-1");
    await user.click(within(exactSignalRegion).getByRole("button", {
      name: "Create a personal range",
    }));
    const signalRangeEditor = within(detail!).getByRole("form", {
      name: "Create a personal range",
    });
    await waitFor(() => expect(within(signalRangeEditor).getByRole("heading", {
      name: "Create a personal range",
    })).toHaveFocus());
    expect(within(signalRangeEditor).getByLabelText("Start")).toHaveValue("0:00:01");
    expect(within(signalRangeEditor).getByLabelText("End")).toHaveValue("0:00:02");
    expect(within(signalRangeEditor).queryByRole("combobox", { name: "Timeline" }))
      .not.toBeInTheDocument();
    expect(within(exactSignalRegion).getByRole("rowheader", { name: "2" }).closest("tr"))
      .toBeVisible();
    await user.click(within(signalRangeEditor).getByRole("button", { name: "Cancel" }));
    await user.click(within(exactSignalRegion).getByRole("button", {
      name: "Next signal samples",
    }));
    expect(await within(exactSignalRegion).findByText("Samples 101–200 of 601")).toBeVisible();
    await user.click(within(exactSignalRegion).getByRole("button", {
      name: "Previous signal samples",
    }));
    expect(await within(exactSignalRegion).findByText("Samples 1–100 of 601")).toBeVisible();
    await user.click(within(signalExercise!).getByRole("button", {
      name: "Hide exact Heart rate samples",
    }));
    expect(within(signalExercise!).queryByRole("region", {
      name: "Exact Heart rate samples",
    })).not.toBeInTheDocument();
    const zones = await within(signalExercise!).findByRole("region", {
      name: "Recorded zones",
    });
    expect(within(zones).getByRole("region", { name: "Heart rate · group 1" }))
      .toHaveTextContent("120–139 bpm");
    expect(zones).toHaveTextContent("15 min");
    expect(zones).toHaveTextContent("Not recorded");
    expect(zones).toHaveTextContent(
      "1 recorded zone group is not shown in this view. It remains in the original ZIP.",
    );
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_training_session_provenance",
    )).toHaveLength(0);
    await user.click(within(detailNavigation).getByRole("button", {
      name: "Source history",
    }));
    await user.click(within(detail!).getByRole("button", {
      name: "How did this session get here?",
    }));
    const provenance = await within(detail!).findByRole("region", {
      name: "Session provenance",
    });
    expect(provenance).toHaveTextContent("Polar Flow");
    expect(provenance).toHaveTextContent("Added the session");
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_session_provenance", {
      query: {
        sessionRef: newest.sessionRef,
        snapshotRef,
        offset: 0,
        limit: 10,
      },
    });
    await user.click(within(detail!).getByRole("button", {
      name: "Hide session provenance",
    }));
    expect(within(detail!).queryByRole("region", { name: "Session provenance" }))
      .not.toBeInTheDocument();
    await user.click(within(detailNavigation).getByRole("button", {
      name: "Signals and zones",
    }));
    const secondExercise = within(detail!).getByRole("heading", { name: "Exercise 2" })
      .closest("article");
    expect(secondExercise).toHaveTextContent(
      "The source did not provide a signal container for this exercise.",
    );
    expect(secondExercise).toHaveTextContent(
      "The source did not provide a zone container for this exercise.",
    );
    expect(detail).toHaveTextContent("5,000.25 m");
    expect(detail).toHaveTextContent("Provided by the source with no entries.");
    expect(detail).not.toHaveTextContent("exercise-");
    expect(detail).not.toHaveTextContent("lap-");
    expect(detail).not.toHaveTextContent("pause-");
    expect(detail).not.toHaveTextContent("zone-");
    await user.click(within(detail!).getByRole("button", { name: "Back to session results" }));
    expect(within(region).queryByRole("heading", { name: "Session summary" }))
      .not.toBeInTheDocument();
    await waitFor(() => expect(detailOrigin).toHaveFocus());

    await user.click(within(region).getByRole("button", { name: "Clear filters" }));
    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
    await user.click(within(region).getByRole("button", { name: "Next page" }));
    expect(await within(region).findByText("26–26 of 26 matching sessions")).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_sessions", {
      request: {
        from: null,
        through: null,
        sportRefs: [],
        requiredMeasurements: [],
        text: null,
        sort: "started-desc",
        offset: 25,
        limit: 25,
        snapshotRef,
      },
    });
    await user.click(within(region).getByRole("button", { name: "Previous page" }));
    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it("foregrounds recorded signals when a partial session has no route or source structure", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_session_story") {
        const query = arguments_.query as { sessionRef: string; snapshotRef: string };
        return Promise.resolve(signalOnlyTrainingStory(query.sessionRef, query.snapshotRef));
      }
      if (command === "query_training_signal_samples") {
        const query = arguments_.query as {
          sessionRef: string;
          signalRef: string;
          offset: number;
          limit: number;
        };
        const result = trainingSignalSamples(
          query.sessionRef,
          query.signalRef,
          query.offset,
          query.limit,
        );
        return Promise.resolve({
          ...result,
          samples: result.samples.map((sample) => ({
            ...sample,
            value: signalOnlyGapOrdinals.has(sample.ordinal) ? null : sample.value,
          })),
        });
      }
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(within(region).getByRole("button", {
      name: /View session details for/,
    }));
    const detail = within(region).getByRole("region", { name: "Session summary" });
    const workbench = await within(detail).findByRole("region", {
      name: "Recorded signal workbench",
    });

    expect(within(workbench).getByRole("heading", {
      name: "Explore recorded pace",
    })).toBeVisible();
    expect(within(workbench).getByRole("img", {
      name: /Pace chart with 299 recorded values out of 301 samples/,
    })).toBeVisible();
    expect(within(workbench).getByText("299 of 301")).toBeVisible();
    expect(within(detail).queryByRole("region", {
      name: "Recorded route workbench",
    })).not.toBeInTheDocument();

    const evidence = within(detail).getByRole("region", { name: "Session evidence" });
    expect(evidence).toHaveTextContent("Recorded detail");
    expect(evidence).toHaveTextContent(
      "A concise account of what FitFreed can currently present.",
    );
    expect(evidence).toHaveTextContent("1 exercise");
    expect(evidence).toHaveTextContent("1 signal series");
    expect(evidence).toHaveTextContent("2 samples without a recorded value");
    expect(evidence).toHaveTextContent("1 recorded series not shown here");

    const detailNavigation = within(detail).getByRole("navigation", {
      name: "Session detail",
    });
    expect(within(detailNavigation).getByRole("button", {
      name: "Structure and segments",
    })).toBeVisible();
    expect(within(detailNavigation).queryByRole("button", { name: "Routes" }))
      .not.toBeInTheDocument();
    await user.click(within(detailNavigation).getByRole("button", {
      name: "Signals and zones",
    }));
    const signalExercise = within(detail).getByRole("heading", { name: "Exercise 1" })
      .closest("article");
    expect(signalExercise).not.toBeNull();
    expect(await within(signalExercise!).findByRole("heading", {
      name: "Recorded signals",
    })).toBeVisible();

    await user.click(within(workbench).getByRole("button", {
      name: "Inspect exact Speed samples",
    }));
    expect(within(detailNavigation).getByRole("button", { name: "Signals and zones" }))
      .toHaveAttribute("aria-current", "page");
    const exact = await within(signalExercise!).findByRole("region", {
      name: "Exact Speed samples",
    });
    expect(within(exact).getByRole("heading", { name: "Exact Speed samples" })).toBeVisible();
    await waitFor(() => expect(within(exact).getByRole("row", {
      name: /Selected measurement/,
    })).toHaveFocus());
    expect(exact).toHaveTextContent("Not recorded");
    expect(mocks.invoke).toHaveBeenCalledWith("query_training_signal_samples", {
      query: {
        sessionRef: newest.sessionRef,
        signalRef: speedSignalRef,
        snapshotRef,
        offset: 0,
        limit: 100,
      },
    });
  });

  it("foregrounds recorded structure without inventing a map or signal timeline", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_session_story") {
        const query = arguments_.query as { sessionRef: string; snapshotRef: string };
        return Promise.resolve(structureOnlyTrainingStory(query.sessionRef, query.snapshotRef));
      }
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(within(region).getByRole("button", {
      name: /View session details for/,
    }));
    const detail = within(region).getByRole("region", { name: "Session summary" });
    const workbench = await within(detail).findByRole("region", {
      name: "Recorded structure workbench",
    });

    expect(within(workbench).getByRole("heading", {
      name: "Explore recorded structure",
    })).toBeVisible();
    expect(within(workbench).getByTestId("sport-family-icon")).toBeVisible();
    expect(within(workbench).getByText("Intervals")).toBeVisible();
    const structureVisual = within(workbench).getByRole("img", {
      name: /Recorded structure for exercise 1: 1 source lap, 0 automatic laps, and 1 pause across 1 h/,
    });
    expect(structureVisual).toBeVisible();
    const visualBars = structureVisual.querySelectorAll(".training-structure-workbench-track i");
    expect(visualBars).toHaveLength(2);
    expect(visualBars[1]).toHaveStyle({ left: "0%", width: "50%" });
    expect(workbench).toHaveTextContent("10 km");
    expect(workbench).toHaveTextContent("1 source lap");
    expect(workbench).toHaveTextContent("1 pause");
    expect(within(detail).queryByRole("region", {
      name: "Recorded route workbench",
    })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("region", {
      name: "Recorded signal workbench",
    })).not.toBeInTheDocument();

    const evidence = within(detail).getByRole("region", { name: "Session evidence" });
    expect(evidence).toHaveTextContent("1 exercise with recorded structure");
    expect(evidence).toHaveTextContent("1 recorded lap");
    expect(evidence).toHaveTextContent("1 recorded pause");
    const navigation = within(detail).getByRole("navigation", { name: "Session detail" });
    expect(within(navigation).queryByRole("button", { name: "Signals and zones" }))
      .not.toBeInTheDocument();
    expect(within(navigation).queryByRole("button", { name: "Routes" }))
      .not.toBeInTheDocument();

    await user.click(within(workbench).getByRole("button", {
      name: "Explore structure and personal segments",
    }));
    const structureHeading = await within(detail).findByRole("heading", {
      name: "Recorded structure",
    });
    await waitFor(() => expect(structureHeading).toHaveFocus());
    expect(within(detail).getByRole("heading", { name: "Source laps" })).toBeVisible();
    const sourceInterval = within(detail).getByRole("combobox", {
      name: "Source interval for personal range",
    });
    await user.selectOptions(sourceInterval, "source-lap-0");
    const sourceRangePicker = within(detail).getByRole("region", {
      name: "Source interval for personal range",
    });
    await user.click(within(sourceRangePicker).getByRole("button", {
      name: "Create a personal range",
    }));
    const sourceRangeEditor = within(detail).getByRole("form", {
      name: "Create a personal range",
    });
    await waitFor(() => expect(within(sourceRangeEditor).getByRole("heading", {
      name: "Create a personal range",
    })).toHaveFocus());
    expect(within(sourceRangeEditor).getByLabelText("Start")).toHaveValue("0:00:00");
    expect(within(sourceRangeEditor).getByLabelText("End")).toHaveValue("0:30:00");
    expect(within(detail).getByRole("heading", { name: "Source laps" })).toBeVisible();
    expect(await within(detail).findByRole("heading", {
      name: "Your session segments",
    })).toBeVisible();
  });

  it("foregrounds recorded zone aggregates without presenting them as a timeline", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_session_story") {
        const query = arguments_.query as { sessionRef: string; snapshotRef: string };
        return Promise.resolve(zoneOnlyTrainingStory(query.sessionRef, query.snapshotRef));
      }
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(within(region).getByRole("button", {
      name: /View session details for/,
    }));
    const detail = within(region).getByRole("region", { name: "Session summary" });
    const workbench = await within(detail).findByRole("region", {
      name: "Recorded zone workbench",
    });

    expect(within(workbench).getByRole("heading", {
      name: "Explore recorded heart rate zones",
    })).toBeVisible();
    expect(within(workbench).getByTestId("sport-family-icon")).toBeVisible();
    expect(within(workbench).getByText("Intervals")).toBeVisible();
    const zoneVisual = within(workbench).getByRole("img", {
      name: "Heart rate distribution for exercise 1: 1 of 2 zones have recorded time; recorded total 15 min. This is not a timeline.",
    });
    expect(zoneVisual).toBeVisible();
    const initialTracks = zoneVisual.querySelectorAll(".training-zone-workbench-track");
    expect(initialTracks[0]).toHaveAttribute("data-state", "recorded");
    expect(initialTracks[1]).toHaveAttribute("data-state", "missing");
    expect(workbench).toHaveTextContent("120–139 bpm");
    expect(workbench).toHaveTextContent("1 of 2 zones");
    expect(workbench).toHaveTextContent("15 min");
    expect(workbench).toHaveTextContent("Aggregate distribution, not a timeline");
    const groupSelector = within(workbench).getByRole("combobox", {
      name: "Visible zone group",
    });
    await user.selectOptions(
      groupSelector,
      "Speed · group 2 · exercise 1 · Intervals",
    );
    expect(within(workbench).getByRole("heading", {
      name: "Explore recorded speed zones",
    })).toBeVisible();
    expect(within(workbench).getByRole("img", {
      name: "Speed distribution for exercise 1: 2 of 2 zones have recorded distance; recorded total 10,000 m. This is not a timeline.",
    })).toBeVisible();
    expect(workbench).toHaveTextContent("8–10 km/h");
    await user.selectOptions(
      groupSelector,
      "Heart rate · group 1 · exercise 1 · Intervals",
    );
    expect(within(detail).queryByRole("region", {
      name: "Recorded route workbench",
    })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("region", {
      name: "Recorded signal workbench",
    })).not.toBeInTheDocument();
    expect(within(detail).queryByRole("region", {
      name: "Recorded structure workbench",
    })).not.toBeInTheDocument();

    const evidence = within(detail).getByRole("region", { name: "Session evidence" });
    expect(evidence).toHaveTextContent("4 recorded zones");
    expect(evidence).toHaveTextContent("1 recorded zone group not shown here");
    const navigation = within(detail).getByRole("navigation", { name: "Session detail" });
    expect(within(navigation).getByRole("button", { name: "Signals and zones" }))
      .toBeVisible();
    expect(within(navigation).queryByRole("button", { name: "Routes" }))
      .not.toBeInTheDocument();

    await user.click(within(workbench).getByRole("button", {
      name: "Explore exact recorded zones",
    }));
    const zoneHeading = await within(detail).findByRole("heading", {
      name: "Heart rate · group 1",
    });
    await waitFor(() => expect(zoneHeading).toHaveFocus());
    const zoneGroup = zoneHeading.closest("section");
    expect(zoneGroup).not.toBeNull();
    expect(zoneGroup).toHaveTextContent("120–139 bpm");
    expect(zoneGroup).toHaveTextContent("Not recorded");
  });

  it("localizes evidence-adaptive zone composition as one complete Spanish journey", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_session_story") {
        const query = arguments_.query as { sessionRef: string; snapshotRef: string };
        return Promise.resolve(zoneOnlyTrainingStory(query.sessionRef, query.snapshotRef));
      }
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel(vi.fn(), { locale: "es-ES", messages: catalogs["es-ES"] });

    const region = await screen.findByRole("region", {
      name: "Encontrar una sesión de entrenamiento",
    });
    await user.click(within(region).getByRole("button", {
      name: /Ver detalles de la sesión/,
    }));
    const workbench = await within(region).findByRole("region", {
      name: "Área de trabajo de las zonas registradas",
    });
    expect(within(workbench).getByRole("heading", {
      name: "Explorar las zonas registradas de frecuencia cardíaca",
    })).toBeVisible();
    expect(workbench).toHaveTextContent("1 de 2 zonas");
    expect(workbench).toHaveTextContent("Distribución agregada, no una línea temporal");
    expect(within(workbench).getByRole("combobox", {
      name: "Grupo de zonas visible",
    })).toBeVisible();

    await user.click(within(workbench).getByRole("button", {
      name: "Explorar las zonas registradas exactas",
    }));
    const exactHeading = await within(region).findByRole("heading", {
      name: "Frecuencia cardíaca · grupo 1",
    });
    await waitFor(() => expect(exactHeading).toHaveFocus());
  });

  it("announces a search without renaming its action or hiding the current results", async () => {
    let resolveSearch!: (value: TrainingSessionSearchPage) => void;
    const pendingSearch = new Promise<TrainingSessionSearchPage>((resolve) => {
      resolveSearch = resolve;
    });
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return arguments_.request.text === "Trail"
          ? pendingSearch
          : Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(await within(region).findByText("1–2 of 26 matching sessions")).toBeVisible();
    const form = within(region).getByRole("form", { name: "Filter sessions" });
    await user.type(within(form).getByRole("textbox", {
      name: /^Your sport name contains/,
    }), "Trail");

    await user.click(within(form).getByRole("button", { name: "Apply filters" }));

    expect(form).toHaveAttribute("aria-busy", "true");
    expect(within(form).getByRole("button", { name: "Apply filters" })).toBeDisabled();
    expect(within(form).getByRole("status")).toHaveTextContent("Applying filters…");
    expect(within(region).getByText("1–2 of 26 matching sessions")).toBeVisible();

    act(() => resolveSearch(page([newest], 0, 1, null)));
    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
    expect(within(form).queryByRole("status")).not.toBeInTheDocument();
    expect(within(region).getByText("1–1 of 1 matching sessions")).toBeVisible();
  });

  it("keeps the prior applied query and editable draft when a refinement query fails", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        return request.text === "Trail"
          ? Promise.reject({ code: "training-session-search-failed" })
          : Promise.resolve(page([newest, second], 0, 26, 25));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onError } = renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });
    const refinements = within(region).getByRole("group", { name: "Refine sessions" });
    await user.click(within(refinements).getByText("Refine sessions"));
    const text = within(refinements).getByRole("textbox", {
      name: /^Your sport name contains/,
    });
    await user.type(text, "Trail");
    await user.click(within(refinements).getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("training-session-search-failed"));
    expect(refinements).toHaveAttribute("open");
    expect(text).toHaveValue("Trail");
    const appliedQuery = within(region).getByRole("region", { name: "Applied refinements" });
    expect(appliedQuery).toHaveTextContent("26 matching sessions");
    expect(appliedQuery).toHaveTextContent("All sessions · newest first");
    expect(appliedQuery).not.toHaveTextContent("Sport name: Trail");
    expect(within(region).getByText("1–2 of 26 matching sessions")).toBeVisible();
  });

  it("keeps the prior list, calendar, and applied query when the refined calendar fails", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        return Promise.resolve(request.text === "Trail"
          ? page([newest], 0, 1, null)
          : page([newest, second], 0, 26, 25));
      }
      if (command === "query_training_session_calendar") {
        return arguments_.request.text === "Trail"
          ? Promise.reject({ code: "training-session-calendar-failed" })
          : Promise.resolve(calendar);
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onError } = renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(within(region).getByRole("radio", { name: "Calendar" }));
    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();

    const refinements = within(region).getByRole("group", { name: "Refine sessions" });
    await user.click(within(refinements).getByText("Refine sessions"));
    const text = within(refinements).getByRole("textbox", {
      name: /^Your sport name contains/,
    });
    await user.type(text, "Trail");
    await user.click(within(refinements).getByRole("button", { name: "Apply filters" }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      "training-session-calendar-failed",
    ));
    expect(refinements).toHaveAttribute("open");
    expect(text).toHaveValue("Trail");
    expect(within(region).getByRole("heading", { name: "August 2026" })).toBeVisible();
    expect(within(region).getByRole("button", {
      name: /August 18, 2026.*1 session/,
    })).toBeVisible();
    const appliedQuery = within(region).getByRole("region", { name: "Applied refinements" });
    expect(appliedQuery).toHaveTextContent("26 matching sessions");
    expect(appliedQuery).toHaveTextContent("All sessions · newest first");
    expect(appliedQuery).not.toHaveTextContent("Sport name: Trail");
  });

  it("keeps deep session failures contextual instead of requesting duplicate shell alerts", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_session_story") {
        return Promise.reject({ code: "training-session-detail-failed" });
      }
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onError } = renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(within(region).getByRole("button", { name: /View session details for/ }));

    const alert = await within(region).findByRole("alert");
    expect(alert).toHaveClass("error");
    expect(alert).toHaveTextContent(
      "This session could not be loaded from your local library. "
      + "Try opening it again; your history has not changed.",
    );
    expect(onError).not.toHaveBeenCalledWith("training-session-detail-failed");
  });

  it("keeps exact-evidence failures beside their retryable disclosures", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_training_route_points" || command === "query_training_signal_samples") {
        return Promise.reject({ code: "training-session-detail-failed" });
      }
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        return Promise.resolve(page([newest], 0, 1, null));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const { onError } = renderPanel();

    const region = await screen.findByRole("region", { name: "Find a training session" });
    await user.click(within(region).getByRole("button", { name: /View session details for/ }));
    const detail = within(region).getByRole("heading", { name: "Session summary" })
      .closest("section");
    expect(detail).not.toBeNull();
    const detailNavigation = within(detail!).getByRole("navigation", {
      name: "Session detail",
    });

    await user.click(within(detailNavigation).getByRole("button", { name: "Routes" }));
    const exercise = await within(detail!).findByRole("heading", { name: "Exercise 1" });
    const exercisePanel = exercise.closest("article");
    expect(exercisePanel).not.toBeNull();

    await user.click(within(exercisePanel!).getByRole("button", {
      name: "Inspect exact recorded points",
    }));
    const routeAlert = await within(exercisePanel!).findByText(
      "Exact route points could not be loaded from your local library.",
    );
    expect(routeAlert).toHaveClass("error");

    await user.click(within(detailNavigation).getByRole("button", {
      name: "Signals and zones",
    }));
    const signalExercise = within(detail!).getByRole("heading", { name: "Exercise 1" })
      .closest("article");
    expect(signalExercise).not.toBeNull();
    await user.click(within(signalExercise!).getByRole("button", {
      name: "Inspect exact Heart rate samples",
    }));
    const signalAlert = await within(signalExercise!).findByText(
      "Exact signal samples could not be loaded from your local library.",
    );
    expect(signalAlert.closest("[role='alert']")).toHaveClass("error");
    expect(onError).not.toHaveBeenCalledWith("training-session-detail-failed");
  });

  it("rejects invalid draft values without querying and exercises empty and failed states", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") return Promise.resolve(page([], 0, 0, null));
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <TrainingSessionLibraryPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        onAvailableRange={vi.fn()}
        onCreateReport={vi.fn()}
        onError={onError}
      />,
    );
    expect(await screen.findByText("No sessions match these filters.")).toBeVisible();
    const searchCallsAfterLoad = mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_training_sessions",
    ).length;
    await user.type(screen.getByLabelText("From date"), "2026-08-18");
    await user.type(screen.getByLabelText("Through date"), "2025-01-01");
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(onError).toHaveBeenCalledWith("invalid-training-session-search");
    expect(screen.getByLabelText("From date")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("From date")).toHaveAttribute(
      "aria-describedby",
      "application-error",
    );
    expect(screen.getByLabelText("Through date")).toHaveAttribute("aria-invalid", "true");
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_training_sessions",
    )).toHaveLength(searchCallsAfterLoad);
    await user.type(
      screen.getByRole("textbox", { name: /^Your sport name contains/ }),
      "🏃".repeat(81),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Use 80 characters or fewer.");
    expect(screen.getByRole("alert")).toHaveClass("field-error");
    expect(screen.getByRole("button", { name: "Apply filters" })).toBeDisabled();

    unmount();
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      return Promise.reject({ code: "training-session-search-failed" });
    });
    renderPanel(onError);
    expect(await screen.findByText(
      "Training sessions could not be loaded from the local library.",
    )).toBeVisible();
    expect(onError).toHaveBeenCalledWith("training-session-search-failed");
  });

  it("keeps an empty filtered month navigable instead of replacing the calendar", async () => {
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") return Promise.resolve(page([], 0, 0, null));
      if (command === "query_training_session_calendar") {
        return Promise.resolve({ ...calendar, days: [] });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(within(region).getByText("No sessions match these filters.")).toBeVisible();

    await user.click(within(region).getByRole("radio", { name: "Calendar" }));

    expect(await within(region).findByRole("heading", { name: "August 2026" })).toBeVisible();
    expect(within(region).getByText("No matching sessions in this month.")).toBeVisible();
    expect(within(region).queryByText("No sessions match these filters.")).not.toBeInTheDocument();
  });

  it("restarts from the first page when the library snapshot changes", async () => {
    let stale = true;
    mocks.invoke.mockImplementation((command, arguments_) => {
      const workspaceResult = emptyWorkspaceCommand(command, arguments_);
      if (workspaceResult) return workspaceResult;
      if (command === "query_training_sports") return Promise.resolve(sports);
      const request = arguments_.request as TrainingSessionSearchRequest;
      if (request.offset === 25 && stale) {
        stale = false;
        return Promise.reject({ code: "training-session-search-changed" });
      }
      return Promise.resolve(page([newest, second], 0, 26, 25));
    });
    const user = userEvent.setup();
    const { onError } = renderPanel();
    await user.click(await screen.findByRole("checkbox", { name: /Add .*18.*comparison/ }));
    expect(screen.getByRole("region", { name: "Session comparison" })).toBeVisible();
    await user.click(await screen.findByRole("button", { name: "Next page" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your library changed, so results restarted from the first page.",
    );
    expect(screen.getByText("1–2 of 26 matching sessions")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Session comparison" })).not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenLastCalledWith("query_training_sessions", {
      request: {
        from: null,
        through: null,
        sportRefs: [],
        requiredMeasurements: [],
        text: null,
        sort: "started-desc",
        offset: 0,
        limit: 25,
        snapshotRef: null,
      },
    });
    expect(onError).toHaveBeenCalledWith(undefined);
  });

  it("restores filters, calendar origin, comparison, open detail, and the exact snapshot", async () => {
    const restoredWorkspace: TrainingDiscoveryWorkspace = {
      version: 1,
      snapshotRef,
      from: "2026-01-01",
      through: "2026-08-18",
      sportRefs: [sports.sports[0].sportRef!],
      requiredMeasurements: ["distance", "heart-rate"],
      text: "Trail",
      sort: "distance-desc",
      offset: 0,
      limit: 25,
      view: "calendar",
      calendarMonth: "2026-08",
      calendarDay: "2026-08-18",
      selectedSessionRefs: [second.sessionRef, newest.sessionRef],
      openSessionRef: newest.sessionRef,
    };
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "load_training_discovery_workspace") {
        return Promise.resolve(restoredWorkspace);
      }
      if (command === "save_training_discovery_workspace") {
        return Promise.resolve(arguments_.workspace);
      }
      if (command === "query_training_sports") return Promise.resolve(sports);
      if (command === "query_training_sessions") {
        const request = arguments_.request as TrainingSessionSearchRequest;
        expect(request).toEqual({
          from: "2026-08-18",
          through: "2026-08-18",
          sportRefs: [sports.sports[0].sportRef],
          requiredMeasurements: ["distance", "heart-rate"],
          text: "Trail",
          sort: "distance-desc",
          offset: 0,
          limit: 25,
          snapshotRef,
        });
        return Promise.resolve(page([newest], 0, 1, null));
      }
      if (command === "query_training_session_calendar") {
        return Promise.resolve(calendar);
      }
      if (command === "query_training_session_selection") {
        expect(arguments_).toEqual({
          request: {
            sessionRefs: [second.sessionRef, newest.sessionRef],
            snapshotRef,
          },
        });
        return Promise.resolve({ snapshotRef, sessions: [second, newest] });
      }
      if (command === "query_session_story") {
        return Promise.resolve(trainingStory(
          arguments_.query.sessionRef,
          arguments_.query.snapshotRef,
        ));
      }
      if (command === "query_training_session_segmentation") {
        return Promise.resolve(trainingSegmentation(arguments_.query.sessionRef));
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const user = userEvent.setup();
    renderPanel();
    const region = await screen.findByRole("region", { name: "Find a training session" });
    expect(within(region).getByRole("heading", { name: "Session summary" })).toBeVisible();
    const backToCalendar = within(region).getByRole("button", { name: "Back to calendar" });
    expect(backToCalendar).toBeVisible();
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "save_training_discovery_workspace",
      { workspace: restoredWorkspace },
    ));
    await user.click(backToCalendar);

    const appliedQuery = within(region).getByRole("region", { name: "Applied refinements" });
    expect(appliedQuery).toHaveTextContent("From date: January 1, 2026");
    expect(appliedQuery).toHaveTextContent("Through date: August 18, 2026");
    expect(appliedQuery).toHaveTextContent("Sport: Trail running");
    expect(appliedQuery).toHaveTextContent("Recorded measurement: Distance");
    expect(appliedQuery).toHaveTextContent("Recorded measurement: Heart rate");
    expect(appliedQuery).toHaveTextContent("Sport name: Trail");
    expect(appliedQuery).toHaveTextContent("Order: Farthest first");
    expect(within(region).getByLabelText("From date")).toHaveValue("2026-01-01");
    expect(within(region).getByLabelText("Through date")).toHaveValue("2026-08-18");
    expect(within(region).getByRole("textbox", { name: /^Your sport name contains/ }))
      .toHaveValue("Trail");
    expect(within(region).getByRole("radio", { name: "Calendar" })).toBeChecked();
    expect(within(region).getByRole("button", {
      name: /August 18, 2026.*1 session/,
    })).toHaveAttribute("aria-pressed", "true");
    expect(within(region).getByRole("region", { name: "Session comparison" }))
      .toHaveTextContent("2 sessions selected");

  });
});
