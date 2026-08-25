import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { ApplicationShell, type ApplicationHome } from "./ApplicationShell";

afterEach(cleanup);

describe("ApplicationShell", () => {
  it("keeps every named workspace visible and navigable in one stable shell", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(
      <ApplicationShell
        activeHome="sources"
        messages={catalogs["en-US"].shell}
        exploreDisabled={false}
        onNavigate={onNavigate}
      >
        <h1>Current task</h1>
      </ApplicationShell>,
    );

    const sidebar = screen.getByRole("complementary", {
      name: "Primary application navigation",
    });
    expect(within(sidebar).getByText("FitFreed")).toBeVisible();
    expect(sidebar.querySelector(".shell-brand img")).toBeInTheDocument();
    const navigation = within(sidebar).getByRole("navigation", { name: "Application" });
    const expected: Array<[ApplicationHome, string]> = [
      ["home", "Home"],
      ["explore", "History"],
      ["reports", "Reports"],
      ["sources", "Sources"],
      ["settings", "Settings"],
    ];
    for (const [destination, label] of expected) {
      const button = within(navigation).getByRole("button", { name: label });
      expect(button).toHaveTextContent(label);
      expect(button).toHaveAttribute("data-home", destination);
      await user.click(button);
    }
    expect(within(navigation).getByRole("button", { name: "Sources" }))
      .toHaveAttribute("aria-current", "page");
    expect(onNavigate.mock.calls.map(([destination]) => destination)).toEqual(
      expected.map(([destination]) => destination),
    );
    expect(screen.getByRole("heading", { name: "Current task" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /question/i })).not.toBeInTheDocument();
  });

  it("keeps History named and exposes the exact restriction with its recovery", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <ApplicationShell
        activeHome="home"
        messages={catalogs["es-ES"].shell}
        exploreDisabled
        exploreRestriction={{
          message: "El historial se habilitará cuando termine la actualización.",
          actionLabel: "Reintentar actualización",
          onAction: retry,
        }}
        onNavigate={vi.fn()}
      >
        <p>Vacío</p>
      </ApplicationShell>,
    );

    const history = screen.getByRole("button", { name: "Historial" });
    expect(history).toBeDisabled();
    expect(history).toHaveTextContent("Historial");
    expect(history).toHaveAccessibleDescription(
      "El historial se habilitará cuando termine la actualización.",
    );
    await user.click(screen.getByRole("button", { name: "Reintentar actualización" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps a shell-owned operation visible outside its detailed workspace", async () => {
    const user = userEvent.setup();
    const openOperation = vi.fn();
    render(
      <ApplicationShell
        activeHome="home"
        messages={catalogs["en-US"].shell}
        exploreDisabled
        activeOperation={{
          label: "Import in progress",
          detail: "Reconciling supported records with your library",
          actionLabel: "View import in Sources",
          onAction: openOperation,
        }}
        onNavigate={vi.fn()}
      >
        <h1>Home</h1>
      </ApplicationShell>,
    );

    const operation = screen.getByRole("status", { name: "Import in progress" });
    expect(operation).toHaveTextContent("Reconciling supported records with your library");
    await user.click(within(operation).getByRole("button", {
      name: "View import in Sources",
    }));
    expect(openOperation).toHaveBeenCalledOnce();
  });
});
