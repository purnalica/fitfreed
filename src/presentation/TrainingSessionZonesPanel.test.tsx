import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { TrainingExerciseZones } from "./training-session-zone";
import { TrainingSessionZonesPanel } from "./TrainingSessionZonesPanel";

const assessment: TrainingExerciseZones = {
  exerciseRef: `exercise-${"1".repeat(64)}`,
  ordinal: 0,
  zones: {
    groups: [{
      zoneGroupRef: `zone-group-${"2".repeat(64)}`,
      ordinal: 0,
      kind: "heart-rate",
      unit: "beats-per-minute",
      zones: [{
        zoneRef: `zone-${"3".repeat(64)}`,
        ordinal: 0,
        lowerLimit: 120,
        higherLimit: 139,
        timeInZoneMilliseconds: "900000",
        distanceMeters: null,
        muscleLoad: null,
      }, {
        zoneRef: `zone-${"4".repeat(64)}`,
        ordinal: 1,
        lowerLimit: 140,
        higherLimit: 159,
        timeInZoneMilliseconds: null,
        distanceMeters: null,
        muscleLoad: null,
      }],
    }, {
      zoneGroupRef: `zone-group-${"5".repeat(64)}`,
      ordinal: 1,
      kind: "speed",
      unit: "kilometers-per-hour",
      zones: [{
        zoneRef: `zone-${"6".repeat(64)}`,
        ordinal: 0,
        lowerLimit: 8,
        higherLimit: 10,
        timeInZoneMilliseconds: "600000",
        distanceMeters: 2500.5,
        muscleLoad: null,
      }],
    }, {
      zoneGroupRef: `zone-group-${"7".repeat(64)}`,
      ordinal: 2,
      kind: "power",
      unit: "watts",
      zones: [{
        zoneRef: `zone-${"8".repeat(64)}`,
        ordinal: 0,
        lowerLimit: 180,
        higherLimit: 219,
        timeInZoneMilliseconds: "300000",
        distanceMeters: null,
        muscleLoad: 42.5,
      }],
    }],
    unsupportedGroupCount: 1,
  },
};

afterEach(cleanup);

describe("TrainingSessionZonesPanel", () => {
  it("renders source attribution, proportional known time, and every exact value", () => {
    render(
      <TrainingSessionZonesPanel
        assessment={assessment}
        locale="en-US"
        messages={catalogs["en-US"]}
      />,
    );

    const panel = screen.getByRole("region", { name: "Recorded zones" });
    expect(panel).toHaveTextContent("Recorded by the source");
    expect(panel).toHaveTextContent("aggregate distribution, not a timeline");
    const heartRate = within(panel).getByRole("region", { name: "Heart rate · group 1" });
    expect(within(heartRate).getByRole("img", {
      name: "Heart rate distribution with recorded time for 1 of 2 zones.",
    })).toBeVisible();
    expect(within(heartRate).getAllByRole("row")).toHaveLength(3);
    expect(heartRate).toHaveTextContent("120–139 bpm");
    expect(heartRate).toHaveTextContent("15 min");
    expect(heartRate).toHaveTextContent("Not recorded");
    expect(panel).toHaveTextContent("8–10 km/h");
    expect(panel).toHaveTextContent("2,500.5 m");
    expect(panel).toHaveTextContent("180–219 W");
    expect(panel).toHaveTextContent("42.5");
    expect(panel).toHaveTextContent(
      "1 unsupported source zone group was preserved as an explicit count.",
    );
    expect(panel).not.toHaveTextContent("zone-");
    expect(panel).not.toHaveTextContent("exercise-");
  });

  it("preserves absent and empty states without inventing evidence", () => {
    const { rerender } = render(
      <TrainingSessionZonesPanel
        assessment={{ ...assessment, zones: null }}
        locale="en-US"
        messages={catalogs["en-US"]}
      />,
    );
    expect(screen.getByText(
      "The source did not provide a zone container for this exercise.",
    )).toBeVisible();

    rerender(
      <TrainingSessionZonesPanel
        assessment={{
          ...assessment,
          zones: { groups: [], unsupportedGroupCount: 0 },
        }}
        locale="en-US"
        messages={catalogs["en-US"]}
      />,
    );
    expect(screen.getByText("The source provided a zone container with no groups."))
      .toBeVisible();

    rerender(
      <TrainingSessionZonesPanel
        assessment={{
          ...assessment,
          zones: {
            groups: [{ ...assessment.zones!.groups[0]!, zones: null }],
            unsupportedGroupCount: 0,
          },
        }}
        locale="en-US"
        messages={catalogs["en-US"]}
      />,
    );
    expect(screen.getByText("The source did not provide bands for this group.")).toBeVisible();

    rerender(
      <TrainingSessionZonesPanel
        assessment={{
          ...assessment,
          zones: {
            groups: [{ ...assessment.zones!.groups[0]!, zones: [] }],
            unsupportedGroupCount: 0,
          },
        }}
        locale="en-US"
        messages={catalogs["en-US"]}
      />,
    );
    expect(screen.getByText("The source provided this group with no bands.")).toBeVisible();
  });

  it("localizes labels and exact numeric evidence for Spanish", () => {
    render(
      <TrainingSessionZonesPanel
        assessment={assessment}
        locale="es-ES"
        messages={catalogs["es-ES"]}
      />,
    );

    const panel = screen.getByRole("region", { name: "Zonas registradas" });
    expect(panel).toHaveTextContent("Registrado por el origen");
    expect(panel).toHaveTextContent("2500,5 m");
    expect(panel).toHaveTextContent("No registrado");
  });
});
