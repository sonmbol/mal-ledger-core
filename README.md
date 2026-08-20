# In-Memory Account Ledger Core

Public repository: https://github.com/sonmbol/mal-ledger-core

Deterministic in-memory ledger: exact money, value-dated replay, holds, settlements, reversals, fees, installments, and daily interest. No HTTP, database, UI, or queue.

## Run

Requires Node.js 20.19+ (`nvm use` reads `.nvmrc`).

```sh
npm install
npm test
npm run replay
```

Optional: `npm run check` (format, lint, typecheck, tests).

The replay report lists events in supplied order, derived fees, authorizations, as-observed and final-restated daily closings, interest, finals, installments, and errors.

## Design in brief

- A **LedgerEvent** is an input in the stream; a **LedgerEntry** is a posted money row. Holds and rejected events are not postings.
- **Available** = posted ledger balance minus open holds (not renamed to “running balance,” which usually means something else).
- Currency-tagged `Money` stores `bigint` minor units.
- `decideEvent` returns a complete decision; `replay` is the sole commit point.
- Value date drives accounting days; event day drives as-observed knowledge.
- Overdraft fees: once per negative closing day from a debit’s value date through its receipt day (fee entries excluded from eligibility so fees cannot recurse).
- E9 offsets E7; derived fees remain (append-only). Reversing a fee would be a separate compensating entry — not selected.
- Installments are a derived schedule on one posted credit, summing exactly to the source.
- Capitalized interest is the exact sum of daily rounded accruals. Both accounts earn interest on positive closings (ACC-002 only after E10).

See [AMBIGUITIES.md](AMBIGUITIES.md), [NUMBERS.md](NUMBERS.md), [REJECTED.md](REJECTED.md).
