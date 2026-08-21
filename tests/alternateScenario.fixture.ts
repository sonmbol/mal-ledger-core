import type { LedgerEvent } from "../src/domain/events.js";
import { Money } from "../src/domain/money.js";
import type { AccountDefinition } from "../src/domain/types.js";

/**
 * Test-only second stream (not part of product data).
 * Same accounts / Days 1–6 policy. Proves the engine is not hard-coded to E1–E10.
 *
 * Story → expectations (locked in `alternateExpected` + tests):
 *
 *  ALT1  CREDIT +500 D1                 → posted 500
 *  ALT2  AUTH Hold-X 200                → OPEN; available 300
 *  ALT3  AUTH Hold-X again              → REJECT DUPLICATE_AUTHORIZATION
 *  ALT4  SETTLE Hold-X 150 VD2          → −150; released 50; Hold-X SETTLED
 *  ALT5  DEBIT 400 VD1 / recv D3        → −400 on D1; fees on D2+D3 (not D1)
 *        Restated after ALT5 (ex fees): D1=100, D2=−50, D3=−50
 *  ALT6  CREDIT ACC-002 5.000 / 2 inst  → 2.500 + 2.500
 *  ALT7  REVERSAL ALT5 VD1              → +400; ALT5 fees remain (−50)
 *  ALT8  AUTH Hold-Y 400                → REJECT insufficient (posted ~300)
 *  ALT9  DEBIT 50 VD5                   → −50; day 5 still positive → no new fee
 *  ALT10 REVERSAL of ALT2 (AUTH)        → REJECT (auth is not reversible)
 *
 * Finals after interest: ACC-001 AED 250.77 · ACC-002 BHD 5.008
 */
export const alternateAccounts = [
  {
    id: "ACC-001",
    currency: "AED",
    openingBalance: Money.zero("AED"),
  },
  {
    id: "ACC-002",
    currency: "BHD",
    openingBalance: Money.zero("BHD"),
  },
] as const satisfies readonly AccountDefinition[];

export const alternateEvents = [
  {
    id: "ALT1",
    eventDay: 1,
    type: "CREDIT",
    accountId: "ACC-001",
    currency: "AED",
    amount: "500.00",
    valueDate: 1,
  },
  {
    id: "ALT2",
    eventDay: 1,
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Hold-X",
    amount: "200.00",
    valueDate: 1,
  },
  {
    id: "ALT3",
    eventDay: 1,
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Hold-X",
    amount: "10.00",
    valueDate: 1,
  },
  {
    id: "ALT4",
    eventDay: 2,
    type: "SETTLEMENT",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Hold-X",
    amount: "150.00",
    valueDate: 2,
  },
  {
    id: "ALT5",
    eventDay: 3,
    type: "DEBIT",
    accountId: "ACC-001",
    currency: "AED",
    amount: "400.00",
    valueDate: 1,
  },
  {
    id: "ALT6",
    eventDay: 3,
    type: "CREDIT",
    accountId: "ACC-002",
    currency: "BHD",
    amount: "5.000",
    installments: 2,
    valueDate: 3,
  },
  {
    id: "ALT7",
    eventDay: 4,
    type: "REVERSAL",
    accountId: "ACC-001",
    currency: "AED",
    reversalTargetId: "ALT5",
    valueDate: 1,
  },
  {
    id: "ALT8",
    eventDay: 5,
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Hold-Y",
    amount: "400.00",
    valueDate: 5,
  },
  {
    id: "ALT9",
    eventDay: 5,
    type: "DEBIT",
    accountId: "ACC-001",
    currency: "AED",
    amount: "50.00",
    valueDate: 5,
  },
  {
    id: "ALT10",
    eventDay: 6,
    type: "REVERSAL",
    accountId: "ACC-001",
    currency: "AED",
    reversalTargetId: "ALT2",
    valueDate: 6,
  },
] as const satisfies readonly LedgerEvent[];

/** Contract for `alternateEvents` — asserted by tests/alternateScenario.test.ts */
export const alternateExpected = {
  outcomes: [
    ["ALT1", "ACCEPTED"],
    ["ALT2", "ACCEPTED"],
    ["ALT3", "REJECTED"],
    ["ALT4", "ACCEPTED"],
    ["ALT5", "ACCEPTED"],
    ["ALT6", "ACCEPTED"],
    ["ALT7", "ACCEPTED"],
    ["ALT8", "REJECTED"],
    ["ALT9", "ACCEPTED"],
    ["ALT10", "REJECTED"],
  ],
  rejectionCodes: {
    ALT3: "DUPLICATE_AUTHORIZATION",
    ALT8: "INSUFFICIENT_AVAILABLE_BALANCE",
    ALT10: "REVERSAL_TARGET_NOT_FOUND",
  },
  holdX: { state: "SETTLED", settled: "150.00", released: "50.00" },
  holdYCreated: false,
  /** ALT5 window [1..3]: D1 positive, D2+D3 negative → fees D2, D3 only */
  alt5FeeDays: [2, 3],
  /** ALT9 day-5 close stays non-negative → no ALT9 fee */
  totalFeeCount: 2,
  installments: ["2.500", "2.500"],
  observedAcc001: ["500.00", "350.00", "-100.00", "300.00", "250.00", "250.00"],
  restatedAcc001: ["500.00", "325.00", "300.00", "300.00", "250.00", "250.00"],
  interestAcc001: ["0.20", "0.13", "0.12", "0.12", "0.10", "0.10"],
  finals: {
    "ACC-001": { posted: "250.77", available: "250.77" },
    "ACC-002": { posted: "5.008", available: "5.008" },
  },
} as const;
