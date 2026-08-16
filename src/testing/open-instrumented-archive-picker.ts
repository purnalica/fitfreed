import type { OpenDialogOptions } from "@tauri-apps/plugin-dialog";

interface InstrumentedWindow extends Window {
  __wdio_mocks__?: Record<string, (arguments_?: unknown) => unknown>;
}

export async function openInstrumentedArchivePicker(options: OpenDialogOptions) {
  const instrumentedWindow = window as InstrumentedWindow;
  const openDialog = instrumentedWindow.__wdio_mocks__?.["plugin:dialog|open"];
  if (typeof openDialog !== "function") {
    throw new Error("The instrumented archive picker requires a configured dialog mock");
  }

  const selected = await openDialog({ options });
  if (selected === null || typeof selected === "string") return selected;
  throw new Error("The instrumented archive picker received an invalid dialog result");
}
