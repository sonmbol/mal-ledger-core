import { describe, expect, it } from "vitest";

import { accounts, sampleEvents } from "../src/data/sampleEvents.js";
import { LedgerErrorCode } from "../src/domain/errors.js";
import type { LedgerEvent } from "../src/domain/events.js";
import { Money } from "../src/domain/money.js";
import { accountView, type AccountDefinition } from "../src/domain/types.js";
import { replay } from "../src/engine/replayEngine.js";

function run(
  events: readonly LedgerEvent[] = sampleEvents,
  replayAccounts: readonly AccountDefinition[] = accounts,
) {
  return replay({ accounts: replayAccounts, events });
}

describe("assessment replay", () => {
  const result = run();

  it("processes every event in supplied order with expected outcomes", () => {
    expect(
      result.outcomes.map(({ event, status }) => [event.id, status]),
    ).toEqual([
      ["E1", "ACCEPTED"],
      ["E2", "ACCEPTED"],
      ["E3", "ACCEPTED"],
      ["E4", "ACCEPTED"],
      ["E5", "ACCEPTED"],
      ["E6", "REJECTED"],
      ["E7", "ACCEPTED"],
      ["E8", "REJECTED"],
      ["E9", "ACCEPTED"],
      ["E10", "ACCEPTED"],
    ]);
  });

  it("rejects E6 with no side effects and settles Auth-A", () => {
    const e6 = result.outcomes.find(({ event }) => event.id === "E6");

    expect(e6?.status === "REJECTED" ? e6.rejection.code : undefined).toBe(
      LedgerErrorCode.authorizationNotFound,
    );
    expect(
      result.ledgerEntries.some((entry) => entry.sourceEventId === "E6"),
    ).toBe(false);

    const authA = result.authorizations.find(({ id }) => id === "Auth-A");
    expect(authA).toMatchObject({ state: "SETTLED" });
    expect(authA?.settled?.format()).toBe("185.00");
    expect(authA?.released?.format()).toBe("15.00");
  });

  it("rejects E8 without creating Auth-B", () => {
    const e8 = result.outcomes.find(({ event }) => event.id === "E8");

    expect(e8?.status === "REJECTED" ? e8.rejection.code : undefined).toBe(
      LedgerErrorCode.insufficientAvailableBalance,
    );
    expect(result.authorizations.some(({ id }) => id === "Auth-B")).toBe(false);
  });

  it("assesses E7 fees on each negative closing day (2, 4, 5)", () => {
    const preFee = result.ledgerEntries
      .filter(
        (entry) =>
          entry.accountId === "ACC-001" &&
          entry.valueDate <= 2 &&
          entry.kind !== "OVERDRAFT_FEE" &&
          entry.sourceEventId !== "E9",
      )
      .reduce((balance, entry) => balance.add(entry.amount), Money.zero("AED"));

    expect(preFee.format()).toBe("-370.00");
    expect(result.fees.map(({ valueDate }) => valueDate)).toEqual([2, 4, 5]);
    expect(
      result.fees.every(({ sourceEventId }) => sourceEventId === "E7"),
    ).toBe(true);
    expect(
      result.fees.every(({ amount }) => amount.format() === "-25.00"),
    ).toBe(true);
  });

  it("keeps E7, offsets it with E9, and retains the derived fees", () => {
    expect(
      result.ledgerEntries
        .find((entry) => entry.sourceEventId === "E7" && entry.kind === "DEBIT")
        ?.amount.format(),
    ).toBe("-620.00");
    expect(
      result.ledgerEntries
        .find((entry) => entry.sourceEventId === "E9")
        ?.amount.format(),
    ).toBe("620.00");
    expect(result.fees).toHaveLength(3);
  });

  it("preserves observed and final-restated closings", () => {
    const acc001 = accountView(result, "ACC-001");

    expect(acc001.observed.map(({ balance }) => balance.format())).toEqual([
      "250.00",
      "250.00",
      "650.00",
      "465.00",
      "-230.00",
      "390.00",
    ]);
    expect(
      acc001.restatedBeforeInterest.map(({ balance }) => balance.format()),
    ).toEqual(["250.00", "225.00", "625.00", "415.00", "390.00", "390.00"]);
  });

  it("capitalizes interest exactly once on Day 6", () => {
    expect(
      accountView(result, "ACC-001").interest.map(({ amount }) =>
        amount.format(),
      ),
    ).toEqual(["0.10", "0.09", "0.25", "0.17", "0.16", "0.16"]);
    expect(
      result.ledgerEntries
        .filter((entry) => entry.kind === "INTEREST")
        .map(({ id, amount }) => [id, amount.minor]),
    ).toEqual([
      ["ACC-001:INTEREST:D6", 93n],
      ["ACC-002:INTEREST:D6", 8n],
    ]);
  });

  it("preserves approved final balances and BHD installments", () => {
    expect(accountView(result, "ACC-001").finalPosted.format()).toBe("390.93");
    expect(accountView(result, "ACC-001").finalAvailable.format()).toBe(
      "390.93",
    );
    expect(accountView(result, "ACC-002").finalPosted.format()).toBe("10.008");
    expect(
      result.installments[0]?.amounts.map((amount) => amount.format()),
    ).toEqual(["3.333", "3.333", "3.334"]);
  });
});

describe("validation and fee invariants", () => {
  it("consumes rejected event IDs and rejects reuse", () => {
    const result = run([
      {
        id: "X",
        eventDay: 1,
        type: "CREDIT",
        accountId: "missing",
        currency: "AED",
        amount: "1.00",
        valueDate: 1,
      },
      {
        id: "X",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "1.00",
        valueDate: 1,
      },
    ]);

    expect(
      result.outcomes.map((outcome) =>
        outcome.status === "REJECTED" ? outcome.rejection.code : undefined,
      ),
    ).toEqual([LedgerErrorCode.unknownAccount, LedgerErrorCode.duplicateEvent]);
    expect(result.ledgerEntries).toHaveLength(0);
  });

  it("validates before commit and only lets debits originate fees", () => {
    const invalid = run([
      {
        id: "BAD_COUNT",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-002",
        currency: "BHD",
        amount: "1.000",
        installments: 0,
        valueDate: 1,
      },
      {
        id: "BAD_CURRENCY",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "BHD",
        amount: "1.000",
        valueDate: 1,
      },
    ]);
    expect(invalid.outcomes.every(({ status }) => status === "REJECTED")).toBe(
      true,
    );
    expect(invalid.ledgerEntries).toHaveLength(0);

    const feeSource = run([
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
        amount: "1.00",
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
    expect(feeSource.fees).toHaveLength(1);
    expect(feeSource.fees[0]?.sourceEventId).toBe("D");
  });

  it("does not let fees recursively manufacture further fee days", () => {
    const result = run([
      {
        id: "C",
        eventDay: 1,
        type: "CREDIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "30.00",
        valueDate: 2,
      },
      {
        id: "D",
        eventDay: 2,
        type: "DEBIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "25.00",
        valueDate: 1,
      },
    ]);

    expect(result.fees.map(({ valueDate }) => valueDate)).toEqual([1]);
    expect(
      accountView(result, "ACC-001").restatedBeforeInterest.map(({ balance }) =>
        balance.format(),
      ),
    ).toEqual(["-50.00", "-20.00", "-20.00", "-20.00", "-20.00", "-20.00"]);
  });

  it("does not convert the AED fee onto BHD accounts", () => {
    const result = run([
      {
        id: "BD",
        eventDay: 1,
        type: "DEBIT",
        accountId: "ACC-002",
        currency: "BHD",
        amount: "1.000",
        valueDate: 1,
      },
    ]);

    expect(result.fees).toHaveLength(0);
    expect(result.audit.join("\n")).toContain(
      "no BHD overdraft fee configured",
    );
  });

  it("proves a funded hold changes available but not posted", () => {
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
        authorizationId: "Funded",
        amount: "30.00",
        valueDate: 1,
      },
    ]);

    expect(
      accountView(
        result,
        "ACC-001",
      ).restatedBeforeInterest[0]?.balance.format(),
    ).toBe("100.00");
    expect(accountView(result, "ACC-001").finalAvailable.format()).toBe(
      "70.24",
    );
  });

  it("rejects bad settlements and reversals without partial mutation", () => {
    const settlements = run([
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
        authorizationId: "A",
        amount: "50.00",
        valueDate: 1,
      },
      {
        id: "S1",
        eventDay: 1,
        type: "SETTLEMENT",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "A",
        amount: "51.00",
        valueDate: 1,
      },
      {
        id: "S2",
        eventDay: 1,
        type: "SETTLEMENT",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "A",
        amount: "40.00",
        valueDate: 1,
      },
      {
        id: "S3",
        eventDay: 1,
        type: "SETTLEMENT",
        accountId: "ACC-001",
        currency: "AED",
        authorizationId: "A",
        amount: "1.00",
        valueDate: 1,
      },
    ]);

    expect(settlements.outcomes.map(({ status }) => status)).toEqual([
      "ACCEPTED",
      "ACCEPTED",
      "REJECTED",
      "ACCEPTED",
      "REJECTED",
    ]);
    expect(accountView(settlements, "ACC-001").finalPosted.format()).toBe(
      "60.12",
    );

    const reversals = run([
      {
        id: "R0",
        eventDay: 1,
        type: "REVERSAL",
        accountId: "ACC-001",
        currency: "AED",
        reversalTargetId: "missing",
        valueDate: 1,
      },
      {
        id: "D",
        eventDay: 1,
        type: "DEBIT",
        accountId: "ACC-001",
        currency: "AED",
        amount: "1.00",
        valueDate: 1,
      },
      {
        id: "R1",
        eventDay: 2,
        type: "REVERSAL",
        accountId: "ACC-001",
        currency: "AED",
        reversalTargetId: "D",
        valueDate: 1,
      },
      {
        id: "R2",
        eventDay: 2,
        type: "REVERSAL",
        accountId: "ACC-001",
        currency: "AED",
        reversalTargetId: "D",
        valueDate: 1,
      },
    ]);

    expect(
      reversals.outcomes
        .filter((outcome) => outcome.status === "REJECTED")
        .map((outcome) => outcome.rejection.code),
    ).toEqual([
      LedgerErrorCode.reversalTargetNotFound,
      LedgerErrorCode.duplicateReversal,
    ]);
  });
});
