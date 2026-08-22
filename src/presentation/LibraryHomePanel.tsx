import { useEffect, useMemo, useRef } from "react";

import type {
  ExploreDestination,
  IllustratedSportFamily,
  LibraryDomainCoverage,
  LibraryHome,
  LibraryHomeMessages,
  LibraryQuestion,
  LibraryHomeRecentSession,
  LibraryHomeSportSummary,
  RecentTrainingComparisonHighlight,
} from "./library-home";
import { restoreFocusAfterReveal } from "./focus-restoration";
import { SportFamilyIcon } from "./SportFamilyIcon";

interface LibraryHomePanelProps {
  home: LibraryHome;
  locale: string;
  messages: LibraryHomeMessages;
  focusRequestId?: number;
  focusTarget?: string;
  pendingDestination?: ExploreDestination;
  onExplore: (destination: ExploreDestination, focusTarget?: string) => void;
  onOpenQuestion?: (question: LibraryQuestion) => void;
  onOpenComparison: (comparison: RecentTrainingComparisonHighlight) => void;
  onOpenSession: (session: LibraryHomeRecentSession) => void;
  onOpenSources: () => void;
  onChooseArchive?: () => void;
  onOpenSourceGuide?: () => void;
}

const illustratedSportFamilies: IllustratedSportFamily[] = [
  "running",
  "cycling",
  "water-sport",
  "strength",
];

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function LibraryHomePanel({
  home,
  locale,
  messages,
  focusRequestId = 0,
  focusTarget,
  pendingDestination,
  onExplore,
  onOpenQuestion = (question) => onExplore(
    question.destination,
    `question:${question.kind}`,
  ),
  onOpenComparison,
  onOpenSession,
  onOpenSources,
  onChooseArchive = onOpenSources,
  onOpenSourceGuide = onOpenSources,
}: LibraryHomePanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusTargets = useRef(new Map<string, HTMLButtonElement>());
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const decimal = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
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
  const formatDate = (value: string) => date.format(localDate(value.slice(0, 10)));
  const formatDuration = (value: string) => {
    const totalMinutes = BigInt(value) / 60_000n;
    const hours = totalMinutes / 60n;
    const minutes = totalMinutes % 60n;
    if (hours > 0n && minutes > 0n) {
      return messages.durationHoursMinutes
        .replace("{hours}", number.format(hours))
        .replace("{minutes}", number.format(minutes));
    }
    if (hours > 0n) return messages.durationHours.replace("{hours}", number.format(hours));
    if (minutes > 0n) return messages.durationMinutes.replace("{minutes}", number.format(minutes));
    return messages.durationLessThanMinute;
  };
  const formatDistance = (value: number) => messages.recentDistance
    .replace("{distance}", decimal.format(value / 1_000));
  const sportLabel = (sport: {
    sportState?: LibraryHomeRecentSession["sportState"];
    state?: LibraryHomeSportSummary["state"];
    canonicalFamily: LibraryHomeRecentSession["canonicalFamily"];
    displayLabel: string | null;
  }) => {
    if (sport.displayLabel) return sport.displayLabel;
    const state = sport.sportState ?? sport.state;
    if (state === "classified" && sport.canonicalFamily) {
      return messages.sportFamilies[sport.canonicalFamily];
    }
    return state === "unavailable" ? messages.sportUnavailable : messages.sportUnknown;
  };

  useEffect(() => {
    if (focusRequestId === 0) return;
    return restoreFocusAfterReveal(
      focusTarget ? focusTargets.current.get(focusTarget) ?? headingRef.current : headingRef.current,
    );
  }, [focusRequestId, focusTarget]);

  const registerFocusTarget = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) {
      focusTargets.current.set(key, element);
    } else {
      focusTargets.current.delete(key);
    }
  };

  if (home.availableRange === null) {
    return (
      <section className="library-home library-home-empty" aria-labelledby="library-home-empty-heading">
        <div className="library-home-empty-copy">
          <p className="eyebrow">{messages.eyebrow}</p>
          <h1 id="library-home-empty-heading" ref={headingRef} tabIndex={-1}>
            {messages.emptyHeading}
          </h1>
          <p>{messages.emptyIntro}</p>
          <div className="library-home-empty-actions">
            <button type="button" onClick={onChooseArchive}>{messages.emptyAction}</button>
            <button type="button" className="secondary" onClick={onOpenSourceGuide}>
              {messages.emptyGuideAction}
            </button>
          </div>
          <p className="library-home-empty-boundary">{messages.emptyLocalBoundary}</p>
        </div>
        <section
          className="library-home-empty-possibilities"
          aria-labelledby="library-home-empty-preview-heading"
        >
          <p className="eyebrow">{messages.emptyPreviewEyebrow}</p>
          <h2 id="library-home-empty-preview-heading">{messages.emptyPreviewHeading}</h2>
          <p className="library-home-empty-preview-note">{messages.emptyPreviewNote}</p>
          <ul>
            {illustratedSportFamilies.map((family) => (
              <li
                key={family}
                data-sport-family={family}
                aria-label={messages.emptyPreviewSports[family].label}
              >
                <SportFamilyIcon family={family} />
                <div>
                  <h3>{messages.emptyPreviewSports[family].label}</h3>
                  <p>{messages.emptyPreviewSports[family].detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </section>
    );
  }

  const range = `${formatDate(home.availableRange.from)} ${messages.rangeSeparator} ${formatDate(home.availableRange.through)}`;
  const training = home.training;
  const highlight = home.highlight;
  const resumableExploration = home.resumableExploration;
  const postImportHeading = home.postImport?.exactRepeat
    ? messages.postImportHeadingExactRepeat
    : home.postImport?.canonicalHistoryChanged
      ? messages.postImportHeadingChanged
      : messages.postImportHeadingUnchanged;

  return (
    <div className="library-home" aria-busy={pendingDestination !== undefined}>
      <header className="library-home-heading">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1}>{messages.title}</h1>
        <p>{messages.intro}</p>
        <div className="library-home-summary" aria-label={messages.availablePeriod}>
          {training && (
            <>
              <strong>{formatCount(training.sessionCount, messages.summarySessions)}</strong>
              <strong>{formatCount(training.sportProfileCount, messages.summarySports)}</strong>
            </>
          )}
          <span>{range}</span>
        </div>
      </header>

      {training && training.sports.length > 0 && (
        <section className="library-home-sports" aria-labelledby="library-home-sports-heading">
          <div>
            <h2 id="library-home-sports-heading">{messages.sportsHeading}</h2>
            <p>{messages.sportsIntro}</p>
          </div>
          <ul>
            {training.sports.map((sport, index) => {
              const label = sportLabel(sport);
              return (
                <li key={`${sport.state}-${sport.canonicalFamily ?? "none"}-${sport.displayLabel ?? "none"}-${index}`}>
                  <SportFamilyIcon family={sport.canonicalFamily} />
                  <div>
                    <strong>{label}</strong>
                    <span>{formatCount(sport.sessionCount, messages.sportSessions)}</span>
                    {sport.profileCount > 1 && (
                      <small>{formatCount(sport.profileCount, messages.sportProfiles)}</small>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {training.omittedSportProfileCount > 0 && (
            <p className="library-home-sports-omitted">
              {formatCount(training.omittedSportProfileCount, messages.omittedSports)}
            </p>
          )}
        </section>
      )}

      {highlight?.kind === "recent-training-comparison" && (
        <section className="library-home-highlight" aria-labelledby="library-home-highlight-heading">
          <div className="library-home-highlight-copy">
            <p className="eyebrow">{messages.comparisonEyebrow}</p>
            <h2 id="library-home-highlight-heading">{messages.comparisonHeading}</h2>
            <p>{messages.comparisonIntro}</p>
          </div>
          <div className="library-home-periods">
            <TrainingPeriod
              label={messages.comparisonCurrent}
              period={highlight.comparison}
              comparisonMaximum={Math.max(
                highlight.baseline.sessionCount,
                highlight.comparison.sessionCount,
                1,
              )}
              formatCount={(value) => formatCount(value, messages.comparisonSessions)}
              formatDate={formatDate}
              formatDuration={formatDuration}
              rangeSeparator={messages.rangeSeparator}
            />
            <TrainingPeriod
              label={messages.comparisonPrevious}
              period={highlight.baseline}
              comparisonMaximum={Math.max(
                highlight.baseline.sessionCount,
                highlight.comparison.sessionCount,
                1,
              )}
              formatCount={(value) => formatCount(value, messages.comparisonSessions)}
              formatDate={formatDate}
              formatDuration={formatDuration}
              rangeSeparator={messages.rangeSeparator}
            />
          </div>
          <button
            type="button"
            ref={registerFocusTarget("highlight")}
            disabled={pendingDestination !== undefined}
            onClick={() => onOpenComparison(highlight)}
          >
            {messages.comparisonOpen}
          </button>
        </section>
      )}

      {highlight?.kind === "historical-training" && (
        <section className="library-home-highlight library-home-historical" aria-labelledby="library-home-highlight-heading">
          <div>
            <p className="eyebrow">{messages.historicalEyebrow}</p>
            <h2 id="library-home-highlight-heading">{messages.historicalHeading}</h2>
            <p>
              {(highlight.reason === "no-current-training"
                ? messages.historicalNoCurrentTraining
                : messages.historicalFutureHistory)
                .replace("{date}", formatDate(highlight.latestSessionDate))}
            </p>
          </div>
          <button
            type="button"
            ref={registerFocusTarget("highlight")}
            disabled={pendingDestination !== undefined}
            onClick={() => onExplore("training", "highlight")}
          >
            {messages.historicalOpen}
          </button>
        </section>
      )}

      {highlight?.kind === "library-history" && (
        <section className="library-home-highlight library-home-historical" aria-labelledby="library-home-highlight-heading">
          <div>
            <p className="eyebrow">{messages.libraryHistoryEyebrow}</p>
            <h2 id="library-home-highlight-heading">{messages.libraryHistoryHeading}</h2>
            <p>{messages.libraryHistoryIntro.replace("{date}", formatDate(highlight.latestEvidenceDate))}</p>
          </div>
        </section>
      )}

      {training && training.recentSessions.length > 0 && (
        <section className="library-home-recent" aria-labelledby="library-home-recent-heading">
          <div>
            <h2 id="library-home-recent-heading">{messages.recentHeading}</h2>
            <p>{messages.recentIntro}</p>
          </div>
          <ul>
            {training.recentSessions.map((session) => {
              const label = sportLabel(session);
              const formattedDate = formatDate(session.startedAtLocal);
              return (
                <li key={session.sessionRef}>
                  <button
                    type="button"
                    ref={registerFocusTarget(`session:${session.sessionRef}`)}
                    disabled={pendingDestination !== undefined}
                    aria-label={messages.recentOpen
                      .replace("{sport}", label)
                      .replace("{date}", formattedDate)}
                    onClick={() => onOpenSession(session)}
                  >
                    <SportFamilyIcon family={session.canonicalFamily} />
                    <span className="library-home-recent-identity">
                      <strong>{label}</strong>
                      <span>{formattedDate}</span>
                    </span>
                    <span className="library-home-recent-facts">
                      <strong>{formatDuration(session.durationMilliseconds)}</strong>
                      {session.distanceMeters !== null && <span>{formatDistance(session.distanceMeters)}</span>}
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {home.postImport && (
        <section
          className="library-home-reveal"
          role="status"
          aria-labelledby="library-home-reveal-heading"
          aria-live="polite"
        >
          <h2 id="library-home-reveal-heading">{postImportHeading}</h2>
          <p>
            {home.postImport.exactRepeat
              ? messages.postImportExactRepeat
              : home.postImport.canonicalHistoryChanged
                ? messages.postImportChanged
                : messages.postImportUnchanged}
          </p>
        </section>
      )}

      {resumableExploration && (
        <section className="library-home-resume" aria-labelledby="library-home-resume-heading">
          <h2 id="library-home-resume-heading">{messages.resumeHeading}</h2>
          <button
            type="button"
            ref={registerFocusTarget(`resume:${resumableExploration.destination}`)}
            disabled={pendingDestination !== undefined}
            onClick={() => onExplore(
              resumableExploration.destination,
              `resume:${resumableExploration.destination}`,
            )}
          >
            {messages.resume[resumableExploration.destination]}
          </button>
        </section>
      )}

      {pendingDestination && (
        <p className="library-home-navigation-status" role="status" aria-live="polite">
          {messages.opening[pendingDestination]}
        </p>
      )}

      {home.questions.length > 0 && (
        <section
          className="library-home-questions"
          aria-labelledby="library-home-questions-heading"
          aria-busy={pendingDestination !== undefined}
        >
          <div>
            <h2 id="library-home-questions-heading">{messages.questionsHeading}</h2>
            <p>{messages.questionsIntro}</p>
          </div>
          <ol>
            {home.questions.map((question, index) => (
              <li key={question.kind}>
                <button
                  type="button"
                  ref={registerFocusTarget(`question:${question.kind}`)}
                  disabled={pendingDestination !== undefined}
                  onClick={() => onOpenQuestion(question)}
                >
                  <span aria-hidden="true">{number.format(index + 1).padStart(2, "0")}</span>
                  <strong>{messages.questions[question.kind]}</strong>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <details className="library-home-coverage-disclosure" aria-label={messages.coverageSummary}>
        <summary>{messages.coverageSummary}</summary>
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
      </details>
    </div>
  );
}

interface TrainingPeriodProps {
  label: string;
  period: RecentTrainingComparisonHighlight["comparison"];
  comparisonMaximum: number;
  formatCount: (value: number) => string;
  formatDate: (value: string) => string;
  formatDuration: (value: string) => string;
  rangeSeparator: string;
}

function TrainingPeriod({
  label,
  period,
  comparisonMaximum,
  formatCount,
  formatDate,
  formatDuration,
  rangeSeparator,
}: TrainingPeriodProps) {
  return (
    <section aria-label={label}>
      <div>
        <strong>{label}</strong>
        <span>{formatDate(period.range.from)} {rangeSeparator} {formatDate(period.range.through)}</span>
      </div>
      <progress max={comparisonMaximum} value={period.sessionCount} aria-label={formatCount(period.sessionCount)} />
      <p>
        <strong>{formatCount(period.sessionCount)}</strong>
        <span>{formatDuration(period.totalDurationMilliseconds)}</span>
      </p>
    </section>
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
