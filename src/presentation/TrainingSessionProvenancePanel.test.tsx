import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { TrainingSessionProvenanceResult } from "./training-session-provenance";
import { TrainingSessionProvenancePanel } from "./TrainingSessionProvenancePanel";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const snapshotRef = `training-snapshot-${"a".repeat(64)}`;
const sessionRef = `session-${"b".repeat(64)}`;

function page(offset: number): TrainingSessionProvenanceResult {
  const first = {
    ordinal: 0,
    observedAtUtc: "2026-08-17T18:31:00Z",
    sourceModifiedAtUtc: "2026-08-17T18:30:00Z",
    provider: "polar-flow" as const,
    sourceAdapterVersion: "polar-flow-archive@10",
    mappingVersion: "polar-flow-training-session@5",
    decision: "create" as const,
    contributesToVisibleState: true,
  };
  const second = {
    ...first,
    ordinal: 10,
    observedAtUtc: "2026-08-18T08:00:00Z",
    sourceModifiedAtUtc: "2026-08-16T10:00:00Z",
    decision: "preserve" as const,
    contributesToVisibleState: false,
  };
  return {
    snapshotRef,
    sessionRef,
    totalEventCount: 11,
    offset,
    limit: 10,
    nextOffset: offset === 0 ? 10 : null,
    current: {
      provider: "polar-flow",
      sourceModifiedAtUtc: "2026-08-17T18:30:00Z",
      sourceAdapterVersion: "polar-flow-archive@10",
      mappingVersion: "polar-flow-training-session@5",
      contributingEventCount: 10,
      nonContributingEventCount: 1,
    },
    events: offset === 0
      ? Array.from({ length: 10 }, (_, ordinal) => ({ ...first, ordinal }))
      : [second],
  };
}

function renderPanel(locale: "en-US" | "es-ES" = "en-US") {
  return render(
    <TrainingSessionProvenancePanel
      sessionRef={sessionRef}
      snapshotRef={snapshotRef}
      locale={locale}
      messages={catalogs[locale]}
    />,
  );
}

beforeEach(() => {
  mocks.invoke.mockReset();
});

afterEach(cleanup);

describe("TrainingSessionProvenancePanel", () => {
  it("loads only on demand and paginates exact, privacy-bounded evidence", async () => {
    mocks.invoke.mockImplementation((_command: string, arguments_: unknown) => {
      const offset = (arguments_ as { query: { offset: number } }).query.offset;
      return Promise.resolve(page(offset));
    });
    const user = userEvent.setup();
    renderPanel();

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Session provenance" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "How did this session get here?" }));

    const panel = await screen.findByRole("region", { name: "Session provenance" });
    expect(mocks.invoke).toHaveBeenLastCalledWith("query_training_session_provenance", {
      query: { sessionRef, snapshotRef, offset: 0, limit: 10 },
    });
    expect(panel).toHaveTextContent("Polar Flow");
    expect(panel).toHaveTextContent("Aug 17, 2026, 6:30 PM");
    expect(panel).toHaveTextContent("Added the session");
    expect(panel).toHaveTextContent("Supports the current session");
    await user.click(within(panel).getByText("Technical interpretation details"));
    expect(panel).toHaveTextContent("polar-flow-archive@10");
    expect(panel).toHaveTextContent("polar-flow-training-session@5");
    expect(panel).not.toHaveTextContent("session-");
    expect(panel).not.toHaveTextContent("training-snapshot-");
    expect(panel).not.toHaveTextContent("private.zip");
    expect(within(panel).getByRole("button", { name: "Previous evidence" })).toBeDisabled();

    await user.click(within(panel).getByRole("button", { name: "Next evidence" }));
    await waitFor(() => expect(panel).toHaveTextContent("Kept a newer revision"));
    expect(panel).toHaveTextContent("Did not change the current session");
    expect(within(panel).getByRole("button", { name: "Next evidence" })).toBeDisabled();
    expect(within(panel).getByRole("button", { name: "Previous evidence" })).toBeEnabled();

    await user.click(within(panel).getByRole("button", { name: "Previous evidence" }));
    await waitFor(() => expect(panel).toHaveTextContent("Added the session"));

    await user.click(screen.getByRole("button", { name: "Hide session provenance" }));
    expect(screen.queryByRole("region", { name: "Session provenance" })).not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledTimes(3);
  });

  it("reports a failed load and retries without exposing a partial result", async () => {
    mocks.invoke
      .mockRejectedValueOnce({ code: "training-session-detail-failed" })
      .mockResolvedValueOnce(page(0));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "How did this session get here?" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Provenance could not be loaded");
    expect(screen.queryByText("Polar Flow")).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Retry provenance" }));
    expect(await screen.findByText("Polar Flow")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("resets on session changes and localizes Spanish evidence", async () => {
    mocks.invoke.mockResolvedValue(page(0));
    const user = userEvent.setup();
    const rendered = renderPanel("es-ES");

    await user.click(screen.getByRole("button", {
      name: "¿Cómo llegó esta sesión hasta aquí?",
    }));
    const panel = await screen.findByRole("region", { name: "Procedencia de la sesión" });
    expect(panel).toHaveTextContent("17 ago 2026, 18:30");
    expect(panel).toHaveTextContent("Añadió la sesión");
    expect(panel).toHaveTextContent("Sustenta la sesión actual");

    rendered.rerender(
      <TrainingSessionProvenancePanel
        sessionRef={`session-${"c".repeat(64)}`}
        snapshotRef={snapshotRef}
        locale="es-ES"
        messages={catalogs["es-ES"]}
      />,
    );
    expect(screen.queryByRole("region", { name: "Procedencia de la sesión" }))
      .not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
