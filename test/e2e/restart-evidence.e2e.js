import fs from "node:fs";

import { e2eApplicationBinary } from "../../scripts/e2e-paths.mjs";
import {
  goToHome,
  waitForElementCount,
} from "./support/application-actions.js";
import {
  exactApplicationProcessId,
  readRestartProcessIdentity,
} from "./support/application-process.js";

const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);
const restartIdentityPath = process.env.FITFREED_E2E_RESTART_IDENTITY_PATH;

async function openTrainingWorkspace(workspace) {
  const label = spanish.training.workspaces[workspace];
  const buttons = await $$(".training-workspace-navigation button");
  for (const button of buttons) {
    if (await button.getText() !== label) continue;
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    return;
  }
  throw new Error(`training workspace was not available: ${label}`);
}

async function openTrainingDetailSection(section) {
  const label = spanish.training.sessionLibrary.detailSections[section];
  const buttons = await $$(".training-detail-navigation button");
  for (const button of buttons) {
    if (await button.getText() !== label) continue;
    await button.click();
    await expect(button).toHaveAttribute("aria-current", "page");
    return;
  }
  throw new Error(`training detail section was not available: ${label}`);
}

describe("packaged FitFreed application-process restart", () => {
  it("recovers durable user state through a new packaged process", async () => {
    if (restartIdentityPath === undefined) {
      throw new Error("restart identity path is required for process-restart evidence");
    }
    const previousProcessId = readRestartProcessIdentity(restartIdentityPath);
    const currentProcessId = exactApplicationProcessId(e2eApplicationBinary);
    expect(currentProcessId).not.toBe(previousProcessId);

    await $(".training-insights").waitForDisplayed({ timeout: 10_000 });
    await expect($("html")).toHaveAttribute("lang", "es-ES");
    await expect($("html")).toHaveAttribute("data-appearance", "dark");
    expect(await browser.execute(
      () => document.documentElement.style.getPropertyValue("--content-zoom"),
    )).toBe("2");
    await expect($(".app-sidebar nav button[data-home='explore']"))
      .toHaveAttribute("aria-current", "page");

    const workspace = await browser.executeAsync((done) => {
      window.__TAURI__.core.invoke("load_training_discovery_workspace")
        .then((value) => done({ value, error: null }))
        .catch((error) => done({ value: null, error: String(error) }));
    });
    expect(workspace.error).toBeNull();
    expect(workspace.value).toEqual(expect.objectContaining({
      view: "calendar",
      calendarMonth: "2026-01",
      calendarDay: "2026-01-04",
      openSessionRef: expect.stringMatching(/^session-[0-9a-f]{64}$/),
      selectedSessionRefs: expect.arrayContaining([
        expect.stringMatching(/^session-[0-9a-f]{64}$/),
        expect.stringMatching(/^session-[0-9a-f]{64}$/),
      ]),
    }));
    const viewControls = await $$(
      ".training-session-view-switch input[type='radio']",
    );
    expect(viewControls).toHaveLength(2);
    await expect(viewControls[1]).toBeChecked();
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

    await openTrainingWorkspace("sports");
    const unifiedSport = await $(
      ".training-sport-list > li[data-state='personally-overridden']",
    );
    await expect(unifiedSport.$("h3")).toHaveText("Carrera de montaña");
    await expect(unifiedSport).toHaveText(expect.stringContaining(
      spanish.training.sports.unification.label.replace("{count}", "5"),
    ));
    await unifiedSport.$(`aria/${spanish.training.sports.unification.edit}`).click();
    const unificationTask = await unifiedSport.$(".sport-unification-task");
    await unificationTask.waitForDisplayed({ timeout: 10_000 });
    const memberInputs = await unificationTask.$$(
      ".sport-unification-options input[type='checkbox']",
    );
    expect(memberInputs).toHaveLength(5);
    for (const input of memberInputs) await expect(input).toBeChecked();
    await unificationTask.$(`aria/${spanish.training.sports.unification.cancel}`).click();
    await openTrainingWorkspace("sessions");
    await openTrainingDetailSection("structure");
    const criteria = await $$(".training-segmentation .training-segment-criterion");
    expect(criteria).toHaveLength(2);
    await expect(criteria[0].$("h6")).toHaveText("Race plan");
    await expect(criteria[1].$("h6")).toHaveText("Quarter-hour blocks");
    await openTrainingDetailSection("ranges");
    await expect($(".training-range-inspector h4")).toHaveText("Ridge effort");
    await expect($(".training-range-inspector")).toHaveText(
      expect.stringContaining(spanish.training.sessionLibrary.ranges.current),
    );

    await goToHome("reports");
    await expect($(".reports-hero h1")).toHaveText(spanish.reports.heading);
    const reports = await $$(".report-list .report-library-open");
    expect(reports).toHaveLength(4);
    const reportLabels = [];
    let comparisonReport;
    for (const report of reports) {
      const label = await report.getText();
      reportLabels.push(label);
      if (label.includes("Synthetic comparison answer")) comparisonReport = report;
    }
    expect(reportLabels.some((label) => label.includes("Synthetic ridge progression")))
      .toBe(true);
    expect(reportLabels.some((label) => label.includes("Synthetic reusable comparison copy")))
      .toBe(true);
    expect(reportLabels.some((label) => label.includes("Training plan · Progressive intervals")))
      .toBe(true);
    expect(comparisonReport).toBeDefined();
    await comparisonReport.click();
    expect(await $$(".report-preview .report-narrative")).toHaveLength(0);

    const removeAction = await $(`aria/${spanish.reports.delete.action}`);
    await removeAction.click();
    let removalReview = await $(".report-delete-review");
    await expect(removalReview).toHaveText(
      expect.stringContaining(spanish.reports.delete.boundary),
    );
    await removalReview.$(`aria/${spanish.reports.delete.cancel}`).click();
    await expect(removeAction).toBeFocused();

    await removeAction.click();
    removalReview = await $(".report-delete-review");
    await removalReview.$(`aria/${spanish.reports.delete.confirm.replace(
      "{title}",
      "Synthetic comparison answer",
    )}`).click();
    await expect($(".report-library [role='status']")).toHaveText(
      spanish.reports.delete.removed.replace("{title}", "Synthetic comparison answer"),
    );
    const remainingReports = await $$(".report-list .report-library-open");
    expect(remainingReports).toHaveLength(3);
    const remainingLabels = [];
    for (const report of remainingReports) remainingLabels.push(await report.getText());
    expect(remainingLabels.some((label) => label.includes("Synthetic ridge progression")))
      .toBe(true);
    expect(remainingLabels.some((label) => label.includes("Synthetic reusable comparison copy")))
      .toBe(true);
    expect(remainingLabels.some((label) => label.includes("Training plan · Progressive intervals")))
      .toBe(true);

    await goToHome("explore");
    await expect($("#training-session-detail-heading")).toHaveText(
      spanish.training.sessionLibrary.detailHeading,
    );
    await openTrainingWorkspace("plans");
    await expect($("#planned-training-heading")).toHaveText(spanish.training.planned.heading);
    const plannedTargets = await waitForElementCount(
      ".planned-training-list > li",
      4,
      { timeoutMsg: "the restored planned-training library did not reveal its four targets" },
    );
    expect(plannedTargets).toHaveLength(4);
    const plannedTargetLabels = [];
    for (const target of plannedTargets) plannedTargetLabels.push(await target.getText());
    expect(plannedTargetLabels.filter((label) => label.includes("Progressive intervals")))
      .toHaveLength(1);
    expect(plannedTargetLabels.filter((label) => label.includes("Synthetic steady session")))
      .toHaveLength(1);

    await openTrainingWorkspace("sports");
    const persistedUnifiedSport = await $(
      ".training-sport-list > li[data-state='personally-overridden']",
    );
    await persistedUnifiedSport.$(
      `aria/${spanish.training.sports.unification.edit}`,
    ).click();
    const persistedUnificationTask = await persistedUnifiedSport.$(".sport-unification-task");
    await persistedUnificationTask.$(
      `aria/${spanish.training.sports.unification.remove}`,
    ).click();
    const sportRemovalReview = await persistedUnificationTask.$(
      ".sport-unification-removal",
    );
    await expect(sportRemovalReview.$("p")).toHaveText(
      spanish.training.sports.unification.removeConfirm,
    );
    await sportRemovalReview.$(
      `aria/${spanish.training.sports.unification.removeAction}`,
    ).click();
    await expect($(".training-sports-status")).toHaveText(
      spanish.training.sports.unification.removed,
    );
    const separatedSports = await $$(".training-sport-list > li");
    expect(separatedSports).toHaveLength(4);
    await expect($(".training-sport-list > li[data-state='personally-overridden'] h3"))
      .toHaveText("Carrera de montaña");
    await expect($(".training-sport-list > li[data-state='unavailable'] h3"))
      .toHaveText(spanish.training.sports.notRecorded);
    await expect($(".training-sport-list > li[data-state='recognized']"))
      .toBeDisplayed();

    await goToHome("sources");
    await expect($("#outcome-heading")).toHaveText(spanish.outcome.changedHeading);
  });
});
