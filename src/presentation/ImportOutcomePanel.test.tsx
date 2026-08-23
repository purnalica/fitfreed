import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import {
  ImportOutcomePanel,
  type ImportOutcome,
} from "./ImportOutcomePanel";

const completedOutcome: ImportOutcome = {
  operationRef: "synthetic-operation",
  state: "completed",
  sourceProvider: "polar-flow",
  sourceAdapterVersion: "polar-flow@1",
  mappingVersion: "canonical@1",
  exactRepeat: false,
  coverageComplete: true,
  coverage: {
    total: 12,
    supported: 9,
    unsupported: 0,
    deliberatelyIgnored: 2,
    unrecognized: 1,
    invalid: 0,
  },
  artifactFamilies: [
    {
      familyCode: "polar-flow-training-session",
      classification: "supported",
      reasonCode: "mapped-training-evidence",
      artifactCount: 9,
    },
  ],
  report: {
    exactRepeat: false,
    recognizedArtifacts: 12,
    newObservations: 7,
    equivalentObservations: 2,
    enrichedObservations: 1,
    amendedObservations: 1,
    preservedObservations: 1,
    conflicts: 0,
  },
  canonicalHistoryChanged: true,
  terminalCode: null,
  recoveryNote: null,
};

afterEach(cleanup);

describe("ImportOutcomePanel", () => {
  it("leads with the usable consequence and keeps the complete account on demand", async () => {
    const user = userEvent.setup();
    const onOpenHome = vi.fn();
    const onChooseAnother = vi.fn().mockResolvedValue(undefined);
    render(
      <ImportOutcomePanel
        locale="en-US"
        messages={catalogs["en-US"].outcome}
        outcome={completedOutcome}
        onOpenHome={onOpenHome}
        onChooseAnother={onChooseAnother}
      />,
    );

    const result = screen.getByRole("region", { name: "Your local history has been updated" });
    expect(result).toHaveTextContent("7 new observations");
    expect(result).toHaveTextContent("1 enriched observation");
    expect(result).toHaveTextContent("1 amended observation");
    expect(screen.getByText("View incorporation and coverage details").closest("details"))
      .not.toHaveAttribute("open");

    await user.click(screen.getByText("View incorporation and coverage details"));
    const coverage = screen.getByRole("table", { name: "Coverage by data family" });
    expect(within(coverage).getByRole("row", {
      name: /Training sessions Supported 9 Reason: Session summaries/,
    })).toBeVisible();
    expect(result).toHaveTextContent("12 recognized data files");
    expect(result).toHaveTextContent("2 equivalent observations");
    expect(result).toHaveTextContent("1 preserved observation");
    expect(result).toHaveTextContent("polar-flow@1");
    expect(result).toHaveTextContent("canonical@1");

    await user.click(screen.getByRole("button", { name: "Go to Home" }));
    await user.click(screen.getByRole("button", { name: "Choose another ZIP" }));
    expect(onOpenHome).toHaveBeenCalledOnce();
    expect(onChooseAnother).toHaveBeenCalledOnce();
  });

  it("explains a repeated archive without implying that bytes can never be reassessed", () => {
    render(
      <ImportOutcomePanel
        locale="en-US"
        messages={catalogs["en-US"].outcome}
        outcome={{
          ...completedOutcome,
          exactRepeat: true,
          canonicalHistoryChanged: false,
          report: {
            ...completedOutcome.report,
            exactRepeat: true,
            newObservations: 0,
            enrichedObservations: 0,
            amendedObservations: 0,
          },
        }}
        onOpenHome={vi.fn()}
        onChooseAnother={vi.fn()}
      />,
    );

    const result = screen.getByRole("region", {
      name: "This archive is already accounted for",
    });
    expect(result).toHaveTextContent("Nothing was duplicated");
    expect(result).toHaveTextContent("a later FitFreed mapping can reassess the same ZIP");
    expect(result).not.toHaveTextContent("7 new observations");
  });

  it("keeps a rejected import calm and reveals its reason and exact coverage deliberately", async () => {
    const user = userEvent.setup();
    render(
      <ImportOutcomePanel
        locale="en-US"
        messages={catalogs["en-US"].outcome}
        outcome={{
          ...completedOutcome,
          state: "rejected",
          coverageComplete: false,
          canonicalHistoryChanged: false,
          coverage: {
            total: 2,
            supported: 1,
            unsupported: 0,
            deliberatelyIgnored: 0,
            unrecognized: 0,
            invalid: 1,
          },
          report: {
            ...completedOutcome.report,
            newObservations: 0,
            enrichedObservations: 0,
            amendedObservations: 0,
          },
          terminalCode: "invalid-supported-artifact",
        }}
        terminalMessage="Recognized content failed validation; no history was changed."
        onOpenHome={vi.fn()}
        onChooseAnother={vi.fn()}
      />,
    );

    const result = screen.getByRole("region", { name: "This archive was not imported" });
    expect(result).toHaveTextContent("Your existing library was not changed");
    expect(screen.getByText("Why the import stopped").closest("details"))
      .not.toHaveAttribute("open");
    expect(screen.getByText("View incorporation and coverage details").closest("details"))
      .not.toHaveAttribute("open");

    await user.click(screen.getByText("Why the import stopped"));
    expect(result).toHaveTextContent("Recognized content failed validation");
    await user.click(screen.getByText("View incorporation and coverage details"));
    expect(screen.getByRole("list", { name: "Package coverage" })).toBeVisible();
  });
});
