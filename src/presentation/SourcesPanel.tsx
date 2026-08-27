import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import type { catalogs, Locale } from "../locales/catalogs";
import {
  selectOfficialSourceLink,
  type OfficialSourceLinkPurpose,
  type SourceAcquisitionGuide,
} from "./source-acquisition";
import type {
  OpenOfficialSourceLinkOutcome,
  OpenOfficialSourceLinkRequest,
} from "../infrastructure/official-source-link";
import { formatLocalDate } from "./presentation-format";

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
  archiveSelectionRequestId?: number;
  archivePickerRecoveryFocusRequestId?: number;
  mode?: "ready" | "active" | "result";
  progressLabel?: string;
  progressValue?: number;
  progressDetail?: string;
  progressKey?: string;
  activeProtectionMessage?: string;
  activeWorkingMessage?: string;
  activeDelayedMessage?: string;
  errorMessage?: string;
  archivePath: string | undefined;
  hasLocalLibrary?: boolean;
  importReady: boolean;
  busy: boolean;
  cancellable: boolean;
  updateInstalling: boolean;
  cancelRequested: boolean;
  onChooseArchive: () => Promise<string | null>;
  onArchiveError: () => void;
  onImport: () => Promise<void>;
  onCancel: () => Promise<void>;
  onOpenOfficialLink: (
    request: OpenOfficialSourceLinkRequest,
    url: string,
  ) => Promise<OpenOfficialSourceLinkOutcome>;
  onLinkError: (reason: unknown) => string;
  children?: ReactNode;
}

export function SourcesPanel({
  locale,
  messages,
  importMessages,
  guide,
  guideLoading,
  guideRequestId = 0,
  archiveSelectionRequestId = 0,
  archivePickerRecoveryFocusRequestId = 0,
  busy,
  mode = busy ? "active" : "ready",
  progressLabel,
  progressValue,
  progressDetail,
  progressKey,
  activeProtectionMessage,
  activeWorkingMessage,
  activeDelayedMessage,
  errorMessage,
  archivePath,
  hasLocalLibrary = false,
  importReady,
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
  const [linkOutcome, setLinkOutcome] = useState<{
    purpose: OfficialSourceLinkPurpose;
    state: "accepted" | "failed";
    url: string;
    message?: string;
  }>();
  const [progressDelayed, setProgressDelayed] = useState(false);
  const guideHeading = useRef<HTMLHeadingElement>(null);
  const archiveContainer = useRef<HTMLElement>(null);
  const archiveHeading = useRef<HTMLHeadingElement>(null);
  const chooseArchiveButton = useRef<HTMLButtonElement>(null);
  const archiveChoiceFocusPending = useRef(false);
  const linkFailure = useRef<HTMLDivElement>(null);

  function reveal(target: HTMLElement | null, scrollTarget = target) {
    if (!target) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ?? false;
    scrollTarget?.scrollIntoView?.({
      block: "center",
      behavior: reducedMotion ? "auto" : "smooth",
    });
    target.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (guideVisible && guide) reveal(guideHeading.current);
  }, [guide, guideRequestId, guideVisible]);

  useEffect(() => {
    if (archiveSelectionRequestId > 0) {
      reveal(archiveHeading.current, archiveContainer.current);
    }
  }, [archiveSelectionRequestId]);

  useEffect(() => {
    if (archivePickerRecoveryFocusRequestId > 0) {
      chooseArchiveButton.current?.focus();
    }
  }, [archivePickerRecoveryFocusRequestId]);

  useEffect(() => {
    if (archiveChoosing || !archiveChoiceFocusPending.current) return;
    archiveChoiceFocusPending.current = false;
    chooseArchiveButton.current?.focus();
  }, [archiveChoosing]);

  useEffect(() => {
    if (mode !== "active" || cancelRequested) {
      setProgressDelayed(false);
      return undefined;
    }
    setProgressDelayed(false);
    const timeout = window.setTimeout(() => setProgressDelayed(true), 15_000);
    return () => window.clearTimeout(timeout);
  }, [cancelRequested, mode, progressKey]);

  useEffect(() => {
    if (linkOutcome?.state === "failed") reveal(linkFailure.current);
  }, [linkOutcome]);

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
  const archiveName = archivePath?.split(/[\\/]/).filter(Boolean).at(-1);
  const localBoundary = hasLocalLibrary
    ? messages.localLibrary
    : archivePath
      ? messages.localSelected
      : messages.localBeforeSelection;

  async function openLink(purpose: OfficialSourceLinkPurpose, url: string) {
    if (linkOperation) return;
    setLinkOperation(purpose);
    setLinkOutcome(undefined);
    try {
      const outcome = await onOpenOfficialLink({
        sourceId: guide?.sourceId ?? "",
        purpose,
        locale,
      }, url);
      setLinkOutcome({ purpose, state: "accepted", url: outcome.url });
    } catch (reason) {
      setLinkOutcome({
        purpose,
        state: "failed",
        url,
        message: onLinkError(reason),
      });
    } finally {
      setLinkOperation(undefined);
    }
  }

  async function chooseArchive() {
    if (archiveChoosing) return;
    setArchiveChoosing(true);
    try {
      const selected = await onChooseArchive();
      if (selected === null) archiveChoiceFocusPending.current = true;
    } catch {
      onArchiveError();
      archiveChoiceFocusPending.current = true;
    } finally {
      setArchiveChoosing(false);
    }
  }

  return (
    <section className={`sources-panel sources-panel-${mode}`} aria-labelledby="sources-heading">
      <header className="sources-heading">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 id="sources-heading">{messages.title}</h1>
        {mode === "ready" && (
          <>
            <p>{messages.intro}</p>
            <p className="sources-local-note">{localBoundary}</p>
          </>
        )}
      </header>

      {mode === "active" ? (
        <section
          className="source-active-operation"
          aria-labelledby="source-active-heading"
          aria-busy="true"
        >
          <p className="eyebrow">{messages.activeEyebrow}</p>
          <h2 id="source-active-heading">{progressLabel ?? importMessages.importing}</h2>
          <p>{activeProtectionMessage ?? messages.activeProtectedHistory}</p>
          {progressValue === undefined ? (
            <p className="source-active-working" role="status" aria-live="polite">
              {cancelRequested
                ? importMessages.cancelling
                : activeWorkingMessage ?? messages.activeWorking}
            </p>
          ) : (
            <>
              <progress
                max="100"
                value={progressValue}
                aria-label={progressLabel ?? importMessages.importing}
              />
              {progressDetail && (
                <p className="source-progress-detail" role="status" aria-live="polite">
                  {progressDetail}
                </p>
              )}
            </>
          )}
          {progressDelayed && (
            <p className="source-active-delayed" role="status" aria-live="polite">
              {activeDelayedMessage ?? messages.activeDelayed}
            </p>
          )}
          {cancellable && (
            <button
              type="button"
              className="cancel"
              onClick={() => void onCancel()}
              disabled={cancelRequested}
            >
              {importMessages.cancel}
            </button>
          )}
          {cancelRequested && progressValue !== undefined && (
            <span className="source-active-working" role="status" aria-live="polite">
              {importMessages.cancelling}
            </span>
          )}
        </section>
      ) : (
        <>
          {mode === "result" && children}

          <div className="source-paths">
            <article
              ref={archiveContainer}
              className="source-path source-path-import"
              aria-busy={busy || archiveChoosing}
            >
              <span aria-hidden="true">01</span>
              <h2 ref={archiveHeading} tabIndex={-1}>{messages.haveArchiveTitle}</h2>
              <p>{messages.haveArchiveBody}</p>
              <p className="path">{archiveName ?? importMessages.noPackage}</p>
              {errorMessage && (
                <section className="source-operation-error" role="alert">
                  <h3>{messages.operationProblemTitle}</h3>
                  <p>{errorMessage}</p>
                </section>
              )}
              <div className="source-path-actions">
                <button
                  ref={chooseArchiveButton}
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
                  disabled={
                    !importReady
                    || !archivePath
                    || archiveChoosing
                    || busy
                    || updateInstalling
                  }
                >
                  {importMessages.import}
                </button>
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
                    <p>{messages.expectedArchive.replace(
                      "{archive}",
                      guide.expectedArchive.toUpperCase(),
                    )}</p>
                    <p>{messages.verifiedOn.replace(
                      "{date}",
                      formatLocalDate(guide.verifiedOn, locale),
                    )}</p>
                  </div>
                </header>

                <div className="source-guide-grid">
                  <section aria-labelledby="source-guide-steps-heading">
                    <h3 id="source-guide-steps-heading">{messages.instructionsHeading}</h3>
                    <ol>
                      {guide.instructionKeys.map((key) => (
                        <li key={key}>{instructions[key]}</li>
                      ))}
                    </ol>
                  </section>
                  <section aria-labelledby="source-guide-constraints-heading">
                    <h3 id="source-guide-constraints-heading">{messages.constraintsHeading}</h3>
                    <ul>
                      {guide.constraintKeys.map((key) => (
                        <li key={key}>{constraints[key]}</li>
                      ))}
                    </ul>
                  </section>
                </div>

                <section
                  className="source-troubleshooting"
                  aria-labelledby="source-troubleshooting-heading"
                >
                  <h3 id="source-troubleshooting-heading">
                    {messages.troubleshootingHeading}
                  </h3>
                  <ul>
                    {guide.troubleshootingKeys.map((key) => (
                      <li key={key}>{troubleshooting[key]}</li>
                    ))}
                  </ul>
                </section>

                <div className="source-official-actions" aria-busy={linkOperation !== undefined}>
                  {accountLink && (
                    <OfficialDestinationAction
                      purpose="account"
                      url={accountLink.url}
                      buttonLabel={messages.openAccount}
                      openingLabel={messages.openingAccount}
                      messages={messages}
                      operation={linkOperation}
                      outcome={linkOutcome}
                      failureRef={linkFailure}
                      onOpen={openLink}
                    />
                  )}
                  {instructionsLink && (
                    <OfficialDestinationAction
                      purpose="instructions"
                      url={instructionsLink.url}
                      buttonLabel={messages.openInstructions}
                      openingLabel={messages.openingInstructions}
                      messages={messages}
                      operation={linkOperation}
                      outcome={linkOutcome}
                      failureRef={linkFailure}
                      onOpen={openLink}
                    />
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

          {mode === "ready" && children}
        </>
      )}
    </section>
  );
}

interface OfficialDestinationActionProps {
  purpose: OfficialSourceLinkPurpose;
  url: string;
  buttonLabel: string;
  openingLabel: string;
  messages: SourcesMessages;
  operation: OfficialSourceLinkPurpose | undefined;
  outcome: {
    purpose: OfficialSourceLinkPurpose;
    state: "accepted" | "failed";
    url: string;
    message?: string;
  } | undefined;
  failureRef: RefObject<HTMLDivElement | null>;
  onOpen: (purpose: OfficialSourceLinkPurpose, url: string) => Promise<void>;
}

function OfficialDestinationAction({
  purpose,
  url,
  buttonLabel,
  openingLabel,
  messages,
  operation,
  outcome,
  failureRef,
  onOpen,
}: OfficialDestinationActionProps) {
  const actionOutcome = outcome?.purpose === purpose ? outcome : undefined;
  return (
    <section className="source-official-action">
      <button
        type="button"
        className="secondary"
        disabled={operation !== undefined}
        onClick={() => void onOpen(purpose, url)}
      >
        {buttonLabel}
      </button>
      <p className="source-official-destination">
        <span>{messages.destinationLabel}</span>
        <code>{url}</code>
      </p>
      {operation === purpose && (
        <p className="progress-submit-status" role="status" aria-live="polite">
          {openingLabel}
        </p>
      )}
      {actionOutcome?.state === "accepted" && (
        <p className="source-link-accepted" role="status" aria-live="polite">
          {messages.openAccepted}
        </p>
      )}
      {actionOutcome?.state === "failed" && (
        <div
          ref={failureRef}
          className="source-link-failure"
          role="alert"
          tabIndex={-1}
        >
          <strong>{messages.openProblemTitle}</strong>
          <p>{actionOutcome.message}</p>
          <p>{messages.copyDestination}</p>
        </div>
      )}
    </section>
  );
}
