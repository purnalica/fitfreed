import fs from "node:fs";

import { e2eApplicationBinary } from "../../scripts/e2e-paths.mjs";
import { accessibleDescription } from "./support/accessibility.js";
import {
  goToHome,
  openHomeQuestion,
} from "./support/application-actions.js";
import {
  exactApplicationProcessId,
  readRestartProcessIdentity,
} from "./support/application-process.js";

const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);
const restartIdentityPath = process.env.FITFREED_E2E_RESTART_IDENTITY_PATH;

async function openTrainingWorkspace() {
  const label = spanish.training.workspaces.sessions;
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

async function openPersonalRanges() {
  const label = spanish.training.sessionLibrary.detailSections.ranges;
  const buttons = await $$(".training-detail-navigation button");
  for (const button of buttons) {
    if (await button.getText() !== label) continue;
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    await $("#training-detail-ranges").waitForDisplayed({ timeout: 10_000 });
    return;
  }
  throw new Error(`training detail section was not available: ${label}`);
}

describe("packaged independent-signal range restart", () => {
  it("restores the exact range through a new process after an exact reimport", async () => {
    if (restartIdentityPath === undefined) {
      throw new Error("adaptive restart identity path is required");
    }
    const previousProcessId = readRestartProcessIdentity(restartIdentityPath);
    const currentProcessId = exactApplicationProcessId(e2eApplicationBinary);
    expect(currentProcessId).not.toBe(previousProcessId);

    await expect($("html")).toHaveAttribute("lang", "es-ES");
    await expect($("html")).toHaveAttribute("data-appearance", "dark");
    expect(await browser.execute(
      () => document.documentElement.style.getPropertyValue("--content-zoom"),
    )).toBe("2");

    await goToHome("home");
    await openHomeQuestion(
      spanish,
      "explore-training-sessions",
      ".training-insights",
    );
    await openTrainingWorkspace();
    await openSessionByDate("10 ene 2026");

    const workbench = await $(".training-signal-workbench");
    await workbench.waitForDisplayed({ timeout: 10_000 });
    await expect(workbench.$(".training-signal-saved-range strong"))
      .toHaveText("Steady signal");
    const signalChart = await workbench.$(".analytical-chart-canvas");
    await signalChart.waitForDisplayed({ timeout: 10_000 });
    expect(await accessibleDescription(signalChart)).toContain(
      "Mostrado en el gráfico: Steady signal · 0:15:00–0:45:00.",
    );

    await openPersonalRanges();
    const inspector = await $(".training-range-inspector");
    await inspector.waitForDisplayed({ timeout: 10_000 });
    await expect(inspector.$("h4")).toHaveText("Steady signal");
    await expect(inspector).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.ranges.current),
    );

    await $(`aria/${spanish.training.sessionLibrary.closeDetail}`).click();
    await $(".training-session-results").waitForDisplayed({ timeout: 10_000 });
    await openSessionByDate("11 ene 2026");
    const structureWorkbench = await $(".training-structure-workbench");
    await structureWorkbench.waitForDisplayed({ timeout: 10_000 });
    expect(await structureWorkbench.$$(".training-structure-personal-range"))
      .toHaveLength(1);
    expect(await structureWorkbench.$$(
      ".training-structure-workbench-source .training-structure-workbench-track i",
    )).toHaveLength(2);
    await openPersonalRanges();
    const structureInspector = await $(".training-range-inspector");
    await structureInspector.waitForDisplayed({ timeout: 10_000 });
    await expect(structureInspector.$("h4")).toHaveText("First source lap");
    await expect(structureInspector).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.ranges.current),
    );
  });
});
