import fs from "node:fs";

import {
  goToHome,
  openHomeQuestion,
  selectArchive,
  selectLocale,
} from "./support/application-actions.js";
import { runInsightsPerformanceJourney } from "./support/insights-performance.js";

const english = JSON.parse(
  fs.readFileSync(new URL("../../src/locales/en-US.json", import.meta.url), "utf8"),
);
const insightsPerformanceArchive = process.env.FITFREED_E2E_INSIGHTS_PERFORMANCE_ARCHIVE;

describe("packaged FitFreed insight performance", () => {
  it("meets domain and longitudinal insight budgets in an isolated library", async () => {
    await runInsightsPerformanceJourney({
      archivePath: insightsPerformanceArchive,
      chooseArchiveLabel: english.choose,
      goToHome,
      openHomeQuestion: (kind, expectedSelector) => (
        openHomeQuestion(english, kind, expectedSelector)
      ),
      selectArchive,
      selectLocale,
    });
  });
});
