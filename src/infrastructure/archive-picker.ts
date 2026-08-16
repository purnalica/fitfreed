import { open, type OpenDialogOptions } from "@tauri-apps/plugin-dialog";

const options: OpenDialogOptions = {
  multiple: false,
  directory: false,
  filters: [{ name: "ZIP", extensions: ["zip"] }],
};

export async function chooseZipArchive() {
  if (import.meta.env.VITE_FITFREED_E2E === "true") {
    const { openInstrumentedArchivePicker } = await import(
      "../testing/open-instrumented-archive-picker"
    );
    return openInstrumentedArchivePicker(options);
  }
  return open(options);
}
