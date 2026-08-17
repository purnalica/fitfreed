import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const applicationVersion = JSON.parse(
  fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
).version;
const firstDate = Date.UTC(2024, 0, 1);
const calendarDays = 731;
const warmUpRuns = 4;

function dateValue(value) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatLocalDate(value) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(dateValue(value)),
  );
}

function inclusiveDays(from, through) {
  return Math.floor((dateValue(through) - dateValue(from)) / 86_400_000) + 1;
}

function syntheticPeriodTotal(from, through) {
  const fromIndex = Math.floor((dateValue(from) - firstDate) / 86_400_000);
  const throughIndex = Math.floor((dateValue(through) - firstDate) / 86_400_000);
  let total = 0n;
  for (let index = fromIndex; index <= throughIndex; index += 1) {
    const boundary = index === 0 || index === calendarDays - 1;
    if (!boundary && index % 23 === 0) continue;
    if (index % 19 === 0) continue;
    total += BigInt((index * 7_919) % 40_000);
  }
  return new Intl.NumberFormat("en-US").format(total);
}

function storedObservationCount() {
  return Array.from({ length: calendarDays }, (_, index) => index)
    .filter((index) => index === 0 || index === calendarDays - 1 || index % 23 !== 0)
    .length;
}

function percentile(values, requested) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil((sorted.length - 1) * requested)];
}

function roundedMilliseconds(value) {
  return Math.round(value * 1_000) / 1_000;
}

function measurementEvidence(timings, budget) {
  const p95 = percentile(timings, 0.95);
  return {
    runs: timings.length,
    medianMilliseconds: roundedMilliseconds(percentile(timings, 0.50)),
    p95Milliseconds: roundedMilliseconds(p95),
    maximumMilliseconds: roundedMilliseconds(Math.max(...timings)),
    p95BudgetMilliseconds: budget,
    passed: p95 <= budget,
  };
}

function safeCommand(program, arguments_) {
  try {
    return execFileSync(program, arguments_, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function evidence(measurements) {
  const storage = fs.statfsSync(".");
  return {
    schemaVersion: 1,
    runtime: "packaged-macos-webview",
    applicationVersion,
    sourceRevision: safeCommand("git", ["rev-parse", "HEAD"]),
    host: {
      operatingSystem: os.platform(),
      operatingSystemVersion: safeCommand("sw_vers", ["-productVersion"]) ?? os.release(),
      architecture: os.arch(),
      deviceModel: safeCommand("sysctl", ["-n", "hw.model"]),
      processor: os.cpus()[0]?.model ?? null,
      totalMemoryBytes: os.totalmem(),
      freeStorageBytes: Number(storage.bavail) * Number(storage.bsize),
    },
    scenario: {
      generator: "independently-authored-deterministic",
      from: "2024-01-01",
      through: "2025-12-31",
      calendarDays,
      origins: 1,
      trainingSessions: calendarDays,
      sleepPeriods: calendarDays,
    },
    method: {
      warmUpRunsPerInteraction: warmUpRuns,
      commonMeasuredRuns: 20,
      maximumMeasuredRuns: 7,
      percentile: "sorted zero-based index ceil((n - 1) * 0.95)",
      scope: "packaged Tauri command, React update, and rendered exact activity, training, or sleep view",
    },
    measurements,
  };
}

async function applyActivityRange(from, through) {
  const input = {
    from,
    through,
    expectedRows: inclusiveDays(from, through),
    expectedFirstDate: formatLocalDate(from),
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".activity-filter input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    [expected.from, expected.through].forEach((value, index) => {
      setValue.call(inputs[index], value);
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
      inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
    });
    const started = window.performance.now();
    document.querySelector(".activity-filter button[type='submit']").click();
    function observeResult() {
      const rows = document.querySelectorAll(".history-grid table tbody tr");
      const renderedFirstDate = rows[0]?.querySelector("td")?.textContent;
      if (
        rows.length === expected.expectedRows
        && renderedFirstDate === expected.expectedFirstDate
      ) {
        requestAnimationFrame(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "activity range was not rendered" });
        return;
      }
      requestAnimationFrame(observeResult);
    }
    requestAnimationFrame(observeResult);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareActivityRanges(ranges) {
  const input = {
    ...ranges,
    expectedBaselineTotal: syntheticPeriodTotal(
      ranges.baselineFrom,
      ranges.baselineThrough,
    ),
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".activity-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    [
      expected.baselineFrom,
      expected.baselineThrough,
      expected.comparisonFrom,
      expected.comparisonThrough,
    ].forEach((value, index) => {
      setValue.call(inputs[index], value);
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
      inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
    });
    const started = window.performance.now();
    document.querySelector(".activity-comparison button[type='submit']").click();
    function observeResult() {
      const cells = document.querySelectorAll(
        ".activity-comparison-result table tbody tr:first-child th, "
        + ".activity-comparison-result table tbody tr:first-child td",
      );
      if (cells.length === 4 && cells[1].textContent === expected.expectedBaselineTotal) {
        requestAnimationFrame(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "activity comparison was not rendered" });
        return;
      }
      requestAnimationFrame(observeResult);
    }
    requestAnimationFrame(observeResult);
  }, input);
  if (result.error) throw new Error(result.error);
  return result.duration;
}

async function applyTrainingRange(from, through) {
  const input = {
    from,
    through,
    expectedRows: inclusiveDays(from, through),
    expectedFirstDateTime: `${through}T06:00:00`,
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".training-filter input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    [expected.from, expected.through].forEach((value, index) => {
      setValue.call(inputs[index], value);
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
      inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
    });
    const started = window.performance.now();
    document.querySelector(".training-filter button[type='submit']").click();
    function observeResult() {
      const rows = document.querySelectorAll(".training-history-grid table tbody tr");
      const renderedFirstDateTime = rows[0]?.querySelector("time")?.getAttribute("datetime");
      if (
        rows.length === expected.expectedRows
        && renderedFirstDateTime === expected.expectedFirstDateTime
      ) {
        requestAnimationFrame(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "training range was not rendered" });
        return;
      }
      requestAnimationFrame(observeResult);
    }
    requestAnimationFrame(observeResult);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareTrainingRanges(ranges) {
  const input = {
    ...ranges,
    expectedBaselineSessions: new Intl.NumberFormat("en-US").format(
      inclusiveDays(ranges.baselineFrom, ranges.baselineThrough),
    ),
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".training-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    [
      expected.baselineFrom,
      expected.baselineThrough,
      expected.comparisonFrom,
      expected.comparisonThrough,
    ].forEach((value, index) => {
      setValue.call(inputs[index], value);
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
      inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
    });
    const started = window.performance.now();
    document.querySelector(".training-comparison button[type='submit']").click();
    function observeResult() {
      const cells = document.querySelectorAll(
        ".training-comparison-result table tbody tr:first-child th, "
        + ".training-comparison-result table tbody tr:first-child td",
      );
      if (cells.length === 4 && cells[1].textContent === expected.expectedBaselineSessions) {
        requestAnimationFrame(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "training comparison was not rendered" });
        return;
      }
      requestAnimationFrame(observeResult);
    }
    requestAnimationFrame(observeResult);
  }, input);
  if (result.error) throw new Error(result.error);
  return result.duration;
}

async function applySleepRange(from, through) {
  const input = {
    from,
    through,
    expectedRows: inclusiveDays(from, through),
    expectedFirstDate: from,
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".sleep-filter input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    [expected.from, expected.through].forEach((value, index) => {
      setValue.call(inputs[index], value);
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
      inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
    });
    const started = window.performance.now();
    document.querySelector(".sleep-filter button[type='submit']").click();
    function observeResult() {
      const rows = document.querySelectorAll(".sleep-history-grid table tbody tr");
      const renderedFirstDate = rows[0]?.querySelector("time")?.getAttribute("datetime");
      if (rows.length === expected.expectedRows && renderedFirstDate === expected.expectedFirstDate) {
        requestAnimationFrame(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "sleep range was not rendered" });
        return;
      }
      requestAnimationFrame(observeResult);
    }
    requestAnimationFrame(observeResult);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareSleepRanges(ranges) {
  const input = {
    ...ranges,
    expectedBaselineNights: new Intl.NumberFormat("en-US").format(
      inclusiveDays(ranges.baselineFrom, ranges.baselineThrough),
    ),
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".sleep-comparison input[type='date']");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    [
      expected.baselineFrom,
      expected.baselineThrough,
      expected.comparisonFrom,
      expected.comparisonThrough,
    ].forEach((value, index) => {
      setValue.call(inputs[index], value);
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
      inputs[index].dispatchEvent(new Event("change", { bubbles: true }));
    });
    const started = window.performance.now();
    document.querySelector(".sleep-comparison button[type='submit']").click();
    function observeResult() {
      const cells = document.querySelectorAll(
        ".sleep-comparison-result table tbody tr:first-child th, "
        + ".sleep-comparison-result table tbody tr:first-child td",
      );
      if (cells.length === 4 && cells[1].textContent === expected.expectedBaselineNights) {
        requestAnimationFrame(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "sleep comparison was not rendered" });
        return;
      }
      requestAnimationFrame(observeResult);
    }
    requestAnimationFrame(observeResult);
  }, input);
  if (result.error) throw new Error(result.error);
  return result.duration;
}

async function openSleepDetail(sleepDate) {
  const result = await browser.executeAsync((expectedDate, done) => {
    const row = Array.from(document.querySelectorAll(".sleep-history-grid table tbody tr"))
      .find((candidate) => candidate.querySelector("time")?.getAttribute("datetime") === expectedDate);
    const button = row?.querySelector("button");
    if (!button) {
      done({ duration: null, error: "sleep detail control was not found" });
      return;
    }
    const started = window.performance.now();
    button.click();
    function observeResult() {
      const detail = document.querySelector(".sleep-detail[aria-busy='false']");
      const renderedDate = detail?.querySelector("time")?.getAttribute("datetime");
      const transitions = detail?.querySelectorAll(".sleep-timeline + .sleep-table-scroll tbody tr");
      if (renderedDate === expectedDate && transitions?.length === 5) {
        requestAnimationFrame(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "sleep detail was not rendered" });
        return;
      }
      requestAnimationFrame(observeResult);
    }
    requestAnimationFrame(observeResult);
  }, sleepDate);
  if (result.error) throw new Error(`${result.error}: ${sleepDate}`);
  await $(".sleep-detail-heading button").click();
  await browser.waitUntil(async () => (await $$(".sleep-detail")).length === 0, {
    timeout: 5_000,
    timeoutMsg: "sleep detail did not close",
  });
  return result.duration;
}

async function waitForDailyActivityCoverage() {
  const expectedCount = storedObservationCount();
  await browser.waitUntil(async () => {
    const rows = await $$(".family-coverage-table tbody tr");
    for (const row of rows) {
      if ((await row.$("th").getText()) !== "Daily activity") continue;
      const cells = await row.$$("td");
      return (await cells[0].getText()) === "Supported"
        && (await cells[1].getText()) === String(expectedCount);
    }
    return false;
  }, { timeout: 30_000, timeoutMsg: "performance history import did not complete" });
}

async function waitForTrainingCoverage() {
  await browser.waitUntil(async () => {
    const rows = await $$(".family-coverage-table tbody tr");
    for (const row of rows) {
      if ((await row.$("th").getText()) !== "Training sessions") continue;
      const cells = await row.$$("td");
      return (await cells[0].getText()) === "Supported"
        && (await cells[1].getText()) === String(calendarDays);
    }
    return false;
  }, { timeout: 30_000, timeoutMsg: "performance training import did not complete" });
}

async function waitForSleepCoverage() {
  await browser.waitUntil(async () => {
    const rows = await $$(".family-coverage-table tbody tr");
    let resultsFound = false;
    let scoresFound = false;
    for (const row of rows) {
      const family = await row.$("th").getText();
      const cells = await row.$$("td");
      if (family === "Sleep results") {
        resultsFound = (await cells[0].getText()) === "Supported"
          && (await cells[1].getText()) === "1";
      }
      if (family === "Sleep scores") {
        scoresFound = (await cells[0].getText()) === "Supported"
          && (await cells[1].getText()) === "1";
      }
    }
    return resultsFound && scoresFound;
  }, { timeout: 30_000, timeoutMsg: "performance sleep import did not complete" });
}

async function measureAlternating(executions, scenarios, operation) {
  const timings = [];
  for (let index = 0; index < executions; index += 1) {
    timings.push(await operation(scenarios[index % scenarios.length]));
  }
  return timings;
}

export async function runInsightsPerformanceJourney({ archivePath, selectArchive, selectLocale }) {
  await selectLocale("en-US");
  const dialogMock = await browser.tauri.mock("plugin:dialog|open");
  await selectArchive(dialogMock, archivePath);
  await $("aria/Import selected package").click();
  await waitForDailyActivityCoverage();
  await waitForTrainingCoverage();
  await waitForSleepCoverage();

  const commonRanges = [
    ["2025-01-01", "2025-01-30"],
    ["2025-02-01", "2025-03-02"],
  ];
  const filterRange = ([from, through]) => applyActivityRange(from, through);
  await measureAlternating(warmUpRuns, commonRanges, filterRange);
  const commonFilterTimings = await measureAlternating(20, commonRanges, filterRange);

  const maximumRanges = [
    ["2024-01-01", "2024-12-31"],
    ["2024-12-31", "2025-12-31"],
  ];
  await measureAlternating(warmUpRuns, maximumRanges, filterRange);
  const maximumFilterTimings = await measureAlternating(7, maximumRanges, filterRange);
  await browser.execute(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const maximumRangeHasNoHorizontalOverflow = await browser.execute(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  if (!maximumRangeHasNoHorizontalOverflow) {
    const overflowEvidence = await browser.execute(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      elements: Array.from(document.querySelectorAll("body *"))
        .map((element) => ({
          selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
            element.classList.length > 0 ? `.${Array.from(element.classList).join(".")}` : ""
          }`,
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
        }))
        .filter((element) => element.right > document.documentElement.clientWidth + 1)
        .slice(0, 12),
    }));
    throw new Error(`maximum activity range overflowed: ${JSON.stringify(overflowEvidence)}`);
  }
  await browser.execute(() => {
    document.documentElement.style.fontSize = "";
  });

  const comparisonRanges = [
    {
      baselineFrom: "2024-01-01",
      baselineThrough: "2024-01-30",
      comparisonFrom: "2024-02-01",
      comparisonThrough: "2024-03-01",
    },
    {
      baselineFrom: "2024-04-01",
      baselineThrough: "2024-04-29",
      comparisonFrom: "2024-05-01",
      comparisonThrough: "2024-05-29",
    },
  ];
  await measureAlternating(warmUpRuns, comparisonRanges, compareActivityRanges);
  const commonComparisonTimings = await measureAlternating(
    20,
    comparisonRanges,
    compareActivityRanges,
  );

  const trainingFilterRange = ([from, through]) => applyTrainingRange(from, through);
  await measureAlternating(warmUpRuns, commonRanges, trainingFilterRange);
  const trainingCommonFilterTimings = await measureAlternating(
    20,
    commonRanges,
    trainingFilterRange,
  );
  await measureAlternating(warmUpRuns, maximumRanges, trainingFilterRange);
  const trainingMaximumFilterTimings = await measureAlternating(
    7,
    maximumRanges,
    trainingFilterRange,
  );
  await browser.execute(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const maximumTrainingRangeHasNoHorizontalOverflow = await browser.execute(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  if (!maximumTrainingRangeHasNoHorizontalOverflow) {
    throw new Error("maximum training range overflowed the application viewport");
  }
  await browser.execute(() => {
    document.documentElement.style.fontSize = "";
  });
  await measureAlternating(warmUpRuns, comparisonRanges, compareTrainingRanges);
  const trainingCommonComparisonTimings = await measureAlternating(
    20,
    comparisonRanges,
    compareTrainingRanges,
  );

  const sleepFilterRange = ([from, through]) => applySleepRange(from, through);
  await measureAlternating(warmUpRuns, commonRanges, sleepFilterRange);
  const sleepCommonFilterTimings = await measureAlternating(20, commonRanges, sleepFilterRange);
  await measureAlternating(warmUpRuns, maximumRanges, sleepFilterRange);
  const sleepMaximumFilterTimings = await measureAlternating(7, maximumRanges, sleepFilterRange);
  await browser.execute(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const maximumSleepRangeHasNoHorizontalOverflow = await browser.execute(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  if (!maximumSleepRangeHasNoHorizontalOverflow) {
    throw new Error("maximum sleep range overflowed the application viewport");
  }
  await browser.execute(() => {
    document.documentElement.style.fontSize = "";
  });
  await measureAlternating(warmUpRuns, comparisonRanges, compareSleepRanges);
  const sleepCommonComparisonTimings = await measureAlternating(
    20,
    comparisonRanges,
    compareSleepRanges,
  );
  await applySleepRange("2025-01-01", "2025-01-30");
  const sleepDetailDates = ["2025-01-10", "2025-01-20"];
  await measureAlternating(warmUpRuns, sleepDetailDates, openSleepDetail);
  const sleepDetailTimings = await measureAlternating(20, sleepDetailDates, openSleepDetail);

  const measurements = {
    activity: {
      commonFilter: measurementEvidence(commonFilterTimings, 500),
      maximumFilter: measurementEvidence(maximumFilterTimings, 2_000),
      commonComparison: measurementEvidence(commonComparisonTimings, 500),
    },
    training: {
      commonFilter: measurementEvidence(trainingCommonFilterTimings, 500),
      maximumFilter: measurementEvidence(trainingMaximumFilterTimings, 2_000),
      commonComparison: measurementEvidence(trainingCommonComparisonTimings, 500),
    },
    sleep: {
      commonFilter: measurementEvidence(sleepCommonFilterTimings, 500),
      maximumFilter: measurementEvidence(sleepMaximumFilterTimings, 2_000),
      commonComparison: measurementEvidence(sleepCommonComparisonTimings, 500),
      detail: measurementEvidence(sleepDetailTimings, 500),
    },
  };
  process.stdout.write(`${JSON.stringify(evidence(measurements))}\n`);
  for (const domain of Object.values(measurements)) {
    for (const measurement of Object.values(domain)) {
      expect(measurement.passed).toBe(true);
    }
  }
}
