import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocalizedMeasurement } from "./LocalizedMeasurement";

describe("LocalizedMeasurement", () => {
  it("keeps the translated measurement parameter intact wherever the locale places it", () => {
    const { rerender } = render(
      <h2><LocalizedMeasurement message="Average: {value}" value="7 h 30 min" /></h2>,
    );

    expect(screen.getByRole("heading", { name: "Average: 7 h 30 min" })).toBeVisible();
    expect(screen.getByText("7 h 30 min")).toHaveClass("answer-measurement");

    rerender(
      <h2><LocalizedMeasurement message="{value} on average" value="7 h 30 min" /></h2>,
    );

    expect(screen.getByRole("heading", { name: "7 h 30 min on average" })).toBeVisible();
    expect(screen.getByText("7 h 30 min")).toHaveClass("answer-measurement");
  });

  it("retains the measurement when an invalid message omits its placeholder", () => {
    render(<LocalizedMeasurement message="Recorded average" value="905 ms" />);

    expect(screen.getByText("Recorded average")).toBeVisible();
    expect(screen.getByText("905 ms")).toHaveClass("answer-measurement");
  });
});
