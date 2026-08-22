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
