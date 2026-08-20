import type { Currency } from "./currency.js";
import type { LedgerRejection } from "./errors.js";
import type {
  AccountId,
  AuthorizationId,
  EventId,
  LedgerDay,
  LedgerEvent,
} from "./events.js";
import type { Money } from "./money.js";
import type { ReplayPolicy } from "./policy.js";

export interface AccountDefinition {
  readonly id: AccountId;
  readonly currency: Currency;
  readonly openingBalance: Money;
}

export type LedgerEntryKind =
  "CREDIT" | "DEBIT" | "SETTLEMENT" | "REVERSAL" | "OVERDRAFT_FEE" | "INTEREST";

/** One posted money row in the append-only ledger (not an input event). */
export interface LedgerEntry {
  readonly id: string;
  readonly sourceEventId: EventId;
  readonly receivedDay: LedgerDay;
  readonly accountId: AccountId;
  readonly valueDate: LedgerDay;
  readonly amount: Money;
  readonly kind: LedgerEntryKind;
}

export interface AuthorizationState {
  readonly id: AuthorizationId;
  readonly accountId: AccountId;
  readonly held: Money;
  readonly state: "OPEN" | "SETTLED";
  readonly settled?: Money;
  readonly released?: Money;
}

/** One result per received event — the stream outcome side of the model. */
export type EventOutcome =
  | {
      readonly event: LedgerEvent;
      readonly status: "ACCEPTED";
      readonly message: string;
    }
  | {
      readonly event: LedgerEvent;
      readonly status: "REJECTED";
      readonly rejection: LedgerRejection;
      readonly message: string;
    };

export interface DailyBalance {
  readonly day: LedgerDay;
  readonly balance: Money;
}

export interface InterestAllocation {
  readonly day: LedgerDay;
  readonly amount: Money;
}

export interface InstallmentAllocation {
  readonly sourceEventId: EventId;
  readonly amounts: readonly Money[];
}

/**
 * Everything derived for one account after replay.
 * Joins daily closes, interest, and finals so callers do not reassemble Maps.
 */
export interface AccountView {
  readonly accountId: AccountId;
  readonly observed: readonly DailyBalance[];
  readonly restatedBeforeInterest: readonly DailyBalance[];
  readonly interest: readonly InterestAllocation[];
  readonly capitalizedInterest: Money;
  readonly finalPosted: Money;
  readonly finalAvailable: Money;
}

/**
 * Full replay result.
 *
 * Mental model:
 *   events (input) → outcomes (one each) + ledgerEntries (append-only money)
 *                 → accounts[] (derived views per account)
 */
export interface ReplayResult {
  readonly policy: ReplayPolicy;
  readonly outcomes: readonly EventOutcome[];
  readonly ledgerEntries: readonly LedgerEntry[];
  /** Convenience filter of OVERDRAFT_FEE rows (also present in ledgerEntries). */
  readonly fees: readonly LedgerEntry[];
  readonly authorizations: readonly AuthorizationState[];
  readonly installments: readonly InstallmentAllocation[];
  readonly accounts: readonly AccountView[];
  readonly audit: readonly string[];
}

/** Lookup helper for tests and report formatting. */
export function accountView(
  result: ReplayResult,
  accountId: AccountId,
): AccountView {
  const view = result.accounts.find(
    (account) => account.accountId === accountId,
  );

  if (view === undefined) {
    throw new Error(`Missing account view for ${accountId}`);
  }

  return view;
}
