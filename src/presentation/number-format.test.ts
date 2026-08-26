import { describe, expect, it } from "vitest";

import { integerCountFormatter } from "./presentation-format";

describe("integer count formatting", () => {
  it("groups both four- and five-digit Spanish counts consistently", () => {
    const number = integerCountFormatter("es-ES");

    expect(number.format(4_321)).toBe("4.321");
    expect(number.format(12_345)).toBe("12.345");
  });
});
