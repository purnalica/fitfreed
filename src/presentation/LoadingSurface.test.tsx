import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LoadingSurface } from "./LoadingSurface";

afterEach(cleanup);

describe("LoadingSurface", () => {
  it("announces the localized loading state without replacing the application shell", () => {
    render(<LoadingSurface message="Loading this view…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading this view…");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
