import { describe, expect, it } from "vitest";

import {
  formatSessionStoryMetricValue,
  transformSessionStoryValue,
} from "./session-story-metric";

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

describe("formatSessionStoryMetricValue", () => {
  it("formats pace as clock-like minutes and other measurements at useful precision", () => {
    expect(formatSessionStoryMetricValue("pace", 4.999, "en-US", "min/km"))
      .toBe("5:00 min/km");
    expect(formatSessionStoryMetricValue("heart-rate", 142.6, "en-US", "bpm"))
      .toBe("143 bpm");
    expect(formatSessionStoryMetricValue("temperature", 18.45, "es-ES", "°C"))
      .toBe("18,5 °C");
  });
});
