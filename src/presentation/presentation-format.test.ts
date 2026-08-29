import { describe, expect, it } from "vitest";

import {
  analyticalAxisNumberFormatter,
  coordinateDecimalFormatter,
  decimalSeparator,
  formatCount,
  formatCountRatio,
  formatDetailDuration,
  formatDistance,
  formatEnergy,
  formatExactDuration,
  formatFractionAsPercentage,
  formatMediumDateRange,
  formatLocalDate,
  formatPace,
  formatPresentationDecimal,
  formatPresentationDistance,
  formatPresentationDuration,
  formatAnalyticalPace,
  formatAnalyticalDuration,
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

  it("selects precision and sign from an explicit semantic presentation role", () => {
    expect(formatPresentationDecimal(8_830.599609375, "en-US", "summary"))
      .toBe("8,830.6");
    expect(formatPresentationDecimal(8_830.599609375, "en-US", "detail"))
      .toBe("8,830.6");
    expect(formatPresentationDecimal(8_830.599609375, "en-US", "exact-evidence"))
      .toBe("8,830.599609375");
    expect(formatPresentationDecimal(12.25, "en-US", "comparison"))
      .toBe("+12.3");

    expect(formatPresentationDuration("23897586", "en-US", durationUnits, "summary"))
      .toBe("6 h 38 min");
    expect(formatPresentationDuration("23897586", "en-US", durationUnits, "detail"))
      .toBe("6 h 38 min 18 s");
    expect(formatPresentationDuration("23897586", "en-US", durationUnits, "exact-evidence"))
      .toBe("6 h 38 min 17 s 586 ms");
    expect(formatPresentationDuration("-60500", "en-US", durationUnits, "comparison"))
      .toBe("−1 min");

    expect(formatPresentationDistance(8_830.599609375, "en-US", distanceUnits, "summary"))
      .toBe("8.8 km");
    expect(formatPresentationDistance(8_830.599609375, "en-US", distanceUnits, "detail"))
      .toBe("8.83 km");
    expect(formatPresentationDistance(8_830.599609375, "en-US", distanceUnits, "exact-evidence"))
      .toBe("8,830.599609375 m");
    expect(formatPresentationDistance(-1_549, "en-US", distanceUnits, "comparison"))
      .toBe("-1.5 km");
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

  it("centralizes compact analytical-axis duration and number policies", () => {
    expect(formatAnalyticalDuration(65_000, "en-US")).toBe("1:05");
    expect(formatAnalyticalDuration(3_665_000, "en-US")).toBe("1:01:05");
    expect(formatAnalyticalPace(4.999, "en-US")).toBe("5:00");
    expect(formatAnalyticalPace(5.5, "es-ES")).toBe("5:30");
    expect(analyticalAxisNumberFormatter("en-US", 1).format(1_234.56)).toBe("1,234.6");
    expect(analyticalAxisNumberFormatter("es-ES", 2).format(1_234.56)).toBe("1.234,56");
  });

  it("centralizes the calendar and UTC date-time variants used by the product", () => {
    const instant = new Date("2026-08-26T10:11:12Z");
    expect(mediumDateTimeFormatter("en-US").format(instant)).toContain("10:11");
    expect(longDateFormatter("en-US").format(instant)).toBe("August 26, 2026");
    expect(monthYearFormatter("en-US").format(instant)).toBe("August 2026");
    expect(weekdayFormatter("en-US").format(instant)).toBe("Wed");
  });

  it("shows a single calendar date once and preserves real date ranges", () => {
    expect(formatMediumDateRange(
      "2026-03-30",
      "2026-03-30",
      "en-US",
      "to",
    )).toBe("Mar 30, 2026");
    expect(formatMediumDateRange(
      "2026-03-28",
      "2026-03-30",
      "es-ES",
      "a",
    )).toBe("28 mar 2026 a 30 mar 2026");
  });
});
