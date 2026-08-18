import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { ApplicationPreferences } from "./application-preferences";
import { SettingsPanel } from "./SettingsPanel";

const savedPreferences: ApplicationPreferences = {
  version: 1,
  locale: "en-US",
  appearance: "system",
  contentZoomPercent: 100,
};

afterEach(cleanup);

describe("SettingsPanel", () => {
  it("previews and saves every application preference as one set", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsPanel
        savedPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        disabled={false}
        saving={false}
        savedNotice={false}
        onPreview={onPreview}
        onSave={onSave}
        onReset={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Interface language"), "es-ES");
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.selectOptions(screen.getByLabelText("Default content zoom"), "175");

    expect(screen.getByRole("status")).toHaveTextContent("Previewing unsaved changes");
    expect(onPreview).toHaveBeenLastCalledWith({
      version: 1,
      locale: "es-ES",
      appearance: "dark",
      contentZoomPercent: 175,
    });

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onSave).toHaveBeenCalledWith({
      version: 1,
      locale: "es-ES",
      appearance: "dark",
      contentZoomPercent: 175,
    });
  });

  it("requests a complete reset and blocks every mutable control when disabled", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <SettingsPanel
        savedPreferences={{ ...savedPreferences, appearance: "light", contentZoomPercent: 150 }}
        messages={catalogs["en-US"].settings}
        disabled
        saving={false}
        savedNotice={false}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        onReset={onReset}
      />,
    );

    expect(screen.getByLabelText("Interface language")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "System" })).toBeDisabled();
    expect(screen.getByLabelText("Default content zoom")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore defaults" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();

    view.rerender(
      <SettingsPanel
        savedPreferences={{ ...savedPreferences, appearance: "light", contentZoomPercent: 150 }}
        messages={catalogs["en-US"].settings}
        disabled={false}
        saving={false}
        savedNotice={false}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});
