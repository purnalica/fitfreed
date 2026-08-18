import { openUrl } from "@tauri-apps/plugin-opener";

export async function openOfficialSourceLink(url: string) {
  if (import.meta.env.VITE_FITFREED_E2E === "true") {
    const { openInstrumentedOfficialSourceLink } = await import(
      "../testing/open-instrumented-official-source-link"
    );
    return openInstrumentedOfficialSourceLink(url);
  }
  return openUrl(url);
}
