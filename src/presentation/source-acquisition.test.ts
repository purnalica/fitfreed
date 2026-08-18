import { describe, expect, it } from "vitest";

import {
  selectOfficialSourceLink,
  type SourceAcquisitionGuide,
} from "./source-acquisition";

const guide: SourceAcquisitionGuide = {
  schemaVersion: 1,
  sourceId: "synthetic-source",
  guideVersion: "synthetic-source-acquisition@1",
  verifiedOn: "2026-01-15",
  expectedArchive: "zip",
  instructionKeys: ["request-export"],
  constraintKeys: ["delivery-time-varies"],
  troubleshootingKeys: ["email-not-received"],
  officialLinks: [
    { purpose: "account", locale: null, url: "https://account.example.test/" },
    {
      purpose: "instructions",
      locale: "en-US",
      url: "https://support.example.test/en/export",
    },
    {
      purpose: "instructions",
      locale: "es-ES",
      url: "https://support.example.test/es/export",
    },
  ],
};

describe("source acquisition guide selection", () => {
  it("selects only the exact localized instructions and the locale-independent account link", () => {
    expect(selectOfficialSourceLink(guide, "account", "es-ES")?.url)
      .toBe("https://account.example.test/");
    expect(selectOfficialSourceLink(guide, "instructions", "es-ES")?.url)
      .toBe("https://support.example.test/es/export");
    expect(selectOfficialSourceLink(guide, "instructions", "en-US")?.url)
      .toBe("https://support.example.test/en/export");
  });

  it("does not guess a localized destination that the adapter did not provide", () => {
    const withoutSpanish = {
      ...guide,
      officialLinks: guide.officialLinks.filter((link) => link.locale !== "es-ES"),
    };

    expect(selectOfficialSourceLink(withoutSpanish, "instructions", "es-ES"))
      .toBeUndefined();
  });
});
