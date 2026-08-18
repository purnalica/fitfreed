import type { Locale } from "../locales/catalogs";

export type OfficialSourceLinkPurpose = "account" | "instructions";

export interface OfficialSourceLink {
  purpose: OfficialSourceLinkPurpose;
  locale: Locale | null;
  url: string;
}

export interface SourceAcquisitionGuide {
  schemaVersion: 1;
  sourceId: string;
  guideVersion: string;
  verifiedOn: string;
  expectedArchive: "zip";
  instructionKeys: string[];
  constraintKeys: string[];
  troubleshootingKeys: string[];
  officialLinks: OfficialSourceLink[];
}

export function selectOfficialSourceLink(
  guide: SourceAcquisitionGuide,
  purpose: OfficialSourceLinkPurpose,
  locale: Locale,
): OfficialSourceLink | undefined {
  return guide.officialLinks.find(
    (link) => link.purpose === purpose && link.locale === locale,
  ) ?? guide.officialLinks.find(
    (link) => link.purpose === purpose && link.locale === null,
  );
}
