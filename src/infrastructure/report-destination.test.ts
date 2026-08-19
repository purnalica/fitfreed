import { beforeEach, describe, expect, it, vi } from "vitest";

import { chooseReportDestination, reportDestinationOptions } from "./report-destination";

const mocks = vi.hoisted(() => ({ save: vi.fn() }));

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mocks.save }));

beforeEach(() => mocks.save.mockReset());

describe("report destination", () => {
  it("derives a portable HTML filename without leaking path syntax", () => {
    expect(reportDestinationOptions("  Côte / climb: 10 km?  ")).toEqual({
      defaultPath: "Cote-climb-10-km.html",
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    expect(reportDestinationOptions("///").defaultPath).toBe("fitfreed-report.html");
  });

  it("preserves both a chosen destination and explicit dialog cancellation", async () => {
    mocks.save.mockResolvedValueOnce("/private/output/report.html").mockResolvedValueOnce(null);
    await expect(chooseReportDestination("Report")).resolves.toBe("/private/output/report.html");
    await expect(chooseReportDestination("Report")).resolves.toBeNull();
  });
});
