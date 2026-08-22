# Ambiguities and Selected Policies

## Event versus ledger entry (transaction)

Unclear in casual speech: whether every stream item is a “transaction.” We split the terms. A **LedgerEvent** is an input that arrived in order (credit, debit, authorization, settlement, reversal). A **LedgerEntry** is an append-only money row that changes posted balance. Authorization creates a hold only; rejected events (E6, E8) create neither a hold nor a ledger entry. Calling everything a transaction would hide that holds and rejections do not move posted money. Locked by Auth-A / E6 / E8 tests.

## Available balance versus “running balance”

Unclear if spendable funds should be named running balance. In many products “running balance” means the balance after each posting in time order. The assessment defines spendable funds as **ledger balance minus active holds**, and names that **available balance**. We keep `available` in code and reports so authorization checks match the brief. A hold reduces available, not posted. Locked by the funded-hold and E8 tests.

## Fee scope for back-valued debits

Unclear at first glance: acceptance text says E7 causes one Day 2 fee, while the non-negotiable rule fees every negative daily close. After E7, Days 2, 4, and 5 are negative. We follow the non-negotiable rule: one fee per negative day in the affected window (value date through receipt). Fee entries are excluded from eligibility so a fee cannot recursively create another fee day. Consequence: three E7 fees; ACC-001 finishes at AED 390.93. Locked by replay tests; the one-fee criterion is in REJECTED.md.

## E9 and derived fees

Unclear: whether reversing E7 also compensates derived fees. We reverse only E7. Fees were valid when assessed; append-only history keeps them. Locked by the retained-fee replay test.

## Final-restated versus as-observed closings

Unclear: “daily closing” as knowledge-that-day versus final accounting after later value-dated entries. Output shows both. Fees preserve assessment-time history; interest uses final-restated closings. Locked by report and replay tests.

## Settlement value date

Unclear: inherit authorization date or use settlement value date. We use the settlement’s Day 4 value date. Locked by Auth-A assertions.

## Fixed AED fee on non-AED accounts

Unclear: no FX or BHD fee. BHD has no configured overdraft fee; AED 25.00 is never converted. Locked by the BHD fee test.

## Interest eligibility

Unclear: rate is stated generally. Every account with a positive final-restated closing earns interest in its own precision (ACC-002 earns BHD 0.004 on Days 5–6). Locked by BHD replay assertions.

## Interest rounding

Daily half-away-from-zero allocations are authoritative; capitalization is their exact integer sum. Locked by interest tests.

## Authorization expiry / Auth-B

No expiry event exists; open holds would remain open. E8 creates no Auth-B because funds are insufficient at replay time. Locked by E8 rejection and a separate funded-hold test.

## Installment representation

E10 posts one BHD 10.000 credit; three derived allocations conserve that total. Locked by allocator and replay tests.

## Installments versus available balance (phased release)

Unclear in real products: should each installment slice become spendable only when it “settles,” like a hold release? That would mirror authorization semantics (reserve unreleased portions, release on settlement events). We chose the opposite: one full credit ledger entry posts immediately; `state.installments` is report-only metadata and never enters `calculateAvailableBalance`. Holds already reduce available without touching posted balance; a second installment-hold layer would need new event types and would change ACC-002 interest (full BHD 10.000 must be in the ledger from Day 5 for the locked 10.008 final). Locked by the annotated failing test in `tests/designLimit.test.ts`.

## Duplicate rejected-event IDs

Every received ID is consumed, accepted or rejected. Corrections need a new ID. Locked by the duplicate-ID test.

## Ledger entry kind naming (clear core vs short codes)

Unclear temptation for a “backend-looking” core: compress `LedgerEntryKind` to DR / CR / SETT / REV / OVER / INT (or similar). We keep the full discriminated strings:

```ts
"CREDIT" | "DEBIT" | "SETTLEMENT" | "REVERSAL" | "OVERDRAFT_FEE" | "INTEREST";
```

**Why the long form belongs in the engine.** This module is the money truth, not a wire codec. Entry kind is read in filters (`kind === "OVERDRAFT_FEE"`), reports, tests, live defense, and audit greps. Abbreviations save a few characters and cost clarity: OVER is ambiguous (overdraft vs overnight), SETT collides with “settled hold,” INT with “internal.” Mapping DR/CR at an API edge is fine; the append-only log should stay self-explanatory so a reader never needs a legend to know whether a row is a customer debit, a capture settlement, a derived fee, or capitalized interest.

Event types stay equally explicit (`CREDIT`, `DEBIT`, `AUTHORIZATION`, …). Authorization is still not an entry kind — holds live in the auth registry, not the money log. Locked by `LedgerEntryKind` in `src/domain/types.ts` and fee/interest filters that match on these literals.
