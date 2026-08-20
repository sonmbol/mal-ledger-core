# Rejected Criteria, Events, and Approaches

## Refused assessment criteria

- **E7 causes exactly one overdraft fee on Day 2:** refused. The non-negotiable rule assesses a fee once per day whenever that day’s closing (`value_date ≤ day`) is negative. E7 back-values Day 2 and also leaves Days 4 and 5 negative before E9, so three fees (Days 2, 4, 5) are required. The “exactly one fee” line contradicts the non-negotiable rule.
- **Three BHD installments of 3.334:** refused — they total BHD 10.002. Conservation requires 3.333 / 3.333 / 3.334.
- **Discard an interest residual:** refused — capitalized interest equals the integer sum of daily rounded allocations.
- **After E9 all balances and fees return to pre-E7 values:** refused. E9 offsets E7 only; historically valid fees remain as distinct append-only entries.
- **Auth-B must be active:** not unconditional. At E8 available balance cannot support the hold, so approval would break the authorization rule.

## Rejected business events

- **E6 — `AUTHORIZATION_NOT_FOUND`:** Auth-Z does not exist. No ledger entry, hold change, or balance movement.
- **E8 — `INSUFFICIENT_AVAILABLE_BALANCE`:** no Auth-B record or hold is created.

## Approaches abandoned

- Assessing a fee only on the originating debit’s value date — abandoned because it softens the non-negotiable daily-negative rule to protect a fallible acceptance criterion.
- Auto-reversing derived fees when E9 reverses E7 — abandoned; E9 names E7, not the fee. Fee compensation would be a separate entry if required.
- Aggregate-first interest rounding — abandoned; daily allocations are authoritative and sum to capitalization.
- Posting three installment ledger credits for E10 — abandoned; that would triple-post the credit.
- Dual fee-assessment modes / configurable reversal-fee switches — abandoned mid-cleanup to keep one explainable policy.
