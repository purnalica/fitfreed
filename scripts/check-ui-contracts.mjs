import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesheetPath = path.join(repositoryRoot, "src", "App.css");
const stylesheet = readFileSync(stylesheetPath, "utf8");
const applicationPath = path.join(repositoryRoot, "src", "App.tsx");
const application = readFileSync(applicationPath, "utf8");
const applicationShellPath = path.join(
  repositoryRoot,
  "src",
  "presentation",
  "ApplicationShell.tsx",
);
const applicationShell = readFileSync(applicationShellPath, "utf8");
const trainingInsights = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingInsightsPanel.tsx",
), "utf8");
const trainingSessionLibrary = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingSessionLibraryPanel.tsx",
), "utf8");
const workspaceNavigation = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "WorkspaceNavigation.tsx",
), "utf8");
const progressiveExplorerSources = new Map([
  ["Activity", { source: application, state: "activityWorkspace" }],
  ["Sleep", { source: readFileSync(path.join(repositoryRoot, "src", "presentation", "SleepInsightsPanel.tsx"), "utf8"), state: "workspace" }],
  ["Recovery", { source: readFileSync(path.join(repositoryRoot, "src", "presentation", "RecoveryInsightsPanel.tsx"), "utf8"), state: "workspace" }],
  ["Aligned history", { source: readFileSync(path.join(repositoryRoot, "src", "presentation", "LongitudinalInsightsPanel.tsx"), "utf8"), state: "workspace" }],
]);
const reportsPanel = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "ReportsPanel.tsx",
), "utf8");
const settingsPanel = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "SettingsPanel.tsx",
), "utf8");
const libraryHomePanel = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "LibraryHomePanel.tsx",
), "utf8");
const tauriConfiguration = JSON.parse(readFileSync(
  path.join(repositoryRoot, "src-tauri", "tauri.conf.json"),
  "utf8",
));

function balancedBlock(source, marker, contract) {
  const markerStart = source.indexOf(marker);
  if (markerStart < 0) throw new Error(contract);
  const openingBrace = source.indexOf("{", markerStart);
  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingBrace + 1, index);
    }
  }
  throw new Error(`${marker} block is not balanced`);
}

function requireRule(source, selector, declarations, contract) {
  const block = balancedBlock(source, selector, `${selector} must exist for ${contract}`);
  for (const declaration of declarations) {
    if (!declaration.test(block)) {
      throw new Error(`${selector} must preserve ${contract}`);
    }
  }
}

if (/\bfallback=\{null\}/.test(application)) {
  throw new Error("lazy presentation boundaries must expose a visible loading status");
}

if (!application.includes("<ApplicationShell")) {
  throw new Error("App must render the shared application shell");
}
if (!/<aside\s+className="app-sidebar"\s+aria-label=/.test(applicationShell)) {
  throw new Error("the application shell must expose semantic primary navigation");
}
if (!applicationShell.includes('{ destination: "home", icon: "home" }')) {
  throw new Error("the application shell must expose Home as an explicit destination");
}
if (!applicationShell.includes("fitfreed-icon.svg")) {
  throw new Error("the application shell must use the approved FitFreed brand asset");
}

requireRule(
  stylesheet,
  ".app-shell",
  [/display:\s*grid/, /grid-template-columns:\s*240px\s+minmax\(0,\s*1fr\)/],
  "the full-height desktop sidebar layout",
);
requireRule(
  stylesheet,
  ".app-sidebar",
  [/position:\s*sticky/, /height:\s*100vh/, /width:\s*240px/],
  "persistent desktop navigation",
);
requireRule(
  stylesheet,
  ".app-content",
  [/width:\s*min\(1600px,\s*calc\(100%\s*-\s*56px\)\)/],
  "the broad desktop workspace",
);
requireRule(
  stylesheet,
  "[hidden]",
  [/display:\s*none\s*!important/],
  "semantic progressive disclosure",
);

if (!trainingInsights.includes("aria-label={messages.training.workspaceNavigation}")) {
  throw new Error("Training must expose its workspace navigation to assistive technology");
}
for (const workspace of ["sessions", "sports", "comparison"]) {
  if (!trainingInsights.includes(`hidden={workspace !== "${workspace}"}`)) {
    throw new Error(`Training must progressively disclose the ${workspace} workspace`);
  }
}
if (!trainingSessionLibrary.includes("aria-label={copy.detailNavigation}")) {
  throw new Error("Training session detail must expose its section navigation");
}
for (const section of ["overview", "structure", "signals", "routes", "provenance"]) {
  if (!trainingSessionLibrary.includes(`hidden={detailSection !== "${section}"}`)) {
    throw new Error(`Training session detail must progressively disclose ${section}`);
  }
}
if (!workspaceNavigation.includes('aria-label={label}')) {
  throw new Error("shared workspace navigation must expose its label");
}
for (const [explorer, { source, state }] of progressiveExplorerSources) {
  if (!source.includes("<WorkspaceNavigation")) {
    throw new Error(`${explorer} must use the shared workspace navigation`);
  }
  if (!source.includes(`hidden={${state} !== "comparison"}`)) {
    throw new Error(`${explorer} must progressively disclose period comparison`);
  }
  if (!source.includes(`hidden={${state} !== "history"`)) {
    throw new Error(`${explorer} must progressively disclose history and exact detail`);
  }
}
for (const boundary of [
  "<WorkspaceNavigation",
  'hidden={workspace !== "library"}',
  'hidden={workspace !== "compose"}',
  'hidden={workspace !== "preview" || refreshReviewOpen || privacyReviewOpen}',
  'setWorkspace("preview")',
  'className="report-composer-tools"',
]) {
  if (!reportsPanel.includes(boundary)) {
    throw new Error(`Reports must preserve the staged workspace boundary: ${boundary}`);
  }
}
for (const boundary of [
  "<WorkspaceNavigation",
  'hidden={workspace !== "appearance"}',
  '{ workspace: "appearance", label: messages.workspaces.appearance }',
  '{ workspace: "updates", label: messages.workspaces.updates }',
]) {
  if (!settingsPanel.includes(boundary)) {
    throw new Error(`Settings must preserve category orientation: ${boundary}`);
  }
}
if (!application.includes(
  'hidden={activeHome !== "settings" || settingsWorkspace !== "updates"}',
)) {
  throw new Error("update maintenance must be isolated in its Settings category");
}
if (!application.includes('useState<ApplicationHome>("home")')
  || !libraryHomePanel.includes("onClick={onOpenSources}")) {
  throw new Error("empty startup must lead from value-first Home into secondary Sources");
}

const compactNavigation = balancedBlock(
  stylesheet,
  "@media (max-width: 1080px)",
  "App.css must define the compact navigation boundary",
);
requireRule(
  compactNavigation,
  ".app-shell",
  [/grid-template-columns:\s*1fr/, /grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/],
  "the labelled compact navigation layout",
);

const mainWindow = tauriConfiguration.app?.windows?.[0];
if (mainWindow?.width < 1280 || mainWindow?.height < 800) {
  throw new Error("the initial desktop window must expose the broad workspace");
}
requireRule(
  compactNavigation,
  ".app-sidebar",
  [/width:\s*100%/, /height:\s*auto/],
  "the labelled compact navigation layout",
);
requireRule(
  compactNavigation,
  ".app-sidebar nav",
  [/grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/],
  "all five named workspaces",
);
if (compactNavigation.includes(".app-sidebar nav button > span")) {
  throw new Error("compact primary navigation must not visually hide workspace labels");
}
for (const zoom of ["175", "200"]) {
  if (!stylesheet.includes(`:root[data-content-zoom="${zoom}"] .app-shell`)
    || !stylesheet.includes(`:root[data-content-zoom="${zoom}"] .app-sidebar nav`)) {
    throw new Error(`${zoom}% content zoom must use labelled horizontal navigation`);
  }
  requireRule(
    stylesheet,
    `:root[data-content-zoom="${zoom}"] .library-home-empty`,
    [/grid-template-columns:\s*1fr/],
    "first-run actions before the illustrative preview at high zoom",
  );
  requireRule(
    stylesheet,
    `:root[data-content-zoom="${zoom}"] .library-home-empty h1`,
    [/max-width:\s*26ch/],
    "a readable first-run heading that does not bury the primary action at high zoom",
  );
}

for (const selector of ["a:focus-visible", "summary:focus-visible"]) {
  if (!stylesheet.includes(selector)) {
    throw new Error(`${selector} must use the global visible-focus treatment`);
  }
}

if (!stylesheet.includes(':is(input, select, textarea)[aria-invalid="true"]')) {
  throw new Error("invalid form controls must share the visible field-error treatment");
}

const reducedMotionQuery = "@media (prefers-reduced-motion: no-preference)";
const queryStart = stylesheet.indexOf(reducedMotionQuery);
if (queryStart < 0) {
  throw new Error("App.css must define the reduced-motion animation boundary");
}

const blockStart = stylesheet.indexOf("{", queryStart);
let depth = 0;
let blockEnd = -1;
for (let index = blockStart; index < stylesheet.length; index += 1) {
  if (stylesheet[index] === "{") depth += 1;
  if (stylesheet[index] === "}") {
    depth -= 1;
    if (depth === 0) {
      blockEnd = index;
      break;
    }
  }
}
if (blockEnd < 0) throw new Error("reduced-motion media block is not balanced");

const motionDeclarations = [
  ...stylesheet.matchAll(/\b(?:animation(?:-[a-z-]+)?|transition(?:-[a-z-]+)?):/g),
];
for (const declaration of motionDeclarations) {
  if (declaration.index < blockStart || declaration.index > blockEnd) {
    throw new Error(
      `motion declaration outside ${reducedMotionQuery} at offset ${declaration.index}`,
    );
  }
}

const darkQuery = "@media (prefers-color-scheme: dark)";
const darkStart = stylesheet.indexOf(darkQuery);
if (darkStart < 0) throw new Error("App.css must define the dark appearance boundary");
const nextMediaStart = stylesheet.indexOf("@media", darkStart + darkQuery.length);
const darkBlock = stylesheet.slice(
  darkStart,
  nextMediaStart < 0 ? stylesheet.length : nextMediaStart,
);
const contrastContracts = new Map([
  [".eyebrow", "--accent-deep"],
  [".source-path > span", "--muted"],
  [".notice", "--ink"],
  [".error", "--danger-ink"],
  [".field-error", "--danger-ink"],
  [".recovery-summary span", "--ink-soft"],
]);
const explicitDarkStart = stylesheet.indexOf(':root[data-appearance="dark"]');
if (explicitDarkStart < 0) throw new Error("App.css must define explicit dark appearance tokens");
const explicitDarkEnd = stylesheet.indexOf("}", explicitDarkStart);
const explicitDarkBlock = stylesheet.slice(explicitDarkStart, explicitDarkEnd);
for (const [selector, token] of contrastContracts) {
  const escapedSelector = selector.replace(".", "\\.");
  const foregroundRule = new RegExp(
    `${escapedSelector}\\s*\\{[^}]*\\bcolor:\\s*var\\(${token}\\)`,
  );
  if (!foregroundRule.test(stylesheet)) {
    throw new Error(`${selector} must use its contrast foreground token ${token}`);
  }
  if (!explicitDarkBlock.includes(`${token}:`) || !darkBlock.includes(`${token}:`)) {
    throw new Error(`${token} must exist for explicit and system dark appearance`);
  }
}

process.stdout.write(
  `${JSON.stringify({ motionDeclarations: motionDeclarations.length, reducedMotionBoundary: true, darkContrastOverrides: contrastContracts.size, labelledAdaptiveNavigation: true, broadWorkspace: true, progressiveTrainingWorkspace: true, progressiveDomainWorkspaces: true, stagedReportWorkspace: true, secondarySources: true, categorizedSettings: true, initialWindow: `${mainWindow.width}x${mainWindow.height}` })}\n`,
);
