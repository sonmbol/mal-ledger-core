import type { LedgerDay } from "./events.js";

/** Exact rational rate (e.g. 4/10_000 = 0.04% per day). */
export interface RationalRate {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

/** Fixed assessment window and interest knobs — not a rules engine. */
export interface ReplayPolicy {
  readonly assessmentDays: readonly LedgerDay[];
  readonly interest: {
    readonly rate: RationalRate;
    readonly capitalizationDay: LedgerDay;
  };
}

export const assessmentReplayPolicy: ReplayPolicy = Object.freeze({
  assessmentDays: Object.freeze([1, 2, 3, 4, 5, 6]),
  interest: Object.freeze({
    rate: Object.freeze({ numerator: 4n, denominator: 10_000n }),
    capitalizationDay: 6,
  }),
});
