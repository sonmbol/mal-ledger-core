import { Money } from "../domain/money.js";
import type { LedgerDay } from "../domain/events.js";
import type { AccountView, ReplayResult } from "../domain/types.js";

/** Formats a completed replay without recalculating any financial result. */
export function buildReport(result: ReplayResult): string {
  const { numerator, denominator } = result.policy.interest.rate;
  const lines = [
    "IN-MEMORY LEDGER REPLAY",
    "Fees: once per negative closing day from a debit's value date through receipt (fees excluded from eligibility).",
    `Interest: final-restated positive closings, ${numerator}/${denominator}, half-away-from-zero.`,
  ];

  appendEventOutcomes(lines, result);
  appendDerivedFees(lines, result);
  appendAuthorizations(lines, result);
  appendAccountReports(lines, result);
  appendInstallments(lines, result);
  appendRejections(lines, result);

  return `${lines.join("\n")}\n`;
}

function appendEventOutcomes(lines: string[], result: ReplayResult): void {
  lines.push("", "EVENTS (supplied order)");

  for (const outcome of result.outcomes) {
    const code =
      outcome.status === "REJECTED" ? ` [${outcome.rejection.code}]` : "";

    lines.push(
      `${outcome.event.id} Day ${outcome.event.eventDay} ${outcome.event.type}: ${outcome.status}${code} — ${outcome.message}`,
    );
  }
}

function appendDerivedFees(lines: string[], result: ReplayResult): void {
  lines.push("", "DERIVED FEES");

  for (const fee of result.fees) {
    lines.push(
      `${fee.id}: ${fee.amount.currency} ${fee.amount.negate().format()} on Day ${fee.valueDate}; source ${fee.sourceEventId} (retained after reversal)`,
    );
  }
}

function appendAuthorizations(lines: string[], result: ReplayResult): void {
  lines.push("", "AUTHORIZATIONS");

  if (result.authorizations.length === 0) {
    lines.push("none");
    return;
  }

  for (const authorization of result.authorizations) {
    const release =
      authorization.released === undefined
        ? ""
        : `; released ${authorization.released.currency} ${authorization.released.format()}`;

    lines.push(
      `${authorization.id}: ${authorization.state}; held ${authorization.held.currency} ${authorization.held.format()}${release}`,
    );
  }
}

function appendAccountReports(lines: string[], result: ReplayResult): void {
  for (const account of result.accounts) {
    appendOneAccount(lines, result, account);
  }
}

function appendOneAccount(
  lines: string[],
  result: ReplayResult,
  account: AccountView,
): void {
  const { accountId } = account;

  lines.push("", `${accountId} AS-OBSERVED CLOSINGS`);
  appendDailyBalances(lines, account.observed);
  lines.push(`${accountId} FINAL-RESTATED CLOSINGS (before interest)`);
  appendDailyBalances(lines, account.restatedBeforeInterest);
  lines.push(`${accountId} DAILY INTEREST`);

  for (const day of result.policy.assessmentDays) {
    const allocation = account.interest.find((item) => item.day === day);
    const amount =
      allocation?.amount ?? Money.zero(account.finalPosted.currency);

    lines.push(`Day ${day}: ${amount.currency} ${amount.format()}`);
  }

  lines.push(
    `Day ${result.policy.interest.capitalizationDay} capitalized interest: ${account.capitalizedInterest.currency} ${account.capitalizedInterest.format()}`,
    `Final posted: ${account.finalPosted.currency} ${account.finalPosted.format()}`,
    `Final available: ${account.finalAvailable.currency} ${account.finalAvailable.format()}`,
  );
}

function appendDailyBalances(
  lines: string[],
  balances: readonly {
    readonly day: LedgerDay;
    readonly balance: Money;
  }[],
): void {
  for (const { day, balance } of balances) {
    lines.push(`Day ${day}: ${balance.currency} ${balance.format()}`);
  }
}

function appendInstallments(lines: string[], result: ReplayResult): void {
  lines.push("", "INSTALLMENTS");

  for (const allocation of result.installments) {
    const formatted = allocation.amounts
      .map((amount) => `${amount.currency} ${amount.format()}`)
      .join(" / ");

    lines.push(`${allocation.sourceEventId}: ${formatted}`);
  }
}

function appendRejections(lines: string[], result: ReplayResult): void {
  lines.push("", "ERRORS");

  for (const outcome of result.outcomes) {
    if (outcome.status === "REJECTED") {
      lines.push(
        `${outcome.event.id} [${outcome.rejection.code}]: ${outcome.message}`,
      );
    }
  }
}
