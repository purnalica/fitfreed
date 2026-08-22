import { describe, expect, it } from "vitest";

import { localRouteViewportKeyboardAction } from "./route-viewport";

describe("local route viewport keyboard actions", () => {
  it("maps arrow keys to one bounded spatial pan step", () => {
    expect(localRouteViewportKeyboardAction("ArrowLeft")).toEqual({
      kind: "pan",
      xPixels: -80,
      yPixels: 0,
    });
    expect(localRouteViewportKeyboardAction("ArrowRight")).toEqual({
      kind: "pan",
      xPixels: 80,
      yPixels: 0,
    });
    expect(localRouteViewportKeyboardAction("ArrowUp")).toEqual({
      kind: "pan",
      xPixels: 0,
      yPixels: -80,
    });
    expect(localRouteViewportKeyboardAction("ArrowDown")).toEqual({
      kind: "pan",
      xPixels: 0,
      yPixels: 80,
    });
    expect(localRouteViewportKeyboardAction("\uE014")).toEqual({
      kind: "pan",
      xPixels: 80,
      yPixels: 0,
    });
  });

  it("maps conventional map zoom keys and ignores unrelated application keys", () => {
    expect(localRouteViewportKeyboardAction("+")).toEqual({ kind: "zoom", delta: 1 });
    expect(localRouteViewportKeyboardAction("=")).toEqual({ kind: "zoom", delta: 1 });
    expect(localRouteViewportKeyboardAction("-")).toEqual({ kind: "zoom", delta: -1 });
    expect(localRouteViewportKeyboardAction("_")).toEqual({ kind: "zoom", delta: -1 });
    expect(localRouteViewportKeyboardAction("Escape")).toBeNull();
    expect(localRouteViewportKeyboardAction("PageDown")).toBeNull();
  });
});
