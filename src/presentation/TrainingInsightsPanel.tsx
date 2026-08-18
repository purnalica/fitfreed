import { useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import type { ExplorerNavigationRequest } from "./explorer-navigation";
import { TrainingComparisonPanel } from "./TrainingComparisonPanel";
import type { TrainingDateRange } from "./training-insights";
import { TrainingSessionLibraryPanel } from "./TrainingSessionLibraryPanel";
import { TrainingSportsPanel } from "./TrainingSportsPanel";

interface TrainingInsightsPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  refreshToken: number;
  navigationRequest?: ExplorerNavigationRequest;
  onError: (code: string | undefined) => void;
}

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
  onError,
}: TrainingInsightsPanelProps) {
  const [availableRange, setAvailableRange] = useState<TrainingDateRange | null>(null);
  const [classificationRevision, setClassificationRevision] = useState(0);

  return (
    <section className="training-insights" aria-labelledby="training-heading">
      <h1 id="training-heading">{messages.training.heading}</h1>
      <TrainingSessionLibraryPanel
        locale={locale}
        messages={messages}
        refreshToken={refreshToken + classificationRevision}
        initialDate={navigationRequest?.localDate}
        onAvailableRange={setAvailableRange}
        onError={onError}
      />
      <TrainingSportsPanel
        locale={locale}
        messages={messages}
        refreshToken={refreshToken}
        onError={onError}
        onChange={() => setClassificationRevision((revision) => revision + 1)}
      />
      {availableRange && (
        <TrainingComparisonPanel
          key={`${availableRange.from}:${availableRange.through}`}
          availableRange={availableRange}
          initialRange={latestComparisonRange(availableRange)}
          locale={locale}
          messages={messages}
          onError={onError}
        />
      )}
    </section>
  );
}
