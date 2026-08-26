import { describe, expect, it } from "vitest";

import {
  coordinateDecimalFormatter,
  decimalSeparator,
  formatCount,
  formatCountRatio,
  formatDetailDuration,
  formatDistance,
  formatEnergy,
  formatExactDuration,
  formatFractionAsPercentage,
  formatLocalDate,
  formatPace,
  formatSummaryDecimal,
  formatSummaryDistance,
  formatSummaryDuration,
  longDateFormatter,
  mediumDateTimeFormatter,
  monthYearFormatter,
  pluralRules,
  signedIntegerCountFormatter,
  signedExactDecimalFormatter,
  signedSummaryDecimalFormatter,
  sourcePrecisionDateTimeFormatter,
  weekdayFormatter,
} from "./presentation-format";

const durationUnits = {
  hours: "h",
  minutes: "min",
  seconds: "s",
  milliseconds: "ms",
};

const distanceUnits = {
  meters: "m",
  kilometers: "km",
};

describe("shared presentation formatting", () => {
  it("groups every integer through one locale-aware count policy", () => {
    expect(formatCount(4_419, "en-US")).toBe("4,419");
    expect(formatCount(11_765, "es-ES")).toBe("11.765");
  });

  it("groups both sides of a ratio whenever either value needs grouping", () => {
    expect(formatCountRatio(4_419, 11_765, "en-US", "of")).toBe(
      "4,419 of 11,765",
    );
    expect(formatCountRatio(4_419, 11_765, "es-ES", "de")).toBe(
      "4.419 de 11.765",
    );
  });

  it("uses magnitude-aware precision for summary durations", () => {
    expect(formatSummaryDuration("45587", "en-US", durationUnits)).toBe("46 s");
    expect(formatSummaryDuration("39837586", "en-US", durationUnits)).toBe(
      "11 h 4 min",
    );
    expect(formatSummaryDuration("4171652700", "en-US", durationUnits)).toBe(
      "1,159 h",
    );
  });

  it("keeps seconds in ordinary detail and milliseconds only in exact evidence", () => {
    expect(formatDetailDuration("23897586", "en-US", durationUnits)).toBe(
      "6 h 38 min 18 s",
    );
    expect(formatExactDuration("23897586", "en-US", durationUnits)).toBe(
      "6 h 38 min 17 s 586 ms",
    );
    expect(formatSummaryDuration("1", "en-US", durationUnits, true)).toBe("0 s");
    expect(formatSummaryDuration("-1", "en-US", durationUnits, true)).toBe("0 s");
    expect(formatExactDuration("1", "en-US", durationUnits, true)).toBe("+1 ms");
    expect(formatExactDuration("-1", "en-US", durationUnits, true)).toBe("−1 ms");
  });

  it("uses named decimal, date, distance, pace, energy, and percentage policies", () => {
    expect(formatSummaryDecimal(12.3456, "en-US")).toBe("12.3");
    expect(formatLocalDate("2026-08-26", "es-ES")).toBe("26 ago 2026");
    expect(formatDistance(1_549, "en-US", distanceUnits)).toBe("1.55 km");
    expect(formatSummaryDistance(1_549, "en-US", distanceUnits)).toBe("1.5 km");
    expect(formatPace(302_400, "en-US", "min/km")).toBe("5:02 min/km");
    expect(formatEnergy(645.8, "en-US", "kcal")).toBe("646 kcal");
    expect(formatFractionAsPercentage(0.873, "es-ES")).toBe("87 %");
  });

  it("centralizes signed, coordinate, plural, and source-precision policies", () => {
    expect(signedIntegerCountFormatter("en-US").format(24)).toBe("+24");
    expect(signedIntegerCountFormatter("en-US").format(0)).toBe("0");
    expect(signedSummaryDecimalFormatter("es-ES").format(-1.25)).toBe("-1,3");
    expect(signedExactDecimalFormatter("en-US").format(1.23456789)).toBe(
      "+1.23456789",
    );
    expect(coordinateDecimalFormatter("en-US").format(-0.12345678901234567)).toBe(
      "-0.12345678901234566",
    );
    expect(pluralRules("en-US").select(1)).toBe("one");
    expect(decimalSeparator("es-ES")).toBe(",");
    expect(
      sourcePrecisionDateTimeFormatter("en-US", true).format(
        new Date("2026-08-26T10:11:12Z"),
      ),
    ).toContain("12");
  });

  it("centralizes the calendar and UTC date-time variants used by the product", () => {
    const instant = new Date("2026-08-26T10:11:12Z");
    expect(mediumDateTimeFormatter("en-US").format(instant)).toContain("10:11");
    expect(longDateFormatter("en-US").format(instant)).toBe("August 26, 2026");
    expect(monthYearFormatter("en-US").format(instant)).toBe("August 2026");
    expect(weekdayFormatter("en-US").format(instant)).toBe("Wed");
  });
});
