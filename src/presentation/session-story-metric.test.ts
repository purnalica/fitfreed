import { describe, expect, it } from "vitest";

import { transformSessionStoryValue } from "./session-story-metric";

describe("transformSessionStoryValue", () => {
  it("preserves identity values and missing source values", () => {
    expect(transformSessionStoryValue("identity", 12.5)).toBe(12.5);
    expect(transformSessionStoryValue("identity", null)).toBeNull();
  });

  it("converts positive speed to pace without inventing pace at zero speed", () => {
    expect(transformSessionStoryValue(
      "kilometers-per-hour-to-minutes-per-kilometer",
      12,
    )).toBe(5);
    expect(transformSessionStoryValue(
      "kilometers-per-hour-to-minutes-per-kilometer",
      0,
    )).toBeNull();
    expect(transformSessionStoryValue(
      "kilometers-per-hour-to-minutes-per-kilometer",
      -1,
    )).toBeNull();
  });
});
