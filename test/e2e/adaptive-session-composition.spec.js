import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/webdriverio";

import { e2eApplicationBinary } from "../../scripts/e2e-paths.mjs";
import {
  goToHome,
  openHomeQuestion,
  openSettingsCategory,
  persistSettings,
  resizeApplication,
  selectArchive,
  selectLocale,
} from "./support/application-actions.js";
import { recordRestartProcessIdentity } from "./support/application-process.js";

const english = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/en-US.json", import.meta.url), "utf8"),
);
const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);
const fixtureDirectory = process.env.FITFREED_E2E_FIXTURE_DIRECTORY;
const restartIdentityPath = process.env.FITFREED_E2E_RESTART_IDENTITY_PATH;
const evidenceDirectory = path.resolve(".artifacts/e2e/evidence");

async function waitForNotice(fragment) {
  await browser.waitUntil(async () => {
    const notices = await $$("[role='status']");
    for (const notice of notices) {
      if ((await notice.getText()).includes(fragment)) return true;
    }
    return false;
  }, { timeout: 10_000, timeoutMsg: `status did not contain ${fragment}` });
}

async function selectNativeOption(select, value) {
  await browser.execute((element, nextValue) => {
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    ).set;
    setValue.call(element, nextValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, select, value);
  await expect(select).toHaveValue(value);
}

async function openTrainingWorkspace(catalog) {
  const label = catalog.training.workspaces.sessions;
  const buttons = await $$(".training-workspace-navigation button");
  for (const button of buttons) {
    if (await button.getText() !== label) continue;
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    await $(".training-session-library").waitForDisplayed({ timeout: 10_000 });
    return;
  }
  throw new Error(`training workspace was not available: ${label}`);
}

async function openSessionByDate(date) {
  const rows = await $$(".training-session-results > li");
  for (const row of rows) {
    if (await row.$(".training-session-result-date").getText() !== date) continue;
    await row.$("button.secondary").click();
    await $("#training-session-detail-heading").waitForDisplayed({ timeout: 10_000 });
    return;
  }
  throw new Error(`training session was not available: ${date}`);
}

async function backToResults(catalog) {
  await $(`aria/${catalog.training.sessionLibrary.closeDetail}`).click();
  await $(".training-session-results").waitForDisplayed({ timeout: 10_000 });
}

async function openDetailSection(catalog, section) {
  const label = catalog.training.sessionLibrary.detailSections[section];
  const buttons = await $$(".training-detail-navigation button");
  for (const button of buttons) {
    if (await button.getText() !== label) continue;
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    await $(`#training-detail-${section}`).waitForDisplayed({ timeout: 10_000 });
    return;
  }
  throw new Error(`training detail section was not available: ${label}`);
}

async function saveAppearanceAndZoom(appearance, zoom) {
  await openSettingsCategory("appearance");
  await browser.execute((nextAppearance, nextZoom) => {
    const appearance = document.querySelector(
      `input[name='appearance'][value='${nextAppearance}']`,
    );
    appearance.click();
    const zoom = document.querySelector("#application-content-zoom");
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    ).set;
    setValue.call(zoom, String(nextZoom));
    zoom.dispatchEvent(new Event("input", { bubbles: true }));
    zoom.dispatchEvent(new Event("change", { bubbles: true }));
  }, appearance, zoom);
  await persistSettings();
}

async function expectAdaptiveWorkbenchGeometry(selector) {
  const geometry = await browser.execute((workbenchSelector) => {
    const root = document.documentElement;
    const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
    const detail = document.querySelector(".training-detail").getBoundingClientRect();
    const workbench = document.querySelector(workbenchSelector).getBoundingClientRect();
    const summary = document.querySelector(`${workbenchSelector} dl`).getBoundingClientRect();
    const action = document.querySelector(`${workbenchSelector} footer button`).getBoundingClientRect();
    return {
      actionRight: action.right,
      detailLeft: detail.left,
      detailRight: detail.right,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
      navigationBottom: navigation.bottom,
      navigationIsCompact: navigation.width >= root.clientWidth - 1,
      summaryRight: summary.right,
      viewportHeight: root.clientHeight,
      viewportWidth: root.clientWidth,
      workbenchBottom: workbench.bottom,
      workbenchLeft: workbench.left,
      workbenchRight: workbench.right,
      workbenchTop: workbench.top,
    };
  }, selector);
  expect(geometry.hasHorizontalOverflow).toBe(false);
  expect(geometry.workbenchLeft).toBeGreaterThanOrEqual(geometry.detailLeft - 1);
  expect(geometry.workbenchRight).toBeLessThanOrEqual(geometry.detailRight + 1);
  expect(geometry.summaryRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.actionRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.workbenchTop).toBeLessThan(geometry.viewportHeight);
  expect(geometry.workbenchBottom).toBeGreaterThan(geometry.workbenchTop);
  if (geometry.navigationIsCompact) {
    expect(geometry.workbenchTop).toBeGreaterThanOrEqual(geometry.navigationBottom - 1);
  }
}

async function expectFocusedRevealGeometry(selector) {
  const geometry = await browser.execute((targetSelector) => {
    const root = document.documentElement;
    const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
    const target = document.querySelector(targetSelector).getBoundingClientRect();
    return {
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
      navigationBottom: navigation.bottom,
      navigationIsCompact: navigation.width >= root.clientWidth - 1,
      targetBottom: target.bottom,
      targetLeft: target.left,
      targetRight: target.right,
      targetTop: target.top,
      viewportHeight: root.clientHeight,
      viewportWidth: root.clientWidth,
    };
  }, selector);
  expect(geometry.hasHorizontalOverflow).toBe(false);
  expect(geometry.targetLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.targetRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.targetBottom).toBeGreaterThan(0);
  expect(geometry.targetTop).toBeLessThan(geometry.viewportHeight);
  if (geometry.navigationIsCompact) {
    expect(geometry.targetTop).toBeGreaterThanOrEqual(geometry.navigationBottom - 1);
  }
}

async function revealBelowCompactNavigation(selector) {
  await browser.execute((targetSelector) => {
    const root = document.documentElement;
    const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
    const target = document.querySelector(targetSelector);
    target.scrollIntoView({ block: "start", inline: "nearest" });
    if (navigation.width >= root.clientWidth - 1) {
      window.scrollBy(0, -(navigation.bottom + 12));
    }
  }, selector);
}

describe("packaged evidence-adaptive session composition", () => {
  it("foregrounds the strongest recorded evidence without losing exact detail", async () => {
    if (fixtureDirectory === undefined) {
      throw new Error("E2E fixture directory is required");
    }
    await resizeApplication(1440, 900);
    const dialogMock = await browser.tauri.mock("plugin:dialog|open");
    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "adaptive-sessions.zip"),
      english.home.emptyAction,
    );
    await $(`aria/${english.import}`).click();
    await waitForNotice(english.home.postImportChanged);
    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(english);
    expect(await $$(".training-session-results > li")).toHaveLength(3);

    await openSessionByDate("Jan 10, 2026");
    const signalWorkbench = await $(".training-signal-workbench");
    await signalWorkbench.waitForDisplayed({ timeout: 10_000 });
    await expect(signalWorkbench.$(".eyebrow")).toHaveText(
      english.training.sessionLibrary.signalWorkbench.eyebrow,
    );
    expect(await signalWorkbench.$$(".training-signal-workbench-plot polyline"))
      .not.toHaveLength(0);
    expect(await $$(".training-route-workbench")).toHaveLength(0);
    expect(await $$(".training-structure-workbench")).toHaveLength(0);
    expect(await $$(".training-zone-workbench")).toHaveLength(0);
    const signalNavigation = await $$(".training-detail-navigation button");
    const signalNavigationLabels = [];
    for (const button of signalNavigation) signalNavigationLabels.push(await button.getText());
    expect(signalNavigationLabels).toEqual([
      english.training.sessionLibrary.detailSections.overview,
      english.training.sessionLibrary.detailSections.ranges,
      english.training.sessionLibrary.detailSections.structure,
      english.training.sessionLibrary.detailSections.signals,
      english.training.sessionLibrary.detailSections.provenance,
    ]);
    await expectAdaptiveWorkbenchGeometry(".training-signal-workbench");
    const signalSelector = await signalWorkbench.$("select");
    const signalOptions = await signalSelector.$$("option");
    expect(signalOptions).toHaveLength(3);
    await selectNativeOption(signalSelector, await signalOptions[2].getAttribute("value"));
    await expect(signalWorkbench.$("h3")).toHaveText(
      expect.stringContaining("temperature"),
    );
    await selectNativeOption(signalSelector, await signalOptions[0].getAttribute("value"));
    const signalPosition = await signalWorkbench.$(
      ".training-signal-position-control input[type='range']",
    );
    await browser.execute((element) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(element, "1");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, signalPosition);
    await expect(signalPosition).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Sample 2 of 5"),
    );
    const signalRangeCopy = english.training.sessionLibrary.signalWorkbench;
    const rangeCopy = english.training.sessionLibrary.ranges;
    const signalRangeLayout = await browser.execute(() => {
      const workbench = document.querySelector(".training-signal-workbench").getBoundingClientRect();
      const layout = document.querySelector(".training-signal-range-layout").getBoundingClientRect();
      const visual = document.querySelector(".training-signal-visual").getBoundingClientRect();
      const inspector = document.querySelector(
        ".training-signal-range-inspector",
      ).getBoundingClientRect();
      return {
        inspectorLeft: inspector.left,
        inspectorWidth: inspector.width,
        layoutWidth: layout.width,
        visualRight: visual.right,
        visualWidth: visual.width,
        workbenchWidth: workbench.width,
      };
    });
    expect(signalRangeLayout.visualWidth / signalRangeLayout.layoutWidth)
      .toBeGreaterThan(0.7);
    expect(signalRangeLayout.visualWidth / signalRangeLayout.layoutWidth)
      .toBeLessThan(0.78);
    expect(signalRangeLayout.inspectorLeft).toBeGreaterThan(signalRangeLayout.visualRight);
    expect(signalRangeLayout.inspectorWidth / signalRangeLayout.layoutWidth)
      .toBeGreaterThan(0.2);
    expect(signalRangeLayout.visualWidth / signalRangeLayout.workbenchWidth)
      .toBeGreaterThan(0.65);
    await signalWorkbench.$(`aria/${signalRangeCopy.createRangeHere}`).click();
    await expect(signalSelector).toBeDisabled();
    const signalRangeEditor = await signalWorkbench.$(".training-range-editor");
    await signalRangeEditor.$(".training-range-editor-name input").setValue("Steady signal");
    const signalRangeHandles = await signalWorkbench.$$(
      ".training-signal-range-handles input[type='range']",
    );
    expect(signalRangeHandles).toHaveLength(2);
    await browser.execute((element) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(element, "3");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, signalRangeHandles[1]);
    await expect(signalRangeHandles[0]).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Sample 2 of 5"),
    );
    await expect(signalRangeHandles[1]).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Sample 4 of 5"),
    );
    const signalRangeEditorAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-signal-workbench")
      .analyze();
    expect(signalRangeEditorAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-signal-range-editor-en-wide.png",
    ));
    await signalRangeEditor.$(`aria/${rangeCopy.save}`).click();
    await waitForNotice(rangeCopy.saved);
    await expect(signalSelector).toBeEnabled();
    await expect(signalWorkbench.$(".training-signal-saved-range strong"))
      .toHaveText("Steady signal");
    expect(await signalWorkbench.$$(".training-signal-range-start")).toHaveLength(1);
    expect(await signalWorkbench.$$(".training-signal-range-end")).toHaveLength(1);
    const signalRangeAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-signal-workbench")
      .analyze();
    expect(signalRangeAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-signal-range-en-wide.png",
    ));
    const exactSignal = await signalWorkbench.$("footer button");
    await exactSignal.click();
    await expect($(".training-detail-navigation button[aria-current='page']"))
      .toHaveText(english.training.sessionLibrary.detailSections.signals);
    const exactSignalHeading = await $(".training-signal-exact h6");
    await exactSignalHeading.waitForDisplayed({ timeout: 10_000 });
    await expect(exactSignalHeading).toBeDisplayed();
    const selectedExactSignal = await $(".training-signal-exact .training-exact-selected-row");
    await expect(selectedExactSignal).toBeFocused();
    await expect(selectedExactSignal).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.selectedSignalEvidence),
    );
    await expectFocusedRevealGeometry(
      ".training-signal-exact .training-exact-selected-row",
    );
    expect(await $$(".training-signal-exact tbody tr")).not.toHaveLength(0);
    const exactSignalPicker = await $(
      ".training-signal-exact .training-range-evidence-picker",
    );
    await revealBelowCompactNavigation(
      ".training-signal-exact .training-range-evidence-picker",
    );
    await expectFocusedRevealGeometry(
      ".training-signal-exact .training-range-evidence-picker",
    );
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-exact-signal-range-picker-en-wide.png",
    ));
    await exactSignalPicker.$(`aria/${rangeCopy.createFromEvidence}`).click();
    const exactSignalEditor = await $(
      ".training-range-evidence-editor .training-range-editor",
    );
    await expect(exactSignalEditor.$("h4")).toBeFocused();
    const exactSignalBoundaries = await exactSignalEditor.$$(
      ".training-range-editor-boundaries input",
    );
    await expect(exactSignalBoundaries[0]).toHaveValue("0:15:00");
    await expect(exactSignalBoundaries[1]).toHaveValue("0:30:00");
    expect(await exactSignalEditor.$$(`select[aria-label="${rangeCopy.timeline}"]`))
      .toHaveLength(0);
    await expectFocusedRevealGeometry(".training-range-evidence-editor h4");
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-exact-signal-range-editor-en-wide.png",
    ));
    await exactSignalEditor.$(`aria/${rangeCopy.cancel}`).click();
    await backToResults(english);

    await goToHome("sources");
    await $(`aria/${english.import}`).click();
    await waitForNotice(english.home.postImportExactRepeat);
    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(english);
    await openSessionByDate("Jan 10, 2026");
    const reimportedSignalWorkbench = await $(".training-signal-workbench");
    await reimportedSignalWorkbench.waitForDisplayed({ timeout: 10_000 });
    await expect(reimportedSignalWorkbench.$(".training-signal-saved-range strong"))
      .toHaveText("Steady signal");
    expect(await reimportedSignalWorkbench.$$(".training-signal-range-start"))
      .toHaveLength(1);
    expect(await reimportedSignalWorkbench.$$(".training-signal-range-end"))
      .toHaveLength(1);
    await backToResults(english);

    await openSessionByDate("Jan 11, 2026");
    const structureWorkbench = await $(".training-structure-workbench");
    await structureWorkbench.waitForDisplayed({ timeout: 10_000 });
    await expect(structureWorkbench.$("h3")).toHaveText(
      english.training.sessionLibrary.structureWorkbench.heading,
    );
    expect(await structureWorkbench.$$(
      ".training-structure-workbench-source .training-structure-workbench-track i",
    )).toHaveLength(2);
    await expect(structureWorkbench).toHaveText(expect.stringContaining("2 source laps"));
    await expect(structureWorkbench).toHaveText(expect.stringContaining("1 pause"));
    expect(await $$(".training-signal-workbench, .training-route-workbench, .training-zone-workbench"))
      .toHaveLength(0);
    await expectAdaptiveWorkbenchGeometry(".training-structure-workbench");
    const structureRangePicker = await structureWorkbench.$(
      ".training-range-evidence-picker",
    );
    const structureRangeSelector = await structureRangePicker.$("select");
    const structureRangeOptions = await structureRangeSelector.$$("option");
    expect(structureRangeOptions).toHaveLength(3);
    await selectNativeOption(
      structureRangeSelector,
      await structureRangeOptions[1].getAttribute("value"),
    );
    await structureRangePicker.$(`aria/${rangeCopy.createFromEvidence}`).click();
    const structureRangeEditor = await structureWorkbench.$(".training-range-editor");
    await expect(structureRangeEditor.$("h4")).toBeFocused();
    const structureRangeBoundaries = await structureRangeEditor.$$(
      ".training-range-editor-boundaries input",
    );
    await expect(structureRangeBoundaries[0]).toHaveValue("0:00:00");
    await expect(structureRangeBoundaries[1]).toHaveValue("0:15:00");
    await structureRangeEditor.$(".training-range-editor-name input")
      .setValue("First source lap");
    const structureRangeAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-structure-workbench")
      .analyze();
    expect(structureRangeAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-structure-range-editor-en-wide.png",
    ));
    await structureRangeEditor.$(`aria/${rangeCopy.save}`).click();
    await waitForNotice(rangeCopy.saved);
    expect(await structureWorkbench.$$(".training-structure-personal-range"))
      .toHaveLength(1);
    expect(await structureWorkbench.$$(
      ".training-structure-workbench-source .training-structure-workbench-track i",
    )).toHaveLength(2);
    await revealBelowCompactNavigation(".training-structure-workbench-visual");
    await expectFocusedRevealGeometry(".training-structure-workbench-visual");
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-structure-range-en-wide.png",
    ));
    const openStructure = await structureWorkbench.$("footer button");
    await openStructure.click();
    const structureHeading = await $("#training-structure-heading");
    await expect(structureHeading).toBeFocused();
    await expectFocusedRevealGeometry("#training-structure-heading");
    const structureCollections = await $$(
      "#training-detail-structure .training-structure-collection",
    );
    let sourceLapRows = [];
    for (const collection of structureCollections) {
      if (await collection.$("h5").getText() !== english.training.sessionLibrary.manualLaps) {
        continue;
      }
      sourceLapRows = await collection.$$("tbody tr");
      break;
    }
    expect(sourceLapRows).toHaveLength(2);
    const sourceEvidencePicker = await $(
      "#training-detail-structure .training-range-evidence-picker",
    );
    await sourceEvidencePicker.$(`aria/${rangeCopy.createFromEvidence}`).click();
    const sourceEvidenceEditor = await $(
      ".training-range-evidence-editor .training-range-editor",
    );
    await expect(sourceEvidenceEditor.$("h4")).toBeFocused();
    const sourceEvidenceBoundaries = await sourceEvidenceEditor.$$(
      ".training-range-editor-boundaries input",
    );
    await expect(sourceEvidenceBoundaries[0]).toHaveValue("0:00:00");
    await expect(sourceEvidenceBoundaries[1]).toHaveValue("0:15:00");
    await expectFocusedRevealGeometry(".training-range-evidence-editor h4");
    await sourceEvidenceEditor.$(`aria/${rangeCopy.cancel}`).click();
    await backToResults(english);

    await openSessionByDate("Jan 12, 2026");
    await $(".training-structure-workbench").waitForDisplayed({ timeout: 10_000 });
    expect(await $$(".training-zone-workbench")).toHaveLength(0);
    await openDetailSection(english, "signals");
    await browser.waitUntil(async () => (await $$(".training-zone-group")).length === 3, {
      timeout: 10_000,
      timeoutMsg: "recorded zone groups were not displayed",
    });
    await expect($(".training-zone-unsupported")).toHaveText(
      expect.stringContaining("1 recorded zone group is not shown in this view"),
    );
    const zoneGroup = await $(".training-zone-group:first-of-type");
    const zoneDistribution = await zoneGroup.$(".training-zone-distribution");
    await expect(zoneDistribution).toHaveAttribute(
      "aria-label",
      "Heart rate distribution with recorded time for 1 of 2 zones.",
    );
    await browser.execute((element) => {
      element.scrollIntoView({ block: "start", inline: "nearest" });
    }, zoneGroup);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r7-zone-detail-en-wide.png",
    ));

    await selectLocale("es-ES", "explore");
    await saveAppearanceAndZoom("dark", 200);
    await goToHome("explore");
    await resizeApplication(900, 760);
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(spanish);
    await openSessionByDate("10 ene 2026");
    const spanishSignalWorkbench = await $(".training-signal-workbench");
    await spanishSignalWorkbench.waitForDisplayed({ timeout: 10_000 });
    await expect(spanishSignalWorkbench.$(".eyebrow")).toHaveText(
      spanish.training.sessionLibrary.signalWorkbench.eyebrow,
    );
    await expect(spanishSignalWorkbench.$(".training-signal-saved-range strong"))
      .toHaveText("Steady signal");
    await expectAdaptiveWorkbenchGeometry(".training-signal-workbench");
    const compactSignalRangeLayout = await browser.execute(() => {
      const root = document.documentElement;
      const visual = document.querySelector(".training-signal-visual").getBoundingClientRect();
      const inspector = document.querySelector(
        ".training-signal-range-inspector",
      ).getBoundingClientRect();
      return {
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
        inspectorTop: inspector.top,
        visualBottom: visual.bottom,
      };
    });
    expect(compactSignalRangeLayout.hasHorizontalOverflow).toBe(false);
    expect(compactSignalRangeLayout.inspectorTop)
      .toBeGreaterThanOrEqual(compactSignalRangeLayout.visualBottom);
    await revealBelowCompactNavigation(".training-signal-visual");
    await expectFocusedRevealGeometry(".training-signal-visual");
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-signal-range-es-dark-compact-200.png",
    ));
    await revealBelowCompactNavigation(".training-signal-range-inspector");
    await expectFocusedRevealGeometry(".training-signal-range-inspector");
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-signal-range-inspector-es-dark-compact-200.png",
    ));
    const exactSignalAction = await spanishSignalWorkbench.$("footer button");
    await browser.execute((element) => element.focus(), exactSignalAction);
    await expect(exactSignalAction).toBeFocused();
    await exactSignalAction.click();
    const spanishExactHeading = await $(".training-signal-exact h6");
    await spanishExactHeading.waitForDisplayed({ timeout: 10_000 });
    await expect(spanishExactHeading).toBeDisplayed();
    const spanishSelectedExactSignal = await $(
      ".training-signal-exact .training-exact-selected-row",
    );
    await expect(spanishSelectedExactSignal).toBeFocused();
    await expectFocusedRevealGeometry(
      ".training-signal-exact .training-exact-selected-row",
    );
    const accessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await backToResults(spanish);
    await openSessionByDate("11 ene 2026");
    const spanishStructureWorkbench = await $(".training-structure-workbench");
    await spanishStructureWorkbench.waitForDisplayed({ timeout: 10_000 });
    expect(await spanishStructureWorkbench.$$(".training-structure-personal-range"))
      .toHaveLength(1);
    await revealBelowCompactNavigation(".training-structure-workbench-visual");
    await expectFocusedRevealGeometry(".training-structure-workbench-visual");
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-structure-range-visual-es-dark-compact-200.png",
    ));
    await revealBelowCompactNavigation(
      ".training-structure-workbench .training-range-evidence-picker",
    );
    await expectFocusedRevealGeometry(
      ".training-structure-workbench .training-range-evidence-picker",
    );
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-structure-range-picker-es-dark-compact-200.png",
    ));
    const compactStructureAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-structure-workbench")
      .analyze();
    expect(compactStructureAccessibility.violations).toEqual([]);
    if (restartIdentityPath === undefined) {
      throw new Error("adaptive restart identity path is required");
    }
    expect(recordRestartProcessIdentity(
      restartIdentityPath,
      e2eApplicationBinary,
    )).toBeGreaterThan(0);
  });
});
