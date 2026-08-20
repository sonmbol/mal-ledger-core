import { describe, expect, it } from "vitest";

import { Money } from "../src/domain/money.js";
import type { AuthorizationState, LedgerEntry } from "../src/domain/types.js";
import {
  calculateAvailableBalance,
  calculateBalanceAtDay,
  calculateHeldAmount,
  calculatePostedBalance,
} from "../src/engine/balanceCalculator.js";

const account = {
  id: "A",
  currency: "AED",
  openingBalance: Money.zero("AED"),
} as const;

const entries: readonly LedgerEntry[] = [
  {
    id: "C",
    sourceEventId: "C",
    receivedDay: 2,
    accountId: "A",
    valueDate: 1,
    amount: Money.parse("AED", "100.00"),
    kind: "CREDIT",
  },
];

const holds = new Map<string, AuthorizationState>([
  [
    "H",
    {
      id: "H",
      accountId: "A",
      held: Money.parse("AED", "30.00"),
      state: "OPEN",
    },
  ],
]);

describe("balance calculators", () => {
  it("derives posted, held, and available from one source of truth", () => {
    expect(calculatePostedBalance(account, entries).format()).toBe("100.00");
    expect(calculateHeldAmount("A", "AED", holds).format()).toBe("30.00");
    expect(calculateAvailableBalance(account, entries, holds).format()).toBe(
      "70.00",
    );
  });

  it("uses value date for the accounting-day balance", () => {
    expect(calculateBalanceAtDay(account, entries, 1).format()).toBe("100.00");
  });
});
