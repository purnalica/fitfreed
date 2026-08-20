import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

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
  it("separates preference editing from updates without discarding a draft", async () => {
    const user = userEvent.setup();

    function SettingsHarness() {
      const [workspace, setWorkspace] = useState<"appearance" | "updates">("appearance");
      return (
        <SettingsPanel
          savedPreferences={savedPreferences}
          messages={catalogs["en-US"].settings}
          workspace={workspace}
          disabled={false}
          savedNotice={false}
          onWorkspaceChange={setWorkspace}
          onPreview={vi.fn()}
          onSave={vi.fn()}
          onReset={vi.fn()}
        />
      );
    }

    render(<SettingsHarness />);

    const navigation = screen.getByRole("navigation", { name: "Settings categories" });
    expect(within(navigation).getByRole("button", { name: "Appearance & language" }))
      .toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.selectOptions(screen.getByLabelText("Default content zoom"), "175");

    await user.click(within(navigation).getByRole("button", { name: "Updates" }));
    expect(within(navigation).getByRole("button", { name: "Updates" }))
      .toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("form", {
      name: "Appearance and language",
      hidden: true,
    })).not.toBeVisible();
    expect(screen.getByLabelText("Preview")).not.toBeVisible();

    await user.click(within(navigation).getByRole("button", { name: "Appearance & language" }));
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByLabelText("Default content zoom")).toHaveValue("175");
  });

  it("previews and saves every application preference as one set", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsPanel
        savedPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
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
        workspace="appearance"
        disabled
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
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
        workspace="appearance"
        disabled={false}
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        onReset={onReset}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("keeps settings actions stable and announces progress while preferences are saved", () => {
    render(
      <SettingsPanel
        savedPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        operation="save"
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("form", { name: "Appearance and language" }))
      .toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Restore defaults" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
  });

  it("keeps both settings actions stable and announces default restoration distinctly", () => {
    render(
      <SettingsPanel
        savedPreferences={{ ...savedPreferences, appearance: "dark" }}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        operation="reset"
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const form = screen.getByRole("form", { name: "Appearance and language" });
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Restore defaults" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Restoring defaults…");
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
  });
});
