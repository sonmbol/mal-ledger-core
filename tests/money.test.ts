import { describe, expect, it } from "vitest";

import { Money, roundRationalHalfAway } from "../src/domain/money.js";

describe("Money", () => {
  it("parses, formats, and arithmetics exact currency scales", () => {
    expect(Money.parse("AED", "12.3").format()).toBe("12.30");
    expect(Money.parse("BHD", "12").format()).toBe("12.000");
    expect(
      Money.parse("AED", "2.50").subtract(Money.parse("AED", "1.25")).format(),
    ).toBe("1.25");
    expect(() => Money.parse("AED", "1").add(Money.parse("BHD", "1"))).toThrow(
      /Currency mismatch/,
    );
    expect(() => Money.parse("AED", "1.001")).toThrow(/precision/);
  });

  it("rounds rational values half away from zero", () => {
    expect(roundRationalHalfAway(5n, 10n)).toBe(1n);
    expect(roundRationalHalfAway(-5n, 10n)).toBe(-1n);
    expect(roundRationalHalfAway(4n, 10n)).toBe(0n);
  });
});
