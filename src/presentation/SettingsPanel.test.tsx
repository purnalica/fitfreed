import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
          defaultPreferences={savedPreferences}
          messages={catalogs["en-US"].settings}
          workspace={workspace}
          disabled={false}
          savedNotice={false}
          onWorkspaceChange={setWorkspace}
          onPreview={vi.fn()}
          onSave={vi.fn()}
          updatePanel={<section aria-label="Update maintenance">Update controls</section>}
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
    expect(screen.getByRole("complementary", {
      name: "Interface preview",
      hidden: true,
    })).not.toBeVisible();
    expect(screen.getByRole("region", { name: "Update maintenance" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Application settings" }))
      .toContainElement(screen.getByRole("region", { name: "Update maintenance" }));

    await user.click(within(navigation).getByRole("button", { name: "Appearance & language" }));
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(screen.getByLabelText("Default content zoom")).toHaveValue("175");
    expect(screen.queryByRole("region", { name: "Update maintenance" }))
      .not.toBeInTheDocument();
  });

  it("uses a concrete interface example and lets the complete draft be cancelled", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();

    render(
      <SettingsPanel
        savedPreferences={savedPreferences}
        defaultPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
      />,
    );

    const preview = screen.getByRole("article", { name: "Interface preview" });
    expect(within(preview).getByText("Example session")).toBeVisible();
    expect(within(preview).getByText("Running")).toBeVisible();
    expect(within(preview).getByText("42 min")).toBeVisible();
    expect(within(preview).getByText("8.2 km")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Restore defaults" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel changes" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.selectOptions(screen.getByLabelText("Default content zoom"), "175");
    await user.click(screen.getByRole("button", { name: "Cancel changes" }));

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(screen.getByLabelText("Default content zoom")).toHaveValue("100");
    expect(onPreview).toHaveBeenLastCalledWith(savedPreferences);
    expect(screen.queryByText("Changes not saved")).not.toBeInTheDocument();
  });

  it("previews and saves every application preference as one set", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsPanel
        savedPreferences={savedPreferences}
        defaultPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={onPreview}
        onSave={onSave}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Interface language"), "es-ES");
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    await user.selectOptions(screen.getByLabelText("Default content zoom"), "175");

    expect(screen.getByRole("status")).toHaveTextContent("Changes not saved");
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

  it("keeps an unsaved draft until guarded navigation is explicitly discarded", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onDirtyChange = vi.fn();
    const onDiscardAndContinue = vi.fn();

    function GuardHarness() {
      const [guarded, setGuarded] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setGuarded(true)}>Request navigation</button>
          <SettingsPanel
            savedPreferences={savedPreferences}
            defaultPreferences={savedPreferences}
            messages={catalogs["en-US"].settings}
            workspace="appearance"
            disabled={false}
            savedNotice={false}
            onWorkspaceChange={vi.fn()}
            onPreview={onPreview}
            onSave={vi.fn()}
            onDirtyChange={onDirtyChange}
            navigationGuard={guarded
              ? {
                  destinationLabel: "Home",
                  onKeepEditing: () => setGuarded(false),
                  onDiscardAndContinue,
                }
              : undefined}
          />
        </>
      );
    }

    render(<GuardHarness />);
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    await user.click(screen.getByRole("button", { name: "Request navigation" }));
    const guard = screen.getByRole("alertdialog", { name: "Unsaved changes" });
    expect(guard).toHaveTextContent("Home");
    const keepEditing = within(guard).getByRole("button", { name: "Keep editing" });
    await waitFor(() => expect(keepEditing).toHaveFocus());
    await user.click(keepEditing);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Request navigation" }));
    await user.click(screen.getByRole("button", { name: "Discard changes and leave" }));
    expect(onPreview).toHaveBeenLastCalledWith(savedPreferences);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    expect(onDiscardAndContinue).toHaveBeenCalledOnce();
  });

  it("blocks every mutable control and draft action when disabled", async () => {
    const user = userEvent.setup();
    const view = render(
      <SettingsPanel
        savedPreferences={{ ...savedPreferences, appearance: "light", contentZoomPercent: 150 }}
        defaultPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Interface language")).toBeDisabled();
    expect(screen.getByRole("radio", { name: "System" })).toBeDisabled();
    expect(screen.getByLabelText("Default content zoom")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Restore defaults" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Cancel changes" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" }))
      .not.toBeInTheDocument();

    view.rerender(
      <SettingsPanel
        savedPreferences={{ ...savedPreferences, appearance: "light", contentZoomPercent: 150 }}
        defaultPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
    expect(screen.getByLabelText("Default content zoom")).toHaveValue("100");
    expect(screen.getByRole("status")).toHaveTextContent("Changes not saved");
    expect(screen.queryByRole("button", { name: "Restore defaults" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });

  it("keeps settings actions stable and announces progress while preferences are saved", () => {
    render(
      <SettingsPanel
        savedPreferences={savedPreferences}
        defaultPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        operation="save"
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("form", { name: "Appearance and language" }))
      .toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("button", { name: "Restore defaults" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel changes" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
  });

  it("keeps restoring defaults inside the draft and reserves busy progress for saving", async () => {
    const user = userEvent.setup();
    const onPreview = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsPanel
        savedPreferences={{ ...savedPreferences, appearance: "dark" }}
        defaultPreferences={savedPreferences}
        messages={catalogs["en-US"].settings}
        workspace="appearance"
        disabled={false}
        savedNotice={false}
        onWorkspaceChange={vi.fn()}
        onPreview={onPreview}
        onSave={onSave}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Restore defaults" }));
    const form = screen.getByRole("form", { name: "Appearance and language" });
    expect(form).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByRole("button", { name: "Restore defaults" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel changes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Changes not saved");
    expect(onPreview).toHaveBeenLastCalledWith(savedPreferences);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByText("Saving…")).not.toBeInTheDocument();
  });
});
