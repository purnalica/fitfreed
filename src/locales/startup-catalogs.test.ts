import { describe, expect, it } from "vitest";

import { catalogs } from "./catalogs";
import { startupShellCatalogs } from "./startup-catalogs";

describe("startup shell catalogs", () => {
  it("projects each startup catalog from its complete canonical shell", () => {
    expect(startupShellCatalogs).toEqual({
      "en-US": catalogs["en-US"].shell,
      "es-ES": catalogs["es-ES"].shell,
    });
  });
});
