import type { AccountId, LedgerDay } from "../domain/events.js";
import { Money } from "../domain/money.js";
import type {
  AccountDefinition,
  AuthorizationState,
  LedgerEntry,
} from "../domain/types.js";

/** Posted balance is always derived from the opening balance and ledger. */
export function calculatePostedBalance(
  account: AccountDefinition,
  entries: readonly LedgerEntry[],
): Money {
  return entries
    .filter((entry) => entry.accountId === account.id)
    .reduce(
      (balance, entry) => balance.add(entry.amount),
      account.openingBalance,
    );
}

/** Holds reserve spending power but never alter the posted ledger balance. */
export function calculateHeldAmount(
  accountId: AccountId,
  currency: AccountDefinition["currency"],
  authorizations: ReadonlyMap<string, AuthorizationState>,
): Money {
  return [...authorizations.values()]
    .filter(
      (authorization) =>
        authorization.accountId === accountId && authorization.state === "OPEN",
    )
    .reduce(
      (held, authorization) => held.add(authorization.held),
      Money.zero(currency),
    );
}

export function calculateAvailableBalance(
  account: AccountDefinition,
  entries: readonly LedgerEntry[],
  authorizations: ReadonlyMap<string, AuthorizationState>,
): Money {
  return calculatePostedBalance(account, entries).subtract(
    calculateHeldAmount(account.id, account.currency, authorizations),
  );
}

/**
 * Value date, not receipt order, determines the final-restated accounting day.
 * Interest entries are excluded because the caller calculates pre-capitalization
 * daily interest and appends one capitalization entry afterward.
 */
export function calculateBalanceAtDay(
  account: AccountDefinition,
  entries: readonly LedgerEntry[],
  day: LedgerDay,
): Money {
  return entries
    .filter(
      (entry) =>
        entry.accountId === account.id &&
        entry.valueDate <= day &&
        entry.kind !== "INTEREST",
    )
    .reduce(
      (balance, entry) => balance.add(entry.amount),
      account.openingBalance,
    );
}
