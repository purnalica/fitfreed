import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import { TrainingSegmentationPanel } from "./TrainingSegmentationPanel";
import type {
  SegmentCriterion,
  TrainingSessionSegmentationResult,
} from "./training-session-segmentation";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

const snapshotRef = `training-snapshot-${"a".repeat(64)}`;
const sessionRef = `session-${"b".repeat(64)}`;
const firstExerciseRef = `exercise-${"c".repeat(64)}`;
const secondExerciseRef = `exercise-${"d".repeat(64)}`;

const equalTimeCriterion: SegmentCriterion = {
  criterionRef: `criterion-${"1".repeat(64)}`,
  title: "Five-minute blocks",
  definition: { kind: "equal-elapsed-time", spanMilliseconds: "300000" },
  authorship: "user",
  evaluationVersion: 1,
  revision: 1,
};

const heartRateCriterion: SegmentCriterion = {
  criterionRef: `criterion-${"2".repeat(64)}`,
  title: "Tempo range",
  definition: {
    kind: "heart-rate-zone",
    minimumBeatsPerMinute: 145,
    maximumBeatsPerMinute: 165,
  },
  authorship: "user",
  evaluationVersion: 1,
  revision: 2,
};

const manualCriterion: SegmentCriterion = {
  criterionRef: `criterion-${"3".repeat(64)}`,
  title: "Coach plan",
  definition: { kind: "manual-boundaries", elapsedMilliseconds: ["120000", "420000"] },
  authorship: "user",
  evaluationVersion: 1,
  revision: 1,
};

const distanceCriterion: SegmentCriterion = {
  criterionRef: `criterion-${"4".repeat(64)}`,
  title: "Kilometre repeats",
  definition: { kind: "equal-distance", spanMeters: 1000 },
  authorship: "user",
  evaluationVersion: 1,
  revision: 1,
};

function populatedResult(): TrainingSessionSegmentationResult {
  return {
    snapshotRef,
    sessionRef,
    availableCriteria: [
      equalTimeCriterion,
      heartRateCriterion,
      manualCriterion,
      distanceCriterion,
    ],
    exercises: [{
      exerciseRef: firstExerciseRef,
      ordinal: 0,
      durationMilliseconds: "600000",
      appliedCriteria: [{
        criterion: equalTimeCriterion,
        ordinal: 0,
        applicability: "applicable",
        requiredMeasurement: null,
        hasEvidenceGaps: false,
        segments: [{
          ordinal: 0,
          startedAtElapsedMilliseconds: "0",
          endedAtElapsedMilliseconds: "300000",
          attribution: "fitfreed-derived",
        }, {
          ordinal: 1,
          startedAtElapsedMilliseconds: "300000",
          endedAtElapsedMilliseconds: "600000",
          attribution: "fitfreed-derived",
        }],
      }, {
        criterion: heartRateCriterion,
        ordinal: 1,
        applicability: "applicable",
        requiredMeasurement: "heart-rate",
        hasEvidenceGaps: true,
        segments: [{
          ordinal: 0,
          startedAtElapsedMilliseconds: "65000",
          endedAtElapsedMilliseconds: "180000",
          attribution: "fitfreed-derived",
        }],
      }],
    }, {
      exerciseRef: secondExerciseRef,
      ordinal: 1,
      durationMilliseconds: "900000",
      appliedCriteria: [{
        criterion: distanceCriterion,
        ordinal: 0,
        applicability: "missing-prerequisite",
        requiredMeasurement: "distance",
        hasEvidenceGaps: false,
        segments: [],
      }],
    }],
  };
}

function emptyResult(): TrainingSessionSegmentationResult {
  return {
    snapshotRef,
    sessionRef,
    availableCriteria: [],
    exercises: [{
      exerciseRef: firstExerciseRef,
      ordinal: 0,
      durationMilliseconds: "600000",
      appliedCriteria: [],
    }],
  };
}

function renderPanel(onError = vi.fn()) {
  return {
    onError,
    ...render(
      <TrainingSegmentationPanel
        sessionRef={sessionRef}
        snapshotRef={snapshotRef}
        locale="en-US"
        messages={catalogs["en-US"]}
        onError={onError}
      />,
    ),
  };
}

function queryRequest() {
  return {
    query: { sessionRef, snapshotRef },
  };
}

afterEach(cleanup);

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe("TrainingSegmentationPanel", () => {
  it("shows exact derived segments, evidence limits, authorship, and missing prerequisites", async () => {
    mocks.invoke.mockResolvedValue(populatedResult());

    renderPanel();

    expect(await screen.findByRole("heading", { name: "Your session segments" })).toBeVisible();
    expect(mocks.invoke).toHaveBeenCalledWith(
      "query_training_session_segmentation",
      queryRequest(),
    );
    const fiveMinuteCard = screen.getByRole("heading", { name: "Five-minute blocks" })
      .closest("article");
    expect(fiveMinuteCard).not.toBeNull();
    expect(fiveMinuteCard).toHaveTextContent("Criterion authored by you");
    expect(fiveMinuteCard).toHaveTextContent("Calculated by FitFreed");
    expect(fiveMinuteCard).toHaveTextContent("Evaluation v1 · Definition revision 1");
    expect(within(fiveMinuteCard!).getByRole("img", {
      name: "Five-minute blocks: 2 FitFreed-derived segments across the exercise timeline.",
    })).toBeVisible();
    const table = within(fiveMinuteCard!).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(table).toHaveTextContent("0 min");
    expect(table).toHaveTextContent("5 min");
    expect(table).toHaveTextContent("10 min");

    const heartRateCard = screen.getByRole("heading", { name: "Tempo range" })
      .closest("article");
    expect(heartRateCard).toHaveTextContent(
      "Missing source slots split the result and remain unknown.",
    );
    const missingDistanceCard = screen.getByRole("heading", { name: "Kilometre repeats" })
      .closest("article");
    expect(missingDistanceCard).toHaveTextContent(
      "The required recorded measurement is not available for this exercise.",
    );
    expect(document.body).not.toHaveTextContent("criterion-");
    expect(document.body).not.toHaveTextContent("exercise-");
  });

  it("distinguishes an applicable rule with no matching recorded intervals", async () => {
    const result = populatedResult();
    result.exercises![0].appliedCriteria[1] = {
      ...result.exercises![0].appliedCriteria[1],
      hasEvidenceGaps: false,
      segments: [],
    };
    mocks.invoke.mockResolvedValue(result);

    renderPanel();

    const heartRateCard = (await screen.findByRole("heading", { name: "Tempo range" }))
      .closest("article");
    expect(heartRateCard).toHaveTextContent("No recorded interval matches this criterion.");
    expect(heartRateCard).not.toHaveTextContent("required recorded measurement is not available");
  });

  it("creates every supported rule with real values and rejects invalid drafts", async () => {
    const result = emptyResult();
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_segmentation") return Promise.resolve(result);
      if (command === "create_training_segment_criterion") return Promise.resolve(result);
      return Promise.reject(new Error(`Unexpected command: ${command}`));
    });
    const user = userEvent.setup();

    renderPanel();
    await screen.findByText("No personal criterion is applied to this exercise yet.");

    await user.click(screen.getByRole("button", { name: "Create a criterion" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name and valid, ordered values");
    expect(screen.getByRole("button", { name: "Save criterion" })).toBeDisabled();
    await user.type(screen.getByLabelText("Criterion name"), "Tempo blocks");
    const minuteInput = screen.getByLabelText("Minutes per segment");
    await user.clear(minuteInput);
    await user.type(minuteInput, "0");
    expect(screen.getByRole("button", { name: "Save criterion" })).toBeDisabled();
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "create_training_segment_criterion",
      expect.anything(),
    );
    await user.clear(minuteInput);
    await user.type(minuteInput, "7.5");
    await user.click(screen.getByRole("button", { name: "Save criterion" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_training_segment_criterion",
      { request: {
        sessionRef,
        snapshotRef,
        exerciseRef: firstExerciseRef,
        title: "Tempo blocks",
        definition: { kind: "equal-elapsed-time", spanMilliseconds: "450000" },
      } },
    ));

    await user.click(screen.getByRole("button", { name: "Create a criterion" }));
    await user.type(screen.getByLabelText("Criterion name"), "Mile rhythm");
    await user.selectOptions(screen.getByLabelText("Boundary rule"), "equal-distance");
    const distanceInput = screen.getByLabelText("Kilometres per segment");
    await user.clear(distanceInput);
    await user.type(distanceInput, "0.0001");
    expect(screen.getByRole("button", { name: "Save criterion" })).toBeDisabled();
    await user.clear(distanceInput);
    await user.type(distanceInput, "9223372036854.776");
    expect(screen.getByRole("button", { name: "Save criterion" })).toBeDisabled();
    await user.clear(distanceInput);
    await user.type(distanceInput, "1.609");
    await user.click(screen.getByRole("button", { name: "Save criterion" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_training_segment_criterion",
      { request: expect.objectContaining({
        title: "Mile rhythm",
        definition: { kind: "equal-distance", spanMeters: 1609 },
      }) },
    ));

    await user.click(screen.getByRole("button", { name: "Create a criterion" }));
    await user.type(screen.getByLabelText("Criterion name"), "Aerobic range");
    await user.selectOptions(screen.getByLabelText("Boundary rule"), "heart-rate-zone");
    await user.clear(screen.getByLabelText("Minimum bpm"));
    await user.type(screen.getByLabelText("Minimum bpm"), "170");
    await user.clear(screen.getByLabelText("Maximum bpm"));
    await user.type(screen.getByLabelText("Maximum bpm"), "160");
    expect(screen.getByRole("button", { name: "Save criterion" })).toBeDisabled();
    await user.clear(screen.getByLabelText("Minimum bpm"));
    await user.type(screen.getByLabelText("Minimum bpm"), "135");
    await user.clear(screen.getByLabelText("Maximum bpm"));
    await user.type(screen.getByLabelText("Maximum bpm"), "155");
    await user.click(screen.getByRole("button", { name: "Save criterion" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_training_segment_criterion",
      { request: expect.objectContaining({
        title: "Aerobic range",
        definition: {
          kind: "heart-rate-zone",
          minimumBeatsPerMinute: 135,
          maximumBeatsPerMinute: 155,
        },
      }) },
    ));

    await user.click(screen.getByRole("button", { name: "Create a criterion" }));
    await user.type(screen.getByLabelText("Criterion name"), "Race plan");
    await user.selectOptions(screen.getByLabelText("Boundary rule"), "manual-boundaries");
    const manualInput = screen.getByRole("textbox", {
      name: /Boundaries in elapsed minutes/,
    });
    await user.clear(manualInput);
    await user.type(manualInput, "12, 8");
    expect(screen.getByRole("button", { name: "Save criterion" })).toBeDisabled();
    await user.clear(manualInput);
    await user.type(manualInput, Array.from({ length: 100 }, (_, index) => index + 1).join(","));
    expect(screen.getByRole("button", { name: "Save criterion" })).toBeDisabled();
    await user.clear(manualInput);
    await user.type(manualInput, "8, 12.5, 20");
    await user.click(screen.getByRole("button", { name: "Save criterion" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "create_training_segment_criterion",
      { request: expect.objectContaining({
        title: "Race plan",
        definition: {
          kind: "manual-boundaries",
          elapsedMilliseconds: ["480000", "750000", "1200000"],
        },
      }) },
    ));
  });

  it("reuses, reorders, edits, removes, and restores multiple saved criteria", async () => {
    const result = populatedResult();
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_training_session_segmentation") return Promise.resolve(result);
      return Promise.resolve(result);
    });
    const user = userEvent.setup();
    const firstView = renderPanel();
    await screen.findByRole("heading", { name: "Five-minute blocks" });

    const firstCard = screen.getByRole("heading", { name: "Five-minute blocks" })
      .closest("article")!;
    const secondCard = screen.getByRole("heading", { name: "Tempo range" })
      .closest("article")!;
    expect(within(firstCard).getByRole("button", { name: "Move earlier" })).toBeDisabled();
    expect(within(secondCard).getByRole("button", { name: "Move later" })).toBeDisabled();
    await user.click(within(firstCard).getByRole("button", { name: "Move later" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "move_training_segment_criterion",
      { request: {
        sessionRef,
        snapshotRef,
        exerciseRef: firstExerciseRef,
        criterionRef: equalTimeCriterion.criterionRef,
        direction: "later",
      } },
    ));
    await user.click(within(secondCard).getByRole("button", { name: "Move earlier" }));
    expect(mocks.invoke).toHaveBeenCalledWith(
      "move_training_segment_criterion",
      { request: expect.objectContaining({
        criterionRef: heartRateCriterion.criterionRef,
        direction: "earlier",
      }) },
    );

    await user.click(within(firstCard).getByRole("button", { name: "Configure definition" }));
    expect(screen.getByText(/Saving updates every place where it is applied/)).toBeVisible();
    const title = screen.getByLabelText("Criterion name");
    await user.clear(title);
    await user.type(title, "Six-minute blocks");
    const interval = screen.getByLabelText("Minutes per segment");
    await user.clear(interval);
    await user.type(interval, "6");
    await user.click(screen.getByRole("button", { name: "Save criterion" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "update_training_segment_criterion",
      { request: {
        sessionRef,
        snapshotRef,
        criterionRef: equalTimeCriterion.criterionRef,
        expectedRevision: 1,
        title: "Six-minute blocks",
        definition: { kind: "equal-elapsed-time", spanMilliseconds: "360000" },
      } },
    ));

    await user.selectOptions(
      screen.getAllByLabelText("Saved criterion")[0]!,
      manualCriterion.criterionRef,
    );
    await user.click(screen.getAllByRole("button", { name: "Apply saved criterion" })[0]!);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "apply_training_segment_criterion",
      { request: {
        sessionRef,
        snapshotRef,
        exerciseRef: firstExerciseRef,
        criterionRef: manualCriterion.criterionRef,
      } },
    ));

    await user.click(within(secondCard).getByRole("button", { name: "Remove from exercise" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "remove_training_segment_criterion",
      { request: {
        sessionRef,
        snapshotRef,
        exerciseRef: firstExerciseRef,
        criterionRef: heartRateCriterion.criterionRef,
      } },
    ));
    expect(screen.getByRole("status")).toHaveTextContent(
      "The criterion was removed from this exercise; its reusable definition remains saved.",
    );

    firstView.unmount();
    renderPanel();
    expect(await screen.findByRole("heading", { name: "Five-minute blocks" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Tempo range" })).toBeVisible();
    expect(mocks.invoke.mock.calls.filter(
      ([command]) => command === "query_training_session_segmentation",
    )).toHaveLength(2);
  });

  it("reports loading failures and honest unevaluated or empty session states", async () => {
    const onError = vi.fn();
    mocks.invoke.mockRejectedValueOnce({ code: "training-segmentation-failed" });
    const failedView = renderPanel(onError);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your segmentation criteria could not be loaded from the local library.",
    );
    expect(onError).toHaveBeenCalledWith("training-segmentation-failed");

    failedView.unmount();
    mocks.invoke.mockResolvedValueOnce({ ...emptyResult(), exercises: null });
    const unavailableView = renderPanel();
    expect(await screen.findByText(/Reimport the source archive to evaluate them/)).toBeVisible();

    unavailableView.unmount();
    mocks.invoke.mockResolvedValueOnce({ ...emptyResult(), exercises: [] });
    renderPanel();
    expect(await screen.findByText("There are no recorded exercises to segment in this session."))
      .toBeVisible();
  });
});
