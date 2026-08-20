import { describe, expect, it } from "vitest";

import { Money } from "../src/domain/money.js";
import { calculateInterest } from "../src/engine/interestCalculator.js";

const rate = { numerator: 4n, denominator: 10_000n };

describe("calculateInterest", () => {
  it("allocates only for positive closings at each currency scale", () => {
    expect(
      calculateInterest(
        [
          { day: 1, balance: Money.parse("AED", "250.00") },
          { day: 2, balance: Money.zero("AED") },
          { day: 3, balance: Money.parse("AED", "-5.00") },
        ],
        rate,
      ).map(({ amount }) => amount.format()),
    ).toEqual(["0.10"]);

    expect(
      calculateInterest(
        [{ day: 1, balance: Money.parse("BHD", "10.000") }],
        rate,
      )[0]?.amount.format(),
    ).toBe("0.004");
  });

  it("rounds half away from zero", () => {
    expect(
      calculateInterest(
        [
          { day: 1, balance: Money.parse("AED", "12.50") },
          { day: 2, balance: Money.parse("AED", "12.49") },
        ],
        rate,
      ).map(({ amount }) => amount.format()),
    ).toEqual(["0.01", "0.00"]);
  });
});
