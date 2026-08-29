import { describe, expect, it } from "vitest";

import type {
  ReportDefinition,
  ReportTrainingComparisonQuery,
  ResolvedReport,
} from "./session-report";
import { reportSourceTarget } from "./report-navigation";

const digest = (character: string) => character.repeat(64);
const sessionRef = `session-${digest("1")}`;
const reportRef = `report-${digest("2")}`;
const snapshotRef = `training-snapshot-${digest("3")}`;
const plannedSnapshotRef = `planned-snapshot-${digest("8")}`;
const plannedTargetRef = `planned-target-${digest("9")}`;
const query: ReportTrainingComparisonQuery = {
  question: "training-period-comparison",
  questionVersion: 1,
  baselineRange: { from: "2026-01-01", through: "2026-01-07" },
  comparisonRange: { from: "2026-02-01", through: "2026-02-07" },
};

function definition(origin: ReportDefinition["origin"]): ReportDefinition {
  return {
    reportRef,
    title: "Review",
    locale: "en-US",
    sourceSnapshotRef: origin.kind === "planned-training" ? plannedSnapshotRef : snapshotRef,
    origin,
    provenancePolicy: "current-attribution",
    authorship: "user",
    definitionVersion: origin.kind === "planned-training" ? 5 : 4,
    revision: "1",
    blocks: origin.kind === "session"
      ? [
          {
            kind: "session-evidence",
            blockRef: `report-block-${digest("4")}`,
            sessionRef,
            includePhysiologicalContext: false,
          },
          {
            kind: "narrative",
            blockRef: `report-block-${digest("5")}`,
            body: "My interpretation",
          },
        ]
      : origin.kind === "planned-training"
        ? [{
            kind: "planned-training",
            blockRef: `report-block-${digest("8")}`,
            targetRef: plannedTargetRef,
          }]
        : [
          {
            kind: "training-finding",
            blockRef: `report-block-${digest("6")}`,
            query,
            metric: "duration",
          },
          {
            kind: "narrative",
            blockRef: `report-block-${digest("7")}`,
            body: "My interpretation",
          },
        ],
  };
}

function resolution(origin: ReportDefinition["origin"]): ResolvedReport {
  return {
    definition: definition(origin),
    resolvedSnapshotRef: origin.kind === "planned-training" ? plannedSnapshotRef : snapshotRef,
    status: "current",
    session: origin.kind === "session"
      ? {
          sessionRef,
          sourceIndex: 1,
          startedAtLocal: "2026-03-04T06:30:00",
          stoppedAtLocal: "2026-03-04T07:30:00",
          utcOffsetMinutes: 60,
          durationMilliseconds: "3600000",
          distanceMeters: 10000,
          energyKilocalories: "600",
          averageHeartRateBpm: "145",
          maximumHeartRateBpm: "172",
          exerciseCount: 1,
          sport: {
            sportRef: null,
            state: "unavailable",
            classification: null,
            recognition: null,
            recognitionCandidateCount: 0,
          },
        }
      : null,
    routes: [],
    trainingComparison: null,
    plannedTraining: origin.kind === "planned-training"
      ? {
          blockRef: `report-block-${digest("8")}`,
          target: {
            snapshotRef: plannedSnapshotRef,
            target: {
              summary: {
                targetRef: plannedTargetRef,
                sourceIndex: 1,
                reconciliationState: "current",
                targetKind: {
                  kind: "favorite-template",
                  scheduledAtLocal: null,
                  completion: null,
                },
                name: "River intervals",
                description: null,
                editability: "editable",
                mappingCoverage: { state: "complete", unmappedFieldCount: 0 },
                shape: {
                  exerciseCount: 0,
                  phaseCount: 0,
                  expandedPhaseCount: 0,
                  repeatBlockCount: 0,
                  containsIntensityEvidence: false,
                },
                relation: { state: "not-applicable", sessionRef: null, candidateCount: null },
              },
              exercises: [],
            },
          },
        }
      : null,
    provenance: origin.kind === "session"
      ? {
          kind: "session",
          current: {
            provider: "polar-flow",
            sourceModifiedAtUtc: "2026-03-04T08:00:00Z",
            sourceAdapterVersion: "polar-flow-takeout-v1",
            mappingVersion: "polar-flow-to-canonical-v1",
            contributingEventCount: 1,
            nonContributingEventCount: 0,
          },
        }
      : origin.kind === "planned-training"
        ? { kind: "planned-training-snapshot" }
        : { kind: "library-snapshot" },
    sensitiveContents: [],
    limitations: [],
    runParameters: { trainingComparison: null },
  };
}

describe("report source navigation", () => {
  it("maps a resolved session report to its exact current session", () => {
    expect(reportSourceTarget(resolution({ kind: "session", sessionRef }))).toEqual({
      kind: "session",
      reportRef,
      sessionRef,
      localDate: "2026-03-04",
    });
  });

  it("preserves the exact exploration query", () => {
    expect(reportSourceTarget(resolution({ kind: "exploration", query }))).toEqual({
      kind: "comparison",
      reportRef,
      query,
    });
  });

  it("derives a question report target from its analytical evidence", () => {
    expect(reportSourceTarget(resolution({
      kind: "question",
      question: "training-period-comparison",
      questionVersion: 1,
    }))).toEqual({ kind: "comparison", reportRef, query });
  });

  it("maps a planned-training report to its exact imported target", () => {
    expect(reportSourceTarget(resolution({
      kind: "planned-training",
      targetRef: plannedTargetRef,
    }))).toEqual({
      kind: "planned-training",
      reportRef,
      targetRef: plannedTargetRef,
    });
  });

  it("does not invent a source for blank reports or unavailable session evidence", () => {
    expect(reportSourceTarget(resolution({ kind: "blank" }))).toBeNull();
    expect(reportSourceTarget({
      ...resolution({ kind: "session", sessionRef }),
      session: null,
    })).toBeNull();
  });
});
