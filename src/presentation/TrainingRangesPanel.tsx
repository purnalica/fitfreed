import { useMemo } from "react";

import { type catalogs, type Locale } from "../locales/catalogs";
import {
  elapsedEditorValue,
} from "./training-range-editor-model";
import { formatDuration, formatSessionCardDistance } from "./training-format";
import type {
  TrainingRangeBoundaryState,
  TrainingRangeSummaryLimitation,
  TrainingSessionRange,
} from "./training-session-range";
import { TrainingRangeEditor } from "./TrainingRangeEditor";
import { useTrainingRangeInteraction } from "./TrainingRangeInteractionProvider";
import { useResultFocus } from "./useResultFocus";

interface TrainingRangesPanelProps {
  locale: Locale;
  messages: (typeof catalogs)["en-US"];
}

function interpolate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(value),
    template,
  );
}

export function TrainingRangesPanel({
  locale,
  messages,
}: TrainingRangesPanelProps) {
  const {
    result,
    loading,
    failed,
    selectedRange,
    summary,
    summaryLoading,
    summaryFailed,
    editor,
    editableChoices,
    mutationCommand,
    busy,
    removeConfirmation,
    status,
    selectRange,
    openCreateEditor,
    openRenameEditor,
    openAdjustEditor,
    requestRemoveConfirmation,
    cancelRemoveConfirmation,
    removeRange,
    reload,
    retrySummary,
    rangeCoordinateLabel,
    mayAdjust,
  } = useTrainingRangeInteraction();
  const {
    resultHeadingRef: selectedHeadingRef,
    requestResultFocus: requestSelectedRangeFocus,
  } = useResultFocus<HTMLHeadingElement>(selectedRange !== undefined);
  const copy = messages.training.sessionLibrary.ranges;
  const number = useMemo(() => new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }), [locale]);
  const summaryNumber = useMemo(() => new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }), [locale]);
  const integer = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  function boundaryStatement(position: "start" | "end", state: TrainingRangeBoundaryState) {
    if (position === "start") {
      if (state === "exact") return copy.startExact;
      if (state === "between-evidence") return copy.startBetween;
      if (state === "outside-recorded-evidence") return copy.startOutside;
      return copy.startWithoutEvidence;
    }
    if (state === "exact") return copy.endExact;
    if (state === "between-evidence") return copy.endBetween;
    if (state === "outside-recorded-evidence") return copy.endOutside;
    return copy.endWithoutEvidence;
  }

  function limitationText(limitation: TrainingRangeSummaryLimitation): string {
    return copy.limitations[limitation];
  }

  function rangeSummary() {
    if (summaryLoading) return <p role="status">{copy.summaryLoading}</p>;
    if (summaryFailed) return (
      <div className="training-range-summary-failed">
        <p>{copy.summaryFailed}</p>
        <button type="button" className="secondary" onClick={retrySummary}>
          {copy.summaryRetry}
        </button>
      </div>
    );
    if (!summary) return null;
    const metric = summary.measurements[0];
    const boundaryLimitations = new Set<TrainingRangeSummaryLimitation>(["boundary-not-exact"]);
    return (
      <div className="training-range-result">
        <dl className="training-range-result-summary">
          <div>
            <dt>{copy.duration}</dt>
            <dd>{formatDuration(
              summary.elapsedDurationMilliseconds,
              locale,
              messages.training.durationUnits,
            )}</dd>
          </div>
          {summary.distance && (
            <div>
              <dt>{copy.distance}</dt>
              <dd>{formatSessionCardDistance(
                summary.distance.meters,
                locale,
                messages.training.units,
              )}</dd>
            </div>
          )}
          {summary.direction && (
            <div>
              <dt>{copy.direction}</dt>
              <dd>{interpolate(copy.directionValue, {
                cardinal: copy.directions[summary.direction.cardinal],
                degrees: summaryNumber.format(summary.direction.initialBearingDegrees),
              })}</dd>
            </div>
          )}
          {metric && (
            <div>
              <dt>{interpolate(copy.measurementName, {
                signal: messages.training.sessionLibrary.signalKinds[metric.kind],
              })}</dt>
              <dd>{interpolate(copy.measurementAverage, {
                value: summaryNumber.format(metric.average),
                unit: messages.training.sessionLibrary.signalUnits[metric.unit],
              })}</dd>
            </div>
          )}
          <div>
            <dt>{copy.coverage}</dt>
            <dd>{copy.coverageStates[summary.coverage.state]}</dd>
          </div>
        </dl>
        <details className="training-range-evidence-details">
          <summary>{copy.evidenceDetails}</summary>
          <section>
            <h5>{copy.coverageHeading}</h5>
            <p>{interpolate(copy.coverageCounts, {
              available: integer.format(summary.coverage.availableEvidenceCount),
              selected: integer.format(summary.coverage.selectedEvidenceCount),
            })}</p>
            {summary.coverage.missingIntervals.length > 0 && (
              <ul>{summary.coverage.missingIntervals.map((gap) => (
                <li key={`${gap.startedAtElapsedMilliseconds}-${gap.endedAtElapsedMilliseconds}`}>
                  {interpolate(copy.coverageGap, {
                    start: elapsedEditorValue(gap.startedAtElapsedMilliseconds),
                    end: elapsedEditorValue(gap.endedAtElapsedMilliseconds),
                  })}
                </li>
              ))}</ul>
            )}
            {summary.coverage.missingElapsedEvidenceCount > 0 && (
              <p>{interpolate(copy.coverageMissingElapsed, {
                count: integer.format(summary.coverage.missingElapsedEvidenceCount),
              })}</p>
            )}
            {summary.coverage.omittedMissingIntervalCount > 0 && (
              <p>{interpolate(copy.coverageOmittedGaps, {
                count: integer.format(summary.coverage.omittedMissingIntervalCount),
              })}</p>
            )}
          </section>
          <section>
            <h5>{copy.boundariesHeading}</h5>
            <ul>
              <li>{boundaryStatement("start", summary.boundaries.start.state)}</li>
              <li>{boundaryStatement("end", summary.boundaries.end.state)}</li>
            </ul>
          </section>
          {summary.measurements.length > 0 && (
            <section>
              <h5>{copy.measurementsHeading}</h5>
              {summary.measurements.map((measurement) => {
                const signal = messages.training.sessionLibrary.signalKinds[measurement.kind];
                const unit = messages.training.sessionLibrary.signalUnits[measurement.unit];
                return (
                  <div key={`${measurement.kind}-${measurement.unit}`}>
                    <p>{interpolate(copy.measurementDetail, {
                      signal,
                      minimum: number.format(measurement.minimum),
                      average: number.format(measurement.average),
                      maximum: number.format(measurement.maximum),
                      unit,
                    })}</p>
                    <p>{interpolate(copy.measurementCoverage, {
                      available: interpolate(
                        measurement.availableEvidenceCount === 1
                          ? copy.measurementAvailable.one
                          : copy.measurementAvailable.other,
                        { count: integer.format(measurement.availableEvidenceCount) },
                      ),
                      missing: interpolate(
                        measurement.missingEvidenceCount === 1
                          ? copy.measurementMissing.one
                          : copy.measurementMissing.other,
                        { count: integer.format(measurement.missingEvidenceCount) },
                      ),
                    })}</p>
                  </div>
                );
              })}
            </section>
          )}
          <section>
            <h5>{copy.sourceRangesHeading}</h5>
            {summary.sourceRanges.length === 0 ? <p>{copy.noSourceRanges}</p> : (
              <ul>{summary.sourceRanges.map((source) => {
                const timing = interpolate(copy.sourceRangeTiming, {
                  relation: copy.sourceRangeRelations[source.relation],
                  start: elapsedEditorValue(source.startedAtElapsedMilliseconds),
                  end: elapsedEditorValue(source.endedAtElapsedMilliseconds),
                });
                const distance = source.distanceMeters === null ? undefined
                  : interpolate(copy.sourceDistance, {
                    distance: formatSessionCardDistance(
                      source.distanceMeters,
                      locale,
                      messages.training.units,
                    ),
                  });
                return (
                  <li key={`${source.kind}-${source.ordinal}`}>
                    <strong>{interpolate(
                      source.kind === "manual-lap" ? copy.sourceLap : copy.automaticLap,
                      { number: integer.format(source.ordinal + 1) },
                    )}</strong>
                    <span>{distance ? `${timing} · ${distance}` : timing}</span>
                  </li>
                );
              })}</ul>
            )}
          </section>
          {summary.limitations.some((limitation) => !boundaryLimitations.has(limitation)) && (
            <section>
              <h5>{copy.limitsHeading}</h5>
              <ul>{summary.limitations
                .filter((limitation) => !boundaryLimitations.has(limitation))
                .map((limitation) => <li key={limitation}>{limitationText(limitation)}</li>)}</ul>
            </section>
          )}
        </details>
      </div>
    );
  }

  function selectedRangePanel(range: TrainingSessionRange) {
    const canAdjust = mayAdjust(range);
    const duration = (BigInt(range.endedAtElapsedMilliseconds)
      - BigInt(range.startedAtElapsedMilliseconds)).toString();
    return (
      <article className="training-range-inspector">
        <header>
          <div>
            <p>{copy.createdByYou}</p>
            <h4
              ref={selectedHeadingRef}
              className="training-result-focus-target"
              tabIndex={-1}
            >{range.title}</h4>
            <span>{rangeCoordinateLabel(range)} · {formatDuration(
              duration,
              locale,
              messages.training.durationUnits,
            )}</span>
          </div>
          <span className={range.state === "current" ? "current" : "review-required"}>
            {range.state === "current" ? copy.current : copy.reviewRequired}
          </span>
        </header>
        {range.state === "review-required" && (
          <aside className="training-range-review">
            <strong>{copy.reviewHeading}</strong>
            <p>{canAdjust ? copy.reviewHelp : copy.missingCoordinate}</p>
            {!canAdjust && <p>{copy.missingCoordinateHelp}</p>}
          </aside>
        )}
        {editor?.rangeRef === range.rangeRef ? (
          <TrainingRangeEditor
            surface="library"
            messages={messages}
            onSaved={requestSelectedRangeFocus}
          />
        ) : (
          <>
            {rangeSummary()}
            <div className="training-range-actions">
              <button type="button" className="secondary" disabled={busy} onClick={() => openRenameEditor(range)}>
                {copy.rename}
              </button>
              {canAdjust && (
                <button type="button" className="secondary" disabled={busy} onClick={() => openAdjustEditor(range)}>
                  {range.state === "review-required" ? copy.review : copy.adjust}
                </button>
              )}
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={requestRemoveConfirmation}
              >{copy.remove}</button>
            </div>
          </>
        )}
        {removeConfirmation && (
          <div
            className="training-range-remove-confirmation"
            role="group"
            aria-label={interpolate(copy.removeQuestion, { title: range.title })}
          >
            <strong>{interpolate(copy.removeQuestion, { title: range.title })}</strong>
            <p>{copy.removeHelp}</p>
            <div>
              <button type="button" className="secondary" disabled={busy} onClick={cancelRemoveConfirmation}>
                {copy.keep}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeRange(range).then((outcome) => {
                  if (outcome === "success") requestSelectedRangeFocus();
                })}
              >{copy.removeRange}</button>
              {mutationCommand === "remove_training_session_range" && (
                <span role="status" aria-live="polite">{copy.removing}</span>
              )}
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <section
      className="training-ranges"
      aria-labelledby="training-ranges-heading"
      aria-busy={loading || busy}
    >
      <header className="training-ranges-heading">
        <div>
          <h3 id="training-ranges-heading">{copy.heading}</h3>
          <p>{copy.introduction}</p>
        </div>
        <button
          type="button"
          disabled={busy || editableChoices.length === 0}
          onClick={() => openCreateEditor()}
        >
          {copy.create}
        </button>
      </header>
      {loading && <p role="status">{copy.loading}</p>}
      {failed && !loading && (
        <div className="training-ranges-failed">
          <p>{copy.failed}</p>
          <button type="button" className="secondary" onClick={() => void reload()}>
            {copy.retry}
          </button>
        </div>
      )}
      {status && <p className="training-ranges-status" role="status">{status}</p>}
      {editor?.mode === "create" && (
        <TrainingRangeEditor
          surface="library"
          messages={messages}
          onSaved={requestSelectedRangeFocus}
        />
      )}
      {!loading && !failed && result?.ranges.length === 0 && editor?.mode !== "create" && (
        <div className="training-ranges-empty">
          <strong>{copy.empty}</strong>
          <p>{editableChoices.length > 0 ? copy.emptyHelp : copy.noEditableTimeline}</p>
        </div>
      )}
      {!loading && !failed && result && result.ranges.length > 0 && (
        <div className="training-range-workspace">
          <nav aria-label={copy.listLabel}>
            <ul>{result.ranges.map((range) => (
              <li key={range.rangeRef}>
                <button
                  type="button"
                  aria-label={interpolate(copy.open, { title: range.title })}
                  aria-current={range.rangeRef === selectedRange?.rangeRef ? "page" : undefined}
                  onClick={(event) => {
                    selectRange(range.rangeRef);
                    requestSelectedRangeFocus(event.currentTarget);
                  }}
                >
                  <strong>{range.title}</strong>
                  <span>{rangeCoordinateLabel(range)}</span>
                  <small>{range.state === "current" ? copy.current : copy.reviewRequired}</small>
                </button>
              </li>
            ))}</ul>
          </nav>
          {selectedRange && selectedRangePanel(selectedRange)}
        </div>
      )}
    </section>
  );
}
