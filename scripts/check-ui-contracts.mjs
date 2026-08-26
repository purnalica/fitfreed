import { readdirSync, readFileSync, statSync } from "node:fs";
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
const trainingSessionEvidenceSummary = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingSessionEvidenceSummary.tsx",
), "utf8");
const trainingRanges = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingRangesPanel.tsx",
), "utf8");
const trainingRangeInteraction = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingRangeInteractionProvider.tsx",
), "utf8");
const trainingRangeEditor = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingRangeEditor.tsx",
), "utf8");
const trainingRangeEditorModel = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "training-range-editor-model.ts",
), "utf8");
const trainingRangeEvidencePicker = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingRangeEvidencePicker.tsx",
), "utf8");
const trainingRangeEvidenceEditor = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingRangeEvidenceEditor.tsx",
), "utf8");
const trainingStructureWorkbench = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingStructureWorkbench.tsx",
), "utf8");
const keyboardKey = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "keyboard-key.ts",
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
const sportClassificationTask = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "SportClassificationTask.tsx",
), "utf8");
const routeWorkbenchPath = path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingRouteWorkbench.tsx",
);
const routeWorkbench = readFileSync(routeWorkbenchPath, "utf8");
const signalWorkbench = readFileSync(path.join(
  repositoryRoot,
  "src",
  "presentation",
  "TrainingSignalWorkbench.tsx",
), "utf8");
const leafletAdapterPath = path.join(
  repositoryRoot,
  "src",
  "presentation",
  "leaflet-route-adapter.ts",
);
const leafletAdapter = readFileSync(leafletAdapterPath, "utf8");
const packageManifest = JSON.parse(readFileSync(
  path.join(repositoryRoot, "package.json"),
  "utf8",
));
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

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(candidate);
    return /\.[cm]?[jt]sx?$/.test(entry.name) && statSync(candidate).isFile()
      ? [candidate]
      : [];
  });
}

for (const sourcePath of sourceFiles(path.join(repositoryRoot, "src"))) {
  const source = readFileSync(sourcePath, "utf8");
  if (/<dl\s+[^>]*role=/.test(source)) {
    throw new Error(
      `description-list semantics must not be overridden in ${path.relative(repositoryRoot, sourcePath)}`,
    );
  }
}

const presentationDirectory = path.join(repositoryRoot, "src", "presentation");
const applicationSourceDirectory = path.join(repositoryRoot, "src");
const canonicalFormatterPath = path.join(
  presentationDirectory,
  "presentation-format.ts",
);
const canonicalDataTablePath = path.join(
  presentationDirectory,
  "DataTable.tsx",
);
const adHocFormatterConsumers = sourceFiles(applicationSourceDirectory).filter((sourcePath) => {
  if (sourcePath === canonicalFormatterPath || /\.test\.[cm]?[jt]sx?$/.test(sourcePath)) {
    return false;
  }
  return /new Intl\.(?:DateTimeFormat|NumberFormat|PluralRules)\s*\(/.test(
    readFileSync(sourcePath, "utf8"),
  );
});
if (adHocFormatterConsumers.length > 0) {
  throw new Error(
    `application presentation sources must use named policies from presentation-format.ts: ${adHocFormatterConsumers
      .map((sourcePath) => path.relative(repositoryRoot, sourcePath))
      .join(", ")}`,
  );
}

const rawDataTableConsumers = sourceFiles(applicationSourceDirectory).filter((sourcePath) => {
  if (sourcePath === canonicalDataTablePath || /\.test\.[cm]?[jt]sx?$/.test(sourcePath)) {
    return false;
  }
  return /<table(?:\s|>)/.test(readFileSync(sourcePath, "utf8"));
});
if (rawDataTableConsumers.length > 0) {
  throw new Error(
    `application presentation sources must use DataTable for semantic labelling, scrolling, and alignment: ${rawDataTableConsumers
      .map((sourcePath) => path.relative(repositoryRoot, sourcePath))
      .join(", ")}`,
  );
}
if (/(?:th|td):(?:last-child|first-child|nth-child\([^)]*\)|not\(:first-child\))[^{}]*\{[^}]*text-align\s*:/.test(stylesheet)) {
  throw new Error("table alignment must follow value semantics rather than column position");
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
  ":root",
  [/--measure-reading:\s*72ch/],
  "one explicit reading-prose measure",
);
for (const selector of [
  ".library-home-heading > p:not(.eyebrow)",
  ".sources-heading > p:not(.eyebrow)",
  ".explorer-workspace-heading > p:last-child",
  ".training-workspace-heading > p:last-child",
  ".reports-hero > p:last-child",
  ".settings-heading > p:last-child",
]) {
  requireRule(
    stylesheet,
    selector,
    [/max-width:\s*var\(--measure-reading\)/],
    "the shared reading-prose measure",
  );
}
for (const selector of [
  ".library-home-reveal > p",
  ".library-home-highlight-copy > p:last-child",
  ".library-home-coverage-heading p",
  ".source-operation-error",
  ".source-active-operation h2 + p",
  ".source-active-delayed",
  ".source-path > p:not(.path)",
  ".source-guide-heading > div > p:last-child",
  ".outcome-consequence",
  ".outcome-terminal-message",
  ".outcome-terminal-detail p",
  ".answer-insufficient p",
  ".training-session-empty-result p",
  ".training-sports-heading p",
  ".training-detail-section > p:first-child",
  ".training-route-workbench-heading h3 + p",
  ".training-route-signal-lanes > header p",
  ".training-signal-workbench-heading h3 + p",
  ".training-signal-workbench footer p",
  ".training-structure-workbench-heading h3 + p",
  ".training-structure-workbench footer p",
  ".training-zone-workbench-heading h3 + p",
  ".training-zone-workbench footer p",
  ".training-session-evidence-summary h3 + p",
  ".training-cross-signal > header p",
  ".training-provenance-disclosure > div p",
  ".training-ranges-heading p",
  ".report-empty-editor p",
  ".settings-section-heading p",
  ".settings-field > small",
]) {
  const block = balancedBlock(
    stylesheet,
    selector,
    `${selector} must use its allocated composition width`,
  );
  if (/max-width\s*:/.test(block)) {
    throw new Error(`${selector} must use its allocated composition width`);
  }
}
for (const boundary of [
  '"save_training_sport_classification"',
  "expectedRevision: sport.classification.revision",
  "onOverviewChange(result.overview)",
  "onSaved(result)",
  "onClick={onCancel}",
  'void persist(null, null, "reset")',
]) {
  if (!sportClassificationTask.includes(boundary)) {
    throw new Error(`sport classification must retain its application contract: ${boundary}`);
  }
}
requireRule(
  stylesheet,
  ".training-sport-editor",
  [
    /align-items:\s*start/,
    /scroll-margin-block-start:\s*var\(--shell-reveal-offset\)/,
  ],
  "aligned form regions independent of adjacent help and validation height",
);
requireRule(
  stylesheet,
  ".training-sport-editor-field",
  [
    /grid-row:\s*span\s+4/,
    /grid-template-rows:\s*subgrid/,
    /align-content:\s*start/,
  ],
  "labels and controls anchored to the start of each form region",
);
requireRule(
  stylesheet,
  ".training-sport-editor-actions",
  [/grid-column:\s*1\s*\/\s*-1/],
  "an action row spanning the supported grid without implicit columns",
);
requireRule(
  stylesheet,
  ".training-sport-editor-field :is(input, select)",
  [
    /height:\s*max\(44px,\s*calc\(1\.3em\s*\+\s*22px\)\)/,
    /line-height:\s*1\.3/,
  ],
  "equal control geometry that scales with content zoom",
);
requireRule(
  stylesheet,
  ".training-sport-editor-field select {",
  [/appearance:\s*none/, /background-image:/],
  "a visible provider-neutral selector affordance after native geometry is normalized",
);
for (const zoom of ["150", "175", "200"]) {
  requireRule(
    stylesheet,
    `:root[data-content-zoom="${zoom}"] .training-sport-editor`,
    [/grid-template-columns:\s*1fr/],
    `a single-column classification task at ${zoom}% content zoom`,
  );
}
for (const [selector, maximum] of [
  [".sources-heading h1", "3rem"],
  [".explorer-workspace-heading h1", "2.8rem"],
  [".training-workspace-heading h1", "2.8rem"],
  [".reports-hero h1", "3rem"],
  [".settings-heading h1", "3rem"],
]) {
  const source = selector === ".settings-heading h1"
    ? stylesheet.slice(stylesheet.lastIndexOf(selector))
    : stylesheet;
  requireRule(
    source,
    selector,
    [new RegExp(`font-size:\\s*clamp\\([^;]+,\\s*${maximum.replace(".", "\\.")}\\)`)],
    "a restrained application-workspace heading scale",
  );
}
for (const selector of [
  ".library-home-sports .library-home-sport-open > span strong",
  ".library-home-recent-identity > strong",
]) {
  requireRule(
    stylesheet,
    selector,
    [/white-space:\s*normal/, /overflow-wrap:\s*anywhere/],
    "fully readable recorded and user-authored sport names",
  );
}
requireRule(
  stylesheet,
  ".answer-measurement",
  [/white-space:\s*nowrap/],
  "a result measurement that never isolates its unit from its value",
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
if (!trainingSessionLibrary.includes('className="training-history-sports-disclosure"')
  || !trainingSessionLibrary.includes('ref={sportIndexRef}')) {
  throw new Error("History must keep its complete sport index in one deliberate disclosure");
}
if (!trainingSessionLibrary.includes('sportIndexRef.current?.removeAttribute("open")')) {
  throw new Error("History sport navigation must return the applied result to the primary position");
}
if (!trainingSessionLibrary.includes('<h2\n                id="training-session-detail-heading"')) {
  throw new Error("an open training session must remain the level-two subject below Training");
}
for (const semanticHeadingSelector of [
  ".training-detail-heading h2",
  ".training-structure > h3",
  ".training-exercise > header h4",
  ".training-route-workbench-heading h3",
  ".training-signal-workbench-heading h3",
  ".training-structure-workbench-heading h3",
  ".training-zone-workbench-heading h3",
  ".training-session-evidence-summary h3",
]) {
  if (!stylesheet.includes(semanticHeadingSelector)) {
    throw new Error(`training heading styles must follow the semantic hierarchy: ${semanticHeadingSelector}`);
  }
}
requireRule(
  stylesheet,
  ".training-result-focus-target",
  [/scroll-margin-block-start:\s*var\(--shell-reveal-offset\)/],
  "revealed training evidence below persistent navigation",
);
requireRule(
  stylesheet,
  ".training-detail-section",
  [/scroll-margin-block-start:\s*var\(--shell-reveal-offset\)/],
  "selected session sections below persistent navigation",
);
for (const detailNavigationContract of [
  "requestDetailSectionFocus(initiatingElement)",
  "onClick={(event) => openDetailSection(section, event.currentTarget)}",
]) {
  if (!trainingSessionLibrary.includes(detailNavigationContract)) {
    throw new Error(`training detail navigation must reveal its selected section: ${detailNavigationContract}`);
  }
}
for (const section of ["overview", "ranges", "structure", "signals", "routes", "provenance"]) {
  if (!trainingSessionLibrary.includes(
    `ref={detailSection === "${section}" ? detailSectionFocusRef : undefined}`,
  )) {
    throw new Error(`training detail navigation must focus its ${section} section`);
  }
}
for (const resultFocusTarget of [
  "exactRouteHeadingRef",
  "exactSignalHeadingRef",
  "structureHeadingRef",
  "focusHeadingRef",
  "training-exact-selected-row training-result-focus-target",
]) {
  const sources = `${trainingSessionLibrary}\n${readFileSync(path.join(
    repositoryRoot,
    "src",
    "presentation",
    "TrainingSessionZonesPanel.tsx",
  ), "utf8")}`;
  if (!sources.includes(resultFocusTarget)) {
    throw new Error(`training evidence must preserve the shared reveal target: ${resultFocusTarget}`);
  }
}
if (packageManifest.dependencies?.leaflet !== "1.9.4"
  || packageManifest.devDependencies?.["@types/leaflet"] !== "1.9.22") {
  throw new Error("the local route viewport must use the reviewed exact Leaflet versions");
}
if (!routeWorkbench.includes('void import("./leaflet-route-adapter")')) {
  throw new Error("the route workbench must lazy-load its replaceable Leaflet adapter");
}
for (const focusedMapAccessibility of [
  'role={focused ? "dialog" : "region"}',
  "aria-modal={focused ? true : undefined}",
  'sibling.setAttribute("inert", "")',
  'document.body.style.overflow = "hidden"',
]) {
  if (!routeWorkbench.includes(focusedMapAccessibility)) {
    throw new Error(`the focused route workspace must isolate the modal map: ${focusedMapAccessibility}`);
  }
}
for (const deliberateMapInteraction of [
  "scrollWheelZoom: false",
  "keyboard: false",
  'element.addEventListener("focus", enableDeliberateWheelZoom)',
  'element.addEventListener("blur", disableIncidentalWheelZoom)',
  'element.addEventListener("keydown", navigateByKeyboard)',
  "localRouteViewportKeyboardAction(event.key)",
]) {
  if (!leafletAdapter.includes(deliberateMapInteraction)) {
    throw new Error(`the route viewport must preserve deliberate scroll interaction: ${deliberateMapInteraction}`);
  }
}
if (!trainingSessionLibrary.includes("<TrainingRouteWorkbench")) {
  throw new Error("a route-bearing session story must expose the route workbench before deep detail");
}
if (!trainingSessionLibrary.includes("<TrainingRangeInteractionProvider")
  || !trainingSessionLibrary.includes("<TrainingRangesPanel")) {
  throw new Error("session detail must compose one range controller around every range representation");
}
for (const rangeCommand of [
  "query_training_session_ranges",
  "query_training_session_range_summary",
  "create_training_session_range",
  "rename_training_session_range",
  "adjust_training_session_range",
  "remove_training_session_range",
]) {
  if (!trainingRangeInteraction.includes(`"${rangeCommand}"`)) {
    throw new Error(`the session range controller must retain its complete command path: ${rangeCommand}`);
  }
}
for (const parallelRangeTask of [
  trainingRanges,
  trainingRangeEditor,
  routeWorkbench,
  signalWorkbench,
]) {
  if (parallelRangeTask.includes('@tauri-apps/api/core')) {
    throw new Error("a range representation must not issue a command outside the session controller");
  }
}
for (const sharedRangeInteraction of [
  "useOptionalTrainingRangeInteraction",
  '<TrainingRangeEditor surface="route"',
  'openCreateEditor("route"',
  "pointIndexAtExactElapsed",
  "updateRangeSelection",
]) {
  if (!routeWorkbench.includes(sharedRangeInteraction)) {
    throw new Error(`the route range workspace must preserve ${sharedRangeInteraction}`);
  }
}
for (const sharedSignalRangeInteraction of [
  "useOptionalTrainingRangeInteraction",
  '<TrainingRangeEditor surface="signal"',
  'openCreateEditor("signal"',
  "sampleIndexAtExactElapsed",
  'scope === "signal-elapsed"',
]) {
  if (!signalWorkbench.includes(sharedSignalRangeInteraction)) {
    throw new Error(`the signal range workspace must preserve ${sharedSignalRangeInteraction}`);
  }
}
if (!keyboardKey.includes("steppedInputValueForKey")
  || !routeWorkbench.includes("steppedInputValueForKey")
  || !signalWorkbench.includes("steppedInputValueForKey")) {
  throw new Error("route and signal range handles must retain one explicit keyboard boundary");
}
for (const duplicateRangeIdentity of [
  "duplicateTitleCounts",
  "openWithTiming",
  "formatTrainingRangeTiming(range)",
]) {
  if (!trainingRanges.includes(duplicateRangeIdentity)) {
    throw new Error(`duplicate personal-range names must remain distinguishable: ${duplicateRangeIdentity}`);
  }
}
if (!routeWorkbench.includes("formatTrainingRangeChoice(range)")
  || !signalWorkbench.includes("formatTrainingRangeChoice(range)")) {
  throw new Error("workbench range selectors must distinguish equal authored titles by exact boundaries");
}
for (const [representation, source] of [
  ["route", routeWorkbench],
  ["signal", signalWorkbench],
]) {
  for (const contextLock of [
    "disabled={rangeInteraction?.editor !== undefined}",
    "disabled={rangeInteraction.busy || rangeInteraction.editor !== undefined}",
  ]) {
    if (!source.includes(contextLock)) {
      throw new Error(`${representation} range editing must retain its single-draft context lock`);
    }
  }
}
if (!trainingRanges.includes("<TrainingRangeEditor")
  || !trainingRangeEditor.includes("useTrainingRangeInteraction")) {
  throw new Error("the range library and evidence workbenches must compose one shared editor");
}
for (const exactRangeRule of [
  "BigInt(value)",
  "BigInt(started)",
  "findEstablishedCoordinate",
  "legacy-session-elapsed",
]) {
  if (!trainingRangeEditorModel.includes(exactRangeRule)) {
    throw new Error(`the personal-range editor must preserve ${exactRangeRule}`);
  }
}
if (/\bNumber\s*\(/.test(trainingRangeEditorModel)) {
  throw new Error("personal-range elapsed editing must not cross JavaScript Number");
}
for (const evidenceBoundaryContract of [
  [trainingRangeEvidencePicker, "useOptionalTrainingRangeInteraction"],
  [trainingRangeEvidencePicker, "openCreateEditor("],
  [trainingRangeEvidencePicker, "startedAtElapsedMilliseconds"],
  [trainingRangeEvidencePicker, "endedAtElapsedMilliseconds"],
  [trainingRangeEvidenceEditor, "restoreFocusAfterReveal"],
  [trainingRangeEvidenceEditor, "forceInitialFocus: true"],
  [trainingStructureWorkbench, 'scope: "exercise-elapsed"'],
  [trainingSessionLibrary, 'scope: "route-elapsed"'],
  [trainingSessionLibrary, 'scope: "signal-elapsed"'],
  [trainingSessionLibrary, '<TrainingRangeEvidenceEditor surface="exact"'],
]) {
  const [source, contract] = evidenceBoundaryContract;
  if (!source.includes(contract)) {
    throw new Error(`exact evidence must remain a personal-range entry point: ${contract}`);
  }
}
if (trainingRangeEvidencePicker.includes("@tauri-apps/api/core")
  || trainingRangeEvidenceEditor.includes("@tauri-apps/api/core")
  || trainingStructureWorkbench.includes("@tauri-apps/api/core")) {
  throw new Error("evidence boundary entry points must use the shared range controller");
}
requireRule(
  stylesheet,
  ".training-range-workspace",
  [/display:\s*grid/, /grid-template-columns:\s*minmax\(210px,\s*280px\)\s+minmax\(0,\s*1fr\)/],
  "a readable wide personal-range library and result",
);
requireRule(
  stylesheet,
  '.training-route-range-layout[data-has-range="true"]',
  [/display:\s*grid/, /grid-template-columns:\s*minmax\(0,\s*3fr\)\s+minmax\(240px,\s*1fr\)/],
  "a map-dominant wide route-range workspace",
);
requireRule(
  stylesheet,
  '.training-signal-range-layout[data-has-range="true"]',
  [/display:\s*grid/, /grid-template-columns:\s*minmax\(0,\s*3fr\)\s+minmax\(240px,\s*1fr\)/],
  "a chart-dominant wide signal-range workspace",
);
requireRule(
  stylesheet,
  ".analytical-chart-canvas",
  [/width:\s*100%/, /min-width:\s*0/],
  "a width-safe analytical renderer host",
);
requireRule(
  stylesheet,
  ".training-signal-visual > .analytical-chart-canvas",
  [/height:\s*clamp\(240px,\s*32vh,\s*340px\)/],
  "a readable but bounded session-detail chart",
);
requireRule(
  stylesheet,
  ".training-signal-workbench-plot > .analytical-chart-canvas",
  [/height:\s*clamp\(300px,\s*42vh,\s*480px\)/],
  "a prominent but laptop-bounded signal workbench chart",
);
for (const [laneCount, expectedHeight] of [
  ["2", /height:\s*clamp\(300px,\s*42vh,\s*360px\)/],
  ["3", /height:\s*clamp\(360px,\s*50vh,\s*440px\)/],
  ["4", /height:\s*clamp\(420px,\s*56vh,\s*500px\)/],
]) {
  requireRule(
    stylesheet,
    `.training-cross-signal-chart[data-lane-count="${laneCount}"] > .analytical-chart-canvas`,
    [expectedHeight],
    `a readable but laptop-bounded ${laneCount}-lane signal chart`,
  );
}
for (const obsoleteRendererSelector of [
  ".training-signal-visual svg",
  ".training-signal-workbench-plot svg",
  ".training-signal-workbench-plot polyline",
  ".training-cross-signal-lanes svg",
  ".training-cross-signal-lanes polyline",
]) {
  if (stylesheet.includes(obsoleteRendererSelector)) {
    throw new Error(`analytical chart CSS must not depend on renderer internals: ${obsoleteRendererSelector}`);
  }
}
requireRule(
  stylesheet,
  ".training-range-evidence-picker",
  [/display:\s*grid/, /grid-template-columns:/],
  "a compact exact-evidence boundary picker",
);
for (const zoom of ["175", "200"]) {
  if (!stylesheet.includes(`:root[data-content-zoom="${zoom}"] .training-range-workspace`)) {
    throw new Error(`personal-range work must stack at ${zoom}% content zoom`);
  }
  if (!stylesheet.includes(`:root[data-content-zoom="${zoom}"] .training-route-range-layout`)) {
    throw new Error(`route-range work must stack at ${zoom}% content zoom`);
  }
  if (!stylesheet.includes(`:root[data-content-zoom="${zoom}"] .training-signal-range-layout`)) {
    throw new Error(`signal-range work must stack at ${zoom}% content zoom`);
  }
  if (!stylesheet.includes(
    `:root[data-content-zoom="${zoom}"] .training-signal-visual > .analytical-chart-canvas`,
  ) || !stylesheet.includes(
    `:root[data-content-zoom="${zoom}"] .training-signal-workbench-plot > .analytical-chart-canvas`,
  ) || !stylesheet.includes(
    `:root[data-content-zoom="${zoom}"] .training-cross-signal-chart > .analytical-chart-canvas`,
  )) {
    throw new Error(`analytical charts must reserve zoom-responsive height at ${zoom}% content zoom`);
  }
  if (!stylesheet.includes(`:root[data-content-zoom="${zoom}"] .training-range-evidence-picker`)) {
    throw new Error(`exact-evidence boundary picking must stack at ${zoom}% content zoom`);
  }
}
for (const workbench of [
  ["TrainingSignalWorkbench", "training-signal-workbench"],
  ["TrainingStructureWorkbench", "training-structure-workbench"],
  ["TrainingZoneWorkbench", "training-zone-workbench"],
]) {
  const [component, selector] = workbench;
  if (!trainingSessionLibrary.includes(`<${component}`)) {
    throw new Error(`evidence-adaptive session detail must compose ${component}`);
  }
  requireRule(
    stylesheet,
    `.${selector}`,
    [
      /display:\s*grid/,
      /scroll-margin-block-start:\s*var\(--shell-reveal-offset\)/,
    ],
    `${component} as a responsive in-page reveal`,
  );
  for (const zoom of ["175", "200"]) {
    if (!stylesheet.includes(`:root[data-content-zoom="${zoom}"] .${selector}-heading`)
      || !stylesheet.includes(`:root[data-content-zoom="${zoom}"] .${selector} dl`)) {
      throw new Error(`${component} must reflow its heading and summary at ${zoom}% content zoom`);
    }
  }
}
const leafletConsumers = sourceFiles(path.join(repositoryRoot, "src")).filter((sourcePath) => (
  /(?:from\s+["']leaflet["']|import\s+["']leaflet\/dist\/leaflet\.css["'])/.test(
    readFileSync(sourcePath, "utf8"),
  )
));
if (leafletConsumers.length !== 1 || leafletConsumers[0] !== leafletAdapterPath) {
  throw new Error("Leaflet imports and types must remain confined to the presentation adapter");
}
for (const forbidden of [
  /\btileLayer\b/,
  /\bTileLayer\b/,
  /\bgeolocation\b/i,
  /\bgeocoder\b/i,
  /\.locate\s*\(/,
  /https?:\/\//,
  /@tauri-apps/,
  /\binvoke\s*\(/,
  /\.bindPopup\s*\(/,
  /html:\s*["']</,
]) {
  if (forbidden.test(leafletAdapter)) {
    throw new Error(`the local vector-only route adapter violates ${forbidden}`);
  }
}
requireRule(
  stylesheet,
  ".training-route-map-frame",
  [
    /height:\s*clamp\(320px,\s*48vh,\s*540px\)/,
    /overflow:\s*hidden/,
  ],
  "a dominant but laptop-bounded route viewport",
);
requireRule(
  stylesheet,
  ".training-route-workbench-controls select",
  [/height:\s*max\(44px,\s*1\.5em\)/],
  "native route selectors with a zoom-responsive explicit target height",
);
requireRule(
  stylesheet,
  '.training-route-workbench[data-focused="true"]',
  [/position:\s*fixed/, /inset:\s*12px/],
  "a reversible focused map workspace",
);
for (const zoom of ["175", "200"]) {
  if (!stylesheet.includes(
    `:root[data-content-zoom="${zoom}"] .training-route-map-frame`,
  )) {
    throw new Error(`the route workbench must bound its map explicitly at ${zoom}% content zoom`);
  }
}
requireRule(
  stylesheet,
  ".training-history-sports ul",
  [
    /display:\s*grid/,
    /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/,
  ],
  "every History sport identity without an unannounced continuation",
);
if (/overflow-x:\s*auto/.test(balancedBlock(
  stylesheet,
  ".training-history-sports ul",
  "History sport identities must have a visible complete composition",
))) {
  throw new Error("History sport identities must not rely on unannounced horizontal scrolling");
}
requireRule(
  stylesheet,
  ".training-history-sport-identity strong",
  [/white-space:\s*normal/, /overflow-wrap:\s*anywhere/],
  "complete visible History sport labels",
);
for (const zoom of ["150", "175", "200"]) {
  if (!stylesheet.includes(
    `:root[data-content-zoom="${zoom}"] .training-history-sports ul`,
  )) {
    throw new Error(`History sport composition must respond explicitly to ${zoom}% content zoom`);
  }
}
requireRule(
  stylesheet,
  ':root[data-content-zoom="150"] .training-history-sports ul',
  [/grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(500px,\s*100%\),\s*1fr\)\)/],
  "readable History sport identities at high content zoom",
);
for (const section of ["overview", "structure", "signals", "routes", "provenance"]) {
  if (!trainingSessionLibrary.includes(`hidden={detailSection !== "${section}"}`)) {
    throw new Error(`Training session detail must progressively disclose ${section}`);
  }
}
for (const boundary of [
  '<details className="training-session-evidence-disclosure">',
  "<summary>{copy.disclosureSummary}</summary>",
  'role="region"',
  "aria-label={copy.regionLabel}",
]) {
  if (!trainingSessionEvidenceSummary.includes(boundary)) {
    throw new Error(`Training session evidence must remain a labelled disclosure: ${boundary}`);
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
  'hidden={workspace !== "preview"\n                || refreshReviewOpen\n                || privacyReviewOpen\n                || deleteReviewOpen}',
  'setWorkspace("preview")',
  'className="report-composer-tools"',
  'className="report-delete-review"',
  'role="dialog"',
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
  'hidden={workspace !== "updates"}',
  "{updatePanel}",
]) {
  if (!settingsPanel.includes(boundary)) {
    throw new Error(`Settings must preserve category orientation: ${boundary}`);
  }
}
if (!application.includes('className="settings-home" hidden={activeHome !== "settings"}')) {
  throw new Error("Settings must remain mounted but hidden outside its application workspace");
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
const mobileWorkspace = balancedBlock(
  stylesheet,
  "@media (max-width: 680px)",
  "App.css must define the mobile workspace boundary",
);
for (const selector of [
  "training-signal-workbench",
  "training-structure-workbench",
  "training-zone-workbench",
]) {
  requireRule(
    mobileWorkspace,
    `.${selector} dl`,
    [/grid-template-columns:\s*1fr/],
    `${selector} summary without horizontal continuation`,
  );
  requireRule(
    mobileWorkspace,
    `.${selector} footer`,
    [/flex-direction:\s*column/],
    `${selector} actions below their evidence at compact width`,
  );
}
requireRule(
  stylesheet,
  ":root",
  [/--shell-reveal-offset:\s*24px/],
  "the default in-page reveal offset",
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
  [/position:\s*sticky/, /width:\s*100%/, /height:\s*auto/],
  "the labelled persistent compact navigation layout",
);
requireRule(
  compactNavigation,
  ":root",
  [/--shell-reveal-offset:\s*140px/],
  "the compact navigation reveal offset",
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
    `:root[data-content-zoom="${zoom}"] .app-sidebar`,
    [/position:\s*sticky/],
    "persistent high-zoom navigation",
  );
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
  requireRule(
    stylesheet,
    `:root[data-content-zoom="${zoom}"] .library-home-sports ul`,
    [/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/],
    "distinct Home sport identities at high zoom",
  );
  requireRule(
    stylesheet,
    `:root[data-content-zoom="${zoom}"] .library-home-sports li strong`,
    [/white-space:\s*normal/, /overflow-wrap:\s*anywhere/],
    "complete Home sport labels at high zoom",
  );
}

requireRule(
  stylesheet,
  ':root[data-content-zoom="175"],\n:root[data-content-zoom="200"]',
  [/--shell-reveal-offset:\s*210px/],
  "the high-zoom navigation reveal offset",
);
requireRule(
  stylesheet,
  ".training-route-workbench,",
  [/scroll-margin-block-start:\s*var\(--shell-reveal-offset\)/],
  "route workbench, map, and lane reveals below persistent navigation",
);

for (const selector of ["a:focus-visible", "summary:focus-visible"]) {
  if (!stylesheet.includes(selector)) {
    throw new Error(`${selector} must use the global visible-focus treatment`);
  }
}

requireRule(
  stylesheet,
  ".sr-only",
  [/position:\s*absolute/, /width:\s*1px/, /height:\s*1px/, /overflow:\s*hidden/],
  "the canonical visually hidden accessible-content treatment",
);
const unsupportedHiddenClassConsumers = sourceFiles(path.join(repositoryRoot, "src"))
  .filter((sourcePath) => readFileSync(sourcePath, "utf8").includes("visually-hidden"));
if (unsupportedHiddenClassConsumers.length > 0) {
  throw new Error("presentation sources must use the canonical sr-only class for visually hidden content");
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
  `${JSON.stringify({ motionDeclarations: motionDeclarations.length, reducedMotionBoundary: true, darkContrastOverrides: contrastContracts.size, labelledAdaptiveNavigation: true, broadWorkspace: true, roleBasedLineMeasure: true, alignedClassificationForm: true, progressiveTrainingWorkspace: true, evidenceAdaptiveSession: true, personalRanges: true, progressiveDomainWorkspaces: true, stagedReportWorkspace: true, secondarySources: true, categorizedSettings: true, centralizedFormatting: true, semanticDataTables: true, initialWindow: `${mainWindow.width}x${mainWindow.height}` })}\n`,
);
