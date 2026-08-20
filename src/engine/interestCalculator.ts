import { Money, roundRationalHalfAway } from "../domain/money.js";
import type { RationalRate } from "../domain/policy.js";
import type { DailyBalance, InterestAllocation } from "../domain/types.js";

/** One rounded amount per positive closing day. Replay sums them exactly. */
export function calculateInterest(
  closings: readonly DailyBalance[],
  rate: RationalRate,
): readonly InterestAllocation[] {
  if (rate.denominator <= 0n) {
    throw new Error("Interest rate denominator must be positive");
  }

  return closings
    .filter(({ balance }) => balance.minor > 0n)
    .map(({ day, balance }) => ({
      day,
      amount: Money.fromMinor(
        balance.currency,
        roundRationalHalfAway(balance.minor * rate.numerator, rate.denominator),
      ),
    }));
}
