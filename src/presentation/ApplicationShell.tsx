import { Fragment, type ReactNode } from "react";

import fitfreedIcon from "../../assets/brand/fitfreed-icon.svg";
import {
  applicationNavigationItems,
  applicationShellLabels,
  type ApplicationHome,
  type ApplicationShellMessages,
  navigationIconPaths,
  type NavigationIconKind,
} from "./application-shell-model";

export type { ApplicationHome, ApplicationShellMessages } from "./application-shell-model";

interface ApplicationShellProps {
  activeHome: ApplicationHome;
  messages: ApplicationShellMessages;
  exploreDisabled: boolean;
  exploreRestriction?: {
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  activeOperation?: {
    label: string;
    detail: string;
    actionLabel: string;
    onAction: () => void;
  };
  children: ReactNode;
  onNavigate: (destination: ApplicationHome) => void;
}

function NavigationIcon({ kind }: { kind: NavigationIconKind }) {
  return (
    <svg className="shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={navigationIconPaths[kind]} />
    </svg>
  );
}

export function ApplicationShell({
  activeHome,
  messages,
  exploreDisabled,
  exploreRestriction,
  activeOperation,
  children,
  onNavigate,
}: ApplicationShellProps) {
  const labels = applicationShellLabels(messages);

  return (
    <div className="app-shell">
      <aside
        className="app-sidebar"
        aria-label={messages.sidebar}
        data-reveal-obstruction="compact-top"
      >
        <div className="shell-brand">
          <img src={fitfreedIcon} alt="" aria-hidden="true" />
          <span className="shell-brand-name">FitFreed</span>
        </div>
        <nav aria-label={messages.navigation}>
          <p className="shell-nav-group">{messages.exploreGroup}</p>
          {applicationNavigationItems.slice(0, 3).map(({ destination, icon }) => (
            <Fragment key={destination}>
              <button
                type="button"
                data-home={destination}
                aria-label={labels[destination]}
                aria-current={activeHome === destination ? "page" : undefined}
                aria-describedby={destination === "explore" && exploreRestriction
                  ? "shell-explore-restriction"
                  : undefined}
                disabled={destination === "explore" && exploreDisabled}
                onClick={() => onNavigate(destination)}
              >
                <NavigationIcon kind={icon} />
                <span>{labels[destination]}</span>
              </button>
              {destination === "explore" && exploreRestriction && (
                <div className="shell-nav-restriction">
                  <span id="shell-explore-restriction">{exploreRestriction.message}</span>
                  {exploreRestriction.actionLabel && exploreRestriction.onAction && (
                    <button type="button" onClick={exploreRestriction.onAction}>
                      {exploreRestriction.actionLabel}
                    </button>
                  )}
                </div>
              )}
            </Fragment>
          ))}
          <p className="shell-nav-group shell-nav-library-group">{messages.libraryGroup}</p>
          {applicationNavigationItems.slice(3).map(({ destination, icon }) => (
            <button
              key={destination}
              type="button"
              data-home={destination}
              aria-label={labels[destination]}
              aria-current={activeHome === destination ? "page" : undefined}
              onClick={() => onNavigate(destination)}
            >
              <NavigationIcon kind={icon} />
              <span>{labels[destination]}</span>
            </button>
          ))}
        </nav>
        <div className="shell-local-boundary">
          <span aria-hidden="true" />
          <div>
            <strong>{messages.localTitle}</strong>
            <small>{messages.localDetail}</small>
          </div>
        </div>
      </aside>
      <div className="shell-workspace">
        {activeOperation && (
          <section
            className="shell-active-operation"
            role="status"
            aria-label={activeOperation.label}
            aria-live="polite"
          >
            <div>
              <strong>{activeOperation.label}</strong>
              <span>{activeOperation.detail}</span>
            </div>
            <button type="button" className="secondary" onClick={activeOperation.onAction}>
              {activeOperation.actionLabel}
            </button>
          </section>
        )}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
