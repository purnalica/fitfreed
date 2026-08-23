import { useEffect, useMemo, useState } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import { steppedInputValueForKey } from "./keyboard-key";
import type {
  SessionStory,
  SessionStoryMetric,
  SessionStoryOverlay,
} from "./session-story";
import {
  formatSessionStoryMetricValue,
  transformSessionStoryValue,
} from "./session-story-metric";
import {
  elapsedEditorValue,
  parseElapsedEditorValue,
} from "./training-range-editor-model";
import { formatTrainingRangeChoice } from "./training-range-choice";
import { TrainingRangeEditor } from "./TrainingRangeEditor";
import { useOptionalTrainingRangeInteraction } from "./TrainingRangeInteractionProvider";
import { formatDuration } from "./training-format";
import type {
  TrainingSignalRole,
  TrainingSignalSeriesOverview,
  TrainingSignalVisualSample,
} from "./training-session-signal";
import {
  TrainingSignalPlot,
  type TrainingSignalPlotRangeSelection,
} from "./TrainingSignalPlot";

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
  exerciseRef: string;
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
        exerciseRef: exercise.exerciseRef,
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

function distinctElapsedSampleIndexes(samples: TrainingSignalVisualSample[]): number[] {
  const elapsed = new Set<string>();
  return samples.flatMap((sample, sampleIndex) => {
    if (elapsed.has(sample.elapsedMilliseconds)) return [];
    elapsed.add(sample.elapsedMilliseconds);
    return [sampleIndex];
  });
}

function sampleIndexAtExactElapsed(
  samples: TrainingSignalVisualSample[],
  elapsedMilliseconds: string | undefined,
): number | null {
  if (elapsedMilliseconds === undefined) return null;
  const sampleIndex = samples.findIndex(
    (sample) => sample.elapsedMilliseconds === elapsedMilliseconds,
  );
  return sampleIndex < 0 ? null : sampleIndex;
}

function signalDraftBounds(
  samples: TrainingSignalVisualSample[],
  selectedSampleIndex: number,
): { startedAtElapsedMilliseconds: string; endedAtElapsedMilliseconds: string } | null {
  const selected = samples[selectedSampleIndex]?.elapsedMilliseconds;
  if (selected === undefined) return null;
  const indexes = distinctElapsedSampleIndexes(samples);
  const selectedElapsed = BigInt(selected);
  const following = indexes.find((sampleIndex) => (
    BigInt(samples[sampleIndex].elapsedMilliseconds) > selectedElapsed
  ));
  if (following !== undefined) {
    return {
      startedAtElapsedMilliseconds: selected,
      endedAtElapsedMilliseconds: samples[following].elapsedMilliseconds,
    };
  }
  const preceding = [...indexes].reverse().find((sampleIndex) => (
    BigInt(samples[sampleIndex].elapsedMilliseconds) < selectedElapsed
  ));
  return preceding === undefined ? null : {
    startedAtElapsedMilliseconds: samples[preceding].elapsedMilliseconds,
    endedAtElapsedMilliseconds: selected,
  };
}

export function TrainingSignalWorkbench({
  story,
  locale,
  messages,
  onOpenExactSignal,
}: TrainingSignalWorkbenchProps) {
  const rangeInteraction = useOptionalTrainingRangeInteraction();
  const choices = useMemo(() => signalChoices(story), [story]);
  const signature = choices.map((choice) => choice.key).join("|");
  const [choiceKey, setChoiceKey] = useState(() => choices[0]?.key ?? "");
  const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
  const choice = choices.find((candidate) => candidate.key === choiceKey) ?? choices[0];
  const copy = messages.training.sessionLibrary.signalWorkbench;
  const sessionCopy = messages.training.sessionLibrary;
  const metricCopy = sessionCopy.routeWorkbench.metrics;
  const metricUnits = sessionCopy.routeWorkbench.metricUnits;
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  useEffect(() => {
    setChoiceKey(choices[0]?.key ?? "");
    setSelectedSampleIndex(0);
  }, [signature]);

  useEffect(() => {
    setSelectedSampleIndex((current) => Math.max(
      0,
      Math.min((choice?.signal.visualSamples.length ?? 1) - 1, current),
    ));
  }, [choice?.key, story.snapshotRef]);

  if (!choice) return null;

  const samples = transformedSamples(choice);
  const selectedSample = samples[selectedSampleIndex];
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
  const signalEditor = rangeInteraction?.editor?.surface === "signal"
    && rangeInteraction.editor.exerciseRef === choice.exerciseRef
    && rangeInteraction.editor.coordinate?.scope === "signal-elapsed"
    && rangeInteraction.editor.coordinate.signalRef === choice.signal.signalRef
    ? rangeInteraction.editor
    : undefined;
  const signalRanges = rangeInteraction?.result?.ranges.filter((range) => (
    range.exerciseRef === choice.exerciseRef
    && range.coordinate.scope === "signal-elapsed"
    && range.coordinate.signalRef === choice.signal.signalRef
  )) ?? [];
  const selectedSignalRange = signalRanges.find(
    (range) => range.rangeRef === rangeInteraction?.selectedRange?.rangeRef,
  );
  const rangeStartedAt = signalEditor
    ? parseElapsedEditorValue(signalEditor.startedAt)
    : selectedSignalRange?.startedAtElapsedMilliseconds;
  const rangeEndedAt = signalEditor
    ? parseElapsedEditorValue(signalEditor.endedAt)
    : selectedSignalRange?.endedAtElapsedMilliseconds;
  const startedAtSampleIndex = sampleIndexAtExactElapsed(samples, rangeStartedAt);
  const endedAtSampleIndex = sampleIndexAtExactElapsed(samples, rangeEndedAt);
  const rangeSelection: TrainingSignalPlotRangeSelection | null = rangeStartedAt !== undefined
    || rangeEndedAt !== undefined
    ? {
        startedAtSampleOrdinal: startedAtSampleIndex === null
          ? null
          : samples[startedAtSampleIndex].ordinal,
        endedAtSampleOrdinal: endedAtSampleIndex === null
          ? null
          : samples[endedAtSampleIndex].ordinal,
      }
    : null;
  const elapsedSampleIndexes = distinctElapsedSampleIndexes(samples);
  const startedAtHandle = startedAtSampleIndex === null
    ? -1
    : elapsedSampleIndexes.indexOf(startedAtSampleIndex);
  const endedAtHandle = endedAtSampleIndex === null
    ? -1
    : elapsedSampleIndexes.indexOf(endedAtSampleIndex);
  const draftBounds = signalDraftBounds(samples, selectedSampleIndex);
  const signalCoordinateAvailable = rangeInteraction?.editableChoices.some((exercise) => (
    exercise.exerciseRef === choice.exerciseRef
    && exercise.coordinates.some((coordinate) => (
      coordinate.coordinate.scope === "signal-elapsed"
      && coordinate.coordinate.signalRef === choice.signal.signalRef
    ))
  )) ?? false;

  function samplePosition(sampleIndex: number): string {
    const sample = samples[sampleIndex];
    return interpolate(copy.samplePosition, {
      sample: number.format(sample.ordinal + 1),
      total: number.format(choice.signal.sampleCount),
    });
  }

  function sampleControlValue(sampleIndex: number): string {
    return `${samplePosition(sampleIndex)} · ${formatDuration(
      samples[sampleIndex].elapsedMilliseconds,
      locale,
      messages.training.durationUnits,
    )}`;
  }

  function selectedValue(): string {
    if (!selectedSample || selectedSample.value === null) return copy.sampleWithoutValue;
    return formatSessionStoryMetricValue(
      metric,
      selectedSample.value,
      locale,
      metricUnits[metric],
    );
  }

  function updateSignalBoundary(boundary: "start" | "end", sampleIndex: number) {
    const elapsedMilliseconds = samples[sampleIndex]?.elapsedMilliseconds;
    if (!signalEditor || elapsedMilliseconds === undefined) return;
    rangeInteraction?.updateEditor(boundary === "start"
      ? { startedAt: elapsedEditorValue(elapsedMilliseconds) }
      : { endedAt: elapsedEditorValue(elapsedMilliseconds) });
  }

  function openSignalRange() {
    if (!rangeInteraction || !draftBounds) return;
    rangeInteraction.openCreateEditor("signal", {
      exerciseRef: choice.exerciseRef,
      coordinate: { scope: "signal-elapsed", signalRef: choice.signal.signalRef },
      ...draftBounds,
    });
  }

  function signalRangeWorkspace() {
    if (!rangeInteraction) return null;
    const editorElsewhere = rangeInteraction.editor !== undefined && signalEditor === undefined;
    return (
      <aside className="training-signal-range-inspector" aria-label={copy.rangeRegion}>
        <header>
          <p className="eyebrow">{copy.rangeEyebrow}</p>
          <h4>{copy.rangeHeading}</h4>
          <p>{copy.rangeIntroduction}</p>
        </header>
        {rangeInteraction.loading && <p role="status">{copy.rangeLoading}</p>}
        {rangeInteraction.failed && !rangeInteraction.loading && (
          <div className="training-signal-range-failed">
            <p>{copy.rangeFailed}</p>
            <button type="button" className="secondary" onClick={() => void rangeInteraction.reload()}>
              {copy.rangeRetry}
            </button>
          </div>
        )}
        {!rangeInteraction.loading && !rangeInteraction.failed
          && (signalRanges.length > 1 || (signalRanges.length === 1 && !selectedSignalRange)) && (
          <label className="training-signal-saved-range-choice">
            <span>{copy.savedRange}</span>
            <select
              value={selectedSignalRange?.rangeRef ?? ""}
              disabled={rangeInteraction.busy || rangeInteraction.editor !== undefined}
              onChange={(event) => rangeInteraction.selectRange(event.target.value)}
            >
              <option value="">{copy.chooseSavedRange}</option>
              {signalRanges.map((range) => (
                <option key={range.rangeRef} value={range.rangeRef}>
                  {formatTrainingRangeChoice(range)}
                </option>
              ))}
            </select>
          </label>
        )}
        {!signalEditor && selectedSignalRange && (
          <div className="training-signal-saved-range">
            <span>{copy.visibleSavedRange}</span>
            <strong>{selectedSignalRange.title}</strong>
            <small>{formatDuration(
              (BigInt(selectedSignalRange.endedAtElapsedMilliseconds)
                - BigInt(selectedSignalRange.startedAtElapsedMilliseconds)).toString(),
              locale,
              messages.training.durationUnits,
            )}</small>
            {rangeInteraction.mayAdjust(selectedSignalRange) && (
              <button
                type="button"
                className="secondary"
                disabled={rangeInteraction.busy || editorElsewhere}
                onClick={() => rangeInteraction.openAdjustEditor(selectedSignalRange, "signal")}
              >{copy.adjustRange}</button>
            )}
          </div>
        )}
        {!signalEditor && !rangeInteraction.loading && !rangeInteraction.failed && (
          <>
            <button
              type="button"
              disabled={rangeInteraction.busy || editorElsewhere || !signalCoordinateAvailable
                || draftBounds === null}
              onClick={openSignalRange}
            >{copy.createRangeHere}</button>
            {editorElsewhere && <p className="training-signal-range-note">{copy.finishCurrentEdit}</p>}
            {!signalCoordinateAvailable && (
              <p className="training-signal-range-note">{copy.rangeUnavailable}</p>
            )}
          </>
        )}
        {signalEditor && (
          <>
            <div className="training-signal-range-handles">
              <p>{copy.rangeHandleInstructions}</p>
              {startedAtHandle >= 0 ? (
                <label>
                  <span>{copy.rangeStartHandle}</span>
                  <input
                    type="range"
                    min="0"
                    max={elapsedSampleIndexes.length - 1}
                    step="1"
                    value={startedAtHandle}
                    aria-valuetext={sampleControlValue(elapsedSampleIndexes[startedAtHandle])}
                    onKeyDown={(event) => {
                      const next = steppedInputValueForKey(
                        event.key,
                        startedAtHandle,
                        0,
                        elapsedSampleIndexes.length - 1,
                      );
                      if (next === null) return;
                      event.preventDefault();
                      updateSignalBoundary("start", elapsedSampleIndexes[next]);
                    }}
                    onChange={(event) => updateSignalBoundary(
                      "start",
                      elapsedSampleIndexes[Number(event.target.value)],
                    )}
                  />
                </label>
              ) : <p className="training-signal-range-note">{copy.startOutsideProjection}</p>}
              {endedAtHandle >= 0 ? (
                <label>
                  <span>{copy.rangeEndHandle}</span>
                  <input
                    type="range"
                    min="0"
                    max={elapsedSampleIndexes.length - 1}
                    step="1"
                    value={endedAtHandle}
                    aria-valuetext={sampleControlValue(elapsedSampleIndexes[endedAtHandle])}
                    onKeyDown={(event) => {
                      const next = steppedInputValueForKey(
                        event.key,
                        endedAtHandle,
                        0,
                        elapsedSampleIndexes.length - 1,
                      );
                      if (next === null) return;
                      event.preventDefault();
                      updateSignalBoundary("end", elapsedSampleIndexes[next]);
                    }}
                    onChange={(event) => updateSignalBoundary(
                      "end",
                      elapsedSampleIndexes[Number(event.target.value)],
                    )}
                  />
                </label>
              ) : <p className="training-signal-range-note">{copy.endOutsideProjection}</p>}
            </div>
            <TrainingRangeEditor surface="signal" messages={messages} lockCoordinate />
          </>
        )}
        {rangeInteraction.status && <p className="training-signal-range-status" role="status">
          {rangeInteraction.status}
        </p>}
      </aside>
    );
  }

  function selectChoice(nextKey: string) {
    setChoiceKey(nextKey);
    setSelectedSampleIndex(0);
  }

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
            <select
              value={choice.key}
              disabled={rangeInteraction?.editor !== undefined}
              onChange={(event) => selectChoice(event.target.value)}
            >
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
      <div
        className="training-signal-range-layout"
        data-has-range={rangeInteraction ? "true" : "false"}
      >
        <div className="training-signal-visual">
          <div className="training-signal-workbench-plot">
            <TrainingSignalPlot
              samples={samples}
              summary={chartSummary}
              sampleCount={choice.signal.sampleCount}
              emptyMessage={sessionCopy.signalEmpty}
              noRecordedValuesMessage={sessionCopy.signalNoRecordedValues}
              lowerValuesAtTop={metric === "pace"}
              selectedSampleOrdinal={selectedSample?.ordinal}
              rangeSelection={rangeSelection}
            />
          </div>
          {selectedSample && (
            <>
              <label className="training-signal-position-control">
                <span>{copy.recordedSamplePosition}</span>
                <input
                  type="range"
                  min="0"
                  max={samples.length - 1}
                  step="1"
                  value={selectedSampleIndex}
                  aria-valuetext={sampleControlValue(selectedSampleIndex)}
                  onChange={(event) => setSelectedSampleIndex(Number(event.target.value))}
                />
              </label>
              <div className="training-signal-selection" aria-live="polite">
                <div>
                  <strong>{samplePosition(selectedSampleIndex)}</strong>
                  <span>{formatDuration(
                    selectedSample.elapsedMilliseconds,
                    locale,
                    messages.training.durationUnits,
                  )}</span>
                </div>
                <p><span>{metricLabel}</span><strong>{selectedValue()}</strong></p>
              </div>
            </>
          )}
        </div>
        {signalRangeWorkspace()}
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
            selectedSample?.ordinal ?? null,
            event.currentTarget,
          )}
        >
          {interpolate(copy.exactSignal, { signal: sourceLabel })}
        </button>
      </footer>
    </section>
  );
}
