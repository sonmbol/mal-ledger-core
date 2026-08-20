import { overdraftFeeMinorOf } from "../domain/currency.js";
import type { DebitEvent, LedgerDay } from "../domain/events.js";
import { Money } from "../domain/money.js";
import type { ReplayPolicy } from "../domain/policy.js";
import type { AccountDefinition, LedgerEntry } from "../domain/types.js";
import { calculateBalanceAtDay } from "./balanceCalculator.js";

export interface FeeAssessment {
  readonly entries: readonly LedgerEntry[];
  readonly audit: readonly string[];
}

/**
 * Debits only. For each day from value date through receipt, a negative close
 * (fees excluded from eligibility) gets at most one currency fee on that day.
 */
export function assessOverdraftFees(
  event: DebitEvent,
  account: AccountDefinition,
  entriesIncludingDebit: readonly LedgerEntry[],
  policy: ReplayPolicy,
): FeeAssessment {
  const throughDay = Math.max(event.eventDay, event.valueDate);
  const window = policy.assessmentDays.filter(
    (day) => day >= event.valueDate && day <= throughDay,
  );

  const withoutFees = entriesIncludingDebit.filter(
    (entry) => entry.kind !== "OVERDRAFT_FEE",
  );
  const chargeDays = window.filter(
    (day) =>
      calculateBalanceAtDay(account, withoutFees, day).minor < 0n &&
      !alreadyCharged(entriesIncludingDebit, account.id, day),
  );

  if (chargeDays.length === 0) {
    return { entries: [], audit: [] };
  }

  const feeMinor = overdraftFeeMinorOf(account.currency);

  if (feeMinor === undefined) {
    return {
      entries: [],
      audit: chargeDays.map(
        (day) =>
          `${account.id} Day ${day}: negative close; no ${account.currency} overdraft fee configured`,
      ),
    };
  }

  const fee = Money.fromMinor(account.currency, feeMinor);
  const entries = chargeDays.map((day) => feeEntry(event, fee, day));

  return {
    entries,
    audit: entries.map(
      (entry) =>
        `${entry.id} DERIVED: ${entry.amount.currency} ${entry.amount.negate().format()} for negative Day ${entry.valueDate} close; source ${event.id}`,
    ),
  };
}

function alreadyCharged(
  entries: readonly LedgerEntry[],
  accountId: string,
  day: LedgerDay,
): boolean {
  return entries.some(
    (entry) =>
      entry.kind === "OVERDRAFT_FEE" &&
      entry.accountId === accountId &&
      entry.valueDate === day,
  );
}

function feeEntry(event: DebitEvent, fee: Money, day: LedgerDay): LedgerEntry {
  return {
    id: `${event.id}:OVERDRAFT_FEE:D${day}`,
    sourceEventId: event.id,
    receivedDay: event.eventDay,
    accountId: event.accountId,
    valueDate: day,
    amount: fee.negate(),
    kind: "OVERDRAFT_FEE",
  };
}
