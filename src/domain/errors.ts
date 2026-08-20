import type { EventId } from "./events.js";

export const LedgerErrorCode = {
  unknownAccount: "UNKNOWN_ACCOUNT",
  duplicateEvent: "DUPLICATE_EVENT",
  currencyMismatch: "CURRENCY_MISMATCH",
  invalidAmount: "INVALID_AMOUNT",
  invalidInstallmentCount: "INVALID_INSTALLMENT_COUNT",
  duplicateAuthorization: "DUPLICATE_AUTHORIZATION",
  insufficientAvailableBalance: "INSUFFICIENT_AVAILABLE_BALANCE",
  authorizationNotFound: "AUTHORIZATION_NOT_FOUND",
  authorizationNotOpen: "AUTHORIZATION_NOT_OPEN",
  settlementExceedsHold: "SETTLEMENT_EXCEEDS_HOLD",
  reversalTargetNotFound: "REVERSAL_TARGET_NOT_FOUND",
  reversalTargetAccountMismatch: "REVERSAL_TARGET_ACCOUNT_MISMATCH",
  duplicateReversal: "DUPLICATE_REVERSAL",
} as const;

export type LedgerErrorCode =
  (typeof LedgerErrorCode)[keyof typeof LedgerErrorCode];

export interface LedgerRejection {
  readonly eventId: EventId;
  readonly code: LedgerErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
}
