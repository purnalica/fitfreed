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
    sourceSnapshotRef: snapshotRef,
    origin,
    provenancePolicy: "current-attribution",
    authorship: "user",
    definitionVersion: 4,
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
    resolvedSnapshotRef: snapshotRef,
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
          sport: { sportRef: null, state: "unavailable", classification: null },
        }
      : null,
    routes: [],
    trainingComparison: null,
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
      : { kind: "library-snapshot" },
    sensitiveContents: [],
    limitations: [],
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

  it("does not invent a source for blank reports or unavailable session evidence", () => {
    expect(reportSourceTarget(resolution({ kind: "blank" }))).toBeNull();
    expect(reportSourceTarget({
      ...resolution({ kind: "session", sessionRef }),
      session: null,
    })).toBeNull();
  });
});
