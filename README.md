# In-Memory Account Ledger Core

Public repository: https://github.com/sonmbol/mal-ledger-core

Deterministic in-memory ledger for a fixed assessment window: exact money, value-dated replay, authorizations, settlements, reversals, overdraft fees, installments, and daily interest. No HTTP, database, UI, or queue.

## Run

Requires Node.js 20.19+ (`nvm use` reads `.nvmrc`).

```sh
npm install
npm test
npm run replay
npm run check   # format, lint, typecheck, tests
```

Replay prints events in receipt order, derived fees, authorizations, as-observed and final-restated closings, interest, finals, installments, and rejections.

## Theory (short)

Balances are a **fold** over an **append-only** money log. Inputs are events; money moves only through ledger entries. Holds reduce **available**, not posted. Two clocks: **event day** (when learned) and **value date** (accounting day).

## Structure

| Layer     | Location                                        | Role                                  |
| --------- | ----------------------------------------------- | ------------------------------------- |
| Entry     | `src/index.ts`                                  | `replay` → `buildReport`              |
| Fixture   | `src/data/sampleEvents.ts`                      | Accounts + E1–E10                     |
| Domain    | `src/domain/*`                                  | Money, events, policy, errors         |
| Conductor | `src/engine/replayEngine.ts`                    | Own state; validate → decide → commit |
| Judge     | `src/engine/eventProcessor.ts`                  | Pure `decideEvent`                    |
| Helpers   | fee / balance / interest / installment / report | Pure derived logic                    |

**Flow:** `applyEvent` → `validateReceipt` → `decideEvent` → `commitAccepted` | `recordRejection` → (after stream) `buildAccountViews`.

## Locked policy highlights

- Overdraft: AED 25 once per negative closing day in a debit’s value-date→receipt window; fee rows excluded from eligibility.
- E9 offsets E7 only; derived fees remain.
- Installments conserve exact total (3.333 / 3.333 / 3.334), not 3.334×3.
- Interest: 0.04%/day on positive **restated** closes; capitalize exact sum of daily rounds.

## Documentation map

| File                               | Purpose                                    |
| ---------------------------------- | ------------------------------------------ |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Trade-offs for the uploaded PDF (≤4 pages) |
| [AMBIGUITIES.md](AMBIGUITIES.md)   | Unclear points and locked choices          |
| [NUMBERS.md](NUMBERS.md)           | Constants and final arithmetic             |
| [REJECTED.md](REJECTED.md)         | Refused criteria and abandoned approaches  |
| [TRACEABILITY.md](TRACEABILITY.md) | Requirement → symbol → test                |
| [WORKLOG.md](WORKLOG.md)           | Timestamped session log                    |

`ARCHITECTURE.pdf` is prepared locally for upload and is gitignored.
