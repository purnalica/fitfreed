import { type ReactNode, useEffect, useRef, useState } from "react";

import type { catalogs } from "../locales/catalogs";
import {
  sameApplicationPreferences,
  type AppearancePreference,
  type ApplicationPreferences,
} from "./application-preferences";
import { ProgressSubmitButton } from "./ProgressSubmitButton";
import { SportFamilyIcon } from "./SportFamilyIcon";
import { WorkspaceNavigation } from "./WorkspaceNavigation";

type SettingsMessages = (typeof catalogs)["en-US"]["settings"];

interface SettingsPanelProps {
  savedPreferences: ApplicationPreferences;
  defaultPreferences: ApplicationPreferences;
  messages: SettingsMessages;
  workspace: SettingsWorkspace;
  disabled: boolean;
  operation?: "save";
  savedNotice: boolean;
  editorRevision?: number;
  onWorkspaceChange: (workspace: SettingsWorkspace) => void;
  onPreview: (preferences: ApplicationPreferences) => void;
  onSave: (preferences: ApplicationPreferences) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  navigationGuard?: {
    destinationLabel: string;
    onKeepEditing: () => void;
    onDiscardAndContinue: () => void;
  };
  updatePanel?: ReactNode;
}

export type SettingsWorkspace = "appearance" | "updates";

const zoomOptions = [100, 125, 150, 175, 200];

export function SettingsPanel({
  savedPreferences,
  defaultPreferences,
  messages,
  workspace,
  disabled,
  operation,
  savedNotice,
  editorRevision = 0,
  onWorkspaceChange,
  onPreview,
  onSave,
  onDirtyChange,
  navigationGuard,
  updatePanel,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState(savedPreferences);
  const cancelChangesButton = useRef<HTMLButtonElement>(null);
  const navigationGuardAction = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraft(savedPreferences);
  }, [
    savedPreferences.version,
    savedPreferences.locale,
    savedPreferences.appearance,
    savedPreferences.contentZoomPercent,
    editorRevision,
  ]);

  const dirty = !sameApplicationPreferences(draft, savedPreferences);
  const defaultsSelected = sameApplicationPreferences(draft, defaultPreferences);
  const busy = operation !== undefined;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty || !navigationGuard) return undefined;
    const frame = requestAnimationFrame(() => navigationGuardAction.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [dirty, navigationGuard?.destinationLabel]);

  function preview(next: ApplicationPreferences) {
    setDraft(next);
    onPreview(next);
  }

  function discardPreview() {
    setDraft(savedPreferences);
    onPreview(savedPreferences);
    onDirtyChange?.(false);
  }

  function keepEditing() {
    navigationGuard?.onKeepEditing();
    requestAnimationFrame(() => cancelChangesButton.current?.focus());
  }

  function discardAndContinue() {
    discardPreview();
    navigationGuard?.onDiscardAndContinue();
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-heading">
      <header className="settings-heading">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 id="settings-heading">{messages.title}</h1>
        <p>{messages.intro}</p>
      </header>

      <WorkspaceNavigation
        label={messages.workspaceNavigation}
        current={workspace}
        options={[
          { workspace: "appearance", label: messages.workspaces.appearance },
          { workspace: "updates", label: messages.workspaces.updates },
        ]}
        onSelect={onWorkspaceChange}
      />

      <div className="settings-layout" hidden={workspace !== "appearance"}>
        <form
          className="settings-form"
          aria-labelledby="appearance-settings-heading"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(draft);
          }}
        >
          <div className="settings-section-heading">
            <h2 id="appearance-settings-heading">{messages.appearanceTitle}</h2>
            <p>{messages.appearanceIntro}</p>
          </div>

          <div className="settings-field">
            <label htmlFor="application-language">{messages.language}</label>
            <small id="application-language-help">{messages.languageBody}</small>
            <select
              id="application-language"
              aria-describedby="application-language-help"
              value={draft.locale}
              disabled={disabled || busy}
              onChange={(event) => preview({
                ...draft,
                locale: event.target.value as ApplicationPreferences["locale"],
              })}
            >
              <option value="en-US">{messages.localeEnglish}</option>
              <option value="es-ES">{messages.localeSpanish}</option>
            </select>
          </div>

          <fieldset className="settings-field appearance-options" disabled={disabled || busy}>
            <legend>{messages.appearance}</legend>
            <small>{messages.appearanceBody}</small>
            <div>
              {(["system", "light", "dark"] as AppearancePreference[]).map((appearance) => (
                <label key={appearance} data-appearance-option={appearance}>
                  <input
                    type="radio"
                    name="appearance"
                    value={appearance}
                    aria-label={messages[appearance]}
                    checked={draft.appearance === appearance}
                    onChange={() => preview({ ...draft, appearance })}
                  />
                  <span className="appearance-swatch" aria-hidden="true"><i /></span>
                  <span className="appearance-option-copy">
                    <strong>{messages[appearance]}</strong>
                    <small>{messages.appearanceOptions[appearance]}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="settings-field">
            <label htmlFor="application-content-zoom">{messages.zoom}</label>
            <small id="application-content-zoom-help">{messages.zoomBody}</small>
            <select
              id="application-content-zoom"
              aria-describedby="application-content-zoom-help"
              value={draft.contentZoomPercent}
              disabled={disabled || busy}
              onChange={(event) => preview({
                ...draft,
                contentZoomPercent: Number(event.target.value),
              })}
            >
              {zoomOptions.map((zoom) => (
                <option key={zoom} value={zoom}>{zoom}%</option>
              ))}
            </select>
          </div>

          <p className="settings-local-note">{messages.localOnly}</p>

          {!defaultsSelected && !busy && (
            <section className="settings-reset" aria-label={messages.restore}>
              <p>{messages.restoreBody}</p>
              <button
                type="button"
                className="secondary"
                disabled={disabled}
                onClick={() => preview(defaultPreferences)}
              >
                {messages.restore}
              </button>
            </section>
          )}

          {dirty && navigationGuard && (
            <section
              className="settings-navigation-guard"
              role="alertdialog"
              aria-labelledby="settings-navigation-guard-heading"
              aria-describedby="settings-navigation-guard-body"
            >
              <h3 id="settings-navigation-guard-heading">{messages.navigationGuardTitle}</h3>
              <p id="settings-navigation-guard-body">
                {messages.navigationGuardBody.replace(
                  "{destination}",
                  navigationGuard.destinationLabel,
                )}
              </p>
              <div>
                <button
                  ref={navigationGuardAction}
                  type="button"
                  className="secondary"
                  onClick={keepEditing}
                >
                  {messages.keepEditing}
                </button>
                <button type="button" onClick={discardAndContinue}>
                  {messages.discardAndLeave}
                </button>
              </div>
            </section>
          )}

          {!busy && (dirty || savedNotice) && (
            <p className="settings-status" role="status" aria-live="polite">
              {dirty ? messages.unsaved : messages.saved}
            </p>
          )}

          {(dirty || busy) && (
            <div className="settings-actions">
              {!busy && (
                <button
                  ref={cancelChangesButton}
                  type="button"
                  className="secondary settings-cancel"
                  disabled={disabled}
                  onClick={discardPreview}
                >
                  {messages.cancel}
                </button>
              )}
              <ProgressSubmitButton
                loading={operation === "save"}
                disabled={disabled || busy || !dirty}
                actionLabel={messages.save}
                progressLabel={messages.saving}
              />
            </div>
          )}
        </form>

        <aside className="settings-preview" aria-label={messages.preview}>
          <p className="eyebrow">{messages.previewEyebrow}</p>
          <article aria-label={messages.preview}>
            <header>
              <SportFamilyIcon family="running" />
              <div>
                <p>{messages.previewSport}</p>
                <h2>{messages.previewTitle}</h2>
              </div>
            </header>
            <dl>
              <div>
                <dt>{messages.previewDurationLabel}</dt>
                <dd>{messages.previewDuration}</dd>
              </div>
              <div>
                <dt>{messages.previewDistanceLabel}</dt>
                <dd>{messages.previewDistance}</dd>
              </div>
            </dl>
            <svg
              className="settings-preview-chart"
              viewBox="0 0 320 84"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <path className="settings-preview-chart-grid" d="M0 21H320M0 42H320M0 63H320" />
              <path className="settings-preview-chart-line" d="M0 67 34 55 70 60 106 35 142 44 178 20 214 31 250 14 286 29 320 18" />
            </svg>
          </article>
          <p className="settings-preview-note">{messages.previewBody}</p>
        </aside>
      </div>

      <div className="settings-updates-workspace" hidden={workspace !== "updates"}>
        {updatePanel}
      </div>
    </section>
  );
}
