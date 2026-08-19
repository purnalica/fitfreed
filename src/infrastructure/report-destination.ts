import { save, type SaveDialogOptions } from "@tauri-apps/plugin-dialog";

function safeFileStem(title: string): string {
  const stem = title
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return stem || "fitfreed-report";
}

export function reportDestinationOptions(title: string): SaveDialogOptions {
  return {
    defaultPath: `${safeFileStem(title)}.html`,
    filters: [{ name: "HTML", extensions: ["html"] }],
  };
}

export async function chooseReportDestination(title: string) {
  const options = reportDestinationOptions(title);
  if (import.meta.env.VITE_FITFREED_E2E === "true") {
    const { saveInstrumentedReportDestination } = await import(
      "../testing/save-instrumented-report-destination"
    );
    return saveInstrumentedReportDestination(options);
  }
  return save(options);
}
