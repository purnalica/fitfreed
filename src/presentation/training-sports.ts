export type TrainingSportState =
  | "recognized"
  | "ambiguous"
  | "unknown"
  | "personally-overridden"
  | "unavailable";

export type SportFamily =
  | "running"
  | "cycling"
  | "swimming"
  | "walking"
  | "hiking"
  | "strength"
  | "mobility"
  | "racket-sport"
  | "team-sport"
  | "winter-sport"
  | "water-sport"
  | "other";

export const sportFamilies: SportFamily[] = [
  "running",
  "cycling",
  "swimming",
  "walking",
  "hiking",
  "strength",
  "mobility",
  "racket-sport",
  "team-sport",
  "winter-sport",
  "water-sport",
  "other",
];

export interface TrainingSportClassification {
  scope: "unresolved-source-profile";
  canonicalFamily: SportFamily | null;
  displayLabel: string | null;
  authorship: "user" | null;
  revision: number;
}

export interface TrainingSportRecognition {
  canonicalFamily: SportFamily | null;
  localizedNames: Record<string, string>;
  catalogueRevision: string;
  retrievedAtUtc: string;
  mappingVersion: string;
  evidenceRef: string;
}

export interface TrainingSportIdentity {
  state: TrainingSportState;
  classification: TrainingSportClassification | null;
  recognition: TrainingSportRecognition | null;
  recognitionCandidateCount: number;
}

export function recognizedSportName(
  sport: TrainingSportIdentity,
  locale: string,
): string | null {
  const names = sport.recognition?.localizedNames;
  return names ? localizedName(names, locale) : null;
}

export function localizedName(
  names: Record<string, string>,
  locale: string,
): string | null {
  const exact = Object.entries(names).find(
    ([languageTag]) => languageTag.toLowerCase() === locale.toLowerCase(),
  )?.[1];
  if (exact) return exact;
  const baseLocale = locale.split("-")[0]?.toLowerCase();
  const base = Object.entries(names).find(
    ([languageTag]) => languageTag.toLowerCase() === baseLocale,
  )?.[1];
  return base ?? names.en ?? Object.values(names)[0] ?? null;
}

export function sportCanonicalFamily(sport: TrainingSportIdentity): SportFamily | null {
  if (sport.state === "personally-overridden") {
    return sport.classification?.canonicalFamily ?? null;
  }
  return sport.state === "recognized"
    ? sport.recognition?.canonicalFamily ?? null
    : null;
}

export function resolvedSportName(
  sport: TrainingSportIdentity,
  locale: string,
  familyNames: Record<SportFamily, string>,
): string | null {
  if (sport.state === "personally-overridden") {
    return sport.classification?.displayLabel
      ?? (sport.classification?.canonicalFamily
        ? familyNames[sport.classification.canonicalFamily]
        : null);
  }
  if (sport.state === "recognized") {
    return recognizedSportName(sport, locale)
      ?? (sport.recognition?.canonicalFamily
        ? familyNames[sport.recognition.canonicalFamily]
        : null);
  }
  return null;
}

export interface TrainingSportCoverage {
  sessionCount: number;
  totalDurationMilliseconds: string;
  distanceSessionCount: number;
  heartRateSessionCount: number;
}

export interface TrainingSportUnification {
  relationshipRef: string;
  primarySessionFilterRef: string;
  memberSessionFilterRefs: string[];
  authorship: "user";
  revision: number;
}

export interface TrainingSportUnificationReview {
  relationship: TrainingSportUnification;
  reason: "missing-member" | "unusable-primary";
  missingMemberSessionFilterRefs: string[];
}

export interface TrainingSport {
  sessionFilterRef: string;
  memberSessionFilterRefs: string[];
  sportRef: string | null;
  sourceIndex: number;
  state: TrainingSportState;
  classification: TrainingSportClassification | null;
  recognition: TrainingSportRecognition | null;
  recognitionCandidateCount: number;
  unification: TrainingSportUnification | null;
  firstLocalDate: string;
  lastLocalDate: string;
  coverage: TrainingSportCoverage;
}

export interface TrainingSportsOverview {
  snapshotRef: string;
  originCount: number;
  sessionCount: number;
  sports: TrainingSport[];
  sportCollections: TrainingSport[];
  unificationReviews: TrainingSportUnificationReview[];
}

export interface SavedTrainingSportClassification {
  outcome: "changed" | "unchanged";
  overview: TrainingSportsOverview;
}

export interface SavedUnifiedSportRelationship {
  outcome: "changed" | "unchanged" | "removed";
  overview: TrainingSportsOverview;
}

export type SavedTrainingSportIdentity =
  | SavedTrainingSportClassification
  | SavedUnifiedSportRelationship;

export interface TrainingSportClassificationChange {
  requestId: number;
  source: "sessions" | "sports";
  result: SavedTrainingSportIdentity;
}
