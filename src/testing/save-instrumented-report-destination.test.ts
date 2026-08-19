import { afterEach, describe, expect, it, vi } from "vitest";

import { saveInstrumentedReportDestination } from "./save-instrumented-report-destination";

interface InstrumentedWindow extends Window {
  __wdio_mocks__?: Record<string, (arguments_?: unknown) => unknown>;
}

const options = {
  defaultPath: "Morning-progression.html",
  filters: [{ name: "HTML", extensions: ["html"] }],
};

afterEach(() => {
  delete (window as InstrumentedWindow).__wdio_mocks__;
});

describe("saveInstrumentedReportDestination", () => {
  it("forwards the complete native-dialog contract and returns selection or cancellation", async () => {
    const saveDialog = vi
      .fn()
      .mockResolvedValueOnce("/private/synthetic/Morning-progression.html")
      .mockResolvedValueOnce(null);
    (window as InstrumentedWindow).__wdio_mocks__ = {
      "plugin:dialog|save": saveDialog,
    };

    await expect(saveInstrumentedReportDestination(options)).resolves.toBe(
      "/private/synthetic/Morning-progression.html",
    );
    await expect(saveInstrumentedReportDestination(options)).resolves.toBeNull();
    expect(saveDialog).toHaveBeenNthCalledWith(1, { options });
    expect(saveDialog).toHaveBeenNthCalledWith(2, { options });
  });

  it("rejects a missing mock or an invalid dialog result", async () => {
    await expect(saveInstrumentedReportDestination(options)).rejects.toThrow(
      "requires a configured dialog mock",
    );
    (window as InstrumentedWindow).__wdio_mocks__ = {
      "plugin:dialog|save": vi.fn().mockResolvedValue(["unexpected"]),
    };
    await expect(saveInstrumentedReportDestination(options)).rejects.toThrow(
      "received an invalid dialog result",
    );
  });
});
