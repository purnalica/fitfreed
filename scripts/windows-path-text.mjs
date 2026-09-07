export function windowsPathTextsEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  return (
    asciiLower(comparableWindowsPathText(left))
    === asciiLower(comparableWindowsPathText(right))
  );
}

function comparableWindowsPathText(value) {
  const verbatimUncPrefix = "\\\\?\\UNC\\";
  if (value.startsWith(verbatimUncPrefix)) {
    return `\\\\${value.slice(verbatimUncPrefix.length)}`;
  }

  const verbatimPrefix = "\\\\?\\";
  if (!value.startsWith(verbatimPrefix)) return value;
  const ordinaryPath = value.slice(verbatimPrefix.length);
  return /^[A-Za-z]:\\/u.test(ordinaryPath) ? ordinaryPath : value;
}

function asciiLower(value) {
  return value.replace(/[A-Z]/gu, (character) => character.toLowerCase());
}
