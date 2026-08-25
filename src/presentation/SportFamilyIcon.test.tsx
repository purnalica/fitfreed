import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import sportIconSprite from "../../assets/sport/sport-icons.svg?raw";

import { SportFamilyIcon, SportIconDefinitions } from "./SportFamilyIcon";
import { sportFamilies } from "./training-sports";

afterEach(cleanup);

describe("SportFamilyIcon", () => {
  it("keeps one closed local symbol set for every family and identity state", () => {
    const document = new DOMParser().parseFromString(sportIconSprite, "image/svg+xml");
    const symbols = [...document.querySelectorAll("symbol")].map((symbol) => symbol.id);

    expect(symbols.sort()).toEqual([
      ...sportFamilies.map((family) => `sport-icon-${family}`),
      "sport-icon-custom",
      "sport-icon-unknown",
      "sport-icon-unavailable",
    ].sort());
    expect(document.documentElement.getAttribute("class")).toBe("sport-icon-sprite");
    expect(document.documentElement.hasAttribute("style")).toBe(false);
    expect(document.querySelector("script, image, foreignObject, [href], [src]")).toBeNull();
  });

  it("resolves every provider-neutral family through the canonical icon source", () => {
    for (const family of sportFamilies) {
      const view = render(
        <>
          <SportIconDefinitions />
          <SportFamilyIcon family={family} state="personally-overridden" />
        </>,
      );
      expect(view.container.querySelector(`#sport-icon-${family}`)).not.toBeNull();
      expect(view.container.querySelector("use")).toHaveAttribute(
        "href",
        `#sport-icon-${family}`,
      );
      view.unmount();
    }
  });

  it.each([
    ["personally-overridden", "custom"],
    ["unknown", "unknown"],
    ["unavailable", "unavailable"],
  ] as const)("renders a non-empty %s identity", (state, icon) => {
    const view = render(<SportFamilyIcon family={null} state={state} />);

    expect(view.container.querySelector("use")).toHaveAttribute(
      "href",
      `#sport-icon-${icon}`,
    );
  });
});
