import fs from "node:fs";

import { e2eApplicationBinary } from "../../scripts/e2e-paths.mjs";
import { goToHome } from "./support/application-actions.js";
import {
  exactApplicationProcessId,
  readRestartProcessIdentity,
} from "./support/application-process.js";

const spanish = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/es-ES.json", import.meta.url), "utf8"),
);
const restartIdentityPath = process.env.FITFREED_E2E_RESTART_IDENTITY_PATH;

describe("packaged bundled sport-catalogue process restart", () => {
  it("reopens the imported sport as a localized recognized identity", async () => {
    if (restartIdentityPath === undefined) {
      throw new Error("sport-catalogue restart identity path is required");
    }
    const previousProcessId = readRestartProcessIdentity(restartIdentityPath);
    expect(exactApplicationProcessId(e2eApplicationBinary)).not.toBe(previousProcessId);

    await expect($("html")).toHaveAttribute("lang", "es-ES");
    await goToHome("home");
    const sport = await $(".library-home-sports li");
    await sport.waitForDisplayed({ timeout: 10_000 });
    await expect(sport.$("strong")).toHaveText("Correr");
    expect(await sport.$$(".library-home-sport-classify")).toHaveLength(0);

    await sport.$(".library-home-sport-open").click();
    await $(".training-session-library").waitForDisplayed({ timeout: 10_000 });
    await browser.waitUntil(
      async () => (await $$(".training-session-results > li")).length === 1,
      { timeout: 10_000, timeoutMsg: "recognized sessions did not finish loading after restart" },
    );
    const sessions = await $$(".training-session-results > li");
    expect(sessions).toHaveLength(1);
    await expect(sessions[0].$(".training-session-sport")).toHaveText("Correr");

    const overview = await browser.executeAsync((done) => {
      window.__TAURI__.core.invoke("query_training_sports")
        .then((value) => done({ value, error: null }))
        .catch((error) => done({ value: null, error: String(error) }));
    });
    expect(overview.error).toBeNull();
    expect(overview.value.sports).toHaveLength(1);
    expect(overview.value.sports[0].state).toBe("recognized");
    expect(overview.value.sports[0].recognition.canonicalFamily).toBe("running");
  });
});
