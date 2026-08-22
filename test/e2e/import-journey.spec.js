import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/webdriverio";

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

const english = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/en-US.json", import.meta.url), "utf8"),
);
const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);
const fixtureDirectory = process.env.FITFREED_E2E_FIXTURE_DIRECTORY;
const largeArchive = process.env.FITFREED_E2E_LARGE_ARCHIVE;
const reportOutput = path.resolve(".artifacts/e2e/evidence/session-report.html");
const refreshedReportOutput = path.resolve(
  ".artifacts/e2e/evidence/refreshed-comparison-report.html",
);

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

async function expectDocumentFocus(selector, timeoutMsg) {
  await browser.waitUntil(
    () => browser.execute(
      (target) => document.activeElement === document.querySelector(target),
      selector,
    ),
    { timeout: 10_000, timeoutMsg },
  );
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
  const state = await browser.execute(() => {
    const form = document.querySelector(".settings-form").getBoundingClientRect();
    const heading = document.querySelector(".settings-heading").getBoundingClientRect();
    const root = document.documentElement;
    return {
      headingDocumentTop: heading.top + window.scrollY,
      formDocumentTop: form.top + window.scrollY,
      viewportHeight: root.clientHeight,
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
    };
  });
  expect(state.headingDocumentTop).toBeGreaterThanOrEqual(0);
  expect(state.formDocumentTop).toBeGreaterThan(state.headingDocumentTop);
  expect(state.formDocumentTop).toBeLessThan(state.viewportHeight);
  expect(state.hasHorizontalOverflow).toBe(false);
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

async function expectLibraryHome(catalog) {
  await expect($(".library-home h1")).toHaveText(catalog.home.title);
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
  expect(await coverageDisclosure.getAttribute("open")).toBeNull();
  const domainRows = await coverageDisclosure.$$(".library-home-coverage li");
  expect(domainRows).toHaveLength(Object.keys(catalog.home.domains).length);
  expect(await $$("#activity-heading, .training-insights, .sleep-insights, .recovery-insights, .longitudinal-insights")).toHaveLength(0);
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
  }
  await goToHome(destination);
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
  await goToHome(destination);
}

async function setActivityRange(from, through) {
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
  return browser.execute(({ requestedLocale, localDateTime }) => new Intl.DateTimeFormat(
    requestedLocale,
    { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" },
  ).format(new Date(`${localDateTime}Z`)), {
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

async function expectHistory(expectedRows) {
  const historyRows = ".history-grid table tbody tr";
  await browser.waitUntil(async () => (await $$(historyRows)).length === expectedRows.length, {
    timeout: 10_000,
    timeoutMsg: `history did not contain ${expectedRows.length} rows`,
  });
  const rows = await $$(historyRows);
  for (let index = 0; index < expectedRows.length; index += 1) {
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
  await $(`#training-detail-${section}`).waitForDisplayed({ timeout: 10_000 });
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
    await expect(rows[index].$("time")).toHaveText(expectedRows[index][0]);
    const values = await rows[index].$$("dd");
    expect(values).toHaveLength(4);
    await expect(values[0]).toHaveText(expectedRows[index][1]);
    await expect(values[1]).toHaveText(expectedRows[index][2]);
    await expect(values[2]).toHaveText(expectedRows[index][3]);
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
  const items = await $$(".training-history-sports li");
  for (const item of items) {
    if (await item.$("strong").getText() === title) return item;
  }
  throw new Error(`Training history sport was not available: ${title}`);
}

async function saveContextSportClassification(catalog, currentTitle, family, label) {
  const item = await trainingHistorySportItem(currentTitle);
  const action = await item.$("button");
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
  await card.$("button").click();
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
  await card.$("button").click();
  await card.$(`aria/${catalog.training.sports.reset}`).click();
  await browser.waitUntil(
    async () => (await card.getAttribute("data-state")) === "unknown",
    { timeout: 10_000, timeoutMsg: "sport classification did not return to unknown" },
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
  it("covers validation, outcomes, coverage, cancellation, reimport, accessibility, performance, and restart", async () => {
    const journeyStartedAt = Date.now();
    const recordJourneyPhase = (journeyPhase) => process.stdout.write(`${JSON.stringify({
      journeyPhase,
      elapsedMilliseconds: Date.now() - journeyStartedAt,
    })}\n`);
    recordJourneyPhase("shell-and-first-run");
    fs.rmSync(reportOutput, { force: true });
    fs.rmSync(refreshedReportOutput, { force: true });
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
    await expect($(".sources-home h1")).toHaveText("Bring your fitness history home");
    await expect($("aria/Import selected package")).toBeDisabled();
    const openerMock = await browser.tauri.mock("plugin:opener|open_url");
    await expect($("#source-guide-heading")).toHaveText(
      "How to obtain your Polar Flow export",
    );
    await expectSourceGuide(english);
    await expect($("#source-acquisition-guide")).toHaveText(
      expect.stringContaining("available to download for two weeks"),
    );
    await $("aria/Open official account page").click();
    await $("aria/Open official instructions").click();
    await browser.waitUntil(async () => {
      await openerMock.update();
      return openerMock.mock.calls.length === 2;
    }, { timeout: 10_000, timeoutMsg: "official source destinations were not opened" });
    expect(openerMock.mock.calls.map(([arguments_]) => arguments_.url)).toEqual([
      "https://account.polar.com/",
      "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
    ]);
    const sourcesAccessibility = await new AxeBuilder({ client: browser })
      .setLegacyMode()
      .analyze();
    expect(sourcesAccessibility.violations).toEqual([]);

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
    await $("input[name='appearance'][value='dark']").click();
    await expect($(".settings-status")).toHaveText(english.settings.unsaved);
    await $(`aria/${english.settings.discard}`).click();
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
    const spanishOpenerMock = await browser.tauri.mock("plugin:opener|open_url");
    await $("aria/Abrir las instrucciones oficiales").click();
    await browser.waitUntil(async () => {
      await spanishOpenerMock.update();
      return spanishOpenerMock.mock.calls.length === 1;
    }, { timeout: 10_000, timeoutMsg: "localized official source destination was not opened" });
    expect(spanishOpenerMock.mock.calls[0][0].url).toBe(
      "https://support.polar.com/es/how-to-download-all-your-data-from-polar-flow",
    );
    await selectLocale("en-US", "home");
    await expect($(".library-home-empty h1")).toHaveText(english.home.emptyHeading);

    const dialogMock = await browser.tauri.mock("plugin:dialog|open");
    await openArchivePicker(dialogMock, null, english.home.emptyAction);
    await expect($(".path")).toHaveText("No package selected");
    await expect($("aria/Import selected package")).toBeDisabled();

    await selectArchive(dialogMock, largeArchive, english.choose);
    const progressStartedAt = Date.now();
    await $("aria/Import selected package").click();
    await $("#source-active-heading").waitForDisplayed({ timeout: 1_000 });
    expect(Date.now() - progressStartedAt).toBeLessThanOrEqual(1_000);

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

    await selectLocale("en-US", "sources");
    await selectArchive(dialogMock, path.join(fixtureDirectory, "invalid.zip"), english.choose);
    await $("aria/Import selected package").click();
    expect(await $$('[role="alert"]')).toHaveLength(0);
    await expect($("#outcome-heading")).toHaveText(english.outcome.rejectedHeading);
    await openOutcomeDisclosure(".outcome-terminal-detail");
    await expect($(".outcome-terminal-detail")).toHaveText(
      expect.stringContaining("contains recognized data that FitFreed cannot validate"),
    );
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
    await expect($(".library-home-reveal")).toHaveText(
      expect.stringContaining(english.home.postImportChanged),
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
    await expectHistory([
      ["Jan 1, 2026", "3,100", "Step total available"],
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
    ]);
    await expectActivitySummary([
      ["7,300", "Total steps"],
      ["3,650", "Average per day with steps"],
      ["2", "Days with step totals"],
      ["1", "Observed days without a step total"],
      ["0", "Days with no observation"],
    ]);
    const enJan4Start = await formatBrowserTrainingLocalDateTime(
      "en-US",
      "2026-01-04T06:15:00",
    );
    const enJan4Stop = await formatBrowserTrainingLocalDateTime(
      "en-US",
      "2026-01-04T07:15:00",
    );
    const enJan5Start = await formatBrowserTrainingLocalDateTime(
      "en-US",
      "2026-01-05T18:00:00",
    );
    const enJan6Start = await formatBrowserTrainingLocalDateTime(
      "en-US",
      "2026-01-06T07:30:00",
    );
    await openHomeQuestion(
      english,
      "explore-training-sessions",
      ".training-insights",
    );
    const contextualSport = await trainingHistorySportItem("Unknown sport 1");
    const contextualAction = await contextualSport.$("button");
    await contextualAction.click();
    const contextualEditor = await $(".training-history-sport-editor form");
    await contextualEditor.$("input").setValue("Discarded draft");
    await contextualEditor.$(`aria/${english.training.sports.cancel}`).click();
    await browser.waitUntil(
      async () => browser.execute(
        () => document.activeElement
          === document.querySelector(".training-history-sports li[data-state='unknown'] button"),
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
    await goToHome("explore");
    await openTrainingWorkspace(english, "sports");
    expect(await $$(".training-sport-list > li")).toHaveLength(2);
    await expect($(".training-sport-list > li[data-state='classified'] h3")).toHaveText(
      "Trail running",
    );
    await expect($(".training-sport-list > li[data-state='unavailable'] h3")).toHaveText(
      "Sport not recorded",
    );
    await expect($(".training-sport-list > li[data-state='classified']")).toHaveText(
      expect.stringContaining("Named by you"),
    );
    await openTrainingWorkspace(english, "sessions");
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
      [enJan4Start, "1 h", "10,000 m", "600 kcal"],
    ]);
    await expectTrainingSummary([
      ["2 sessions", "Sessions"],
      ["2 training days", "Training days"],
      ["1 h 30 min", "Total duration"],
      ["10,000 m", "Recorded distance · 1 of 2"],
      ["600 kcal", "Recorded energy · 1 of 2"],
      ["1 of 2", "Sessions with heart rate"],
    ]);
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
    await expectTrainingRows([[enJan4Start, "1 h", "10,000 m", "600 kcal"]]);
    const appliedTrainingQuery = await $(".training-session-applied-query");
    await expect(appliedTrainingQuery).toHaveText(expect.stringContaining("Sport: Trail running"));
    await expect(appliedTrainingQuery).toHaveText(expect.stringContaining(
      "Recorded measurement: Heart rate",
    ));
    await expect(appliedTrainingQuery).toHaveText(expect.stringContaining("Order: Farthest first"));
    await $('button[aria-label="Remove Sport: Trail running"]').click();
    await expect(appliedTrainingQuery).not.toHaveText(expect.stringContaining("Sport: Trail running"));
    await expectTrainingRows([[enJan4Start, "1 h", "10,000 m", "600 kcal"]]);
    await $(".training-session-applied-query > header button.secondary").click();
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
      [enJan4Start, "1 h", "10,000 m", "600 kcal"],
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
    await expectTrainingRows([[enJan4Start, "1 h", "10,000 m", "600 kcal"]]);
    await $(".training-session-results button.secondary").click();
    await expect($("#training-session-detail-heading")).toHaveText("Session summary");
    await openTrainingDetailSection(english, "structure");
    await expect($("#training-structure-heading")).toHaveText(
      english.training.sessionLibrary.structureHeading,
    );
    const recordedExercises = await $$("#training-detail-structure > .training-exercise");
    expect(recordedExercises).toHaveLength(1);
    await expect(recordedExercises[0].$("header h5")).toHaveText("Exercise 1");
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
    await expect(recordedSignals[0].$("svg")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("100 recorded values out of 101 samples"),
    );
    expect(await recordedSignals[0].$$("polyline")).toHaveLength(2);
    const crossSignal = await $(".training-cross-signal");
    await expect(crossSignal.$("h6")).toHaveText(
      english.training.sessionLibrary.crossSignalHeading,
    );
    await expect(crossSignal).toHaveText(
      expect.stringContaining(english.training.sessionLibrary.crossSignalPrimaryIntro),
    );
    const crossSignalChoices = await crossSignal.$$('input[type="checkbox"]');
    expect(crossSignalChoices).toHaveLength(2);
    expect(await crossSignal.$$("svg")).toHaveLength(2);
    expect(await crossSignal.$$("article:first-child polyline")).toHaveLength(2);
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
    await expect($(".training-signal-unsupported")).toHaveText(
      expect.stringContaining("1 unsupported source series"),
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
    await expect($(".training-zone-unsupported")).toHaveText(
      expect.stringContaining("1 unsupported source zone group"),
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
    await expect(provenance).toHaveText(expect.stringContaining("polar-flow-archive@11"));
    await expect(provenance).toHaveText(
      expect.stringContaining("polar-flow-training-session@6"),
    );
    await expect(provenance).not.toHaveText(expect.stringContaining("training-session_"));
    await $('button[aria-controls="training-session-provenance"]').click();
    expect(await $$(".training-provenance")).toHaveLength(0);
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
    await $(`aria/${english.training.sessionLibrary.createReport}`).click();
    await expect($(".reports-hero h1")).toHaveText(english.reports.heading);
    const reportTitle = await $('.report-editor input[maxlength="120"]');
    await reportTitle.clearValue();
    await reportTitle.setValue("Synthetic ridge progression");
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
    await openReportWorkspace(english, "library");
    expect(await $$(".report-list > li")).toHaveLength(1);
    await openReportWorkspace(english, "preview");

    const reviewExport = await $(`aria/${english.reports.reviewExport}`);
    await reviewExport.click();
    let privacyReview = await $(".report-privacy-review");
    await expectDocumentFocus(
      "#report-privacy-heading",
      "opening the export review did not focus its heading",
    );
    await privacyReview.$(`aria/${english.reports.closeReview}`).click();
    await expectDocumentFocus(
      ".report-preview-actions button:last-child",
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
      expect.stringContaining(english.reports.analysisExportIncluded),
    );
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
    expect(exportedReport).toContain('data-fitfreed-report-version="4"');
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
    await expectDocumentFocus(
      ".report-preview-actions button:last-child",
      "leaving the cancelled export review did not restore its initiating action",
    );
    await $(`aria/${english.reports.backToSession}`).click();
    await expect($("#training-session-detail-heading")).toHaveText("Session summary");
    await $("aria/Back to calendar").click();
    await $("aria/Chronology").click();
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
      [enJan4Start, "1 h", "10,000 m", "600 kcal"],
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
      ["1", "Observed nights · 1 of 1 nights"],
      ["7 h 30 min", "Average time asleep · 1 of 1 nights"],
      ["93.8%", "Average efficiency · 1 of 1 nights"],
      ["82", "Average sleep score · 1 of 1 nights"],
      ["0 / 1", "Sleep goal met"],
      ["1 of 1 nights", "Nights with sleep phases"],
      ["1 of 1 nights", "Nights with a stage timeline"],
      ["1 of 1 nights", "Nights with recording status · 0 ended after power loss"],
    ]);
    await openHomeQuestion(
      english,
      "review-recovery-patterns",
      ".recovery-insights",
    );
    await expectRecoveryRows([
      ["Jan 6, 2026", "900 ms", "42 ms", "Overall status 5 / 6", "Details"],
    ]);
    await expectRecoverySummary([
      ["1", "Observed nights · 1 of 1 nights"],
      ["900 ms", "Average beat-to-beat interval · 1 of 1 nights"],
      ["42 ms", "Average HRV RMSSD · 1 of 1 nights"],
      ["4,100 ms", "Average breathing interval · 1 of 1 nights"],
      ["1 of 1 nights", "Nights with source assessment"],
      ["1 of 1 nights", "Nights with source baseline"],
      ["1 of 1 nights", "Nights with source guidance"],
      ["0", "Missing nights"],
    ]);
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
      ["Jan 1, 2026", "3,100", "0 ms", "Missing", "Missing"],
      ["Jan 2, 2026", "4,200", "0 ms", "Missing", "Missing"],
      ["Jan 3, 2026", "Observation available; step total unavailable", "0 ms", "Missing", "Missing"],
      ["Jan 4, 2026", "No observation", "1 h", "Missing", "Missing"],
      ["Jan 5, 2026", "No observation", "30 min", "Missing", "Missing"],
      ["Jan 6, 2026", "No observation", "0 ms", "7 h 30 min", "900 ms"],
    ]);
    await $('button[aria-label="View aligned details for Jan 6, 2026"]').click();
    await expect($("#longitudinal-detail-heading")).toHaveText("Aligned day detail");
    const longitudinalDetailValues = await $$(".longitudinal-detail-grid dd");
    const expectedLongitudinalDetail = [
      "No observation",
      "Not available",
      "0",
      "0 ms",
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
    await expectTrainingRows([[enJan4Start, "1 h", "10,000 m", "600 kcal"]]);
    await $(".training-session-search button.secondary").click();
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
      [enJan4Start, "1 h", "10,000 m", "600 kcal"],
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
    await selectLocale("es-ES");
    await setAppearanceAndZoom("dark", 200, true);
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
    await expectLibraryHome(spanish);
    const esJan4Start = await formatBrowserTrainingLocalDateTime(
      "es-ES",
      "2026-01-04T06:15:00",
    );
    const esJan5Start = await formatBrowserTrainingLocalDateTime(
      "es-ES",
      "2026-01-05T18:00:00",
    );
    const esJan6Start = await formatBrowserTrainingLocalDateTime(
      "es-ES",
      "2026-01-06T07:30:00",
    );
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(spanish, "sports");
    await expect($(".training-sport-list > li[data-state='classified'] h3")).toHaveText(
      "Trail running",
    );
    await expect($(".training-sport-list > li[data-state='classified']")).toHaveText(
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
      [
        esJan5Start,
        "30 min",
        spanish.training.sessionLibrary.metricUnavailable,
        spanish.training.sessionLibrary.metricUnavailable,
      ],
      [esJan4Start, "1 h", "10.000 m", "600 kcal"],
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
      ["1", `${spanish.sleep.observedNights} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nights}`],
      ["7 h 30 min", `${spanish.sleep.averageAsleep} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nights}`],
      ["93,8%", `${spanish.sleep.averageEfficiency} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nights}`],
      ["82", `${spanish.sleep.averageScore} · 1 ${spanish.sleep.of} 1 ${spanish.sleep.nights}`],
      ["0 / 1", spanish.sleep.goalMet],
      [`1 ${spanish.sleep.of} 1 ${spanish.sleep.nights}`, spanish.sleep.phaseCoverage],
      [`1 ${spanish.sleep.of} 1 ${spanish.sleep.nights}`, spanish.sleep.timelineCoverage],
      [`1 ${spanish.sleep.of} 1 ${spanish.sleep.nights}`, `${spanish.sleep.powerCoverage} · 0 ${spanish.sleep.powerLoss}`],
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
      ["1", `${spanish.recovery.observedNights} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      ["900 ms", `${spanish.recovery.averageBeatToBeat} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      ["42 ms", `${spanish.recovery.averageRmssd} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      ["4100 ms", `${spanish.recovery.averageBreathing} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`, spanish.recovery.assessmentCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`, spanish.recovery.baselineCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`, spanish.recovery.guidanceCoverage],
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
          ".recovery-history-grid",
          ".recovery-history-grid figure",
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
    await expectLibraryHome(english);
    await expect($(".library-home-reveal")).toHaveText(
      expect.stringContaining(english.home.postImportExactRepeat),
    );
    await openHomeQuestion(
      english,
      "review-activity-steps",
      "#activity-heading",
    );
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
    await expect($(".training-sport-list > li[data-state='classified'] h3")).toHaveText(
      "Carrera de montaña",
    );
    await openTrainingWorkspace(english, "sessions");
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
      [enJan4Start, "1 h", "10,000 m", "600 kcal"],
    ]);

    await goToHome("sources");
    await selectArchive(dialogMock, path.join(fixtureDirectory, "overlap.zip"), english.choose);
    await $("aria/Import selected package").click();
    await waitForNotice(english.home.postImportChanged);
    await expectLibraryHome(english);
    await expect($(".library-home-reveal")).toHaveText(
      expect.stringContaining(english.home.postImportChanged),
    );
    await openHomeQuestion(
      english,
      "review-activity-steps",
      "#activity-heading",
    );
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
    await expect($(".training-sport-list > li[data-state='classified'] h3")).toHaveText(
      "Carrera de montaña",
    );
    await openTrainingWorkspace(english, "sessions");
    await expectTrainingRows([
      [enJan6Start, "45 min", "5,000 m", "300 kcal"],
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
      [enJan4Start, "1 h", "10,500 m", "600 kcal"],
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
      ["Jan 1, 2026", "3,100", "0 ms", "Missing", "Missing"],
      ["Jan 2, 2026", "4,200", "0 ms", "Missing", "Missing"],
      ["Jan 3, 2026", "Observation available; step total unavailable", "0 ms", "Missing", "Missing"],
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
    const trainingDetailValues = await $$(`dl[aria-label="${english.training.sessionLibrary.summaryMeasurements}"] dd`);
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
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
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
    const unavailableTrainingDetail = await $$(`dl[aria-label="${english.training.sessionLibrary.summaryMeasurements}"] dd`);
    await expect(unavailableTrainingDetail[5]).toHaveText("Not recorded");
    await expect(unavailableTrainingDetail[0]).toHaveText("Sport not recorded");
    await expect(unavailableTrainingDetail[9]).toHaveText("0");
    await $("aria/Back to session results").click();

    await setTrainingRange("2026-01-06", "2026-01-05");
    await $(".training-session-search button[type='submit']").click();
    await expect($("[role='alert']")).toHaveText(
      "Choose an ordered training-session date range and a personal sport name of up to 80 characters.",
    );
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
    ]);

    await $(".training-session-search button.secondary").click();
    await expectTrainingRows([
      [enJan6Start, "45 min", "5,000 m", "300 kcal"],
      [enJan5Start, "30 min", "Not recorded", "Not recorded"],
      [enJan4Start, "1 h", "10,500 m", "600 kcal"],
    ]);
    const completeTrainingDetailButtons = await $$(
      'button[aria-label^="View session details for"]',
    );
    await completeTrainingDetailButtons[0].click();
    await openTrainingDetailSection(english, "structure");
    const mixedSportExercises = await $$("#training-detail-structure > .training-exercise");
    expect(mixedSportExercises).toHaveLength(2);
    await expect(mixedSportExercises[0].$("header h5")).toHaveText("Exercise 1");
    await expect(mixedSportExercises[1].$("header h5")).toHaveText("Exercise 2");
    await expect(mixedSportExercises[1].$("header span")).toHaveText("Unknown sport 1");
    await $("aria/Back to session results").click();

    await openTrainingWorkspace(english, "comparison");
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
    await $(".report-editor textarea").setValue(
      "The recorded duration decreased; the reason remains my interpretation.",
    );
    await $('.report-editor button[type="submit"]').click();
    await waitForNotice(english.reports.saved);
    await expect($(".report-preview h3")).toHaveText("Synthetic comparison answer");
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(
        "The recorded duration decreased; the reason remains my interpretation.",
      ),
    );
    await expect($(".report-preview")).not.toHaveText(expect.stringContaining("Polar Flow"));
    expect(await $$(".report-list > li")).toHaveLength(2);
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
      ["Average time asleep", "7 h 30 min", "7 h 30 min", "0 ms"],
      ["Average interruption time", "30 min", "30 min", "0 ms"],
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
      ["Jan 1, 2026", "3,100", "0 ms", "Missing", "Missing"],
      ["Jan 2, 2026", "4,200", "0 ms", "Missing", "Missing"],
      ["Jan 3, 2026", "Observation available; step total unavailable", "0 ms", "Missing", "Missing"],
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
      ["Training duration", "45 min", "45 min", "0 ms"],
      ["Average asleep duration", "7 h 30 min", "7 h 30 min", "0 ms"],
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
      spanish.activity.comparison.answerHigher.replace("{value}", "1100"),
    );
    await expectResultBelowCompactNavigation("#activity-comparison-heading");
    await openDomainWorkspace(spanish, "activity", "history");
    await expectHistory([
      [formatLocalDate("es-ES", "2026-01-01"), "3100", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-02"), "4200", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-03"), spanish.unavailable, spanish.activity.unavailable],
      [formatLocalDate("es-ES", "2026-01-04"), spanish.unavailable, spanish.activity.missing],
      [formatLocalDate("es-ES", "2026-01-05"), "5300", spanish.activity.available],
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
      spanish.activity.comparison.answerHigher.replace("{value}", "1650"),
    );
    await $(".activity-comparison-result button.secondary").click();
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await expectTrainingRows([
      [esJan6Start, "45 min", "5000 m", "300 kcal"],
      [
        esJan5Start,
        "30 min",
        spanish.training.sessionLibrary.metricUnavailable,
        spanish.training.sessionLibrary.metricUnavailable,
      ],
      [esJan4Start, "1 h", "10.500 m", "600 kcal"],
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
      [formatLocalDate("es-ES", "2026-01-01"), "3100", "0 ms", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-02"), "4200", "0 ms", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-03"), spanish.activity.unavailable, "0 ms", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-04"), spanish.activity.missing, "1 h", spanish.longitudinal.missing, spanish.longitudinal.missing],
      [formatLocalDate("es-ES", "2026-01-05"), "5300", "30 min", spanish.longitudinal.missing, spanish.longitudinal.missing],
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
    await expect($(".training-sport-list > li[data-state='unknown'] h3")).toHaveText(
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
    await openTrainingDetailSection(spanish, "structure");
    await expect($("#training-structure-heading")).toHaveText(
      spanish.training.sessionLibrary.structureHeading,
    );
    const spanishExercise = await $("#training-detail-structure > .training-exercise");
    await expect(spanishExercise.$("header h5")).toHaveText("Ejercicio 1");
    const spanishSourceLapCells = await spanishExercise.$$(
      ".training-structure-collection:first-of-type tbody tr:first-child th, .training-structure-collection:first-of-type tbody tr:first-child td",
    );
    expect(spanishSourceLapCells).toHaveLength(4);
    await expect(spanishSourceLapCells[3]).toHaveText("5250 m");
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
    const spanishTrainingDetailValues = await $$(`dl[aria-label="${spanish.training.sessionLibrary.summaryMeasurements}"] dd`);
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
    await expect(spanishRecoveryDetailValues[2]).toHaveText("4100 ms");
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

    recordJourneyPhase("restart-and-durable-state");
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
      ["1", `${spanish.recovery.observedNights} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      ["900 ms", `${spanish.recovery.averageBeatToBeat} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      ["42 ms", `${spanish.recovery.averageRmssd} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      ["4100 ms", `${spanish.recovery.averageBreathing} · 1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`, spanish.recovery.assessmentCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`, spanish.recovery.baselineCoverage],
      [`1 ${spanish.recovery.of} 1 ${spanish.recovery.nights}`, spanish.recovery.guidanceCoverage],
      ["0", spanish.recovery.missingNights],
    ]);
    await returnToLibraryHome(spanish);
    await expectLibraryHome(spanish);
    expect(await $$(".library-home-resume")).toHaveLength(0);
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace(spanish, "sports");
    await expect($(".training-sport-list > li[data-state='classified'] h3")).toHaveText(
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
    await expectTrainingRows([[esJan4Start, "1 h", "10.500 m", "600 kcal"]]);
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
    await expect($(".training-sport-list > li[data-state='classified'] h3")).toHaveText(
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
    const restartedSegmentation = await $(".training-segmentation");
    const restartedCriteria = await restartedSegmentation.$$(".training-segment-criterion");
    expect(restartedCriteria).toHaveLength(2);
    await expect(restartedCriteria[0].$("h6")).toHaveText("Race plan");
    await expect(restartedCriteria[1].$("h6")).toHaveText("Quarter-hour blocks");
    await expect($(`aria/${spanish.training.sessionLibrary.backToCalendar}`)).toBeDisplayed();
    await goToHome("reports");
    await expect($(".reports-hero h1")).toHaveText(spanish.reports.heading);
    const restartedReports = await $$(".report-list button");
    expect(restartedReports).toHaveLength(2);
    await expect(restartedReports[0]).toHaveText(
      expect.stringContaining("Synthetic comparison answer"),
    );
    await expect(restartedReports[1]).toHaveText(
      expect.stringContaining("Synthetic ridge progression"),
    );
    await restartedReports[0].click();
    await expect($(".report-preview h3")).toHaveText("Synthetic comparison answer");
    await expect($(".report-preview")).toHaveText(
      expect.stringContaining(
        "The recorded duration decreased; the reason remains my interpretation.",
      ),
    );

    await goToHome("sources");
    await selectArchive(
      dialogMock,
      path.join(fixtureDirectory, "report-refresh.zip"),
      spanish.choose,
    );
    await $(`aria/${spanish.import}`).click();
    await waitForNotice(spanish.home.postImportChanged);
    await expectLibraryHome(spanish);
    expect(await $$(".library-home-resume")).toHaveLength(1);
    await goToHome("reports");
    const reportsAfterRefreshImport = await $$(".report-list button");
    expect(reportsAfterRefreshImport).toHaveLength(2);
    await reportsAfterRefreshImport[0].click();
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
    await refreshReview.$(`aria/${spanish.reports.refresh.keepSaved}`).click();
    expect(await $$(".report-refresh-review")).toHaveLength(0);
    await expectDocumentFocus(
      ".report-stale button",
      "leaving the evidence review did not restore its initiating action",
    );
    await expect($(".report-status-stale")).toHaveText(spanish.reports.status.stale);
    await expect($(`aria/${spanish.reports.reviewExport}`)).toBeDisabled();

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
    await expect($(".report-editor textarea")).toHaveValue(
      "The recorded duration decreased; the reason remains my interpretation.",
    );
    await openReportWorkspace(spanish, "preview");

    await $(`aria/${spanish.reports.reviewExport}`).click();
    const refreshedPrivacyReview = await $(".report-privacy-review");
    await expectDocumentFocus(
      "#report-privacy-heading",
      "opening the refreshed export review did not focus its heading",
    );
    await expect(refreshedPrivacyReview).toHaveText(
      expect.stringContaining(spanish.reports.analysisExportIncluded),
    );
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
    expect(refreshedExport).toContain('data-fitfreed-report-version="4"');
    expect(refreshedExport).toContain("Synthetic comparison answer");
    expect(refreshedExport).toContain(
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
    await (await $$(".report-list button"))[1].click();
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
    await goToHome("home");
    await expectLibraryHome(spanish);
    const resumableTraining = await $$(".library-home-resume button");
    expect(resumableTraining).toHaveLength(1);
    await resumableTraining[0].click();
    await $(".training-insights").waitForDisplayed({ timeout: 10_000 });
    await returnToLibraryHome(spanish);
    expect(await $$(".library-home-resume")).toHaveLength(0);
    await browser.reloadSession();
    await expectLibraryHome(spanish);
    expect(await $$(".library-home-resume")).toHaveLength(0);
    recordJourneyPhase("complete");

  });
});
