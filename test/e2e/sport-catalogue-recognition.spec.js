import fs from "node:fs";
import path from "node:path";

import { e2eApplicationBinary } from "../../scripts/e2e-paths.mjs";
import {
  goToHome,
  resizeApplication,
  selectArchive,
  selectLocale,
  waitForNotice,
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

async function expectRecognizedSport(name) {
  const overview = await browser.executeAsync((done) => {
    window.__TAURI__.core.invoke("query_training_sports")
      .then((value) => done({ value, error: null }))
      .catch((error) => done({ value: null, error: String(error) }));
  });
  expect(overview.error).toBeNull();
  expect(overview.value.sports).toHaveLength(1);
  expect(overview.value.sports[0].state).toBe("recognized");
  expect(overview.value.sports[0].recognition.canonicalFamily).toBe("running");

  await goToHome("home");
  const sport = await $(".library-home-sports li");
  await sport.waitForDisplayed({ timeout: 10_000 });
  await expect(sport.$("strong")).toHaveText(name);
  expect(await sport.$$(".library-home-sport-classify")).toHaveLength(0);
  await sport.$(".library-home-sport-open").click();
  await $(".training-session-library").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => (await $$(".training-session-results > li")).length === 1,
    { timeout: 10_000, timeoutMsg: `${name} sessions did not finish loading` },
  );
  const sessions = await $$(".training-session-results > li");
  expect(sessions).toHaveLength(1);
  await expect(sessions[0].$(".training-session-sport")).toHaveText(name);
}

describe("packaged bundled sport-catalogue recognition", () => {
  it("recognizes imported source identifiers in both locales and across exact reimport", async () => {
    if (fixtureDirectory === undefined || restartIdentityPath === undefined) {
      throw new Error("sport-catalogue E2E paths are required");
    }
    await resizeApplication(1280, 800);
    const fixture = path.join(fixtureDirectory, "sport-catalogue-recognition.zip");
    const dialogMock = await browser.tauri.mock("plugin:dialog|open");

    await selectArchive(dialogMock, fixture, english.home.emptyAction);
    await $(`aria/${english.import}`).click();
    await waitForNotice(english.home.postImportChanged);
    await expectRecognizedSport("Running");

    await selectLocale("es-ES", "home");
    await expectRecognizedSport("Correr");

    await goToHome("sources");
    await selectArchive(dialogMock, fixture, spanish.outcome.chooseAnother);
    await $(`aria/${spanish.import}`).click();
    await waitForNotice(spanish.home.postImportExactRepeat);
    await expectRecognizedSport("Correr");
    await goToHome("home");

    recordRestartProcessIdentity(restartIdentityPath, e2eApplicationBinary);
  });
});
