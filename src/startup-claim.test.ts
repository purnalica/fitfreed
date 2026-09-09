import { describe, expect, it } from "vitest";

import { claimApplicationStartup } from "./startup-claim";

describe("application startup claim", () => {
  it("admits only the first startup module identity in one renderer", () => {
    const rendererGlobal = {};

    expect(claimApplicationStartup(rendererGlobal)).toBe(true);
    expect(claimApplicationStartup(rendererGlobal)).toBe(false);
  });

  it("keeps independent renderer globals independent", () => {
    expect(claimApplicationStartup({})).toBe(true);
    expect(claimApplicationStartup({})).toBe(true);
  });
});
