import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProgressSubmitButton } from "./ProgressSubmitButton";

afterEach(cleanup);

describe("ProgressSubmitButton", () => {
  it("keeps the action name stable while announcing localized progress once", () => {
    const { rerender } = render(
      <ProgressSubmitButton
        loading={false}
        actionLabel="Compare periods"
        progressLabel="Comparing periods…"
      />,
    );

    expect(screen.getByRole("button", { name: "Compare periods" })).toBeEnabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(
      <ProgressSubmitButton
        loading
        actionLabel="Compare periods"
        progressLabel="Comparing periods…"
      />,
    );

    const button = screen.getByRole("button", { name: "Compare periods" });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Compare periods");
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Comparing periods…");
    expect(screen.getByRole("status")).toBeVisible();

    rerender(
      <ProgressSubmitButton
        loading={false}
        disabled
        actionLabel="Compare periods"
        progressLabel="Comparing periods…"
      />,
    );

    expect(screen.getByRole("button", { name: "Compare periods" })).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
