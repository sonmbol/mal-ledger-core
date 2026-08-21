# In-Memory Account Ledger Core — Architecture & Trade-offs

Source narrative for the assessment architecture PDF (≤4 pages). Visual layout lives in local `ARCHITECTURE.html` → PDF; this file is the content spine.

**Locked behavior:** daily-negative debit-window fees → ACC-001 **AED 390.93** · ACC-002 **BHD 10.008**. One-fee / 440.98 reading is **refused**.

Balances are a **fold over an append-only log**. Nothing is updated in place.

```
Events → Validate → Decide (pure) → Commit once → AccountView[] (derived)
```

Rejected events leave **no** financial side effects. Commit is the **only** money writer.

---

## 1. Overview (PDF p.1)

In-memory deterministic ledger core for Days 1–6 (ACC-001 AED, ACC-002 BHD). Priorities: correctness → auditability → deterministic replay → explicit ambiguity → live-defense readability.

The swimlane shows one event: validate before mutate; reject = outcome only; accept = append money and/or update hold; debit may append fees in the same commit; reporter derives observed + restated views after the stream.

| Locked final               | Value             |
| -------------------------- | ----------------- |
| ACC-001 posted / available | AED 390.93        |
| ACC-002 posted             | BHD 10.008        |
| E7 fees                    | Days 2, 4, 5 × 25 |
| Rejected                   | E6, E8            |

---

## 2. Stream as proof harness (PDF p.2)

The E1–E10 matrix is **effects**, not Part 1 prose: holds without ledger rows (E3); atomic rejects (E6/E8); back-valued debit + multi-day fees (E7); append-only reversal that keeps fees (E9); BHD installment conservation (E10).

**Two clocks:** receipt = when known; value date = where booked.

---

## 3. Business trade-offs (PDF p.3)

- **Value dating:** late back-value restates books; keep observed vs restated; interest uses restated.
- **Reversal:** E9 offsets E7 only; derived fees stay unless a separate compensating entry is required.
- **Auth lifecycle:** this slice is OPEN → SETTLED; production endings (expiry/cancel/ops release) would append RELEASE — not implemented here.
- **Fee ambiguity:** non-negotiable daily-negative rule wins over soft “one fee” wording → 390.93 not 440.98.

---

## 4. Scale, UAE control, cuts (PDF p.4)

- **100×:** full replay from zero breaks first → checkpoints + tail replay; log stays truth; derived read model for queries.
- **UAE go-live:** shadow recon, sign-off, maker-checker + evidence for back-value (new compensating entry only), idempotency, append-only audit.
- **Cuts:** no durable store/API/UI/FX/expiry scheduler/auto fee-clear — each defers a named risk so the core stays defendable in 45 minutes.
