import { beforeEach, describe, expect, it, vi } from "vitest";

import { openOfficialSourceLink } from "./official-source-link";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

beforeEach(() => mocks.invoke.mockReset());

describe("official source link adapter", () => {
  it("delegates the exact validated URL to the operating system", async () => {
    mocks.invoke.mockResolvedValue({
      sourceId: "synthetic-source",
      purpose: "instructions",
      url: "https://support.example.test/export",
    });

    const outcome = await openOfficialSourceLink(
      {
        sourceId: "synthetic-source",
        purpose: "instructions",
        locale: "en-US",
      },
      "https://support.example.test/export",
    );

    expect(mocks.invoke).toHaveBeenCalledWith("open_official_source_link", {
      request: {
        sourceId: "synthetic-source",
        purpose: "instructions",
        locale: "en-US",
      },
    });
    expect(outcome.url).toBe("https://support.example.test/export");
  });
});
