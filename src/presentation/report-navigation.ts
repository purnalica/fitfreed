import type {
  AnalyticalReportBlock,
  ReportTrainingComparisonQuery,
  ResolvedReport,
} from "./session-report";

export type ReportSourceTarget =
  | {
      kind: "session";
      reportRef: string;
      sessionRef: string;
      localDate: string;
    }
  | {
      kind: "comparison";
      reportRef: string;
      query: ReportTrainingComparisonQuery;
    };

function isAnalyticalBlock(block: ResolvedReport["definition"]["blocks"][number]): block is AnalyticalReportBlock {
  return block.kind === "training-finding"
    || block.kind === "training-comparison"
    || block.kind === "training-chart"
    || block.kind === "training-exact-table"
    || block.kind === "training-coverage";
}

export function reportSourceTarget(resolved: ResolvedReport): ReportSourceTarget | null {
  const { definition } = resolved;
  switch (definition.origin.kind) {
    case "session":
      if (!resolved.session || resolved.session.sessionRef !== definition.origin.sessionRef) {
        return null;
      }
      return {
        kind: "session",
        reportRef: definition.reportRef,
        sessionRef: resolved.session.sessionRef,
        localDate: resolved.session.startedAtLocal.slice(0, 10),
      };
    case "exploration":
      return {
        kind: "comparison",
        reportRef: definition.reportRef,
        query: definition.origin.query,
      };
    case "question": {
      const evidence = definition.blocks.find(isAnalyticalBlock);
      return evidence
        ? { kind: "comparison", reportRef: definition.reportRef, query: evidence.query }
        : null;
    }
    case "blank":
      return null;
  }
}
