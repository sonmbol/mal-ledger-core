import {
  LedgerErrorCode,
  type LedgerErrorCode as LedgerErrorCodeName,
  type LedgerRejection,
} from "../domain/errors.js";
import type {
  AuthorizationEvent,
  CreditEvent,
  DebitEvent,
  EventId,
  LedgerEvent,
  ReversalEvent,
  SettlementEvent,
} from "../domain/events.js";
import { Money } from "../domain/money.js";
import type {
  AccountDefinition,
  AuthorizationState,
  InstallmentAllocation,
  LedgerEntry,
  LedgerEntryKind,
} from "../domain/types.js";
import { calculateAvailableBalance } from "./balanceCalculator.js";
import { allocateInstallments } from "./installmentAllocator.js";

/** Read-only ledger snapshot used to decide one event (no mutation). */
export interface DecisionContext {
  readonly entries: readonly LedgerEntry[];
  readonly authorizations: ReadonlyMap<string, AuthorizationState>;
  readonly acceptedEvents: ReadonlyMap<EventId, LedgerEvent>;
  readonly reversedEventIds: ReadonlySet<EventId>;
}

/**
 * Pure decision for one event.
 * At most one ledger posting (`entry`). Holds set `authorization` with no entry.
 * Fees are added later at commit time for debits.
 */
export type EventDecision =
  | {
      readonly accepted: true;
      readonly entry?: LedgerEntry;
      readonly authorization?: AuthorizationState;
      readonly installment?: InstallmentAllocation;
      readonly reversedTargetId?: EventId;
      readonly message: string;
    }
  | {
      readonly accepted: false;
      readonly rejection: LedgerRejection;
    };

/** Decide without mutating replay state. Replay alone commits. */
export function decideEvent(
  event: LedgerEvent,
  account: AccountDefinition,
  state: DecisionContext,
): EventDecision {
  switch (event.type) {
    case "CREDIT":
    case "DEBIT":
      return decidePosting(event);
    case "AUTHORIZATION":
      return decideAuthorization(event, account, state);
    case "SETTLEMENT":
      return decideSettlement(event, state);
    case "REVERSAL":
      return decideReversal(event, state);
  }
}

function decidePosting(event: CreditEvent | DebitEvent): EventDecision {
  const amount = parsePositiveAmount(event);

  if (amount instanceof Error) {
    return reject(event, LedgerErrorCode.invalidAmount, amount.message);
  }

  let installment: InstallmentAllocation | undefined;

  if (event.type === "CREDIT" && event.installments !== undefined) {
    try {
      installment = {
        sourceEventId: event.id,
        amounts: allocateInstallments(amount, event.installments),
      };
    } catch (error) {
      return reject(
        event,
        LedgerErrorCode.invalidInstallmentCount,
        errorMessage(error),
      );
    }
  }

  const signed = event.type === "CREDIT" ? amount : amount.negate();

  return {
    accepted: true,
    entry: posting(event, signed, event.type),
    ...(installment === undefined ? {} : { installment }),
    message: `${event.type.toLowerCase()} ${event.currency} ${amount.format()} posted on Day ${event.valueDate}`,
  };
}

function decideAuthorization(
  event: AuthorizationEvent,
  account: AccountDefinition,
  state: DecisionContext,
): EventDecision {
  if (state.authorizations.has(event.authorizationId)) {
    return reject(
      event,
      LedgerErrorCode.duplicateAuthorization,
      `authorization ${event.authorizationId} already exists`,
    );
  }

  const amount = parsePositiveAmount(event);

  if (amount instanceof Error) {
    return reject(event, LedgerErrorCode.invalidAmount, amount.message);
  }

  const availableAfter = calculateAvailableBalance(
    account,
    state.entries,
    state.authorizations,
  ).subtract(amount);

  if (availableAfter.minor < 0n) {
    return reject(
      event,
      LedgerErrorCode.insufficientAvailableBalance,
      "insufficient available balance",
      { availableAfter: availableAfter.format() },
    );
  }

  return {
    accepted: true,
    authorization: {
      id: event.authorizationId,
      accountId: event.accountId,
      held: amount,
      state: "OPEN",
    },
    message: `hold ${event.currency} ${amount.format()} approved; available ${event.currency} ${availableAfter.format()}`,
  };
}

function decideSettlement(
  event: SettlementEvent,
  state: DecisionContext,
): EventDecision {
  const authorization = state.authorizations.get(event.authorizationId);

  if (authorization === undefined) {
    return reject(
      event,
      LedgerErrorCode.authorizationNotFound,
      `authorization ${event.authorizationId} not found`,
    );
  }

  if (
    authorization.accountId !== event.accountId ||
    authorization.state !== "OPEN"
  ) {
    return reject(
      event,
      LedgerErrorCode.authorizationNotOpen,
      "authorization is not open for this account",
    );
  }

  const amount = parsePositiveAmount(event);

  if (amount instanceof Error) {
    return reject(event, LedgerErrorCode.invalidAmount, amount.message);
  }

  if (amount.compare(authorization.held) > 0) {
    return reject(
      event,
      LedgerErrorCode.settlementExceedsHold,
      "settlement exceeds open hold",
    );
  }

  const released = authorization.held.subtract(amount);

  return {
    accepted: true,
    entry: posting(event, amount.negate(), "SETTLEMENT"),
    authorization: {
      ...authorization,
      state: "SETTLED",
      settled: amount,
      released,
    },
    message: `settled ${event.currency} ${amount.format()}; released ${event.currency} ${released.format()}`,
  };
}

function decideReversal(
  event: ReversalEvent,
  state: DecisionContext,
): EventDecision {
  const target = state.acceptedEvents.get(event.reversalTargetId);

  if (
    target === undefined ||
    (target.type !== "CREDIT" && target.type !== "DEBIT")
  ) {
    return reject(
      event,
      LedgerErrorCode.reversalTargetNotFound,
      "reversal target is missing or not reversible",
    );
  }

  if (target.accountId !== event.accountId) {
    return reject(
      event,
      LedgerErrorCode.reversalTargetAccountMismatch,
      "reversal target belongs to another account",
    );
  }

  if (state.reversedEventIds.has(target.id)) {
    return reject(
      event,
      LedgerErrorCode.duplicateReversal,
      "target already reversed",
    );
  }

  const original = state.entries.find(
    (item) =>
      item.sourceEventId === target.id &&
      (item.kind === "CREDIT" || item.kind === "DEBIT"),
  );

  if (original === undefined) {
    return reject(
      event,
      LedgerErrorCode.reversalTargetNotFound,
      "reversible ledger entry not found",
    );
  }

  return {
    accepted: true,
    entry: posting(event, original.amount.negate(), "REVERSAL"),
    reversedTargetId: target.id,
    message: `reversed ${target.id} on Day ${event.valueDate}`,
  };
}

function posting(
  event: LedgerEvent,
  amount: Money,
  kind: LedgerEntryKind,
): LedgerEntry {
  return {
    id: event.id,
    sourceEventId: event.id,
    receivedDay: event.eventDay,
    accountId: event.accountId,
    valueDate: event.valueDate,
    amount,
    kind,
  };
}

function parsePositiveAmount(event: LedgerEvent): Money | Error {
  if (!("amount" in event)) {
    return new Error("event has no monetary amount");
  }

  try {
    const amount = Money.parse(event.currency, event.amount);

    return amount.minor > 0n
      ? amount
      : new Error("amount must be strictly positive");
  } catch (error) {
    return new Error(errorMessage(error));
  }
}

function reject(
  event: LedgerEvent,
  code: LedgerErrorCodeName,
  message: string,
  details?: Readonly<Record<string, string>>,
): EventDecision {
  return {
    accepted: false,
    rejection: {
      eventId: event.id,
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "invalid event";
}
