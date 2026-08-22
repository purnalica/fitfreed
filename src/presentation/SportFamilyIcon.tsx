import sportIconSprite from "../../assets/sport/sport-icons.svg?raw";

import type { SportFamily, TrainingSportState } from "./training-sports";

interface SportFamilyIconProps {
  family: SportFamily | null;
  state?: TrainingSportState;
}

function iconName(family: SportFamily | null, state: TrainingSportState): string {
  if (family) return family;
  if (state === "classified") return "custom";
  return state;
}

export function SportFamilyIcon({ family, state = "unknown" }: SportFamilyIconProps) {
  const icon = iconName(family, state);
  return (
    <svg
      className="sport-family-icon"
      data-testid="sport-family-icon"
      data-sport-icon={icon}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <use href={`#sport-icon-${icon}`} />
    </svg>
  );
}

export function SportIconDefinitions() {
  return (
    <div
      className="sport-icon-definitions"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: sportIconSprite }}
    />
  );
}
