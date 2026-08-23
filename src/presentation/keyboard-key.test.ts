import { describe, expect, it } from "vitest";

import { normalizeKeyboardKey, steppedInputValueForKey } from "./keyboard-key";

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

  it("steps a bounded input consistently for browser and embedded-driver keys", () => {
    expect(steppedInputValueForKey("ArrowRight", 1, 0, 3)).toBe(2);
    expect(steppedInputValueForKey("\uE013", 1, 0, 3)).toBe(2);
    expect(steppedInputValueForKey("ArrowLeft", 0, 0, 3)).toBe(0);
    expect(steppedInputValueForKey("End", 1, 0, 3)).toBe(3);
    expect(steppedInputValueForKey("Home", 1, 0, 3)).toBe(0);
    expect(steppedInputValueForKey("Escape", 1, 0, 3)).toBeNull();
  });
});
