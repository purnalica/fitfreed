import type { SessionStoryValueTransform } from "./session-story";

export function transformSessionStoryValue(
  transform: SessionStoryValueTransform,
  value: number | null,
): number | null {
  if (value === null) return null;
  if (transform === "identity") return value;
  return value > 0 ? 60 / value : null;
}
