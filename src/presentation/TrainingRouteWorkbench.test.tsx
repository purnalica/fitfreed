import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { SessionStory } from "./session-story";
import type { TrainingSessionRange, TrainingSessionRangesResult } from "./training-session-range";
import { TrainingRangeInteractionProvider } from "./TrainingRangeInteractionProvider";
import { TrainingRouteWorkbench } from "./TrainingRouteWorkbench";

const commands = vi.hoisted(() => ({ invoke: vi.fn() }));
const viewport = vi.hoisted(() => ({
  create: vi.fn(),
  selectPoint: undefined as ((pointIndex: number) => void) | undefined,
  controller: {
    updateSelection: vi.fn(),
    updateOverlay: vi.fn(),
    updateRangeSelection: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    fitTrack: vi.fn(),
    invalidateSize: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: commands.invoke }));
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
    alignmentState: "exact-recorded" as const,
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
  const speedSignal = {
    signalRef: overlay.signalRef,
    ordinal: 0,
    role: "primary" as const,
    kind: "speed" as const,
    unit: "kilometers-per-hour" as const,
    intervalMilliseconds: "1000",
    sampleCount: 3,
    availableSampleCount: 2,
    projection: "source-ordinal-v1" as const,
    visualSamples: [12, 10, null].map((value, ordinal) => ({
      ordinal,
      elapsedMilliseconds: String(ordinal * 1000),
      value,
      gapBefore: false,
    })),
  };
  const emptyRole = {
    route: transitionRoute,
    signals: [],
    evidence: {
      routePointCount: 3,
      signalSeriesCount: 0,
      signalSeriesWithValuesCount: 0,
      partialSignalSeriesCount: 0,
      unavailableSignalSeriesCount: 0,
      emptySignalSeriesCount: 0,
      unsupportedSignalSeriesCount: 0,
      signalSampleCount: 0,
      availableSignalSampleCount: 0,
      unavailableSignalSampleCount: 0,
    },
    primaryMetric: null,
    eligibleOverlays: [],
    exactRoute: { routeRef: transitionRoute.routeRef, pointCount: 3 },
    exactSignals: [],
  };
  return {
    schemaVersion: 3,
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
    composition: {
      structureState: "source-absent",
      routeState: "source-absent",
      signalState: "source-absent",
      zoneState: "source-absent",
      exerciseCount: 1,
    },
    exercises: [{
      exerciseRef: `exercise-${"f".repeat(64)}`,
      ordinal: 0,
      sport: null,
      structure: null,
      zones: null,
      evidence: {
        hasStructure: false,
        manualLapCount: 0,
        automaticLapCount: 0,
        pauseCount: 0,
        zoneGroupCount: 0,
        zoneCount: 0,
        timedZoneCount: 0,
        unsupportedZoneGroupCount: 0,
      },
      primary: {
        route: primaryRoute,
        signals: [speedSignal],
        evidence: {
          routePointCount: 3,
          signalSeriesCount: 1,
          signalSeriesWithValuesCount: 1,
          partialSignalSeriesCount: 1,
          unavailableSignalSeriesCount: 0,
          emptySignalSeriesCount: 0,
          unsupportedSignalSeriesCount: 0,
          signalSampleCount: 3,
          availableSignalSampleCount: 2,
          unavailableSignalSampleCount: 1,
        },
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
  commands.invoke.mockReset();
  viewport.selectPoint = undefined;
  Object.values(viewport.controller).forEach((mock) => mock.mockReset());
  viewport.create.mockReset().mockImplementation((_element, options) => {
    viewport.selectPoint = options.onSelectPoint;
    return Promise.resolve(viewport.controller);
  });
});

afterEach(cleanup);

describe("TrainingRouteWorkbench", () => {
  it("authors an exact route range with pointer and keyboard-operable boundary handles", async () => {
    const currentStory = story();
    const exerciseRef = currentStory.exercises[0].exerciseRef;
    const routeRef = currentStory.exercises[0].primary.route!.routeRef;
    const sessionRef = currentStory.session.sessionRef;
    const snapshotRef = currentStory.snapshotRef;
    const savedRange: TrainingSessionRange = {
      rangeRef: `range-${"7".repeat(64)}`,
      exerciseRef,
      coordinate: { scope: "route-elapsed", routeRef },
      title: "Riverside effort",
      startedAtElapsedMilliseconds: "1000",
      endedAtElapsedMilliseconds: "2000",
      evidenceRevision: `range-evidence-${"8".repeat(64)}`,
      authorship: "user",
      state: "current",
      revision: 1,
    };
    const context = (ranges: TrainingSessionRange[]): TrainingSessionRangesResult => ({
      snapshotRef,
      sessionRef,
      sessionDurationMilliseconds: currentStory.session.durationMilliseconds,
      evidenceRevision: savedRange.evidenceRevision,
      exercises: [{
        exerciseRef,
        ordinal: 0,
        coordinates: [{
          coordinate: { scope: "route-elapsed", routeRef },
          maximumElapsedMilliseconds: "2000",
        }],
      }],
      ranges,
    });
    commands.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve(context([]));
      if (command === "create_training_session_range") return Promise.resolve(context([savedRange]));
      if (command === "query_training_session_range_summary") return new Promise(() => undefined);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    render(
      <TrainingRangeInteractionProvider
        sessionRef={sessionRef}
        snapshotRef={snapshotRef}
        story={currentStory}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      >
        <TrainingRouteWorkbench
          story={currentStory}
          locale="en-US"
          messages={catalogs["en-US"]}
          onOpenExactRoute={vi.fn()}
          onOpenExactSignal={vi.fn()}
        />
      </TrainingRangeInteractionProvider>,
    );

    const visibleRoute = screen.getByRole("combobox", { name: "Visible route" });
    expect(visibleRoute).toBeEnabled();
    await user.click(await screen.findByRole("button", {
      name: "Create a range from this point",
    }));
    expect(visibleRoute).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Timeline" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Start")).toHaveValue("0:00:00");
    expect(screen.getByLabelText("End")).toHaveValue("0:00:01");
    expect(viewport.controller.updateRangeSelection).toHaveBeenLastCalledWith({
      startedAtPointIndex: 0,
      endedAtPointIndex: 1,
    });

    const startHandle = screen.getByRole("slider", { name: "Range start on route" });
    const endHandle = screen.getByRole("slider", { name: "Range end on route" });
    expect(startHandle).toHaveAttribute("aria-valuetext", "Point 1 of 3 · 0 ms");
    endHandle.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByLabelText("End")).toHaveValue("0:00:02");
    expect(viewport.controller.updateRangeSelection).toHaveBeenLastCalledWith({
      startedAtPointIndex: 0,
      endedAtPointIndex: 2,
    });

    await user.click(screen.getByRole("button", { name: "Move range start" }));
    await act(async () => viewport.selectPoint?.(1));
    expect(screen.getByLabelText("Start")).toHaveValue("0:00:01");
    expect(screen.getByRole("button", { name: "Move range start" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.type(screen.getByLabelText("Range name"), "Riverside effort");
    await user.click(screen.getByRole("button", { name: "Save range" }));
    expect(commands.invoke).toHaveBeenCalledWith("create_training_session_range", {
      request: {
        sessionRef,
        snapshotRef,
        exerciseRef,
        coordinate: { scope: "route-elapsed", routeRef },
        title: "Riverside effort",
        startedAtElapsedMilliseconds: "1000",
        endedAtElapsedMilliseconds: "2000",
      },
    });
    expect(await screen.findByText("Range saved.")).toBeVisible();
    expect(visibleRoute).toBeEnabled();
    expect(screen.getByText("Riverside effort")).toBeVisible();
  });

  it("offers the only saved range for this route when another coordinate is selected", async () => {
    const currentStory = story();
    const exerciseRef = currentStory.exercises[0].exerciseRef;
    const routeRef = currentStory.exercises[0].primary.route!.routeRef;
    const rangeEvidenceRevision = `range-evidence-${"8".repeat(64)}`;
    const exerciseRange: TrainingSessionRange = {
      rangeRef: `range-${"6".repeat(64)}`,
      exerciseRef,
      coordinate: { scope: "exercise-elapsed" },
      title: "Warm-up",
      startedAtElapsedMilliseconds: "0",
      endedAtElapsedMilliseconds: "1000",
      evidenceRevision: rangeEvidenceRevision,
      authorship: "user",
      state: "current",
      revision: 1,
    };
    const routeRange: TrainingSessionRange = {
      ...exerciseRange,
      rangeRef: `range-${"7".repeat(64)}`,
      coordinate: { scope: "route-elapsed", routeRef },
      title: "Riverside effort",
      startedAtElapsedMilliseconds: "1000",
      endedAtElapsedMilliseconds: "2000",
    };
    commands.invoke.mockImplementation((command) => {
      if (command === "query_training_session_ranges") return Promise.resolve({
        snapshotRef: currentStory.snapshotRef,
        sessionRef: currentStory.session.sessionRef,
        sessionDurationMilliseconds: currentStory.session.durationMilliseconds,
        evidenceRevision: rangeEvidenceRevision,
        exercises: [{
          exerciseRef,
          ordinal: 0,
          coordinates: [{
            coordinate: { scope: "exercise-elapsed" },
            maximumElapsedMilliseconds: "3600000",
          }, {
            coordinate: { scope: "route-elapsed", routeRef },
            maximumElapsedMilliseconds: "2000",
          }],
        }],
        ranges: [exerciseRange, routeRange],
      } satisfies TrainingSessionRangesResult);
      if (command === "query_training_session_range_summary") return new Promise(() => undefined);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    render(
      <TrainingRangeInteractionProvider
        sessionRef={currentStory.session.sessionRef}
        snapshotRef={currentStory.snapshotRef}
        story={currentStory}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={vi.fn()}
      >
        <TrainingRouteWorkbench
          story={currentStory}
          locale="en-US"
          messages={catalogs["en-US"]}
          onOpenExactRoute={vi.fn()}
          onOpenExactSignal={vi.fn()}
        />
      </TrainingRangeInteractionProvider>,
    );

    const savedRange = await screen.findByRole("combobox", { name: "Saved range" });
    expect(savedRange).toHaveValue("");
    expect(screen.getByRole("option", {
      name: "Riverside effort · 0:00:01–0:00:02",
    })).toBeVisible();
    await user.selectOptions(savedRange, routeRange.rangeRef);

    expect(screen.getByText("Riverside effort")).toBeVisible();
    expect(viewport.controller.updateRangeSelection).toHaveBeenLastCalledWith({
      startedAtPointIndex: 1,
      endedAtPointIndex: 2,
    });
  });

  it("names projected positions by their exact source ordinal in a dense route", async () => {
    const denseStory = story();
    const role = denseStory.exercises[0].primary;
    role.route!.pointCount = 20_001;
    role.exactRoute!.pointCount = 20_001;
    role.route!.visualPoints = role.route!.visualPoints.map((point, index) => ({
      ...point,
      ordinal: [0, 10_000, 20_000][index],
    }));
    role.eligibleOverlays[0].alignedSamples = role.eligibleOverlays[0].alignedSamples.map(
      (sample, index) => ({
        ...sample,
        routePointOrdinal: [0, 10_000, 20_000][index],
      }),
    );

    render(
      <TrainingRouteWorkbench
        story={denseStory}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    const position = await screen.findByRole("slider", { name: "Recorded position" });
    fireEvent.change(position, { target: { value: "1" } });

    expect(await screen.findByText("Point 10,001 of 20,001")).toBeVisible();
    expect(position).toHaveAttribute("max", "2");
    expect(position).toHaveAttribute("aria-valuetext", "Point 10,001 of 20,001 · 1 s");
  });

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
    const signalLanes = within(workbench).getByRole("region", {
      name: "Recorded measurements along the route",
    });
    const paceLane = within(signalLanes).getByRole("slider", {
      name: "Pace lane position",
    });
    expect(paceLane).toHaveAttribute("aria-valuenow", "1");
    expect(paceLane).toHaveAttribute(
      "aria-valuetext",
      "Point 1 of 3 · 0 ms · 5:00 min/km",
    );
    expect(paceLane.querySelectorAll("polyline")).toHaveLength(1);
    expect(paceLane.querySelectorAll(".training-route-signal-cursor")).toHaveLength(1);

    const position = within(workbench).getByRole("slider", { name: "Recorded position" });
    expect(position).toHaveAttribute("aria-valuetext", "Point 1 of 3 · 0 ms");
    position.focus();
    fireEvent.change(position, { target: { value: "1" } });
    expect(await screen.findByText("Point 2 of 3")).toBeVisible();
    expect(workbench).toHaveTextContent("1 s");
    expect(workbench).toHaveTextContent("6:00 min/km");
    expect(position).toHaveAttribute("aria-valuetext", "Point 2 of 3 · 1 s");
    expect(viewport.controller.updateSelection).toHaveBeenLastCalledWith(1);

    paceLane.focus();
    await user.keyboard("{ArrowRight}");
    expect(await screen.findByText("Point 3 of 3")).toBeVisible();
    expect(paceLane).toHaveAttribute("aria-valuenow", "3");
    await user.keyboard("{Home}");
    expect(await screen.findByText("Point 1 of 3")).toBeVisible();
    await user.keyboard("{End}");
    expect(await screen.findByText("Point 3 of 3")).toBeVisible();

    vi.spyOn(paceLane, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 100,
      width: 300,
      height: 100,
      toJSON: () => ({}),
    });
    fireEvent.click(paceLane, { clientX: 0 });
    expect(await screen.findByText("Point 1 of 3")).toBeVisible();

    await act(async () => viewport.selectPoint?.(2));
    expect(await screen.findByText("Point 3 of 3")).toBeVisible();
    expect(workbench).toHaveTextContent("No recorded pace at this position");

    const trackDisplay = within(workbench).getByRole("combobox", { name: "Track display" });
    await user.selectOptions(trackDisplay, "");
    expect(within(signalLanes).getByRole("button", {
      name: "Inspect exact Pace source (Speed)",
    })).toBeVisible();
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
      2,
      expect.any(HTMLButtonElement),
    );
    expect(onOpenExactSignal).toHaveBeenCalledWith(
      `signal-${"b".repeat(64)}`,
      2,
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
    expect(within(workbench).queryByRole("region", {
      name: "Mediciones registradas a lo largo de la ruta",
    })).not.toBeInTheDocument();
    await user.selectOptions(
      within(workbench).getByRole("combobox", { name: "Ruta visible" }),
      "0:transition",
    );
    expect(viewport.controller.destroy).toHaveBeenCalledOnce();
    expect(viewport.create).toHaveBeenCalledTimes(2);
    expect(workbench).toHaveTextContent("Ruta de transición");
  });

  it("bounds a dense route to four user-selected full-width measurement lanes", async () => {
    const denseStory = story();
    const primary = denseStory.exercises[0].primary;
    const metrics = [
      ["heart-rate", "heart-rate", "beats-per-minute"],
      ["elevation", "altitude", "meters"],
      ["cadence", "cadence", "rotations-per-minute"],
      ["power", "left-crank-power", "watts"],
    ] as const;
    metrics.forEach(([metric, kind, unit], index) => {
      const signalRef = `signal-${String(index + 2).repeat(64)}`;
      primary.eligibleOverlays.push({
        signalRef,
        metric,
        sourceKind: kind,
        sourceUnit: unit,
        valueTransform: "identity",
        alignmentState: "exact-recorded",
        alignedSamples: [0, 1, 2].map((ordinal) => ({
          routePointOrdinal: ordinal,
          signalSampleOrdinal: ordinal,
          elapsedMilliseconds: String(ordinal * 1000),
          value: 100 + ordinal,
          gapBefore: false,
        })),
      });
      primary.signals.push({
        signalRef,
        ordinal: index + 1,
        role: "primary",
        kind,
        unit,
        intervalMilliseconds: "1000",
        sampleCount: 3,
        availableSampleCount: 3,
        projection: "source-ordinal-v1",
        visualSamples: [0, 1, 2].map((ordinal) => ({
          ordinal,
          elapsedMilliseconds: String(ordinal * 1000),
          value: 100 + ordinal,
          gapBefore: false,
        })),
      });
      primary.exactSignals.push({ signalRef, kind, unit, sampleCount: 3 });
    });
    const user = userEvent.setup();

    render(
      <TrainingRouteWorkbench
        story={denseStory}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    const lanes = screen.getByRole("region", {
      name: "Recorded measurements along the route",
    });
    expect(within(lanes).getAllByRole("checkbox")).toHaveLength(5);
    expect(within(lanes).getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    expect(within(lanes).getAllByRole("slider")).toHaveLength(3);

    await user.click(within(lanes).getByRole("checkbox", { name: "Cadence" }));
    expect(within(lanes).getAllByRole("slider")).toHaveLength(4);
    expect(within(lanes).getByRole("checkbox", { name: "Power" })).toBeDisabled();
    await user.click(within(lanes).getByRole("checkbox", { name: "Elevation" }));
    expect(within(lanes).getByRole("checkbox", { name: "Power" })).toBeEnabled();
    await user.click(within(lanes).getByRole("checkbox", { name: "Power" }));
    expect(within(lanes).getAllByRole("slider")).toHaveLength(4);
  });

  it("splits synchronized lane geometry at a recorded source gap", () => {
    const gapStory = story();
    gapStory.exercises[0].primary.eligibleOverlays[0].alignedSamples[1].gapBefore = true;
    gapStory.exercises[0].primary.signals[0].visualSamples[1].gapBefore = true;

    render(
      <TrainingRouteWorkbench
        story={gapStory}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={vi.fn()}
      />,
    );

    const lane = screen.getByRole("slider", { name: "Pace lane position" });
    expect(lane.querySelectorAll("polyline")).toHaveLength(0);
    expect(lane.querySelectorAll(".training-route-signal-lane-isolated")).toHaveLength(2);
  });

  it("keeps the bounded lane but does not invent an exact sample target at an unaligned point", async () => {
    const partiallyAligned = story();
    partiallyAligned.exercises[0].primary.eligibleOverlays[0].alignedSamples =
      partiallyAligned.exercises[0].primary.eligibleOverlays[0].alignedSamples.slice(0, 1);
    const onOpenExactSignal = vi.fn();
    const user = userEvent.setup();
    render(
      <TrainingRouteWorkbench
        story={partiallyAligned}
        locale="en-US"
        messages={catalogs["en-US"]}
        onOpenExactRoute={vi.fn()}
        onOpenExactSignal={onOpenExactSignal}
      />,
    );

    expect(screen.getByRole("slider", { name: "Pace lane position" })
      .querySelectorAll("polyline")).toHaveLength(1);
    fireEvent.change(screen.getByRole("slider", { name: "Recorded position" }), {
      target: { value: "1" },
    });
    await user.click(screen.getByRole("button", {
      name: "Inspect exact Pace source (Speed)",
    }));

    expect(onOpenExactSignal).toHaveBeenCalledWith(
      `signal-${"b".repeat(64)}`,
      null,
      expect.any(HTMLButtonElement),
    );
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
