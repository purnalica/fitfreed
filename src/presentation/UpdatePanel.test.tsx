import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import {
  UpdatePanel,
  type UpdateCheckOutcome,
  type UpdateRecoveryIntervention,
} from "./UpdatePanel";

const invoke = vi.hoisted(() => vi.fn());
const listen = vi.hoisted(() => vi.fn());
let updateEventListener: ((event: { payload: UpdateCheckOutcome }) => void) | undefined;

vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

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

function withoutRecovery(
  implementation: (command: string, arguments_?: unknown) => unknown,
) {
  invoke.mockImplementation((command, arguments_) => command === "query_update_recovery_intervention"
    ? Promise.resolve(null)
    : implementation(command, arguments_));
}

function recoveryIntervention(
  overrides: Partial<UpdateRecoveryIntervention> = {},
): UpdateRecoveryIntervention {
  return {
    status: "native-recovery-retry-available",
    sourceVersion: "0.1.0",
    targetVersion: "0.2.0",
    attemptsCompleted: 1,
    maximumAttempts: 3,
    ...overrides,
  };
}

afterEach(cleanup);

beforeEach(() => {
  invoke.mockReset();
  listen.mockReset();
  updateEventListener = undefined;
  listen.mockImplementation(async (_eventName, listener) => {
    updateEventListener = listener;
    return () => {
      updateEventListener = undefined;
    };
  });
});

describe("UpdatePanel", () => {
  it("presents recurring attention outcomes and keeps recurring ordinary outcomes quiet", async () => {
    withoutRecovery(() => Promise.resolve(outcome({
      status: "unconfigured",
      release: null,
      updateActionAvailable: false,
    })));

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
    await waitFor(() => expect(listen).toHaveBeenCalledWith(
      "fitfreed://update-check-completed",
      expect.any(Function),
    ));
    expect(await within(panel).findByText("0.1.0")).toBeVisible();
    expect(within(panel).getByText("Installed version")).toBeVisible();
    expect(within(panel).queryByText(/not configured/)).not.toBeInTheDocument();

    act(() => updateEventListener?.({ payload: outcome() }));
    expect(within(panel).getByText("Version 0.2.0 is available.")).toBeVisible();

    for (const status of [
      "unconfigured",
      "offline",
      "up-to-date",
      "dismissed",
      "postponed",
    ] as const) {
      act(() => updateEventListener?.({
        payload: outcome({
          status,
          release: null,
          updateActionAvailable: false,
          postponedUntil: status === "postponed" ? "2026-08-17T12:00:00Z" : null,
        }),
      }));
      expect(within(panel).queryByRole("status")).not.toBeInTheDocument();
    }
  });

  it("keeps the manual check action stable while announcing its progress", async () => {
    let completeCheck: (result: UpdateCheckOutcome) => void = () => undefined;
    withoutRecovery((command) => {
      if (command === "check_for_updates_on_launch") {
        return Promise.resolve(outcome({
          status: "unconfigured",
          release: null,
          updateActionAvailable: false,
        }));
      }
      if (command === "check_for_updates") {
        return new Promise((resolve) => {
          completeCheck = resolve;
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

    const panel = screen.getByRole("region", { name: "Application updates" });
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("check_for_updates_on_launch"));
    await user.click(within(panel).getByRole("button", { name: "Check now" }));

    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("button", { name: "Check now" })).toBeDisabled();
    expect(within(panel).getByRole("status")).toHaveTextContent("Checking…");

    completeCheck(outcome({ status: "up-to-date", updateActionAvailable: false }));
    expect(await within(panel).findByText("FitFreed 0.1.0 is up to date.")).toBeVisible();
  });

  it("announces an authenticated launch update and persists a 24-hour postponement", async () => {
    let completePostponement: (until: string) => void = () => undefined;
    withoutRecovery((command) => {
      if (command === "check_for_updates_on_launch") return Promise.resolve(outcome());
      if (command === "postpone_available_update") {
        return new Promise((resolve) => {
          completePostponement = resolve;
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
    const install = await within(panel).findByRole("button", { name: "Install and restart" });
    expect(within(panel).getByText("Version 0.2.0 is available.")).toBeVisible();
    expect(within(panel).getByText(/improved import recovery/)).toBeVisible();
    expect(within(panel).getByText(/preserves the current application and library/)).toBeVisible();
    expect(install).toBeEnabled();
    await user.click(within(panel).getByRole("button", { name: "Remind me tomorrow" }));

    expect(invoke).toHaveBeenCalledWith("postpone_available_update", {
      candidateVersion: "0.2.0",
    });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("button", { name: "Remind me tomorrow" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Ignore this version" })).toBeDisabled();
    expect(within(panel).getByText("Postponing reminder…")).toHaveAttribute("role", "status");

    act(() => completePostponement("2026-08-17T12:00:00Z"));
    expect(await within(panel).findByText(/reminder is postponed until/)).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Remind me tomorrow" }))
      .not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Install and restart" }))
      .not.toBeInTheDocument();
  });

  it("installs the exact authorized candidate and prevents conflicting actions", async () => {
    let completeInstallation!: () => void;
    withoutRecovery((command) => {
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
    await user.click(await within(panel).findByRole("button", { name: "Install and restart" }));

    expect(invoke).toHaveBeenCalledWith("install_available_update", {
      candidateVersion: "0.2.0",
    });
    expect(within(panel).getByText("Installing version 0.2.0…")).toBeVisible();
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("button", { name: "Install and restart" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Check now" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Remind me tomorrow" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Ignore this version" })).toBeDisabled();

    await act(async () => completeInstallation());
    expect(within(panel).getByRole("button", { name: "Install and restart" })).toBeDisabled();
  });

  it("reports an installation failure without losing the trusted release", async () => {
    withoutRecovery((command) => {
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
    await user.click(await within(panel).findByRole("button", { name: "Install and restart" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "could not install the verified update",
    );
    expect(within(panel).getByRole("alert")).not.toHaveTextContent("private path");
    expect(within(panel).getByText("Version 0.2.0 is available.")).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Install and restart" })).toBeEnabled();
  });

  it("disables installation while another desktop mutation is active", async () => {
    withoutRecovery(() => Promise.resolve(outcome()));

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
    expect(await within(panel).findByRole("button", { name: "Install and restart" }))
      .toBeDisabled();
  });

  it("persists dismissal for the exact candidate and keeps manual checking available", async () => {
    let completeDismissal: () => void = () => undefined;
    withoutRecovery((command) => {
      if (command === "check_for_updates_on_launch") return Promise.resolve(outcome());
      if (command === "dismiss_available_update") {
        return new Promise<void>((resolve) => {
          completeDismissal = resolve;
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
    await user.click(await within(panel).findByRole("button", { name: "Ignore this version" }));

    expect(invoke).toHaveBeenCalledWith("dismiss_available_update", {
      candidateVersion: "0.2.0",
    });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("button", { name: "Ignore this version" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Remind me tomorrow" })).toBeDisabled();
    expect(within(panel).getByText("Ignoring this version…")).toHaveAttribute("role", "status");

    act(() => completeDismissal());
    expect(await within(panel).findByText("This version will no longer be announced automatically."))
      .toBeVisible();
    expect(within(panel).getByRole("button", { name: "Check now" })).toBeEnabled();
  });

  it("reveals quiet manual outcomes and retries every button activation", async () => {
    withoutRecovery((command) => {
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
    withoutRecovery((command) => {
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
    withoutRecovery(() => Promise.resolve(outcome({
      status: "withdrawn-installed",
      installedWithdrawal: {
        version: "0.1.0",
        reason: "data-integrity",
        guidance: "Stop importing and preserve your library before upgrading.",
        replacementVersion: "0.2.0",
      },
    })));

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
    const results = [
      outcome({
        status: "manual-recovery-required",
        manualRecoveryReason: "library-schema-unsupported",
        updateActionAvailable: false,
      }),
      outcome({
        status: "untrusted",
        release: null,
        updateActionAvailable: false,
        trustFailure: "invalid-signature",
      }),
    ];
    withoutRecovery((command) => command === "check_for_updates_on_launch"
      ? Promise.resolve(results.shift())
      : Promise.reject(new Error(`Unexpected command: ${command}`)));
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

  it("makes an explicit native recovery retry the only available update action", async () => {
    invoke.mockImplementation((command) => {
      if (command === "query_update_recovery_intervention") {
        return Promise.resolve(recoveryIntervention());
      }
      if (command === "retry_update_recovery") return new Promise(() => {});
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
    expect(await within(panel).findByRole("heading", {
      name: "Update recovery needs your permission",
    })).toBeVisible();
    expect(within(panel).getByText(/restore version 0.1.0/)).toBeVisible();
    expect(within(panel).getByText(/1 of 3 recovery attempts/)).toBeVisible();
    expect(invoke).not.toHaveBeenCalledWith("check_for_updates_on_launch");
    expect(within(panel).queryByRole("button", { name: "Check now" }))
      .not.toBeInTheDocument();

    const retry = within(panel).getByRole("button", { name: "Retry recovery and restart" });
    await user.click(retry);
    expect(invoke).toHaveBeenCalledWith("retry_update_recovery");
    expect(retry).toBeDisabled();
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("status")).toHaveTextContent(
      "Starting the protected recovery…",
    );
  });

  it("retains failed recovery evidence and gives manual reinstall guidance without retry", async () => {
    invoke.mockImplementation((command) => command === "query_update_recovery_intervention"
      ? Promise.resolve(recoveryIntervention({
        status: "manual-reinstall-required",
        attemptsCompleted: 3,
      }))
      : Promise.reject(new Error(`Unexpected command: ${command}`)));

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
    expect(await within(panel).findByRole("heading", {
      name: "Manual reinstall required",
    })).toBeVisible();
    expect(within(panel).getByText(/Reinstall version 0.1.0/)).toBeVisible();
    expect(within(panel).getByText(/recovery evidence remain on this device/)).toBeVisible();
    expect(within(panel).queryByRole("button", { name: "Retry recovery and restart" }))
      .not.toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Check now" }))
      .not.toBeInTheDocument();
  });

  it("fails closed when recovery state cannot be read", async () => {
    invoke.mockRejectedValue({
      code: "update-recovery-query-failed",
      detail: "/private/update-recovery",
    });

    render(
      <UpdatePanel
        locale="en-US"
        messages={catalogs["en-US"].updates}
        errors={catalogs["en-US"].errors}
        ready
        refreshToken={0}
      />,
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("could not verify the local update-recovery state");
    expect(alert).not.toHaveTextContent("/private/update-recovery");
    expect(invoke).not.toHaveBeenCalledWith("check_for_updates_on_launch");
  });

  it("keeps manual checking available when only the launch update check fails", async () => {
    withoutRecovery((command) => command === "check_for_updates_on_launch"
      ? Promise.reject({ code: "update-channel-failed", detail: "private URL" })
      : Promise.reject(new Error(`Unexpected command: ${command}`)));

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
    expect(await within(panel).findByRole("alert")).toHaveTextContent(
      "could not complete the update check",
    );
    expect(within(panel).getByRole("button", { name: "Check now" })).toBeEnabled();
  });

  it("reports a privacy-safe command code without replacing the previous outcome", async () => {
    withoutRecovery((command) => {
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
