import { describe, expect, it } from "vitest";

import { catalogs } from "./catalogs";
import {
  defaultCatalog,
  loadedRuntimeCatalog,
  loadRuntimeCatalog,
} from "./runtime-catalogs";

describe("runtime locale catalogs", () => {
  it("keeps English immediately available for the deterministic startup fallback", async () => {
    expect(defaultCatalog).toBe(catalogs["en-US"]);
    expect(loadedRuntimeCatalog("en-US")).toBe(defaultCatalog);
    await expect(loadRuntimeCatalog("en-US")).resolves.toBe(defaultCatalog);
  });

  it("loads and caches Spanish only when that locale is selected", async () => {
    const first = await loadRuntimeCatalog("es-ES");
    const second = await loadRuntimeCatalog("es-ES");

    expect(first).toEqual(catalogs["es-ES"]);
    expect(second).toBe(first);
    expect(loadedRuntimeCatalog("es-ES")).toBe(first);
  });
});
