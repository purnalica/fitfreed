import type { catalogs } from "../locales/catalogs";

type WindowsHelpMessages = (typeof catalogs)["en-US"]["settings"]["windowsHelp"];

interface WindowsInstalledHelpPanelProps {
  messages: WindowsHelpMessages;
}

export function WindowsInstalledHelpPanel({ messages }: WindowsInstalledHelpPanelProps) {
  return (
    <section
      className="installed-help"
      aria-labelledby="windows-installed-help-heading"
    >
      <header className="installed-help-heading">
        <h2 id="windows-installed-help-heading">{messages.heading}</h2>
        <p>{messages.intro}</p>
      </header>

      <p className="installed-help-boundary">
        <strong>{messages.supportedLabel}</strong>
        <span>{messages.supported}</span>
      </p>

      <div className="installed-help-topics">
        <details open>
          <summary>{messages.install.summary}</summary>
          <div>
            <p>{messages.install.verify}</p>
            <p>{messages.install.smartScreen}</p>
            <p>{messages.install.firstLaunch}</p>
          </div>
        </details>

        <details>
          <summary>{messages.update.summary}</summary>
          <div>
            <p>{messages.update.ordinary}</p>
            <p>{messages.update.recovery}</p>
            <p>{messages.update.offline}</p>
          </div>
        </details>

        <details>
          <summary>{messages.removal.summary}</summary>
          <div>
            <p>{messages.removal.application}</p>
            <p><code>%APPDATA%\org.fitfreed.desktop</code></p>
            <p>{messages.removal.library}</p>
          </div>
        </details>

        <details>
          <summary>{messages.unsupported.summary}</summary>
          <div>
            <p>{messages.unsupported.body}</p>
          </div>
        </details>
      </div>

      <p className="installed-help-privacy">{messages.privacy}</p>
    </section>
  );
}
