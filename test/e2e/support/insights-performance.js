import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  packagedWebviewRuntime,
  platformHostCommands,
} from "./performance-environment.js";

const applicationVersion = JSON.parse(
  fs.readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
).version;
const english = JSON.parse(
  fs.readFileSync(new URL("../../../src/locales/en-US.json", import.meta.url), "utf8"),
);
const firstDate = Date.UTC(2024, 0, 1);
const calendarDays = 731;
const warmUpRuns = 4;
const evidenceDirectory = path.resolve(".artifacts/e2e/evidence");
fs.mkdirSync(evidenceDirectory, { recursive: true });

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

function reportPhase(phase) {
  process.stdout.write(`${JSON.stringify({ performancePhase: phase })}\n`);
}

async function waitForExactControlCount(selector, expectedCount) {
  await browser.waitUntil(
    () => browser.execute(
      (expectedSelector, count) => (
        document.querySelectorAll(expectedSelector).length === count
      ),
      selector,
      expectedCount,
    ),
    {
      timeout: 10_000,
      timeoutMsg: `${selector} did not expose ${expectedCount} controls`,
    },
  );
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
  const platform = os.platform();
  const hostCommands = platformHostCommands(platform);
  const operatingSystemVersion = hostCommands.operatingSystemVersion === null
    ? os.release()
    : safeCommand(
      hostCommands.operatingSystemVersion.program,
      hostCommands.operatingSystemVersion.arguments,
    ) ?? os.release();
  const deviceModel = hostCommands.deviceModel === null
    ? null
    : safeCommand(hostCommands.deviceModel.program, hostCommands.deviceModel.arguments);
  return {
    schemaVersion: 1,
    runtime: packagedWebviewRuntime(platform),
    applicationVersion,
    sourceRevision: safeCommand("git", ["rev-parse", "HEAD"]),
    host: {
      operatingSystem: platform,
      operatingSystemVersion,
      architecture: os.arch(),
      deviceModel,
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
      trainingRoutePoints: 20_001,
      trainingSignalSeries: 4,
      largestTrainingSignalSamples: 20_001,
      crossSignalLanes: 4,
      sleepPeriods: calendarDays,
      recoveryNights: calendarDays,
    },
    method: {
      warmUpRunsPerInteraction: warmUpRuns,
      commonMeasuredRuns: 20,
      maximumMeasuredRuns: 7,
      percentile: "sorted zero-based index ceil((n - 1) * 0.95)",
      completionBoundary: "mutation-observed answer boundary after synchronous layout on a message-channel browser task",
      scope: "packaged Tauri command, SQLite and application work, transport, React update, and laid-out domain or longitudinal answer",
    },
    measurements,
  };
}

async function applyActivityRange(from, through) {
  await openDisclosure(".activity-history-controls");
  await waitForExactControlCount(".activity-filter input[type='date']", 2);
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
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "activity range was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareActivityRanges(ranges) {
  await waitForExactControlCount(".activity-comparison input[type='date']", 4);
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
        const exactValues = document.querySelector(
          ".activity-comparison-result .answer-exact-values",
        );
        exactValues.open = true;
        setTimeout(() => {
          exactValues.querySelector("table").getBoundingClientRect();
          done({
            duration: window.performance.now() - started,
            error: null,
          });
        });
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "activity comparison was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(result.error);
  return result.duration;
}

async function applyTrainingRange(from, through) {
  await waitForExactControlCount(".training-session-search input[type='date']", 2);
  const input = {
    from,
    through,
    expectedRows: Math.min(inclusiveDays(from, through), 25),
    expectedFirstDateTime: `${through}T06:00:00`,
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".training-session-search input[type='date']");
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
    document.querySelector(".training-session-search button[type='submit']").click();
    function observeResult() {
      const rows = document.querySelectorAll(".training-session-results > li");
      const renderedFirstDateTime = rows[0]?.querySelector("time")?.getAttribute("datetime");
      if (
        rows.length === expected.expectedRows
        && renderedFirstDateTime === expected.expectedFirstDateTime
      ) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "training range was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareTrainingRanges(ranges) {
  await waitForExactControlCount(".training-comparison input[type='date']", 4);
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
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "training comparison was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(result.error);
  return result.duration;
}

async function navigateTrainingCalendar(scenario) {
  const result = await browser.executeAsync((expected, done) => {
    const navigation = Array.from(document.querySelectorAll(".training-calendar header button"))
      .find((button) => button.getAttribute("aria-label") === expected.buttonLabel);
    if (!navigation) {
      done({ duration: null, error: "training calendar navigation was not available" });
      return;
    }
    const started = window.performance.now();
    navigation.click();
    function observeResult() {
      const heading = document.querySelector(".training-calendar h3")?.textContent;
      const days = document.querySelectorAll(".training-calendar-day-summary");
      const activities = document.querySelectorAll(".training-calendar-activities button");
      if (heading === expected.heading
        && days.length === expected.dayCount
        && activities.length === expected.dayCount) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "training calendar month was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, scenario);
  if (result.error) throw new Error(`${result.error}: ${scenario.heading}`);
  return result.duration;
}

async function measureTrainingSignalOverview() {
  const result = await browser.executeAsync((done) => {
    const detailButton = document.querySelector(
      '.training-session-results button[aria-label^="View session details"]',
    );
    if (!detailButton) {
      done({ duration: null, error: "training detail navigation was not available" });
      return;
    }
    const started = window.performance.now();
    let signalsOpened = false;
    detailButton.click();
    function observeResult() {
      const signalSectionButton = document.querySelector(
        ".training-detail-navigation button[aria-controls='training-detail-signals']",
      );
      if (signalSectionButton && !signalsOpened) {
        signalsOpened = true;
        signalSectionButton.click();
      }
      const signalSection = document.querySelector("#training-detail-signals");
      const charts = Array.from(document.querySelectorAll(
        ".training-signal .analytical-chart-canvas",
      ));
      const choices = document.querySelectorAll(
        ".training-cross-signal-selection input[type='checkbox']",
      );
      const crossSignalChart = document.querySelector(
        ".training-cross-signal-chart .analytical-chart-canvas",
      );
      const crossSignalLanes = document.querySelectorAll(
        ".training-cross-signal-lanes article",
      );
      const rendererMounted = (chart) => (
        chart?.querySelector(".analytical-chart-renderer")?.childElementCount > 0
      );
      if (
        signalsOpened
        && signalSection && !signalSection.hasAttribute("hidden")
        && charts.length === 4
        && choices.length === 4
        && crossSignalLanes.length === 2
        && rendererMounted(crossSignalChart)
        && charts.every(rendererMounted)
        && charts.every((chart) => chart.getAttribute("aria-label")?.includes("20,001 samples"))
      ) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({
          duration: null,
          error: `bounded training signal overview was not rendered: ${JSON.stringify({
            signalsOpened,
            signalSectionVisible: Boolean(
              signalSection && !signalSection.hasAttribute("hidden"),
            ),
            charts: charts.length,
            chartLabels: charts.map((chart) => chart.getAttribute("aria-label")),
            choices: choices.length,
            choiceStates: Array.from(choices).map((choice) => ({
              checked: choice.checked,
              disabled: choice.disabled,
              label: choice.parentElement?.textContent,
            })),
            selectedChoices: Array.from(choices).filter((choice) => choice.checked).length,
            crossSignalChartMounted: rendererMounted(crossSignalChart),
            crossSignalLanes: crossSignalLanes.length,
          })}`,
        });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  });
  if (result.error) throw new Error(result.error);
  const choices = await $$(
    ".training-cross-signal-selection input[type='checkbox']",
  );
  expect(choices).toHaveLength(4);
  await expect(choices[2]).toBeEnabled();
  await choices[2].click();
  await browser.waitUntil(
    async () => (await $$(".training-cross-signal-lanes article")).length === 3,
    { timeout: 5_000, timeoutMsg: "third training signal was not rendered" },
  );
  await expect(choices[3]).toBeEnabled();
  await browser.execute(() => {
    const target = document.querySelectorAll(
      ".training-cross-signal-selection input[type='checkbox']",
    )[3];
    globalThis.__fitfreedMaximumSignalSelection = null;
    target.addEventListener("click", () => {
      const started = window.performance.now();
      function observeSelection() {
        const lanes = document.querySelectorAll(".training-cross-signal-lanes article");
        const chart = document.querySelector(
          ".training-cross-signal-chart[data-lane-count='4'] .analytical-chart-canvas",
        );
        const checked = document.querySelectorAll(
          ".training-cross-signal-selection input[type='checkbox']:checked",
        );
        const rendererMounted = chart
          ?.querySelector(".analytical-chart-renderer")?.childElementCount > 0;
        if (lanes.length === 4 && checked.length === 4 && rendererMounted) {
          document.documentElement.getBoundingClientRect();
          setTimeout(() => {
            globalThis.__fitfreedMaximumSignalSelection = {
              duration: window.performance.now() - started,
              error: null,
            };
          });
          return;
        }
        if (window.performance.now() - started > 5_000) {
          globalThis.__fitfreedMaximumSignalSelection = {
            duration: null,
            error: "maximum training signal selection was not rendered",
          };
          return;
        }
        setTimeout(observeSelection, 16);
      }
      setTimeout(observeSelection, 0);
    }, { capture: true, once: true });
  });
  await choices[3].click();
  await browser.waitUntil(
    () => browser.execute(() => globalThis.__fitfreedMaximumSignalSelection !== null),
    { timeout: 5_000, timeoutMsg: "maximum training signal selection was not rendered" },
  );
  const maximumSelection = await browser.execute(() => {
    const measurement = globalThis.__fitfreedMaximumSignalSelection;
    delete globalThis.__fitfreedMaximumSignalSelection;
    return measurement;
  });
  if (maximumSelection.error) throw new Error(maximumSelection.error);
  await closeTrainingDetail("training signal detail did not close");
  return {
    overviewDuration: result.duration,
    maximumSelectionDuration: maximumSelection.duration,
  };
}

async function closeTrainingDetail(timeoutMsg) {
  const closeButton = await $(".training-detail-actions button.secondary");
  await closeButton.waitForDisplayed({ timeout: 5_000, timeoutMsg });
  expect(await closeButton.getText()).toBe(english.training.sessionLibrary.closeDetail);
  await closeButton.click();
  await browser.waitUntil(
    async () => (await $$(".training-detail")).length === 0,
    { timeout: 5_000, timeoutMsg },
  );
}

async function inspectChartZoomGeometry(selector, boundary, targetFraction) {
  return browser.execute((expectedSelector, expectedBoundary, expectedTarget) => {
    const renderer = document.querySelector(expectedSelector);
    if (!(renderer instanceof HTMLElement)) return null;
    renderer.scrollIntoView({ block: "center", inline: "nearest" });
    const bounds = renderer.getBoundingClientRect();
    const accentProbe = document.createElement("span");
    accentProbe.style.color = getComputedStyle(renderer)
      .getPropertyValue("--accent-deep")
      .trim();
    renderer.append(accentProbe);
    const resolvedAccent = getComputedStyle(accentProbe).color;
    accentProbe.remove();
    const colorChannels = (color) => {
      const channels = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return channels
        ? [Number(channels[1]), Number(channels[2]), Number(channels[3])]
        : null;
    };
    const resolvedAccentChannels = colorChannels(resolvedAccent);
    const matchesAccent = (color, tolerance = 2) => {
      const channels = colorChannels(color);
      return channels !== null
        && resolvedAccentChannels !== null
        && channels.every((channel, index) => (
          Math.abs(channel - resolvedAccentChannels[index]) <= tolerance
        ));
    };
    const canvas = renderer.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      const svg = renderer.querySelector("svg");
      if (!(svg instanceof SVGSVGElement)) return null;
      const inspectedShapes = [...svg.querySelectorAll("path, rect")].flatMap((element) => {
        const shapeBounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const color = `${style.fill} ${style.stroke}`;
        const accent = [style.fill, style.stroke].some((candidate) => matchesAccent(candidate));
        const nearSlider = shapeBounds.top >= bounds.top + bounds.height * 0.8;
        const handleShape = shapeBounds.width >= 2 && shapeBounds.width <= 24
          && shapeBounds.height >= 10 && shapeBounds.height <= 48;
        return nearSlider ? [{
          accent,
          color,
          handleShape,
          left: shapeBounds.left,
          right: shapeBounds.right,
          height: shapeBounds.height,
          width: shapeBounds.width,
          y: shapeBounds.top + shapeBounds.height / 2,
        }] : [];
      });
      const candidates = inspectedShapes
        .filter((shape) => shape.accent && shape.handleShape)
        .sort((left, right) => left.left - right.left);
      if (candidates.length < 2) return {
        diagnostic: "slider handles were not identified",
        inspectedShapes: {
          expectedAccent: resolvedAccent,
          shapes: inspectedShapes.slice(-20),
        },
      };
      const startHandle = candidates[0];
      const endHandle = candidates.at(-1);
      const trackLeft = (startHandle.left + startHandle.right) / 2;
      const trackRight = (endHandle.left + endHandle.right) / 2;
      const selectedHandle = expectedBoundary === "start" ? startHandle : endHandle;
      const fromX = expectedBoundary === "start" ? trackLeft : trackRight;
      return {
        candidateCount: candidates.length,
        fromX,
        handles: { end: endHandle, start: startHandle },
        targetX: trackLeft + (trackRight - trackLeft) * expectedTarget,
        y: selectedHandle.y,
        rendererBounds: {
          height: bounds.height,
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
        },
        renderer: "svg",
      };
    }
    const context = canvas.getContext("2d");
    if (!context) return null;
    const scanTop = Math.floor(canvas.height * 0.86);
    const pixels = context.getImageData(
      0,
      scanTop,
      canvas.width,
      canvas.height - scanTop,
    );
    const columnCounts = new Uint16Array(canvas.width);
    const columnYTotals = new Uint32Array(canvas.width);
    for (let y = 0; y < pixels.height; y += 1) {
      for (let x = 0; x < pixels.width; x += 1) {
        const offset = (y * pixels.width + x) * 4;
        const red = pixels.data[offset];
        const green = pixels.data[offset + 1];
        const blue = pixels.data[offset + 2];
        const alpha = pixels.data[offset + 3];
        if (alpha > 200 && resolvedAccentChannels !== null
          && Math.abs(red - resolvedAccentChannels[0]) <= 12
          && Math.abs(green - resolvedAccentChannels[1]) <= 12
          && Math.abs(blue - resolvedAccentChannels[2]) <= 12) {
          columnCounts[x] += 1;
          columnYTotals[x] += y + scanTop;
        }
      }
    }
    const clusters = [];
    const minimumHandleHeight = Math.max(8, Math.floor(canvas.height * 0.025));
    for (let x = 0; x < columnCounts.length; x += 1) {
      if (columnCounts[x] < minimumHandleHeight) continue;
      const last = clusters.at(-1);
      if (last && x === last.through + 1) {
        last.through = x;
        last.pixelCount += columnCounts[x];
        last.yTotal += columnYTotals[x];
      } else {
        clusters.push({
          from: x,
          through: x,
          pixelCount: columnCounts[x],
          yTotal: columnYTotals[x],
        });
      }
    }
    if (clusters.length < 2) return null;
    const startHandle = clusters[0];
    const endHandle = clusters.at(-1);
    const canvasScaleX = bounds.width / canvas.width;
    const canvasScaleY = bounds.height / canvas.height;
    const trackLeft = bounds.left + ((startHandle.from + startHandle.through) / 2) * canvasScaleX;
    const trackRight = bounds.left + ((endHandle.from + endHandle.through) / 2) * canvasScaleX;
    const selectedHandle = expectedBoundary === "start" ? startHandle : endHandle;
    return {
      fromX: expectedBoundary === "start" ? trackLeft : trackRight,
      targetX: trackLeft + (trackRight - trackLeft) * expectedTarget,
      y: bounds.top + (selectedHandle.yTotal / selectedHandle.pixelCount) * canvasScaleY,
      rendererBounds: {
        height: bounds.height,
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
      },
      canvasSize: { height: canvas.height, width: canvas.width },
      handles: {
        end: endHandle,
        start: startHandle,
      },
      renderer: "canvas",
    };
  }, selector, boundary, targetFraction);
}

async function dragChartZoomBoundary(selector, boundary, targetFraction) {
  const geometry = await inspectChartZoomGeometry(selector, boundary, targetFraction);
  if (!geometry) throw new Error("the analytical chart renderer was not available");
  if (geometry.diagnostic) {
    throw new Error(`${geometry.diagnostic}: ${JSON.stringify(geometry.inspectedShapes)}`);
  }
  const fromX = Math.round(geometry.fromX);
  const targetX = Math.round(geometry.targetX);
  const y = Math.round(geometry.y);
  const interaction = await browser.executeAsync((expectedSelector, coordinates, done) => {
    const renderer = document.querySelector(expectedSelector);
    const rendererContent = renderer?.querySelector("canvas, svg");
    const viewportRoot = rendererContent?.parentElement;
    if (!(viewportRoot instanceof HTMLElement)) {
      done({ duration: null, error: "the chart viewport root was not available" });
      return;
    }
    const started = window.performance.now();
    const channel = new MessageChannel();
    const steps = 60;
    const observedEvents = [];
    let step = 0;

    function dispatch(type, clientX, buttons) {
      const rootBounds = viewportRoot.getBoundingClientRect();
      const inputEvent = new MouseEvent(type, {
        bubbles: true,
        button: 0,
        buttons,
        cancelable: true,
        clientX,
        clientY: coordinates.y,
        view: window,
      });
      Object.defineProperties(inputEvent, {
        offsetX: { value: clientX - rootBounds.left },
        offsetY: { value: coordinates.y - rootBounds.top },
      });
      viewportRoot.dispatchEvent(inputEvent);
      if (type !== "mousemove" || buttons === 0 || step === 1 || step === steps) {
        observedEvents.push({
          buttons: inputEvent.buttons,
          defaultPrevented: inputEvent.defaultPrevented,
          offsetX: inputEvent.offsetX,
          offsetY: inputEvent.offsetY,
          type,
          viewportCursor: viewportRoot.style.cursor,
          which: inputEvent.which,
          zrX: inputEvent.zrX ?? null,
          zrY: inputEvent.zrY ?? null,
        });
      }
    }

    channel.port1.onmessage = () => {
      step += 1;
      const progress = step / steps;
      dispatch(
        "mousemove",
        Math.round(coordinates.fromX + (coordinates.targetX - coordinates.fromX) * progress),
        1,
      );
      if (step < steps) {
        channel.port2.postMessage(null);
        return;
      }
      dispatch("mouseup", coordinates.targetX, 0);
      channel.port1.close();
      channel.port2.close();
      done({
        duration: window.performance.now() - started,
        error: null,
        observedEvents,
      });
    };

    dispatch("mousemove", coordinates.fromX, 0);
    dispatch("mousedown", coordinates.fromX, 1);
    channel.port2.postMessage(null);
  }, selector, { fromX, targetX, y });
  if (interaction.error) throw new Error(interaction.error);
  return { ...geometry, ...interaction };
}

async function waitForChartZoomBoundaryMove(
  selector,
  boundary,
  previousX,
  interaction,
) {
  let observedGeometry = null;
  try {
    await browser.waitUntil(
      async () => {
        observedGeometry = await inspectChartZoomGeometry(
          selector,
          boundary,
          boundary === "start" ? 0.2 : 0.8,
        );
        return observedGeometry !== null
          && Math.abs(observedGeometry.fromX - previousX) >= 20;
      },
      {
        timeout: 5_000,
        timeoutMsg: `the analytical chart did not move its ${boundary} handle`,
      },
    );
  } catch (error) {
    throw new Error(`the analytical chart did not move its ${boundary} handle: ${JSON.stringify({
      cause: error instanceof Error ? error.message : String(error),
      interaction,
      observedGeometry,
      previousX,
    })}`);
  }
}

async function verifyTrainingChartPointerZoomRemainsResponsive() {
  const rendererSelector = ".training-cross-signal-chart .analytical-chart-renderer";
  let initialGeometry = null;
  await browser.waitUntil(
    async () => {
      initialGeometry = await inspectChartZoomGeometry(rendererSelector, "start", 0.2);
      return initialGeometry !== null;
    },
    { timeout: 5_000, timeoutMsg: "the dense analytical chart renderer was not available" },
  );
  const startGeometry = await dragChartZoomBoundary(rendererSelector, "start", 0.2);
  await waitForChartZoomBoundaryMove(
    rendererSelector,
    "start",
    initialGeometry.fromX,
    startGeometry,
  );
  const initialEndGeometry = await inspectChartZoomGeometry(rendererSelector, "end", 0.8);
  const endGeometry = await dragChartZoomBoundary(rendererSelector, "end", 0.8);
  await waitForChartZoomBoundaryMove(
    rendererSelector,
    "end",
    initialEndGeometry.fromX,
    endGeometry,
  );
  await expect($("#training-detail-signals")).toBeDisplayed();
}

async function verifyTrainingSingleSignalChartPointerZoomRemainsResponsive() {
  const rendererSelector = ".training-signal .analytical-chart-renderer";
  let initialGeometry = null;
  await browser.waitUntil(
    async () => {
      initialGeometry = await inspectChartZoomGeometry(rendererSelector, "start", 0.2);
      return initialGeometry !== null;
    },
    { timeout: 5_000, timeoutMsg: "the single-signal chart renderer was not available" },
  );
  const startGeometry = await dragChartZoomBoundary(rendererSelector, "start", 0.2);
  await waitForChartZoomBoundaryMove(
    rendererSelector,
    "start",
    initialGeometry.fromX,
    startGeometry,
  );
  const initialEndGeometry = await inspectChartZoomGeometry(rendererSelector, "end", 0.8);
  const endGeometry = await dragChartZoomBoundary(rendererSelector, "end", 0.8);
  await waitForChartZoomBoundaryMove(
    rendererSelector,
    "end",
    initialEndGeometry.fromX,
    endGeometry,
  );
}

async function verifyTrainingMaximumSignalComposition() {
  await $('.training-session-results button[aria-label^="View session details"]').click();
  await $(
    ".training-detail-navigation button[aria-controls='training-detail-signals']",
  ).click();
  await $("#training-detail-signals").waitForDisplayed({ timeout: 5_000 });
  await verifyTrainingSingleSignalChartPointerZoomRemainsResponsive();
  const choices = await $$(
    ".training-cross-signal-selection input[type='checkbox']",
  );
  expect(choices).toHaveLength(4);
  await verifyTrainingChartPointerZoomRemainsResponsive();
  await choices[2].click();
  await browser.waitUntil(
    async () => (await $$(".training-cross-signal-lanes article")).length === 3,
    { timeout: 5_000, timeoutMsg: "third training signal was not rendered" },
  );
  await choices[3].click();
  await browser.waitUntil(
    async () => (await $$(".training-cross-signal-lanes article")).length === 4,
    { timeout: 5_000, timeoutMsg: "fourth training signal was not rendered" },
  );
  const geometry = await browser.execute(() => {
    const root = document.documentElement;
    const panel = document.querySelector(".training-cross-signal");
    panel.scrollIntoView({ block: "start", inline: "nearest" });
    const panelBounds = panel.getBoundingClientRect();
    const chart = panel.querySelector(".training-cross-signal-chart");
    const chartBounds = chart.getBoundingClientRect();
    const lanes = [...panel.querySelectorAll(".training-cross-signal-lanes article")];
    return {
      hasHorizontalOverflow: root.scrollWidth > root.clientWidth,
      laneCount: lanes.length,
      chartInsidePanel: chartBounds.left >= panelBounds.left - 1
        && chartBounds.right <= panelBounds.right + 1,
      cardsBeforeChart: lanes.every((lane) => lane.getBoundingClientRect().bottom <= chartBounds.top),
      laneContentFits: lanes.every((lane) => lane.scrollWidth <= lane.clientWidth + 1),
    };
  });
  expect(geometry).toEqual({
    hasHorizontalOverflow: false,
    laneCount: 4,
    chartInsidePanel: true,
    cardsBeforeChart: true,
    laneContentFits: true,
  });
  await browser.saveScreenshot(path.join(
    evidenceDirectory,
    "x7-r8-4-cross-signals-en-four-lanes.png",
  ));
  await browser.execute(() => document.querySelector(".training-cross-signal-chart")
    .scrollIntoView({ block: "center", inline: "nearest" }));
  await browser.saveScreenshot(path.join(
    evidenceDirectory,
    "x7-r8-4-cross-signal-chart-en-four-lanes.png",
  ));
  await verifyTrainingChartPointerZoomRemainsResponsive();
  await closeTrainingDetail("training signal detail did not close");
}

async function measureTrainingSignalExactPage() {
  await $('.training-session-results button[aria-label^="View session details"]').click();
  await $(
    ".training-detail-navigation button[aria-controls='training-detail-signals']",
  ).click();
  await $("#training-detail-signals").waitForDisplayed({ timeout: 5_000 });
  await browser.waitUntil(
    async () => (await $$(".training-signal button[aria-expanded='false']")).length === 4,
    { timeout: 5_000, timeoutMsg: "training signal exact-sample action was not available" },
  );
  const result = await browser.executeAsync((done) => {
    const exactButton = document.querySelector(
      ".training-signal button[aria-expanded='false']",
    );
    if (!exactButton) {
      done({ duration: null, error: "training signal exact-sample action was not available" });
      return;
    }
    const started = window.performance.now();
    let complete = false;
    const channel = new MessageChannel();
    const observer = new MutationObserver(observeResult);
    const deadline = setTimeout(() => finish({
      duration: null,
      error: "exact training signal sample page was not rendered",
    }), 5_000);

    function finish(outcome) {
      if (complete) return;
      complete = true;
      clearTimeout(deadline);
      observer.disconnect();
      channel.port1.close();
      channel.port2.close();
      done(outcome);
    }

    function finishRenderedResult() {
      document.documentElement.getBoundingClientRect();
      channel.port1.onmessage = () => finish({
        duration: window.performance.now() - started,
        error: null,
      });
      channel.port2.postMessage(null);
    }

    function observeResult() {
      const rows = document.querySelectorAll(".training-signal-exact tbody tr");
      const status = document.querySelector(".training-signal-exact [aria-live='polite']")
        ?.textContent;
      if (rows.length === 100 && status === "Samples 1–100 of 20,001") {
        finishRenderedResult();
      }
    }

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    exactButton.click();
    observeResult();
  });
  if (result.error) throw new Error(result.error);
  await closeTrainingDetail("exact training signal detail did not close");
  return result.duration;
}

async function measureTrainingRouteWorkbenchOpen() {
  const result = await browser.executeAsync((done) => {
    const detailButton = document.querySelector(
      '.training-session-results button[aria-label^="View session details"]',
    );
    if (!detailButton) {
      done({ duration: null, error: "training detail navigation was not available" });
      return;
    }
    const started = window.performance.now();
    detailButton.click();
    function observeResult() {
      const route = document.querySelector(".training-route-workbench .fitfreed-route-track");
      const position = document.querySelector(
        ".training-route-position-control input[type='range']",
      );
      const lanes = document.querySelectorAll(".training-route-signal-lane-chart");
      const laneChoices = document.querySelectorAll(
        ".training-route-signal-lane-selection input[type='checkbox']",
      );
      const overlays = document.querySelectorAll(
        ".training-route-map .fitfreed-route-overlay",
      );
      const trackDisplayOptions = document.querySelectorAll(
        ".training-route-workbench-controls label:nth-child(2) select option",
      );
      if (
        route?.getAttribute("d")
        && position?.getAttribute("max") === "399"
        && position.getAttribute("aria-valuetext")?.startsWith("Point 1 of 20,001 ·")
        && lanes.length === 0
        && laneChoices.length === 0
        && overlays.length === 0
        && trackDisplayOptions.length === 1
      ) {
        document.querySelector(".training-route-map-frame").getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 10_000) {
        done({ duration: null, error: "dense route workbench was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  });
  if (result.error) throw new Error(result.error);
  await closeTrainingDetail("dense route detail did not close");
  return result.duration;
}

async function openDenseTrainingRouteWorkbench() {
  await $('.training-session-results button[aria-label^="View session details"]').click();
  await $(".training-route-workbench .fitfreed-route-track").waitForDisplayed({
    timeout: 10_000,
  });
  expect(await $$(".training-route-signal-lane-chart")).toHaveLength(0);
  expect(await $$(".training-route-map .fitfreed-route-overlay")).toHaveLength(0);
  const trackDisplayOptions = await $$(
    ".training-route-workbench-controls label:nth-child(2) select option",
  );
  expect(trackDisplayOptions).toHaveLength(1);
  await expect(trackDisplayOptions[0]).toHaveText(
    english.training.sessionLibrary.routeWorkbench.recordedTrack,
  );
}

async function measureTrainingRouteSelection(scenario) {
  const result = await browser.executeAsync((expected, done) => {
    const position = document.querySelector(
      ".training-route-position-control input[type='range']",
    );
    const marker = document.querySelector(
      ".training-route-map .fitfreed-route-selection",
    );
    if (!position || !marker) {
      done({ duration: null, error: "dense route selection controls were not available" });
      return;
    }
    const previousMarker = marker.getAttribute("d");
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    const started = window.performance.now();
    setValue.call(position, expected.value);
    position.dispatchEvent(new Event("input", { bubbles: true }));
    position.dispatchEvent(new Event("change", { bubbles: true }));
    function observeResult() {
      const selectedPosition = document.querySelector(
        ".training-route-selection > div > strong",
      )?.textContent;
      const updatedMarker = document.querySelector(
        ".training-route-map .fitfreed-route-selection",
      )?.getAttribute("d");
      if (
        selectedPosition === expected.label
        && updatedMarker
        && updatedMarker !== previousMarker
        && document.querySelectorAll(".training-route-signal-lane-chart").length === 0
      ) {
        document.querySelector(".training-route-map-frame").getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "dense route selection did not synchronize" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 0);
  }, scenario);
  if (result.error) throw new Error(`${result.error}: ${scenario.label}`);
  return result.duration;
}

async function measureTrainingRouteIndependentSignalReveal() {
  const result = await browser.executeAsync((labels, done) => {
    const buttons = Array.from(document.querySelectorAll(".training-detail-navigation button"));
    const signals = buttons.find((button) => button.textContent === labels.signals);
    if (!signals) {
      done({ duration: null, error: "independent signal section was not available" });
      return;
    }
    const started = window.performance.now();
    let complete = false;
    const channel = new MessageChannel();
    const observer = new MutationObserver(observeResult);
    const deadline = setTimeout(() => finish({
      duration: null,
      error: "independent signal section did not open",
    }), 5_000);

    function finish(outcome) {
      if (complete) return;
      complete = true;
      clearTimeout(deadline);
      observer.disconnect();
      channel.port1.close();
      channel.port2.close();
      done(outcome);
    }

    function finishRenderedResult(section) {
      section.getBoundingClientRect();
      channel.port1.onmessage = () => finish({
        duration: window.performance.now() - started,
        error: null,
      });
      channel.port2.postMessage(null);
    }

    function observeResult() {
      const section = document.querySelector("#training-detail-signals");
      const series = section?.querySelectorAll(".training-signal");
      const noInventedAlignment = document.querySelectorAll(
        ".training-route-signal-lane-chart, .training-route-map .fitfreed-route-overlay",
      ).length === 0;
      if (!section?.hasAttribute("hidden") && series?.length === 4 && noInventedAlignment) {
        finishRenderedResult(section);
      }
    }

    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    signals.click();
    observeResult();
  }, {
    signals: english.training.sessionLibrary.detailSections.signals,
  });
  if (result.error) throw new Error(result.error);
  const overview = english.training.sessionLibrary.detailSections.overview;
  for (const button of await $$(".training-detail-navigation button")) {
    if (await button.getText() !== overview) continue;
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    break;
  }
  return result.duration;
}

async function expectDenseRouteExactEndpoint() {
  await measureTrainingRouteSelection({ value: "399", label: "Point 20,001 of 20,001" });
  await $(".training-route-exact-actions button").click();
  await expect($(".training-route-exact [aria-live='polite']")).toHaveText(
    "Point 20,001 of 20,001",
  );
  const selectedRow = await $(".training-route-exact tbody tr[aria-current='true']");
  await expect(selectedRow).toExist();
  await expect(selectedRow.$("th")).toHaveText(expect.stringContaining("20,001"));
}

async function openDenseTrainingRouteRangeEditor() {
  const copy = english.training.sessionLibrary.routeWorkbench;
  await $(`aria/${copy.chooseRangeBoundaries}`).click();
  await $(`aria/${copy.useCurrentAsFirstBoundary}`).click();
  await measureTrainingRouteSelection({ value: "399", label: "Point 20,001 of 20,001" });
  await $(`aria/${copy.useCurrentAsSecondBoundary}`).click();
  const exactPreview = await $(".training-route-draft-summary");
  await exactPreview.waitForDisplayed({ timeout: 10_000 });
  await expect(exactPreview).toHaveAttribute("aria-label", copy.draftPreviewRegion);
  await waitForExactControlCount(
    ".training-route-range-handles input[type='range']",
    2,
  );
}

async function verifyDenseTrainingRouteRangeDragRemainsResponsive() {
  const result = await browser.executeAsync((done) => {
    const handles = document.querySelectorAll(
      ".training-route-range-handles input[type='range']",
    );
    if (handles.length !== 2) {
      done({ duration: null, error: "dense route range handles were not available" });
      return;
    }
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    const started = window.performance.now();
    const stepsPerBoundary = 60;
    const channel = new MessageChannel();
    const scenarios = [{
      control: handles[0],
      from: Number(handles[0].value),
      through: 120,
    }, {
      control: handles[1],
      from: Number(handles[1].value),
      through: 320,
    }];
    let scenarioIndex = 0;
    let step = 0;

    function continueDrag() {
      const scenario = scenarios[scenarioIndex];
      step += 1;
      const progress = step / stepsPerBoundary;
      const value = Math.round(
        scenario.from + (scenario.through - scenario.from) * progress,
      );
      setValue.call(scenario.control, String(value));
      scenario.control.dispatchEvent(new Event("input", { bubbles: true }));
      if (step < stepsPerBoundary) {
        channel.port2.postMessage(null);
        return;
      }
      scenario.control.dispatchEvent(new Event("change", { bubbles: true }));
      scenarioIndex += 1;
      step = 0;
      if (scenarioIndex < scenarios.length) {
        channel.port2.postMessage(null);
        return;
      }
      channel.port1.close();
      channel.port2.close();
      done({
        duration: window.performance.now() - started,
        error: null,
      });
    }

    channel.port1.onmessage = continueDrag;
    channel.port2.postMessage(null);
  });
  if (result.error) throw new Error(result.error);
  expect(result.duration).toBeLessThan(2_500);
  await browser.waitUntil(async () => {
    const snapshot = await browser.execute((previewLabel) => {
      const preview = document.querySelector(`[aria-label="${previewLabel}"]`);
      const loading = document.querySelector(".training-route-draft-status");
      const handles = document.querySelectorAll(
        ".training-route-range-handles input[type='range']",
      );
      const start = handles[0];
      const end = handles[1];
      return {
        end: end?.getAttribute("aria-valuetext") ?? null,
        endValue: end?.value ?? null,
        loading: loading !== null,
        preview: preview !== null,
        start: start?.getAttribute("aria-valuetext") ?? null,
        startValue: start?.value ?? null,
      };
    }, english.training.sessionLibrary.routeWorkbench.draftPreviewRegion);
    return snapshot.preview
      && !snapshot.loading
      && snapshot.start?.startsWith("Point ")
      && snapshot.end?.startsWith("Point ")
      && snapshot.startValue === "120"
      && snapshot.endValue === "320";
  }, {
    timeout: 10_000,
    timeoutMsg: "the exact dense-route preview did not settle after a continuous range drag",
  });
  const cancel = await $(`aria/${english.training.sessionLibrary.ranges.cancel}`);
  await cancel.click();
  await browser.waitUntil(
    async () => (await $$(".training-route-range-handles")).length === 0,
    {
      timeout: 2_000,
      timeoutMsg: "the application did not respond after the dense route range drag",
    },
  );
  await measureTrainingRouteSelection({ value: "0", label: "Point 1 of 20,001" });
}

async function applySleepRange(from, through) {
  await waitForExactControlCount(".sleep-filter input[type='date']", 2);
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
      const rows = document.querySelectorAll(".sleep-exact-evidence table tbody tr");
      const renderedFirstDate = rows[0]?.querySelector("time")?.getAttribute("datetime");
      if (rows.length === expected.expectedRows && renderedFirstDate === expected.expectedFirstDate) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "sleep range was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareSleepRanges(ranges) {
  await waitForExactControlCount(".sleep-comparison input[type='date']", 4);
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
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "sleep comparison was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(result.error);
  return result.duration;
}

async function openSleepDetail(sleepDate) {
  const result = await browser.executeAsync((expectedDate, done) => {
    const row = Array.from(document.querySelectorAll(".sleep-exact-evidence table tbody tr"))
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
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "sleep detail was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, sleepDate);
  if (result.error) throw new Error(`${result.error}: ${sleepDate}`);
  await $(".sleep-detail-heading button").click();
  await browser.waitUntil(async () => (await $$(".sleep-detail")).length === 0, {
    timeout: 5_000,
    timeoutMsg: "sleep detail did not close",
  });
  return result.duration;
}

async function applyRecoveryRange(from, through) {
  await waitForExactControlCount(".recovery-filter input[type='date']", 2);
  const input = {
    from,
    through,
    expectedRows: inclusiveDays(from, through),
    expectedFirstDate: from,
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".recovery-filter input[type='date']");
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
    document.querySelector(".recovery-filter button[type='submit']").click();
    function observeResult() {
      const rows = document.querySelectorAll(".recovery-exact-evidence table tbody tr");
      const renderedFirstDate = rows[0]?.querySelector("time")?.getAttribute("datetime");
      if (rows.length === expected.expectedRows && renderedFirstDate === expected.expectedFirstDate) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "recovery range was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareRecoveryRanges(ranges) {
  await waitForExactControlCount(".recovery-comparison input[type='date']", 4);
  const input = {
    ...ranges,
    expectedBaselineNights: new Intl.NumberFormat("en-US").format(
      inclusiveDays(ranges.baselineFrom, ranges.baselineThrough),
    ),
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".recovery-comparison input[type='date']");
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
    document.querySelector(".recovery-comparison button[type='submit']").click();
    function observeResult() {
      const cells = document.querySelectorAll(
        ".recovery-comparison-result table tbody tr:first-child th, "
        + ".recovery-comparison-result table tbody tr:first-child td",
      );
      if (cells.length === 4 && cells[1].textContent === expected.expectedBaselineNights) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "recovery comparison was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(result.error);
  return result.duration;
}

async function openRecoveryDetail(recoveryDate) {
  const result = await browser.executeAsync((expectedDate, done) => {
    const row = Array.from(document.querySelectorAll(".recovery-exact-evidence table tbody tr"))
      .find((candidate) => candidate.querySelector("time")?.getAttribute("datetime") === expectedDate);
    const button = row?.querySelector("button");
    if (!button) {
      done({ duration: null, error: "recovery detail control was not found" });
      return;
    }
    const started = window.performance.now();
    button.click();
    function observeResult() {
      const detail = document.querySelector(".recovery-detail[aria-busy='false']");
      const renderedDate = detail?.querySelector("time")?.getAttribute("datetime");
      const guidance = detail?.querySelectorAll(".recovery-guidance article");
      if (renderedDate === expectedDate && guidance?.length === 3) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "recovery detail was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, recoveryDate);
  if (result.error) throw new Error(`${result.error}: ${recoveryDate}`);
  await $(".recovery-detail-heading button").click();
  await browser.waitUntil(async () => (await $$(".recovery-detail")).length === 0, {
    timeout: 5_000,
    timeoutMsg: "recovery detail did not close",
  });
  return result.duration;
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

async function applyLongitudinalRange(from, through) {
  await openDisclosure(
    ".longitudinal-insights .explorer-history-workspace > .answer-controls",
  );
  await waitForExactControlCount(".longitudinal-filter input[type='date']", 2);
  const input = {
    from,
    through,
    expectedDateCount: inclusiveDays(from, through),
    expectedFirstDate: from,
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".longitudinal-filter input[type='date']");
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
    document.querySelector(".longitudinal-filter button[type='submit']").click();
    function observeResult() {
      const visual = document.querySelector(".longitudinal-answer-visual");
      const renderedDateCount = Number(visual?.getAttribute("data-longitudinal-date-count"));
      const renderedFirstDate = visual?.getAttribute("data-first-date");
      if (renderedDateCount === expected.expectedDateCount
        && renderedFirstDate === expected.expectedFirstDate) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "longitudinal range was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(`${result.error}: ${from} through ${through}`);
  return result.duration;
}

async function compareLongitudinalRanges(ranges) {
  await openDisclosure(".longitudinal-comparison > .answer-controls");
  await waitForExactControlCount(".longitudinal-comparison input[type='date']", 4);
  const input = {
    ...ranges,
    expectedBaselineTotal: syntheticPeriodTotal(
      ranges.baselineFrom,
      ranges.baselineThrough,
    ),
  };
  const result = await browser.executeAsync((expected, done) => {
    const inputs = document.querySelectorAll(".longitudinal-comparison input[type='date']");
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
    document.querySelector(".longitudinal-comparison button[type='submit']").click();
    function observeResult() {
      const baselineTotal = document.querySelector(
        ".longitudinal-comparison-metrics > section:first-child "
        + ".comparison-bars > div:first-child strong",
      );
      if (baselineTotal?.textContent === expected.expectedBaselineTotal) {
        document.documentElement.getBoundingClientRect();
        setTimeout(() => done({
          duration: window.performance.now() - started,
          error: null,
        }));
        return;
      }
      if (window.performance.now() - started > 5_000) {
        done({ duration: null, error: "longitudinal comparison was not rendered" });
        return;
      }
      setTimeout(observeResult, 16);
    }
    setTimeout(observeResult, 16);
  }, input);
  if (result.error) throw new Error(result.error);
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

async function waitForRecoveryCoverage() {
  await browser.waitUntil(async () => {
    const rows = await $$(".family-coverage-table tbody tr");
    for (const row of rows) {
      if ((await row.$("th").getText()) !== "Nightly recovery") continue;
      const cells = await row.$$("td");
      return (await cells[0].getText()) === "Supported"
        && (await cells[1].getText()) === "1";
    }
    return false;
  }, { timeout: 30_000, timeoutMsg: "performance recovery import did not complete" });
}

async function measureAlternating(executions, scenarios, operation) {
  const timings = [];
  for (let index = 0; index < executions; index += 1) {
    timings.push(await operation(scenarios[index % scenarios.length]));
  }
  return timings;
}

export async function runInsightsPerformanceJourney({
  archivePath,
  chooseArchiveLabel,
  goToHome,
  openHomeQuestion,
  resizeApplication,
  selectArchive,
  selectLocale,
}) {
  await resizeApplication(1024, 720);
  reportPhase("import");
  await selectLocale("en-US", "sources");
  const dialogMock = await browser.tauri.mock("plugin:dialog|open");
  await selectArchive(dialogMock, archivePath, chooseArchiveLabel);
  await $("aria/Import selected package").click();
  await goToHome("explore");
  await waitForDailyActivityCoverage();
  await waitForTrainingCoverage();
  await waitForSleepCoverage();
  await waitForRecoveryCoverage();
  reportPhase("activity");
  await openHomeQuestion("review-activity-steps", "#activity-heading");
  await $("#activity-comparison-heading").waitForDisplayed({ timeout: 10_000 });
  await $(".workspace-navigation button[data-workspace='history']").click();
  await openDisclosure(".activity-history-controls");
  await $(".activity-filter").waitForDisplayed({ timeout: 10_000 });

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
  await $(".workspace-navigation button[data-workspace='comparison']").click();
  await $(".activity-comparison").waitForDisplayed({ timeout: 10_000 });
  await measureAlternating(warmUpRuns, comparisonRanges, compareActivityRanges);
  const commonComparisonTimings = await measureAlternating(
    20,
    comparisonRanges,
    compareActivityRanges,
  );

  reportPhase("training");
  await openHomeQuestion("explore-training-sessions", ".training-insights");
  await browser.waitUntil(
    async () => (await $$(".training-session-results > li")).length === 25,
    { timeout: 10_000, timeoutMsg: "full-history training page did not render" },
  );
  await expect($(".training-session-result-count")).toHaveText(
    "1–25 of 731 matching sessions",
  );
  await $("aria/Next page").click();
  await expect($(".training-session-result-count")).toHaveText(
    "26–50 of 731 matching sessions",
  );
  await $("aria/Previous page").click();
  await expect($(".training-session-result-count")).toHaveText(
    "1–25 of 731 matching sessions",
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
    throw new Error(`maximum training range overflowed: ${JSON.stringify(overflowEvidence)}`);
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
  await applyTrainingRange("2024-01-01", "2025-12-31");
  await $("aria/Calendar").click();
  await expect($(".training-calendar h3")).toHaveText("December 2025");
  const calendarScenarios = [
    { buttonLabel: "Previous month", heading: "November 2025", dayCount: 30 },
    { buttonLabel: "Next month", heading: "December 2025", dayCount: 31 },
  ];
  await measureAlternating(warmUpRuns, calendarScenarios, navigateTrainingCalendar);
  const trainingCalendarTimings = await measureAlternating(
    20,
    calendarScenarios,
    navigateTrainingCalendar,
  );
  await $("aria/Chronology").click();
  await browser.waitUntil(
    async () => (await $$(".training-session-results > li")).length === 25,
    { timeout: 10_000, timeoutMsg: "training chronology did not return from calendar" },
  );
  const comparisonChoices = await $$(
    ".training-session-result-actions input[type='checkbox']",
  );
  for (const choice of comparisonChoices.slice(0, 4)) await choice.click();
  await expect($(".training-session-comparison")).toHaveText(
    expect.stringContaining("4 sessions selected"),
  );
  expect(await $$(".training-session-comparison thead th")).toHaveLength(5);
  await $(".training-session-comparison button.secondary").click();
  reportPhase("training-route");
  await measureAlternating(warmUpRuns, [null], measureTrainingRouteWorkbenchOpen);
  const trainingRouteWorkbenchOpenTimings = await measureAlternating(
    7,
    [null],
    measureTrainingRouteWorkbenchOpen,
  );
  await openDenseTrainingRouteWorkbench();
  const routeSelectionScenarios = [{
    value: "399",
    label: "Point 20,001 of 20,001",
  }, {
    value: "0",
    label: "Point 1 of 20,001",
  }];
  await measureAlternating(
    warmUpRuns,
    routeSelectionScenarios,
    measureTrainingRouteSelection,
  );
  const trainingRouteSelectionTimings = await measureAlternating(
    20,
    routeSelectionScenarios,
    measureTrainingRouteSelection,
  );
  await measureAlternating(
    warmUpRuns,
    [null],
    measureTrainingRouteIndependentSignalReveal,
  );
  const trainingRouteIndependentSignalRevealTimings = await measureAlternating(
    7,
    [null],
    measureTrainingRouteIndependentSignalReveal,
  );
  await openDenseTrainingRouteRangeEditor();
  await verifyDenseTrainingRouteRangeDragRemainsResponsive();
  await expectDenseRouteExactEndpoint();
  await closeTrainingDetail("dense exact route detail did not close");
  reportPhase("training-signals");
  await measureAlternating(warmUpRuns, [null], measureTrainingSignalOverview);
  const trainingSignalMeasurements = await measureAlternating(
    7,
    [null],
    measureTrainingSignalOverview,
  );
  const trainingSignalOverviewTimings = trainingSignalMeasurements.map(
    (measurement) => measurement.overviewDuration,
  );
  const trainingSignalMaximumSelectionTimings = trainingSignalMeasurements.map(
    (measurement) => measurement.maximumSelectionDuration,
  );
  await measureAlternating(warmUpRuns, [null], measureTrainingSignalExactPage);
  const trainingSignalExactPageTimings = await measureAlternating(
    7,
    [null],
    measureTrainingSignalExactPage,
  );
  await verifyTrainingMaximumSignalComposition();

  reportPhase("sleep");
  await openHomeQuestion("review-sleep-patterns", ".sleep-insights");
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

  reportPhase("recovery");
  await openHomeQuestion("review-recovery-patterns", ".recovery-insights");
  const recoveryFilterRange = ([from, through]) => applyRecoveryRange(from, through);
  await measureAlternating(warmUpRuns, commonRanges, recoveryFilterRange);
  const recoveryCommonFilterTimings = await measureAlternating(
    20,
    commonRanges,
    recoveryFilterRange,
  );
  await measureAlternating(warmUpRuns, maximumRanges, recoveryFilterRange);
  const recoveryMaximumFilterTimings = await measureAlternating(
    7,
    maximumRanges,
    recoveryFilterRange,
  );
  await browser.execute(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const maximumRecoveryRangeHasNoHorizontalOverflow = await browser.execute(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  if (!maximumRecoveryRangeHasNoHorizontalOverflow) {
    throw new Error("maximum recovery range overflowed the application viewport");
  }
  await browser.execute(() => {
    document.documentElement.style.fontSize = "";
  });
  await measureAlternating(warmUpRuns, comparisonRanges, compareRecoveryRanges);
  const recoveryCommonComparisonTimings = await measureAlternating(
    20,
    comparisonRanges,
    compareRecoveryRanges,
  );
  await applyRecoveryRange("2025-01-01", "2025-01-30");
  const recoveryDetailDates = ["2025-01-10", "2025-01-20"];
  await measureAlternating(warmUpRuns, recoveryDetailDates, openRecoveryDetail);
  const recoveryDetailTimings = await measureAlternating(
    20,
    recoveryDetailDates,
    openRecoveryDetail,
  );

  reportPhase("longitudinal");
  await openHomeQuestion("align-history", ".longitudinal-insights");
  const longitudinalFilterRange = ([from, through]) => applyLongitudinalRange(from, through);
  await measureAlternating(warmUpRuns, commonRanges, longitudinalFilterRange);
  const longitudinalCommonFilterTimings = await measureAlternating(
    20,
    commonRanges,
    longitudinalFilterRange,
  );
  await measureAlternating(warmUpRuns, maximumRanges, longitudinalFilterRange);
  const longitudinalMaximumFilterTimings = await measureAlternating(
    7,
    maximumRanges,
    longitudinalFilterRange,
  );
  await browser.execute(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const maximumLongitudinalRangeHasNoHorizontalOverflow = await browser.execute(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  if (!maximumLongitudinalRangeHasNoHorizontalOverflow) {
    throw new Error("maximum longitudinal range overflowed the application viewport");
  }
  await browser.execute(() => {
    document.documentElement.style.fontSize = "";
  });
  await measureAlternating(warmUpRuns, comparisonRanges, compareLongitudinalRanges);
  const longitudinalCommonComparisonTimings = await measureAlternating(
    20,
    comparisonRanges,
    compareLongitudinalRanges,
  );

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
      calendarNavigation: measurementEvidence(trainingCalendarTimings, 500),
      routeWorkbenchOpen: measurementEvidence(trainingRouteWorkbenchOpenTimings, 1_000),
      routeSelection: measurementEvidence(trainingRouteSelectionTimings, 100),
      independentSignalReveal: measurementEvidence(
        trainingRouteIndependentSignalRevealTimings,
        250,
      ),
      signalOverview: measurementEvidence(trainingSignalOverviewTimings, 1_000),
      signalMaximumSelection: measurementEvidence(
        trainingSignalMaximumSelectionTimings,
        250,
      ),
      signalExactPage: measurementEvidence(trainingSignalExactPageTimings, 500),
    },
    sleep: {
      commonFilter: measurementEvidence(sleepCommonFilterTimings, 500),
      maximumFilter: measurementEvidence(sleepMaximumFilterTimings, 2_000),
      commonComparison: measurementEvidence(sleepCommonComparisonTimings, 500),
      detail: measurementEvidence(sleepDetailTimings, 500),
    },
    recovery: {
      commonFilter: measurementEvidence(recoveryCommonFilterTimings, 500),
      maximumFilter: measurementEvidence(recoveryMaximumFilterTimings, 2_000),
      commonComparison: measurementEvidence(recoveryCommonComparisonTimings, 500),
      detail: measurementEvidence(recoveryDetailTimings, 500),
    },
    longitudinal: {
      commonFilter: measurementEvidence(longitudinalCommonFilterTimings, 500),
      maximumFilter: measurementEvidence(longitudinalMaximumFilterTimings, 2_000),
      commonComparison: measurementEvidence(longitudinalCommonComparisonTimings, 500),
    },
  };
  process.stdout.write(`${JSON.stringify(evidence(measurements))}\n`);
  for (const domain of Object.values(measurements)) {
    for (const measurement of Object.values(domain)) {
      expect(measurement.passed).toBe(true);
    }
  }
}
