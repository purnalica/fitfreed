import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { SessionStory } from "./session-story";
import { TrainingRouteWorkbench } from "./TrainingRouteWorkbench";

const viewport = vi.hoisted(() => ({
  create: vi.fn(),
  selectPoint: undefined as ((pointIndex: number) => void) | undefined,
  controller: {
    updateSelection: vi.fn(),
    updateOverlay: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitTrack: vi.fn(),
    invalidateSize: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock("./leaflet-route-adapter", () => ({
  createLocalRouteViewport: viewport.create,
}));

function story(withElapsed = true): SessionStory {
  const points = [0, 1, 2].map((ordinal) => ({
    ordinal,
    latitudeDegrees: 40 + ordinal / 100,
    longitudeDegrees: -3.7 + ordinal / 100,
    altitudeMeters: ordinal === 1 ? null : 100 + ordinal,
    elapsedMilliseconds: withElapsed ? String(ordinal * 1000) : null,
  }));
  const primaryRoute = {
    routeRef: `route-${"a".repeat(64)}`,
    kind: "primary" as const,
    startedAtLocal: "2026-08-17T18:30:00",
    pointCount: 3,
    altitudePointCount: 2,
    elapsedPointCount: withElapsed ? 3 : 0,
    projection: "source-ordinal-v1" as const,
    visualPoints: points,
  };
  const transitionRoute = {
    ...primaryRoute,
    routeRef: `route-${"c".repeat(64)}`,
    kind: "transition" as const,
  };
  const overlay = {
    signalRef: `signal-${"b".repeat(64)}`,
    metric: "pace" as const,
    sourceKind: "speed" as const,
    sourceUnit: "kilometers-per-hour" as const,
    valueTransform: "kilometers-per-hour-to-minutes-per-kilometer" as const,
    alignedSamples: withElapsed ? [{
      routePointOrdinal: 0,
      signalSampleOrdinal: 0,
      elapsedMilliseconds: "0",
      value: 12,
      gapBefore: false,
    }, {
      routePointOrdinal: 1,
      signalSampleOrdinal: 1,
      elapsedMilliseconds: "1000",
      value: 10,
      gapBefore: false,
    }, {
      routePointOrdinal: 2,
      signalSampleOrdinal: 2,
      elapsedMilliseconds: "2000",
      value: null,
      gapBefore: false,
    }] : [],
  };
  const emptyRole = {
    route: transitionRoute,
    signals: [],
    primaryMetric: null,
    eligibleOverlays: [],
    exactRoute: { routeRef: transitionRoute.routeRef, pointCount: 3 },
    exactSignals: [],
  };
  return {
    schemaVersion: 1,
    snapshotRef: "snapshot-current",
    session: {
      sessionRef: `session-${"d".repeat(64)}`,
      sourceIndex: 1,
      startedAtLocal: "2026-08-17T18:30:00",
      stoppedAtLocal: "2026-08-17T19:30:00",
      utcOffsetMinutes: 120,
      durationMilliseconds: "3600000",
      distanceMeters: 10000,
      energyKilocalories: "600",
      averageHeartRateBpm: "145",
      maximumHeartRateBpm: "170",
      exerciseCount: 1,
      sport: {
        sportRef: `sport-${"e".repeat(64)}`,
        state: "classified",
        classification: {
          canonicalFamily: "running",
          displayLabel: "Trail running",
          authorship: "user",
          revision: 1,
        },
      },
    },
    structure: { exercises: null },
    routes: { exercises: null },
    signals: { exercises: null },
    zones: { exercises: null },
    provenance: {
      totalEventCount: 1,
      current: {
        provider: "polar-flow",
        sourceModifiedAtUtc: "2026-08-17T19:31:00Z",
        sourceAdapterVersion: "polar-flow-archive@11",
        mappingVersion: "polar-flow-training-session@6",
        contributingEventCount: 1,
        nonContributingEventCount: 0,
      },
    },
    exercises: [{
      exerciseRef: `exercise-${"f".repeat(64)}`,
      ordinal: 0,
      sport: null,
      structure: null,
      zones: null,
      primary: {
        route: primaryRoute,
        signals: [],
        primaryMetric: "pace",
        eligibleOverlays: [overlay],
        exactRoute: { routeRef: primaryRoute.routeRef, pointCount: 3 },
        exactSignals: [{
          signalRef: overlay.signalRef,
          kind: "speed",
          unit: "kilometers-per-hour",
          sampleCount: 3,
        }],
      },
      transition: emptyRole,
    }],
  };
}

beforeEach(() => {
  viewport.selectPoint = undefined;
  Object.values(viewport.controller).forEach((mock) => mock.mockReset());
  viewport.create.mockReset().mockImplementation((_element, options) => {
    viewport.selectPoint = options.onSelectPoint;
    return Promise.resolve(viewport.controller);
  });
});

afterEach(cleanup);

describe("TrainingRouteWorkbench", () => {
  it("keeps map, elapsed selection, overlay evidence, exact paths, and named viewport controls synchronized", async () => {
    const user = userEvent.setup();
    const onOpenExactRoute = vi.fn();
    const onOpenExactSignal = vi.fn();
    render(
      <>
        <button type="button">Outside the map workspace</button>
        <TrainingRouteWorkbench
          story={story()}
          locale="en-US"
          messages={catalogs["en-US"]}
          onOpenExactRoute={onOpenExactRoute}
          onOpenExactSignal={onOpenExactSignal}
        />
      </>,
    );

    const workbench = screen.getByRole("region", { name: "Recorded route workbench" });
    expect(within(workbench).getByRole("heading", {
      name: "Explore this recorded route",
    })).toBeVisible();
    const map = within(workbench).getByRole("region", { name: "Recorded route map" });
    await screen.findByText("Point 1 of 3");
    expect(viewport.create).toHaveBeenCalledTimes(1);
    expect(map).toHaveAttribute("tabindex", "0");
    expect(workbench).toHaveTextContent("0 ms");
    expect(workbench).toHaveTextContent("5:00 min/km");

    const position = within(workbench).getByRole("slider", { name: "Recorded position" });
    expect(position).toHaveAttribute("aria-valuetext", "Point 1 of 3 · 0 ms");
    position.focus();
    fireEvent.change(position, { target: { value: "1" } });
    expect(await screen.findByText("Point 2 of 3")).toBeVisible();
    expect(workbench).toHaveTextContent("1 s");
    expect(workbench).toHaveTextContent("6:00 min/km");
    expect(position).toHaveAttribute("aria-valuetext", "Point 2 of 3 · 1 s");
    expect(viewport.controller.updateSelection).toHaveBeenLastCalledWith(1);

    await act(async () => viewport.selectPoint?.(2));
    expect(await screen.findByText("Point 3 of 3")).toBeVisible();
    expect(workbench).toHaveTextContent("No recorded pace at this position");

    const trackDisplay = within(workbench).getByRole("combobox", { name: "Track display" });
    await user.selectOptions(trackDisplay, "");
    expect(within(workbench).queryByRole("button", {
      name: /Inspect exact .* samples/,
    })).not.toBeInTheDocument();
    await user.selectOptions(
      trackDisplay,
      `signal-${"b".repeat(64)}`,
    );
    expect(viewport.controller.updateOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ signalRef: `signal-${"b".repeat(64)}` }),
    );
    expect(workbench).toHaveTextContent("Pace on the recorded track");

    await user.click(within(workbench).getByRole("button", { name: "Zoom in" }));
    await user.click(within(workbench).getByRole("button", { name: "Zoom out" }));
    await user.click(within(workbench).getByRole("button", { name: "Show the complete track" }));
    expect(viewport.controller.zoomIn).toHaveBeenCalledOnce();
    expect(viewport.controller.zoomOut).toHaveBeenCalledOnce();
    expect(viewport.controller.fitTrack).toHaveBeenCalledOnce();

    await user.click(within(workbench).getByRole("button", { name: "Focus the map" }));
    expect(workbench).toHaveAttribute("data-focused", "true");
    expect(workbench).toHaveAttribute("role", "dialog");
    expect(workbench).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Outside the map workspace", hidden: true }))
      .toHaveAttribute("inert");
    expect(within(workbench).getByRole("button", { name: "Return to the session" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(workbench).toHaveAttribute("role", "region");
    expect(workbench).not.toHaveAttribute("aria-modal");
    expect(screen.getByRole("button", { name: "Outside the map workspace" }))
      .not.toHaveAttribute("inert");
    expect(within(workbench).getByRole("button", { name: "Focus the map" })).toHaveFocus();

    await user.click(within(workbench).getByRole("button", { name: "Focus the map" }));
    await user.click(within(workbench).getByRole("button", { name: "Return to the session" }));
    expect(within(workbench).getByRole("button", { name: "Focus the map" })).toHaveFocus();

    await user.click(within(workbench).getByRole("button", { name: "Focus the map" }));
    await user.click(within(workbench).getByRole("button", {
      name: "Inspect exact recorded route points",
    }));
    expect(workbench).toHaveAttribute("role", "region");
    expect(workbench).toHaveAttribute("data-focused", "false");
    await user.click(within(workbench).getByRole("button", {
      name: "Inspect exact Pace source (Speed)",
    }));
    expect(onOpenExactRoute).toHaveBeenCalledWith(
      `route-${"a".repeat(64)}`,
      expect.any(HTMLButtonElement),
    );
    expect(onOpenExactSignal).toHaveBeenCalledWith(
      `signal-${"b".repeat(64)}`,
      expect.any(HTMLButtonElement),
    );
  });

  it("switches route roles without bridging them and keeps a route usable without elapsed evidence", async () => {
    const user = userEvent.setup();
    render(
      <TrainingRouteWorkbench
        story={story(false)}
        locale="es-ES"
        messages={catalogs["es-ES"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    const workbench = screen.getByRole("region", { name: "Banco de trabajo de la ruta registrada" });
    expect(within(workbench).queryByRole("slider", { name: "Posición registrada" }))
      .not.toBeInTheDocument();
    expect(workbench).toHaveTextContent("Este punto no tiene tiempo transcurrido registrado.");
    await user.selectOptions(
      within(workbench).getByRole("combobox", { name: "Ruta visible" }),
      "0:transition",
    );
    expect(viewport.controller.destroy).toHaveBeenCalledOnce();
    expect(viewport.create).toHaveBeenCalledTimes(2);
    expect(workbench).toHaveTextContent("Ruta de transición");
  });

  it("distinguishes route choices across multiple exercises", () => {
    const multiExercise = story();
    const secondExercise = structuredClone(multiExercise.exercises[0]);
    multiExercise.exercises[0].transition.route = null;
    secondExercise.exerciseRef = `exercise-${"9".repeat(64)}`;
    secondExercise.ordinal = 1;
    secondExercise.primary.route!.routeRef = `route-${"8".repeat(64)}`;
    secondExercise.transition.route = null;
    multiExercise.exercises.push(secondExercise);

    render(
      <TrainingRouteWorkbench
        story={multiExercise}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    const routeChoices = within(screen.getByRole("combobox", { name: "Visible route" }))
      .getAllByRole("option");
    expect(routeChoices.map((option) => option.textContent)).toEqual([
      "Exercise 1 · Primary route",
      "Exercise 2 · Primary route",
    ]);
  });

  it("does not reserve an empty map when the story has no route", () => {
    const withoutRoute = story();
    withoutRoute.exercises[0].primary.route = null;
    withoutRoute.exercises[0].transition.route = null;

    const { container } = render(
      <TrainingRouteWorkbench
        story={withoutRoute}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(viewport.create).not.toHaveBeenCalled();
  });

  it("recreates revised geometry at the still-selected bounded evidence point", async () => {
    const initial = story();
    const { rerender } = render(
      <TrainingRouteWorkbench
        story={initial}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );
    await screen.findByText("Point 1 of 3");
    fireEvent.change(screen.getByRole("slider", { name: "Recorded position" }), {
      target: { value: "1" },
    });
    expect(await screen.findByText("Point 2 of 3")).toBeVisible();

    const revised = story();
    revised.snapshotRef = "snapshot-revised";
    revised.exercises[0].primary.route!.visualPoints[1].latitudeDegrees = 41;
    rerender(
      <TrainingRouteWorkbench
        story={revised}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    await act(async () => undefined);
    expect(viewport.controller.destroy).toHaveBeenCalledOnce();
    expect(viewport.create).toHaveBeenCalledTimes(2);
    expect(viewport.create.mock.calls.at(-1)?.[1]).toEqual(expect.objectContaining({
      selectedPointIndex: 1,
      points: expect.arrayContaining([
        expect.objectContaining({ viewportLatitudeDegrees: 41 }),
      ]),
    }));
    expect(screen.getByText("Point 2 of 3")).toBeVisible();
  });

  it("applies selection and overlay changes made while the spatial adapter is loading", async () => {
    let finishCreation: ((value: typeof viewport.controller) => void) | undefined;
    viewport.create.mockReturnValueOnce(new Promise((resolve) => {
      finishCreation = resolve;
    }));
    const user = userEvent.setup();
    render(
      <TrainingRouteWorkbench
        story={story()}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("slider", { name: "Recorded position" }), {
      target: { value: "1" },
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Track display" }), "");
    await act(async () => finishCreation?.(viewport.controller));

    expect(viewport.controller.updateSelection).toHaveBeenLastCalledWith(1);
    expect(viewport.controller.updateOverlay).toHaveBeenLastCalledWith(null);
    expect(screen.getByText("Point 2 of 3")).toBeVisible();
  });
});
