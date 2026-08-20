# Numbers and Manual Checks

All monetary constants are integer minor units. AED uses 2 decimals; BHD uses 3.

## Constants

| Constant     |             Exact representation | Why not half              |
| ------------ | -------------------------------: | ------------------------- |
| AED fee      | configured `25.00` → 2,500 minor | Assessment says AED 25.00 |
| Daily rate   |                       4 / 10,000 | Exactly 0.04%             |
| Window       |                         Days 1–6 | Supplied window           |
| Installments |                                3 | E10 requests three        |

## E1–E10 (selected fee policy)

- E1/E2 → Day 1 close AED 250.00.
- E3 hold AED 200.00 → available 50.00; no ledger movement.
- E4 → posted 650.00; E5 settles 185.00 → posted 465.00; releases 15.00 hold.
- E6 (Auth-Z) rejected — no movement.
- E7 back-values Day 2: pre-fee Day 2 close −370.00. Affected negative closes before E9: Days 2, 4, 5 → three AED 25.00 fees.
- E8 rejected (insufficient available after E7 + fees).
- E9 offsets E7 on Day 2; fees remain.
- E10 posts BHD 10.000 once; schedule 3.333 / 3.333 / 3.334.

## Final ACC-001 arithmetic

Pre-interest posted: `1,200 − 950 + 400 − 185 − 620 − 75 + 620 = AED 390.00`.

Final-restated pre-interest closings: 250.00, 225.00, 625.00, 415.00, 390.00, 390.00.

Daily interest (× 4/10,000, half away from zero): 0.10, 0.09, 0.25, 0.17, 0.16, 0.16 → capitalize AED 0.93.

**Final posted / available: AED 390.93.**

ACC-002: BHD 10.000 on Days 5–6 → 0.004 + 0.004 → capitalize 0.008 → **BHD 10.008**.

## Refused alternative (one fee only)

A single Day 2 fee would leave pre-interest AED 440.00 and interest 0.98 → AED 440.98. That reading is refused because it contradicts the non-negotiable daily-negative fee rule.
