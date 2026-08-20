import type { Currency } from "./currency.js";

export type LedgerDay = number;
export type AccountId = string;
export type EventId = string;
export type AuthorizationId = string;

interface BaseLedgerEvent {
  readonly id: EventId;
  readonly eventDay: LedgerDay;
  readonly accountId: AccountId;
  readonly valueDate: LedgerDay;
  readonly currency: Currency;
}

export interface CreditEvent extends BaseLedgerEvent {
  readonly type: "CREDIT";
  readonly amount: string;
  readonly installments?: number;
}

export interface DebitEvent extends BaseLedgerEvent {
  readonly type: "DEBIT";
  readonly amount: string;
}

export interface AuthorizationEvent extends BaseLedgerEvent {
  readonly type: "AUTHORIZATION";
  readonly authorizationId: AuthorizationId;
  readonly amount: string;
}

export interface SettlementEvent extends BaseLedgerEvent {
  readonly type: "SETTLEMENT";
  readonly authorizationId: AuthorizationId;
  readonly amount: string;
}

export interface ReversalEvent extends BaseLedgerEvent {
  readonly type: "REVERSAL";
  readonly reversalTargetId: EventId;
}

export type LedgerEvent =
  | CreditEvent
  | DebitEvent
  | AuthorizationEvent
  | SettlementEvent
  | ReversalEvent;
