import fitfreedIcon from "../assets/brand/fitfreed-icon.svg";
import type { StartupShellCatalog } from "./locales/startup-catalogs";
import {
  applicationNavigationItems,
  applicationShellLabels,
  type ApplicationHome,
  navigationIconPaths,
  type NavigationIconKind,
} from "./presentation/application-shell-model";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function htmlElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  return element;
}

function textElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  text: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = htmlElement(tagName, className);
  element.textContent = text;
  return element;
}

function navigationIcon(kind: NavigationIconKind) {
  const icon = document.createElementNS(SVG_NAMESPACE, "svg");
  icon.classList.add("shell-nav-icon");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", navigationIconPaths[kind]);
  icon.append(path);
  return icon;
}

function navigationButton(
  destination: ApplicationHome,
  icon: NavigationIconKind,
  label: string,
) {
  const button = htmlElement("button");
  button.type = "button";
  button.dataset.home = destination;
  button.setAttribute("aria-label", label);
  button.append(navigationIcon(icon), textElement("span", label));
  return button;
}

export interface StartupShellView {
  selectedHome: () => ApplicationHome;
}

export function renderStartupMark(root: HTMLElement) {
  const surface = htmlElement("main", "startup-surface");
  surface.setAttribute("aria-busy", "true");
  surface.setAttribute("aria-label", "FitFreed");
  const mark = htmlElement("div", "startup-mark");
  mark.append(textElement("strong", "FitFreed"));
  const progress = htmlElement("progress");
  progress.setAttribute("aria-label", "FitFreed");
  mark.append(progress);
  surface.append(mark);
  root.replaceChildren(surface);
}

export function renderStartupShell(
  root: HTMLElement,
  messages: StartupShellCatalog,
): StartupShellView {
  let activeHome: ApplicationHome = "home";
  const labels = applicationShellLabels(messages);
  const buttons = new Map<ApplicationHome, HTMLButtonElement>();
  const shell = htmlElement("div", "app-shell");
  const sidebar = htmlElement("aside", "app-sidebar");
  sidebar.setAttribute("aria-label", messages.sidebar);
  sidebar.dataset.revealObstruction = "compact-top";

  const brand = htmlElement("div", "shell-brand");
  const brandImage = htmlElement("img");
  brandImage.src = fitfreedIcon;
  brandImage.alt = "";
  brandImage.setAttribute("aria-hidden", "true");
  brand.append(brandImage, textElement("span", "FitFreed", "shell-brand-name"));
  sidebar.append(brand);

  const navigation = htmlElement("nav");
  navigation.setAttribute("aria-label", messages.navigation);
  navigation.append(textElement("p", messages.exploreGroup, "shell-nav-group"));

  for (const { destination, icon } of applicationNavigationItems.slice(0, 3)) {
    const button = navigationButton(destination, icon, labels[destination]);
    buttons.set(destination, button);
    if (destination === "explore") {
      button.disabled = true;
      button.setAttribute("aria-describedby", "shell-explore-restriction");
    }
    navigation.append(button);
    if (destination === "explore") {
      const restriction = htmlElement("div", "shell-nav-restriction");
      restriction.append(textElement("span", messages.historyLoading));
      restriction.firstElementChild?.setAttribute("id", "shell-explore-restriction");
      navigation.append(restriction);
    }
  }

  navigation.append(textElement(
    "p",
    messages.libraryGroup,
    "shell-nav-group shell-nav-library-group",
  ));
  for (const { destination, icon } of applicationNavigationItems.slice(3)) {
    const button = navigationButton(destination, icon, labels[destination]);
    buttons.set(destination, button);
    navigation.append(button);
  }

  function selectHome(destination: ApplicationHome) {
    activeHome = destination;
    for (const [candidate, button] of buttons) {
      if (candidate === destination) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }
  for (const [destination, button] of buttons) {
    button.addEventListener("click", () => selectHome(destination));
  }
  selectHome(activeHome);

  sidebar.append(navigation);
  const localBoundary = htmlElement("div", "shell-local-boundary");
  localBoundary.append(htmlElement("span"));
  localBoundary.firstElementChild?.setAttribute("aria-hidden", "true");
  const localCopy = htmlElement("div");
  localCopy.append(
    textElement("strong", messages.localTitle),
    textElement("small", messages.localDetail),
  );
  localBoundary.append(localCopy);
  sidebar.append(localBoundary);

  const workspace = htmlElement("div", "shell-workspace");
  const content = htmlElement("main", "app-content");
  const loading = textElement("p", messages.loading, "loading-surface");
  loading.setAttribute("role", "status");
  loading.setAttribute("aria-live", "polite");
  content.append(loading);
  workspace.append(content);
  shell.append(sidebar, workspace);
  root.replaceChildren(shell);

  return {
    selectedHome: () => activeHome,
  };
}
