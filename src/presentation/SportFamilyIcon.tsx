import type { SportFamily, TrainingSportState } from "./training-sports";

interface SportFamilyIconProps {
  family: SportFamily | null;
  state?: TrainingSportState;
}

export function SportFamilyIcon({ family, state = "unknown" }: SportFamilyIconProps) {
  return (
    <svg
      className="sport-family-icon"
      data-testid="sport-family-icon"
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      {family === "running" && (
        <>
          <circle cx="20" cy="5.5" r="2.5" />
          <path d="m17 10 5 3 3 5M17 10l-4 6-5 2m9-8-1 8 5 4m-5-4-5 8" />
        </>
      )}
      {family === "cycling" && (
        <>
          <circle cx="8" cy="23" r="5" />
          <circle cx="24" cy="23" r="5" />
          <circle cx="18" cy="7" r="2.5" />
          <path d="m18 11-5 4 4 4h5m-9-4-5 8m10-12 5 4 1 8" />
        </>
      )}
      {family === "water-sport" && (
        <>
          <path d="M4 22c4 0 4 3 8 3s4-3 8-3 4 3 8 3M6 27c3 0 4 2 7 2s4-2 7-2 4 2 6 2" />
          <path d="m7 18 18-7M9 13l-3 2 3 2m14-8 3 2-3 2M12 20l4-8 5 7" />
        </>
      )}
      {family === "strength" && (
        <>
          <path d="M4 12v8m4-11v14m16-11v8m-4-11v14M8 16h12M2 14v4m28-4v4M24 16h6" />
        </>
      )}
      {family === "swimming" && (
        <>
          <circle cx="21" cy="8" r="2.5" />
          <path d="m18 12-5 4 5 3 5-4M3 23c3 0 4-2 7-2s4 2 7 2 4-2 7-2 4 2 5 2M4 27c3 0 4-2 7-2s4 2 7 2 4-2 7-2" />
        </>
      )}
      {family === "walking" && (
        <>
          <circle cx="18" cy="6" r="2.5" />
          <path d="m16 11-3 7 4 3 2 7m-3-17 6 5 4 1m-9 4-6 6" />
        </>
      )}
      {family === "hiking" && (
        <>
          <circle cx="18" cy="6" r="2.5" />
          <path d="m16 11-3 7 4 3 2 7m-3-17 5 5 3 1m-7 4-6 6m14-15v16M4 27l6-8 4 5" />
        </>
      )}
      {family === "mobility" && (
        <>
          <circle cx="16" cy="7" r="2.5" />
          <path d="m16 11-5 6 5 3 5-3-5-6Zm0 9v8m-5-11-6 4m16-4 6 4" />
        </>
      )}
      {family === "racket-sport" && (
        <>
          <ellipse cx="13" cy="12" rx="7" ry="9" />
          <path d="m17 19 8 9M9 6l10 11M7 11l9-5" />
          <circle cx="25" cy="8" r="2" />
        </>
      )}
      {family === "team-sport" && (
        <>
          <circle cx="16" cy="16" r="12" />
          <path d="m16 10 5 4-2 6h-6l-2-6 5-4Zm0 0V4m5 10 6-2m-8 8 3 6m-9-6-3 6m1-12-6-2" />
        </>
      )}
      {family === "winter-sport" && (
        <>
          <path d="M7 4v24M3 8l8 16M11 8 3 24M25 4v24m-4-18h8M4 27h25" />
        </>
      )}
      {family === "other" && (
        <>
          <circle cx="16" cy="16" r="12" />
          <path d="M10 16h12M16 10v12" />
        </>
      )}
      {family === null && state === "unknown" && (
        <>
          <circle cx="16" cy="16" r="12" />
          <path d="m8 19 4-5 4 3 4-6 4 3" />
          <circle cx="8" cy="19" r="1" />
          <circle cx="24" cy="14" r="1" />
        </>
      )}
      {family === null && state === "unavailable" && (
        <>
          <circle cx="16" cy="16" r="12" />
          <path d="m8 24 16-16M10 16h12" />
        </>
      )}
    </svg>
  );
}
