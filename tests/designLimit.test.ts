import { describe, expect, it } from "vitest";

import { accounts } from "../src/data/sampleEvents.js";
import type { LedgerEvent } from "../src/domain/events.js";
import { accountView } from "../src/domain/types.js";
import { replay } from "../src/engine/replayEngine.js";

/**
 * Assessment artifact: one failing test against our own design.
 *
 * Vitest `it.fails` keeps the suite green while the assertion below still
 * fails — documenting a deliberate trade-off, not a bug.
 */
describe("design limit (assessment-required failing test)", () => {
  it.fails(
    "installments do not phase available balance — only the first slice would be spendable in a hold-gated model",
    () => {
      const events = [
        {
          id: "E10",
          eventDay: 5,
          type: "CREDIT",
          accountId: "ACC-002",
          currency: "BHD",
          amount: "10.000",
          installments: 3,
          valueDate: 5,
        },
      ] as const satisfies readonly LedgerEvent[];

      const result = replay({ accounts, events });
      const view = accountView(result, "ACC-002");
      const firstInstallment = result.installments[0]?.amounts[0];

      // REVEALS: we treat installments as a conservation schedule on an already-posted
      // credit, not as phased releases. Holds already cover spendable gating; adding a
      // second hold mechanism for installments would duplicate authorization semantics and
      // would require installment-settlement events the brief never supplies.
      //
      // A production loan-tranche product might expect available == first slice only until
      // each tranche settles. Our engine posts one CREDIT row for the full BHD 10.000, so
      // available equals posted immediately (no OPEN holds on ACC-002 here).
      expect(view.finalAvailable.format()).toBe(firstInstallment?.format());
    },
  );
});
