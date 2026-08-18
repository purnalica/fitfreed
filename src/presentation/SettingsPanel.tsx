import { useEffect, useState } from "react";

import type { catalogs } from "../locales/catalogs";
import {
  sameApplicationPreferences,
  type AppearancePreference,
  type ApplicationPreferences,
} from "./application-preferences";

type SettingsMessages = (typeof catalogs)["en-US"]["settings"];

interface SettingsPanelProps {
  savedPreferences: ApplicationPreferences;
  messages: SettingsMessages;
  disabled: boolean;
  saving: boolean;
  savedNotice: boolean;
  onPreview: (preferences: ApplicationPreferences) => void;
  onSave: (preferences: ApplicationPreferences) => Promise<void>;
  onReset: () => Promise<void>;
}

const zoomOptions = [100, 125, 150, 175, 200];

export function SettingsPanel({
  savedPreferences,
  messages,
  disabled,
  saving,
  savedNotice,
  onPreview,
  onSave,
  onReset,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState(savedPreferences);

  useEffect(() => {
    setDraft(savedPreferences);
  }, [
    savedPreferences.version,
    savedPreferences.locale,
    savedPreferences.appearance,
    savedPreferences.contentZoomPercent,
  ]);

  const dirty = !sameApplicationPreferences(draft, savedPreferences);

  function preview(next: ApplicationPreferences) {
    setDraft(next);
    onPreview(next);
  }

  return (
    <section className="settings-panel" aria-labelledby="settings-heading">
      <header className="settings-heading">
        <p className="eyebrow">{messages.eyebrow}</p>
        <h1 id="settings-heading">{messages.title}</h1>
        <p>{messages.intro}</p>
      </header>

      <div className="settings-layout">
        <form
          className="settings-form"
          aria-labelledby="appearance-settings-heading"
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
              disabled={disabled || saving}
              onChange={(event) => preview({
                ...draft,
                locale: event.target.value as ApplicationPreferences["locale"],
              })}
            >
              <option value="en-US">{messages.localeEnglish}</option>
              <option value="es-ES">{messages.localeSpanish}</option>
            </select>
          </div>

          <fieldset className="settings-field appearance-options" disabled={disabled || saving}>
            <legend>{messages.appearance}</legend>
            <small>{messages.appearanceBody}</small>
            <div>
              {(["system", "light", "dark"] as AppearancePreference[]).map((appearance) => (
                <label key={appearance}>
                  <input
                    type="radio"
                    name="appearance"
                    value={appearance}
                    checked={draft.appearance === appearance}
                    onChange={() => preview({ ...draft, appearance })}
                  />
                  <span>{messages[appearance]}</span>
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
              disabled={disabled || saving}
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

          {(dirty || savedNotice) && (
            <p className="settings-status" role="status" aria-live="polite">
              {dirty ? messages.unsaved : messages.saved}
            </p>
          )}

          <div className="settings-actions">
            <button
              type="button"
              className="secondary"
              disabled={disabled || saving}
              onClick={() => void onReset()}
            >
              {messages.restore}
            </button>
            <button type="submit" disabled={disabled || saving || !dirty}>
              {saving ? messages.saving : messages.save}
            </button>
          </div>
        </form>

        <aside className="settings-preview" aria-label={messages.preview}>
          <span>{messages.previewEyebrow}</span>
          <h2>{messages.previewTitle}</h2>
          <p>{messages.previewBody}</p>
          <div aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </aside>
      </div>
    </section>
  );
}
