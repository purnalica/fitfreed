import type { ReactNode } from "react";

import fitfreedIcon from "../../assets/brand/fitfreed-icon.svg";

export type ApplicationHome = "home" | "explore" | "reports" | "sources" | "settings";

export interface ApplicationShellMessages {
  navigation: string;
  sidebar: string;
  home: string;
  explore: string;
  sources: string;
  reports: string;
  settings: string;
  exploreGroup: string;
  libraryGroup: string;
  localTitle: string;
  localDetail: string;
}

interface ApplicationShellProps {
  activeHome: ApplicationHome;
  messages: ApplicationShellMessages;
  exploreDisabled: boolean;
  children: ReactNode;
  onNavigate: (destination: ApplicationHome) => void;
}

const navigationItems: Array<{
  destination: ApplicationHome;
  icon: "home" | "explore" | "reports" | "sources" | "settings";
}> = [
  { destination: "home", icon: "home" },
  { destination: "explore", icon: "explore" },
  { destination: "reports", icon: "reports" },
  { destination: "sources", icon: "sources" },
  { destination: "settings", icon: "settings" },
];

function NavigationIcon({ kind }: { kind: typeof navigationItems[number]["icon"] }) {
  const paths = {
    home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
    explore: "M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7Zm3.5 4a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
    reports: "M5 3h14a2 2 0 0 1 2 2v16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 13h2V9H8Zm4 0h2V6h-2Zm4 0h2v-4h-2Z",
    sources: "M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 5c0 1.7 3.6 3 8 3s8-1.3 8-3v3c0 1.7-3.6 3-8 3s-8-1.3-8-3Zm0 8v-3c0 1.7 3.6 3 8 3s8-1.3 8-3v3c0 1.7-3.6 3-8 3s-8-1.3-8-3Z",
    settings: "M9.8 2h4.4l.7 2.5c.5.2 1 .5 1.4.8l2.5-.7 2.2 3.8-1.8 1.8a8 8 0 0 1 0 1.6l1.8 1.8-2.2 3.8-2.5-.7c-.4.3-.9.6-1.4.8l-.7 2.5H9.8l-.7-2.5c-.5-.2-1-.5-1.4-.8l-2.5.7L3 13.6l1.8-1.8a8 8 0 0 1 0-1.6L3 8.4l2.2-3.8 2.5.7c.4-.3.9-.6 1.4-.8Zm2.2 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z",
  } as const;
  return (
    <svg className="shell-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[kind]} />
    </svg>
  );
}

export function ApplicationShell({
  activeHome,
  messages,
  exploreDisabled,
  children,
  onNavigate,
}: ApplicationShellProps) {
  const labels: Record<ApplicationHome, string> = {
    home: messages.home,
    explore: messages.explore,
    reports: messages.reports,
    sources: messages.sources,
    settings: messages.settings,
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label={messages.sidebar}>
        <div className="shell-brand">
          <img src={fitfreedIcon} alt="" aria-hidden="true" />
          <span className="shell-brand-name">FitFreed</span>
        </div>
        <nav aria-label={messages.navigation}>
          <p className="shell-nav-group">{messages.exploreGroup}</p>
          {navigationItems.slice(0, 3).map(({ destination, icon }) => (
            <button
              key={destination}
              type="button"
              data-home={destination}
              aria-label={labels[destination]}
              aria-current={activeHome === destination ? "page" : undefined}
              disabled={destination === "explore" && exploreDisabled}
              onClick={() => onNavigate(destination)}
            >
              <NavigationIcon kind={icon} />
              <span>{labels[destination]}</span>
            </button>
          ))}
          <p className="shell-nav-group shell-nav-library-group">{messages.libraryGroup}</p>
          {navigationItems.slice(3).map(({ destination, icon }) => (
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
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
