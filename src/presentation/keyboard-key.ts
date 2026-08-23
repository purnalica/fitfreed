const webdriverSpecialKeys = new Map([
  ["\uE010", "End"],
  ["\uE011", "Home"],
  ["\uE012", "ArrowLeft"],
  ["\uE013", "ArrowUp"],
  ["\uE014", "ArrowRight"],
  ["\uE015", "ArrowDown"],
]);

export function normalizeKeyboardKey(key: string): string {
  return webdriverSpecialKeys.get(key) ?? key;
}

export function steppedInputValueForKey(
  key: string,
  current: number,
  minimum: number,
  maximum: number,
): number | null {
  switch (normalizeKeyboardKey(key)) {
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(minimum, current - 1);
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(maximum, current + 1);
    case "Home":
      return minimum;
    case "End":
      return maximum;
    default:
      return null;
  }
}
