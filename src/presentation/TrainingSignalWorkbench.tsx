import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import type {
  SessionStory,
  SessionStoryMetric,
  SessionStoryOverlay,
} from "./session-story";
import { transformSessionStoryValue } from "./session-story-metric";
import { formatDuration } from "./training-format";
import type {
  TrainingSignalRole,
  TrainingSignalSeriesOverview,
  TrainingSignalVisualSample,
} from "./training-session-signal";
import { TrainingSignalPlot } from "./TrainingSignalPlot";

interface TrainingSignalWorkbenchProps {
  story: SessionStory;
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
  onOpenExactSignal: (
    signalRef: string,
    sampleOrdinal: number | null,
    initiatingElement: HTMLButtonElement,
  ) => void;
}

interface SignalChoice {
  key: string;
  exerciseOrdinal: number;
  role: TrainingSignalRole;
  signal: TrainingSignalSeriesOverview;
  overlay: SessionStoryOverlay;
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

function signalChoices(story: SessionStory): SignalChoice[] {
  return story.exercises.flatMap((exercise) => (["primary", "transition"] as const).flatMap(
    (role) => exercise[role].eligibleOverlays.flatMap((overlay) => {
      const signal = exercise[role].signals.find(
        (candidate) => candidate.signalRef === overlay.signalRef
          && candidate.availableSampleCount > 0,
      );
      return signal ? [{
        key: `${exercise.ordinal}:${role}:${signal.signalRef}`,
        exerciseOrdinal: exercise.ordinal,
        role,
        signal,
        overlay,
      }] : [];
    }),
  ));
}

function transformedSamples(choice: SignalChoice): TrainingSignalVisualSample[] {
  return choice.signal.visualSamples.map((sample) => ({
    ...sample,
    value: transformSessionStoryValue(choice.overlay.valueTransform, sample.value),
  }));
}

export function TrainingSignalWorkbench({
  story,
  locale,
  messages,
  onOpenExactSignal,
}: TrainingSignalWorkbenchProps) {
  const choices = useMemo(() => signalChoices(story), [story]);
  const signature = choices.map((choice) => choice.key).join("|");
  const [choiceKey, setChoiceKey] = useState(() => choices[0]?.key ?? "");
  const choice = choices.find((candidate) => candidate.key === choiceKey) ?? choices[0];
  const copy = messages.training.sessionLibrary.signalWorkbench;
  const sessionCopy = messages.training.sessionLibrary;
  const metricCopy = sessionCopy.routeWorkbench.metrics;
  const metricUnits = sessionCopy.routeWorkbench.metricUnits;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    setChoiceKey(choices[0]?.key ?? "");
  }, [signature]);

  if (!choice) return null;

  const samples = transformedSamples(choice);
  const availableSampleCount = choice.signal.availableSampleCount;
  const metric = choice.overlay.metric as SessionStoryMetric;
  const metricLabel = metricCopy[metric];
  const sourceLabel = sessionCopy.signalKinds[choice.signal.kind];
  const chartSummary = interpolate(copy.chartSummary, {
    metric: metricLabel,
    available: number.format(availableSampleCount),
    total: number.format(choice.signal.sampleCount),
    unit: metricUnits[metric],
  });
  const roleLabel = choice.role === "primary" ? copy.primaryRole : copy.transitionRole;
  const choiceLabel = interpolate(copy.choice, {
    metric: metricLabel,
    exercise: number.format(choice.exerciseOrdinal + 1),
    role: roleLabel,
  });

  return (
    <section
      className="training-signal-workbench"
      role="region"
      aria-label={copy.regionLabel}
    >
      <header className={`training-signal-workbench-heading${
        choices.length === 1 ? " training-signal-workbench-heading-single" : ""
      }`}>
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h3>{interpolate(copy.heading, {
            metric: metricLabel.toLocaleLowerCase(locale),
          })}</h3>
          <p>{copy.introduction}</p>
        </div>
        {choices.length > 1 && (
          <label>
            <span>{copy.visibleSignal}</span>
            <select value={choice.key} onChange={(event) => setChoiceKey(event.target.value)}>
              {choices.map((candidate) => {
                const candidateMetric = metricCopy[candidate.overlay.metric];
                return (
                  <option key={candidate.key} value={candidate.key}>
                    {interpolate(copy.choice, {
                      metric: candidateMetric,
                      exercise: number.format(candidate.exerciseOrdinal + 1),
                      role: candidate.role === "primary"
                        ? copy.primaryRole
                        : copy.transitionRole,
                    })}
                  </option>
                );
              })}
            </select>
          </label>
        )}
      </header>
      <div className="training-signal-workbench-plot">
        <TrainingSignalPlot
          samples={samples}
          summary={chartSummary}
          sampleCount={choice.signal.sampleCount}
          emptyMessage={sessionCopy.signalEmpty}
          noRecordedValuesMessage={sessionCopy.signalNoRecordedValues}
          lowerValuesAtTop={metric === "pace"}
        />
      </div>
      <div role="group" aria-label={choiceLabel}>
        <dl>
          <div>
            <dt>{copy.coverage}</dt>
            <dd>{number.format(availableSampleCount)} {messages.training.of} {number.format(choice.signal.sampleCount)}</dd>
          </div>
          <div>
            <dt>{copy.interval}</dt>
            <dd>{formatDuration(
              choice.signal.intervalMilliseconds,
              locale,
              messages.training.durationUnits,
            )}</dd>
          </div>
          <div>
            <dt>{copy.source}</dt>
            <dd>{interpolate(copy.sourceSeries, { signal: sourceLabel })}</dd>
          </div>
        </dl>
      </div>
      <footer>
        <p>{copy.projection}</p>
        <button
          type="button"
          className="secondary"
          onClick={(event) => onOpenExactSignal(
            choice.signal.signalRef,
            null,
            event.currentTarget,
          )}
        >
          {interpolate(copy.exactSignal, { signal: sourceLabel })}
        </button>
      </footer>
    </section>
  );
}
