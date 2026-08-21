import { describe, expect, it } from "vitest";

import {
  alternateAccounts,
  alternateEvents,
  alternateExpected,
} from "./alternateScenario.fixture.js";
import { LedgerErrorCode } from "../src/domain/errors.js";
import { accountView } from "../src/domain/types.js";
import { replay } from "../src/engine/replayEngine.js";

describe("alternate scenario (second event stream)", () => {
  const result = replay({
    accounts: alternateAccounts,
    events: alternateEvents,
  });

  it("matches the documented accept/reject sequence", () => {
    expect(
      result.outcomes.map(({ event, status }) => [event.id, status]),
    ).toEqual(alternateExpected.outcomes);
  });

  it("rejects ALT3 / ALT8 / ALT10 with the suspected codes and no Hold-Y", () => {
    for (const [id, code] of Object.entries(alternateExpected.rejectionCodes)) {
      const outcome = result.outcomes.find(({ event }) => event.id === id);
      expect(outcome?.status).toBe("REJECTED");
      if (outcome?.status === "REJECTED") {
        expect(outcome.rejection.code).toBe(code);
      }
    }
    expect(result.authorizations.some(({ id }) => id === "Hold-Y")).toBe(
      alternateExpected.holdYCreated,
    );
  });

  it("settles Hold-X and leaves ALT5 fees after ALT7 reverse", () => {
    const holdX = result.authorizations.find(({ id }) => id === "Hold-X");
    expect(holdX).toMatchObject({ state: alternateExpected.holdX.state });
    expect(holdX?.settled?.format()).toBe(alternateExpected.holdX.settled);
    expect(holdX?.released?.format()).toBe(alternateExpected.holdX.released);

    const alt5Fees = result.fees.filter((fee) => fee.sourceEventId === "ALT5");
    expect(alt5Fees.map(({ valueDate }) => valueDate)).toEqual(
      alternateExpected.alt5FeeDays,
    );
    expect(result.fees).toHaveLength(alternateExpected.totalFeeCount);
    expect(
      result.ledgerEntries
        .find(
          (entry) =>
            entry.sourceEventId === "ALT7" && entry.kind === "REVERSAL",
        )
        ?.amount.format(),
    ).toBe("400.00");
  });

  it("splits BHD installments and locks observed/restated/interest/finals", () => {
    expect(
      result.installments[0]?.amounts.map((amount) => amount.format()),
    ).toEqual(alternateExpected.installments);

    const acc001 = accountView(result, "ACC-001");
    expect(acc001.observed.map(({ balance }) => balance.format())).toEqual(
      alternateExpected.observedAcc001,
    );
    expect(
      acc001.restatedBeforeInterest.map(({ balance }) => balance.format()),
    ).toEqual(alternateExpected.restatedAcc001);
    expect(acc001.interest.map(({ amount }) => amount.format())).toEqual(
      alternateExpected.interestAcc001,
    );

    expect(acc001.finalPosted.format()).toBe(
      alternateExpected.finals["ACC-001"].posted,
    );
    expect(acc001.finalAvailable.format()).toBe(
      alternateExpected.finals["ACC-001"].available,
    );
    expect(accountView(result, "ACC-002").finalPosted.format()).toBe(
      alternateExpected.finals["ACC-002"].posted,
    );
  });

  it("uses LedgerErrorCode constants for the three rejects", () => {
    expect(LedgerErrorCode.duplicateAuthorization).toBe(
      alternateExpected.rejectionCodes.ALT3,
    );
    expect(LedgerErrorCode.insufficientAvailableBalance).toBe(
      alternateExpected.rejectionCodes.ALT8,
    );
    expect(LedgerErrorCode.reversalTargetNotFound).toBe(
      alternateExpected.rejectionCodes.ALT10,
    );
  });
});
