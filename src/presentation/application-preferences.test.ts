import { afterEach, describe, expect, it } from "vitest";

import {
  applyApplicationPreferences,
  defaultApplicationPreferences,
  sameApplicationPreferences,
  type ApplicationPreferences,
} from "./application-preferences";

const darkSpanishPreferences: ApplicationPreferences = {
  version: 1,
  locale: "es-ES",
  appearance: "dark",
  contentZoomPercent: 175,
};

afterEach(() => {
  document.documentElement.removeAttribute("data-appearance");
  document.documentElement.removeAttribute("data-content-zoom");
  document.documentElement.removeAttribute("style");
  document.documentElement.lang = "en";
});

describe("application preferences", () => {
  it("defines one complete previewable default set for a supported system locale", () => {
    expect(defaultApplicationPreferences("es-ES")).toEqual({
      version: 1,
      locale: "es-ES",
      appearance: "system",
      contentZoomPercent: 100,
    });
  });

  it("applies language, appearance, and content zoom to the document together", () => {
    applyApplicationPreferences(darkSpanishPreferences);

    expect(document.documentElement).toHaveAttribute("lang", "es-ES");
    expect(document.documentElement).toHaveAttribute("data-appearance", "dark");
    expect(document.documentElement).toHaveAttribute("data-content-zoom", "175");
    expect(document.documentElement.style.getPropertyValue("--content-zoom")).toBe("1.75");
  });

  it("compares the user-controlled values without coupling to the contract version", () => {
    expect(sameApplicationPreferences(darkSpanishPreferences, {
      ...darkSpanishPreferences,
      version: 2,
    })).toBe(true);
    expect(sameApplicationPreferences(darkSpanishPreferences, {
      ...darkSpanishPreferences,
      contentZoomPercent: 200,
    })).toBe(false);
  });
});
