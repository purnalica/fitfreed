import { useEffect, useRef, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import type { TrainingNavigationRequest } from "./explorer-navigation";
import type { ReportStartOrigin } from "./session-report";
import { TrainingComparisonPanel } from "./TrainingComparisonPanel";
import type { TrainingDateRange } from "./training-insights";
import { TrainingSessionLibraryPanel } from "./TrainingSessionLibraryPanel";
import type {
  SavedTrainingSportClassification,
  TrainingSportClassificationChange,
} from "./training-sports";
import { TrainingSportsPanel } from "./TrainingSportsPanel";

interface TrainingInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  navigationRequest?: TrainingNavigationRequest;
  reportReturnFocusRequest?: { kind: "session" | "comparison"; requestId: number };
  onCreateReport: (origin: ReportStartOrigin) => void;
  onError: (code: string | undefined) => void;
  onSportClassificationChange: (result: SavedTrainingSportClassification) => void;
}

type TrainingWorkspace = "sessions" | "sports" | "comparison";

function latestComparisonRange(available: TrainingDateRange): TrainingDateRange {
  const latest = new Date(`${available.through}T00:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() - 29);
  const candidate = latest.toISOString().slice(0, 10);
  return {
    from: candidate < available.from ? available.from : candidate,
    through: available.through,
  };
}

export function TrainingInsightsPanel({
  locale,
  messages,
  refreshToken,
  navigationRequest,
  reportReturnFocusRequest,
  onCreateReport,
  onError,
  onSportClassificationChange,
}: TrainingInsightsPanelProps) {
  const [availableRange, setAvailableRange] = useState<TrainingDateRange | null>(null);
  const [classificationChange, setClassificationChange]
    = useState<TrainingSportClassificationChange>();
  const classificationRequestId = useRef(0);
  const sessionNavigation = navigationRequest && "kind" in navigationRequest
    && navigationRequest.kind === "session"
    ? navigationRequest
    : undefined;
  const comparisonNavigation = navigationRequest && "kind" in navigationRequest
    && navigationRequest.kind === "comparison"
    ? navigationRequest
    : undefined;
  const [workspace, setWorkspace] = useState<TrainingWorkspace>(
    comparisonNavigation ? "comparison" : "sessions",
  );
  const initialDate = sessionNavigation?.localDate
    ?? (navigationRequest && !("kind" in navigationRequest)
      ? navigationRequest.localDate
      : undefined);

  useEffect(() => {
    if (comparisonNavigation || reportReturnFocusRequest?.kind === "comparison") {
      setWorkspace("comparison");
    } else if (sessionNavigation || reportReturnFocusRequest?.kind === "session") {
      setWorkspace("sessions");
    }
  }, [
    comparisonNavigation?.requestId,
    reportReturnFocusRequest?.kind,
    reportReturnFocusRequest?.requestId,
    sessionNavigation?.requestId,
  ]);

  const workspaces = ["sessions", "sports", "comparison"] as const;

  function publishClassification(
    source: TrainingSportClassificationChange["source"],
    result: SavedTrainingSportClassification,
  ) {
    classificationRequestId.current += 1;
    setClassificationChange({
      requestId: classificationRequestId.current,
      source,
      result,
    });
    onSportClassificationChange(result);
  }

  return (
    <section className="training-insights" aria-labelledby="training-heading">
      <header className="training-workspace-heading">
        <p className="eyebrow">{messages.training.workspaceEyebrow}</p>
        <h1 id="training-heading">{messages.training.heading}</h1>
        <p>{messages.training.workspaceIntro}</p>
      </header>
      <nav
        className="training-workspace-navigation"
        aria-label={messages.training.workspaceNavigation}
      >
        {workspaces.map((destination) => (
          <button
            key={destination}
            type="button"
            aria-current={workspace === destination ? "page" : undefined}
            disabled={destination === "comparison" && availableRange === null}
            onClick={() => setWorkspace(destination)}
          >
            {messages.training.workspaces[destination]}
          </button>
        ))}
      </nav>
      <div className="training-workspace-panel" hidden={workspace !== "sessions"}>
        <TrainingSessionLibraryPanel
          locale={locale}
          messages={messages}
          refreshToken={refreshToken}
          classificationChange={classificationChange}
          initialDate={initialDate}
          initialSessionRef={sessionNavigation?.sessionRef}
          navigationRequestId={sessionNavigation?.requestId}
          createReportFocusRequestId={reportReturnFocusRequest?.kind === "session"
            ? reportReturnFocusRequest.requestId
            : undefined}
          onAvailableRange={setAvailableRange}
          onCreateReport={onCreateReport}
          onError={onError}
          onSportClassificationChange={(result) => publishClassification("sessions", result)}
        />
      </div>
      <div className="training-workspace-panel" hidden={workspace !== "sports"}>
        <TrainingSportsPanel
          locale={locale}
          messages={messages}
          refreshToken={refreshToken}
          classificationChange={classificationChange}
          onError={onError}
          onChange={(result) => publishClassification("sports", result)}
        />
      </div>
      <div className="training-workspace-panel" hidden={workspace !== "comparison"}>
        {availableRange && (
          <TrainingComparisonPanel
            key={`${availableRange.from}:${availableRange.through}:${comparisonNavigation?.requestId ?? "default"}`}
            availableRange={availableRange}
            initialRange={latestComparisonRange(availableRange)}
            initialQuery={comparisonNavigation?.query}
            navigationRequestId={comparisonNavigation?.requestId}
            createReportFocusRequestId={reportReturnFocusRequest?.kind === "comparison"
              ? reportReturnFocusRequest.requestId
              : undefined}
            locale={locale}
            messages={messages}
            onCreateReport={(query) => onCreateReport({ kind: "exploration", query })}
            onError={onError}
          />
        )}
      </div>
    </section>
  );
}
