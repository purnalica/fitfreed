import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { catalogs } from "../locales/catalogs";
import { WindowsInstalledHelpPanel } from "./WindowsInstalledHelpPanel";

afterEach(cleanup);

describe("WindowsInstalledHelpPanel", () => {
  it("keeps the complete Windows lifecycle available locally behind task-focused disclosures", () => {
    render(<WindowsInstalledHelpPanel messages={catalogs["en-US"].settings.windowsHelp} />);

    const help = screen.getByRole("region", { name: "Using FitFreed on Windows" });
    expect(help).toHaveTextContent("A supported edition of Windows 11 on an x86-64 computer");

    const trust = within(help).getByText("Install and verify FitFreed").closest("details");
    const recovery = within(help).getByText("Update or recover FitFreed").closest("details");
    const removal = within(help).getByText("Remove FitFreed or delete your library")
      .closest("details");
    const unsupported = within(help).getByText("Unsupported Windows setups").closest("details");

    expect(trust).toHaveAttribute("open");
    expect(trust).toHaveTextContent("Microsoft Defender SmartScreen");
    expect(recovery).toHaveTextContent("Settings → Updates");
    expect(recovery).toHaveTextContent("remain on this computer");
    expect(removal).toHaveTextContent("Apps → Installed apps");
    expect(removal).toHaveTextContent("%APPDATA%\\org.fitfreed.desktop");
    expect(unsupported).toHaveTextContent("Windows 10");
    expect(unsupported).toHaveTextContent("ARM64");
  });

  it("renders the same installed lifecycle guidance from the Spanish catalog", () => {
    render(<WindowsInstalledHelpPanel messages={catalogs["es-ES"].settings.windowsHelp} />);

    const help = screen.getByRole("region", { name: "Uso de FitFreed en Windows" });
    expect(help).toHaveTextContent("Una edición con soporte de Windows 11 en un equipo x86-64");
    expect(help).toHaveTextContent("Instalar y verificar FitFreed");
    expect(help).toHaveTextContent("Actualizar o recuperar FitFreed");
    expect(help).toHaveTextContent("Desinstalar FitFreed o eliminar tu biblioteca");
    expect(help).toHaveTextContent("Configuraciones de Windows no compatibles");
  });
});
