import { useEffect, useMemo, useRef } from "react";

import type {
  ExploreDestination,
  LibraryDomainCoverage,
  LibraryHome,
  LibraryHomeMessages,
} from "./library-home";
import { restoreFocusAfterReveal } from "./focus-restoration";

interface LibraryHomePanelProps {
  home: LibraryHome;
  locale: string;
  messages: LibraryHomeMessages;
  focusRequestId?: number;
  onExplore: (destination: ExploreDestination) => void;
  onOpenSources: () => void;
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function LibraryHomePanel({
  home,
  locale,
  messages,
  focusRequestId = 0,
  onExplore,
  onOpenSources,
}: LibraryHomePanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const plural = useMemo(() => new Intl.PluralRules(locale), [locale]);
  const date = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }),
    [locale],
  );
  const formatCount = (
    value: number,
    templates: { one: string; other: string },
  ) => templates[plural.select(value) === "one" ? "one" : "other"]
    .replace("{count}", number.format(value));

  useEffect(() => {
    if (focusRequestId === 0) return;
    return restoreFocusAfterReveal(headingRef.current);
  }, [focusRequestId]);

  if (home.availableRange === null) {
    return (
      <section className="library-home library-home-empty" aria-labelledby="library-home-empty-heading">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 id="library-home-empty-heading" ref={headingRef} tabIndex={-1}>
          {messages.emptyHeading}
        </h1>
        <p>{messages.emptyIntro}</p>
        <button type="button" onClick={onOpenSources}>{messages.emptyAction}</button>
      </section>
    );
  }

  const range = `${date.format(localDate(home.availableRange.from))} ${messages.rangeSeparator} ${date.format(localDate(home.availableRange.through))}`;
  const resumableExploration = home.resumableExploration;

  return (
    <div className="library-home">
      <header className="library-home-heading">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1}>{messages.title}</h1>
        <p>{messages.intro}</p>
        <p className="library-home-range">
          <strong>{messages.availablePeriod}</strong>
          <span>{range}</span>
        </p>
      </header>

      {home.postImport && (
        <section
          className="library-home-reveal"
          role="status"
          aria-labelledby="library-home-reveal-heading"
          aria-live="polite"
        >
          <h2 id="library-home-reveal-heading">{messages.postImportHeading}</h2>
          <p>
            {home.postImport.exactRepeat
              ? messages.postImportExactRepeat
              : home.postImport.canonicalHistoryChanged
                ? messages.postImportChanged
                : messages.postImportUnchanged}
          </p>
          <ul>
            <li>{formatCount(home.postImport.newObservations, messages.postImportNew)}</li>
            <li>{formatCount(home.postImport.enrichedObservations, messages.postImportEnriched)}</li>
            <li>{formatCount(home.postImport.amendedObservations, messages.postImportAmended)}</li>
          </ul>
          {home.postImport.sourceReviewRecommended && <p>{messages.postImportReview}</p>}
          <button type="button" className="secondary" onClick={onOpenSources}>
            {messages.sources}
          </button>
        </section>
      )}

      {resumableExploration && (
        <section className="library-home-resume" aria-labelledby="library-home-resume-heading">
          <div>
            <h2 id="library-home-resume-heading">{messages.resumeHeading}</h2>
          </div>
          <button
            type="button"
            onClick={() => onExplore(resumableExploration.destination)}
          >
            {messages.resume[resumableExploration.destination]}
          </button>
        </section>
      )}

      <section className="library-home-questions" aria-labelledby="library-home-questions-heading">
        <div>
          <h2 id="library-home-questions-heading">{messages.questionsHeading}</h2>
          <p>{messages.questionsIntro}</p>
        </div>
        <ol>
          {home.questions.map((question, index) => (
            <li key={question.kind}>
              <button type="button" onClick={() => onExplore(question.destination)}>
                <span aria-hidden="true">{number.format(index + 1).padStart(2, "0")}</span>
                <strong>{messages.questions[question.kind]}</strong>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="library-home-coverage"
        role="region"
        aria-labelledby="library-home-coverage-heading"
      >
        <div className="library-home-coverage-heading">
          <div>
            <h2 id="library-home-coverage-heading">{messages.coverageHeading}</h2>
            <p>{messages.coverageIntro}</p>
          </div>
          <button type="button" className="secondary" onClick={onOpenSources}>
            {messages.sources}
          </button>
        </div>
        <p className="library-home-coverage-range">{range}</p>
        <ul>
          {home.domains.map((domain) => (
            <DomainCoverage
              key={domain.domain}
              coverage={domain}
              messages={messages}
              formatCount={formatCount}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

interface DomainCoverageProps {
  coverage: LibraryDomainCoverage;
  messages: LibraryHomeMessages;
  formatCount: (value: number, templates: { one: string; other: string }) => string;
}

function DomainCoverage({ coverage, messages, formatCount }: DomainCoverageProps) {
  const availableMeasurements = coverage.measurements.filter(
    (measurement) => measurement.availableRecords > 0,
  ).length;
  return (
    <li aria-label={messages.domains[coverage.domain]} data-domain={coverage.domain}>
      <strong>{messages.domains[coverage.domain]}</strong>
      {coverage.availableRange === null ? (
        <span>{messages.unavailable}</span>
      ) : (
        <>
          <span>{formatCount(coverage.observedRecordCount, messages.records)}</span>
          <span>{formatCount(availableMeasurements, messages.measurements)}</span>
        </>
      )}
    </li>
  );
}
