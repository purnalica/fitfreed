import { useMemo, useState } from "react";

import type { catalogs, Locale } from "../locales/catalogs";

export interface ImportReport {
  exactRepeat: boolean;
  recognizedArtifacts: number;
  newObservations: number;
  equivalentObservations: number;
  enrichedObservations: number;
  amendedObservations: number;
  preservedObservations: number;
  conflicts: number;
}

export type ImportOutcomeState = "completed" | "rejected" | "cancelled" | "failed";

export interface ArtifactCoverageSummary {
  total: number;
  supported: number;
  unsupported: number;
  deliberatelyIgnored: number;
  unrecognized: number;
  invalid: number;
}

export type ArtifactClassification =
  | "supported"
  | "unsupported"
  | "deliberately-ignored"
  | "unrecognized"
  | "invalid";

export interface ArtifactFamilyCoverage {
  familyCode: string | null;
  classification: ArtifactClassification;
  reasonCode: string;
  artifactCount: number;
}

export interface ImportOutcome {
  operationRef: string;
  state: ImportOutcomeState;
  sourceProvider: string;
  sourceAdapterVersion: string;
  mappingVersion: string;
  exactRepeat: boolean;
  coverageComplete: boolean;
  coverage: ArtifactCoverageSummary;
  artifactFamilies: ArtifactFamilyCoverage[];
  report: ImportReport;
  canonicalHistoryChanged: boolean;
  terminalCode: string | null;
  recoveryNote: string | null;
}

type OutcomeMessages = (typeof catalogs)["en-US"]["outcome"];
type CountKey = keyof OutcomeMessages["incorporationCounts"];

interface ImportOutcomePanelProps {
  locale: Locale;
  messages: OutcomeMessages;
  outcome: ImportOutcome;
  terminalMessage?: string;
  onOpenHome: () => void;
  onChooseAnother: () => Promise<void> | void;
  onArchiveError?: () => void;
}

function headline(messages: OutcomeMessages, outcome: ImportOutcome): string {
  if (outcome.state === "cancelled") return messages.cancelledHeading;
  if (outcome.state === "rejected") return messages.rejectedHeading;
  if (outcome.state === "failed") return messages.failedHeading;
  if (outcome.exactRepeat) return messages.repeatHeading;
  return outcome.canonicalHistoryChanged
    ? messages.changedHeading
    : messages.reviewedHeading;
}

function consequence(messages: OutcomeMessages, outcome: ImportOutcome): string {
  if (outcome.state === "cancelled") return messages.cancelledConsequence;
  if (outcome.state === "rejected") return messages.rejectedConsequence;
  if (outcome.state === "failed") return messages.failedConsequence;
  if (outcome.exactRepeat) return messages.repeatConsequence;
  return outcome.canonicalHistoryChanged
    ? messages.changedConsequence
    : messages.reviewedConsequence;
}

function providerName(messages: OutcomeMessages, provider: string): string {
  return provider === "polar-flow" ? messages.polarFlow : provider;
}

export function ImportOutcomePanel({
  locale,
  messages,
  outcome,
  terminalMessage,
  onOpenHome,
  onChooseAnother,
  onArchiveError = () => undefined,
}: ImportOutcomePanelProps) {
  const [archiveChoosing, setArchiveChoosing] = useState(false);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const classifiedArtifacts = outcome.coverage.supported
    + outcome.coverage.unsupported
    + outcome.coverage.deliberatelyIgnored
    + outcome.coverage.unrecognized
    + outcome.coverage.invalid;
  const title = headline(messages, outcome);
  const familyNames = messages.familyNames as Record<string, string>;
  const coverageExplanations = messages.coverageExplanations as Record<
    string,
    { reason: string; action: string }
  >;

  function count(value: number, key: CountKey): string {
    const form = plural.select(value) === "one" ? "one" : "other";
    return messages.incorporationCounts[key][form].replace("{count}", number.format(value));
  }

  function countLabel(value: number, key: CountKey): string {
    const form = plural.select(value) === "one" ? "one" : "other";
    return messages.incorporationCounts[key][form].replace("{count}", "").trim();
  }

  async function chooseAnother() {
    if (archiveChoosing) return;
    setArchiveChoosing(true);
    try {
      await onChooseAnother();
    } catch {
      onArchiveError();
    } finally {
      setArchiveChoosing(false);
    }
  }

  const incorporationChanges: Array<[CountKey, number]> = [
    ["created", outcome.report.newObservations],
    ["enriched", outcome.report.enrichedObservations],
    ["amended", outcome.report.amendedObservations],
  ];
  const visibleChanges = incorporationChanges.filter(([, value]) => value > 0);
  const completeCounts: Array<[CountKey, number]> = [
    ["recognized", outcome.report.recognizedArtifacts],
    ["created", outcome.report.newObservations],
    ["enriched", outcome.report.enrichedObservations],
    ["amended", outcome.report.amendedObservations],
    ["equivalent", outcome.report.equivalentObservations],
    ["preserved", outcome.report.preservedObservations],
    ["conflicts", outcome.report.conflicts],
  ];

  return (
    <section
      className={`outcome-panel outcome-panel-${outcome.state}`}
      aria-labelledby="outcome-heading"
      data-history-changed={outcome.canonicalHistoryChanged}
    >
      <header className="outcome-leading">
        <p className="eyebrow">{messages.heading}</p>
        <h2 id="outcome-heading">{title}</h2>
        <p className="outcome-consequence" role="status" aria-live="polite">
          {consequence(messages, outcome)}
        </p>
        {outcome.state === "completed" && !outcome.exactRepeat && visibleChanges.length > 0 && (
          <ul className="outcome-change-summary" aria-label={messages.incorporationHeading}>
            {visibleChanges.map(([key, value]) => (
              <li key={key}>
                <strong>{number.format(value)}</strong>
                <span>{countLabel(value, key)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="outcome-actions" aria-busy={archiveChoosing}>
          {outcome.state === "completed" && (
            <button type="button" onClick={onOpenHome}>{messages.openHome}</button>
          )}
          <button
            type="button"
            className="secondary"
            disabled={archiveChoosing}
            onClick={() => void chooseAnother()}
          >
            {messages.chooseAnother}
          </button>
          {archiveChoosing && (
            <span role="status" aria-live="polite">{messages.choosingAnother}</span>
          )}
        </div>
      </header>

      {terminalMessage && outcome.state !== "completed" && (
        <details className="outcome-disclosure outcome-terminal-detail">
          <summary>{messages.terminalDetails}</summary>
          <p>{terminalMessage}</p>
        </details>
      )}

      <details className="outcome-disclosure outcome-coverage-detail">
        <summary>{messages.details}</summary>
        <div className="outcome-detail-content">
          <dl className="outcome-metadata">
            <div>
              <dt>{messages.status}</dt>
              <dd>{messages.states[outcome.state]}</dd>
            </div>
            <div>
              <dt>{messages.provider}</dt>
              <dd>{providerName(messages, outcome.sourceProvider)}</dd>
            </div>
            <div>
              <dt>{messages.historyEffect}</dt>
              <dd>
                {outcome.canonicalHistoryChanged
                  ? messages.historyChanged
                  : messages.historyUnchanged}
              </dd>
            </div>
            <div>
              <dt>{messages.sourceAdapterVersion}</dt>
              <dd>{outcome.sourceAdapterVersion}</dd>
            </div>
            <div>
              <dt>{messages.mappingVersion}</dt>
              <dd>{outcome.mappingVersion}</dd>
            </div>
          </dl>

          <section aria-labelledby="incorporation-heading">
            <h3 id="incorporation-heading">{messages.incorporationHeading}</h3>
            <ul className="outcome-incorporation-counts">
              {completeCounts.map(([key, value]) => <li key={key}>{count(value, key)}</li>)}
            </ul>
          </section>

          <section aria-labelledby="coverage-heading">
            <h3 id="coverage-heading">{messages.coverageHeading}</h3>
            <p>
              <strong>{number.format(classifiedArtifacts)} / {number.format(outcome.coverage.total)}</strong>{" "}
              <span>
                {messages.artifactsClassified[
                  plural.select(classifiedArtifacts) === "one" ? "one" : "other"
                ]}.
              </span>{" "}
              <span>
                {outcome.coverageComplete
                  ? messages.coverageComplete
                  : messages.coverageIncomplete}
              </span>
            </p>
            <ul className="coverage-summary" aria-labelledby="coverage-heading">
              <li><strong>{number.format(outcome.coverage.supported)}</strong><span>{messages.supported}</span></li>
              <li><strong>{number.format(outcome.coverage.unsupported)}</strong><span>{messages.unsupported}</span></li>
              <li><strong>{number.format(outcome.coverage.deliberatelyIgnored)}</strong><span>{messages.ignored}</span></li>
              <li><strong>{number.format(outcome.coverage.unrecognized)}</strong><span>{messages.unrecognized}</span></li>
              <li><strong>{number.format(outcome.coverage.invalid)}</strong><span>{messages.invalid}</span></li>
            </ul>
          </section>

          {outcome.artifactFamilies.length > 0 && (
            <section>
              <h3 id="family-coverage-heading">{messages.familyCoverageHeading}</h3>
              <div
                className="family-coverage-scroll"
                role="region"
                aria-labelledby="family-coverage-heading"
                tabIndex={0}
              >
                <table className="family-coverage-table">
                  <caption className="sr-only">{messages.familyCoverageHeading}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{messages.familyColumn}</th>
                      <th scope="col">{messages.classificationColumn}</th>
                      <th scope="col">{messages.artifactCountColumn}</th>
                      <th scope="col">{messages.explanationColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outcome.artifactFamilies.map((family) => {
                      const explanation = coverageExplanations[family.reasonCode]
                        ?? coverageExplanations.unknown;
                      return (
                        <tr key={`${family.familyCode ?? "unrecognized"}:${family.classification}:${family.reasonCode}`}>
                          <th scope="row" data-label={messages.familyColumn}>
                            {family.familyCode === null
                              ? messages.unrecognizedFamily
                              : familyNames[family.familyCode] ?? family.familyCode}
                          </th>
                          <td data-label={messages.classificationColumn}>
                            {messages.familyClassifications[family.classification]}
                          </td>
                          <td data-label={messages.artifactCountColumn}>
                            {number.format(family.artifactCount)}
                          </td>
                          <td data-label={messages.explanationColumn}>
                            <p><strong>{messages.reasonLabel}:</strong> {explanation.reason}</p>
                            <p><strong>{messages.nextActionLabel}:</strong> {explanation.action}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </details>
    </section>
  );
}
