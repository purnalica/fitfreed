import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/webdriverio";

import { runActivityPerformanceJourney } from "./support/activity-performance.js";

const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);
const fixtureDirectory = process.env.FITFREED_E2E_FIXTURE_DIRECTORY;
const largeArchive = process.env.FITFREED_E2E_LARGE_ARCHIVE;
const activityPerformanceArchive = process.env.FITFREED_E2E_ACTIVITY_PERFORMANCE_ARCHIVE;

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
      expect.stringContaining("contains daily activity that FitFreed cannot validate"),
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
    await waitForNotice("Import completed: 4 recognized, 3 new");
    await expectCoverage([
      ["4", "Supported"],
      ["1", "Unsupported"],
      ["1", "Deliberately ignored"],
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
        family: "Sleep results",
        classification: "Unsupported",
        count: "1",
        reason: "The data family is recognized but is not imported by this version.",
        action: "Keep the original ZIP for a future version.",
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

    await selectLocale("es-ES");
    await expect($("#outcome-heading")).toHaveText(spanish.outcome.heading);
    await expectCoverage([
      ["4", spanish.outcome.supported],
      ["1", spanish.outcome.unsupported],
      ["1", spanish.outcome.ignored],
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
        family: spanish.outcome.familyNames["polar-flow-sleep-result"],
        classification: spanish.outcome.familyClassifications.unsupported,
        count: "1",
        ...spanish.outcome.coverageExplanations["known-family-not-yet-supported"],
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
    ]);
    await browser.execute(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const hasHorizontalOverflow = await browser.execute(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
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

    await selectArchive(dialogMock, path.join(fixtureDirectory, "overlap.zip"));
    await $("aria/Import selected package").click();
    await waitForNotice("Import completed: 3 recognized, 1 new");
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
    await $("aria/Borrar comparación").click();
    expect(await $$(".activity-comparison-result")).toHaveLength(0);

    await browser.reloadSession();
    await expect($("h1")).toHaveText(spanish.title);
    await expect($("#outcome-heading")).toHaveText(spanish.outcome.heading);
    await expectHistory([
      [formatLocalDate("es-ES", "2026-01-01"), "3100", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-02"), "4200", spanish.activity.available],
      [formatLocalDate("es-ES", "2026-01-03"), spanish.unavailable, spanish.activity.unavailable],
      [formatLocalDate("es-ES", "2026-01-04"), spanish.unavailable, spanish.activity.missing],
      [formatLocalDate("es-ES", "2026-01-05"), "5300", spanish.activity.available],
    ]);

  });

  it("meets activity filtering, comparison, and maximum rendering budgets", async () => {
    await runActivityPerformanceJourney({
      archivePath: activityPerformanceArchive,
      selectArchive,
      selectLocale,
    });
  });
});
