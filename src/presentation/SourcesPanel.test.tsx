import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { catalogs } from "../locales/catalogs";
import type { SourceAcquisitionGuide } from "./source-acquisition";
import { SourcesPanel } from "./SourcesPanel";

const guide: SourceAcquisitionGuide = {
  schemaVersion: 1,
  sourceId: "polar-flow",
  guideVersion: "polar-flow-export-acquisition@1",
  verifiedOn: "2026-08-18",
  expectedArchive: "zip",
  instructionKeys: [
    "sign-in",
    "open-download-data",
    "request-export",
    "wait-for-email",
    "download-zip",
  ],
  constraintKeys: [
    "preparation-time-varies",
    "two-week-download-window",
    "derived-data-excluded",
  ],
  troubleshootingKeys: ["email-delivery", "expired-download", "archive-format"],
  officialLinks: [
    { purpose: "account", locale: null, url: "https://account.polar.com/" },
    {
      purpose: "instructions",
      locale: "en-US",
      url: "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
    },
    {
      purpose: "instructions",
      locale: "es-ES",
      url: "https://support.polar.com/es/how-to-download-all-your-data-from-polar-flow",
    },
  ],
};

const importMessages = {
  choose: catalogs["en-US"].choose,
  choosing: catalogs["en-US"].choosing,
  import: catalogs["en-US"].import,
  noPackage: catalogs["en-US"].noPackage,
  importing: catalogs["en-US"].importing,
  cancel: catalogs["en-US"].cancel,
  cancelling: catalogs["en-US"].cancelling,
};

afterEach(cleanup);

describe("SourcesPanel", () => {
  it("exercises both first-run paths and every official destination", async () => {
    const user = userEvent.setup();
    const onChooseArchive = vi.fn().mockResolvedValue(undefined);
    const onImport = vi.fn().mockResolvedValue(undefined);
    const onOpenOfficialLink = vi.fn().mockResolvedValue(undefined);

    render(
      <SourcesPanel
        locale="en-US"
        messages={catalogs["en-US"].sources}
        importMessages={importMessages}
        guide={guide}
        guideLoading={false}
        archivePath="/synthetic/export.zip"
        importReady
        busy={false}
        cancellable={false}
        updateInstalling={false}
        cancelRequested={false}
        onChooseArchive={onChooseArchive}
        onArchiveError={vi.fn()}
        onImport={onImport}
        onCancel={vi.fn()}
        onOpenOfficialLink={onOpenOfficialLink}
        onLinkError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose ZIP package" }));
    await user.click(screen.getByRole("button", { name: "Import selected package" }));
    expect(onChooseArchive).toHaveBeenCalledOnce();
    expect(onImport).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Show me how" }));
    const guideRegion = screen.getByRole("region", {
      name: "How to obtain your Polar Flow export",
    });
    expect(within(guideRegion).getByRole("heading", {
      name: "How to obtain your Polar Flow export",
    })).toHaveFocus();
    expect(within(guideRegion).getAllByRole("listitem")).toHaveLength(11);
    expect(guideRegion).toHaveTextContent("Last verified Aug 18, 2026");
    expect(guideRegion).toHaveTextContent("FitFreed never receives your credentials");

    await user.click(within(guideRegion).getByRole("button", {
      name: "Open official account page",
    }));
    await user.click(within(guideRegion).getByRole("button", {
      name: "Open official instructions",
    }));
    expect(onOpenOfficialLink).toHaveBeenNthCalledWith(1, "https://account.polar.com/");
    expect(onOpenOfficialLink).toHaveBeenNthCalledWith(
      2,
      "https://support.polar.com/en/how-to-download-all-your-data-from-polar-flow",
    );
  });

  it("keeps the offline path honest when guidance is unavailable", async () => {
    const user = userEvent.setup();
    render(
      <SourcesPanel
        locale="es-ES"
        messages={catalogs["es-ES"].sources}
        importMessages={{
          choose: catalogs["es-ES"].choose,
          choosing: catalogs["es-ES"].choosing,
          import: catalogs["es-ES"].import,
          noPackage: catalogs["es-ES"].noPackage,
          importing: catalogs["es-ES"].importing,
          cancel: catalogs["es-ES"].cancel,
          cancelling: catalogs["es-ES"].cancelling,
        }}
        guide={undefined}
        guideLoading={false}
        archivePath={undefined}
        importReady={false}
        busy={false}
        cancellable={false}
        updateInstalling={false}
        cancelRequested={false}
        onChooseArchive={vi.fn()}
        onArchiveError={vi.fn()}
        onImport={vi.fn()}
        onCancel={vi.fn()}
        onOpenOfficialLink={vi.fn()}
        onLinkError={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Ver cómo obtenerlo" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "La guía de este origen no está disponible",
    );
    expect(screen.getByRole("button", { name: "Importar el paquete seleccionado" }))
      .toBeDisabled();
  });

  it("announces one official destination operation and recovers after failure", async () => {
    const user = userEvent.setup();
    let completeOpening: () => void = () => undefined;
    const onOpenOfficialLink = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        completeOpening = resolve;
      }))
      .mockRejectedValueOnce(new Error("browser unavailable"));
    const onLinkError = vi.fn();

    render(
      <SourcesPanel
        locale="en-US"
        messages={catalogs["en-US"].sources}
        importMessages={importMessages}
        guide={guide}
        guideLoading={false}
        archivePath={undefined}
        importReady={false}
        busy={false}
        cancellable={false}
        updateInstalling={false}
        cancelRequested={false}
        onChooseArchive={vi.fn()}
        onArchiveError={vi.fn()}
        onImport={vi.fn()}
        onCancel={vi.fn()}
        onOpenOfficialLink={onOpenOfficialLink}
        onLinkError={onLinkError}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Show me how" }));
    const guideRegion = screen.getByRole("region", {
      name: "How to obtain your Polar Flow export",
    });
    const account = within(guideRegion).getByRole("button", {
      name: "Open official account page",
    });
    const instructions = within(guideRegion).getByRole("button", {
      name: "Open official instructions",
    });

    await user.click(account);

    expect(account).toBeDisabled();
    expect(instructions).toBeDisabled();
    expect(within(guideRegion).getByRole("status")).toHaveTextContent(
      "Opening official account page…",
    );
    await user.click(instructions);
    expect(onOpenOfficialLink).toHaveBeenCalledOnce();

    act(() => completeOpening());
    await waitFor(() => expect(account).toBeEnabled());
    expect(within(guideRegion).queryByRole("status")).not.toBeInTheDocument();

    await user.click(instructions);
    await waitFor(() => expect(onLinkError).toHaveBeenCalledOnce());
    expect(account).toBeEnabled();
    expect(instructions).toBeEnabled();
  });

  it("announces one archive chooser operation and recovers after failure", async () => {
    const user = userEvent.setup();
    let completeChoosing: () => void = () => undefined;
    const onChooseArchive = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        completeChoosing = resolve;
      }))
      .mockRejectedValueOnce(new Error("dialog unavailable"));
    const onArchiveError = vi.fn();

    render(
      <SourcesPanel
        locale="en-US"
        messages={catalogs["en-US"].sources}
        importMessages={importMessages}
        guide={guide}
        guideLoading={false}
        archivePath={undefined}
        importReady
        busy={false}
        cancellable={false}
        updateInstalling={false}
        cancelRequested={false}
        onChooseArchive={onChooseArchive}
        onArchiveError={onArchiveError}
        onImport={vi.fn()}
        onCancel={vi.fn()}
        onOpenOfficialLink={vi.fn()}
        onLinkError={vi.fn()}
      />,
    );

    const importPath = screen.getByRole("heading", { name: "I have the ZIP" })
      .closest("article");
    const choose = screen.getByRole("button", { name: "Choose ZIP package" });

    await user.click(choose);

    expect(importPath).toHaveAttribute("aria-busy", "true");
    expect(choose).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();
    expect(within(importPath!).getByRole("status")).toHaveTextContent(
      "Opening ZIP chooser…",
    );
    await user.click(choose);
    expect(onChooseArchive).toHaveBeenCalledOnce();

    act(() => completeChoosing());
    await waitFor(() => expect(choose).toBeEnabled());
    expect(within(importPath!).queryByRole("status")).not.toBeInTheDocument();

    await user.click(choose);
    await waitFor(() => expect(onArchiveError).toHaveBeenCalledOnce());
    expect(choose).toBeEnabled();
  });

  it("does not report missing guidance while the local guide is still loading", () => {
    render(
      <SourcesPanel
        locale="en-US"
        messages={catalogs["en-US"].sources}
        importMessages={importMessages}
        guide={undefined}
        guideLoading
        archivePath={undefined}
        importReady={false}
        busy={false}
        cancellable={false}
        updateInstalling={false}
        cancelRequested={false}
        onChooseArchive={vi.fn()}
        onArchiveError={vi.fn()}
        onImport={vi.fn()}
        onCancel={vi.fn()}
        onOpenOfficialLink={vi.fn()}
        onLinkError={vi.fn()}
      />,
    );

    const showGuide = screen.getByRole("button", { name: "Show me how" });
    expect(showGuide).toBeDisabled();
    expect(showGuide).toHaveAttribute("aria-busy", "true");
    const loadingStatus = screen.getByRole("status");
    expect(showGuide).toHaveAttribute("aria-describedby", loadingStatus.id);
    expect(loadingStatus).toHaveTextContent("Loading acquisition guide…");
    expect(screen.queryByText(/guide for this source is unavailable/i)).not.toBeInTheDocument();
  });

  it("supports cancellation and blocks mutable source controls during an update", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <SourcesPanel
        locale="en-US"
        messages={catalogs["en-US"].sources}
        importMessages={importMessages}
        guide={guide}
        guideLoading={false}
        archivePath="/synthetic/export.zip"
        importReady
        busy
        cancellable
        updateInstalling={false}
        cancelRequested={false}
        onChooseArchive={vi.fn()}
        onArchiveError={vi.fn()}
        onImport={vi.fn()}
        onCancel={onCancel}
        onOpenOfficialLink={vi.fn()}
        onLinkError={vi.fn()}
      />,
    );

    const importPath = screen.getByRole("heading", { name: "I have the ZIP" })
      .closest("article");
    expect(importPath).not.toBeNull();
    expect(importPath).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();
    expect(within(importPath!).getByRole("status")).toHaveTextContent(
      "Importing and reconciling…",
    );
    await user.click(screen.getByRole("button", { name: "Cancel import" }));
    expect(onCancel).toHaveBeenCalledOnce();

    view.rerender(
      <SourcesPanel
        locale="en-US"
        messages={catalogs["en-US"].sources}
        importMessages={importMessages}
        guide={guide}
        guideLoading={false}
        archivePath="/synthetic/export.zip"
        importReady
        busy
        cancellable
        updateInstalling={false}
        cancelRequested
        onChooseArchive={vi.fn()}
        onArchiveError={vi.fn()}
        onImport={vi.fn()}
        onCancel={onCancel}
        onOpenOfficialLink={vi.fn()}
        onLinkError={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Cancel import" })).toBeDisabled();
    expect(within(importPath!).getByRole("status")).toHaveTextContent("Cancelling…");

    view.rerender(
      <SourcesPanel
        locale="en-US"
        messages={catalogs["en-US"].sources}
        importMessages={importMessages}
        guide={guide}
        guideLoading={false}
        archivePath="/synthetic/export.zip"
        importReady
        busy={false}
        cancellable={false}
        updateInstalling
        cancelRequested={false}
        onChooseArchive={vi.fn()}
        onArchiveError={vi.fn()}
        onImport={vi.fn()}
        onCancel={onCancel}
        onOpenOfficialLink={vi.fn()}
        onLinkError={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Choose ZIP package" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import selected package" })).toBeDisabled();
  });
});
