import { useEffect, useRef, useState, type ReactNode } from "react";

import type { catalogs, Locale } from "../locales/catalogs";
import {
  selectOfficialSourceLink,
  type SourceAcquisitionGuide,
} from "./source-acquisition";

type SourcesMessages = (typeof catalogs)["en-US"]["sources"];

interface ImportMessages {
  choose: string;
  choosing: string;
  import: string;
  noPackage: string;
  importing: string;
  cancel: string;
  cancelling: string;
}

interface SourcesPanelProps {
  locale: Locale;
  messages: SourcesMessages;
  importMessages: ImportMessages;
  guide: SourceAcquisitionGuide | undefined;
  guideLoading: boolean;
  guideRequestId?: number;
  archivePath: string | undefined;
  importReady: boolean;
  busy: boolean;
  cancellable: boolean;
  updateInstalling: boolean;
  cancelRequested: boolean;
  onChooseArchive: () => Promise<void>;
  onArchiveError: () => void;
  onImport: () => Promise<void>;
  onCancel: () => Promise<void>;
  onOpenOfficialLink: (url: string) => Promise<void>;
  onLinkError: () => void;
  children?: ReactNode;
}

export function SourcesPanel({
  locale,
  messages,
  importMessages,
  guide,
  guideLoading,
  guideRequestId = 0,
  archivePath,
  importReady,
  busy,
  cancellable,
  updateInstalling,
  cancelRequested,
  onChooseArchive,
  onArchiveError,
  onImport,
  onCancel,
  onOpenOfficialLink,
  onLinkError,
  children,
}: SourcesPanelProps) {
  const [guideVisible, setGuideVisible] = useState(false);
  const [archiveChoosing, setArchiveChoosing] = useState(false);
  const [linkOperation, setLinkOperation] = useState<"account" | "instructions">();
  const guideHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (guideVisible && guide) guideHeading.current?.focus();
  }, [guide, guideRequestId, guideVisible]);

  useEffect(() => {
    if (guideRequestId > 0) setGuideVisible(true);
  }, [guideRequestId]);

  const accountLink = guide
    ? selectOfficialSourceLink(guide, "account", locale)
    : undefined;
  const instructionsLink = guide
    ? selectOfficialSourceLink(guide, "instructions", locale)
    : undefined;
  const instructions = messages.instructions as Record<string, string>;
  const constraints = messages.constraints as Record<string, string>;
  const troubleshooting = messages.troubleshooting as Record<string, string>;

  async function openLink(purpose: "account" | "instructions", url: string) {
    if (linkOperation) return;
    setLinkOperation(purpose);
    try {
      await onOpenOfficialLink(url);
    } catch {
      onLinkError();
    } finally {
      setLinkOperation(undefined);
    }
  }

  async function chooseArchive() {
    if (archiveChoosing) return;
    setArchiveChoosing(true);
    try {
      await onChooseArchive();
    } catch {
      onArchiveError();
    } finally {
      setArchiveChoosing(false);
    }
  }

  return (
    <section className="sources-panel" aria-labelledby="sources-heading">
      <header className="sources-heading">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 id="sources-heading">{messages.title}</h1>
        <p>{messages.intro}</p>
        <p className="sources-local-note">{messages.localOnly}</p>
      </header>

      <div className="source-paths">
        <article className="source-path source-path-import" aria-busy={busy || archiveChoosing}>
          <span aria-hidden="true">01</span>
          <h2>{messages.haveArchiveTitle}</h2>
          <p>{messages.haveArchiveBody}</p>
          <p className="path">{archivePath ?? importMessages.noPackage}</p>
          <div className="source-path-actions">
            <button
              type="button"
              className="secondary"
              onClick={() => void chooseArchive()}
              disabled={archiveChoosing || busy || updateInstalling}
            >
              {importMessages.choose}
            </button>
            <button
              type="button"
              onClick={() => void onImport()}
              disabled={!importReady || !archivePath || archiveChoosing || busy || updateInstalling}
            >
              {importMessages.import}
            </button>
            {busy && cancellable && (
              <button
                type="button"
                className="cancel"
                onClick={() => void onCancel()}
                disabled={cancelRequested}
              >
                {importMessages.cancel}
              </button>
            )}
            {(archiveChoosing || busy) && (
              <span className="source-import-progress" role="status" aria-live="polite">
                {archiveChoosing
                  ? importMessages.choosing
                  : cancelRequested
                    ? importMessages.cancelling
                    : importMessages.importing}
              </span>
            )}
          </div>
        </article>

        <article className="source-path source-path-guide">
          <span aria-hidden="true">02</span>
          <h2>{messages.needArchiveTitle}</h2>
          <p>{messages.needArchiveBody}</p>
          <button
            type="button"
            className="secondary"
            aria-expanded={guideVisible}
            aria-controls="source-acquisition-guide"
            aria-busy={guideLoading}
            aria-describedby={guideLoading ? "source-acquisition-guide-loading" : undefined}
            disabled={guideLoading}
            onClick={() => setGuideVisible(true)}
          >
            {messages.showGuide}
          </button>
          {guideLoading && (
            <span
              id="source-acquisition-guide-loading"
              className="source-guide-loading"
              role="status"
              aria-live="polite"
            >
              {messages.guideLoading}
            </span>
          )}
        </article>
      </div>

      {guideVisible && !guideLoading && (
        guide ? (
          <section
            id="source-acquisition-guide"
            className="source-guide"
            aria-labelledby="source-guide-heading"
          >
            <header className="source-guide-heading">
              <div>
                <p className="eyebrow">{messages.sourceName}</p>
                <h2 id="source-guide-heading" ref={guideHeading} tabIndex={-1}>
                  {messages.guideTitle}
                </h2>
                <p>{messages.guideIntro}</p>
              </div>
              <div className="source-guide-metadata">
                <p>{messages.expectedArchive.replace("{archive}", guide.expectedArchive.toUpperCase())}</p>
                <p>{messages.verifiedOn.replace(
                    "{date}",
                    new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(`${guide.verifiedOn}T00:00:00Z`)),
                  )}</p>
              </div>
            </header>

            <div className="source-guide-grid">
              <section aria-labelledby="source-guide-steps-heading">
                <h3 id="source-guide-steps-heading">{messages.instructionsHeading}</h3>
                <ol>
                  {guide.instructionKeys.map((key) => <li key={key}>{instructions[key]}</li>)}
                </ol>
              </section>
              <section aria-labelledby="source-guide-constraints-heading">
                <h3 id="source-guide-constraints-heading">{messages.constraintsHeading}</h3>
                <ul>
                  {guide.constraintKeys.map((key) => <li key={key}>{constraints[key]}</li>)}
                </ul>
              </section>
            </div>

            <section className="source-troubleshooting" aria-labelledby="source-troubleshooting-heading">
              <h3 id="source-troubleshooting-heading">{messages.troubleshootingHeading}</h3>
              <ul>
                {guide.troubleshootingKeys.map((key) => (
                  <li key={key}>{troubleshooting[key]}</li>
                ))}
              </ul>
            </section>

            <div
              className="source-official-actions"
              aria-busy={linkOperation !== undefined}
            >
              <button
                type="button"
                className="secondary"
                disabled={!accountLink || linkOperation !== undefined}
                onClick={() => accountLink && void openLink("account", accountLink.url)}
              >
                {messages.openAccount}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={!instructionsLink || linkOperation !== undefined}
                onClick={() => instructionsLink
                  && void openLink("instructions", instructionsLink.url)}
              >
                {messages.openInstructions}
              </button>
              {linkOperation && (
                <span className="progress-submit-status" role="status" aria-live="polite">
                  {linkOperation === "account"
                    ? messages.openingAccount
                    : messages.openingInstructions}
                </span>
              )}
            </div>
            <p className="source-external-note">{messages.externalNotice}</p>
            <p className="source-boundary">{messages.providerBoundary}</p>
          </section>
        ) : (
          <p id="source-acquisition-guide" className="notice" role="status">
            {messages.guideUnavailable}
          </p>
        )
      )}

      {children}
    </section>
  );
}
