import { describe, expect, it } from "vitest";

import { Money } from "../src/domain/money.js";
import { allocateInstallments } from "../src/engine/installmentAllocator.js";

describe("allocateInstallments", () => {
  it("allocates the residual last and preserves BHD 10.000 exactly", () => {
    const allocations = allocateInstallments(Money.parse("BHD", "10.000"), 3);

    expect(allocations.map((amount) => amount.format())).toEqual([
      "3.333",
      "3.333",
      "3.334",
    ]);
    expect(allocations.reduce((sum, amount) => sum + amount.minor, 0n)).toBe(
      10_000n,
    );
  });

  it("rejects invalid counts", () => {
    expect(() => allocateInstallments(Money.parse("AED", "1"), 0)).toThrow();
  });

  it("refuses equal 3.334×3 because that breaks conservation of BHD 10.000", () => {
    // Assessment challenge: three equal 3.334 installments. That sums to
    // BHD 10.002 and would invent 0.002 against the posted E10 credit.
    const equalChallenge = Money.parse("BHD", "3.334");
    expect(equalChallenge.minor * 3n).toBe(10_002n);
    expect(equalChallenge.minor * 3n).not.toBe(10_000n);

    const allocations = allocateInstallments(Money.parse("BHD", "10.000"), 3);

    expect(allocations.map((amount) => amount.format())).not.toEqual([
      "3.334",
      "3.334",
      "3.334",
    ]);
    expect(allocations.reduce((sum, amount) => sum + amount.minor, 0n)).toBe(
      Money.parse("BHD", "10.000").minor,
    );
  });
});
