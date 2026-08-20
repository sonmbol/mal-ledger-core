import type { LedgerEvent } from "../domain/events.js";
import { Money } from "../domain/money.js";
import type { AccountDefinition } from "../domain/types.js";

// Typed fixtures keep discriminated-union checking without adding a runtime
// JSON validation layer that provides little value for ten trusted events.
export const accounts = [
  {
    id: "ACC-001",
    currency: "AED",
    openingBalance: Money.zero("AED"),
  },
  {
    id: "ACC-002",
    currency: "BHD",
    openingBalance: Money.zero("BHD"),
  },
] as const satisfies readonly AccountDefinition[];

export const sampleEvents = [
  {
    id: "E1",
    eventDay: 1,
    type: "CREDIT",
    accountId: "ACC-001",
    currency: "AED",
    amount: "1200.00",
    valueDate: 1,
  },
  {
    id: "E2",
    eventDay: 1,
    type: "DEBIT",
    accountId: "ACC-001",
    currency: "AED",
    amount: "950.00",
    valueDate: 1,
  },
  {
    id: "E3",
    eventDay: 2,
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Auth-A",
    amount: "200.00",
    valueDate: 2,
  },
  {
    id: "E4",
    eventDay: 3,
    type: "CREDIT",
    accountId: "ACC-001",
    currency: "AED",
    amount: "400.00",
    valueDate: 3,
  },
  {
    id: "E5",
    eventDay: 4,
    type: "SETTLEMENT",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Auth-A",
    amount: "185.00",
    valueDate: 4,
  },
  {
    id: "E6",
    eventDay: 4,
    type: "SETTLEMENT",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Auth-Z",
    amount: "180.00",
    valueDate: 4,
  },
  {
    id: "E7",
    eventDay: 5,
    type: "DEBIT",
    accountId: "ACC-001",
    currency: "AED",
    amount: "620.00",
    valueDate: 2,
  },
  {
    id: "E8",
    eventDay: 5,
    type: "AUTHORIZATION",
    accountId: "ACC-001",
    currency: "AED",
    authorizationId: "Auth-B",
    amount: "90.00",
    valueDate: 5,
  },
  {
    id: "E9",
    eventDay: 6,
    type: "REVERSAL",
    accountId: "ACC-001",
    currency: "AED",
    reversalTargetId: "E7",
    valueDate: 2,
  },
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
