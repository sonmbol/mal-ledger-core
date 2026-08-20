import { LedgerErrorCode, type LedgerRejection } from "../domain/errors.js";
import type { AccountId, LedgerEvent } from "../domain/events.js";
import { Money } from "../domain/money.js";
import { assessmentReplayPolicy, type ReplayPolicy } from "../domain/policy.js";
import type {
  AccountDefinition,
  AccountView,
  AuthorizationState,
  DailyBalance,
  EventOutcome,
  InstallmentAllocation,
  LedgerEntry,
  ReplayResult,
} from "../domain/types.js";
import {
  calculateAvailableBalance,
  calculateBalanceAtDay,
  calculatePostedBalance,
} from "./balanceCalculator.js";
import { decideEvent, type EventDecision } from "./eventProcessor.js";
import { assessOverdraftFees } from "./feeAssessor.js";
import { calculateInterest } from "./interestCalculator.js";

export interface ReplayInput {
  readonly accounts: readonly AccountDefinition[];
  readonly events: readonly LedgerEvent[];
}

interface MutableReplayState {
  readonly entries: LedgerEntry[];
  readonly outcomes: EventOutcome[];
  readonly audit: string[];
  readonly authorizations: Map<string, AuthorizationState>;
  readonly acceptedEvents: Map<string, LedgerEvent>;
  readonly reversedEventIds: Set<string>;
  readonly installments: InstallmentAllocation[];
  readonly receivedEventIds: Set<string>;
}

/**
 * Replays events in receipt order.
 *
 * Story: validate → decide (pure) → commit once → derive AccountView[].
 */
export function replay(input: ReplayInput): ReplayResult {
  const policy = assessmentReplayPolicy;
  const accountsById = new Map(
    input.accounts.map((account) => [account.id, account]),
  );
  const state = createState();

  for (const event of input.events) {
    applyEvent(event, accountsById, policy, state);
  }

  const accounts = buildAccountViews(input.accounts, policy, state);

  return {
    policy,
    outcomes: [...state.outcomes],
    ledgerEntries: [...state.entries],
    fees: state.entries.filter((entry) => entry.kind === "OVERDRAFT_FEE"),
    authorizations: [...state.authorizations.values()],
    installments: [...state.installments],
    accounts,
    audit: [...state.audit],
  };
}

function applyEvent(
  event: LedgerEvent,
  accountsById: ReadonlyMap<AccountId, AccountDefinition>,
  policy: ReplayPolicy,
  state: MutableReplayState,
): void {
  const gate = validateReceipt(event, accountsById, state);

  if (!gate.ok) {
    recordRejection(event, gate.rejection, state);
    return;
  }

  const decision = decideEvent(event, gate.account, {
    entries: state.entries,
    authorizations: state.authorizations,
    acceptedEvents: state.acceptedEvents,
    reversedEventIds: state.reversedEventIds,
  });

  if (!decision.accepted) {
    recordRejection(event, decision.rejection, state);
    return;
  }

  commitAccepted(event, gate.account, decision, policy, state);
}

function validateReceipt(
  event: LedgerEvent,
  accountsById: ReadonlyMap<AccountId, AccountDefinition>,
  state: MutableReplayState,
):
  | { readonly ok: true; readonly account: AccountDefinition }
  | { readonly ok: false; readonly rejection: LedgerRejection } {
  if (state.receivedEventIds.has(event.id)) {
    return {
      ok: false,
      rejection: {
        eventId: event.id,
        code: LedgerErrorCode.duplicateEvent,
        message: "duplicate event ID",
      },
    };
  }

  state.receivedEventIds.add(event.id);

  const account = accountsById.get(event.accountId);

  if (account === undefined) {
    return {
      ok: false,
      rejection: {
        eventId: event.id,
        code: LedgerErrorCode.unknownAccount,
        message: "unknown account",
      },
    };
  }

  if (event.currency !== account.currency) {
    return {
      ok: false,
      rejection: {
        eventId: event.id,
        code: LedgerErrorCode.currencyMismatch,
        message: `currency mismatch: account is ${account.currency}`,
        details: { accountCurrency: account.currency },
      },
    };
  }

  return { ok: true, account };
}

function commitAccepted(
  event: LedgerEvent,
  account: AccountDefinition,
  decision: Extract<EventDecision, { accepted: true }>,
  policy: ReplayPolicy,
  state: MutableReplayState,
): void {
  const toCommit: LedgerEntry[] = [];

  if (decision.entry !== undefined) {
    toCommit.push(decision.entry);
  }

  const feeAudit: string[] = [];

  if (event.type === "DEBIT") {
    const fees = assessOverdraftFees(
      event,
      account,
      [...state.entries, ...toCommit],
      policy,
    );
    toCommit.push(...fees.entries);
    feeAudit.push(...fees.audit);
  }

  state.entries.push(...toCommit);

  if (decision.authorization !== undefined) {
    state.authorizations.set(decision.authorization.id, decision.authorization);
  }

  if (decision.installment !== undefined) {
    state.installments.push(decision.installment);
  }

  if (decision.reversedTargetId !== undefined) {
    state.reversedEventIds.add(decision.reversedTargetId);
  }

  state.acceptedEvents.set(event.id, event);
  state.outcomes.push({ event, status: "ACCEPTED", message: decision.message });
  state.audit.push(`${event.id} ACCEPTED: ${decision.message}`, ...feeAudit);
}

function recordRejection(
  event: LedgerEvent,
  rejection: LedgerRejection,
  state: MutableReplayState,
): void {
  state.outcomes.push({
    event,
    status: "REJECTED",
    rejection,
    message: rejection.message,
  });
  state.audit.push(
    `${event.id} REJECTED [${rejection.code}]: ${rejection.message}`,
  );
}

/** Restated closes → daily interest → capitalize → finals (one pass per account). */
function buildAccountViews(
  accounts: readonly AccountDefinition[],
  policy: ReplayPolicy,
  state: MutableReplayState,
): AccountView[] {
  const views: AccountView[] = [];

  for (const account of accounts) {
    const restatedBeforeInterest = dailyCloses(
      account,
      state.entries,
      policy,
      "restated",
    );
    const interest = calculateInterest(
      restatedBeforeInterest,
      policy.interest.rate,
    );

    appendCapitalizedInterest(account, interest, policy, state.entries);

    views.push({
      accountId: account.id,
      observed: dailyCloses(account, state.entries, policy, "observed"),
      restatedBeforeInterest,
      interest,
      capitalizedInterest: sumMoney(account.currency, interest),
      finalPosted: calculatePostedBalance(account, state.entries),
      finalAvailable: calculateAvailableBalance(
        account,
        state.entries,
        state.authorizations,
      ),
    });
  }

  return views;
}

function dailyCloses(
  account: AccountDefinition,
  entries: readonly LedgerEntry[],
  policy: ReplayPolicy,
  mode: "observed" | "restated",
): readonly DailyBalance[] {
  return policy.assessmentDays.map((day) => {
    const visible =
      mode === "observed"
        ? entries.filter((entry) => entry.receivedDay <= day)
        : entries;

    return {
      day,
      balance: calculateBalanceAtDay(account, visible, day),
    };
  });
}

function appendCapitalizedInterest(
  account: AccountDefinition,
  interest: readonly { readonly amount: Money }[],
  policy: ReplayPolicy,
  entries: LedgerEntry[],
): void {
  const total = sumMoney(account.currency, interest);

  if (total.minor === 0n) {
    return;
  }

  const day = policy.interest.capitalizationDay;
  const id = `${account.id}:INTEREST:D${day}`;

  entries.push({
    id,
    sourceEventId: id,
    receivedDay: day,
    accountId: account.id,
    valueDate: day,
    amount: total,
    kind: "INTEREST",
  });
}

function sumMoney(
  currency: AccountDefinition["currency"],
  items: readonly { readonly amount: Money }[],
): Money {
  return items.reduce(
    (sum, item) => sum.add(item.amount),
    Money.zero(currency),
  );
}

function createState(): MutableReplayState {
  return {
    entries: [],
    outcomes: [],
    audit: [],
    authorizations: new Map(),
    acceptedEvents: new Map(),
    reversedEventIds: new Set(),
    installments: [],
    receivedEventIds: new Set(),
  };
}
