import { describe, expect, it } from "vitest";

import {
  localizedName,
  resolvedSportName,
  sportCanonicalFamily,
  type TrainingSportIdentity,
  type TrainingSportRecognition,
} from "./training-sports";

const recognition: TrainingSportRecognition = {
  canonicalFamily: "water-sport",
  localizedNames: {
    en: "Kayaking",
    "es-ES": "Piragüismo",
  },
  catalogueRevision: "catalogue-2026-08-01",
  retrievedAtUtc: "2026-08-01T10:00:00Z",
  mappingVersion: "polar-flow-sports-v1",
  evidenceRef: `sport-evidence-${"a".repeat(64)}`,
};

const recognized: TrainingSportIdentity = {
  state: "recognized",
  classification: {
    canonicalFamily: null,
    displayLabel: null,
    authorship: null,
    revision: 0,
  },
  recognition,
  recognitionCandidateCount: 1,
};

const familyNames = {
  running: "Running",
  cycling: "Cycling",
  swimming: "Swimming",
  walking: "Walking",
  hiking: "Hiking",
  strength: "Strength",
  mobility: "Mobility",
  "racket-sport": "Racket sport",
  "team-sport": "Team sport",
  "winter-sport": "Winter sport",
  "water-sport": "Water sport",
  other: "Other",
};

describe("training sport identity presentation", () => {
  it("uses exact, language, English, and stable first-name locale fallback", () => {
    expect(localizedName(recognition.localizedNames, "es-ES")).toBe("Piragüismo");
    expect(localizedName({ es: "Piragüismo", en: "Kayaking" }, "es-MX"))
      .toBe("Piragüismo");
    expect(localizedName(recognition.localizedNames, "fr-FR")).toBe("Kayaking");
    expect(localizedName({ de: "Kajak", it: "Kayak" }, "fr-FR")).toBe("Kajak");
  });

  it("presents recognized evidence until a personal identity overrides it", () => {
    expect(resolvedSportName(recognized, "es-ES", familyNames)).toBe("Piragüismo");
    expect(sportCanonicalFamily(recognized)).toBe("water-sport");

    const personal: TrainingSportIdentity = {
      ...recognized,
      state: "personally-overridden",
      classification: {
        canonicalFamily: "other",
        displayLabel: "Remo de travesía",
        authorship: "user",
        revision: 4,
      },
    };
    expect(resolvedSportName(personal, "es-ES", familyNames)).toBe("Remo de travesía");
    expect(sportCanonicalFamily(personal)).toBe("other");
  });

  it("does not present one candidate as recognized when identity is ambiguous", () => {
    const ambiguous: TrainingSportIdentity = {
      ...recognized,
      state: "ambiguous",
      recognition: null,
      recognitionCandidateCount: 2,
    };
    expect(resolvedSportName(ambiguous, "en-US", familyNames)).toBeNull();
    expect(sportCanonicalFamily(ambiguous)).toBeNull();
  });
});
