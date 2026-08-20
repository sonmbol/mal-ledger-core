# Live Defense Guide

## Mental model (say this first)

```
LedgerEvent (input)
    → decide (pure) → EventOutcome (accepted | rejected)
    → commit once    → LedgerEntry[] (append-only money log)
    → derive         → AccountView per account (closes, interest, finals)
```

One stream item → one outcome. Money only moves via ledger entries. Account views are reports, not a second source of truth.

1. **Integers** — fils/cents must add exactly; floats cannot.
2. **Event ≠ ledger entry** — event is input; entry posts money. Auth hold and rejected events do not post.
3. **Available ≠ running balance** — available = posted − open holds (assessment wording). Running balance usually means after-each-posting.
4. **Event day vs value date** — when learned vs where it books.
5. **E7** — arrives Day 5, books Day 2; pre-fee Day 2 close is −370.
6. **Three fees** — non-negotiable: one fee per negative closing day. E7 makes Days 2, 4, 5 negative → refuse “exactly one fee.”
7. **E9** — offsets E7 on Day 2; does not delete E7 or auto-erase fees → final AED 390.93.
8. **Auth-Z** — no authorization → reject with zero side effects.
9. **Auth-A** — settle 185 within hold 200; release 15.
10. **Holds** — reduce available, not posted. E8 rejected for funds.
11. **Installments** — only E10 (ACC-002); 3.334×3 = 10.002; conserved schedule is 3.333/3.333/3.334.
12. **Interest** — both accounts when positive; ACC-002 only Days 5–6. Daily rounds sum exactly to capitalization.
13. **100×** — replay-from-zero and unbounded indexes break first; checkpoint the tail.
14. **UAE control** — maker-checker + evidence for back-valued entries.
