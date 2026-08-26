import { describe, expect, it } from "vitest";

import {
  comparisonPeriodPreset,
  defaultComparisonPeriods,
  initialComparisonRanges,
} from "./comparison-period-preset";

describe("comparison period presets", () => {
  it("compares the current ISO week to the same elapsed days of the previous week", () => {
    expect(comparisonPeriodPreset(
      "week",
      { from: "2026-01-01", through: "2026-08-26" },
      "2026-08-26",
    )).toEqual({
      kind: "week",
      baseline: { from: "2026-08-17", through: "2026-08-19" },
      comparison: { from: "2026-08-24", through: "2026-08-26" },
      anchorDate: "2026-08-26",
      anchor: "today",
    });
  });

  it("names a stale weekly selection as anchored to the latest recorded evidence", () => {
    expect(comparisonPeriodPreset(
      "week",
      { from: "2025-01-01", through: "2026-01-18" },
      "2026-08-26",
    )).toEqual({
      kind: "week",
      baseline: { from: "2026-01-05", through: "2026-01-11" },
      comparison: { from: "2026-01-12", through: "2026-01-18" },
      anchorDate: "2026-01-18",
      anchor: "latest-recorded",
    });
  });

  it("keeps month-to-date ranges inside each calendar month", () => {
    expect(comparisonPeriodPreset(
      "month",
      { from: "2025-01-01", through: "2026-03-31" },
      "2026-03-31",
    )).toEqual({
      kind: "month",
      baseline: { from: "2026-02-01", through: "2026-02-28" },
      comparison: { from: "2026-03-01", through: "2026-03-31" },
      anchorDate: "2026-03-31",
      anchor: "today",
    });
  });

  it("clamps a leap-day year-to-date baseline to the prior calendar year", () => {
    expect(comparisonPeriodPreset(
      "year",
      { from: "2022-01-01", through: "2024-02-29" },
      "2024-02-29",
    )).toEqual({
      kind: "year",
      baseline: { from: "2023-01-01", through: "2023-02-28" },
      comparison: { from: "2024-01-01", through: "2024-02-29" },
      anchorDate: "2024-02-29",
      anchor: "today",
    });
  });

  it("disables a calendar preset when its complete comparison boundary is unavailable", () => {
    expect(comparisonPeriodPreset(
      "week",
      { from: "2026-08-18", through: "2026-08-26" },
      "2026-08-26",
    )).toBeNull();
  });

  it("falls back to adjacent equal periods without defaulting both sides to one range", () => {
    expect(defaultComparisonPeriods(
      { from: "2026-08-23", through: "2026-08-26" },
      "2026-08-26",
    )).toEqual({
      kind: null,
      baseline: { from: "2026-08-23", through: "2026-08-24" },
      comparison: { from: "2026-08-25", through: "2026-08-26" },
      anchorDate: "2026-08-26",
      anchor: "today",
    });
  });

  it("returns no default when fewer than two calendar dates are available", () => {
    expect(defaultComparisonPeriods(
      { from: "2026-08-26", through: "2026-08-26" },
      "2026-08-26",
    )).toBeNull();
  });

  it("leaves an explicit manual baseline empty when no distinct default exists", () => {
    expect(initialComparisonRanges(
      { from: "2026-08-26", through: "2026-08-26" },
      { from: "2026-08-26", through: "2026-08-26" },
      "2026-08-26",
    )).toEqual({
      baseline: { from: "", through: "" },
      comparison: { from: "2026-08-26", through: "2026-08-26" },
    });
  });

  it("rejects malformed, reversed, and future-relative boundaries", () => {
    expect(comparisonPeriodPreset(
      "month",
      { from: "2026-02-01", through: "not-a-date" },
      "2026-08-26",
    )).toBeNull();
    expect(defaultComparisonPeriods(
      { from: "2026-08-27", through: "2026-08-26" },
      "2026-08-26",
    )).toBeNull();
  });
});
