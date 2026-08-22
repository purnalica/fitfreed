import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RangeFilterActions, type RangeOperation } from "./RangeFilterActions";

afterEach(cleanup);

function renderActions(operation?: RangeOperation) {
  render(
    <form aria-label="Period">
      <RangeFilterActions
        className="actions"
        operation={operation}
        applyLabel="Apply period"
        applyingLabel="Applying period…"
        resetLabel="Latest window"
        resettingLabel="Loading latest window…"
        navigationLabel="Loading requested detail…"
        onReset={vi.fn()}
      />
    </form>,
  );
}

describe("RangeFilterActions", () => {
  it("identifies the reset control that initiated the request", () => {
    const onReset = vi.fn();
    render(
      <form aria-label="Period">
        <RangeFilterActions
          className="actions"
          applyLabel="Apply period"
          applyingLabel="Applying period…"
          resetLabel="Latest window"
          resettingLabel="Loading latest window…"
          onReset={onReset}
        />
      </form>,
    );
    const reset = screen.getByRole("button", { name: "Latest window" });

    fireEvent.click(reset);

    expect(onReset).toHaveBeenCalledWith(reset);
  });

  it.each([
    ["apply", "Applying period…"],
    ["reset", "Loading latest window…"],
    ["navigation", "Loading requested detail…"],
  ] as const)("keeps both actions stable during %s progress", (operation, progress) => {
    renderActions(operation);

    expect(screen.getByRole("button", { name: "Apply period" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Latest window" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(progress);
  });

  it("enables both actions without inventing idle progress", () => {
    renderActions();

    expect(screen.getByRole("button", { name: "Apply period" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Latest window" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
