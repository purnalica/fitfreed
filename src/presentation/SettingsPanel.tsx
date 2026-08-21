import { type ReactNode, useEffect, useState } from "react";

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
  messages: SettingsMessages;
  workspace: SettingsWorkspace;
  disabled: boolean;
  operation?: "save" | "reset";
  savedNotice: boolean;
  editorRevision?: number;
  onWorkspaceChange: (workspace: SettingsWorkspace) => void;
  onPreview: (preferences: ApplicationPreferences) => void;
  onSave: (preferences: ApplicationPreferences) => Promise<void>;
  onReset: () => Promise<void>;
  updatePanel?: ReactNode;
}

export type SettingsWorkspace = "appearance" | "updates";

const zoomOptions = [100, 125, 150, 175, 200];

export function SettingsPanel({
  savedPreferences,
  messages,
  workspace,
  disabled,
  operation,
  savedNotice,
  editorRevision = 0,
  onWorkspaceChange,
  onPreview,
  onSave,
  onReset,
  updatePanel,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState(savedPreferences);

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
  const busy = operation !== undefined;

  function preview(next: ApplicationPreferences) {
    setDraft(next);
    onPreview(next);
  }

  function discardPreview() {
    setDraft(savedPreferences);
    onPreview(savedPreferences);
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

          {!busy && (dirty || savedNotice) && (
            <p className="settings-status" role="status" aria-live="polite">
              {dirty ? messages.unsaved : messages.saved}
            </p>
          )}

          <div className="settings-actions">
            <button
              type="button"
              className="secondary"
              disabled={disabled || busy}
              onClick={() => void onReset()}
            >
              {messages.restore}
            </button>
            {dirty && !busy && (
              <button
                type="button"
                className="secondary settings-discard"
                disabled={disabled}
                onClick={discardPreview}
              >
                {messages.discard}
              </button>
            )}
            <ProgressSubmitButton
              loading={operation === "save"}
              disabled={disabled || busy || !dirty}
              actionLabel={messages.save}
              progressLabel={messages.saving}
            />
            {operation === "reset" && (
              <span className="progress-submit-status" role="status" aria-live="polite">
                {messages.restoring}
              </span>
            )}
          </div>
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
