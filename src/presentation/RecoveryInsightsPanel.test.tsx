import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { ExplorerNavigationRequest } from "./explorer-navigation";
import { RecoveryInsightsPanel } from "./RecoveryInsightsPanel";
import type {
  RecoveryComparison,
  RecoveryNightDetail,
  RecoveryNightInsight,
  RecoveryOverview,
  RecoverySeriesSummary,
} from "./recovery-insights";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

afterEach(() => {
  cleanup();
  mocks.invoke.mockReset();
});

function night(overrides: Partial<RecoveryNightInsight> = {}): RecoveryNightInsight {
  return {
    beatToBeatIntervalMilliseconds: "900",
    heartRateVariabilityRmssdMilliseconds: "42",
    breathingIntervalMilliseconds: "4100",
    sourceAssessment: {
      scheme: "synthetic-assessment@1",
      autonomicCharge: 1.5,
      autonomicStatus: 4,
      overallStatus: 5,
      overallSublevel: "2",
    },
    sourceBaselineAvailable: true,
    sourceGuidanceAvailable: true,
    ...overrides,
  };
}

function summary(overrides: Partial<RecoverySeriesSummary> = {}): RecoverySeriesSummary {
  return {
    calendarDays: 3,
    observedNights: 2,
    missingNights: 1,
    averageBeatToBeatIntervalMilliseconds: "905",
    rmssdNightCount: 1,
    averageHeartRateVariabilityRmssdMilliseconds: "42",
    averageBreathingIntervalMilliseconds: "4150",
    assessmentNightCount: 1,
    baselineNightCount: 1,
    guidanceNightCount: 1,
    ...overrides,
  };
}

function overview(
  selectedRange = { from: "2026-03-28", through: "2026-03-30" },
): RecoveryOverview {
  return {
    availableRange: { from: "2026-03-01", through: "2026-03-30" },
    selectedRange,
    series: [
      {
        seriesRef: "opaque-recovery-alpha",
        summary: summary(),
        days: [
          { recoveryDate: "2026-03-28", availability: "available", recovery: night() },
          { recoveryDate: "2026-03-29", availability: "missing", recovery: null },
          {
            recoveryDate: "2026-03-30",
            availability: "available",
            recovery: night({
              beatToBeatIntervalMilliseconds: "910",
              heartRateVariabilityRmssdMilliseconds: null,
              breathingIntervalMilliseconds: "4200",
              sourceAssessment: null,
              sourceBaselineAvailable: false,
              sourceGuidanceAvailable: false,
            }),
          },
        ],
      },
      {
        seriesRef: "opaque-recovery-beta",
        summary: summary({
          observedNights: 1,
          missingNights: 2,
          rmssdNightCount: 0,
          averageHeartRateVariabilityRmssdMilliseconds: null,
          assessmentNightCount: 0,
          baselineNightCount: 0,
          guidanceNightCount: 0,
        }),
        days: [
          {
            recoveryDate: "2026-03-28",
            availability: "available",
            recovery: night({
              heartRateVariabilityRmssdMilliseconds: null,
              sourceAssessment: null,
              sourceBaselineAvailable: false,
              sourceGuidanceAvailable: false,
            }),
          },
          { recoveryDate: "2026-03-29", availability: "missing", recovery: null },
          { recoveryDate: "2026-03-30", availability: "missing", recovery: null },
        ],
      },
    ],
  };
}

function detail(recoveryDate = "2026-03-28"): RecoveryNightDetail {
  return {
    recoveryDate,
    beatToBeatIntervalMilliseconds: "900",
    heartRateVariabilityRmssdMilliseconds: "42",
    breathingIntervalMilliseconds: "4100",
    sourceAssessment: {
      scheme: "synthetic-assessment@1",
      autonomicCharge: 1.5,
      autonomicStatus: 4,
      overallStatus: 5,
      overallSublevel: "2",
    },
    sourceBaseline: {
      scheme: "synthetic-baseline@1",
      meanBeatToBeatIntervalMilliseconds: "910",
      standardDeviationBeatToBeatIntervalMilliseconds: "30",
      meanHeartRateVariabilityRmssdMilliseconds: "40",
      standardDeviationHeartRateVariabilityRmssdMilliseconds: "8",
      meanBreathingIntervalMilliseconds: "4200",
      standardDeviationBreathingIntervalMilliseconds: "120",
    },
    sourceGuidance: {
      scheme: "synthetic-guidance@1",
      exercise: "Choose a steady synthetic session.",
      sleep: "Keep a consistent synthetic schedule.",
      vitality: "Plan a synthetic restorative break.",
    },
  };
}

function comparison(): RecoveryComparison {
  return {
    availableRange: { from: "2026-03-01", through: "2026-03-30" },
    baselineRange: { from: "2026-03-01", through: "2026-03-03" },
    comparisonRange: { from: "2026-03-28", through: "2026-03-30" },
    series: [{
      seriesRef: "opaque-recovery-alpha",
      baseline: summary({
        observedNights: 3,
        missingNights: 0,
        averageBeatToBeatIntervalMilliseconds: "880",
        averageHeartRateVariabilityRmssdMilliseconds: null,
        rmssdNightCount: 0,
        assessmentNightCount: 2,
        baselineNightCount: 2,
        guidanceNightCount: 0,
      }),
      comparison: summary(),
      observedNightChange: "-1",
      missingNightChange: "1",
      averageBeatToBeatIntervalMillisecondsChange: "25",
      averageHeartRateVariabilityRmssdMillisecondsChange: null,
      averageBreathingIntervalMillisecondsChange: "-50",
      assessmentNightChange: "-1",
      baselineNightChange: "-1",
      guidanceNightChange: "1",
    }],
  };
}

function renderPanel(overrides: {
  locale?: "en-US" | "es-ES";
  refreshToken?: number;
  navigationRequest?: ExplorerNavigationRequest;
  onError?: (code: string | undefined) => void;
} = {}) {
  const locale = overrides.locale ?? "en-US";
  return render(
    <RecoveryInsightsPanel
      locale={locale}
      messages={catalogs[locale]}
      refreshToken={overrides.refreshToken ?? 0}
      navigationRequest={overrides.navigationRequest}
      onError={overrides.onError ?? vi.fn()}
    />,
  );
}

describe("RecoveryInsightsPanel", () => {
  it("leads with a human recovery answer before period controls and exact nights", async () => {
    mocks.invoke.mockResolvedValue(overview());
    renderPanel();

    const answer = await screen.findByRole("region", { name: "Recovery pattern answer" });
    const recovery = screen.getByRole("region", { name: "Nightly recovery" });
    const heading = within(answer).getByRole("heading", { name: "2 recovery histories shown" });
    expect(heading).toBeVisible();
    await waitFor(() => expect(heading).toHaveFocus());
    const resultHeadings = within(answer).getAllByRole("heading", {
      name: "Average recorded beat-to-beat interval: 905 ms",
    });
    expect(resultHeadings).toHaveLength(2);
    for (const resultHeading of resultHeadings) {
      expect(within(resultHeading).getByText("905 ms"))
        .toHaveClass("answer-measurement");
    }
    expect(within(answer).getByText("Recovery intervals are recorded for 2 of 3 nights"))
      .toBeVisible();
    expect(within(answer).getByText("Recovery intervals are recorded for 1 of 3 nights"))
      .toBeVisible();

    const exact = within(answer).getAllByText("Review measurements and exact nights")[0]
      .closest("details");
    expect(exact).not.toHaveAttribute("open");
    expect(within(answer).getByRole("table", {
      name: "Exact recovery nights for Recovery origin 1",
    }))
      .not.toBeVisible();

    const controls = within(recovery).getByText("Change recovery period").closest("details");
    expect(answer.compareDocumentPosition(controls as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(controls).not.toHaveAttribute("open");
  });

  it("makes the recorded recovery result primary when one history is present", async () => {
    const result = overview();
    result.series = result.series.slice(0, 1);
    mocks.invoke.mockResolvedValue(result);
    renderPanel();

    const answer = await screen.findByRole("region", { name: "Recovery pattern answer" });
    expect(within(answer).getByRole("heading", {
      name: "Average recorded beat-to-beat interval: 905 ms",
    })).toBeVisible();
    expect(within(answer).getByText("Recovery intervals are recorded for 2 of 3 nights"))
      .toBeVisible();
  });

  it("announces the exact latest-window operation without replacing the current history", async () => {
    let requestCount = 0;
    let completeReset: (value: RecoveryOverview) => void = () => undefined;
    const pendingReset = new Promise<RecoveryOverview>((resolve) => {
      completeReset = resolve;
    });
    mocks.invoke.mockImplementation((command) => {
      if (command !== "query_recovery_overview") {
        throw new Error(`Unexpected command: ${command}`);
      }
      requestCount += 1;
      return requestCount === 1 ? Promise.resolve(overview()) : pendingReset;
    });
    const user = userEvent.setup();
    renderPanel();
    const region = screen.getByRole("region", { name: "Nightly recovery" });
    const form = await within(region).findByRole("form", {
      name: "Explore a recovery period",
    });

    await user.click(within(form).getByRole("button", { name: "Latest 30-day window" }));

    expect(form).toHaveAttribute("aria-busy", "true");
    expect(within(form).getByRole("button", { name: "Apply recovery period" }))
      .toBeDisabled();
    expect(within(form).getByRole("button", { name: "Latest 30-day window" }))
      .toBeDisabled();
    expect(within(form).getByRole("status")).toHaveTextContent(
      "Loading latest 30-day window…",
    );
    expect(within(region).getAllByRole("button", { name: /View recovery details for/ }))
      .toHaveLength(3);

    act(() => completeReset(overview()));
    await waitFor(() => expect(form).toHaveAttribute("aria-busy", "false"));
  });

  it("distinguishes loading, empty, and unavailable history", async () => {
    let resolveOverview: (value: RecoveryOverview) => void = () => undefined;
    mocks.invoke.mockImplementation(() => new Promise<RecoveryOverview>((resolve) => {
      resolveOverview = resolve;
    }));
    const view = renderPanel();
    const region = screen.getByRole("region", { name: "Nightly recovery" });
    expect(within(region).getByRole("status")).toHaveTextContent("Loading nightly recovery…");
    resolveOverview({ availableRange: null, selectedRange: null, series: [] });
    expect(await within(region).findByText("No imported nightly recovery summaries yet.")).toBeVisible();

    view.unmount();
    mocks.invoke.mockRejectedValue({ code: "library-query-failed" });
    renderPanel();
    expect(await screen.findByText("Nightly recovery could not be loaded.")).toBeVisible();
  });

  it("announces a pending exact recovery detail", async () => {
    let resolveDetail: (value: ReturnType<typeof detail>) => void = () => undefined;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_recovery_overview") return Promise.resolve(overview());
      if (command === "query_recovery_detail") {
        return new Promise<ReturnType<typeof detail>>((resolve) => {
          resolveDetail = resolve;
        });
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    renderPanel();
    const recovery = await screen.findByRole("region", { name: "Nightly recovery" });

    await user.click((await within(recovery).findAllByRole("button", {
      name: /View recovery details for/,
    }))[0]);

    const detailRegion = within(recovery).getByRole("region", { name: "Recovery detail" });
    expect(within(detailRegion).getByRole("status")).toHaveTextContent(
      "Loading the exact recovery detail…",
    );
    resolveDetail(detail("2026-03-28"));
    expect(await within(detailRegion).findByText("synthetic-assessment@1")).toBeVisible();
  });

  it("explores every measurement and source group without exposing origin references", async () => {
    const complete = overview();
    const filtered = overview({ from: "2026-03-30", through: "2026-03-30" });
    filtered.series = filtered.series.map((series) => ({
      ...series,
      summary: series.days[2].recovery
        ? summary({
          calendarDays: 1,
          observedNights: 1,
          missingNights: 0,
          averageBeatToBeatIntervalMilliseconds: "910",
          rmssdNightCount: 0,
          averageHeartRateVariabilityRmssdMilliseconds: null,
          averageBreathingIntervalMilliseconds: "4200",
          assessmentNightCount: 0,
          baselineNightCount: 0,
          guidanceNightCount: 0,
        })
        : summary({
          calendarDays: 1,
          observedNights: 0,
          missingNights: 1,
          averageBeatToBeatIntervalMilliseconds: null,
          rmssdNightCount: 0,
          averageHeartRateVariabilityRmssdMilliseconds: null,
          averageBreathingIntervalMilliseconds: null,
          assessmentNightCount: 0,
          baselineNightCount: 0,
          guidanceNightCount: 0,
        }),
      days: [series.days[2]],
    }));
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_recovery_overview") {
        return Promise.resolve(arguments_.requestedRange ? filtered : complete);
      }
      if (command === "query_recovery_detail") {
        return Promise.resolve(detail(arguments_.recoveryDate));
      }
      if (command === "query_recovery_comparison") return Promise.resolve(comparison());
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onError });

    const region = screen.getByRole("region", { name: "Nightly recovery" });
    await user.click((await within(region).findAllByText(
      "Review measurements and exact nights",
    ))[0]);
    expect((await within(region).findAllByText("905 ms"))[0]).toBeVisible();
    expect(within(region).getAllByText("42 ms").length).toBeGreaterThan(0);
    expect(within(region).getByText("Recovery origin 2")).toBeVisible();
    expect(within(region).queryByText("opaque-recovery-alpha")).not.toBeInTheDocument();
    expect(within(region).getAllByText("Overall status 5 / 6").length).toBeGreaterThan(0);
    expect(within(region).getAllByText("Missing").length).toBeGreaterThan(0);

    const detailOrigin = within(region).getAllByRole("button", {
      name: "View recovery details for Mar 28, 2026",
    })[0];
    await user.click(detailOrigin);
    const detailRegion = await within(region).findByRole("region", { name: "Recovery detail" });
    await waitFor(() => expect(within(detailRegion).getByRole("heading", {
      name: "Recovery detail",
    })).toHaveFocus());
    expect(within(detailRegion).getByText("synthetic-assessment@1")).toBeVisible();
    expect(within(detailRegion).getByText("synthetic-baseline@1")).toBeVisible();
    expect(within(detailRegion).getByText("synthetic-guidance@1")).toBeVisible();
    expect(within(detailRegion).getByText("Choose a steady synthetic session.")).toBeVisible();
    expect(within(detailRegion).getByText("Keep a consistent synthetic schedule.")).toBeVisible();
    expect(within(detailRegion).getByText("Plan a synthetic restorative break.")).toBeVisible();
    expect(within(detailRegion).getAllByText("4,200 ms").length).toBeGreaterThan(0);
    expect(within(detailRegion).getByText(/not medical advice authored or endorsed/)).toBeVisible();
    await user.click(within(detailRegion).getByRole("button", { name: "Close recovery detail" }));
    expect(within(region).queryByRole("region", { name: "Recovery detail" })).not.toBeInTheDocument();
    await waitFor(() => expect(detailOrigin).toHaveFocus());

    const from = within(region).getByLabelText("From");
    const through = within(region).getByLabelText("Through");
    await user.clear(from);
    await user.type(from, "2026-03-30");
    await user.clear(through);
    await user.type(through, "2026-03-28");
    await user.click(within(region).getByRole("button", { name: "Apply recovery period" }));
    expect(onError).toHaveBeenLastCalledWith("invalid-recovery-range");
    expect(from).toHaveAttribute("aria-invalid", "true");
    expect(from).toHaveAttribute("aria-describedby", "application-error");
    expect(through).toHaveAttribute("aria-invalid", "true");

    await user.clear(through);
    await user.type(through, "2026-03-30");
    await user.click(within(region).getByRole("button", { name: "Apply recovery period" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_recovery_overview", {
      requestedRange: { from: "2026-03-30", through: "2026-03-30" },
    }));
    expect((await within(region).findAllByText("Mar 30, 2026"))[0]).toBeVisible();
    await waitFor(() => expect(within(region).getByRole("heading", {
      name: "2 recovery histories shown",
    })).toHaveFocus());

    await user.click(within(region).getByRole("button", { name: "Latest 30-day window" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_recovery_overview", {
      requestedRange: null,
    }));
  });

  it("opens the exact authoritative night requested by the longitudinal dashboard", async () => {
    const exact = overview({ from: "2026-03-28", through: "2026-03-28" });
    exact.series = exact.series.map((series) => ({ ...series, days: [series.days[0]] }));
    mocks.invoke.mockImplementation((command, arguments_) => {
      if (command === "query_recovery_overview") {
        return Promise.resolve(arguments_.requestedRange ? exact : overview());
      }
      if (command === "query_recovery_detail") {
        return Promise.resolve(detail(arguments_.recoveryDate));
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const view = renderPanel({ onError });
    await screen.findByRole("region", { name: "Nightly recovery" });

    view.rerender(
      <RecoveryInsightsPanel
        locale="en-US"
        messages={catalogs["en-US"]}
        refreshToken={0}
        navigationRequest={{
          seriesRef: "opaque-recovery-alpha",
          localDate: "2026-03-28",
          requestId: 1,
        }}
        onError={onError}
      />,
    );

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("query_recovery_overview", {
      requestedRange: { from: "2026-03-28", through: "2026-03-28" },
    }));
    expect(mocks.invoke).toHaveBeenCalledWith("query_recovery_detail", {
      seriesRef: "opaque-recovery-alpha",
      recoveryDate: "2026-03-28",
    });
    expect(await screen.findByRole("region", { name: "Recovery detail" })).toBeVisible();
  });

  it("validates, runs, presents, and clears a complete comparison", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_recovery_overview") return Promise.resolve(overview());
      if (command === "query_recovery_comparison") return Promise.resolve(comparison());
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onError });
    const region = screen.getByRole("region", { name: "Nightly recovery" });
    const workspaceNavigation = within(region).getByRole("navigation", {
      name: "Recovery workspace",
    });
    const comparisonWorkspace = within(workspaceNavigation).getByRole("button", {
      name: "Compare periods",
    });
    await user.click(comparisonWorkspace);
    expect(comparisonWorkspace).toHaveAttribute("aria-current", "page");
    await within(region).findByRole("heading", { name: "Compare recovery periods" });

    const baselineFrom = within(region).getByLabelText("Baseline period start");
    const baselineThrough = within(region).getByLabelText("Baseline period end");
    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-03-30");
    await user.clear(baselineThrough);
    await user.type(baselineThrough, "2026-03-01");
    await user.click(within(region).getByRole("button", { name: "Compare recovery periods" }));
    expect(onError).toHaveBeenLastCalledWith("invalid-recovery-comparison");
    expect(baselineFrom).toHaveAttribute("aria-invalid", "true");
    expect(baselineFrom).toHaveAttribute("aria-describedby", "application-error");
    expect(baselineThrough).toHaveAttribute("aria-invalid", "true");
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "query_recovery_comparison",
      expect.anything(),
    );

    await user.clear(baselineFrom);
    await user.type(baselineFrom, "2026-03-01");
    await user.clear(baselineThrough);
    await user.type(baselineThrough, "2026-03-03");
    await user.click(within(region).getByRole("button", { name: "Compare recovery periods" }));
    const result = await within(region).findByRole("region", {
      name: "Recovery period answer",
    });
    await waitFor(() => expect(within(result).getByRole("heading", {
      name: "Average recorded beat-to-beat interval was 25 ms longer",
    })).toHaveFocus());
    await user.click(within(result).getByText("Review exact values"));
    expect(within(result).getByText("+25 ms")).toBeVisible();
    expect(within(result).getByText("-50 ms")).toBeVisible();
    expect(within(result).getAllByText("Not available").length).toBeGreaterThan(0);
    expect(within(result).getByText(/no medical meaning is inferred/)).toBeVisible();
    await user.click(within(workspaceNavigation).getByRole("button", { name: "Nights" }));
    expect(within(region).queryByRole("region", {
      name: "Recovery period answer",
    })).not.toBeInTheDocument();
    await user.click(comparisonWorkspace);
    expect(within(region).getByRole("region", {
      name: "Recovery period answer",
    })).toBeVisible();
    await user.click(within(result).getByRole("button", { name: "Clear recovery comparison" }));
    expect(within(region).queryByRole("region", {
      name: "Recovery period answer",
    })).not.toBeInTheDocument();
  });

  it("does not offer missing-night detail and reports a disappeared exact detail", async () => {
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_recovery_overview") return Promise.resolve(overview());
      if (command === "query_recovery_detail") return Promise.resolve(null);
      throw new Error(`Unexpected command: ${command}`);
    });
    const onError = vi.fn();
    const user = userEvent.setup();
    renderPanel({ onError });
    const region = screen.getByRole("region", { name: "Nightly recovery" });
    const missingDates = await within(region).findAllByText("Mar 29, 2026");
    const missingRow = missingDates.map((value) => value.closest("tr")).find(Boolean);
    expect(missingRow).not.toBeNull();
    expect(within(missingRow!).queryByRole("button")).not.toBeInTheDocument();

    const detailOrigin = within(region).getAllByRole("button", {
      name: "View recovery details for Mar 28, 2026",
    })[0];
    await user.click(detailOrigin);
    await waitFor(() => expect(onError).toHaveBeenLastCalledWith("invalid-recovery-reference"));
    expect(within(region).queryByRole("region", { name: "Recovery detail" })).not.toBeInTheDocument();
    await waitFor(() => expect(detailOrigin).toHaveFocus());
  });

  it("localizes the complete experience and refreshes after a new import token", async () => {
    const partialDetail = detail();
    partialDetail.sourceAssessment = null;
    partialDetail.sourceBaseline = null;
    partialDetail.sourceGuidance = null;
    mocks.invoke.mockImplementation((command) => {
      if (command === "query_recovery_overview") return Promise.resolve(overview());
      if (command === "query_recovery_detail") return Promise.resolve(partialDetail);
      throw new Error(`Unexpected command: ${command}`);
    });
    const user = userEvent.setup();
    const view = renderPanel({ locale: "es-ES" });
    const region = screen.getByRole("region", { name: "Recuperación nocturna" });
    await user.click(await within(region).findByText("Cambiar el periodo de recuperación"));
    expect(await within(region).findByText("Explorar un periodo de recuperación")).toBeVisible();
    await user.click((await within(region).findAllByText(
      "Revisar mediciones y noches exactas",
    ))[0]);
    await user.click(within(region).getAllByRole("button", {
      name: "Ver detalles de recuperación del 28 mar 2026",
    })[0]);
    const detailRegion = await within(region).findByRole("region", {
      name: "Detalle de recuperación",
    });
    expect(within(detailRegion).getByText("No hay una valoración específica del origen para esta noche.")).toBeVisible();
    expect(within(detailRegion).getByText("No hay una referencia específica del origen para esta noche.")).toBeVisible();
    expect(within(detailRegion).getByText("No hay recomendaciones específicas del origen para esta noche.")).toBeVisible();

    view.rerender(
      <RecoveryInsightsPanel
        locale="es-ES"
        messages={catalogs["es-ES"]}
        refreshToken={1}
        onError={vi.fn()}
      />,
    );
    await waitFor(() => {
      const overviewCalls = mocks.invoke.mock.calls.filter(
        ([command]) => command === "query_recovery_overview",
      );
      expect(overviewCalls.length).toBe(2);
    });
    expect(within(region).queryByRole("region", { name: "Detalle de recuperación" })).not.toBeInTheDocument();
  });
});
