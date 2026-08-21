import type { IllustratedSportFamily } from "./library-home";

interface SportFamilyIconProps {
  family: IllustratedSportFamily;
}

export function SportFamilyIcon({ family }: SportFamilyIconProps) {
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
    </svg>
  );
}
