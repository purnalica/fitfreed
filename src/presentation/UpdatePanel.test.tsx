import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { UpdatePanel, type UpdateCheckOutcome } from "./UpdatePanel";

const invoke = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

function outcome(overrides: Partial<UpdateCheckOutcome> = {}): UpdateCheckOutcome {
  return {
    installedVersion: "0.1.0",
    checkedAt: "2026-08-16T12:00:00Z",
    status: "available",
    release: {
      version: "0.2.0",
      publishedAt: "2026-08-16T10:00:00Z",
      releaseNotes: "A safer release with improved import recovery.",
      minimumSupportedVersion: "0.1.0",
      targetLibrarySchemaVersion: 9,
    },
    installedWithdrawal: null,
    updateActionAvailable: true,
    postponedUntil: null,
    manualRecoveryReason: null,
    trustFailure: null,
    ...overrides,
  };
}

afterEach(cleanup);

beforeEach(() => {
  invoke.mockReset();
});

describe("UpdatePanel", () => {
  it("announces an authenticated launch update and persists a 24-hour postponement", async () => {
    invoke.mockImplementation((command) => {
      if (command === "check_for_updates_on_launch") return Promise.resolve(outcome());
      if (command === "postpone_available_update") {
        return Promise.resolve("2026-08-17T12:00:00Z");
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = await screen.findByRole("region", { name: "Application updates" });
    expect(within(panel).getByText("Version 0.2.0 is available.")).toBeVisible();
    expect(within(panel).getByText(/improved import recovery/)).toBeVisible();
    expect(within(panel).getByText(/preserves the current application and library/)).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Install and restart" })).toBeEnabled();
    await user.click(within(panel).getByRole("button", { name: "Remind me tomorrow" }));

    expect(invoke).toHaveBeenCalledWith("postpone_available_update", {
      candidateVersion: "0.2.0",
    });
    expect(await within(panel).findByText(/reminder is postponed until/)).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Remind me tomorrow" }))
      .not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Install and restart" }))
      .not.toBeInTheDocument();
  });

  it("installs the exact authorized candidate and prevents conflicting actions", async () => {
    let completeInstallation!: () => void;
    invoke.mockImplementation((command) => {
      if (command === "check_for_updates_on_launch") return Promise.resolve(outcome());
      if (command === "install_available_update") {
        return new Promise<void>((resolve) => {
          completeInstallation = resolve;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = await screen.findByRole("region", { name: "Application updates" });
    await user.click(within(panel).getByRole("button", { name: "Install and restart" }));

    expect(invoke).toHaveBeenCalledWith("install_available_update", {
      candidateVersion: "0.2.0",
    });
    expect(within(panel).getByText("Installing version 0.2.0…")).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Installing…" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Check now" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Remind me tomorrow" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Ignore this version" })).toBeDisabled();

    await act(async () => completeInstallation());
    expect(within(panel).getByRole("button", { name: "Installing…" })).toBeDisabled();
  });

  it("reports an installation failure without losing the trusted release", async () => {
    invoke.mockImplementation((command) => {
      if (command === "check_for_updates_on_launch") return Promise.resolve(outcome());
      if (command === "install_available_update") {
        return Promise.reject({ code: "update-native-installer-failed", detail: "private path" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = await screen.findByRole("region", { name: "Application updates" });
    await user.click(within(panel).getByRole("button", { name: "Install and restart" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "could not install the verified update",
    );
    expect(within(panel).getByRole("alert")).not.toHaveTextContent("private path");
    expect(within(panel).getByText("Version 0.2.0 is available.")).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Install and restart" })).toBeEnabled();
  });

  it("disables installation while another desktop mutation is active", async () => {
    invoke.mockResolvedValue(outcome());

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
        installationBlocked
      />,
    );

    const panel = await screen.findByRole("region", { name: "Application updates" });
    expect(within(panel).getByRole("button", { name: "Install and restart" })).toBeDisabled();
  });

  it("persists dismissal for the exact candidate and keeps manual checking available", async () => {
    invoke.mockImplementation((command) => {
      if (command === "check_for_updates_on_launch") return Promise.resolve(outcome());
      if (command === "dismiss_available_update") return Promise.resolve();
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = await screen.findByRole("region", { name: "Application updates" });
    await user.click(within(panel).getByRole("button", { name: "Ignore this version" }));

    expect(invoke).toHaveBeenCalledWith("dismiss_available_update", {
      candidateVersion: "0.2.0",
    });
    expect(await within(panel).findByText("This version will no longer be announced automatically."))
      .toBeVisible();
    expect(within(panel).getByRole("button", { name: "Check now" })).toBeEnabled();
  });

  it("reveals quiet manual outcomes and retries every button activation", async () => {
    invoke.mockImplementation((command) => {
      if (command === "check_for_updates_on_launch") {
        return Promise.resolve(outcome({ status: "unconfigured", release: null,
          updateActionAvailable: false }));
      }
      if (command === "check_for_updates") {
        return Promise.resolve(outcome({ status: "up-to-date", updateActionAvailable: false }));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = screen.getByRole("region", { name: "Application updates" });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("check_for_updates_on_launch"));
    expect(within(panel).queryByText(/not configured/)).not.toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: "Check now" }));

    expect(invoke).toHaveBeenCalledWith("check_for_updates");
    expect(await within(panel).findByText("FitFreed 0.1.0 is up to date."))
      .toBeVisible();
  });

  it("does not let an older launch response replace a newer manual result", async () => {
    let completeLaunch!: (result: UpdateCheckOutcome) => void;
    invoke.mockImplementation((command) => {
      if (command === "check_for_updates_on_launch") {
        return new Promise<UpdateCheckOutcome>((resolve) => {
          completeLaunch = resolve;
        });
      }
      if (command === "check_for_updates") {
        return Promise.resolve(outcome({ status: "up-to-date", updateActionAvailable: false }));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = screen.getByRole("region", { name: "Application updates" });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("check_for_updates_on_launch"));
    await user.click(within(panel).getByRole("button", { name: "Check now" }));
    expect(await within(panel).findByText("FitFreed 0.1.0 is up to date."))
      .toBeVisible();

    await act(async () => completeLaunch(outcome()));
    expect(within(panel).getByText("FitFreed 0.1.0 is up to date.")).toBeVisible();
    expect(within(panel).queryByText("Version 0.2.0 is available."))
      .not.toBeInTheDocument();
  });

  it("shows withdrawal guidance but never offers a dismiss or postpone action", async () => {
    invoke.mockResolvedValue(outcome({
      status: "withdrawn-installed",
      installedWithdrawal: {
        version: "0.1.0",
        reason: "data-integrity",
        guidance: "Stop importing and preserve your library before upgrading.",
        replacementVersion: "0.2.0",
      },
    }));

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = await screen.findByRole("region", { name: "Application updates" });
    expect(await within(panel).findByText(/withdrawn because of a data integrity risk/))
      .toBeVisible();
    expect(await within(panel).findByText(/preserve your library/)).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Ignore this version" }))
      .not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Install and restart" }))
      .not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Remind me tomorrow" }))
      .not.toBeInTheDocument();
  });

  it("explains manual recovery and rejected trust without offering ordinary update actions", async () => {
    invoke.mockResolvedValueOnce(outcome({
      status: "manual-recovery-required",
      manualRecoveryReason: "library-schema-unsupported",
      updateActionAvailable: false,
    }));
    const view = render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    let panel = await screen.findByRole("region", { name: "Application updates" });
    expect(within(panel).getByText(/library schema is outside/)).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Ignore this version" }))
      .not.toBeInTheDocument();

    view.unmount();
    invoke.mockResolvedValueOnce(outcome({
      status: "untrusted",
      release: null,
      updateActionAvailable: false,
      trustFailure: "invalid-signature",
    }));
    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    panel = await screen.findByRole("region", { name: "Application updates" });
    expect(within(panel).getByText(/could not be trusted/)).toBeVisible();
    expect(within(panel).getByText("The release signature was invalid.")).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Remind me tomorrow" }))
      .not.toBeInTheDocument();
  });

  it("reports a privacy-safe command code without replacing the previous outcome", async () => {
    invoke.mockImplementation((command) => {
      if (command === "check_for_updates_on_launch") return Promise.resolve(outcome());
      if (command === "check_for_updates") {
        return Promise.reject({ code: "update-channel-failed", detail: "private URL" });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const panel = await screen.findByRole("region", { name: "Application updates" });
    await user.click(within(panel).getByRole("button", { name: "Check now" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "could not complete the update check",
    );
    expect(within(panel).getByRole("alert")).not.toHaveTextContent("private URL");
    expect(within(panel).getByText("Version 0.2.0 is available.")).toBeVisible();
  });
});
