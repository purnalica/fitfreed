import { beforeEach, describe, expect, it, vi } from "vitest";

import { openOfficialSourceLink } from "./official-source-link";

const mocks = vi.hoisted(() => ({ openUrl: vi.fn() }));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: mocks.openUrl }));

beforeEach(() => mocks.openUrl.mockReset());

describe("official source link adapter", () => {
  it("delegates the exact validated URL to the operating system", async () => {
    mocks.openUrl.mockResolvedValue(undefined);

    await openOfficialSourceLink("https://support.example.test/export");

    expect(mocks.openUrl).toHaveBeenCalledWith("https://support.example.test/export");
  });
});
