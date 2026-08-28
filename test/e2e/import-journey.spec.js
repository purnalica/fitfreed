import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/webdriverio";
import { Key } from "webdriverio";

import { e2eApplicationBinary } from "../../scripts/e2e-paths.mjs";
import {
  goToHome,
  openSettingsCategory,
  openArchivePicker,
  openHomeQuestion,
  persistSettings,
  resizeApplication,
  returnToLibraryHome,
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
const largeArchive = process.env.FITFREED_E2E_LARGE_ARCHIVE;
const restartIdentityPath = process.env.FITFREED_E2E_RESTART_IDENTITY_PATH;
const evidenceDirectory = path.resolve(".artifacts/e2e/evidence");
const reportOutput = path.join(evidenceDirectory, "session-report.html");
const refreshedReportOutput = path.join(evidenceDirectory, "refreshed-comparison-report.html");
const plannedReportOutput = path.join(evidenceDirectory, "planned-training-report.html");

async function waitForNotice(fragment, timeout = 10_000) {
  await browser.waitUntil(
    async () => {
      const notices = await $$("[role='status']");
      for (const notice of notices) {
        if ((await notice.getText()).includes(fragment)) return true;
      }
      return false;
    },
    { timeout, timeoutMsg: `status did not contain ${fragment}` },
  );
}

async function selectNativeOption(select, value) {
  await browser.execute((element, nextValue) => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set;
    if (!setter) throw new Error("native select value setter is unavailable");
    setter.call(element, nextValue);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, select, value);
}

async function selectNativeOptionByText(select, expectedText) {
  const available = [];
  for (const option of await select.$$("option")) {
    const text = await option.getText();
    available.push(text);
    if (text !== expectedText) continue;
    const value = await option.getAttribute("value");
    await selectNativeOption(select, value);
    await expect(select).toHaveValue(value);
    return;
  }
  throw new Error(
    `Native option was not available: ${expectedText}; found ${available.join(" | ")}`,
  );
}

async function expectDocumentFocus(selector, timeoutMsg) {
  try {
    await browser.waitUntil(
      () => browser.execute(
        (target) => document.activeElement === document.querySelector(target),
        selector,
      ),
      { timeout: 10_000, timeoutMsg },
    );
  } catch (reason) {
    const activeElement = await browser.execute(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return null;
      return {
        tagName: active.tagName,
        id: active.id,
        className: active.className,
        text: active.innerText.slice(0, 120),
      };
    });
    throw new Error(`${timeoutMsg}; active element: ${JSON.stringify(activeElement)}`, {
      cause: reason,
    });
  }
}

async function expectElementFocus(element, timeoutMsg) {
  try {
    await browser.waitUntil(
      () => element.isFocused(),
      { timeout: 10_000, timeoutMsg },
    );
  } catch (reason) {
    const focusState = await browser.execute((target) => {
      const active = document.activeElement;
      return {
        targetConnected: target instanceof HTMLElement ? target.isConnected : null,
        targetDisabled: target instanceof HTMLButtonElement ? target.disabled : null,
        targetHiddenByAncestor: target instanceof HTMLElement
          ? target.closest("[hidden]") !== null
          : null,
        targetIsActive: target === active,
        targetText: target instanceof HTMLElement ? target.innerText.slice(0, 120) : null,
        manualFocusSucceeded: target instanceof HTMLElement
          ? (target.focus(), document.activeElement === target)
          : null,
        activeElement: active instanceof HTMLElement ? {
          tagName: active.tagName,
          id: active.id,
          className: active.className,
          text: active.innerText.slice(0, 120),
        } : null,
      };
    }, element).catch(() => ({ targetUnavailable: true }));
    throw new Error(`${timeoutMsg}; focus state: ${JSON.stringify(focusState)}`, {
      cause: reason,
    });
  }
}

async function expectFocusedStatus(fragment, timeoutMsg) {
  await browser.waitUntil(
    () => browser.execute((expected) => (
      document.activeElement?.getAttribute("role") === "status"
      && document.activeElement.textContent?.includes(expected)
    ), fragment),
    { timeout: 10_000, timeoutMsg },
  );
}

async function expectApplicationShellLayout(catalog, mode, broadWorkspace = false) {
  const state = await browser.execute(() => {
    const sidebar = document.querySelector(".app-sidebar");
    const workspace = document.querySelector(".shell-workspace");
    const content = document.querySelector(".app-content");
    const navigation = sidebar.querySelector("nav");
    const sidebarBounds = sidebar.getBoundingClientRect();
    const workspaceBounds = workspace.getBoundingClientRect();
    const contentBounds = content.getBoundingClientRect();
    return {
      sidebarTag: sidebar.tagName,
      sidebarWidth: sidebarBounds.width,
      sidebarLeft: sidebarBounds.left,
      sidebarHeight: sidebarBounds.height,
      sidebarPosition: getComputedStyle(sidebar).position,
      workspaceLeft: workspaceBounds.left,
      workspaceTop: workspaceBounds.top,
      contentWidth: contentBounds.width,
      viewportHeight: document.documentElement.clientHeight,
      viewportWidth: document.documentElement.clientWidth,
      navigationColumns: getComputedStyle(navigation).gridTemplateColumns.split(" ").length,
      hasHorizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(state.sidebarTag).toBe("ASIDE");
  expect(Math.abs(state.sidebarLeft)).toBeLessThanOrEqual(1);
  expect(state.sidebarPosition).toBe("sticky");
  expect(state.hasHorizontalOverflow).toBe(false);
  if (mode === "desktop") {
    expect(Math.abs(state.sidebarWidth - 240)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.workspaceLeft - 240)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.sidebarHeight - state.viewportHeight)).toBeLessThanOrEqual(1);
  } else {
    expect(Math.abs(state.sidebarWidth - state.viewportWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.workspaceLeft)).toBeLessThanOrEqual(1);
    expect(state.workspaceTop).toBeGreaterThan(0);
    expect(state.sidebarHeight).toBeLessThan(state.viewportHeight);
    expect(state.navigationColumns).toBe(5);
  }
  if (broadWorkspace) expect(state.contentWidth).toBeGreaterThan(1080);
  await expect($(".app-sidebar")).toHaveAttribute("aria-label", catalog.shell.sidebar);
  for (const destination of ["home", "explore", "reports", "sources", "settings"]) {
    const item = $(`.app-sidebar nav button[data-home='${destination}']`);
    await expect(item)
      .toHaveAttribute("aria-label", catalog.shell[destination]);
    await expect(item).toHaveText(catalog.shell[destination]);
  }
}

async function expectRevealOutsideApplicationNavigation(selector) {
  await browser.execute((targetSelector) => {
    document.querySelector(targetSelector).scrollIntoView({ block: "start", inline: "nearest" });
  }, selector);
  const geometry = await browser.execute((targetSelector) => {
    const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
    const target = document.querySelector(targetSelector).getBoundingClientRect();
    return {
      compact: navigation.width >= document.documentElement.clientWidth - 1,
      navigationBottom: navigation.bottom,
      navigationRight: navigation.right,
      targetLeft: target.left,
      targetTop: target.top,
      viewportHeight: document.documentElement.clientHeight,
    };
  }, selector);
  if (geometry.compact) {
    expect(geometry.targetTop).toBeGreaterThanOrEqual(geometry.navigationBottom - 1);
  } else {
    expect(geometry.targetLeft).toBeGreaterThanOrEqual(geometry.navigationRight - 1);
  }
  expect(geometry.targetTop).toBeLessThan(geometry.viewportHeight);
}

async function expectFirstRunActionsBeforePreview() {
  const positions = await browser.execute(() => {
    const actions = document.querySelector(".library-home-empty-actions");
    const preview = document.querySelector(".library-home-empty-possibilities");
    return {
      actionsBottom: actions.getBoundingClientRect().bottom,
      previewTop: preview.getBoundingClientRect().top,
    };
  });
  expect(positions.previewTop).toBeGreaterThan(positions.actionsBottom);
}

async function expectSettingsControlsWithinInitialViewport() {
  await browser.execute(() => {
    const scroller = document.scrollingElement ?? document.documentElement;
    scroller.scrollTop = 0;
  });
  await browser.waitUntil(
    () => browser.execute(
      () => (document.scrollingElement ?? document.documentElement).scrollTop === 0,
    ),
    { timeout: 10_000, timeoutMsg: "Settings did not return to its initial viewport" },
  );
  const state = await browser.execute(() => {
    const form = document.querySelector(".settings-form").getBoundingClientRect();
    const heading = document.querySelector(".settings-heading").getBoundingClientRect();
    const root = document.documentElement;
    return {
      headingViewportTop: heading.top,
      formViewportTop: form.top,
      viewportHeight: root.clientHeight,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
    };
  });
  expect(state.headingViewportTop).toBeGreaterThanOrEqual(0);
  expect(state.formViewportTop).toBeGreaterThan(state.headingViewportTop);
  expect(state.formViewportTop).toBeLessThan(state.viewportHeight);
  expect(state.hasHorizontalOverflow).toBe(false);
}

async function expectImportOutcomeWithinInitialViewport(expectedHeading, expectedMessage) {
  const heading = await $("#outcome-heading");
  await expect(heading).toHaveText(expectedHeading);
  if (expectedMessage) {
    await expect($(".outcome-terminal-message")).toHaveText(
      expect.stringContaining(expectedMessage),
    );
  }
  await browser.execute(() => {
    const scroller = document.scrollingElement ?? document.documentElement;
    scroller.scrollTop = 0;
  });
  const state = await browser.execute(() => {
    const root = document.documentElement;
    const heading = document.querySelector("#outcome-heading").getBoundingClientRect();
    const consequence = document.querySelector(".outcome-consequence").getBoundingClientRect();
    const actions = document.querySelector(".outcome-actions").getBoundingClientRect();
    return {
      headingTop: heading.top,
      consequenceTop: consequence.top,
      actionsBottom: actions.bottom,
      viewportHeight: root.clientHeight,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
    };
  });
  expect(state.headingTop).toBeGreaterThanOrEqual(0);
  expect(state.consequenceTop).toBeGreaterThan(state.headingTop);
  expect(state.actionsBottom).toBeLessThanOrEqual(state.viewportHeight);
  expect(state.hasHorizontalOverflow).toBe(false);
}

async function captureR10WorkspaceEvidence(fileName, selector) {
  const workspace = await $(selector);
  await workspace.waitForDisplayed({ timeout: 10_000 });
  await browser.execute(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const layout = await browser.execute((targetSelector) => {
    const root = document.documentElement;
    const target = document.querySelector(targetSelector).getBoundingClientRect();
    const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
    const compactNavigation = navigation.width >= root.clientWidth - 1;
    return {
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
      targetInsideViewportWidth: target.left >= 0 && target.right <= root.clientWidth,
      targetBelowCompactNavigation: !compactNavigation || target.top >= navigation.bottom - 1,
    };
  }, selector);
  expect(layout).toEqual({
    hasHorizontalOverflow: false,
    targetInsideViewportWidth: true,
    targetBelowCompactNavigation: true,
  });
  const accessibility = await new AxeBuilder({ client: browser })
    .setLegacyMode()
    .include(selector)
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await browser.saveScreenshot(path.join(evidenceDirectory, fileName));
}

async function expectSportClassificationComposition(expectedColumns) {
  const geometry = await browser.execute(() => {
    const root = document.documentElement;
    const editor = document.querySelector(".training-history-sport-editor form");
    const fields = [...editor.querySelectorAll(".training-sport-editor-field")];
    const controls = fields.map((field) => field.querySelector("input, select"));
    const labels = fields.map((field) => field.querySelector("label"));
    const actionRegion = editor.querySelector(".training-sport-editor-actions");
    const preview = editor.querySelector(".training-sport-editor-preview");
    const previewTitle = preview.querySelector("strong");
    const navigation = document.querySelector(".app-sidebar");
    const workspace = document.querySelector(".app-content");
    const editorContainer = editor.closest(".training-history-sport-editor");
    const sportIndex = editor.closest(".training-history-sports");
    const editorBounds = editor.getBoundingClientRect();
    const editorContainerBounds = editorContainer.getBoundingClientRect();
    const previewTitleBounds = previewTitle.getBoundingClientRect();
    const navigationBounds = navigation.getBoundingClientRect();
    const sportIndexBounds = sportIndex.getBoundingClientRect();
    const workspaceBounds = workspace.getBoundingClientRect();
    const fieldBounds = fields.map((field) => field.getBoundingClientRect());
    const controlBounds = controls.map((control) => control.getBoundingClientRect());
    const labelBounds = labels.map((label) => label.getBoundingClientRect());
    const actionBounds = actionRegion.getBoundingClientRect();
    const readingCopy = document.querySelector(".training-workspace-heading > p:last-child");
    const help = editor.querySelector(".training-sport-editor-field small");
    const previewTitleStyle = getComputedStyle(previewTitle);
    const previewTitleLineHeight = Number.parseFloat(previewTitleStyle.lineHeight)
      || Number.parseFloat(previewTitleStyle.fontSize) * 1.2;
    const ancestors = [];
    for (let element = editor.parentElement; element; element = element.parentElement) {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      ancestors.push({
        tag: element.tagName,
        className: element.className,
        width: bounds.width,
        display: style.display,
        columns: style.gridTemplateColumns,
      });
      if (element === workspace) break;
    }
    return {
      ancestors,
      columnDefinition: getComputedStyle(editor).gridTemplateColumns,
      columns: getComputedStyle(editor).gridTemplateColumns.split(" ").length,
      contentZoom: root.dataset.contentZoom,
      editorBounds: {
        left: editorBounds.left,
        right: editorBounds.right,
        width: editorBounds.width,
      },
      editorContainerBounds: {
        left: editorContainerBounds.left,
        right: editorContainerBounds.right,
        width: editorContainerBounds.width,
      },
      editorTop: editorBounds.top,
      editorUsesAvailableWidth: editorBounds.width >= workspaceBounds.width * 0.75,
      previewTitleLineCount: Math.round(
        previewTitleBounds.height / previewTitleLineHeight,
      ),
      sportIndexBounds: {
        left: sportIndexBounds.left,
        right: sportIndexBounds.right,
        width: sportIndexBounds.width,
        columns: getComputedStyle(sportIndex).gridTemplateColumns,
      },
      workspaceWidth: workspaceBounds.width,
      fieldBounds: fieldBounds.map((field) => ({
        left: field.left,
        right: field.right,
        width: field.width,
      })),
      controlBounds: controlBounds.map((control) => ({
        left: control.left,
        right: control.right,
        width: control.width,
      })),
      actionBounds: {
        left: actionBounds.left,
        right: actionBounds.right,
        width: actionBounds.width,
      },
      navigationBottom: navigationBounds.bottom,
      viewportWidth: root.clientWidth,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
      editorInsideWorkspace: editorBounds.left >= 0 && editorBounds.right <= root.clientWidth + 1,
      editorOutsideNavigation: navigationBounds.width >= root.clientWidth - 1
        ? editorBounds.top >= navigationBounds.bottom - 1
        : editorBounds.left >= navigationBounds.right - 1,
      fieldsInsideEditor: fieldBounds.every((field) => (
        field.left >= editorBounds.left - 1 && field.right <= editorBounds.right + 1
      )),
      labelsAligned: Math.abs(labelBounds[0].top - labelBounds[1].top) <= 1,
      controlsAligned: Math.abs(controlBounds[0].top - controlBounds[1].top) <= 1,
      controlsEqualHeight: Math.abs(controlBounds[0].height - controlBounds[1].height) <= 1,
      controlHeights: controlBounds.map((control) => control.height),
      fieldsStacked: fieldBounds[1].top >= fieldBounds[0].bottom - 1,
      actionsAfterFields: actionBounds.top >= Math.max(...fieldBounds.map((field) => field.bottom)) - 1,
      actionsInsideEditor: actionBounds.left >= editorBounds.left - 1
        && actionBounds.right <= editorBounds.right + 1,
      readingCopyHasMeasure: getComputedStyle(readingCopy).maxWidth !== "none",
      controlHelpUsesAllocation: getComputedStyle(help).maxWidth === "none",
    };
  });
  if (
    !geometry.controlsEqualHeight
    || !geometry.editorOutsideNavigation
    || !geometry.editorUsesAvailableWidth
    || !geometry.fieldsInsideEditor
    || !geometry.actionsInsideEditor
    || geometry.previewTitleLineCount > 5
  ) {
    process.stderr.write(`${JSON.stringify({ sportClassificationGeometry: geometry })}\n`);
  }
  expect(geometry.hasHorizontalOverflow).toBe(false);
  expect(geometry.editorInsideWorkspace).toBe(true);
  expect(geometry.editorOutsideNavigation).toBe(true);
  expect(geometry.editorUsesAvailableWidth).toBe(true);
  expect(geometry.previewTitleLineCount).toBeLessThanOrEqual(5);
  expect(geometry.fieldsInsideEditor).toBe(true);
  expect(geometry.controlsEqualHeight).toBe(true);
  expect(geometry.actionsAfterFields).toBe(true);
  expect(geometry.actionsInsideEditor).toBe(true);
  expect(geometry.readingCopyHasMeasure).toBe(true);
  expect(geometry.controlHelpUsesAllocation).toBe(true);
  expect(geometry.columns).toBe(expectedColumns);
  if (expectedColumns === 2) {
    expect(geometry.labelsAligned).toBe(true);
    expect(geometry.controlsAligned).toBe(true);
  } else {
    expect(geometry.fieldsStacked).toBe(true);
  }
}

async function exerciseSportClassificationComposition() {
  const input = await $(".training-history-sport-editor input");
  const longSportLabel = "Long distance river paddling with a deliberately descriptive personal sport name";
  expect([...longSportLabel]).toHaveLength(80);
  await input.clearValue();
  await input.setValue(longSportLabel);

  for (const [width, height, widthName] of [
    [1280, 820, "wide"],
    [720, 760, "compact"],
  ]) {
    await resizeApplication(width, height);
    for (const [locale, catalog] of [["en-US", english], ["es-ES", spanish]]) {
      await selectLocale(locale, "explore");
      for (const appearance of ["light", "dark"]) {
        for (const zoom of [100, 125, 150, 175, 200]) {
          await setAppearanceAndZoom(appearance, zoom, true, "explore");
          await browser.execute(() => {
            document.querySelector(".training-history-sport-editor form")
              .scrollIntoView({ block: "start", inline: "nearest" });
          });
          await expectSportClassificationComposition(zoom >= 150 ? 1 : 2);
          if ((widthName === "wide" && locale === "en-US"
              && appearance === "light" && zoom === 100)
            || (widthName === "compact" && locale === "es-ES"
              && appearance === "dark" && zoom === 200)) {
            const accessibility = await new AxeBuilder({ client: browser })
              .setLegacyMode()
              .include(".training-history-sport-editor")
              .analyze();
            expect(accessibility.violations).toEqual([]);
            await browser.saveScreenshot(path.join(
              evidenceDirectory,
              `x6-c5-sport-classification-${locale}-${appearance}-${widthName}-${zoom}.png`,
            ));
          }
        }
      }
    }
  }

  await selectLocale("en-US", "explore");
  await resetSettings("explore");
  await resizeApplication(1280, 820);
  await input.clearValue();
  await input.setValue(`${longSportLabel}x`);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect($(".training-history-sport-editor [role='alert']"))
    .toHaveText(english.training.sports.displayLabelTooLong);
  await expectSportClassificationComposition(2);

  const family = await $(".training-history-sport-editor select");
  await browser.execute(() => {
    document.querySelector(".training-history-sport-editor select").focus();
  });
  await expect(family).toBeFocused();
  await input.clearValue();
  await browser.execute(() => {
    document.querySelector(".training-history-sport-editor input").focus();
  });
  await expect(input).toBeFocused();
  await browser.keys("Discarded draft");
  await expect(input).toHaveValue("Discarded draft");
  const cancel = await $(".training-history-sport-editor .training-sport-editor-actions button");
  await browser.execute(() => {
    document.querySelector(".training-history-sport-editor .training-sport-editor-actions button")
      .focus();
  });
  await expect(cancel).toBeFocused();
  await cancel.click();
  await browser.waitUntil(
    async () => !(await $(".training-history-sport-editor form").isExisting()),
    { timeout: 10_000, timeoutMsg: "keyboard cancellation did not close sport classification" },
  );
}

async function expectAnswerMeasurementOnOneLine(selector) {
  const lineCount = await browser.execute((measurementSelector) => {
    const measurement = document.querySelector(measurementSelector);
    return measurement === null ? 0 : measurement.getClientRects().length;
  }, selector);
  expect(lineCount).toBe(1);
}

async function expectResultBelowCompactNavigation(selector) {
  const layout = await browser.execute((targetSelector) => {
    const root = document.documentElement;
    const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
    const target = document.querySelector(targetSelector).getBoundingClientRect();
    return {
      documentWidth: root.scrollWidth,
      navigationBottom: navigation.bottom,
      targetBottom: target.bottom,
      targetTop: target.top,
      viewportHeight: root.clientHeight,
      viewportWidth: root.clientWidth,
    };
  }, selector);
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.targetTop).toBeGreaterThanOrEqual(layout.navigationBottom);
  expect(layout.targetTop).toBeLessThanOrEqual(layout.navigationBottom + 120);
  expect(layout.targetBottom).toBeLessThanOrEqual(layout.viewportHeight);
}

async function expectPersonalRangeGeometry(stacked) {
  const geometry = await browser.execute(() => {
    const root = document.documentElement;
    const detail = document.querySelector(".training-detail").getBoundingClientRect();
    const workspace = document.querySelector(".training-range-workspace").getBoundingClientRect();
    const navigation = document.querySelector(".training-range-workspace > nav")
      .getBoundingClientRect();
    const inspector = document.querySelector(".training-range-inspector").getBoundingClientRect();
    return {
      detailLeft: detail.left,
      detailRight: detail.right,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
      inspectorLeft: inspector.left,
      inspectorRight: inspector.right,
      inspectorTop: inspector.top,
      navigationBottom: navigation.bottom,
      navigationRight: navigation.right,
      workspaceLeft: workspace.left,
      workspaceRight: workspace.right,
    };
  });
  expect(geometry.hasHorizontalOverflow).toBe(false);
  expect(geometry.workspaceLeft).toBeGreaterThanOrEqual(geometry.detailLeft - 1);
  expect(geometry.workspaceRight).toBeLessThanOrEqual(geometry.detailRight + 1);
  expect(geometry.inspectorRight).toBeLessThanOrEqual(geometry.detailRight + 1);
  if (stacked) {
    expect(geometry.inspectorTop).toBeGreaterThanOrEqual(geometry.navigationBottom - 1);
  } else {
    expect(geometry.inspectorLeft).toBeGreaterThanOrEqual(geometry.navigationRight - 1);
  }
}

async function expectLibraryHome(catalog, { coverageExpanded = false } = {}) {
  const heading = await $(".library-home h1");
  await heading.waitForDisplayed({ timeout: 10_000 });
  await expect(heading).toHaveText(catalog.home.title);
  const summaryFacts = await $$(".library-home-summary strong");
  expect(summaryFacts).toHaveLength(2);
  for (const fact of summaryFacts) await expect(fact).toBeDisplayed();
  await expect($(".library-home-sports h2")).toHaveText(catalog.home.sportsHeading);
  const sportRows = await $$(".library-home-sports li");
  expect(sportRows.length).toBeGreaterThan(0);
  expect(await $$(".library-home-sports .sport-family-icon")).toHaveLength(sportRows.length);
  await expect($(".library-home-recent h2")).toHaveText(catalog.home.recentHeading);
  const recentSessions = await $$(".library-home-recent button");
  expect(recentSessions.length).toBeGreaterThan(0);
  expect(await $$(".library-home-recent .sport-family-icon")).toHaveLength(recentSessions.length);
  if (await $(".library-home-reveal").isExisting()) {
    const personalValuePrecedesReceipt = await browser.execute(() => {
      const receipt = document.querySelector(".library-home-reveal");
      const personalResults = [
        document.querySelector(".library-home-sports"),
        document.querySelector(".library-home-highlight"),
        document.querySelector(".library-home-recent"),
      ];
      return receipt !== null && personalResults.every((result) => (
        result !== null
        && Boolean(result.compareDocumentPosition(receipt) & Node.DOCUMENT_POSITION_FOLLOWING)
      ));
    });
    expect(personalValuePrecedesReceipt).toBe(true);
  }
  await expect($(".library-home-historical h2")).toHaveText(catalog.home.historicalHeading);
  const questionButtons = await $$(".library-home-questions button");
  expect(questionButtons).toHaveLength(Object.keys(catalog.home.questions).length);
  for (const label of Object.values(catalog.home.questions)) {
    await expect($(".library-home-questions")).toHaveText(expect.stringContaining(label));
  }
  const coverageDisclosure = await $(".library-home-coverage-disclosure");
  expect(await coverageDisclosure.getAttribute("open"))
    .toBe(coverageExpanded ? "" : null);
  const domainRows = await coverageDisclosure.$$(".library-home-coverage li");
  expect(domainRows).toHaveLength(Object.keys(catalog.home.domains).length);
  const retainedExplorers = await $$(
    "#activity-heading, .training-insights, .sleep-insights, .recovery-insights, .longitudinal-insights",
  );
  for (const explorer of retainedExplorers) await expect(explorer).not.toBeDisplayed();
}

async function expectHomeSummaryDestinations(catalog) {
  const summaryActions = await $$(".library-home-summary-action");
  expect(summaryActions).toHaveLength(2);

  await summaryActions[0].click();
  await $(".training-session-results").waitForDisplayed({ timeout: 10_000 });
  await expect($(`aria/${catalog.training.workspaces.sessions}`))
    .toHaveAttribute("aria-current", "page");
  const completeHistoryQuery = await $(".training-session-applied-query");
  await expect(completeHistoryQuery).toHaveAttribute("data-refined", "false");
  await expect(completeHistoryQuery).toHaveText(
    expect.stringContaining(catalog.training.sessionLibrary.defaultRefinements),
  );
  await returnToLibraryHome(catalog);
  await expectDocumentFocus(
    ".library-home-summary-action:first-of-type",
    "Home did not restore the training-session summary origin",
  );

  const restoredSummaryActions = await $$(".library-home-summary-action");
  await restoredSummaryActions[1].click();
  await $(".training-sports").waitForDisplayed({ timeout: 10_000 });
  await expect($(`aria/${catalog.training.workspaces.sports}`))
    .toHaveAttribute("aria-current", "page");
  await returnToLibraryHome(catalog);
  await expectDocumentFocus(
    ".library-home-summary-action:nth-of-type(2)",
    "Home did not restore the sport-summary origin",
  );
}

async function expectHomeCoverageDestination(catalog) {
  const disclosure = await $(".library-home-coverage-disclosure");
  await disclosure.$("summary").click();
  const training = await disclosure.$(
    ".library-home-coverage li[data-domain='training'] button",
  );
  await training.click();
  await $(".training-session-results").waitForDisplayed({ timeout: 10_000 });
  await expect($(`aria/${catalog.training.workspaces.sessions}`))
    .toHaveAttribute("aria-current", "page");
  await returnToLibraryHome(catalog);
  expect(await disclosure.getAttribute("open")).toBe("");
  await expectDocumentFocus(
    ".library-home-coverage li[data-domain='training'] button",
    "Home did not restore the training-coverage origin",
  );
}

async function expectComparisonHeading(selector, expectedText) {
  const heading = await $(selector);
  await heading.waitForDisplayed({ timeout: 10_000 });
  await expect(heading).toHaveText(expectedText);
}

async function setAppearanceAndZoom(appearance, zoom, save, destination = "explore") {
  await openSettingsCategory("appearance");
  const appearanceInput = await $(`input[name='appearance'][value='${appearance}']`);
  await appearanceInput.waitForEnabled({ timeout: 10_000 });
  await appearanceInput.click();
  await browser.execute((nextZoom) => {
    const select = document.querySelector("#application-content-zoom");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    ).set;
    setValue.call(select, String(nextZoom));
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, zoom);
  await expect($("#application-content-zoom")).toHaveValue(String(zoom));
  await browser.waitUntil(
    () => browser.execute(
      ({ expectedAppearance, expectedZoom }) => (
        document.documentElement.dataset.appearance === expectedAppearance
        && document.documentElement.style.getPropertyValue("--content-zoom")
          === String(expectedZoom / 100)
      ),
      { expectedAppearance: appearance, expectedZoom: zoom },
    ),
    { timeout: 10_000, timeoutMsg: "the appearance preview was not applied" },
  );
  if (save) {
    await persistSettings();
    await goToHome(destination);
    return;
  }
  const requestedDestination = await $(`.app-sidebar nav button[data-home='${destination}']`);
  await requestedDestination.click();
  const guard = await $(".settings-navigation-guard");
  await guard.waitForDisplayed({ timeout: 10_000 });
  await guard.$("button:not(.secondary)").click();
  await browser.waitUntil(
    async () => (await requestedDestination.getAttribute("aria-current")) === "page",
    { timeout: 10_000, timeoutMsg: "discarding the Settings draft did not continue navigation" },
  );
}

async function resetSettings(destination = "explore") {
  await openSettingsCategory("appearance");
  const reset = await $(".settings-actions button.secondary");
  await reset.waitForEnabled({ timeout: 10_000 });
  await reset.click();
  await browser.waitUntil(
    () => browser.execute(() => (
      document.documentElement.dataset.appearance === "system"
      && document.documentElement.style.getPropertyValue("--content-zoom") === "1"
    )),
    { timeout: 10_000, timeoutMsg: "the application settings were not reset" },
  );
  await persistSettings();
  await goToHome(destination);
}

async function setActivityRange(from, through) {
  await openDisclosure(".activity-history-controls");
  await browser.execute((values) => {
    const inputs = document.querySelectorAll(".activity-filter input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      if (index >= values.length) return;
      setValue.call(input, values[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, [from, through]);
  const inputs = await $$(".activity-filter input[type='date']");
  await expect(inputs[0]).toHaveValue(from);
  await expect(inputs[1]).toHaveValue(through);
}

async function setComparisonRanges(baselineFrom, baselineThrough, comparisonFrom, comparisonThrough) {
  const controls = await $(".activity-comparison .answer-controls");
  if ((await controls.getAttribute("open")) === null) {
    await controls.$("summary").click();
  }
  const values = [baselineFrom, baselineThrough, comparisonFrom, comparisonThrough];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".activity-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".activity-comparison input[type='date']");
  expect(inputs).toHaveLength(4);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function setReportComparisonRanges(
  baselineFrom,
  baselineThrough,
  comparisonFrom,
  comparisonThrough,
) {
  const values = [baselineFrom, baselineThrough, comparisonFrom, comparisonThrough];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".report-analysis-ranges input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".report-analysis-ranges input[type='date']");
  expect(inputs).toHaveLength(4);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function setReportAnalysisMetrics(findingMetric, chartMetric) {
  const values = [findingMetric, chartMetric];
  await browser.execute((nextValues) => {
    const selects = document.querySelectorAll(".report-analysis-metric select");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    ).set;
    selects.forEach((select, index) => {
      setValue.call(select, nextValues[index]);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const selects = await $$(".report-analysis-metric select");
  expect(selects).toHaveLength(2);
  for (let index = 0; index < values.length; index += 1) {
    await expect(selects[index]).toHaveValue(values[index]);
  }
}

function formatLocalDate(locale, value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

async function formatBrowserTrainingLocalDateTime(locale, value) {
  return browser.execute(({ requestedLocale, localDateTime }) => {
    const recordedTime = localDateTime.match(/T\d{2}:\d{2}:(\d{2})(?:\.(\d+))?/);
    const hasFractionalPrecision = recordedTime?.[2] !== undefined
      && /[1-9]/.test(recordedTime[2]);
    const hasSecondPrecision = recordedTime === null
      || recordedTime[1] !== "00"
      || hasFractionalPrecision;
    return new Intl.DateTimeFormat(
      requestedLocale,
      {
        dateStyle: "medium",
        timeStyle: hasSecondPrecision ? "medium" : "short",
        timeZone: "UTC",
      },
    ).format(new Date(`${localDateTime}Z`));
  }, {
    requestedLocale: locale,
    localDateTime: value,
  });
}

async function formatBrowserTrainingCardDateTime(locale, value) {
  return browser.execute(({ requestedLocale, localDateTime }) => {
    const date = new Date(`${localDateTime}Z`);
    return {
      date: new Intl.DateTimeFormat(
        requestedLocale,
        { dateStyle: "medium", timeZone: "UTC" },
      ).format(date),
      time: new Intl.DateTimeFormat(
        requestedLocale,
        { timeStyle: "short", timeZone: "UTC" },
      ).format(date),
    };
  }, {
    requestedLocale: locale,
    localDateTime: value,
  });
}

async function formatBrowserSleepLocalDateTime(locale, value) {
  return browser.execute(({ requestedLocale, offsetDateTime }) => {
    const offset = offsetDateTime.slice(-6);
    const wallClock = offsetDateTime.slice(0, -6);
    const formatted = new Intl.DateTimeFormat(
      requestedLocale,
      { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" },
    ).format(new Date(`${wallClock}Z`));
    return `${formatted} (UTC${offset})`;
  }, { requestedLocale: locale, offsetDateTime: value });
}

async function expectHistory(expectedRows, { initiallyClosed = false } = {}) {
  const disclosure = await $(".activity-exact-evidence");
  await disclosure.waitForExist({ timeout: 10_000 });
  if (initiallyClosed) {
    expect(await disclosure.getAttribute("open")).toBeNull();
  }
  await openDisclosure(".activity-exact-evidence");
  const historyRows = ".history-grid table tbody tr";
  await browser.waitUntil(async () => (await $$(historyRows)).length === expectedRows.length, {
    timeout: 10_000,
    timeoutMsg: `history did not contain ${expectedRows.length} rows`,
  });
  const rows = await $$(historyRows);
  for (let index = 0; index < expectedRows.length; index += 1) {
    await expect(rows[index]).toBeDisplayed();
    const cells = await rows[index].$$("td");
    await expect(cells[0]).toHaveText(expectedRows[index][0]);
    await expect(cells[1]).toHaveText(expectedRows[index][1]);
    await expect(cells[2]).toHaveText(expectedRows[index][2]);
  }
}

async function expectFilterRange(selector, from, through) {
  if (selector === ".training-session-search") {
    await openDisclosure(".training-session-refinements");
  }
  await browser.waitUntil(async () => {
    const inputs = await $$(`${selector} input[type='date']`);
    if (inputs.length !== 2) return false;
    return await inputs[0].getValue() === from && await inputs[1].getValue() === through;
  }, {
    timeout: 10_000,
    timeoutMsg: `${selector} did not select ${from} through ${through}`,
  });
}

async function expectActivitySummary(expectedItems) {
  const items = await $$(".activity-summary li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    const value = await items[index].$("strong");
    const label = await items[index].$("span");
    await expect(value).toHaveText(expectedItems[index][0]);
    await expect(label).toHaveText(expectedItems[index][1]);
  }
}

async function setTrainingRange(from, through) {
  await openDisclosure(".training-session-refinements");
  const values = [from, through];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".training-session-search input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".training-session-search input[type='date']");
  expect(inputs).toHaveLength(2);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function selectTrainingSort(value) {
  await browser.execute((nextValue) => {
    const select = document.querySelector(".training-session-search select");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    ).set;
    setValue.call(select, nextValue);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await expect($(".training-session-search select")).toHaveValue(value);
}

async function setTrainingComparisonRanges(
  baselineFrom,
  baselineThrough,
  comparisonFrom,
  comparisonThrough,
) {
  const values = [baselineFrom, baselineThrough, comparisonFrom, comparisonThrough];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".training-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".training-comparison input[type='date']");
  expect(inputs).toHaveLength(4);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function expectUsefulComparisonDefault(selector, catalog) {
  await openDisclosure(`${selector} > .answer-controls`);
  const inputs = await $$(`${selector} input[type='date']`);
  expect(inputs).toHaveLength(4);
  const values = [];
  for (const input of inputs) values.push(await input.getValue());
  expect(values.slice(0, 2)).not.toEqual(values.slice(2));
  await expect($(`${selector} .comparison-period-presets p`)).toHaveText(
    catalog.comparisonPeriods.manualHint,
  );
}

async function openTrainingWorkspace(catalog, workspace) {
  const expected = catalog.training.workspaces[workspace];
  const buttons = await $$(".training-workspace-navigation button");
  let target;
  for (const button of buttons) {
    if (await button.getText() === expected) {
      target = button;
      break;
    }
  }
  if (!target) throw new Error(`Training workspace was not available: ${expected}`);
  await target.click();
  await expect(target).toHaveAttribute("aria-current", "page");
  const selector = {
    sessions: ".training-session-library",
    plans: ".planned-training",
    sports: ".training-sports",
    comparison: ".training-comparison",
  }[workspace];
  await $(selector).waitForDisplayed({ timeout: 10_000 });
}

async function openTrainingDetailSection(catalog, section) {
  const expected = catalog.training.sessionLibrary.detailSections[section];
  const buttons = await $$(".training-detail-navigation button");
  let target;
  for (const button of buttons) {
    if (await button.getText() === expected) {
      target = button;
      break;
    }
  }
  if (!target) throw new Error(`Training detail section was not available: ${expected}`);
  await target.click();
  await expect(target).toHaveAttribute("aria-current", "page");
  const revealedSection = await $(`#training-detail-${section}`);
  await revealedSection.waitForDisplayed({ timeout: 10_000 });
  await expect(revealedSection).toBeFocused();
  const geometry = await browser.execute((selector) => {
    const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
    const revealed = document.querySelector(selector).getBoundingClientRect();
    return {
      compact: navigation.width >= document.documentElement.clientWidth - 1,
      navigationBottom: navigation.bottom,
      navigationRight: navigation.right,
      revealedLeft: revealed.left,
      revealedTop: revealed.top,
      viewportHeight: document.documentElement.clientHeight,
    };
  }, `#training-detail-${section}`);
  if (geometry.compact) {
    expect(geometry.revealedTop).toBeGreaterThanOrEqual(geometry.navigationBottom - 1);
  } else {
    expect(geometry.revealedLeft).toBeGreaterThanOrEqual(geometry.navigationRight - 1);
  }
  expect(geometry.revealedTop).toBeLessThan(geometry.viewportHeight);
}

async function openDomainWorkspace(catalog, domain, workspace) {
  const expected = catalog[domain].workspaces[workspace];
  const navigation = await $('.workspace-navigation[aria-label="'
    + catalog[domain].workspaceNavigation
    + '"]');
  const buttons = await navigation.$$("button");
  let target;
  for (const button of buttons) {
    if (await button.getText() === expected) {
      target = button;
      break;
    }
  }
  if (!target) throw new Error(`${domain} workspace was not available: ${expected}`);
  await target.click();
  await expect(target).toHaveAttribute("aria-current", "page");
  const selector = workspace === "comparison"
    ? `.${domain === "longitudinal" ? "longitudinal" : domain}-comparison`
    : ".explorer-history-workspace";
  await $(selector).waitForDisplayed({ timeout: 10_000 });
}

async function openReportWorkspace(catalog, workspace) {
  const navigation = await $('.workspace-navigation[aria-label="'
    + catalog.reports.workspaceNavigation
    + '"]');
  const target = await navigation.$(`aria/${catalog.reports.workspaces[workspace]}`);
  await target.click();
  await expect(target).toHaveAttribute("aria-current", "page");
  const selector = workspace === "library"
    ? ".report-library"
    : workspace === "compose" ? ".report-editor" : ".report-preview";
  await $(selector).waitForDisplayed({ timeout: 10_000 });
}

async function expectTrainingRows(expectedRows) {
  const selector = ".training-session-results > li";
  try {
    await browser.waitUntil(async () => (await $$(selector)).length === expectedRows.length, {
      timeout: 10_000,
      timeoutMsg: `training history did not contain ${expectedRows.length} rows`,
    });
  } catch (error) {
    const actualRows = await $$(selector);
    const training = await $(".training-insights").getText();
    throw new Error(
      `training history contained ${actualRows.length} rows instead of ${expectedRows.length}; `
      + `visible training text: ${training}; ${String(error)}`,
    );
  }
  const rows = await $$(selector);
  for (let index = 0; index < expectedRows.length; index += 1) {
    await expect(rows[index].$(".training-session-result-date"))
      .toHaveText(expectedRows[index][0].date);
    await expect(rows[index].$(".training-session-result-time"))
      .toHaveText(expectedRows[index][0].time);
    const values = await rows[index].$$("dd");
    expect(values).toHaveLength(expectedRows[index].length - 1);
    for (let valueIndex = 1; valueIndex < expectedRows[index].length; valueIndex += 1) {
      await expect(values[valueIndex - 1]).toHaveText(expectedRows[index][valueIndex]);
    }
  }
}

async function expectTrainingSummary(expectedItems) {
  await openDisclosure(".training-session-result-summary");
  const items = await $$(".training-summary li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    await expect(items[index].$("strong")).toHaveText(expectedItems[index][0]);
    await expect(items[index].$("span")).toHaveText(expectedItems[index][1]);
  }
}

async function trainingSportCard(title) {
  const cards = await $$(".training-sport-list > li");
  for (const card of cards) {
    if (await card.$("h3").getText() === title) return card;
  }
  throw new Error(`Training sport card was not available: ${title}`);
}

async function trainingHistorySportItem(title) {
  await openDisclosure(".training-history-sports-disclosure");
  const items = await $$(".training-history-sports li");
  for (const item of items) {
    if (await item.$("strong").getText() === title) return item;
  }
  throw new Error(`Training history sport was not available: ${title}`);
}

async function expectHomeSportClassificationRoundTrip(catalog, homeTitle, trainingTitle) {
  const homeActionLabel = catalog.home.classifySportAccessible.replace("{sport}", homeTitle);
  const homeAction = await $(`aria/${homeActionLabel}`);
  await homeAction.click();
  await $(".training-sports").waitForDisplayed({ timeout: 10_000 });
  const sportsWorkspace = await $(`aria/${catalog.training.workspaces.sports}`);
  await expect(sportsWorkspace).toHaveAttribute("aria-current", "page");
  const editor = await $(".training-sport-editor");
  await expect(editor).toHaveAttribute(
    "aria-label",
    catalog.training.sports.editorHeading.replace("{sport}", trainingTitle),
  );
  await expectDocumentFocus(
    ".training-sport-editor",
    "Home sport classification did not focus the shared editor",
  );
  await editor.$(`aria/${catalog.training.sports.cancel}`).click();
  const trainingSport = await trainingSportCard(trainingTitle);
  await expectElementFocus(
    await trainingSport.$(`aria/${catalog.training.sports.edit}`),
    "sport classification cancellation did not restore Sports focus",
  );
  await returnToLibraryHome(catalog);
  await expectDocumentFocus(
    ".library-home-sport-classify",
    "Home did not restore the exact sport-classification origin",
  );
}

async function saveContextSportClassification(catalog, currentTitle, family, label) {
  const item = await trainingHistorySportItem(currentTitle);
  const action = await item.$(".training-history-sport-classify");
  await action.click();
  const editor = await $(".training-history-sport-editor form");
  await expect(editor.$("label[for$='-family']")).toHaveText(
    catalog.training.sports.family,
  );
  await expect(editor.$("label[for$='-label']")).toHaveText(
    catalog.training.sports.displayLabel,
  );
  const familySelect = await editor.$("select");
  await selectNativeOption(familySelect, family);
  await expect(familySelect).toHaveValue(family);
  const input = await editor.$("input");
  await input.clearValue();
  await input.setValue(label);
  await expect(familySelect).toHaveValue(family);
  await editor.$("button[type='submit']").click();
  await browser.waitUntil(
    async () => (await item.$("strong").getText()) === label,
    { timeout: 10_000, timeoutMsg: `context sport classification was not saved as ${label}` },
  );
  await expect(item).toHaveAttribute("data-sport-family", family);
  await browser.waitUntil(
    async () => {
      const sessionSports = await $$(".training-session-results .training-session-sport");
      for (const sport of sessionSports) {
        if (await sport.getText() === label) return true;
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: `session identities did not refresh as ${label}` },
  );
  await waitForNotice(catalog.training.sports.saved);
}

async function saveSportClassification(catalog, currentTitle, family, label) {
  const card = await trainingSportCard(currentTitle);
  await card.$(".training-sport-classify").click();
  const editor = await card.$("form");
  await expect(editor.$("label[for$='-family']")).toHaveText(
    catalog.training.sports.family,
  );
  await expect(editor.$("label[for$='-label']")).toHaveText(
    catalog.training.sports.displayLabel,
  );
  const familySelect = await editor.$("select");
  await selectNativeOption(familySelect, family);
  await expect(familySelect).toHaveValue(family);
  const input = await editor.$("input");
  await input.clearValue();
  await input.setValue(label);
  await expect(familySelect).toHaveValue(family);
  await editor.$("button[type='submit']").click();
  await browser.waitUntil(
    async () => (await card.$("h3").getText()) === label,
    { timeout: 10_000, timeoutMsg: `sport classification was not saved as ${label}` },
  );
  await expect(card).toHaveAttribute("data-sport-family", family);
  await waitForNotice(catalog.training.sports.saved);
}

async function resetSportClassification(catalog, currentTitle) {
  const card = await trainingSportCard(currentTitle);
  await card.$(".training-sport-classify").click();
  await card.$(`aria/${catalog.training.sports.reset}`).click();
  await browser.waitUntil(
    async () => (await card.getAttribute("data-state")) === "personally-overridden",
    { timeout: 10_000, timeoutMsg: "sport classification did not preserve explicit personal unknown" },
  );
}

async function expectTrainingComparison(expectedRows) {
  const exactValues = await $(".training-comparison-result .answer-exact-values");
  if ((await exactValues.getAttribute("open")) === null) {
    await exactValues.$("summary").click();
  }
  const rows = await $$(".training-comparison-result table tbody tr");
  expect(rows).toHaveLength(expectedRows.length);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("th, td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function openDisclosure(selector) {
  const disclosure = await $(selector);
  await disclosure.waitForExist({ timeout: 10_000 });
  if ((await disclosure.getAttribute("open")) === null) {
    await disclosure.$("summary").click();
  }
  await browser.waitUntil(async () => (await disclosure.getAttribute("open")) !== null, {
    timeout: 10_000,
    timeoutMsg: `${selector} did not open`,
  });
}

async function openDisclosures(selector) {
  const disclosures = await $$(selector);
  expect(disclosures.length).toBeGreaterThan(0);
  for (const disclosure of disclosures) {
    if ((await disclosure.getAttribute("open")) === null) {
      await disclosure.$("summary").click();
    }
    await browser.waitUntil(async () => (await disclosure.getAttribute("open")) !== null, {
      timeout: 10_000,
      timeoutMsg: `${selector} did not open`,
    });
  }
}

async function setSleepRange(from, through) {
  await openDisclosure(".sleep-insights .explorer-history-workspace > .answer-controls");
  const values = [from, through];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".sleep-filter input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".sleep-filter input[type='date']");
  expect(inputs).toHaveLength(2);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function setSleepComparisonRanges(
  baselineFrom,
  baselineThrough,
  comparisonFrom,
  comparisonThrough,
) {
  await openDisclosure(".sleep-comparison > .answer-controls");
  const values = [baselineFrom, baselineThrough, comparisonFrom, comparisonThrough];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".sleep-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".sleep-comparison input[type='date']");
  expect(inputs).toHaveLength(4);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function expectSleepRows(expectedRows) {
  await openDisclosures(".sleep-answer .sleep-exact-evidence");
  const selector = ".sleep-exact-evidence table tbody tr";
  await browser.waitUntil(async () => (await $$(selector)).length === expectedRows.length, {
    timeout: 10_000,
    timeoutMsg: `sleep history did not contain ${expectedRows.length} rows`,
  });
  const rows = await $$(selector);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function expectSleepSummary(expectedItems) {
  const items = await $$(".sleep-summary li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    await expect(items[index].$("strong")).toHaveText(expectedItems[index][0]);
    await expect(items[index].$("span")).toHaveText(expectedItems[index][1]);
  }
}

async function expectSleepComparison(expectedRows) {
  await openDisclosures(".sleep-comparison-result .answer-exact-values");
  const rows = await $$(".sleep-comparison-result table tbody tr");
  expect(rows).toHaveLength(expectedRows.length);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("th, td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function setRecoveryRange(from, through) {
  await openDisclosure(".recovery-insights .explorer-history-workspace > .answer-controls");
  const values = [from, through];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".recovery-filter input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".recovery-filter input[type='date']");
  expect(inputs).toHaveLength(2);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function setRecoveryComparisonRanges(
  baselineFrom,
  baselineThrough,
  comparisonFrom,
  comparisonThrough,
) {
  await openDisclosure(".recovery-comparison > .answer-controls");
  const values = [baselineFrom, baselineThrough, comparisonFrom, comparisonThrough];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".recovery-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".recovery-comparison input[type='date']");
  expect(inputs).toHaveLength(4);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function expectRecoveryRows(expectedRows) {
  await openDisclosures(".recovery-answer .recovery-exact-evidence");
  const selector = ".recovery-exact-evidence table tbody tr";
  await browser.waitUntil(async () => (await $$(selector)).length === expectedRows.length, {
    timeout: 10_000,
    timeoutMsg: `recovery history did not contain ${expectedRows.length} rows`,
  });
  const rows = await $$(selector);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function expectRecoverySummary(expectedItems) {
  const items = await $$(".recovery-summary li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    await expect(items[index].$("strong")).toHaveText(expectedItems[index][0]);
    await expect(items[index].$("span")).toHaveText(expectedItems[index][1]);
  }
}

async function expectRecoveryComparison(expectedRows) {
  await openDisclosures(".recovery-comparison-result .answer-exact-values");
  const rows = await $$(".recovery-comparison-result table tbody tr");
  expect(rows).toHaveLength(expectedRows.length);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("th, td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function setLongitudinalRange(from, through) {
  await openDisclosure(".longitudinal-insights .explorer-history-workspace > .answer-controls");
  const values = [from, through];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".longitudinal-filter input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".longitudinal-filter input[type='date']");
  expect(inputs).toHaveLength(2);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function setLongitudinalComparisonRanges(
  baselineFrom,
  baselineThrough,
  comparisonFrom,
  comparisonThrough,
) {
  await openDisclosure(".longitudinal-comparison > .answer-controls");
  const values = [baselineFrom, baselineThrough, comparisonFrom, comparisonThrough];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".longitudinal-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    inputs.forEach((input, index) => {
      setValue.call(input, nextValues[index]);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, values);
  const inputs = await $$(".longitudinal-comparison input[type='date']");
  expect(inputs).toHaveLength(4);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
}

async function expectLongitudinalRows(expectedRows) {
  await openDisclosures(".longitudinal-exact-evidence");
  const selector = ".longitudinal-exact-evidence .longitudinal-table-scroll tbody tr";
  await browser.waitUntil(async () => (await $$(selector)).length === expectedRows.length, {
    timeout: 10_000,
    timeoutMsg: `longitudinal history did not contain ${expectedRows.length} rows`,
  });
  const rows = await $$(selector);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("th, td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function expectLongitudinalSummary(expectedItems) {
  await openDisclosures(".longitudinal-exact-evidence");
  const items = await $$(".longitudinal-summary li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    await expect(items[index].$("strong")).toHaveText(expectedItems[index][0]);
    await expect(items[index].$("small")).toHaveText(expectedItems[index][1]);
  }
}

async function expectLongitudinalComparison(expectedRows) {
  await openDisclosures(".longitudinal-comparison-exact");
  const rows = await $$(".longitudinal-comparison-result table tbody tr");
  expect(rows).toHaveLength(expectedRows.length);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("th, td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function expectFamilyCoverage(expectedRows) {
  const rows = await $$(".family-coverage-table tbody tr");
  expect(rows).toHaveLength(expectedRows.length);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const family = await rows[index].$("th");
    const cells = await rows[index].$$("td");
    await expect(family).toHaveText(expectedRows[index].family);
    await expect(cells[0]).toHaveText(expectedRows[index].classification);
    await expect(cells[1]).toHaveText(expectedRows[index].count);
    await expect(cells[2]).toHaveText(expect.stringContaining(expectedRows[index].reason));
    await expect(cells[2]).toHaveText(expect.stringContaining(expectedRows[index].action));
  }
}

async function expectCoverage(expectedItems) {
  const items = await $$(".coverage-summary li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    const count = await items[index].$("strong");
    const label = await items[index].$("span");
    await expect(count).toHaveText(expectedItems[index][0]);
    await expect(label).toHaveText(expectedItems[index][1]);
  }
}

async function openOutcomeDisclosure(selector) {
  const disclosure = await $(selector);
  if ((await disclosure.getAttribute("open")) === null) {
    await disclosure.$("summary").click();
  }
  await expect(disclosure).toHaveAttribute("open");
}

async function expectSourceGuide(catalog) {
  const expectedItems = [
    ...Object.values(catalog.sources.instructions),
    ...Object.values(catalog.sources.constraints),
    ...Object.values(catalog.sources.troubleshooting),
  ];
  const items = await $$("#source-acquisition-guide li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    await expect(items[index]).toHaveText(expectedItems[index]);
  }
}

describe("packaged FitFreed import journey", () => {
  it("covers validation, outcomes, coverage, cancellation, reimport, accessibility, performance, and WebDriver session continuity", async () => {
    const journeyStartedAt = Date.now();
    const recordJourneyPhase = (journeyPhase) => process.stdout.write(`${JSON.stringify({
      journeyPhase,
      elapsedMilliseconds: Date.now() - journeyStartedAt,
    })}\n`);
    recordJourneyPhase("shell-and-first-run");
    fs.rmSync(reportOutput, { force: true });
    fs.rmSync(refreshedReportOutput, { force: true });
    fs.rmSync(plannedReportOutput, { force: true });
    await resizeApplication(1440, 900);
    await expectApplicationShellLayout(english, "desktop", true);
    await resizeApplication(900, 760);
    await expectApplicationShellLayout(english, "compact");
    await resizeApplication(1280, 820);
    await expect($(".library-home-empty h1")).toHaveText(english.home.emptyHeading);
    await expect($(".library-home-empty-copy")).toHaveText(
      expect.stringContaining(english.home.emptyIntro),
    );
    await expect($(".library-home-empty-possibilities")).toHaveText(
      expect.stringContaining(english.home.emptyPreviewSports.running.detail),
    );
    expect(await $$(".library-home-empty-possibilities .sport-family-icon"))
      .toHaveLength(Object.keys(english.home.emptyPreviewSports).length);
    await expect($(".app-sidebar nav button[data-home='home']"))
      .toHaveAttribute("aria-current", "page");
    recordJourneyPhase("source-acquisition-and-import");
    await $(`aria/${english.home.emptyGuideAction}`).click();
    await expect($(".sources-home h1")).toHaveText("Import your fitness history");
    await expect($("aria/Import selected package")).toBeDisabled();
    const openerMock = await browser.tauri.mock("fitfreed:official-source-link|open");
    await expect($("#source-guide-heading")).toHaveText(
      "How to obtain your Polar Flow export",
    );
    await expectSourceGuide(english);
    await expect($("#source-acquisition-guide")).toHaveText(
      expect.stringContaining("available to download for two weeks"),
    );
    await expectDocumentFocus(
      "#source-guide-heading",
      "source guidance did not receive focus after its Home action",
    );
    const guideReveal = await browser.execute(() => {
      const heading = document.querySelector("#source-guide-heading").getBoundingClientRect();
      return {
        top: heading.top,
        bottom: heading.bottom,
        viewportHeight: document.documentElement.clientHeight,
      };
    });
    expect(guideReveal.top).toBeGreaterThanOrEqual(0);
    expect(guideReveal.bottom).toBeLessThanOrEqual(guideReveal.viewportHeight);
    await expect($("#source-acquisition-guide")).toHaveText(
      expect.stringContaining("https://account.polar.com/"),
    );
    await expect($("#source-acquisition-guide")).toHaveText(
      expect.stringContaining(
        "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
      ),
    );
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r10-source-workspace-en-wide.png",
    ));
    await $("aria/Open official account page").click();
    await browser.execute(() => {
      [...document.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Open official instructions")
        ?.focus();
    });
    await expectDocumentFocus(
      ".source-official-action:nth-child(2) button",
      "official instructions action did not receive keyboard focus",
    );
    await $("aria/Open official instructions").click();
    await browser.waitUntil(async () => {
      await openerMock.update();
      return openerMock.mock.calls.length === 2;
    }, { timeout: 10_000, timeoutMsg: "official source destinations were not opened" });
    expect(openerMock.mock.calls.map(([arguments_]) => arguments_.url)).toEqual([
      "https://account.polar.com/",
      "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
    ]);
    await expect($(".source-link-accepted")).toHaveText(english.sources.openAccepted);
    const sourcesAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .analyze();
    expect(sourcesAccessibility.violations).toEqual([]);
    const sourceDialogMock = await browser.tauri.mock("plugin:dialog|open");
    await openArchivePicker(sourceDialogMock, null, english.choose);
    await expect($(".path")).toHaveText(english.noPackage);
    await expect($("aria/Import selected package")).toBeDisabled();

    await goToHome("home");
    await expect($(".library-home-empty h1")).toHaveText(english.home.emptyHeading);
    expect(await $$(".library-home-questions")).toHaveLength(0);
    expect(await $$("#activity-heading, .training-insights, .sleep-insights, .recovery-insights, .longitudinal-insights")).toHaveLength(0);

    await setAppearanceAndZoom("dark", 175, false, "home");
    await expect($("html")).toHaveAttribute("data-appearance", "system");
    expect(await browser.execute(
      () => document.documentElement.style.getPropertyValue("--content-zoom"),
    )).toBe("1");
    await setAppearanceAndZoom("light", 200, true, "home");
    await expect($("html")).toHaveAttribute("data-appearance", "light");
    await expectApplicationShellLayout(english, "compact");
    await expectFirstRunActionsBeforePreview();
    await openSettingsCategory("appearance");
    await expectSettingsControlsWithinInitialViewport();
    await goToHome("home");
    await resizeApplication(900, 760);
    await expectApplicationShellLayout(english, "compact");
    await resizeApplication(1280, 820);
    await browser.reloadSession();
    await expect($("html")).toHaveAttribute("data-appearance", "light");
    expect(await browser.execute(
      () => document.documentElement.style.getPropertyValue("--content-zoom"),
    )).toBe("2");
    await resetSettings("home");
    await expect($("html")).toHaveAttribute("data-appearance", "system");
    await openSettingsCategory("appearance");
    await expect($(".settings-preview")).toHaveText(
      expect.stringContaining(english.settings.previewTitle),
    );
    await expect($(".settings-preview")).toHaveText(
      expect.stringContaining(english.settings.previewDistance),
    );
    await expectSettingsControlsWithinInitialViewport();
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r10-settings-workspace-en-wide.png",
    ));
    await $("input[name='appearance'][value='dark']").click();
    await expect($(".settings-status")).toHaveText(english.settings.unsaved);
    await $(`aria/${english.settings.cancel}`).click();
    await expect($("html")).toHaveAttribute("data-appearance", "system");
    expect(await $("input[name='appearance'][value='system']").isSelected()).toBe(true);
    expect(await $$(".settings-status")).toHaveLength(0);
    await openSettingsCategory("updates");
    await expect($("#update-heading")).toHaveText(english.updates.heading);
    await expect($(".update-installed-version")).toHaveText(
      expect.stringContaining(english.updates.installedVersion),
    );
    await expect($(".update-installed-version")).toHaveText(
      expect.stringContaining("0.1.0"),
    );
    expect(await browser.execute(
      () => document.querySelector(".settings-panel .update-panel") !== null,
    )).toBe(true);
    await expect($("aria/Check now")).toBeEnabled();
    await expect($(".settings-layout")).not.toBeDisplayed();
    await openSettingsCategory("appearance");
    await expect($(".settings-layout")).toBeDisplayed();

    await selectLocale("es-ES", "sources");
    await expectApplicationShellLayout(spanish, "desktop");
    await expect($(".sources-home h1")).toHaveText(spanish.sources.title);
    await expect($("#source-guide-heading")).toHaveText(spanish.sources.guideTitle);
    await expectSourceGuide(spanish);
    const spanishOpenerMock = await browser.tauri.mock("fitfreed:official-source-link|open");
    await $("aria/Abrir las instrucciones oficiales").click();
    await browser.waitUntil(async () => {
      await spanishOpenerMock.update();
      return spanishOpenerMock.mock.calls.length === 1;
    }, { timeout: 10_000, timeoutMsg: "localized official source destination was not opened" });
    expect(spanishOpenerMock.mock.calls[0][0].url).toBe(
      "https://support.polar.com/es/how-to-download-all-your-data-from-polar-flow",
    );
    await expect($(".source-link-accepted")).toHaveText(spanish.sources.openAccepted);
    await selectLocale("en-US", "home");
    await expect($(".library-home-empty h1")).toHaveText(english.home.emptyHeading);

    const dialogMock = await browser.tauri.mock("plugin:dialog|open");
    await openArchivePicker(
      dialogMock,
      null,
      english.home.emptyAction,
      english.choose,
    );
    await expect($(".path")).toHaveText("No package selected");
    await expect($("aria/Import selected package")).toBeDisabled();

    await selectArchive(dialogMock, largeArchive, english.choose);
    const progressStartedAt = Date.now();
    await $("aria/Import selected package").click();
    await $("#source-active-heading").waitForDisplayed({ timeout: 1_000 });
    expect(Date.now() - progressStartedAt).toBeLessThanOrEqual(1_000);

    await goToHome("home");
    const shellImport = await $(".shell-active-operation");
    await shellImport.waitForDisplayed({ timeout: 1_000 });
    await expect(shellImport).toHaveText(expect.stringContaining(english.shell.activeImport));
    const restrictedHistory = await $(".app-sidebar nav button[data-home='explore']");
    await expect(restrictedHistory).toBeDisabled();
    await expect($(`aria/${english.home.emptyAction}`)).toBeDisabled();
    await expect($(`aria/${english.home.emptyGuideAction}`)).toBeDisabled();
    await expect(restrictedHistory).toHaveAttribute(
      "aria-describedby",
      "shell-explore-restriction",
    );
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "x6-c4-import-active-home-en-wide.png",
    ));
    await shellImport.$("button").click();
    await expect($(".app-sidebar nav button[data-home='sources']"))
      .toHaveAttribute("aria-current", "page");
    await $("#source-active-heading").waitForDisplayed({ timeout: 1_000 });

    await selectLocale("es-ES", "sources");
    await expect($(".sources-home h1")).toHaveText(spanish.sources.title);
    const cancel = await $("button.cancel");
    await cancel.waitForDisplayed({ timeout: 1_000 });
    const cancellationStartedAt = Date.now();
    await cancel.click();
    await browser.waitUntil(
      async () => {
        const cancellationButtons = await $$("button.cancel");
        return cancellationButtons.length === 0 || !(await cancellationButtons[0].isEnabled());
      },
      { timeout: 1_000, timeoutMsg: "cancellation control remained enabled" },
    );
    expect(Date.now() - cancellationStartedAt).toBeLessThanOrEqual(1_000);
    await waitForNotice(spanish.outcome.cancelledConsequence, 5_000);
    await $(`aria/${spanish.import}`).waitForEnabled({ timeout: 5_000 });
    expect(Date.now() - cancellationStartedAt).toBeLessThanOrEqual(5_000);
    expect(await $$(".history-grid table tbody tr")).toHaveLength(0);
    await expectImportOutcomeWithinInitialViewport(spanish.outcome.cancelledHeading);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r10-import-cancelled-es-wide.png",
    ));

    await selectLocale("en-US", "sources");
    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "unrelated.zip"),
      english.choose,
    );
    await $("aria/Import selected package").click();
    await expectImportOutcomeWithinInitialViewport(
      english.outcome.rejectedHeading,
      "could not identify this ZIP as a supported fitness-history export",
    );
    await expect($(".outcome-terminal-message")).toHaveText(
      expect.stringContaining("could not identify this ZIP as a supported fitness-history export"),
    );
    await expect($(".outcome-panel")).not.toHaveText(
      expect.stringContaining("unsafe file layout"),
    );

    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "unrelated-resource-limit.zip"),
      english.outcome.chooseAnother,
    );
    await $("aria/Import selected package").click();
    await expectImportOutcomeWithinInitialViewport(
      english.outcome.rejectedHeading,
      english.outcome.packageIdentities.unrecognized,
    );
    await expect($(".outcome-terminal-message")).toHaveText(
      expect.stringContaining(
        "At least one file in this ZIP expands beyond the 64 MB per-file limit",
      ),
    );
    await expect($(".outcome-panel")).not.toHaveText(
      expect.stringContaining("unsafe file layout"),
    );
    expect(await $$(".history-grid table tbody tr")).toHaveLength(0);

    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "invalid.zip"),
      english.outcome.chooseAnother,
    );
    await $("aria/Import selected package").click();
    expect(await $$('[role="alert"]')).toHaveLength(0);
    await expectImportOutcomeWithinInitialViewport(
      english.outcome.rejectedHeading,
      "recognized this as a Polar Flow export",
    );
    await expect($(".outcome-terminal-message")).toHaveText(
      expect.stringContaining("recognized this as a Polar Flow export"),
    );
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r10-import-rejected-en-wide.png",
    ));
    await openOutcomeDisclosure(".outcome-coverage-detail");
    await expectCoverage([
      ["1", "Supported"],
      ["0", "Unsupported"],
      ["0", "Deliberately ignored"],
      ["0", "Unrecognized"],
      ["1", "Invalid"],
    ]);
    await expectFamilyCoverage([
      {
        family: "Daily activity",
        classification: "Invalid",
        count: "1",
        reason: "Recognized content failed validation.",
        action: "Keep the original ZIP and report the compatibility problem.",
      },
      {
        family: "Account data",
        classification: "Supported",
        count: "1",
        reason: "The data is used only to link packages from the same provider account.",
        action: "No action is needed.",
      },
    ]);
    expect(await $$(".history-grid table tbody tr")).toHaveLength(0);

    await selectArchive(dialogMock, path.join(fixtureDirectory, "valid.zip"), english.choose);
    await $("aria/Import selected package").click();
    await waitForNotice(english.home.postImportChanged);
    await expectLibraryHome(english);
    await expectHomeSummaryDestinations(english);
    await expectHomeCoverageDestination(english);
    await expect($(".library-home-reveal")).toHaveText(
      expect.stringContaining(english.home.postImportChanged),
    );
    await expectHomeSportClassificationRoundTrip(
      english,
      english.home.sportUnknown,
      english.training.sports.unknown.replace("{index}", "1"),
    );
    const recentSession = (await $$(".library-home-recent button"))[0];
    const recentSessionLabel = await recentSession.getAttribute("aria-label");
    await recentSession.click();
    await $("#training-session-detail-heading").waitForDisplayed({ timeout: 10_000 });
    await expect($(".training-detail-identity .sport-family-icon")).toBeDisplayed();
    expect(await $(".training-detail-identity .eyebrow").getText()).not.toBe("");
    await returnToLibraryHome(english);
    await browser.waitUntil(
      () => browser.execute(
        (expectedLabel) => document.activeElement?.getAttribute("aria-label") === expectedLabel,
        recentSessionLabel,
      ),
      { timeout: 10_000, timeoutMsg: "Home did not restore the exact recent-session origin" },
    );
    await goToHome("sources");
    const importedChanges = await $$(".outcome-change-summary li");
    expect(importedChanges.length).toBeGreaterThan(0);
    await expect(importedChanges[0].$("strong")).toHaveText("7");
    await expect(importedChanges[0].$("span")).toHaveText("new observations");
    await openOutcomeDisclosure(".outcome-coverage-detail");
    await expectCoverage([
      ["9", "Supported"],
      ["0", "Unsupported"],
      ["2", "Deliberately ignored"],
      ["1", "Unrecognized"],
      ["0", "Invalid"],
    ]);
    await expectFamilyCoverage([
      {
        family: "Unrecognized data",
        classification: "Unrecognized",
        count: "1",
        reason: "The file does not match a known data family.",
        action: "Keep the original ZIP and report the compatibility problem.",
      },
      {
        family: "Nightly recovery details",
        classification: "Deliberately ignored",
        count: "1",
        reason: "Recovery samples have no documented date or record identity, so FitFreed cannot join them safely.",
        action: "Keep the original ZIP if you need the excluded recovery samples.",
      },
      {
        family: "Profile picture",
        classification: "Deliberately ignored",
        count: "1",
        reason: "Profile pictures are intentionally excluded from the MVP.",
        action: "Keep the original ZIP if the picture matters to you.",
      },
      {
        family: "Account data",
        classification: "Supported",
        count: "1",
        reason: "The data is used only to link packages from the same provider account.",
        action: "No action is needed.",
      },
      {
        family: "Daily activity",
        classification: "Supported",
        count: "3",
        reason: "The data is mapped into the current library.",
        action: "No action is needed.",
      },
      {
        family: "Nightly recovery",
        classification: "Supported",
        count: "1",
        reason: "Dated recovery summaries and their available assessment, baseline, and guidance are mapped into the library.",
        action: "No action is needed for the dated summaries.",
      },
      {
        family: "Sleep results",
        classification: "Supported",
        count: "1",
        reason: "Sleep periods, phases, and interruptions are mapped; alarm behavior and source-only metadata stay only in the original ZIP.",
        action: "Keep the original ZIP if you need the excluded sleep details.",
      },
      {
        family: "Sleep scores",
        classification: "Supported",
        count: "1",
        reason: "Sleep score components are mapped; scoring baselines stay only in the original ZIP.",
        action: "Keep the original ZIP if you need the excluded scoring context.",
      },
      {
        family: "Training sessions",
        classification: "Supported",
        count: "2",
        reason: "Session summaries, exercise structure, laps, pauses, recorded routes, supported time-series signals, and supported recorded zones are mapped; unsupported zone groups and signal types stay only in the original ZIP.",
        action: "Keep the original ZIP if you need unsupported zone groups or signal types.",
      },
    ]);
    recordJourneyPhase("english-exploration-and-reports");
    await openHomeQuestion(
      english,
      "review-activity-steps",
      "#activity-heading",
    );
    await $("#activity-comparison-heading").waitForDisplayed({ timeout: 10_000 });
    await expectUsefulComparisonDefault(".activity-comparison", english);
    await openDomainWorkspace(english, "activity", "history");
    await expectHistory([
      ["Jan 1, 2026", "3,100", "Step total available"],
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
    ], { initiallyClosed: true });
    await expectActivitySummary([
      ["7,300", "Total steps"],
      ["3,650", "Average per day with steps"],
      ["2", "Days with step totals"],
      ["1", "Observed days without a step total"],
      ["0", "Days with no observation"],
    ]);
    await captureR10WorkspaceEvidence(
      "r10-activity-en-wide.png",
      "section[aria-labelledby='activity-heading']",
    );
    const enJan4Start = await formatBrowserTrainingLocalDateTime(
      "en-US",
      "2026-01-04T06:15:00",
    );
    const enJan4Stop = await formatBrowserTrainingLocalDateTime(
      "en-US",
      "2026-01-04T07:15:00",
    );
    const enJan4Card = await formatBrowserTrainingCardDateTime(
      "en-US",
      "2026-01-04T06:15:00",
    );
    const enJan5Card = await formatBrowserTrainingCardDateTime(
      "en-US",
      "2026-01-05T18:00:00",
    );
    const enJan6Card = await formatBrowserTrainingCardDateTime(
      "en-US",
      "2026-01-06T07:30:00",
    );
    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    const contextualSport = await trainingHistorySportItem("Unknown sport 1");
    const contextualAction = await contextualSport.$(".training-history-sport-classify");
    await contextualAction.click();
    await exerciseSportClassificationComposition();
    await browser.waitUntil(
      async () => browser.execute(
        () => document.activeElement
          === document.querySelector(
            ".training-history-sports li[data-state='unknown'] .training-history-sport-classify",
          ),
      ),
      { timeout: 10_000, timeoutMsg: "context classification cancellation did not restore focus" },
    );
    await saveContextSportClassification(
      english,
      "Unknown sport 1",
      "running",
      "Trail running",
    );
    await expect($(".training-insights")).toBeDisplayed();
    await goToHome("home");
    await expect($(".library-home-sports")).toHaveText(expect.stringContaining("Trail running"));
    await expect($(".library-home-recent")).toHaveText(expect.stringContaining("Trail running"));
    await captureR10WorkspaceEvidence("r10-home-en-wide.png", ".library-home");
    await goToHome("explore");
    await openTrainingWorkspace(english, "sports");
    expect(await $$(".training-sport-list > li")).toHaveLength(2);
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3")).toHaveText(
      "Trail running",
    );
    await expect($(".training-sport-list > li[data-state='unavailable'] h3")).toHaveText(
      "Sport not recorded",
    );
    await expect($(".training-sport-list > li[data-state='personally-overridden']")).toHaveText(
      expect.stringContaining("Named by you"),
    );
    await openTrainingWorkspace(english, "sessions");
    await expectTrainingRows([
      [enJan5Card, "30 min"],
      [enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"],
    ]);
    await expectTrainingSummary([
      ["2 sessions", "Sessions"],
      ["2 training days", "Training days"],
      ["1 h 30 min", "Total duration"],
      ["10,000 m", "Recorded distance · 1 of 2"],
      ["600 kcal", "Recorded energy · 1 of 2"],
      ["1 of 2", "Sessions with heart rate"],
    ]);
    await captureR10WorkspaceEvidence(
      "r10-training-workspace-en-wide.png",
      ".training-insights",
    );
    const trainingSessionSports = await $$(".training-session-results .training-session-sport");
    expect(trainingSessionSports).toHaveLength(2);
    await expect(trainingSessionSports[1]).toHaveText("Trail running");
    await openDisclosure(".training-session-refinements");
    const trainingTextFilter = await $(".training-session-text-filter input");
    await trainingTextFilter.waitForEnabled({ timeout: 10_000 });
    await trainingTextFilter.setValue("trail");
    const trainingFilterGroups = await $$(".training-session-filter-options");
    expect(trainingFilterGroups).toHaveLength(2);
    const sportCheckbox = await trainingFilterGroups[0].$("input[type='checkbox']");
    await sportCheckbox.click();
    await expect(sportCheckbox).toBeChecked();
    const measurementCheckboxes = await trainingFilterGroups[1].$$("input[type='checkbox']");
    expect(measurementCheckboxes).toHaveLength(3);
    for (const checkbox of measurementCheckboxes) {
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    }
    await selectTrainingSort("distance-desc");
    await $(".training-session-search button[type='submit']").click();
    await expectTrainingRows([[enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"]]);
    const appliedTrainingQuery = await $(".training-session-applied-query");
    await expect(appliedTrainingQuery).toHaveText(expect.stringContaining("Sport: Trail running"));
    await expect(appliedTrainingQuery).toHaveText(expect.stringContaining(
      "Recorded measurement: Heart rate",
    ));
    await expect(appliedTrainingQuery).toHaveText(expect.stringContaining("Order: Farthest first"));
    await $('button[aria-label="Remove Sport: Trail running"]').click();
    await expect(appliedTrainingQuery).not.toHaveText(expect.stringContaining("Sport: Trail running"));
    await expectTrainingRows([[enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"]]);
    await $(".training-session-applied-query > header button.secondary").click();
    await expectTrainingRows([
      [enJan5Card, "30 min"],
      [enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"],
    ]);
    const comparisonCheckboxes = await $$(
      ".training-session-result-actions input[type='checkbox']",
    );
    expect(comparisonCheckboxes).toHaveLength(2);
    await comparisonCheckboxes[0].click();
    await comparisonCheckboxes[1].click();
    await expect($(".training-session-comparison")).toHaveText(
      expect.stringContaining("2 sessions selected"),
    );
    expect(await $$(".training-session-comparison tbody tr")).toHaveLength(4);
    await $(".training-session-comparison button.secondary").click();
    expect(await $$(".training-session-comparison")).toHaveLength(0);

    await $("aria/Calendar").click();
    await expect($(".training-calendar h3")).toHaveText("January 2026");
    await $('button[aria-label*="January 4, 2026"]').click();
    await expectTrainingRows([[enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"]]);
    await $(".training-session-results button.secondary").click();
    await expect($("#training-session-detail-heading")).toHaveText("Session summary");
    const routeWorkbench = await $(".training-route-workbench");
    await routeWorkbench.waitForDisplayed({ timeout: 10_000 });
    await routeWorkbench.$(".fitfreed-route-track").waitForDisplayed({ timeout: 10_000 });
    await expectRevealOutsideApplicationNavigation(".training-route-workbench");
    await expectRevealOutsideApplicationNavigation(".training-route-map-frame");
    const routeWorkbenchLayout = await browser.execute(() => {
      const workbench = document.querySelector(".training-route-workbench").getBoundingClientRect();
      const rangeLayout = document.querySelector(
        ".training-route-range-layout",
      ).getBoundingClientRect();
      const map = document.querySelector(".training-route-map-frame").getBoundingClientRect();
      const rangeInspector = document.querySelector(
        ".training-route-range-inspector",
      ).getBoundingClientRect();
      return {
        directionTransforms: [...document.querySelectorAll(
          ".fitfreed-route-direction span",
        )].map((direction) => getComputedStyle(direction).transform),
        mapBackgroundImage: getComputedStyle(
          document.querySelector(".training-route-map"),
        ).backgroundImage,
        mapHeight: map.height,
        mapRight: map.right,
        mapWidth: map.width,
        rangeInspectorLeft: rangeInspector.left,
        rangeInspectorWidth: rangeInspector.width,
        rangeLayoutWidth: rangeLayout.width,
        viewportHeight: document.documentElement.clientHeight,
        workbenchWidth: workbench.width,
      };
    });
    expect(routeWorkbenchLayout.mapWidth / routeWorkbenchLayout.rangeLayoutWidth)
      .toBeGreaterThan(0.7);
    expect(routeWorkbenchLayout.mapWidth / routeWorkbenchLayout.rangeLayoutWidth)
      .toBeLessThan(0.78);
    expect(routeWorkbenchLayout.rangeInspectorLeft)
      .toBeGreaterThan(routeWorkbenchLayout.mapRight);
    expect(routeWorkbenchLayout.rangeInspectorWidth / routeWorkbenchLayout.rangeLayoutWidth)
      .toBeGreaterThan(0.2);
    expect(routeWorkbenchLayout.mapWidth / routeWorkbenchLayout.workbenchWidth)
      .toBeGreaterThan(0.65);
    expect(routeWorkbenchLayout.mapHeight / routeWorkbenchLayout.viewportHeight)
      .toBeGreaterThan(0.38);
    expect(routeWorkbenchLayout.mapHeight / routeWorkbenchLayout.viewportHeight)
      .toBeLessThan(0.68);
    expect(routeWorkbenchLayout.mapBackgroundImage).toContain("linear-gradient");
    expect(routeWorkbenchLayout.directionTransforms).toHaveLength(4);
    expect(routeWorkbenchLayout.directionTransforms.every(
      (transform) => transform !== "none" && transform !== "matrix(1, 0, 0, 1, 0, 0)",
    )).toBe(true);
    expect(await routeWorkbench.$$(".leaflet-tile, img")).toHaveLength(0);
    expect(await routeWorkbench.$$(".fitfreed-route-direction")).toHaveLength(4);
    expect(await routeWorkbench.$$(".fitfreed-route-start")).toHaveLength(1);
    expect(await routeWorkbench.$$(".fitfreed-route-finish")).toHaveLength(1);
    expect(await routeWorkbench.$$(".training-route-signal-lanes")).toHaveLength(0);
    expect(await routeWorkbench.$$(".training-route-overlay-legend")).toHaveLength(0);
    await expect(routeWorkbench).toHaveText(expect.stringContaining("Point 1 of 5"));

    const rangeCopy = english.training.sessionLibrary.ranges;
    await openTrainingDetailSection(english, "ranges");
    const initialPersonalRanges = await $(".training-ranges");
    await expect(initialPersonalRanges.$("h3")).toHaveText(rangeCopy.heading);
    await expect(initialPersonalRanges).toHaveText(expect.stringContaining(rangeCopy.empty));
    await initialPersonalRanges.$(`aria/${rangeCopy.create}`).click();
    await initialPersonalRanges.$(`aria/${rangeCopy.cancel}`).click();
    await expect(initialPersonalRanges).toHaveText(expect.stringContaining(rangeCopy.empty));

    const routeRangeCopy = english.training.sessionLibrary.routeWorkbench;
    await routeWorkbench.$(`aria/${routeRangeCopy.createRangeHere}`).click();
    const routeRangeEditor = await routeWorkbench.$(".training-range-editor");
    await routeRangeEditor.$(".training-range-editor-name input").setValue("Ridge middle");
    const routeRangeHandles = await routeWorkbench.$$(
      ".training-route-range-handles input[type='range']",
    );
    expect(routeRangeHandles).toHaveLength(2);
    await browser.execute((start, end) => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      setValue.call(start, "1");
      start.dispatchEvent(new Event("input", { bubbles: true }));
      start.dispatchEvent(new Event("change", { bubbles: true }));
      setValue.call(end, "3");
      end.dispatchEvent(new Event("input", { bubbles: true }));
      end.dispatchEvent(new Event("change", { bubbles: true }));
    }, routeRangeHandles[0], routeRangeHandles[1]);
    await expect(routeRangeHandles[0]).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Point 2 of 5"),
    );
    await expect(routeRangeHandles[1]).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Point 4 of 5"),
    );
    await browser.execute((end) => end.focus(), routeRangeHandles[1]);
    await browser.keys([Key.ArrowLeft]);
    await expect(routeRangeHandles[1]).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Point 3 of 5"),
    );
    const movedRouteRangeHandles = await routeWorkbench.$$(
      ".training-route-range-handles input[type='range']",
    );
    await browser.execute((end) => end.focus(), movedRouteRangeHandles[1]);
    await browser.keys([Key.ArrowRight]);
    await expect(movedRouteRangeHandles[1]).toHaveAttribute(
      "aria-valuetext",
      expect.stringContaining("Point 4 of 5"),
    );
    const routeRangeEditorAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-route-workbench")
      .analyze();
    expect(routeRangeEditorAccessibility.violations).toEqual([]);
    await browser.execute(() => {
      document.querySelector(".training-route-range-inspector").scrollTop = 0;
    });
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-route-range-editor-en-wide.png",
    ));
    await browser.execute(() => {
      const inspector = document.querySelector(".training-route-range-inspector");
      inspector.scrollTop = inspector.scrollHeight;
    });
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-route-range-editor-actions-en-wide.png",
    ));
    await routeRangeEditor.$(`aria/${rangeCopy.save}`).click();
    await waitForNotice(rangeCopy.saved);
    await expect(routeWorkbench.$(".training-route-saved-range strong")).toHaveText(
      "Ridge middle",
    );
    expect(await routeWorkbench.$$(".fitfreed-route-range-start")).toHaveLength(1);
    expect(await routeWorkbench.$$(".fitfreed-route-range-end")).toHaveLength(1);
    const routeRangeAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-route-workbench")
      .analyze();
    expect(routeRangeAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-route-range-en-wide.png",
    ));

    const routePosition = await routeWorkbench.$('input[type="range"]');
    await expect(routePosition).toHaveAttribute("max", "4");
    await routePosition.addValue(Key.ArrowRight);
    const keyboardPointIndex = Number(await routePosition.getValue());
    expect(keyboardPointIndex).toBeGreaterThan(0);
    expect(keyboardPointIndex).toBeLessThanOrEqual(4);
    await expect(routeWorkbench).toHaveText(expect.stringContaining(
      `Point ${keyboardPointIndex + 1} of 5`,
    ));
    await browser.execute(() => {
      const path = document.querySelector(".training-route-workbench .fitfreed-route-track");
      const point = path.getPointAtLength(path.getTotalLength());
      const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
      path.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        clientX: screenPoint.x,
        clientY: screenPoint.y,
      }));
    });
    await expect(routeWorkbench).toHaveText(expect.stringContaining("Point 5 of 5"));
    const routeMap = await routeWorkbench.$(".training-route-map");
    const routeBeforeKeyboardPan = await browser.execute(
      () => document.querySelector(".training-route-workbench .fitfreed-route-track")
        .getBoundingClientRect().x,
    );
    await routeMap.click();
    await expect(routeMap).toBeFocused();
    await browser.keys([Key.ArrowRight]);
    await browser.waitUntil(
      async () => await browser.execute(
        () => document.querySelector(".training-route-workbench .fitfreed-route-track")
          .getBoundingClientRect().x,
      ) !== routeBeforeKeyboardPan,
      { timeout: 10_000, timeoutMsg: "the focused local route did not respond to keyboard pan" },
    );
    await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.completeTrack}`,
    ).click();
    const routeSelectors = await routeWorkbench.$$(".training-route-workbench-controls select");
    expect(routeSelectors).toHaveLength(2);
    const trackDisplay = routeSelectors[1];
    const trackDisplayOptions = await trackDisplay.$$("option");
    expect(trackDisplayOptions).toHaveLength(1);
    await expect(trackDisplayOptions[0]).toHaveText(
      english.training.sessionLibrary.routeWorkbench.recordedTrack,
    );
    const routePathBeforeZoom = await routeWorkbench.$(".fitfreed-route-track").getAttribute("d");
    await routeWorkbench.$(`aria/${english.training.sessionLibrary.routeWorkbench.zoomIn}`).click();
    await browser.waitUntil(
      async () => await routeWorkbench.$(".fitfreed-route-track").getAttribute("d")
        !== routePathBeforeZoom,
      { timeout: 10_000, timeoutMsg: "the local route did not respond to zoom" },
    );
    await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.completeTrack}`,
    ).click();
    const routeZoomStatus = await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.mapZoomLabel}`,
    );
    const routeZoomIn = await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.zoomIn}`,
    );
    const routeZoomOut = await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.zoomOut}`,
    );
    await expect(routeZoomStatus).toHaveText(expect.stringMatching(/^Map zoom \d+ of \d+$/));
    for (let step = 0; step < 24 && await routeZoomOut.isEnabled(); step += 1) {
      const previousStatus = await routeZoomStatus.getText();
      await routeZoomOut.click();
      await browser.waitUntil(
        async () => await routeZoomStatus.getText() !== previousStatus,
        { timeout: 10_000, timeoutMsg: "the route-relative zoom level did not decrease" },
      );
    }
    await expect(routeZoomOut).toBeDisabled();
    const minimumZoomStatus = await routeZoomStatus.getText();
    const minimumRouteExtent = await browser.execute(() => {
      const map = document.querySelector(".training-route-workbench .training-route-map");
      const route = document.querySelector(".training-route-workbench .fitfreed-route-track");
      const mapBox = map.getBoundingClientRect();
      const routeBox = route.getBoundingClientRect();
      return Math.max(routeBox.width / mapBox.width, routeBox.height / mapBox.height);
    });
    expect(minimumRouteExtent).toBeGreaterThan(0.08);
    await routeMap.click();
    await browser.keys(["-"]);
    await expect(routeZoomStatus).toHaveText(minimumZoomStatus);

    await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.completeTrack}`,
    ).click();
    for (let step = 0; step < 24 && await routeZoomIn.isEnabled(); step += 1) {
      const previousStatus = await routeZoomStatus.getText();
      await routeZoomIn.click();
      await browser.waitUntil(
        async () => await routeZoomStatus.getText() !== previousStatus,
        { timeout: 10_000, timeoutMsg: "the bounded route zoom level did not increase" },
      );
    }
    await expect(routeZoomIn).toBeDisabled();
    const maximumZoomStatus = await routeZoomStatus.getText();
    await routeMap.click();
    await browser.keys(["+"]);
    await expect(routeZoomStatus).toHaveText(maximumZoomStatus);
    await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.completeTrack}`,
    ).click();
    const focusMap = await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.focusMap}`,
    );
    await focusMap.click();
    await expect(routeWorkbench).toHaveAttribute("data-focused", "true");
    await expect(routeWorkbench).toHaveAttribute("role", "dialog");
    await expect(routeWorkbench).toHaveAttribute("aria-modal", "true");
    expect(await browser.execute(
      () => document.querySelector(".app-sidebar").hasAttribute("inert"),
    )).toBe(true);
    await expect(routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.returnToSession}`,
    )).toBeFocused();
    await browser.keys([Key.Escape]);
    await expect(routeWorkbench).toHaveAttribute("data-focused", "false");
    await expect(routeWorkbench).toHaveAttribute("role", "region");
    expect(await browser.execute(
      () => document.querySelector(".app-sidebar").hasAttribute("inert"),
    )).toBe(false);
    await expect(focusMap).toBeFocused();
    const visibleRoute = routeSelectors[0];
    await selectNativeOption(visibleRoute, "0:transition");
    await expect(routeWorkbench).toHaveText(expect.stringContaining("Point 1 of 2"));
    expect(await routeWorkbench.$$(".fitfreed-route-range-start, .fitfreed-route-range-end"))
      .toHaveLength(0);
    await selectNativeOption(visibleRoute, "0:primary");
    await expect(routeWorkbench).toHaveText(expect.stringContaining("Point 1 of 5"));
    await browser.waitUntil(
      async () => (await routeWorkbench.$$(
        ".fitfreed-route-range-start, .fitfreed-route-range-end",
      )).length === 2,
      { timeout: 10_000, timeoutMsg: "saved route-range markers were not restored" },
    );
    await browser.execute(() => {
      const position = document.querySelector(
        ".training-route-position-control input[type='range']",
      );
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setValue.call(position, "4");
      position.dispatchEvent(new Event("input", { bubbles: true }));
      position.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(routeWorkbench).toHaveText(expect.stringContaining("Point 5 of 5"));
    await routeWorkbench.$(
      `aria/${english.training.sessionLibrary.routeWorkbench.exactRoute}`,
    ).click();
    await browser.waitUntil(
      async () => (await $(".training-route:first-of-type").$$(
        ".training-route-exact tbody tr",
      )).length === 5,
      { timeout: 10_000, timeoutMsg: "workbench exact route evidence was not displayed" },
    );
    const selectedRouteRow = await $(
      ".training-route:first-of-type .training-route-exact .training-exact-selected-row",
    );
    await expect(selectedRouteRow).toBeFocused();
    await expect(selectedRouteRow).toHaveAttribute("aria-current", "true");
    await expect(selectedRouteRow).toHaveText(expect.stringContaining("5"));
    await expect($(".training-detail-navigation button[aria-current='page']"))
      .toHaveText(english.training.sessionLibrary.detailSections.routes);
    const exactRoutePicker = await $(
      ".training-route:first-of-type .training-route-exact .training-range-evidence-picker",
    );
    await exactRoutePicker.$(`aria/${rangeCopy.createFromEvidence}`).click();
    const exactRouteEditor = await $(
      ".training-range-evidence-editor .training-range-editor",
    );
    await expect(exactRouteEditor.$("h4")).toBeFocused();
    const exactRouteBoundaries = await exactRouteEditor.$$(
      ".training-range-editor-boundaries input",
    );
    await expect(exactRouteBoundaries[0]).toHaveValue("0:45:00");
    await expect(exactRouteBoundaries[1]).toHaveValue("1:00:00");
    expect(await exactRouteEditor.$$(`select[aria-label="${rangeCopy.timeline}"]`))
      .toHaveLength(0);
    await expectRevealOutsideApplicationNavigation(".training-range-evidence-editor h4");
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-exact-route-range-editor-en-wide.png",
    ));
    await exactRouteEditor.$(`aria/${rangeCopy.cancel}`).click();
    await $(".training-route:first-of-type button").click();
    await openTrainingDetailSection(english, "structure");
    await expect($("#training-structure-heading")).toHaveText(
      english.training.sessionLibrary.structureHeading,
    );
    const recordedExercises = await $$("#training-detail-structure > .training-exercise");
    expect(recordedExercises).toHaveLength(1);
    await expect(recordedExercises[0].$(".training-exercise-heading")).toHaveText("Exercise 1");
    const recordedCollections = await recordedExercises[0].$$(
      ".training-structure-collection",
    );
    expect(recordedCollections).toHaveLength(3);
    await expect(recordedCollections[0].$("h5")).toHaveText("Source laps");
    const sourceLapCells = await recordedCollections[0].$$("tbody tr:first-child th, tbody tr:first-child td");
    expect(sourceLapCells).toHaveLength(4);
    await expect(sourceLapCells[1]).toHaveText("30 min");
    await expect(sourceLapCells[2]).toHaveText("30 min");
    await expect(sourceLapCells[3]).toHaveText("5,000 m");
    await expect(recordedCollections[1].$("p")).toHaveText(
      english.training.sessionLibrary.structureProvidedEmpty,
    );
    expect(await recordedCollections[2].$$("tbody tr")).toHaveLength(1);
    await openTrainingDetailSection(english, "routes");
    await browser.waitUntil(async () => (await $$(".training-route")).length === 2, {
      timeout: 10_000,
      timeoutMsg: "recorded primary and transition routes were not displayed",
    });
    const recordedRoutes = await $$(".training-route");
    await expect(recordedRoutes[0].$("h6")).toHaveText(
      english.training.sessionLibrary.primaryRoute,
    );
    await expect(recordedRoutes[1].$("h6")).toHaveText(
      english.training.sessionLibrary.transitionRoute,
    );
    await expect(recordedRoutes[0].$("svg")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("5 recorded points"),
    );
    await expect(recordedRoutes[0].$(".training-route-privacy")).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.routePrivacy),
    );
    const exactRouteToggle = await recordedRoutes[0].$("button");
    await exactRouteToggle.click();
    await browser.waitUntil(
      async () => (await recordedRoutes[0].$$(".training-route-exact tbody tr")).length === 5,
      { timeout: 10_000, timeoutMsg: "exact recorded route points were not displayed" },
    );
    const exactRouteRows = await recordedRoutes[0].$$(".training-route-exact tbody tr");
    await expect(exactRouteRows[0]).toHaveText(expect.stringContaining("40"));
    await expect(exactRouteRows[4]).toHaveText(expect.stringContaining("40.04"));
    await exactRouteToggle.click();
    expect(await recordedRoutes[0].$$(".training-route-exact")).toHaveLength(0);
    await openTrainingDetailSection(english, "signals");
    await browser.waitUntil(async () => (await $$(".training-signal")).length === 3, {
      timeout: 10_000,
      timeoutMsg: "recorded exercise and transition signals were not displayed",
    });
    await expect($(".training-exercise-signals > h5")).toHaveText(
      english.training.sessionLibrary.signalHeading,
    );
    const recordedSignals = await $$(".training-signal");
    await expect(recordedSignals[0].$(".training-signal-heading h6")).toHaveText("Heart rate");
    const primarySignalChart = await recordedSignals[0].$(".analytical-chart-canvas");
    await expect(primarySignalChart).toHaveAttribute(
      "aria-label",
      expect.stringContaining("100 recorded values out of 101 samples"),
    );
    await expect(primarySignalChart).toHaveAttribute(
      "aria-label",
      expect.stringContaining("Gaps show missing source values"),
    );
    await expect(recordedSignals[0]).toHaveText(expect.stringContaining("100 of 101"));
    const crossSignal = await $(".training-cross-signal");
    await expect(crossSignal.$("h6")).toHaveText(
      english.training.sessionLibrary.crossSignalHeading,
    );
    await expect(crossSignal).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.crossSignalPrimaryIntro),
    );
    const crossSignalChoices = await crossSignal.$$('input[type="checkbox"]');
    expect(crossSignalChoices).toHaveLength(2);
    await expect(crossSignal.$(".analytical-chart-canvas")).toHaveAttribute(
      "aria-label",
      english.training.sessionLibrary.crossSignalHeading,
    );
    const crossSignalLanes = await crossSignal.$$(".training-cross-signal-lanes article");
    expect(crossSignalLanes).toHaveLength(2);
    await expect(crossSignalLanes[0]).toHaveText(expect.stringContaining("100 of 101 recorded"));
    await expect(crossSignal).toHaveText(expect.stringContaining("Elapsed time 0–1 h"));
    for (const choice of crossSignalChoices) {
      await expect(choice).toBeChecked();
      await expect(choice).toBeDisabled();
    }
    const speedSeries = english.training.sessionLibrary.crossSignalSeries
      .replace("{kind}", english.training.sessionLibrary.signalKinds.speed)
      .replace("{number}", "2");
    const exactSpeed = english.training.sessionLibrary.crossSignalExact
      .replace("{series}", speedSeries);
    await crossSignal.$(`aria/${exactSpeed}`).click();
    await browser.waitUntil(
      async () => (await recordedSignals[1].$$(".training-signal-exact tbody tr")).length === 5,
      { timeout: 10_000, timeoutMsg: "cross-signal exact evidence was not displayed" },
    );
    await expect(recordedSignals[1].$(".training-signal-exact")).toHaveText(
      expect.stringContaining("8.5 km/h"),
    );
    await recordedSignals[1].$("button").click();
    expect(await recordedSignals[1].$$(".training-signal-exact")).toHaveLength(0);
    const signalCompatibility = await $(
      ".training-signal-collection .training-compatibility-details",
    );
    const unsupportedSignal = await signalCompatibility.$(".training-signal-unsupported");
    expect(await signalCompatibility.getAttribute("open")).toBeNull();
    expect(await unsupportedSignal.isDisplayed()).toBe(false);
    await signalCompatibility.$("summary").click();
    await expect(unsupportedSignal).toBeDisplayed();
    await expect(unsupportedSignal).toHaveText(
      expect.stringContaining("1 recorded signal series is not shown in this view"),
    );
    const exactSignalToggle = await recordedSignals[0].$("button");
    await exactSignalToggle.click();
    await browser.waitUntil(
      async () => (await recordedSignals[0].$$(".training-signal-exact tbody tr")).length === 100,
      { timeout: 10_000, timeoutMsg: "exact recorded signal samples were not displayed" },
    );
    await expect(recordedSignals[0].$(".training-signal-exact")).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.metricUnavailable),
    );
    await recordedSignals[0].$(`aria/${english.training.sessionLibrary.nextSignalSamples}`).click();
    await expect(recordedSignals[0].$(".training-signal-exact")).toHaveText(
      expect.stringContaining("Sample 101 of 101"),
    );
    await recordedSignals[0].$(`aria/${english.training.sessionLibrary.previousSignalSamples}`).click();
    await expect(recordedSignals[0].$(".training-signal-exact")).toHaveText(
      expect.stringContaining("Samples 1–100 of 101"),
    );
    await exactSignalToggle.click();
    expect(await recordedSignals[0].$$(".training-signal-exact")).toHaveLength(0);
    await browser.waitUntil(async () => (await $$(".training-zone-group")).length === 3, {
      timeout: 10_000,
      timeoutMsg: "recorded heart-rate, speed, and power zones were not displayed",
    });
    await expect($(".training-exercise-zones > h5")).toHaveText(
      english.training.sessionLibrary.zoneHeading,
    );
    const recordedZoneGroups = await $$(".training-zone-group");
    await expect(recordedZoneGroups[0].$("h6")).toHaveText("Heart rate · group 1");
    await expect(recordedZoneGroups[0].$(".training-zone-distribution")).toHaveAttribute(
      "aria-label",
      "Heart rate distribution with recorded time for 1 of 2 zones.",
    );
    const heartRateZoneRows = await recordedZoneGroups[0].$$("tbody tr");
    expect(heartRateZoneRows).toHaveLength(2);
    await expect(heartRateZoneRows[0]).toHaveText(expect.stringContaining("120–139 bpm"));
    await expect(heartRateZoneRows[0]).toHaveText(expect.stringContaining("15 min"));
    await expect(heartRateZoneRows[1]).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.zoneNotRecorded),
    );
    await expect(recordedZoneGroups[1]).toHaveText(expect.stringContaining("2,500.5 m"));
    await expect(recordedZoneGroups[2]).toHaveText(expect.stringContaining("42.5"));
    const zoneCompatibility = await $(
      ".training-exercise-zones > .training-compatibility-details",
    );
    const unsupportedZoneGroup = await zoneCompatibility.$(".training-zone-unsupported");
    expect(await zoneCompatibility.getAttribute("open")).toBeNull();
    expect(await unsupportedZoneGroup.isDisplayed()).toBe(false);
    await zoneCompatibility.$("summary").click();
    await expect(unsupportedZoneGroup).toBeDisplayed();
    await expect(unsupportedZoneGroup).toHaveText(
      expect.stringContaining("1 recorded zone group is not shown in this view"),
    );
    await expect($(".training-exercise-zones")).not.toHaveText(
      expect.stringContaining("ZONE_TYPE_"),
    );
    expect(await $$(".training-provenance")).toHaveLength(0);
    await openTrainingDetailSection(english, "provenance");
    await $('button[aria-controls="training-session-provenance"]').click();
    await browser.waitUntil(
      async () => (await $$(".training-provenance tbody tr")).length === 1,
      { timeout: 10_000, timeoutMsg: "session provenance was not displayed on demand" },
    );
    const provenance = await $(".training-provenance");
    await expect(provenance.$("h4")).toHaveText(
      english.training.sessionLibrary.provenanceHeading,
    );
    await expect(provenance).toHaveText(expect.stringContaining("Polar Flow"));
    await expect(provenance).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.provenanceDecisions.create),
    );
    await expect(provenance).toHaveText(expect.stringContaining("polar-flow-archive@14"));
    await expect(provenance).toHaveText(
      expect.stringContaining("polar-flow-training-session@6"),
    );
    await expect(provenance).not.toHaveText(expect.stringContaining("training-session_"));
    await $('button[aria-controls="training-session-provenance"]').click();
    expect(await $$(".training-provenance")).toHaveLength(0);

    await openTrainingDetailSection(english, "ranges");
    const personalRanges = await $(".training-ranges");
    await expect(personalRanges.$("h3")).toHaveText(rangeCopy.heading);
    const firstRangeInspector = await personalRanges.$(".training-range-inspector");
    await expect(firstRangeInspector.$("h4")).toHaveText("Ridge middle");
    await firstRangeInspector.$(".training-range-result-summary").waitForDisplayed({
      timeout: 10_000,
    });
    await expect(firstRangeInspector.$(".training-range-result-summary"))
      .toHaveText(expect.stringContaining("30 min"));
    await expectPersonalRangeGeometry(false);

    await personalRanges.$(`aria/${rangeCopy.create}`).click();
    await personalRanges.$(`aria/${rangeCopy.cancel}`).click();
    await expect(firstRangeInspector.$("h4")).toHaveText("Ridge middle");

    await personalRanges.$(`aria/${rangeCopy.create}`).click();
    const firstRangeEditor = await personalRanges.$(".training-range-editor");
    const firstTimeline = await firstRangeEditor.$(
      `select[aria-label="${rangeCopy.timeline}"]`,
    );
    await selectNativeOptionByText(firstTimeline, rangeCopy.primaryRouteTimeline);
    const firstRangeName = await firstRangeEditor.$(".training-range-editor-name input");
    const firstRangeBoundaries = await firstRangeEditor.$$('input[inputmode="decimal"]');
    expect(firstRangeBoundaries).toHaveLength(2);
    await firstRangeName.setValue("Ridge middle");
    await firstRangeBoundaries[0].setValue("0:15:00");
    await firstRangeBoundaries[1].setValue("0:15:00");
    await expect(firstRangeEditor.$(`aria/${rangeCopy.save}`)).toBeDisabled();
    await expect(firstRangeEditor.$('[role="alert"]')).toHaveText(rangeCopy.editorInvalid);
    const invalidRangeAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-ranges")
      .analyze();
    expect(invalidRangeAccessibility.violations).toEqual([]);
    await firstRangeEditor.$(`aria/${rangeCopy.cancel}`).click();
    await expect(firstRangeInspector.$("h4")).toHaveText("Ridge middle");
    await firstRangeInspector.$(".training-range-evidence-details summary").click();
    await expect(firstRangeInspector).toHaveText(
      expect.stringContaining(rangeCopy.coverageHeading),
    );
    await browser.execute(() => {
      document.querySelector(".training-ranges").scrollIntoView({
        block: "start",
        inline: "nearest",
      });
    });
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-personal-ranges-en-wide.png",
    ));
    const rangeResultAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-ranges")
      .analyze();
    expect(rangeResultAccessibility.violations).toEqual([]);

    await firstRangeInspector.$(`aria/${rangeCopy.rename}`).click();
    const renamedRange = await firstRangeInspector.$(".training-range-editor-name input");
    await renamedRange.setValue("Ridge effort");
    await firstRangeInspector.$(`aria/${rangeCopy.saveName}`).click();
    await waitForNotice(rangeCopy.nameSaved);
    await expect(firstRangeInspector.$("h4")).toHaveText("Ridge effort");
    await firstRangeInspector.$(`aria/${rangeCopy.adjust}`).click();
    const adjustedBoundaries = await firstRangeInspector.$$('input[inputmode="decimal"]');
    expect(adjustedBoundaries).toHaveLength(2);
    await adjustedBoundaries[0].setValue("0:15:00");
    await adjustedBoundaries[1].setValue("0:30:00");
    await firstRangeInspector.$(`aria/${rangeCopy.saveBoundaries}`).click();
    await waitForNotice(rangeCopy.boundariesSaved);
    await expect(firstRangeInspector).toHaveText(expect.stringContaining("15 min"));

    await personalRanges.$(`aria/${rangeCopy.create}`).click();
    const temporaryRangeEditor = await personalRanges.$(".training-range-editor");
    await temporaryRangeEditor.$(".training-range-editor-name input").setValue("Temporary marker");
    await temporaryRangeEditor.$(`aria/${rangeCopy.save}`).click();
    await waitForNotice(rangeCopy.saved);
    await expect(personalRanges.$(".training-range-inspector h4"))
      .toHaveText("Temporary marker");
    await personalRanges.$(`aria/${rangeCopy.remove}`).click();
    const removeConfirmation = await personalRanges.$(".training-range-remove-confirmation");
    await removeConfirmation.$(`aria/${rangeCopy.keep}`).click();
    expect(await personalRanges.$$(".training-range-remove-confirmation")).toHaveLength(0);
    await personalRanges.$(`aria/${rangeCopy.remove}`).click();
    await personalRanges.$(`aria/${rangeCopy.removeRange}`).click();
    await waitForNotice(rangeCopy.removed);
    await expect(personalRanges.$(".training-range-inspector h4")).toHaveText("Ridge effort");
    expect(await personalRanges.$$(".training-range-workspace > nav li")).toHaveLength(1);

    await openTrainingDetailSection(english, "structure");
    const segmentation = await $(".training-segmentation");
    await expect(segmentation.$("h4")).toHaveText(
      english.training.sessionLibrary.segmentHeading,
    );
    await segmentation.$(`aria/${english.training.sessionLibrary.segmentCreate}`).click();
    const segmentTitle = await segmentation.$('input[maxlength="80"]');
    await segmentTitle.setValue("Quarter-hour blocks");
    const segmentMinutes = await segmentation.$('input[type="number"]');
    await segmentMinutes.setValue("15");
    await segmentation.$(`aria/${english.training.sessionLibrary.segmentSave}`).click();
    await browser.waitUntil(
      async () => (await segmentation.$$(".training-segment-criterion")).length === 1,
      { timeout: 10_000, timeoutMsg: "the elapsed-time criterion was not persisted" },
    );
    const elapsedCriterion = await segmentation.$(".training-segment-criterion");
    await expect(elapsedCriterion.$("h6")).toHaveText("Quarter-hour blocks");
    await expect(elapsedCriterion).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.segmentAuthoredByYou),
    );
    await expect(elapsedCriterion).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.segmentCalculatedByFitFreed),
    );
    await expect(elapsedCriterion).toHaveText(expect.stringContaining("Evaluation v1"));
    expect(await elapsedCriterion.$$("tbody tr")).toHaveLength(4);

    await segmentation.$(`aria/${english.training.sessionLibrary.segmentCreate}`).click();
    await segmentation.$('input[maxlength="80"]').setValue("Race plan");
    await browser.execute((value) => {
      const select = document.querySelector(".training-segment-editor select");
      const setValue = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      ).set;
      setValue.call(select, value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, "manual-boundaries");
    await expect(segmentation.$(".training-segment-editor select"))
      .toHaveValue("manual-boundaries");
    const manualBoundaries = await segmentation.$('input[aria-describedby="training-segment-manual-help"]');
    await manualBoundaries.waitForDisplayed({ timeout: 10_000 });
    await manualBoundaries.setValue("30, 20");
    await expect(segmentation.$(`aria/${english.training.sessionLibrary.segmentSave}`)).toBeDisabled();
    await expect(segmentation.$('[role="alert"]')).toHaveText(
      english.training.sessionLibrary.segmentInvalid,
    );
    await manualBoundaries.setValue("20, 40");
    await segmentation.$(`aria/${english.training.sessionLibrary.segmentSave}`).click();
    await browser.waitUntil(
      async () => (await segmentation.$$(".training-segment-criterion")).length === 2,
      { timeout: 10_000, timeoutMsg: "the manual criterion was not persisted" },
    );
    const authoredCriteria = await segmentation.$$(".training-segment-criterion");
    expect(await authoredCriteria[1].$$("tbody tr")).toHaveLength(3);
    await authoredCriteria[1]
      .$(`aria/${english.training.sessionLibrary.segmentMoveEarlier}`)
      .click();
    await browser.waitUntil(
      async () => await (await segmentation.$$(".training-segment-criterion h6"))[0].getText()
        === "Race plan",
      { timeout: 10_000, timeoutMsg: "the criterion order was not updated" },
    );
    const createSessionReport = await $(`aria/${english.training.sessionLibrary.createReport}`);
    await createSessionReport.click();
    await expect($(".reports-hero h1")).toHaveText(english.reports.heading);
    const cancelNewComposition = await $(`aria/${english.reports.cancelComposition}`);
    await cancelNewComposition.click();
    await expect($("#training-session-detail-heading")).toHaveText("Session summary");
    await expectElementFocus(
      createSessionReport,
      "cancelling a contextual report did not restore its exact source action",
    );
    expect(await $$(".report-editor")).toHaveLength(0);
    await createSessionReport.click();
    await expect($(".reports-hero h1")).toHaveText(english.reports.heading);
    const reportTitle = await $('.report-editor input[maxlength="120"]');
    await reportTitle.clearValue();
    await reportTitle.setValue("Synthetic ridge progression");
    await $(`aria/${english.reports.commentary.add}`).click();
    await $('.report-editor textarea').setValue(
      "Held the intended effort and finished the final climb with control.",
    );
    const addRoute = await $(".report-route-picker button");
    await addRoute.waitForDisplayed({ timeout: 10_000 });
    await addRoute.click();
    const routeEditor = await $(".report-block-editor .report-route-settings");
    const endpointRedaction = await routeEditor.$('input[type="number"]');
    await expect(endpointRedaction).toHaveValue("200");
    await endpointRedaction.setValue("300");
    const routeBlockEditor = await $(".report-block-editor:has(.report-route-settings)");
    const routeMoveButtons = await routeBlockEditor.$$(".report-block-controls button");
    await routeMoveButtons[0].click();
    await routeMoveButtons[0].click();
    await expect($(".report-block-list > li:first-child .report-route-settings"))
      .toBeDisplayed();
    const analysisKinds = [
      "training-finding",
      "training-comparison",
      "training-chart",
      "training-exact-table",
      "training-coverage",
    ];
    for (const kind of analysisKinds) {
      const label = english.reports.analysis.addBlock.replace(
        "{block}",
        english.reports.analysis.blocks[kind].heading,
      );
      await $(`aria/${label}`).click();
    }
    await expect($(".report-analysis-picker")).toHaveText(
      expect.stringContaining(english.reports.analysis.allAdded),
    );
    const analyticalEditors = await $$(
      ".report-block-editor:has(.report-analysis-block-help)",
    );
    await analyticalEditors.at(-1).$(`aria/${english.reports.analysis.removeBlock}`).click();
    await $(`aria/${english.reports.analysis.addBlock.replace(
      "{block}",
      english.reports.analysis.blocks["training-coverage"].heading,
    )}`).click();
    await setReportComparisonRanges("2026-01-04", "2026-01-04", "2026-01-05", "2026-01-05");
    await setReportAnalysisMetrics("energy", "distance");
    await $('.report-editor button[type="submit"]').click();
    await waitForNotice(english.reports.saved);
    await expect($(".report-preview h3")).toHaveText("Synthetic ridge progression");
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining("Held the intended effort and finished the final climb with control."),
    );
    await expect($(".report-preview")).toHaveText(expect.stringContaining("Trail running"));
    await expect($(".report-sport-identity .sport-family-icon")).toBeDisplayed();
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(english.reports.analysis.blocks["training-finding"].heading),
    );
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(english.reports.analysis.blocks["training-exact-table"].heading),
    );
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(english.reports.analysis.blocks["training-coverage"].heading),
    );
    await expect($(".report-analysis-bars")).toBeDisplayed();
    expect(await $$(".report-analysis-table")).toHaveLength(3);
    const previewHierarchy = await browser.execute(() => {
      const title = document.querySelector(".report-preview-title");
      const primaryEvidence = document.querySelector(".report-preview > article");
      const actions = document.querySelector(".report-preview-actions");
      return {
        titleBeforeEvidence: Boolean(
          title?.compareDocumentPosition(primaryEvidence)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        evidenceBeforeActions: Boolean(
          primaryEvidence?.compareDocumentPosition(actions)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      };
    });
    expect(previewHierarchy).toEqual({
      titleBeforeEvidence: true,
      evidenceBeforeActions: true,
    });
    await browser.execute(() => {
      document.querySelector(".report-preview").scrollIntoView({
        block: "start",
        inline: "nearest",
      });
    });
    const wideReportPreviewGeometry = await browser.execute(() => {
      const root = document.documentElement;
      const preview = document.querySelector(".report-preview").getBoundingClientRect();
      const title = document.querySelector(".report-preview-title").getBoundingClientRect();
      const primaryEvidence = document.querySelector(".report-preview > article")
        .getBoundingClientRect();
      const actions = document.querySelector(".report-preview-actions").getBoundingClientRect();
      return {
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
        titleInsidePreview: title.left >= preview.left && title.right <= preview.right,
        evidenceInsidePreview:
          primaryEvidence.left >= preview.left && primaryEvidence.right <= preview.right,
        titleBeforeEvidence: title.bottom <= primaryEvidence.top,
        evidenceBeforeActions: primaryEvidence.bottom <= actions.top,
        resultBeginsInViewport: primaryEvidence.top < window.innerHeight,
      };
    });
    expect(wideReportPreviewGeometry).toEqual({
      hasHorizontalOverflow: false,
      titleInsidePreview: true,
      evidenceInsidePreview: true,
      titleBeforeEvidence: true,
      evidenceBeforeActions: true,
      resultBeginsInViewport: true,
    });
    const wideReportPreviewAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(wideReportPreviewAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-preview-en-wide.png",
    ));
    const editSavedComposition = await $(`aria/${english.reports.editComposition}`);
    await editSavedComposition.click();
    await reportTitle.clearValue();
    await reportTitle.setValue("Discarded report title");
    const cancelSavedComposition = await $(`aria/${english.reports.cancelComposition}`);
    await cancelSavedComposition.click();
    await expect($(".report-preview h3")).toHaveText("Synthetic ridge progression");
    await expectDocumentFocus(
      "#report-preview-heading",
      "cancelling a saved composition did not focus its restored result",
    );
    await openReportWorkspace(english, "library");
    expect(await $$(".report-list > li")).toHaveLength(1);
    const reportExamples = await $$(".report-example-list > li");
    expect(reportExamples).toHaveLength(4);
    await expect(reportExamples[0]).toHaveText(
      expect.stringContaining(english.reports.examples.items["adjacent-period-volume"].title),
    );
    await expect(reportExamples[1]).toHaveText(
      expect.stringContaining(english.reports.examples.selectionRequired),
    );
    await expect(reportExamples[2]).toHaveText(
      expect.stringContaining(english.reports.examples.selectionRequired),
    );
    await expect(reportExamples[3]).toHaveText(
      expect.stringContaining(english.reports.examples.capabilities["structured-training"]),
    );
    await expect($(".report-examples")).not.toHaveText(expect.stringContaining("Polar Flow"));

    await $(`aria/${english.reports.examples.items["session-visual-story"].action}`).click();
    await $(".training-insights").waitForDisplayed({ timeout: 10_000 });
    await expect($(`aria/${english.training.workspaces.sessions}`))
      .toHaveAttribute("aria-current", "page");
    expect(await $$("#training-session-detail-heading")).toHaveLength(0);
    await goToHome("reports");
    await $(".report-example-list").waitForDisplayed({ timeout: 10_000 });

    const useExample = await $(`aria/${
      english.reports.examples.items["adjacent-period-volume"].action
    }`);
    await useExample.click();
    expect(await $$(".report-block-editor:has(.report-analysis-block-help)"))
      .toHaveLength(3);
    const exampleTitle = await $('.report-editor input[maxlength="120"]');
    await expect(exampleTitle).toHaveValue(
      english.reports.examples.items["adjacent-period-volume"].defaultTitle,
    );
    await $(`aria/${english.reports.cancelComposition}`).click();
    await expectDocumentFocus(
      "#saved-reports-heading",
      "cancelling an example draft did not restore the report library",
    );
    expect(await $$(".report-list > li")).toHaveLength(1);

    await $(`aria/${
      english.reports.examples.items["adjacent-period-volume"].action
    }`).click();
    const savedExampleTitle = await $('.report-editor input[maxlength="120"]');
    await savedExampleTitle.clearValue();
    await savedExampleTitle.setValue("Synthetic reusable comparison");
    await $(`aria/${english.reports.create}`).click();
    await waitForNotice(english.reports.saved);
    await expect($(".report-preview h3")).toHaveText("Synthetic reusable comparison");

    const duplicateAction = await $(".report-preview")
      .$(`aria/${english.reports.duplicate.action}`);
    await duplicateAction.click();
    await expectDocumentFocus(
      "#report-duplicate-heading",
      "opening report duplication did not focus its heading",
    );
    await $(`aria/${english.reports.duplicate.cancel}`).click();
    await expectElementFocus(
      duplicateAction,
      "cancelling report duplication did not restore its source action",
    );
    await duplicateAction.click();
    const duplicateTitle = await $('.report-duplicate-task input[maxlength="120"]');
    await duplicateTitle.clearValue();
    await duplicateTitle.setValue("Synthetic reusable comparison copy");
    await $(`aria/${english.reports.duplicate.submit}`).click();
    await waitForNotice("Synthetic reusable comparison copy was created");
    await expectDocumentFocus(
      "#report-preview-heading",
      "report duplication did not focus its independent result",
    );
    await expect($(".report-preview h3")).toHaveText("Synthetic reusable comparison copy");

    await openReportWorkspace(english, "library");
    expect(await $$(".report-list > li")).toHaveLength(3);
    await $(`aria/${english.reports.library.open.replace(
      "{title}",
      "Synthetic reusable comparison",
    )}`).click();
    await $(`aria/${english.reports.delete.action}`).click();
    await $(".report-delete-review").$(`aria/${english.reports.delete.confirm.replace(
      "{title}",
      "Synthetic reusable comparison",
    )}`).click();
    await expect($(".report-library [role='status']")).toHaveText(
      english.reports.delete.removed.replace(
        "{title}",
        "Synthetic reusable comparison",
      ),
    );
    expect(await $$(".report-list > li")).toHaveLength(2);
    expect(await $$(`aria/${english.reports.library.open.replace(
      "{title}",
      "Synthetic reusable comparison",
    )}`)).toHaveLength(0);
    const independentExampleCopy = await $(`aria/${english.reports.library.open.replace(
      "{title}",
      "Synthetic reusable comparison copy",
    )}`);
    await independentExampleCopy.click();
    await expect($(".report-preview h3")).toHaveText("Synthetic reusable comparison copy");
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(english.reports.analysis.blocks["training-finding"].heading),
    );
    await openReportWorkspace(english, "library");
    await browser.execute(() => {
      document.querySelector(".report-library").scrollIntoView({
        block: "start",
        inline: "nearest",
      });
    });
    const wideReportLibraryGeometry = await browser.execute(() => {
      const root = document.documentElement;
      const library = document.querySelector(".report-library").getBoundingClientRect();
      const examples = document.querySelector(".report-examples").getBoundingClientRect();
      const example = document.querySelector(".report-example-list > li").getBoundingClientRect();
      const savedHeading = document.querySelector("#saved-reports-heading").getBoundingClientRect();
      const list = document.querySelector(".report-list").getBoundingClientRect();
      const card = document.querySelector(".report-list > li").getBoundingClientRect();
      return {
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
        hasExpandedStart: document.querySelector(".report-library-start") !== null,
        examplesBeforeResults: examples.bottom <= savedHeading.top && savedHeading.bottom <= list.top,
        usefulStartBeginsInViewport: example.top >= 0 && example.top < window.innerHeight,
        exampleInsideLibrary: example.left >= library.left && example.right <= library.right,
        cardInsideLibrary: card.left >= library.left && card.right <= library.right,
      };
    });
    expect(wideReportLibraryGeometry).toEqual({
      hasHorizontalOverflow: false,
      hasExpandedStart: false,
      examplesBeforeResults: true,
      usefulStartBeginsInViewport: true,
      exampleInsideLibrary: true,
      cardInsideLibrary: true,
    });
    const wideReportLibraryAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(wideReportLibraryAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-library-en-wide.png",
    ));
    await $(`aria/${english.reports.library.open.replace(
      "{title}",
      "Synthetic ridge progression",
    )}`).click();

    const reviewExport = await $(`aria/${english.reports.reviewExport}`);
    await reviewExport.click();
    let privacyReview = await $(".report-privacy-review");
    await expectDocumentFocus(
      "#report-privacy-heading",
      "opening the export review did not focus its heading",
    );
    const closeExportReview = await privacyReview.$(`aria/${english.reports.closeReview}`);
    await closeExportReview.click();
    await expectElementFocus(
      reviewExport,
      "closing the export review did not restore its initiating action",
    );
    await reviewExport.click();
    privacyReview = await $(".report-privacy-review");
    await expectDocumentFocus(
      "#report-privacy-heading",
      "reopening the export review did not focus its heading",
    );
    await expect(privacyReview).toHaveText(
      expect.stringContaining(english.reports.exactSamplesExcluded),
    );
    await expect(privacyReview).toHaveText(
      expect.stringContaining(english.reports.routeShapeRestricted),
    );
    await expect(privacyReview).toHaveText(
      expect.stringContaining(english.reports.analysisExportIncluded),
    );
    await expect(privacyReview).toHaveText(
      expect.stringContaining(english.reports.titleIncluded),
    );
    await expect(privacyReview).toHaveText(
      expect.stringContaining(english.reports.narrativeIncluded),
    );
    const wideExportReviewGeometry = await browser.execute(() => {
      const root = document.documentElement;
      const review = document.querySelector(".report-privacy-review").getBoundingClientRect();
      const heading = document.querySelector("#report-privacy-heading").getBoundingClientRect();
      return {
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
        headingInsideReview: heading.left >= review.left && heading.right <= review.right,
        headingVisible: heading.top >= 0 && heading.top < window.innerHeight,
        reviewInsideWorkspace: review.right <= root.clientWidth,
      };
    });
    expect(wideExportReviewGeometry).toEqual({
      hasHorizontalOverflow: false,
      headingInsideReview: true,
      headingVisible: true,
      reviewInsideWorkspace: true,
    });
    const wideExportReviewAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(wideExportReviewAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-export-review-en-wide.png",
    ));
    const exportHeartRate = await privacyReview.$$('input[type="checkbox"]')[0];
    await expect(exportHeartRate).toBeChecked();
    await exportHeartRate.click();
    const exportRoute = await privacyReview.$$(".report-route-choice")[0];
    const exportRouteChoice = await exportRoute.$('input[type="checkbox"]');
    await expect(exportRouteChoice).toBeChecked();
    const exportEndpointRedaction = await exportRoute.$('input[type="number"]');
    await expect(exportEndpointRedaction).toHaveValue("300");
    await exportEndpointRedaction.clearValue();
    await exportEndpointRedaction.setValue("500");
    await expect(exportEndpointRedaction).toHaveValue("500");
    const saveDialogMock = await browser.tauri.mock("plugin:dialog|save");
    await saveDialogMock.mockReturnValue(reportOutput);
    await saveDialogMock.update();
    const saveCallCount = saveDialogMock.mock.calls.length;
    await privacyReview.$(`aria/${english.reports.chooseDestination}`).click();
    await browser.waitUntil(async () => {
      await saveDialogMock.update();
      return saveDialogMock.mock.calls.length === saveCallCount + 1;
    }, { timeout: 10_000, timeoutMsg: "report destination was not requested" });
    expect(saveDialogMock.mock.calls[saveCallCount][0]).toEqual({
      options: {
        defaultPath: "Synthetic-ridge-progression.html",
        filters: [{ name: "HTML", extensions: ["html"] }],
      },
    });
    await browser.waitUntil(() => fs.existsSync(reportOutput), {
      timeout: 10_000,
      timeoutMsg: "the self-contained report was not written",
    });
    await waitForNotice("Self-contained HTML exported");
    await expectFocusedStatus(
      "Self-contained HTML exported",
      "a completed export did not focus its visible outcome",
    );
    const exportedReport = fs.readFileSync(reportOutput, "utf8");
    expect(exportedReport).toContain('data-fitfreed-report-version="5"');
    expect(exportedReport).toContain('data-fitfreed-output-version="8"');
    expect(exportedReport).toContain('id="sport-icon-running"');
    expect(exportedReport).toContain('href="#sport-icon-running"');
    expect(exportedReport).toContain(">Trail running<");
    expect(exportedReport).toContain(
      "Held the intended effort and finished the final climb with control.",
    );
    expect(exportedReport).toContain("polar-flow-training-session@6");
    expect(exportedReport).not.toContain("Average heart rate");
    expect(exportedReport).not.toContain("Maximum heart rate");
    expect(exportedReport).toContain("<polyline");
    expect(exportedReport).toContain("500 m");
    expect(exportedReport).toContain("Training finding");
    expect(exportedReport).toContain("Exact training values");
    expect(exportedReport).toContain("Coverage and limitations");
    expect(exportedReport).toContain("Baseline</dt><dd>2026-01-04 – 2026-01-04");
    expect(exportedReport).toContain("Comparison</dt><dd>2026-01-05 – 2026-01-05");
    expect(exportedReport).toContain(
      "Energy: The selected metric is unavailable for one or both periods.",
    );
    expect(exportedReport).toContain("Training history — Distance");
    expect(exportedReport).toContain('<svg class="comparison-chart" role="img"');
    expect(exportedReport).toContain(">Training history — Distance</title>");
    expect(exportedReport).not.toContain('class="comparison-bars"');
    expect(exportedReport).not.toContain("series-");
    expect(exportedReport).not.toContain("40.01");
    expect(exportedReport).not.toContain("-3.01");
    expect(exportedReport).not.toContain("latitude");
    expect(exportedReport).not.toContain("longitude");
    expect(exportedReport).not.toContain("<script");
    expect(exportedReport).not.toContain("https://");

    await reviewExport.click();
    const cancellationReview = await $(".report-privacy-review");
    await expectDocumentFocus(
      "#report-privacy-heading",
      "opening the cancellation review did not focus its heading",
    );
    await saveDialogMock.mockReturnValue(reportOutput);
    await saveDialogMock.update();
    const cancellationSaveCallCount = saveDialogMock.mock.calls.length;
    const cancellationExport = await cancellationReview.$(
      `aria/${english.reports.chooseDestination}`,
    );
    await cancellationExport.click();
    await browser.waitUntil(async () => {
      await saveDialogMock.update();
      return saveDialogMock.mock.calls.length === cancellationSaveCallCount + 1;
    }, { timeout: 10_000, timeoutMsg: "cancelled report destination was not requested" });
    const cancelExport = await cancellationReview.$(`aria/${english.reports.cancelExport}`);
    await cancelExport.waitForDisplayed({ timeout: 10_000 });
    await cancelExport.click();
    await expect($(".report-workspace [role='alert']")).toHaveText(
      english.reports.errors["report-export-cancelled"],
    );
    await expectDocumentFocus(
      ".report-privacy-review .report-actions > button:first-child",
      "a cancelled export did not restore its stable export action",
    );
    expect(fs.readFileSync(reportOutput, "utf8")).toBe(exportedReport);
    expect(await browser.execute((exportedFragment) => (
      Array.from(document.querySelectorAll(".report-workspace [role='status']"))
        .every((status) => !status.textContent?.includes(exportedFragment))
    ), "Self-contained HTML exported")).toBe(true);
    await cancellationReview.$(`aria/${english.reports.closeReview}`).click();
    await expectElementFocus(
      reviewExport,
      "leaving the cancelled export review did not restore its initiating action",
    );
    await $(`aria/${english.reports.viewSourceSession}`).click();
    await expect($("#training-session-detail-heading")).toHaveText("Session summary");
    await $(`aria/${english.training.sessionLibrary.closeDetail}`).click();
    await $(".training-session-applied-query")
      .$(`aria/${english.training.sessionLibrary.clearApplied}`).click();
    await expectTrainingRows([
      [enJan5Card, "30 min"],
      [enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"],
    ]);
    await openHomeQuestion(
      english,
      "review-sleep-patterns",
      ".sleep-insights",
    );
    await expectSleepRows([
      ["Jan 6, 2026", "7 h 30 min", "93.8%", "82", "Details"],
    ]);
    await expectSleepSummary([
      ["1", "Observed nights · 1 of 1 night"],
      ["7 h 30 min", "Average time asleep · 1 of 1 night"],
      ["93.8%", "Average efficiency · 1 of 1 night"],
      ["82", "Average sleep score · 1 of 1 night"],
      ["0 / 1", "Sleep goal met"],
      ["1 of 1 night", "Nights with sleep phases"],
      ["1 of 1 night", "Nights with a stage timeline"],
      ["1 of 1 night", "Nights with recording status · 0 ended after power loss"],
    ]);
    await expectAnswerMeasurementOnOneLine(
      ".sleep-answer-heading .answer-measurement",
    );
    await captureR10WorkspaceEvidence("r10-sleep-en-wide.png", ".sleep-insights");
    await openHomeQuestion(
      english,
      "review-recovery-patterns",
      ".recovery-insights",
    );
    await expectRecoveryRows([
      ["Jan 6, 2026", "900 ms", "42 ms", "Overall status 5 / 6", "Details"],
    ]);
    await expectRecoverySummary([
      ["1", "Observed nights · 1 of 1 night"],
      ["900 ms", "Average beat-to-beat interval · 1 of 1 night"],
      ["42 ms", "Average HRV RMSSD · 1 of 1 night"],
      ["4,100 ms", "Average breathing interval · 1 of 1 night"],
      ["1 of 1 night", "Nights with source assessment"],
      ["1 of 1 night", "Nights with source baseline"],
      ["1 of 1 night", "Nights with source guidance"],
      ["0", "Missing nights"],
    ]);
    await expectAnswerMeasurementOnOneLine(
      ".recovery-answer-heading .answer-measurement",
    );
    await captureR10WorkspaceEvidence("r10-recovery-en-wide.png", ".recovery-insights");
    await openHomeQuestion(
      english,
      "align-history",
      ".longitudinal-insights",
    );
    await expectLongitudinalSummary([
      ["7,300", "Total measured steps · 3 of 6 dates"],
      ["2", "Sessions · 2 · Training days"],
      ["7 h 30 min", "Average asleep duration · 1 of 6 dates"],
      ["900 ms", "Average beat-to-beat interval · 1 of 6 dates"],
    ]);
    await expectLongitudinalRows([
      ["Jan 1, 2026", "3,100", "0 s", "Missing", "Missing"],
      ["Jan 2, 2026", "4,200", "0 s", "Missing", "Missing"],
      ["Jan 3, 2026", "Observation available; step total unavailable", "0 s", "Missing", "Missing"],
      ["Jan 4, 2026", "No observation", "1 h", "Missing", "Missing"],
      ["Jan 5, 2026", "No observation", "30 min", "Missing", "Missing"],
      ["Jan 6, 2026", "No observation", "0 s", "7 h 30 min", "900 ms"],
    ]);
    await captureR10WorkspaceEvidence(
      "r10-aligned-history-en-wide.png",
      ".longitudinal-insights",
    );
    await $('button[aria-label="View aligned details for Jan 6, 2026"]').click();
    await expect($("#longitudinal-detail-heading")).toHaveText("Aligned day detail");
    const longitudinalDetailValues = await $$(".longitudinal-detail-grid dd");
    const expectedLongitudinalDetail = [
      "No observation",
      "Not available",
      "0",
      "0 s",
      "Available",
      "7 h 30 min",
      "Available",
      "900 ms",
      "42 ms",
      "4,100 ms",
    ];
    expect(longitudinalDetailValues).toHaveLength(expectedLongitudinalDetail.length);
    for (let index = 0; index < expectedLongitudinalDetail.length; index += 1) {
      await expect(longitudinalDetailValues[index]).toHaveText(expectedLongitudinalDetail[index]);
    }
    const longitudinalLinks = await $$(".longitudinal-detail-links a");
    expect(longitudinalLinks).toHaveLength(2);
    await expect(longitudinalLinks[0]).toHaveText("Open sleep explorer for this date");
    await expect(longitudinalLinks[1]).toHaveText("Open recovery explorer for this date");
    await expect($(".longitudinal-detail .notice")).toHaveText(
      expect.stringContaining("does not establish cause, diagnosis, readiness, or advice"),
    );

    await longitudinalLinks[0].click();
    await expectFilterRange(".sleep-filter", "2026-01-06", "2026-01-06");
    await expect($("#sleep-detail-heading")).toHaveText("Sleep detail");
    await $("aria/Close sleep detail").click();

    await openHomeQuestion(
      english,
      "align-history",
      ".longitudinal-insights",
    );
    await openDisclosures(".longitudinal-exact-evidence");
    await $('button[aria-label="View aligned details for Jan 6, 2026"]').click();
    await $("aria/Open recovery explorer for this date").click();
    await expectFilterRange(".recovery-filter", "2026-01-06", "2026-01-06");
    await expect($("#recovery-detail-heading")).toHaveText("Recovery detail");
    await $("aria/Close recovery detail").click();

    await openHomeQuestion(
      english,
      "align-history",
      ".longitudinal-insights",
    );
    await openDisclosures(".longitudinal-exact-evidence");
    await $('button[aria-label="View aligned details for Jan 4, 2026"]').click();
    await $("aria/Open training explorer for this date").click();
    await expectFilterRange(".training-session-search", "2026-01-04", "2026-01-04");
    await expectTrainingRows([[enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"]]);
    await $(".training-session-search button.secondary").click();
    await expectTrainingRows([
      [enJan5Card, "30 min"],
      [enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"],
    ]);

    await openHomeQuestion(
      english,
      "align-history",
      ".longitudinal-insights",
    );
    await openDisclosures(".longitudinal-exact-evidence");
    await $('button[aria-label="View aligned details for Jan 1, 2026"]').click();
    await $("aria/Open activity explorer for this date").click();
    await expectFilterRange(".activity-filter", "2026-01-01", "2026-01-01");
    await expect($("#activity-detail-heading")).toHaveText("Daily detail");
    await $("aria/Close detail").click();
    await openDisclosure(".activity-history-controls");
    await $(".activity-filter button.secondary").click();
    await expectHistory([
      ["Jan 1, 2026", "3,100", "Step total available"],
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
    ]);

    await expect($("body")).not.toHaveText(expect.stringContaining("synthetic-device"));
    await expect($("body")).not.toHaveText(expect.stringContaining("fixture-primary-claim"));

    const enSleepStart = await formatBrowserSleepLocalDateTime(
      "en-US",
      "2026-01-05T22:30:00+01:00",
    );
    const enSleepEnd = await formatBrowserSleepLocalDateTime(
      "en-US",
      "2026-01-06T06:30:00+01:00",
    );
    await openHomeQuestion(
      english,
      "review-sleep-patterns",
      ".sleep-insights",
    );
    await $('button[aria-label="View sleep details for Jan 6, 2026"]').click();
    await expect($("#sleep-detail-heading")).toHaveText("Sleep detail");
    const sleepDetailValues = await $$(".sleep-detail-metrics dd");
    const expectedSleepDetail = [
      enSleepStart,
      enSleepEnd,
      "8 h",
      "7 h 30 min",
      "30 min",
      "20 min · 1",
      "10 min · 2",
      "3",
      "93.8%",
      "4.2 · class 4",
      "8 h",
      "No",
      "4 / 5",
      "2",
      "No",
    ];
    expect(sleepDetailValues).toHaveLength(expectedSleepDetail.length);
    for (let index = 0; index < expectedSleepDetail.length; index += 1) {
      await expect(sleepDetailValues[index]).toHaveText(expectedSleepDetail[index]);
    }
    const sleepPhaseValues = await $$(".sleep-phase-values dd");
    const expectedSleepPhases = ["30 min", "1 h 30 min", "4 h", "1 h 30 min", "30 min"];
    expect(sleepPhaseValues).toHaveLength(expectedSleepPhases.length);
    for (let index = 0; index < expectedSleepPhases.length; index += 1) {
      await expect(sleepPhaseValues[index]).toHaveText(expectedSleepPhases[index]);
    }
    expect(await $$(".sleep-timeline + .sleep-table-scroll tbody tr")).toHaveLength(5);
    const sleepScoreValues = await $$(".sleep-score-grid dd");
    const expectedSleepScores = ["82", "80", "78", "84", "86", "76", "81", "79", "79", "83", "78.5", "4 / 5"];
    expect(sleepScoreValues).toHaveLength(expectedSleepScores.length);
    for (let index = 0; index < expectedSleepScores.length; index += 1) {
      await expect(sleepScoreValues[index]).toHaveText(expectedSleepScores[index]);
    }
    await $("aria/Close sleep detail").click();
    expect(await $$(".sleep-detail")).toHaveLength(0);

    await openHomeQuestion(
      english,
      "review-recovery-patterns",
      ".recovery-insights",
    );
    await $('button[aria-label="View recovery details for Jan 6, 2026"]').click();
    await expect($("#recovery-detail-heading")).toHaveText("Recovery detail");
    const recoveryDetailValues = await $$(".recovery-detail-metrics dd");
    const expectedRecoveryDetail = [
      "900 ms",
      "42 ms",
      "4,100 ms",
      "polar-nightly-recharge@1",
      "1.5",
      "4 / 5",
      "5 / 6",
      "2",
      "polar-nightly-recharge@1",
      "910 ms",
      "30 ms",
      "40 ms",
      "8 ms",
      "4,200 ms",
      "120 ms",
    ];
    expect(recoveryDetailValues).toHaveLength(expectedRecoveryDetail.length);
    for (let index = 0; index < expectedRecoveryDetail.length; index += 1) {
      await expect(recoveryDetailValues[index]).toHaveText(expectedRecoveryDetail[index]);
    }
    await expect($(".recovery-guidance")).toHaveText(
      expect.stringContaining("Choose a steady synthetic session."),
    );
    await expect($(".recovery-guidance")).toHaveText(
      expect.stringContaining("Keep a consistent synthetic schedule."),
    );
    await expect($(".recovery-guidance")).toHaveText(
      expect.stringContaining("Plan a synthetic restorative break."),
    );
    await expect($(".recovery-source-notice")).toHaveText(
      expect.stringContaining("not medical advice authored or endorsed by FitFreed"),
    );
    await $("aria/Close recovery detail").click();
    expect(await $$(".recovery-detail")).toHaveLength(0);
    await expect($("body")).not.toHaveText(expect.stringContaining("fixture-training-session"));

    recordJourneyPhase("localized-maximum-zoom");
    await resizeApplication(1280, 720);
    await selectLocale("es-ES");
    await setAppearanceAndZoom("dark", 200, true, "home");
    await captureR10WorkspaceEvidence(
      "r10-home-es-dark-compact-200.png",
      ".library-home",
    );
    await goToHome("reports");
    await openReportWorkspace(spanish, "library");
    await $(".report-list > li").waitForDisplayed({
      timeout: 10_000,
      timeoutMsg: "the saved report result did not load before compact layout evaluation",
    });
    await browser.execute(() => {
      const library = document.querySelector(".report-library");
      library.scrollIntoView({ block: "start", inline: "nearest" });
    });
    const compactReportLibraryGeometry = await browser.execute(() => {
      const root = document.documentElement;
      const library = document.querySelector(".report-library").getBoundingClientRect();
      const navigation = document.querySelector(".app-sidebar").getBoundingClientRect();
      const examples = document.querySelector(".report-examples").getBoundingClientRect();
      const example = document.querySelector(".report-example-list > li").getBoundingClientRect();
      const savedHeading = document.querySelector("#saved-reports-heading").getBoundingClientRect();
      const list = document.querySelector(".report-list").getBoundingClientRect();
      const card = document.querySelector(".report-list > li").getBoundingClientRect();
      const visibleExampleHeight = Math.max(
        0,
        Math.min(example.bottom, window.innerHeight) - Math.max(example.top, navigation.bottom),
      );
      return {
        viewportHeight: window.innerHeight,
        navigationBottom: navigation.bottom,
        libraryTop: library.top,
        examplesBottom: examples.bottom,
        exampleTop: example.top,
        exampleBottom: example.bottom,
        exampleHeight: example.height,
        listTop: list.top,
        cardTop: card.top,
        cardBottom: card.bottom,
        cardHeight: card.height,
        visibleExampleHeight,
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
        libraryBelowNavigation: library.top >= navigation.bottom - 1,
        hasExpandedStart: document.querySelector(".report-library-start") !== null,
        examplesBeforeResults: examples.bottom <= savedHeading.top && savedHeading.bottom <= list.top,
        usefulStartVisible: visibleExampleHeight >= Math.min(
          example.height,
          window.innerHeight - navigation.bottom,
        ) * 0.6,
        exampleInsideLibrary: example.left >= library.left && example.right <= library.right,
        cardInsideLibrary: card.left >= library.left && card.right <= library.right,
      };
    });
    const {
      viewportHeight,
      navigationBottom,
      libraryTop,
      examplesBottom,
      exampleTop,
      exampleBottom,
      exampleHeight,
      listTop,
      cardTop,
      cardBottom,
      cardHeight,
      visibleExampleHeight,
      ...compactReportLibraryContract
    } = compactReportLibraryGeometry;
    if (!compactReportLibraryContract.usefulStartVisible) {
      process.stderr.write(`${JSON.stringify({
        reportLibraryGeometry: {
          viewportHeight,
          navigationBottom,
          libraryTop,
          examplesBottom,
          exampleTop,
          exampleBottom,
          exampleHeight,
          listTop,
          cardTop,
          cardBottom,
          cardHeight,
          visibleExampleHeight,
        },
      })}\n`);
    }
    expect(compactReportLibraryContract).toEqual({
      hasHorizontalOverflow: false,
      libraryBelowNavigation: true,
      hasExpandedStart: false,
      examplesBeforeResults: true,
      usefulStartVisible: true,
      exampleInsideLibrary: true,
      cardInsideLibrary: true,
    });
    const compactReportLibraryAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(compactReportLibraryAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-library-es-dark-200.png",
    ));
    await goToHome("sources");
    await expect($("#outcome-heading")).toHaveText(spanish.outcome.changedHeading);
    await openOutcomeDisclosure(".outcome-coverage-detail");
    await expectCoverage([
      ["9", spanish.outcome.supported],
      ["0", spanish.outcome.unsupported],
      ["2", spanish.outcome.ignored],
      ["1", spanish.outcome.unrecognized],
      ["0", spanish.outcome.invalid],
    ]);
    await expectFamilyCoverage([
      {
        family: spanish.outcome.unrecognizedFamily,
        classification: spanish.outcome.familyClassifications.unrecognized,
        count: "1",
        ...spanish.outcome.coverageExplanations["unrecognized-artifact-family"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-nightly-recovery-blob"],
        classification: spanish.outcome.familyClassifications["deliberately-ignored"],
        count: "1",
        ...spanish.outcome.coverageExplanations["excluded-unidentifiable-recovery-samples"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-profile-picture"],
        classification: spanish.outcome.familyClassifications["deliberately-ignored"],
        count: "1",
        ...spanish.outcome.coverageExplanations["mvp-excludes-profile-picture"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-account-data"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["source-subject-claim"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-daily-activity"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "3",
        ...spanish.outcome.coverageExplanations.mapped,
      },
      {
        family: spanish.outcome.familyNames["polar-flow-nightly-recovery"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["mapped-recovery-summaries"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-sleep-result"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["mapped-sleep-periods"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-sleep-score"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["mapped-sleep-scores"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-training-session"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "2",
        ...spanish.outcome.coverageExplanations["mapped-training-evidence"],
      },
    ]);
    await returnToLibraryHome(spanish);
    await expectLibraryHome(spanish, { coverageExpanded: true });
    const esJan4Card = await formatBrowserTrainingCardDateTime(
      "es-ES",
      "2026-01-04T06:15:00",
    );
    const esJan5Card = await formatBrowserTrainingCardDateTime(
      "es-ES",
      "2026-01-05T18:00:00",
    );
    const esJan6Card = await formatBrowserTrainingCardDateTime(
      "es-ES",
      "2026-01-06T07:30:00",
    );
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(spanish, "sports");
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3")).toHaveText(
      "Trail running",
    );
    await expect($(".training-sport-list > li[data-state='personally-overridden']")).toHaveText(
      expect.stringContaining(spanish.training.sports.classifiedByYou),
    );
    await saveSportClassification(
      spanish,
      "Trail running",
      "running",
      "Carrera de montaña",
    );
    await openTrainingWorkspace(spanish, "sessions");
    await expectTrainingRows([
      [esJan5Card, "30 min"],
      [esJan4Card, "1 h", "10 km", "600 kcal", "142 ppm"],
    ]);
    await expectTrainingSummary([
      ["2 sesiones", spanish.training.sessionCount],
      ["2 días de entrenamiento", spanish.training.trainingDays],
      ["1 h 30 min", spanish.training.totalDuration],
      ["10.000 m", `${spanish.training.totalDistance} · 1 de 2`],
      ["600 kcal", `${spanish.training.totalEnergy} · 1 de 2`],
      ["1 de 2", spanish.training.heartRateCoverage],
    ]);
    await openHomeQuestion(
      spanish,
      "review-sleep-patterns",
      ".sleep-insights",
    );
    await expectSleepRows([
      [formatLocalDate("es-ES", "2026-01-06"), "7 h 30 min", "93,8%", "82", spanish.sleep.details],
    ]);
    await expectSleepSummary([
      ["1", `${spanish.sleep.observedNights} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nightUnit.one}`],
      ["7 h 30 min", `${spanish.sleep.averageAsleep} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nightUnit.one}`],
      ["93,8%", `${spanish.sleep.averageEfficiency} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nightUnit.one}`],
      ["82", `${spanish.sleep.averageScore} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nightUnit.one}`],
      ["0 / 1", spanish.sleep.goalMet],
      [`1 ${spanish.sleep.of} 1 ${spanish.sleep.nightUnit.one}`, spanish.sleep.phaseCoverage],
      [`1 ${spanish.sleep.of} 1 ${spanish.sleep.nightUnit.one}`, spanish.sleep.timelineCoverage],
      [`1 ${spanish.sleep.of} 1 ${spanish.sleep.nightUnit.one}`, `${spanish.sleep.powerCoverage} · 0 ${spanish.sleep.powerLoss}`],
    ]);
    await openHomeQuestion(
      spanish,
      "review-recovery-patterns",
      ".recovery-insights",
    );
    await expectRecoveryRows([
      [
        formatLocalDate("es-ES", "2026-01-06"),
        "900 ms",
        "42 ms",
        `${spanish.recovery.overallStatus} 5 / 6`,
        spanish.recovery.details,
      ],
    ]);
    await expectRecoverySummary([
      ["1", `${spanish.recovery.observedNights} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      ["900 ms", `${spanish.recovery.averageBeatToBeat} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      ["42 ms", `${spanish.recovery.averageRmssd} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      ["4.100 ms", `${spanish.recovery.averageBreathing} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`, spanish.recovery.assessmentCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`, spanish.recovery.baselineCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`, spanish.recovery.guidanceCoverage],
      ["0", spanish.recovery.missingNights],
    ]);
    await expect($("html")).toHaveAttribute("data-appearance", "dark");
    expect(await browser.execute(
      () => document.documentElement.style.getPropertyValue("--content-zoom"),
    )).toBe("2");
    const overflowState = await browser.execute(() => ({
      scrollX: window.scrollX,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const hasHorizontalOverflow = overflowState.scrollWidth > overflowState.clientWidth;
    if (hasHorizontalOverflow) {
      const overflowEvidence = await browser.execute((measuredState) => ({
        overflowState: measuredState,
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        landmarks: [
          "body",
          "main",
          ".recovery-insights",
          ".recovery-filter",
          ".recovery-summary",
          ".recovery-table-scroll",
          ".recovery-comparison",
          ".recovery-comparison form",
        ].map((selector) => {
          const element = document.querySelector(selector);
          const bounds = element?.getBoundingClientRect();
          return {
            selector,
            left: Math.round(bounds?.left ?? 0),
            right: Math.round(bounds?.right ?? 0),
            width: Math.round(bounds?.width ?? 0),
            scrollWidth: element?.scrollWidth ?? 0,
            clientWidth: element?.clientWidth ?? 0,
            overflowX: element ? getComputedStyle(element).overflowX : null,
          };
        }),
        elements: Array.from(document.querySelectorAll("body *"))
          .map((element) => ({
            selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
              element.classList.length > 0 ? `.${Array.from(element.classList).join(".")}` : ""
            }`,
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right),
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
            overflowX: getComputedStyle(element).overflowX,
          }))
          .filter((element) => (
            element.right > document.documentElement.clientWidth + 1
            || (element.scrollWidth > element.clientWidth && element.overflowX === "visible")
          ))
          .slice(0, 30),
      }), overflowState);
      throw new Error(`localized recovery view overflowed: ${JSON.stringify(overflowEvidence)}`);
    }
    await selectLocale("en-US");

    const accessibility = await new AxeBuilder({ client: browser }).setLegacyMode().analyze();
    expect(accessibility.violations).toEqual([]);

    await goToHome("sources");
    await $("aria/Import selected package").click();
    await waitForNotice(english.home.postImportExactRepeat);
    await expectLibraryHome(english, { coverageExpanded: true });
    await expect($(".library-home-reveal")).toHaveText(
      expect.stringContaining(english.home.postImportExactRepeat),
    );
    await openHomeQuestion(
      english,
      "review-activity-steps",
      "#activity-heading",
    );
    await $("#activity-comparison-heading").waitForDisplayed({ timeout: 10_000 });
    await openDomainWorkspace(english, "activity", "history");
    await expectHistory([
      ["Jan 1, 2026", "3,100", "Step total available"],
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
    ]);
    recordJourneyPhase("range-validation-and-comparisons");
    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(english, "sports");
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3")).toHaveText(
      "Carrera de montaña",
    );
    await openTrainingWorkspace(english, "sessions");
    await expectTrainingRows([
      [enJan5Card, "30 min"],
      [enJan4Card, "1 h", "10 km", "600 kcal", "142 bpm"],
    ]);

    await goToHome("sources");
    await selectArchive(dialogMock, path.join(fixtureDirectory, "overlap.zip"), english.choose);
    await $("aria/Import selected package").click();
    await waitForNotice(english.home.postImportChanged);
    await expectLibraryHome(english, { coverageExpanded: true });
    await expect($(".library-home-reveal")).toHaveText(
      expect.stringContaining(english.home.postImportChanged),
    );
    await openHomeQuestion(
      english,
      "review-activity-steps",
      "#activity-heading",
    );
    await $("#activity-comparison-heading").waitForDisplayed({ timeout: 10_000 });
    await openDomainWorkspace(english, "activity", "history");
    await expectHistory([
      ["Jan 1, 2026", "3,100", "Step total available"],
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
      ["Jan 4, 2026", "Not available", "No observation"],
      ["Jan 5, 2026", "5,300", "Step total available"],
    ]);
    await expectActivitySummary([
      ["12,600", "Total steps"],
      ["4,200", "Average per day with steps"],
      ["3", "Days with step totals"],
      ["1", "Observed days without a step total"],
      ["1", "Days with no observation"],
    ]);
    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(english, "sports");
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3")).toHaveText(
      "Carrera de montaña",
    );
    await openTrainingWorkspace(english, "sessions");
    await expectTrainingRows([
      [enJan6Card, "45 min", "5 km", "300 kcal", "130 bpm"],
      [enJan5Card, "30 min"],
      [enJan4Card, "1 h", "10.5 km", "600 kcal", "142 bpm"],
    ]);
    await expectTrainingSummary([
      ["3 sessions", "Sessions"],
      ["3 training days", "Training days"],
      ["2 h 15 min", "Total duration"],
      ["15,500 m", "Recorded distance · 2 of 3"],
      ["900 kcal", "Recorded energy · 2 of 3"],
      ["2 of 3", "Sessions with heart rate"],
    ]);
    await openHomeQuestion(
      english,
      "align-history",
      ".longitudinal-insights",
    );
    await expectLongitudinalSummary([
      ["12,600", "Total measured steps · 4 of 6 dates"],
      ["3", "Sessions · 3 · Training days"],
      ["7 h 30 min", "Average asleep duration · 1 of 6 dates"],
      ["900 ms", "Average beat-to-beat interval · 1 of 6 dates"],
    ]);
    await expectLongitudinalRows([
      ["Jan 1, 2026", "3,100", "0 s", "Missing", "Missing"],
      ["Jan 2, 2026", "4,200", "0 s", "Missing", "Missing"],
      ["Jan 3, 2026", "Observation available; step total unavailable", "0 s", "Missing", "Missing"],
      ["Jan 4, 2026", "No observation", "1 h", "Missing", "Missing"],
      ["Jan 5, 2026", "5,300", "30 min", "Missing", "Missing"],
      ["Jan 6, 2026", "No observation", "45 min", "7 h 30 min", "900 ms"],
    ]);

    await openHomeQuestion(
      english,
      "review-activity-steps",
      "#activity-heading",
    );
    await expectComparisonHeading(
      "#activity-comparison-heading",
      "Average daily steps were 1,100 higher",
    );
    await expect($(".activity-comparison .answer-evidence")).toHaveText(
      "1 day with a step total in each period",
    );
    await openDomainWorkspace(english, "activity", "history");
    await setActivityRange("2026-01-02", "2026-01-04");
    await $("aria/Apply range").click();
    await expectHistory([
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
      ["Jan 4, 2026", "Not available", "No observation"],
    ]);
    await expectActivitySummary([
      ["4,200", "Total steps"],
      ["4,200", "Average per day with steps"],
      ["1", "Days with step totals"],
      ["1", "Observed days without a step total"],
      ["1", "Days with no observation"],
    ]);

    const detailButtons = await $$('button[aria-label="View details for Jan 3, 2026"]');
    expect(detailButtons).toHaveLength(2);
    await detailButtons[1].click();
    await expect($("#activity-detail-heading")).toHaveText("Daily detail");
    const detailValues = await $$(".activity-detail dd");
    await expect(detailValues[0]).toHaveText("Not available");
    await expect(detailValues[1]).toHaveText(
      "Observation available; step total unavailable",
    );
    await $("aria/Close detail").click();
    expect(await $$(".activity-detail")).toHaveLength(0);

    await setActivityRange("2026-01-04", "2026-01-04");
    await $("aria/Apply range").click();
    await expectHistory([
      ["Jan 4, 2026", "Not available", "No observation"],
    ]);
    await expectActivitySummary([
      ["Not available", "Total steps"],
      ["Not available", "Average per day with steps"],
      ["0", "Days with step totals"],
      ["0", "Observed days without a step total"],
      ["1", "Days with no observation"],
    ]);

    await setActivityRange("2026-01-05", "2026-01-04");
    await $("aria/Apply range").click();
    await expect($("[role='alert']")).toHaveText(
      "Choose an ordered range inside the available history, up to 366 days.",
    );
    await expectHistory([
      ["Jan 4, 2026", "Not available", "No observation"],
    ]);

    await $("aria/Latest 30 days").click();
    await expectHistory([
      ["Jan 1, 2026", "3,100", "Step total available"],
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
      ["Jan 4, 2026", "Not available", "No observation"],
      ["Jan 5, 2026", "5,300", "Step total available"],
    ]);

    await openDomainWorkspace(english, "activity", "comparison");
    await setComparisonRanges("2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05");
    await $(".activity-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#activity-comparison-heading",
      "Average daily steps were 1,650 higher",
    );
    await $(".activity-comparison-result .answer-exact-values summary").click();
    const comparisonRows = await $$(".activity-comparison-result table tbody tr");
    expect(comparisonRows).toHaveLength(5);
    const expectedComparison = [
      ["Total steps", "7,300", "5,300", "-2,000"],
      ["Average per day with steps", "3,650", "5,300", "+1,650"],
      ["Days with step totals", "2", "1", "-1"],
      ["Observed days without a step total", "0", "0", "0"],
      ["Days with no observation", "0", "1", "+1"],
    ];
    for (let index = 0; index < expectedComparison.length; index += 1) {
      const cells = await comparisonRows[index].$$("th, td");
      for (let cellIndex = 0; cellIndex < expectedComparison[index].length; cellIndex += 1) {
        await expect(cells[cellIndex]).toHaveText(expectedComparison[index][cellIndex]);
      }
    }

    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    const trainingDetailButtons = await $$('button[aria-label^="View session details for"]');
    expect(trainingDetailButtons).toHaveLength(3);
    await trainingDetailButtons[2].click();
    await expect($("#training-session-detail-heading")).toHaveText("Session summary");
    const trainingDetailValues = await $$(`[role="group"][aria-label="${english.training.sessionLibrary.summaryMeasurements}"] dl dd`);
    const expectedTrainingDetail = [
      "Carrera de montaña",
      enJan4Start,
      enJan4Stop,
      "UTC+01:00",
      "1 h",
      "10,500 m",
      "600 kcal",
      "142 bpm",
      "171 bpm",
      "1",
    ];
    expect(trainingDetailValues).toHaveLength(expectedTrainingDetail.length);
    for (let index = 0; index < expectedTrainingDetail.length; index += 1) {
      await expect(trainingDetailValues[index]).toHaveText(expectedTrainingDetail[index]);
    }
    await $("aria/Back to session results").click();
    expect(await $$(".training-detail")).toHaveLength(0);

    await setTrainingRange("2026-01-05", "2026-01-05");
    await $(".training-session-search button[type='submit']").click();
    await expectTrainingRows([
      [enJan5Card, "30 min"],
    ]);
    await expectTrainingSummary([
      ["1 session", "Sessions"],
      ["1 training day", "Training days"],
      ["30 min", "Total duration"],
      ["Not available", "Recorded distance · 0 of 1"],
      ["Not available", "Recorded energy · 0 of 1"],
      ["0 of 1", "Sessions with heart rate"],
    ]);
    await $('button[aria-label^="View session details for"]').click();
    const partialTrainingSummary = await $(`[role="group"][aria-label="${english.training.sessionLibrary.summaryMeasurements}"]`);
    const partialTrainingRows = await partialTrainingSummary.$$("dl > div");
    const partialTrainingMeasurements = new Map();
    for (const row of partialTrainingRows) {
      partialTrainingMeasurements.set(
        await row.$("dt").getText(),
        await row.$("dd").getText(),
      );
    }
    expect([...partialTrainingMeasurements.keys()]).toEqual([
      english.training.trainingType,
      english.training.startedAt,
      english.training.stoppedAt,
      english.training.utcOffset,
      english.training.duration,
      english.training.exerciseCount,
    ]);
    expect(partialTrainingMeasurements.get(english.training.trainingType))
      .toBe("Sport not recorded");
    expect(partialTrainingMeasurements.get(english.training.exerciseCount)).toBe("0");
    expect(await partialTrainingSummary.getText()).not.toContain("Not recorded");
    await $("aria/Back to session results").click();

    await setTrainingRange("2026-01-06", "2026-01-05");
    await $(".training-session-search button[type='submit']").click();
    await expect($("[role='alert']")).toHaveText(
      "Choose an ordered training-session date range and a personal sport name of up to 80 characters.",
    );
    await expectTrainingRows([
      [enJan5Card, "30 min"],
    ]);

    await $(".training-session-search button.secondary").click();
    await expectTrainingRows([
      [enJan6Card, "45 min", "5 km", "300 kcal", "130 bpm"],
      [enJan5Card, "30 min"],
      [enJan4Card, "1 h", "10.5 km", "600 kcal", "142 bpm"],
    ]);
    const completeTrainingDetailButtons = await $$(
      'button[aria-label^="View session details for"]',
    );
    await completeTrainingDetailButtons[0].click();
    await openTrainingDetailSection(english, "structure");
    const mixedSportExercises = await $$("#training-detail-structure > .training-exercise");
    expect(mixedSportExercises).toHaveLength(2);
    await expect(mixedSportExercises[0].$(".training-exercise-heading")).toHaveText("Exercise 1");
    await expect(mixedSportExercises[1].$(".training-exercise-heading")).toHaveText("Exercise 2");
    await expect(mixedSportExercises[1].$("header span")).toHaveText("Unknown sport 1");
    await $("aria/Back to session results").click();

    await openTrainingWorkspace(english, "comparison");
    await expectUsefulComparisonDefault(".training-comparison", english);
    await setTrainingComparisonRanges(
      "2026-01-04",
      "2026-01-04",
      "2026-01-05",
      "2026-01-05",
    );
    await $(".training-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#training-comparison-heading",
      english.training.comparison.answerLower.replace("{value}", "30 min"),
    );
    expect(
      await $(".training-comparison .answer-controls").getAttribute("open"),
    ).toBeNull();
    expect(
      await $(".training-comparison-result .answer-exact-values").getAttribute("open"),
    ).toBeNull();
    await expectTrainingComparison([
      ["Sessions", "1", "1", "0"],
      ["Training days", "1", "1", "0"],
      ["Total duration", "1 h", "30 min", "−30 min"],
      ["Recorded distance", "10,500 m", "Not available", "Not available"],
      ["Recorded energy", "600 kcal", "Not available", "Not available"],
      ["Sessions with distance", "1", "0", "-1"],
      ["Sessions with energy", "1", "0", "-1"],
      ["Sessions with heart rate", "1", "0", "-1"],
    ]);
    const createComparisonReport = await $(
      `aria/${english.training.comparison.createReport}`,
    );
    await createComparisonReport.click();
    await expect($(".reports-hero h1")).toHaveText(english.reports.heading);
    await setReportComparisonRanges("2026-01-04", "2026-01-04", "2026-01-05", "2026-01-05");
    expect(await $$(".report-block-editor:has(.report-analysis-block-help)"))
      .toHaveLength(5);
    const comparisonReportTitle = await $('.report-editor input[maxlength="120"]');
    await comparisonReportTitle.clearValue();
    await comparisonReportTitle.setValue("Synthetic comparison answer");
    expect(await $$(".report-editor textarea")).toHaveLength(0);
    const addComparisonCommentary = await $(`aria/${english.reports.commentary.add}`);
    await expect(addComparisonCommentary).toBeDisplayed();
    await expectRevealOutsideApplicationNavigation(".report-commentary-picker");
    const factualComposeAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(factualComposeAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-compose-factual-en-dark-200.png",
    ));

    await addComparisonCommentary.click();
    const temporaryCommentary = await $(".report-editor textarea");
    await expectElementFocus(
      temporaryCommentary,
      "adding optional commentary did not focus its editor",
    );
    await temporaryCommentary.setValue("Temporary commentary that will not be saved.");
    const commentaryEditor = await $(".report-block-editor:has(textarea)");
    await expect(commentaryEditor.$(".report-block-order")).toHaveText("6");
    await commentaryEditor.$(`aria/${english.reports.moveEarlier.replace(
      "{block}",
      english.reports.narrativeLabel,
    )}`).click();
    const movedCommentaryEditor = await $(".report-block-editor:has(textarea)");
    await expect(movedCommentaryEditor.$(".report-block-order")).toHaveText("5");
    await movedCommentaryEditor.$(`aria/${english.reports.commentary.remove}`).click();
    expect(await $$(".report-editor textarea")).toHaveLength(0);
    await expectElementFocus(
      await $(`aria/${english.reports.commentary.add}`),
      "removing optional commentary did not restore focus to its add action",
    );
    await $('.report-editor button[type="submit"]').click();
    await waitForNotice(english.reports.saved);
    await expect($(".report-preview h3")).toHaveText("Synthetic comparison answer");
    expect(await $$(".report-preview .report-narrative")).toHaveLength(0);
    await expect($(".report-preview")).not.toHaveText(expect.stringContaining("Polar Flow"));
    expect(await $$(".report-list > li")).toHaveLength(3);
    await $(`aria/${english.reports.backToComparison}`).click();
    await expectComparisonHeading(
      "#training-comparison-heading",
      english.training.comparison.answerLower.replace("{value}", "30 min"),
    );
    await expectTrainingComparison([
      ["Sessions", "1", "1", "0"],
      ["Training days", "1", "1", "0"],
      ["Total duration", "1 h", "30 min", "−30 min"],
      ["Recorded distance", "10,500 m", "Not available", "Not available"],
      ["Recorded energy", "600 kcal", "Not available", "Not available"],
      ["Sessions with distance", "1", "0", "-1"],
      ["Sessions with energy", "1", "0", "-1"],
      ["Sessions with heart rate", "1", "0", "-1"],
    ]);
    await browser.waitUntil(
      () => browser.execute(
        () => document.activeElement === document.querySelector(
          ".training-comparison-result-heading button:not(.secondary)",
        ),
      ), {
        timeout: 10_000,
        timeoutMsg: "returning from report authoring did not restore comparison focus",
      },
    );

    await openHomeQuestion(
      english,
      "review-sleep-patterns",
      ".sleep-insights",
    );
    await setSleepRange("2026-01-06", "2026-01-06");
    await $(".sleep-filter button[type='submit']").click();
    await expectSleepRows([
      ["Jan 6, 2026", "7 h 30 min", "93.8%", "82", "Details"],
    ]);
    await setSleepRange("2026-01-06", "2026-01-05");
    await browser.execute(() => {
      document.querySelector(".sleep-filter").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await expect($("[role='alert']")).toHaveText(
      "Choose an ordered sleep range inside the available history, up to 366 nights.",
    );
    await expectSleepRows([
      ["Jan 6, 2026", "7 h 30 min", "93.8%", "82", "Details"],
    ]);
    await $(".sleep-filter button.secondary").click();

    await openDomainWorkspace(english, "sleep", "comparison");
    await setSleepComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".sleep-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#sleep-comparison-heading",
      "Average recorded sleep was unchanged",
    );
    await expectSleepComparison([
      ["Observed nights", "1", "1", "0"],
      ["Missing nights", "0", "0", "0"],
      ["Average time asleep", "7 h 30 min", "7 h 30 min", "0 s"],
      ["Average interruption time", "30 min", "30 min", "0 s"],
      ["Average efficiency", "93.8%", "93.8%", "0 pp"],
      ["Average sleep score", "82", "82", "0"],
      ["Sleep goal met", "0%", "0%", "0 pp"],
    ]);
    await setSleepComparisonRanges(
      "2026-01-06",
      "2026-01-05",
      "2026-01-06",
      "2026-01-06",
    );
    await browser.execute(() => {
      document.querySelector(".sleep-comparison form").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await expect($("[role='alert']")).toHaveText(
      "Choose ordered sleep comparison periods inside the available history, up to 366 nights each.",
    );
    await expectComparisonHeading(
      "#sleep-comparison-heading",
      "Average recorded sleep was unchanged",
    );

    await openHomeQuestion(
      english,
      "review-recovery-patterns",
      ".recovery-insights",
    );
    await setRecoveryRange("2026-01-06", "2026-01-06");
    await $(".recovery-filter button[type='submit']").click();
    await expectRecoveryRows([
      ["Jan 6, 2026", "900 ms", "42 ms", "Overall status 5 / 6", "Details"],
    ]);
    await setRecoveryRange("2026-01-06", "2026-01-05");
    await browser.execute(() => {
      document.querySelector(".recovery-filter").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await expect($("[role='alert']")).toHaveText(
      "Choose an ordered recovery range inside the available history, up to 366 nights.",
    );
    await expectRecoveryRows([
      ["Jan 6, 2026", "900 ms", "42 ms", "Overall status 5 / 6", "Details"],
    ]);
    await $(".recovery-filter button.secondary").click();

    await openDomainWorkspace(english, "recovery", "comparison");
    await setRecoveryComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".recovery-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#recovery-comparison-heading",
      "Average recorded beat-to-beat interval was unchanged",
    );
    await expectRecoveryComparison([
      ["Observed nights", "1", "1", "0"],
      ["Missing nights", "0", "0", "0"],
      ["Average beat-to-beat interval", "900 ms", "900 ms", "0 ms"],
      ["Average HRV RMSSD", "42 ms", "42 ms", "0 ms"],
      ["Average breathing interval", "4,100 ms", "4,100 ms", "0 ms"],
      ["Nights with source assessment", "1", "1", "0"],
      ["Nights with source baseline", "1", "1", "0"],
      ["Nights with source guidance", "1", "1", "0"],
    ]);
    await setRecoveryComparisonRanges(
      "2026-01-06",
      "2026-01-05",
      "2026-01-06",
      "2026-01-06",
    );
    await browser.execute(() => {
      document.querySelector(".recovery-comparison form").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await expect($("[role='alert']")).toHaveText(
      "Choose ordered recovery comparison periods inside the available history, up to 366 nights each.",
    );
    await expectComparisonHeading(
      "#recovery-comparison-heading",
      "Average recorded beat-to-beat interval was unchanged",
    );

    await openHomeQuestion(
      english,
      "align-history",
      ".longitudinal-insights",
    );
    await setLongitudinalRange("2026-01-04", "2026-01-06");
    await $(".longitudinal-filter button[type='submit']").click();
    await expectLongitudinalSummary([
      ["5,300", "Total measured steps · 1 of 3 dates"],
      ["3", "Sessions · 3 · Training days"],
      ["7 h 30 min", "Average asleep duration · 1 of 3 dates"],
      ["900 ms", "Average beat-to-beat interval · 1 of 3 dates"],
    ]);
    await expectLongitudinalRows([
      ["Jan 4, 2026", "No observation", "1 h", "Missing", "Missing"],
      ["Jan 5, 2026", "5,300", "30 min", "Missing", "Missing"],
      ["Jan 6, 2026", "No observation", "45 min", "7 h 30 min", "900 ms"],
    ]);
    await setLongitudinalRange("2026-01-06", "2026-01-05");
    await browser.execute(() => {
      document.querySelector(".longitudinal-filter").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await expect($("[role='alert']")).toHaveText(
      "Choose an ordered shared period inside the complete available history, up to 366 dates.",
    );
    await expectLongitudinalRows([
      ["Jan 4, 2026", "No observation", "1 h", "Missing", "Missing"],
      ["Jan 5, 2026", "5,300", "30 min", "Missing", "Missing"],
      ["Jan 6, 2026", "No observation", "45 min", "7 h 30 min", "900 ms"],
    ]);
    await $(".longitudinal-filter button.secondary").click();
    await expectLongitudinalRows([
      ["Jan 1, 2026", "3,100", "0 s", "Missing", "Missing"],
      ["Jan 2, 2026", "4,200", "0 s", "Missing", "Missing"],
      ["Jan 3, 2026", "Observation available; step total unavailable", "0 s", "Missing", "Missing"],
      ["Jan 4, 2026", "No observation", "1 h", "Missing", "Missing"],
      ["Jan 5, 2026", "5,300", "30 min", "Missing", "Missing"],
      ["Jan 6, 2026", "No observation", "45 min", "7 h 30 min", "900 ms"],
    ]);

    await openDomainWorkspace(english, "longitudinal", "comparison");
    await setLongitudinalComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".longitudinal-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#longitudinal-comparison-heading",
      "Four histories compared side by side",
    );
    await expectLongitudinalComparison([
      ["Total steps", "Not available", "Not available", "Not available"],
      ["Training duration", "45 min", "45 min", "0 s"],
      ["Average asleep duration", "7 h 30 min", "7 h 30 min", "0 s"],
      ["Average beat-to-beat interval", "900 ms", "900 ms", "0 ms"],
    ]);
    await setLongitudinalComparisonRanges(
      "2026-01-06",
      "2026-01-05",
      "2026-01-06",
      "2026-01-06",
    );
    await browser.execute(() => {
      document.querySelector(".longitudinal-comparison form").dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    await expect($("[role='alert']")).toHaveText(
      "Choose ordered shared comparison periods inside the complete available history, up to 366 dates each.",
    );
    await expectComparisonHeading(
      "#longitudinal-comparison-heading",
      "Four histories compared side by side",
    );

    await selectLocale("es-ES");
    await expectComparisonHeading(
      "#longitudinal-comparison-heading",
      spanish.longitudinal.comparison.answerSingle,
    );
    await openHomeQuestion(
      spanish,
      "review-activity-steps",
      "#activity-heading",
    );
    await expectComparisonHeading(
      "#activity-comparison-heading",
      spanish.activity.comparison.answerHigher.replace("{value}", "1.100"),
    );
    await expectResultBelowCompactNavigation("#activity-comparison-heading");
    await openDomainWorkspace(spanish, "activity", "history");
    await expectHistory([
      [formatLocalDate("es-ES", "2026-01-01"), "3.100", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-02"), "4.200", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-03"), spanish.unavailable, spanish.activity.unavailable],
      [formatLocalDate("es-ES", "2026-01-04"), spanish.unavailable, spanish.activity.missing],
      [formatLocalDate("es-ES", "2026-01-05"), "5.300", spanish.activity.available],
    ]);
    const spanishDetailLabel = `${spanish.activity.viewDetails} ${formatLocalDate("es-ES", "2026-01-04")}`;
    const spanishDetailButtons = await $$(`button[aria-label="${spanishDetailLabel}"]`);
    expect(spanishDetailButtons).toHaveLength(2);
    await spanishDetailButtons[0].click();
    await expect($("#activity-detail-heading")).toHaveText(spanish.activity.detailHeading);
    const spanishDetailValues = await $$(".activity-detail dd");
    await expect(spanishDetailValues[1]).toHaveText(spanish.activity.missing);
    await $(`aria/${spanish.activity.closeDetail}`).click();
    await openDomainWorkspace(spanish, "activity", "comparison");
    await setComparisonRanges("2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05");
    await $(".activity-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#activity-comparison-heading",
      spanish.activity.comparison.answerHigher.replace("{value}", "1.650"),
    );
    await $(".activity-comparison-result button.secondary").click();
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await expectTrainingRows([
      [esJan6Card, "45 min", "5 km", "300 kcal", "130 ppm"],
      [esJan5Card, "30 min"],
      [esJan4Card, "1 h", "10,5 km", "600 kcal", "142 ppm"],
    ]);
    await expectTrainingSummary([
      ["3 sesiones", spanish.training.sessionCount],
      ["3 días de entrenamiento", spanish.training.trainingDays],
      ["2 h 15 min", spanish.training.totalDuration],
      ["15.500 m", `${spanish.training.totalDistance} · 2 de 3`],
      ["900 kcal", `${spanish.training.totalEnergy} · 2 de 3`],
      ["2 de 3", spanish.training.heartRateCoverage],
    ]);
    recordJourneyPhase("localized-workspaces-and-details");
    await openTrainingWorkspace(spanish, "comparison");
    await setTrainingComparisonRanges(
      "2026-01-04",
      "2026-01-04",
      "2026-01-05",
      "2026-01-05",
    );
    await $(".training-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#training-comparison-heading",
      spanish.training.comparison.answerLower.replace("{value}", "30 min"),
    );
    await expectResultBelowCompactNavigation("#training-comparison-heading");
    expect(
      await $(".training-comparison .answer-controls").getAttribute("open"),
    ).toBeNull();
    expect(
      await $(".training-comparison-result .answer-exact-values").getAttribute("open"),
    ).toBeNull();
    await $(".training-comparison-result button.secondary").click();
    await openHomeQuestion(
      spanish,
      "align-history",
      ".longitudinal-insights",
    );
    await openDomainWorkspace(spanish, "longitudinal", "comparison");
    await setLongitudinalComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".longitudinal-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#longitudinal-comparison-heading",
      spanish.longitudinal.comparison.answerSingle,
    );
    await openDomainWorkspace(spanish, "longitudinal", "history");
    await expectLongitudinalSummary([
      ["12.600", `${spanish.longitudinal.totalSteps} · 4 ${spanish.longitudinal.of} 6 ${spanish.longitudinal.days}`],
      ["3", `${spanish.longitudinal.sessions} · 3 · ${spanish.longitudinal.trainingDays}`],
      ["7 h 30 min", `${spanish.longitudinal.averageSleep} · 1 ${spanish.longitudinal.of} 6 ${spanish.longitudinal.days}`],
      ["900 ms", `${spanish.longitudinal.averageRecovery} · 1 ${spanish.longitudinal.of} 6 ${spanish.longitudinal.days}`],
    ]);
    await expectLongitudinalRows([
      [formatLocalDate("es-ES", "2026-01-01"), "3.100", "0 s", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-02"), "4.200", "0 s", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-03"), spanish.activity.unavailable, "0 s", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-04"), spanish.activity.missing, "1 h", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-05"), "5.300", "30 min", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-06"), spanish.activity.missing, "45 min", "7 h 30 min", "900 ms"],
    ]);
    await openDomainWorkspace(spanish, "longitudinal", "comparison");
    await $(".longitudinal-comparison-result button.secondary").click();
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(spanish, "sports");
    await resetSportClassification(spanish, "Carrera de montaña");
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3")).toHaveText(
      spanish.training.sports.unknown.replace("{index}", "1"),
    );
    await saveSportClassification(
      spanish,
      spanish.training.sports.unknown.replace("{index}", "1"),
      "running",
      "Carrera de montaña",
    );
    await openTrainingWorkspace(spanish, "sessions");
    const spanishTrainingDetailButtons = await $$('button[aria-label^="Ver detalles de la sesión del"]');
    expect(spanishTrainingDetailButtons).toHaveLength(3);
    await spanishTrainingDetailButtons[2].click();
    await expect($("#training-session-detail-heading")).toHaveText(
      spanish.training.sessionLibrary.detailHeading,
    );
    const localizedRouteWorkbench = await $(".training-route-workbench");
    await localizedRouteWorkbench.$(".fitfreed-route-track").waitForDisplayed({ timeout: 10_000 });
    await expect(localizedRouteWorkbench.$(
      `aria/${spanish.training.sessionLibrary.routeWorkbench.mapZoomLabel}`,
    )).toHaveText(expect.stringMatching(/^Ampliación del mapa \d+ de \d+$/));
    await expect(localizedRouteWorkbench.$(".training-route-range-inspector h4")).toHaveText(
      spanish.training.sessionLibrary.routeWorkbench.rangeHeading,
    );
    const compactRouteRangeGeometry = await browser.execute(() => {
      const root = document.documentElement;
      const map = document.querySelector(".training-route-map-frame").getBoundingClientRect();
      const inspector = document.querySelector(
        ".training-route-range-inspector",
      ).getBoundingClientRect();
      return {
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
        inspectorTop: inspector.top,
        inspectorWidth: inspector.width,
        mapBottom: map.bottom,
        mapWidth: map.width,
      };
    });
    expect(compactRouteRangeGeometry.hasHorizontalOverflow).toBe(false);
    expect(compactRouteRangeGeometry.inspectorTop)
      .toBeGreaterThanOrEqual(compactRouteRangeGeometry.mapBottom);
    expect(Math.abs(
      compactRouteRangeGeometry.inspectorWidth - compactRouteRangeGeometry.mapWidth,
    )).toBeLessThanOrEqual(2);
    await browser.execute(() => document.querySelector(
      ".training-route-map-frame",
    ).scrollIntoView({ block: "center" }));
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-route-range-es-dark-compact-200.png",
    ));
    await browser.execute(() => document.querySelector(
      ".training-route-range-inspector",
    ).scrollIntoView({ block: "center" }));
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-route-range-es-dark-compact-200-inspector.png",
    ));
    await localizedRouteWorkbench.$(`aria/${
      spanish.training.sessionLibrary.routeWorkbench.adjustRange
    }`).click();
    const localizedRouteRangeEditor = await localizedRouteWorkbench.$(
      ".training-range-editor",
    );
    await localizedRouteRangeEditor.waitForDisplayed();
    expect(await localizedRouteWorkbench.$$(
      '.training-route-range-handles input[type="range"]',
    )).toHaveLength(2);
    await browser.execute(() => {
      document.querySelector(".training-route-range-inspector")
        .scrollIntoView({ block: "start" });
      const navigationHeight = document.querySelector(".app-sidebar")
        .getBoundingClientRect().height;
      window.scrollBy(0, -navigationHeight - 16);
    });
    const compactRouteRangeEditorAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-route-workbench")
      .analyze();
    expect(compactRouteRangeEditorAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-route-range-editor-es-dark-compact-200.png",
    ));
    await browser.execute(() => document.querySelector(
      ".training-route-range-inspector .training-range-editor-actions",
    ).scrollIntoView({ block: "end" }));
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-route-range-editor-actions-es-dark-compact-200.png",
    ));
    await localizedRouteRangeEditor.$(`aria/${
      spanish.training.sessionLibrary.ranges.cancel
    }`).click();
    await openTrainingDetailSection(spanish, "structure");
    await expect($("#training-structure-heading")).toHaveText(
      spanish.training.sessionLibrary.structureHeading,
    );
    const spanishExercise = await $("#training-detail-structure > .training-exercise");
    await expect(spanishExercise.$(".training-exercise-heading")).toHaveText("Ejercicio 1");
    const spanishStructureCollections = await spanishExercise.$$(
      ".training-structure-collection",
    );
    let spanishSourceLapCells = [];
    for (const collection of spanishStructureCollections) {
      if (await collection.$("h5").getText()
        !== spanish.training.sessionLibrary.manualLaps) continue;
      spanishSourceLapCells = await collection.$$(
        "tbody tr:first-child th, tbody tr:first-child td",
      );
      break;
    }
    expect(spanishSourceLapCells).toHaveLength(4);
    await expect(spanishSourceLapCells[3]).toHaveText("5.250 m");
    await openTrainingDetailSection(spanish, "routes");
    await browser.waitUntil(async () => (await $$(".training-route")).length === 2, {
      timeout: 10_000,
      timeoutMsg: "localized recorded routes were not displayed",
    });
    await expect($(".training-route-primary h6")).toHaveText(
      spanish.training.sessionLibrary.primaryRoute,
    );
    await expect($(".training-route-primary .training-route-privacy")).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.routePrivacy),
    );
    await openTrainingDetailSection(spanish, "signals");
    await browser.waitUntil(async () => (await $$(".training-signal")).length === 3, {
      timeout: 10_000,
      timeoutMsg: "localized recorded signals were not displayed",
    });
    await expect($(".training-exercise-signals > h5")).toHaveText(
      spanish.training.sessionLibrary.signalHeading,
    );
    await expect($(".training-signal-primary .training-signal-heading h6")).toHaveText(
      spanish.training.sessionLibrary.signalKinds["heart-rate"],
    );
    const spanishCrossSignal = await $(".training-cross-signal");
    await expect(spanishCrossSignal.$("h6")).toHaveText(
      spanish.training.sessionLibrary.crossSignalHeading,
    );
    await expect(spanishCrossSignal).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.crossSignalMeaning),
    );
    const spanishRangeCopy = spanish.training.sessionLibrary.ranges;
    await openTrainingDetailSection(spanish, "ranges");
    const localizedRanges = await $(".training-ranges");
    await expect(localizedRanges.$("h3")).toHaveText(spanishRangeCopy.heading);
    await expect(localizedRanges.$(".training-range-inspector h4")).toHaveText("Ridge effort");
    await expect(localizedRanges).toHaveText(
      expect.stringContaining(spanishRangeCopy.reviewRequired),
    );
    await expectPersonalRangeGeometry(true);
    await localizedRanges.$(".training-range-workspace > nav button").click();
    await expectDocumentFocus(
      ".training-range-inspector h4",
      "the selected personal range did not receive focus",
    );
    const focusedRangeGeometry = await browser.execute(() => ({
      headingTop: document.querySelector(".training-range-inspector h4")
        .getBoundingClientRect().top,
      navigationBottom: document.querySelector(".app-sidebar").getBoundingClientRect().bottom,
    }));
    expect(focusedRangeGeometry.headingTop)
      .toBeGreaterThanOrEqual(focusedRangeGeometry.navigationBottom - 1);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r8-personal-ranges-es-dark-compact-200.png",
    ));
    await localizedRanges.$(`aria/${spanishRangeCopy.review}`).click();
    await expect(localizedRanges.$(".training-range-locked-coordinate"))
      .toHaveText(spanishRangeCopy.primaryRouteTimeline);
    await localizedRanges.$(`aria/${spanishRangeCopy.confirmReviewed}`).click();
    await waitForNotice(spanishRangeCopy.reviewed);
    await expect(localizedRanges).toHaveText(expect.stringContaining(spanishRangeCopy.current));
    const localizedRangeAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".training-ranges")
      .analyze();
    expect(localizedRangeAccessibility.violations).toEqual([]);
    await openTrainingDetailSection(spanish, "structure");
    const localizedSegmentation = await $(".training-segmentation");
    await expect(localizedSegmentation.$("h4")).toHaveText(
      spanish.training.sessionLibrary.segmentHeading,
    );
    const localizedCriteria = await localizedSegmentation.$$(".training-segment-criterion");
    expect(localizedCriteria).toHaveLength(2);
    await expect(localizedCriteria[0].$("h6")).toHaveText("Race plan");
    await expect(localizedCriteria[0]).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.segmentAuthoredByYou),
    );
    await expect(localizedCriteria[0]).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.segmentCalculatedByFitFreed),
    );
    await expect(localizedCriteria[0]).toHaveText(expect.stringContaining("Evaluación v1"));
    expect(await localizedCriteria[0].$$("tbody tr")).toHaveLength(3);
    await expect(localizedCriteria[1].$("h6")).toHaveText("Quarter-hour blocks");
    expect(await localizedCriteria[1].$$("tbody tr")).toHaveLength(4);
    await openTrainingDetailSection(spanish, "provenance");
    await $('button[aria-controls="training-session-provenance"]').click();
    await browser.waitUntil(
      async () => (await $$(".training-provenance tbody tr")).length > 0,
      { timeout: 10_000, timeoutMsg: "localized session provenance was not displayed" },
    );
    const spanishProvenance = await $(".training-provenance");
    await expect(spanishProvenance.$("h4")).toHaveText(
      spanish.training.sessionLibrary.provenanceHeading,
    );
    await expect(spanishProvenance).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.provenanceProvider),
    );
    await expect(spanishProvenance).toHaveText(expect.stringContaining("Polar Flow"));
    await $('button[aria-controls="training-session-provenance"]').click();
    await openTrainingDetailSection(spanish, "overview");
    const spanishTrainingDetailValues = await $$(`[role="group"][aria-label="${spanish.training.sessionLibrary.summaryMeasurements}"] dl dd`);
    await expect(spanishTrainingDetailValues[5]).toHaveText("10.500 m");
    await expect(spanishTrainingDetailValues[7]).toHaveText("142 ppm");
    await expect(spanishTrainingDetailValues[0]).toHaveText("Carrera de montaña");
    await $(`aria/${spanish.training.sessionLibrary.closeDetail}`).click();
    await openHomeQuestion(
      spanish,
      "review-sleep-patterns",
      ".sleep-insights",
    );
    const spanishSleepDate = formatLocalDate("es-ES", "2026-01-06");
    await expectSleepRows([
      [spanishSleepDate, "7 h 30 min", "93,8%", "82", spanish.sleep.details],
    ]);
    await openDomainWorkspace(spanish, "sleep", "comparison");
    await setSleepComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".sleep-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#sleep-comparison-heading",
      spanish.sleep.comparison.answerUnchanged,
    );
    await openDomainWorkspace(spanish, "sleep", "history");
    await $(`button[aria-label="${spanish.sleep.viewDetails} ${spanishSleepDate}"]`).click();
    await expect($("#sleep-detail-heading")).toHaveText(spanish.sleep.detailHeading);
    const esSleepStart = await formatBrowserSleepLocalDateTime(
      "es-ES",
      "2026-01-05T22:30:00+01:00",
    );
    const spanishSleepDetailValues = await $$(".sleep-detail-metrics dd");
    await expect(spanishSleepDetailValues[0]).toHaveText(esSleepStart);
    await expect(spanishSleepDetailValues[8]).toHaveText("93,8%");
    await expect(spanishSleepDetailValues[11]).toHaveText(spanish.sleep.no);
    await expect($("#sleep-phase-heading")).toHaveText(spanish.sleep.phaseHeading);
    await expect($("#sleep-timeline-heading")).toHaveText(spanish.sleep.timelineHeading);
    await expect($("#sleep-score-heading")).toHaveText(spanish.sleep.scoreHeading);
    await $(`aria/${spanish.sleep.closeDetail}`).click();
    await openDomainWorkspace(spanish, "sleep", "comparison");
    await $(".sleep-comparison-result button.secondary").click();
    await openHomeQuestion(
      spanish,
      "review-recovery-patterns",
      ".recovery-insights",
    );
    const spanishRecoveryDate = formatLocalDate("es-ES", "2026-01-06");
    await expectRecoveryRows([
      [
        spanishRecoveryDate,
        "900 ms",
        "42 ms",
        `${spanish.recovery.overallStatus} 5 / 6`,
        spanish.recovery.details,
      ],
    ]);
    await openDomainWorkspace(spanish, "recovery", "comparison");
    await setRecoveryComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".recovery-comparison button[type='submit']").click();
    await expectComparisonHeading(
      "#recovery-comparison-heading",
      spanish.recovery.comparison.answerUnchanged,
    );
    await openDomainWorkspace(spanish, "recovery", "history");
    await $(`button[aria-label="${spanish.recovery.viewDetails} ${spanishRecoveryDate}"]`).click();
    await expect($("#recovery-detail-heading")).toHaveText(spanish.recovery.detailHeading);
    const spanishRecoveryDetailValues = await $$(".recovery-detail-metrics dd");
    await expect(spanishRecoveryDetailValues[2]).toHaveText("4.100 ms");
    await expect(spanishRecoveryDetailValues[4]).toHaveText("1,5");
    await expect($(".recovery-source-notice")).toHaveText(
      spanish.recovery.sourceNotice,
    );
    const detailHasHorizontalOverflow = await browser.execute(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(detailHasHorizontalOverflow).toBe(false);
    const detailAccessibility = await new AxeBuilder({ client: browser }).setLegacyMode().analyze();
    expect(detailAccessibility.violations).toEqual([]);
    await $(`aria/${spanish.recovery.closeDetail}`).click();
    await openDomainWorkspace(spanish, "recovery", "comparison");
    await $(".recovery-comparison-result button.secondary").click();
    expect(await $$(".recovery-comparison-result")).toHaveLength(0);

    recordJourneyPhase("webdriver-session-and-durable-state");
    await browser.reloadSession();
    await $(".recovery-insights").waitForDisplayed({ timeout: 10_000 });
    await expect($("html")).toHaveAttribute("data-appearance", "dark");
    expect(await browser.execute(
      () => document.documentElement.style.getPropertyValue("--content-zoom"),
    )).toBe("2");
    expect(await $$("#activity-heading, .training-insights, .sleep-insights, .longitudinal-insights")).toHaveLength(0);
    recordJourneyPhase("reimport-report-refresh-and-return");
    await goToHome("sources");
    await expect($("#outcome-heading")).toHaveText(spanish.outcome.changedHeading);
    await openOutcomeDisclosure(".outcome-coverage-detail");
    await expectFamilyCoverage([
      {
        family: spanish.outcome.familyNames["polar-flow-account-data"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["source-subject-claim"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-daily-activity"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "2",
        ...spanish.outcome.coverageExplanations.mapped,
      },
      {
        family: spanish.outcome.familyNames["polar-flow-training-session"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "2",
        ...spanish.outcome.coverageExplanations["mapped-training-evidence"],
      },
    ]);
    await goToHome("explore");
    await $(".recovery-insights").waitForDisplayed({ timeout: 10_000 });
    await expectRecoveryRows([
      [
        formatLocalDate("es-ES", "2026-01-06"),
        "900 ms",
        "42 ms",
        `${spanish.recovery.overallStatus} 5 / 6`,
        spanish.recovery.details,
      ],
    ]);
    await expectRecoverySummary([
      ["1", `${spanish.recovery.observedNights} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      ["900 ms", `${spanish.recovery.averageBeatToBeat} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      ["42 ms", `${spanish.recovery.averageRmssd} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      ["4.100 ms", `${spanish.recovery.averageBreathing} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`, spanish.recovery.assessmentCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`, spanish.recovery.baselineCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nightUnit.one}`, spanish.recovery.guidanceCoverage],
      ["0", spanish.recovery.missingNights],
    ]);
    await returnToLibraryHome(spanish);
    await expectLibraryHome(spanish, { coverageExpanded: true });
    expect(await $$(".library-home-resume")).toHaveLength(0);
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(spanish, "sports");
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3")).toHaveText(
      "Carrera de montaña",
    );
    await openTrainingWorkspace(spanish, "sessions");
    const restoredComparisonCheckboxes = await $$(
      ".training-session-result-actions input[type='checkbox']",
    );
    expect(restoredComparisonCheckboxes).toHaveLength(3);
    await restoredComparisonCheckboxes[0].click();
    await restoredComparisonCheckboxes[1].click();
    await $(`aria/${spanish.training.sessionLibrary.calendar}`).click();
    await expect($(".training-calendar h3")).toHaveText("enero de 2026");
    await $('button[aria-label*="4 de enero de 2026"]').click();
    await expectTrainingRows([[esJan4Card, "1 h", "10,5 km", "600 kcal", "142 ppm"]]);
    const restoredDetailButton = await $(
      'button[aria-label^="Ver detalles de la sesión del"]',
    );
    await restoredDetailButton.click();
    await expect($("#training-session-detail-heading")).toHaveText(
      spanish.training.sessionLibrary.detailHeading,
    );
    await browser.pause(300);
    const persistedTrainingWorkspace = await browser.executeAsync((done) => {
      window.__TAURI__.core.invoke("load_training_discovery_workspace")
        .then((workspace) => done({ workspace, error: null }))
        .catch((error) => done({ workspace: null, error: String(error) }));
    });
    expect(persistedTrainingWorkspace.error).toBeNull();
    expect(persistedTrainingWorkspace.workspace).toEqual(expect.objectContaining({
      view: "calendar",
      calendarMonth: "2026-01",
      calendarDay: "2026-01-04",
      openSessionRef: expect.stringMatching(/^session-[0-9a-f]{64}$/),
      selectedSessionRefs: expect.arrayContaining([
        expect.stringMatching(/^session-[0-9a-f]{64}$/),
        expect.stringMatching(/^session-[0-9a-f]{64}$/),
      ]),
    }));
    await browser.reloadSession();
    await $(".training-insights").waitForDisplayed({ timeout: 10_000 });
    await openTrainingWorkspace(spanish, "sports");
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3")).toHaveText(
      "Carrera de montaña",
    );
    await openTrainingWorkspace(spanish, "sessions");
    const restoredTrainingWorkspace = await browser.executeAsync((done) => {
      window.__TAURI__.core.invoke("load_training_discovery_workspace")
        .then((workspace) => done({ workspace, error: null }))
        .catch((error) => done({ workspace: null, error: String(error) }));
    });
    expect(restoredTrainingWorkspace.error).toBeNull();
    expect(restoredTrainingWorkspace.workspace).toEqual(expect.objectContaining({
      view: "calendar",
      calendarMonth: "2026-01",
      calendarDay: "2026-01-04",
    }));
    const restoredViewControls = await $$(
      ".training-session-view-switch input[type='radio']",
    );
    expect(restoredViewControls).toHaveLength(2);
    await expect(restoredViewControls[1]).toBeChecked();
    await expect($(".training-calendar h3")).toHaveText("enero de 2026");
    await expect($('button[aria-label*="4 de enero de 2026"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect($(".training-session-comparison")).toHaveText(
      expect.stringContaining("2 sesiones seleccionadas"),
    );
    await expect($("#training-session-detail-heading")).toHaveText(
      spanish.training.sessionLibrary.detailHeading,
    );
    await openTrainingDetailSection(spanish, "structure");
    await expect($("#training-structure-heading")).toHaveText(
      spanish.training.sessionLibrary.structureHeading,
    );
    expect(await $$("#training-detail-structure > .training-exercise")).toHaveLength(1);
    expect(await $$(
      "#training-detail-structure > .training-exercise .training-exercise-sport-identity .sport-family-icon",
    )).toHaveLength(1);
    const sessionRestoredSegmentation = await $(".training-segmentation");
    const sessionRestoredCriteria = await sessionRestoredSegmentation.$$(
      ".training-segment-criterion",
    );
    expect(sessionRestoredCriteria).toHaveLength(2);
    await expect(sessionRestoredCriteria[0].$("h6")).toHaveText("Race plan");
    await expect(sessionRestoredCriteria[1].$("h6")).toHaveText("Quarter-hour blocks");
    await openTrainingDetailSection(spanish, "ranges");
    await expect($(".training-range-inspector h4")).toHaveText("Ridge effort");
    await expect($(".training-range-inspector"))
      .toHaveText(expect.stringContaining(spanish.training.sessionLibrary.ranges.current));
    await expect($(`aria/${spanish.training.sessionLibrary.backToCalendar}`)).toBeDisplayed();
    await goToHome("reports");
    await expect($(".reports-hero h1")).toHaveText(spanish.reports.heading);
    const sessionRestoredReports = await $$(".report-list .report-library-open");
    expect(sessionRestoredReports).toHaveLength(3);
    await expect($(`aria/${spanish.reports.library.open.replace(
      "{title}",
      "Synthetic reusable comparison copy",
    )}`)).toBeDisplayed();
    await expect($(`aria/${spanish.reports.library.open.replace(
      "{title}",
      "Synthetic ridge progression",
    )}`)).toBeDisplayed();
    await $(`aria/${spanish.reports.library.open.replace(
      "{title}",
      "Synthetic comparison answer",
    )}`).click();
    await expect($(".report-preview h3")).toHaveText("Synthetic comparison answer");
    expect(await $$(".report-preview .report-narrative")).toHaveLength(0);

    await goToHome("sources");
    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "report-refresh.zip"),
      spanish.choose,
    );
    await $(`aria/${spanish.import}`).click();
    await waitForNotice(spanish.home.postImportChanged);
    await expectLibraryHome(spanish, { coverageExpanded: true });
    expect(await $$(".library-home-resume")).toHaveLength(1);
    await goToHome("reports");
    const reportsAfterRefreshImport = await $$(".report-list .report-library-open");
    expect(reportsAfterRefreshImport).toHaveLength(3);
    await $(`aria/${spanish.reports.library.open.replace(
      "{title}",
      "Synthetic comparison answer",
    )}`).click();
    await expect($(".report-preview h3")).toHaveText("Synthetic comparison answer");
    await expect($(".report-status-stale")).toHaveText(spanish.reports.status.stale);
    await expect($(`aria/${spanish.reports.reviewExport}`)).toBeDisabled();
    await expect($('.report-editor input[maxlength="120"]')).toBeDisabled();
    const refreshAction = await $(`aria/${spanish.reports.refresh.review}`);
    await refreshAction.click();
    const refreshReview = await $(".report-refresh-review");
    await expectDocumentFocus(
      "#report-refresh-heading",
      "opening the evidence review did not focus its heading",
    );
    await expect(refreshReview).toHaveText(
      expect.stringContaining(spanish.reports.refresh.historicalBoundary),
    );
    await expect(refreshReview).toHaveText(
      expect.stringContaining(spanish.reports.refresh.preserved.authorship),
    );
    await expect(refreshReview).toHaveText(
      expect.stringContaining(spanish.reports.refresh.updated.evidence),
    );
    const refreshAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .analyze();
    expect(refreshAccessibility.violations).toEqual([]);
    await expectRevealOutsideApplicationNavigation(".report-refresh-review");
    expect(await browser.execute(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-refresh-review-es-dark-200.png",
    ));
    await refreshReview.$(`aria/${spanish.reports.refresh.keepSaved}`).click();
    expect(await $$(".report-refresh-review")).toHaveLength(0);
    await expectDocumentFocus(
      ".report-stale button",
      "leaving the evidence review did not restore its initiating action",
    );
    await expect($(".report-status-stale")).toHaveText(spanish.reports.status.stale);
    await expect($(`aria/${spanish.reports.reviewExport}`)).toBeDisabled();
    await expect($(`aria/${spanish.reports.workspaces.compose}`)).toBeDisabled();
    await expect($(`aria/${spanish.reports.editComposition}`)).toBeDisabled();

    await refreshAction.click();
    await expectDocumentFocus(
      "#report-refresh-heading",
      "reopening the evidence review did not focus its heading",
    );
    await $(".report-refresh-review").$(`aria/${spanish.reports.refresh.confirm}`).click();
    await waitForNotice(spanish.reports.refresh.completed);
    await expectFocusedStatus(
      spanish.reports.refresh.completed,
      "a completed evidence refresh did not focus its visible outcome",
    );
    await expect($(".report-status-current")).toHaveText(spanish.reports.status.current);
    await expect($(`aria/${spanish.reports.reviewExport}`)).toBeEnabled();
    await openReportWorkspace(spanish, "compose");
    await expect($(".report-revision")).toHaveText(
      spanish.reports.revision.replace("{revision}", "2"),
    );
    await expect($('.report-editor input[maxlength="120"]')).toHaveValue(
      "Synthetic comparison answer",
    );
    expect(await $$(".report-editor textarea")).toHaveLength(0);
    await expect($(`aria/${spanish.reports.commentary.add}`)).toBeDisplayed();
    await expectRevealOutsideApplicationNavigation(".report-commentary-picker");
    const restoredFactualComposeAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(restoredFactualComposeAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-compose-factual-es-dark-200.png",
    ));
    await openReportWorkspace(spanish, "preview");
    await expectRevealOutsideApplicationNavigation(".report-preview");
    const compactReportPreviewGeometry = await browser.execute(() => {
      const root = document.documentElement;
      const preview = document.querySelector(".report-preview").getBoundingClientRect();
      const title = document.querySelector(".report-preview-title").getBoundingClientRect();
      const primaryEvidence = document.querySelector(".report-preview > article")
        .getBoundingClientRect();
      const actions = document.querySelector(".report-preview-actions").getBoundingClientRect();
      return {
        hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
        titleInsidePreview: title.left >= preview.left && title.right <= preview.right,
        evidenceInsidePreview:
          primaryEvidence.left >= preview.left && primaryEvidence.right <= preview.right,
        titleBeforeEvidence: title.bottom <= primaryEvidence.top,
        evidenceBeforeActions: primaryEvidence.bottom <= actions.top,
        resultBeginsInViewport: primaryEvidence.top < window.innerHeight,
      };
    });
    expect(compactReportPreviewGeometry).toEqual({
      hasHorizontalOverflow: false,
      titleInsidePreview: true,
      evidenceInsidePreview: true,
      titleBeforeEvidence: true,
      evidenceBeforeActions: true,
      resultBeginsInViewport: true,
    });
    const compactReportPreviewAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(compactReportPreviewAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-preview-es-dark-200.png",
    ));

    await $(`aria/${spanish.reports.reviewExport}`).click();
    const refreshedPrivacyReview = await $(".report-privacy-review");
    await expectDocumentFocus(
      "#report-privacy-heading",
      "opening the refreshed export review did not focus its heading",
    );
    await expect(refreshedPrivacyReview).toHaveText(
      expect.stringContaining(spanish.reports.analysisExportIncluded),
    );
    await expect(refreshedPrivacyReview).toHaveText(
      expect.stringContaining(spanish.reports.titleIncluded),
    );
    await expect(refreshedPrivacyReview).not.toHaveText(
      expect.stringContaining(spanish.reports.narrativeIncluded),
    );
    await expectRevealOutsideApplicationNavigation(".report-privacy-review");
    expect(await browser.execute(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
    const compactExportReviewAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(compactExportReviewAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "r9-report-export-review-es-dark-200.png",
    ));
    await saveDialogMock.mockReturnValue(refreshedReportOutput);
    await saveDialogMock.update();
    const refreshedSaveCallCount = saveDialogMock.mock.calls.length;
    await refreshedPrivacyReview.$(`aria/${spanish.reports.chooseDestination}`).click();
    await browser.waitUntil(async () => {
      await saveDialogMock.update();
      return saveDialogMock.mock.calls.length === refreshedSaveCallCount + 1;
    }, { timeout: 10_000, timeoutMsg: "refreshed report destination was not requested" });
    await browser.waitUntil(() => fs.existsSync(refreshedReportOutput), {
      timeout: 10_000,
      timeoutMsg: "the refreshed self-contained report was not written",
    });
    await waitForNotice(spanish.reports.exported.split("{")[0].trim());
    await expectFocusedStatus(
      spanish.reports.exported.split("{")[0].trim(),
      "the refreshed export did not focus its visible outcome",
    );
    const refreshedExport = fs.readFileSync(refreshedReportOutput, "utf8");
    expect(refreshedExport).toContain('data-fitfreed-report-version="5"');
    expect(refreshedExport).toContain('data-fitfreed-output-version="8"');
    expect(refreshedExport).toContain("Synthetic comparison answer");
    expect(refreshedExport).not.toContain(
      "The recorded duration decreased; the reason remains my interpretation.",
    );
    expect(refreshedExport).not.toContain("Polar Flow");

    await $(`aria/${spanish.reports.viewSourceComparison}`).click();
    await expectComparisonHeading(
      "#training-comparison-heading",
      spanish.training.comparison.answerLower.replace("{value}", "30 min"),
    );
    const reopenedComparisonInputs = await $$(
      ".training-comparison input[type='date']",
    );
    const reopenedComparisonRanges = [
      "2026-01-04",
      "2026-01-04",
      "2026-01-05",
      "2026-01-05",
    ];
    for (let index = 0; index < reopenedComparisonRanges.length; index += 1) {
      await expect(reopenedComparisonInputs[index]).toHaveValue(reopenedComparisonRanges[index]);
    }
    await $(`aria/${spanish.reports.backToReport}`).click();
    await expect($(".report-preview h3")).toHaveText("Synthetic comparison answer");
    await browser.waitUntil(
      () => browser.execute(
        () => document.activeElement === document.querySelector("#report-preview-heading"),
      ),
      { timeout: 10_000, timeoutMsg: "returning from comparison did not focus the report" },
    );

    await openReportWorkspace(spanish, "library");
    await $(`aria/${spanish.reports.library.open.replace(
      "{title}",
      "Synthetic ridge progression",
    )}`).click();
    await expect($(".report-preview h3")).toHaveText("Synthetic ridge progression");
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(
        "Held the intended effort and finished the final climb with control.",
      ),
    );
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(spanish.reports.analysis.blocks["training-finding"].heading),
    );
    await expect($(".report-status-stale")).toHaveText(spanish.reports.status.stale);
    await expect($(".report-stale")).toHaveText(expect.stringContaining(spanish.reports.stale));
    await expect($(`aria/${spanish.reports.reviewExport}`)).toBeDisabled();
    await $(`aria/${spanish.reports.viewSourceSession}`).click();
    await expect($("#training-session-detail-heading")).toHaveText(
      spanish.training.sessionLibrary.detailHeading,
    );
    await browser.waitUntil(
      () => browser.execute(
        () => document.activeElement === document.querySelector("#training-session-detail-heading"),
      ),
      { timeout: 10_000, timeoutMsg: "opening a report session did not focus its exact detail" },
    );
    await $(`aria/${spanish.reports.backToReport}`).click();
    await expect($(".report-preview h3")).toHaveText("Synthetic ridge progression");

    recordJourneyPhase("planned-training-and-report");
    await goToHome("sources");
    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "planned-training.zip"),
      spanish.choose,
    );
    await $(`aria/${spanish.import}`).click();
    await waitForNotice(spanish.home.postImportChanged);
    await expectLibraryHome(spanish, { coverageExpanded: true });
    await goToHome("sources");
    const plannedImportChanges = await $$(".outcome-change-summary li");
    expect(plannedImportChanges.length).toBeGreaterThan(0);
    await expect(plannedImportChanges[0].$("strong")).toHaveText("2");
    await expect(plannedImportChanges[0].$("span")).toHaveText("observaciones nuevas");
    await openOutcomeDisclosure(".outcome-coverage-detail");
    await expectCoverage([
      ["3", spanish.outcome.supported],
      ["0", spanish.outcome.unsupported],
      ["0", spanish.outcome.ignored],
      ["0", spanish.outcome.unrecognized],
      ["0", spanish.outcome.invalid],
    ]);
    await expectFamilyCoverage([
      {
        family: spanish.outcome.familyNames["polar-flow-account-data"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["source-subject-claim"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-favourite-targets"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["mapped-planned-training"],
      },
      {
        family: spanish.outcome.familyNames["polar-flow-training-target"],
        classification: spanish.outcome.familyClassifications.supported,
        count: "1",
        ...spanish.outcome.coverageExplanations["mapped-planned-training"],
      },
    ]);

    await goToHome("reports");
    await $(".report-example-list").waitForDisplayed({ timeout: 10_000 });
    await $(`aria/${
      spanish.reports.examples.items["structured-training-plan"].action
    }`).click();
    await $(".training-insights").waitForDisplayed({ timeout: 10_000 });
    await expect($(`aria/${spanish.training.workspaces.plans}`))
      .toHaveAttribute("aria-current", "page");
    const plannedCards = await $$(".planned-training-list > li");
    expect(plannedCards).toHaveLength(1);
    await plannedCards[0].$("button").click();
    await expect($("#planned-training-detail-heading")).toHaveText("Progressive intervals");
    await expect($(".planned-training-boundary")).toHaveText(
      spanish.training.planned.intentBoundary,
    );
    await expect($(".planned-training-shape")).toHaveText(
      expect.stringContaining(spanish.training.planned.shape.phasesPasses
        .replace("{phases}", "3")
        .replace("{passes}", "9")),
    );
    const plannedSequencePhases = await $$(".planned-training-sequence > ol > li");
    expect(plannedSequencePhases).toHaveLength(3);
    await expect(plannedSequencePhases[0].$("strong")).toHaveText("Fase 1");
    const exactPlannedPhases = await $(".planned-training-exact-phases");
    expect(await exactPlannedPhases.getAttribute("open")).toBeNull();
    await exactPlannedPhases.$("summary").click();
    expect(await $$(".planned-training-exact-phases > ol > li")).toHaveLength(3);
    await expect(exactPlannedPhases).toHaveText(
      expect.stringContaining("Frecuencia cardíaca · zonas 1–2"),
    );
    await expectRevealOutsideApplicationNavigation(".planned-training-detail");
    expect(await browser.execute(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
    const compactPlannedAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".planned-training")
      .analyze();
    expect(compactPlannedAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "x7-r5-planned-detail-es-dark-200.png",
    ));

    await $(`aria/${spanish.training.planned.openRecordedSession}`).click();
    await expect($("#training-session-detail-heading")).toHaveText(
      spanish.training.sessionLibrary.detailHeading,
    );
    const linkedPlan = await $(".session-planned-training");
    await expect(linkedPlan).toHaveText(expect.stringContaining("Progressive intervals"));
    await expect(linkedPlan).toHaveText(
      expect.stringContaining(spanish.training.planned.sessionRelation.exact),
    );
    await linkedPlan.$(`aria/${spanish.training.planned.sessionRelation.review}`).click();
    await expect($("#planned-training-detail-heading")).toHaveText("Progressive intervals");

    await selectLocale("en-US", "explore");
    await setAppearanceAndZoom("light", 100, true, "explore");
    await resizeApplication(1280, 820);
    await expect($("#planned-training-detail-heading")).toHaveText("Progressive intervals");
    await expect($(".planned-training-boundary")).toHaveText(
      english.training.planned.intentBoundary,
    );
    await expectRevealOutsideApplicationNavigation(".planned-training-detail");
    expect(await browser.execute(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
    const widePlannedAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".planned-training")
      .analyze();
    expect(widePlannedAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "x7-r5-planned-detail-en-light-100.png",
    ));

    await $(`aria/${english.training.planned.createReport}`).click();
    await expect($(".reports-hero h1")).toHaveText(english.reports.heading);
    await expect($('.report-editor input[maxlength="120"]')).toHaveValue(
      "Training plan · Progressive intervals",
    );
    await $(`aria/${english.reports.create}`).click();
    await expect($(".report-preview h3")).toHaveText("Training plan · Progressive intervals");
    await expect($(".report-planned-training")).toHaveText(
      expect.stringContaining("Progressive intervals"),
    );
    await expect($(".report-planned-training .planned-training-boundary")).toHaveText(
      english.training.planned.intentBoundary,
    );
    await $(`aria/${english.reports.reviewExport}`).click();
    const plannedPrivacyReview = await $(".report-privacy-review");
    await expect(plannedPrivacyReview).toHaveText(
      expect.stringContaining(english.reports.plannedTrainingIncluded),
    );
    const plannedExportAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .include(".reports-panel")
      .analyze();
    expect(plannedExportAccessibility.violations).toEqual([]);
    await browser.saveScreenshot(path.join(
      evidenceDirectory,
      "x7-r5-planned-report-review-en-light-100.png",
    ));
    await saveDialogMock.mockReturnValue(plannedReportOutput);
    await saveDialogMock.update();
    const plannedSaveCallCount = saveDialogMock.mock.calls.length;
    await plannedPrivacyReview.$(`aria/${english.reports.chooseDestination}`).click();
    await browser.waitUntil(async () => {
      await saveDialogMock.update();
      return saveDialogMock.mock.calls.length === plannedSaveCallCount + 1;
    }, { timeout: 10_000, timeoutMsg: "planned report destination was not requested" });
    await browser.waitUntil(() => fs.existsSync(plannedReportOutput), {
      timeout: 10_000,
      timeoutMsg: "the planned-training report was not written",
    });
    const plannedExport = fs.readFileSync(plannedReportOutput, "utf8");
    expect(plannedExport).toContain('data-fitfreed-report-version="5"');
    expect(plannedExport).toContain('data-fitfreed-output-version="8"');
    expect(plannedExport).toContain("Training plan · Progressive intervals");
    expect(plannedExport).toContain("Planned training evidence");
    expect(plannedExport).toContain('<th scope="row">1. Phase</th>');
    expect(plannedExport).toContain("Heart-rate zones 1–2");
    expect(plannedExport).toContain("Repeat from phase 2 for 4 total iterations");
    expect(plannedExport).not.toContain("<script");
    expect(plannedExport).not.toContain("http://");
    expect(plannedExport).not.toContain("https://");
    expect(plannedExport).not.toContain("planned-target-");
    await $(`aria/${english.reports.backToPlannedTraining}`).click();
    await expect($("#planned-training-detail-heading")).toHaveText("Progressive intervals");
    await expectElementFocus(
      await $(`aria/${english.training.planned.createReport}`),
      "returning from the planned report did not focus its exact source action",
    );

    await goToHome("sources");
    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "planned-training.zip"),
      english.choose,
    );
    await $(`aria/${english.import}`).click();
    await waitForNotice(english.home.postImportExactRepeat);
    await expectLibraryHome(english, { coverageExpanded: true });
    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(english, "plans");
    expect(await $$(".planned-training-list > li")).toHaveLength(1);
    await $(`aria/${english.training.planned.favorites}`).click();
    expect(await $$(".planned-training-list > li")).toHaveLength(1);
    await expect($(".planned-training-list > li")).toHaveText(
      expect.stringContaining("Reusable tempo template"),
    );

    await selectLocale("es-ES", "explore");
    await setAppearanceAndZoom("dark", 200, true, "explore");
    await resizeApplication(1280, 720);
    await goToHome("home");
    await expectLibraryHome(spanish, { coverageExpanded: true });
    const resumableTraining = await $$(".library-home-resume button");
    expect(resumableTraining).toHaveLength(1);
    await resumableTraining[0].click();
    await $(".training-insights").waitForDisplayed({ timeout: 10_000 });
    await returnToLibraryHome(spanish);
    expect(await $$(".library-home-resume")).toHaveLength(0);
    await browser.reloadSession();
    await expectLibraryHome(spanish, { coverageExpanded: true });
    expect(await $$(".library-home-resume")).toHaveLength(0);
    recordJourneyPhase("prepare-application-process-restart");
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(spanish, "sessions");
    const restartComparisonCheckboxes = await $$(
      ".training-session-result-actions input[type='checkbox']",
    );
    expect(restartComparisonCheckboxes).toHaveLength(3);
    await restartComparisonCheckboxes[0].click();
    await restartComparisonCheckboxes[1].click();
    await $(`aria/${spanish.training.sessionLibrary.calendar}`).click();
    await expect($(".training-calendar h3")).toHaveText("enero de 2026");
    await $('button[aria-label*="4 de enero de 2026"]').click();
    await $('.training-session-results button[aria-label^="Ver detalles de la sesión del"]').click();
    await browser.waitUntil(async () => {
      const persisted = await browser.executeAsync((done) => {
        window.__TAURI__.core.invoke("load_training_discovery_workspace")
          .then((workspace) => done({ workspace, error: null }))
          .catch((error) => done({ workspace: null, error: String(error) }));
      });
      return persisted.error === null
        && persisted.workspace.view === "calendar"
        && persisted.workspace.calendarMonth === "2026-01"
        && persisted.workspace.calendarDay === "2026-01-04"
        && persisted.workspace.openSessionRef !== null
        && persisted.workspace.selectedSessionRefs.length === 2;
    }, {
      timeout: 10_000,
      timeoutMsg: "the process-restart workspace was not durably saved",
    });
    const processRestartWorkspace = await browser.executeAsync((done) => {
      window.__TAURI__.core.invoke("load_training_discovery_workspace")
        .then((workspace) => done({ workspace, error: null }))
        .catch((error) => done({ workspace: null, error: String(error) }));
    });
    expect(processRestartWorkspace.error).toBeNull();
    expect(processRestartWorkspace.workspace).toEqual(expect.objectContaining({
      view: "calendar",
      calendarMonth: "2026-01",
      calendarDay: "2026-01-04",
      openSessionRef: expect.stringMatching(/^session-[0-9a-f]{64}$/),
      selectedSessionRefs: expect.arrayContaining([
        expect.stringMatching(/^session-[0-9a-f]{64}$/),
        expect.stringMatching(/^session-[0-9a-f]{64}$/),
      ]),
    }));
    if (restartIdentityPath !== undefined) {
      expect(recordRestartProcessIdentity(
        restartIdentityPath,
        e2eApplicationBinary,
      )).toBeGreaterThan(0);
    }
    recordJourneyPhase("complete");

  });
});
