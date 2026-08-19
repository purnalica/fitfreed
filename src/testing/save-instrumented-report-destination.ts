import type { SaveDialogOptions } from "@tauri-apps/plugin-dialog";

interface InstrumentedWindow extends Window {
  __wdio_mocks__?: Record<string, (arguments_?: unknown) => unknown>;
}

export async function saveInstrumentedReportDestination(options: SaveDialogOptions) {
  const instrumentedWindow = window as InstrumentedWindow;
  const saveDialog = instrumentedWindow.__wdio_mocks__?.["plugin:dialog|save"];
  if (typeof saveDialog !== "function") {
    throw new Error("The instrumented report destination requires a configured dialog mock");
  }

  const selected = await saveDialog({ options });
  if (selected === null || typeof selected === "string") return selected;
  throw new Error("The instrumented report destination received an invalid dialog result");
}
