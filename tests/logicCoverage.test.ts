import { describe, expect, it } from "vitest";

import { accounts } from "../src/data/sampleEvents.js";
import { LedgerErrorCode } from "../src/domain/errors.js";
import type { LedgerEvent } from "../src/domain/events.js";
import { accountView, type AccountDefinition } from "../src/domain/types.js";
import { replay } from "../src/engine/replayEngine.js";

function run(
  events: readonly LedgerEvent[],
  replayAccounts: readonly AccountDefinition[] = accounts,
) {
  return replay({ accounts: replayAccounts, events });
}

function rejectionCodes(events: readonly LedgerEvent[]) {
  return run(events).outcomes.map((outcome) =>
    outcome.status === "REJECTED" ? outcome.rejection.code : "ACCEPTED",
  );
}

/**
 * Gap coverage for criteria paths not fully exercised by the sample E1–E10 stream.
 * Each case maps to a LedgerErrorCode or a named business invariant.
 */
describe("logic coverage — reject paths", () => {
  it("rejects zero / malformed amounts before posting", () => {
    expect(
      rejectionCodes([
        {
          id: "Z",
          eventDay: 1,
          type: "CREDIT",
          accountId: "ACC-001",
          currency: "AED",
          amount: "0.00",
          valueDate: 1,
        },
        {
          id: "M",
          eventDay: 1,
          type: "DEBIT",
          accountId: "ACC-001",
          currency: "AED",
          amount: "12.345",
          valueDate: 1,
        },
      ]),
    ).toEqual([LedgerErrorCode.invalidAmount, LedgerErrorCode.invalidAmount]);
  });

  it("rejects duplicate authorization ids", () => {
    const result = run([
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "100.00",
        valueDate: 1,
      },
      {
        id: "A1",
        eventDay: 1,
        type: "AUTHORIZATION",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "Dup",
        amount: "10.00",
        valueDate: 1,
      },
      {
        id: "A2",
        eventDay: 1,
        type: "AUTHORIZATION",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "Dup",
        amount: "10.00",
        valueDate: 1,
      },
    ]);

    expect(
      result.outcomes
        .filter((outcome) => outcome.status === "REJECTED")
        .map((outcome) => outcome.rejection.code),
    ).toEqual([LedgerErrorCode.duplicateAuthorization]);
    expect(result.authorizations).toHaveLength(1);
  });

  it("rejects settlement when auth belongs to another account", () => {
    const result = run([
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "100.00",
        valueDate: 1,
      },
      {
        id: "A",
        eventDay: 1,
        type: "AUTHORIZATION",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "H",
        amount: "40.00",
        valueDate: 1,
      },
      {
        id: "S",
        eventDay: 1,
        type: "SETTLEMENT",
        accountId: "ACC-002",
        currency: "BHD",
        authorizationId: "H",
        amount: "1.000",
        valueDate: 1,
      },
    ]);

    // Auth Hold-H is on ACC-001; settle claims ACC-002 → authorizationNotOpen.
    const settle = result.outcomes.find(({ event }) => event.id === "S");
    expect(settle?.status).toBe("REJECTED");
    if (settle?.status === "REJECTED") {
      expect(settle.rejection.code).toBe(LedgerErrorCode.authorizationNotOpen);
    }
    expect(result.authorizations.find(({ id }) => id === "H")?.state).toBe(
      "OPEN",
    );
  });

  it("rejects settlement after the hold is already settled", () => {
    const result = run([
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "100.00",
        valueDate: 1,
      },
      {
        id: "A",
        eventDay: 1,
        type: "AUTHORIZATION",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "H",
        amount: "40.00",
        valueDate: 1,
      },
      {
        id: "S1",
        eventDay: 1,
        type: "SETTLEMENT",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "H",
        amount: "40.00",
        valueDate: 1,
      },
      {
        id: "S2",
        eventDay: 2,
        type: "SETTLEMENT",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "H",
        amount: "1.00",
        valueDate: 2,
      },
    ]);

    expect(
      result.outcomes.find(({ event }) => event.id === "S2")?.status ===
        "REJECTED"
        ? result.outcomes.find(({ event }) => event.id === "S2")
        : undefined,
    ).toMatchObject({
      status: "REJECTED",
      rejection: { code: LedgerErrorCode.authorizationNotOpen },
    });
  });

  it("rejects reversal when target is on another account", () => {
    const result = run([
      {
        id: "C1",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "10.00",
        valueDate: 1,
      },
      {
        id: "C2",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-002",
        currency: "BHD",
        amount: "1.000",
        valueDate: 1,
      },
      {
        id: "R",
        eventDay: 2,
        type: "REVERSAL",
        accountId: "ACC-002",
        currency: "BHD",
        reversalTargetId: "C1",
        valueDate: 2,
      },
    ]);

    expect(
      result.outcomes.find(({ event }) => event.id === "R")?.status ===
        "REJECTED"
        ? (
            result.outcomes.find(({ event }) => event.id === "R") as {
              rejection: { code: string };
            }
          ).rejection.code
        : undefined,
    ).toBe(LedgerErrorCode.reversalTargetAccountMismatch);
  });

  it("rejects reversing a rejected event or an authorization id", () => {
    const result = run([
      {
        id: "BAD",
        eventDay: 1,
        type: "SETTLEMENT",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "missing",
        amount: "1.00",
        valueDate: 1,
      },
      {
        id: "R1",
        eventDay: 1,
        type: "REVERSAL",
        accountId: "ACC-001",
        currency: "AED",
        reversalTargetId: "BAD",
        valueDate: 1,
      },
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "50.00",
        valueDate: 1,
      },
      {
        id: "A",
        eventDay: 1,
        type: "AUTHORIZATION",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "OnlyHold",
        amount: "10.00",
        valueDate: 1,
      },
      {
        id: "R2",
        eventDay: 1,
        type: "REVERSAL",
        accountId: "ACC-001",
        currency: "AED",
        reversalTargetId: "A",
        valueDate: 1,
      },
    ]);

    expect(
      result.outcomes
        .filter((outcome) => outcome.event.id.startsWith("R"))
        .map((outcome) =>
          outcome.status === "REJECTED" ? outcome.rejection.code : "ACCEPTED",
        ),
    ).toEqual([
      LedgerErrorCode.reversalTargetNotFound,
      LedgerErrorCode.reversalTargetNotFound,
    ]);
  });
});

describe("logic coverage — fee and balance invariants", () => {
  it("does not double-charge the same account-day when a later debit overlaps", () => {
    const result = run([
      {
        id: "D1",
        eventDay: 1,
        type: "DEBIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "10.00",
        valueDate: 1,
      },
      {
        id: "D2",
        eventDay: 2,
        type: "DEBIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "10.00",
        valueDate: 1,
      },
    ]);

    // D1 charges day 1. D2 window [1..2] — day 1 already charged; day 2 still negative.
    expect(
      result.fees.map(({ valueDate, sourceEventId }) => [
        valueDate,
        sourceEventId,
      ]),
    ).toEqual([
      [1, "D1"],
      [2, "D2"],
    ]);
    expect(result.fees).toHaveLength(2);
  });

  it("never opens a fee window from CREDIT / SETTLEMENT / REVERSAL alone", () => {
    const result = run([
      {
        id: "D",
        eventDay: 1,
        type: "DEBIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "100.00",
        valueDate: 1,
      },
      {
        id: "C",
        eventDay: 2,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "10.00",
        valueDate: 2,
      },
      {
        id: "R",
        eventDay: 3,
        type: "REVERSAL",
        accountId: "ACC-001",
        currency: "AED",
        reversalTargetId: "C",
        valueDate: 3,
      },
    ]);

    expect(
      result.fees.every(({ sourceEventId }) => sourceEventId === "D"),
    ).toBe(true);
    expect(result.fees).toHaveLength(1);
  });

  it("keeps SETTLED holds out of available while OPEN holds reduce it", () => {
    const open = run([
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "100.00",
        valueDate: 1,
      },
      {
        id: "A",
        eventDay: 1,
        type: "AUTHORIZATION",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "H",
        amount: "40.00",
        valueDate: 1,
      },
    ]);
    expect(accountView(open, "ACC-001").finalAvailable.format()).toBe("60.24");

    const settled = run([
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "100.00",
        valueDate: 1,
      },
      {
        id: "A",
        eventDay: 1,
        type: "AUTHORIZATION",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "H",
        amount: "40.00",
        valueDate: 1,
      },
      {
        id: "S",
        eventDay: 1,
        type: "SETTLEMENT",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "H",
        amount: "40.00",
        valueDate: 1,
      },
    ]);
    // posted 60; no OPEN hold → available == posted (plus day-6 interest on restated)
    expect(accountView(settled, "ACC-001").finalPosted.format()).toBe(
      accountView(settled, "ACC-001").finalAvailable.format(),
    );
    expect(
      settled.authorizations.every(
        (authorization) => authorization.state !== "OPEN",
      ),
    ).toBe(true);
  });

  it("separates observed receipt knowledge from restated value-date books", () => {
    const result = run([
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "100.00",
        valueDate: 1,
      },
      {
        id: "D",
        eventDay: 4,
        type: "DEBIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "30.00",
        valueDate: 2,
      },
    ]);

    const view = accountView(result, "ACC-001");
    // Observed D2: debit not yet received → still 100
    expect(view.observed[1]?.balance.format()).toBe("100.00");
    // Restated D2: debit books on value date 2 → 100 − 30 = 70 (day stays positive → no fee)
    expect(view.restatedBeforeInterest[1]?.balance.format()).toBe("70.00");
    // Observed only catches the debit on receipt day 4
    expect(view.observed[3]?.balance.format()).toBe("70.00");
  });
});
