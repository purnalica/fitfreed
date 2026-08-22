import { describe, expect, it } from "vitest";

import { normalizeKeyboardKey } from "./keyboard-key";

describe("keyboard key normalization", () => {
  it("keeps browser DOM keys unchanged", () => {
    expect(normalizeKeyboardKey("ArrowLeft")).toBe("ArrowLeft");
    expect(normalizeKeyboardKey("Home")).toBe("Home");
    expect(normalizeKeyboardKey("+")).toBe("+");
  });

  it("adapts WebDriver special-key code points exposed by an embedded WebView", () => {
    expect(normalizeKeyboardKey("\uE010")).toBe("End");
    expect(normalizeKeyboardKey("\uE011")).toBe("Home");
    expect(normalizeKeyboardKey("\uE012")).toBe("ArrowLeft");
    expect(normalizeKeyboardKey("\uE013")).toBe("ArrowUp");
    expect(normalizeKeyboardKey("\uE014")).toBe("ArrowRight");
    expect(normalizeKeyboardKey("\uE015")).toBe("ArrowDown");
  });
});
