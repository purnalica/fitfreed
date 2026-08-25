import { invoke } from "@tauri-apps/api/core";

import type { Locale } from "../locales/catalogs";
import type { OfficialSourceLinkPurpose } from "../presentation/source-acquisition";

export interface OpenOfficialSourceLinkRequest {
  sourceId: string;
  purpose: OfficialSourceLinkPurpose;
  locale: Locale;
}

export interface OpenOfficialSourceLinkOutcome {
  sourceId: string;
  purpose: OfficialSourceLinkPurpose;
  url: string;
}

export async function openOfficialSourceLink(
  request: OpenOfficialSourceLinkRequest,
  instrumentedUrl: string,
): Promise<OpenOfficialSourceLinkOutcome> {
  if (import.meta.env.VITE_FITFREED_E2E === "true") {
    const { openInstrumentedOfficialSourceLink } = await import(
      "../testing/open-instrumented-official-source-link"
    );
    await openInstrumentedOfficialSourceLink(instrumentedUrl);
    return { ...request, url: instrumentedUrl };
  }
  return invoke<OpenOfficialSourceLinkOutcome>("open_official_source_link", { request });
}
