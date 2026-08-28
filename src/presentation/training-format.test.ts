import { describe, expect, it } from "vitest";

import {
  formatSessionCardDate,
  formatSessionCardDateTime,
  formatSessionCardDistance,
  formatSessionCardDuration,
  formatSessionCardTime,
  formatSessionTimeSpan,
  formatTrainingDateTime,
} from "./training-format";
import { formatExactDuration } from "./presentation-format";

const units = {
  hours: "h",
  minutes: "min",
  seconds: "s",
  milliseconds: "ms",
};

describe("human-scale training-session formatting", () => {
  it("shows only recorded clock precision in detailed date-time labels", () => {
    expect(formatTrainingDateTime("2026-08-18T07:30:00", "en-US")).toBe(
      "Aug 18, 2026, 7:30 AM",
    );
    expect(formatTrainingDateTime("2026-08-18T07:30:47", "en-US")).toBe(
      "Aug 18, 2026, 7:30:47 AM",
    );
    expect(formatTrainingDateTime("2026-08-18T07:30:47.000", "en-US")).toBe(
      "Aug 18, 2026, 7:30:47 AM",
    );
    expect(formatTrainingDateTime("2026-08-18T07:30:47.123", "en-US")).toBe(
      "Aug 18, 2026, 7:30:47.123\u202fAM",
    );
  });

  it("uses seconds as the human-scale zero for an exact elapsed duration", () => {
    expect(formatExactDuration("0", "en-US", units)).toBe("0 s");
    expect(formatExactDuration("1", "en-US", units)).toBe("1 ms");
  });

  it("removes source precision that does not help identify an ordinary session", () => {
    const value = "2026-08-18T07:30:47.123";

    expect(formatSessionCardDate(value, "en-US")).toBe("Aug 18, 2026");
    expect(formatSessionCardTime(value, "en-US")).toBe("7:30 AM");
    expect(formatSessionCardDateTime(value, "en-US")).toBe("Aug 18, 2026, 7:30 AM");
    expect(formatSessionCardDate(value, "es-ES")).toBe("18 ago 2026");
    expect(formatSessionCardTime(value, "es-ES")).toBe("7:30");
    expect(formatSessionCardDateTime(value, "es-ES")).toBe("18 ago 2026, 7:30");
  });

  it("uses minutes for ordinary sessions and seconds only for genuinely short efforts", () => {
    expect(formatSessionCardDuration("3723456", "en-US", units)).toBe("1 h 2 min");
    expect(formatSessionCardDuration("45987", "en-US", units)).toBe("46 s");
    expect(formatSessionCardDuration("0", "en-US", units)).toBe("0 s");
  });

  it("presents route-scale distance in kilometres and short distance in metres", () => {
    expect(formatSessionCardDistance(10_000.5, "en-US", {
      meters: "m",
      kilometers: "km",
    })).toBe("10 km");
    expect(formatSessionCardDistance(1_549, "en-US", {
      meters: "m",
      kilometers: "km",
    })).toBe("1.55 km");
    expect(formatSessionCardDistance(420.75, "en-US", {
      meters: "m",
      kilometers: "km",
    })).toBe("421 m");
  });

  it("composes same-day timing once and keeps exact source timing separate", () => {
    expect(formatSessionTimeSpan(
      "2026-08-18T07:30:47.123",
      "2026-08-18T08:24:58.987",
      "3241234",
      "en-US",
      units,
    )).toEqual({
      date: "Aug 18, 2026",
      time: "7:30 – 8:24 AM",
      duration: "54 min 1 s",
    });
    expect(formatSessionTimeSpan(
      "2026-08-18T23:55:00",
      "2026-08-19T00:10:00",
      "900000",
      "es-ES",
      units,
    )).toEqual({
      date: "18 ago 2026, 23:55 – 19 ago 2026, 0:10",
      time: null,
      duration: "15 min",
    });
  });
});
