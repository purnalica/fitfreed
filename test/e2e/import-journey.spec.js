import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/webdriverio";

import { runInsightsPerformanceJourney } from "./support/insights-performance.js";

const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);
const fixtureDirectory = process.env.FITFREED_E2E_FIXTURE_DIRECTORY;
const largeArchive = process.env.FITFREED_E2E_LARGE_ARCHIVE;
const insightsPerformanceArchive = process.env.FITFREED_E2E_INSIGHTS_PERFORMANCE_ARCHIVE;

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

async function openArchivePicker(dialogMock, selectedPath) {
  await dialogMock.mockReturnValue(selectedPath);
  await dialogMock.update();
  const expectedCallCount = dialogMock.mock.calls.length + 1;
  await $("aria/Choose ZIP package").click();
  await browser.waitUntil(
    async () => {
      await dialogMock.update();
      return dialogMock.mock.calls.length >= expectedCallCount;
    },
    { timeout: 10_000, timeoutMsg: "archive picker was not invoked" },
  );
  expect(dialogMock.mock.calls[expectedCallCount - 1][0]).toEqual({
    options: {
      multiple: false,
      directory: false,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    },
  });
}

async function selectArchive(dialogMock, archivePath) {
  await openArchivePicker(dialogMock, archivePath);
  await expect($(".path")).toHaveText(archivePath);
}

async function selectLocale(locale) {
  await $("select").waitForEnabled({ timeout: 10_000 });
  await browser.execute((nextLocale) => {
    const select = document.querySelector("select");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    ).set;
    setValue.call(select, nextLocale);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, locale);
  await expect($("select")).toHaveValue(locale);
}

async function setActivityRange(from, through) {
  await browser.execute((values) => {
    const inputs = document.querySelectorAll("input[type='date']");
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
  const inputs = await $$("input[type='date']");
  await expect(inputs[0]).toHaveValue(from);
  await expect(inputs[1]).toHaveValue(through);
}

async function setComparisonRanges(baselineFrom, baselineThrough, comparisonFrom, comparisonThrough) {
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
  const values = [from, through];
  await browser.execute((nextValues) => {
    const inputs = document.querySelectorAll(".training-filter input[type='date']");
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
  const inputs = await $$(".training-filter input[type='date']");
  expect(inputs).toHaveLength(2);
  for (let index = 0; index < values.length; index += 1) {
    await expect(inputs[index]).toHaveValue(values[index]);
  }
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

async function expectTrainingRows(expectedRows) {
  const selector = ".training-history-grid table tbody tr";
  await browser.waitUntil(async () => (await $$(selector)).length === expectedRows.length, {
    timeout: 10_000,
    timeoutMsg: `training history did not contain ${expectedRows.length} rows`,
  });
  const rows = await $$(selector);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function expectTrainingSummary(expectedItems) {
  const items = await $$(".training-summary li");
  expect(items).toHaveLength(expectedItems.length);
  for (let index = 0; index < expectedItems.length; index += 1) {
    await expect(items[index].$("strong")).toHaveText(expectedItems[index][0]);
    await expect(items[index].$("span")).toHaveText(expectedItems[index][1]);
  }
}

async function expectTrainingComparison(expectedRows) {
  const rows = await $$(".training-comparison-result table tbody tr");
  expect(rows).toHaveLength(expectedRows.length);
  for (let index = 0; index < expectedRows.length; index += 1) {
    const cells = await rows[index].$$("th, td");
    for (let cellIndex = 0; cellIndex < expectedRows[index].length; cellIndex += 1) {
      await expect(cells[cellIndex]).toHaveText(expectedRows[index][cellIndex]);
    }
  }
}

async function setSleepRange(from, through) {
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
  const selector = ".sleep-history-grid table tbody tr";
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
  const selector = ".recovery-history-grid table tbody tr";
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
  const rows = await $$(".recovery-comparison-result table tbody tr");
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

describe("packaged FitFreed import journey", () => {
  it("covers validation, outcomes, coverage, cancellation, reimport, accessibility, performance, and restart", async () => {
    await expect($("h1")).toHaveText("Your fitness history belongs to you");
    await expect($("aria/Import selected package")).toBeDisabled();
    await expect($(".recovery-insights")).toHaveText(
      expect.stringContaining("No imported nightly recovery summaries yet."),
    );

    await selectLocale("es-ES");
    await expect($("h1")).toHaveText(spanish.title);
    await selectLocale("en-US");
    await expect($("h1")).toHaveText("Your fitness history belongs to you");

    const dialogMock = await browser.tauri.mock("plugin:dialog|open");
    await openArchivePicker(dialogMock, null);
    await expect($(".path")).toHaveText("No package selected");
    await expect($("aria/Import selected package")).toBeDisabled();

    await selectArchive(dialogMock, largeArchive);
    const progressStartedAt = Date.now();
    await $("aria/Import selected package").click();
    await $("#progress-heading").waitForDisplayed({ timeout: 1_000 });
    expect(Date.now() - progressStartedAt).toBeLessThanOrEqual(1_000);

    await selectLocale("es-ES");
    await expect($("h1")).toHaveText(spanish.title);
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
    await waitForNotice(spanish.phases.cancelled, 5_000);
    await $("button.primary").waitForEnabled({ timeout: 5_000 });
    expect(Date.now() - cancellationStartedAt).toBeLessThanOrEqual(5_000);
    expect(await $$(".history-grid table tbody tr")).toHaveLength(0);

    await selectLocale("en-US");
    await selectArchive(dialogMock, path.join(fixtureDirectory, "invalid.zip"));
    await $("aria/Import selected package").click();
    const alert = await $("[role='alert']");
    await alert.waitForDisplayed();
    await expect(alert).toHaveText(
      expect.stringContaining("contains recognized data that FitFreed cannot validate"),
    );
    await expect($("#outcome-heading")).toHaveText("Latest import outcome");
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

    await selectArchive(dialogMock, path.join(fixtureDirectory, "valid.zip"));
    await $("aria/Import selected package").click();
    await waitForNotice("Import completed: 9 recognized, 7 new");
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
        reason: "The session summary is mapped; routes and full-resolution details stay only in the original ZIP.",
        action: "Keep the original ZIP if you need the excluded training details.",
      },
    ]);
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
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not available", "Not available"],
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

    await selectLocale("es-ES");
    await expect($("#outcome-heading")).toHaveText(spanish.outcome.heading);
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
        ...spanish.outcome.coverageExplanations["mapped-summary"],
      },
    ]);
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
    await expectTrainingRows([
      [esJan5Start, "30 min", spanish.unavailable, spanish.unavailable],
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
    await browser.execute(() => {
      document.documentElement.style.fontSize = "200%";
    });
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
    await browser.execute(() => {
      document.documentElement.style.fontSize = "";
    });
    await selectLocale("en-US");

    const accessibility = await new AxeBuilder({ client: browser }).setLegacyMode().analyze();
    expect(accessibility.violations).toEqual([]);

    await $("aria/Import selected package").click();
    await waitForNotice("Exact package repeat; history was not duplicated.");
    await expectHistory([
      ["Jan 1, 2026", "3,100", "Step total available"],
      ["Jan 2, 2026", "4,200", "Step total available"],
      ["Jan 3, 2026", "Not available", "Observation available; step total unavailable"],
    ]);
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not available", "Not available"],
      [enJan4Start, "1 h", "10,000 m", "600 kcal"],
    ]);

    await selectArchive(dialogMock, path.join(fixtureDirectory, "overlap.zip"));
    await $("aria/Import selected package").click();
    await waitForNotice(
      "Import completed: 5 recognized, 2 new, 0 enriched, 1 amended, 1 equivalent",
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
    await expectTrainingRows([
      [enJan6Start, "45 min", "5,000 m", "300 kcal"],
      [enJan5Start, "30 min", "Not available", "Not available"],
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

    await setComparisonRanges("2026-01-01", "2026-01-02", "2026-01-04", "2026-01-05");
    await $("aria/Compare periods").click();
    await expect($("#activity-comparison-heading")).toHaveText("Period comparison");
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

    const trainingDetailButtons = await $$('button[aria-label^="View training details for"]');
    expect(trainingDetailButtons).toHaveLength(3);
    await trainingDetailButtons[2].click();
    await expect($("#training-detail-heading")).toHaveText("Training detail");
    const trainingDetailValues = await $$(".training-detail dd");
    const expectedTrainingDetail = [
      enJan4Start,
      enJan4Stop,
      "UTC+01:00",
      "1 h",
      "10,500 m",
      "600 kcal",
      "142 bpm",
      "171 bpm",
      "Recorded training type",
      "1",
    ];
    expect(trainingDetailValues).toHaveLength(expectedTrainingDetail.length);
    for (let index = 0; index < expectedTrainingDetail.length; index += 1) {
      await expect(trainingDetailValues[index]).toHaveText(expectedTrainingDetail[index]);
    }
    await $("aria/Close training detail").click();
    expect(await $$(".training-detail")).toHaveLength(0);

    await setTrainingRange("2026-01-05", "2026-01-05");
    await $(".training-filter button[type='submit']").click();
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not available", "Not available"],
    ]);
    await expectTrainingSummary([
      ["1 session", "Sessions"],
      ["1 training day", "Training days"],
      ["30 min", "Total duration"],
      ["Not available", "Recorded distance · 0 of 1"],
      ["Not available", "Recorded energy · 0 of 1"],
      ["0 of 1", "Sessions with heart rate"],
    ]);
    await $('button[aria-label^="View training details for"]').click();
    const unavailableTrainingDetail = await $$(".training-detail dd");
    await expect(unavailableTrainingDetail[4]).toHaveText("Not available");
    await expect(unavailableTrainingDetail[8]).toHaveText("Training type not available");
    await expect(unavailableTrainingDetail[9]).toHaveText("0");
    await $("aria/Close training detail").click();

    await setTrainingRange("2026-01-06", "2026-01-05");
    await $(".training-filter button[type='submit']").click();
    await expect($("[role='alert']")).toHaveText(
      "Choose an ordered training range inside the available history, up to 366 days.",
    );
    await expectTrainingRows([
      [enJan5Start, "30 min", "Not available", "Not available"],
    ]);

    await $("aria/Latest 30-day window").click();
    await expectTrainingRows([
      [enJan6Start, "45 min", "5,000 m", "300 kcal"],
      [enJan5Start, "30 min", "Not available", "Not available"],
      [enJan4Start, "1 h", "10,500 m", "600 kcal"],
    ]);

    await setTrainingComparisonRanges(
      "2026-01-04",
      "2026-01-04",
      "2026-01-05",
      "2026-01-05",
    );
    await $(".training-comparison button[type='submit']").click();
    await expect($("#training-comparison-heading")).toHaveText("Training period comparison");
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

    await setSleepComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".sleep-comparison button[type='submit']").click();
    await expect($("#sleep-comparison-heading")).toHaveText("Sleep period comparison");
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
    await expect($("#sleep-comparison-heading")).toHaveText("Sleep period comparison");

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

    await setRecoveryComparisonRanges(
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
      "2026-01-06",
    );
    await $(".recovery-comparison button[type='submit']").click();
    await expect($("#recovery-comparison-heading")).toHaveText("Recovery period comparison");
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
    await expect($("#recovery-comparison-heading")).toHaveText("Recovery period comparison");

    await selectLocale("es-ES");
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
    await expect($("#activity-comparison-heading")).toHaveText(
      spanish.activity.comparison.resultHeading,
    );
    await expectTrainingRows([
      [esJan6Start, "45 min", "5000 m", "300 kcal"],
      [esJan5Start, "30 min", spanish.unavailable, spanish.unavailable],
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
    await expect($("#training-comparison-heading")).toHaveText(
      spanish.training.comparison.resultHeading,
    );
    await expect($("#sleep-comparison-heading")).toHaveText(
      spanish.sleep.comparison.resultHeading,
    );
    await expect($("#recovery-comparison-heading")).toHaveText(
      spanish.recovery.comparison.resultHeading,
    );
    const spanishTrainingDetailButtons = await $$('button[aria-label^="Ver detalles del entrenamiento del"]');
    expect(spanishTrainingDetailButtons).toHaveLength(3);
    await spanishTrainingDetailButtons[2].click();
    await expect($("#training-detail-heading")).toHaveText(spanish.training.detailHeading);
    const spanishTrainingDetailValues = await $$(".training-detail dd");
    await expect(spanishTrainingDetailValues[4]).toHaveText("10.500 m");
    await expect(spanishTrainingDetailValues[6]).toHaveText("142 ppm");
    await expect(spanishTrainingDetailValues[8]).toHaveText(spanish.training.recordedType);
    const spanishSleepDate = formatLocalDate("es-ES", "2026-01-06");
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
    const spanishRecoveryDate = formatLocalDate("es-ES", "2026-01-06");
    await $(`button[aria-label="${spanish.recovery.viewDetails} ${spanishRecoveryDate}"]`).click();
    await expect($("#recovery-detail-heading")).toHaveText(spanish.recovery.detailHeading);
    const spanishRecoveryDetailValues = await $$(".recovery-detail-metrics dd");
    await expect(spanishRecoveryDetailValues[2]).toHaveText("4100 ms");
    await expect(spanishRecoveryDetailValues[4]).toHaveText("1,5");
    await expect($(".recovery-source-notice")).toHaveText(
      spanish.recovery.sourceNotice,
    );
    await browser.execute(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const detailHasHorizontalOverflow = await browser.execute(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(detailHasHorizontalOverflow).toBe(false);
    const detailAccessibility = await new AxeBuilder({ client: browser }).setLegacyMode().analyze();
    expect(detailAccessibility.violations).toEqual([]);
    await browser.execute(() => {
      document.documentElement.style.fontSize = "";
    });
    await $("aria/Cerrar detalle").click();
    await $("aria/Cerrar detalle del entrenamiento").click();
    await $(`aria/${spanish.sleep.closeDetail}`).click();
    await $(`aria/${spanish.recovery.closeDetail}`).click();
    await $(".activity-comparison-result button.secondary").click();
    await $(".training-comparison-result button.secondary").click();
    await $(".sleep-comparison-result button.secondary").click();
    await $(".recovery-comparison-result button.secondary").click();
    expect(await $$(".activity-comparison-result")).toHaveLength(0);
    expect(await $$(".training-comparison-result")).toHaveLength(0);
    expect(await $$(".sleep-comparison-result")).toHaveLength(0);
    expect(await $$(".recovery-comparison-result")).toHaveLength(0);

    await browser.reloadSession();
    await expect($("h1")).toHaveText(spanish.title);
    await expect($("#outcome-heading")).toHaveText(spanish.outcome.heading);
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
        ...spanish.outcome.coverageExplanations["mapped-summary"],
      },
    ]);
    await expectHistory([
      [formatLocalDate("es-ES", "2026-01-01"), "3100", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-02"), "4200", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-03"), spanish.unavailable, spanish.activity.unavailable],
      [formatLocalDate("es-ES", "2026-01-04"), spanish.unavailable, spanish.activity.missing],
      [formatLocalDate("es-ES", "2026-01-05"), "5300", spanish.activity.available],
    ]);
    await expectTrainingRows([
      [esJan6Start, "45 min", "5000 m", "300 kcal"],
      [esJan5Start, "30 min", spanish.unavailable, spanish.unavailable],
      [esJan4Start, "1 h", "10.500 m", "600 kcal"],
    ]);
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

  });

  it("meets activity, training, sleep, and recovery insight budgets", async () => {
    await runInsightsPerformanceJourney({
      archivePath: insightsPerformanceArchive,
      selectArchive,
      selectLocale,
    });
  });
});
