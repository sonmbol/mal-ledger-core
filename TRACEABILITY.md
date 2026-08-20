# Traceability

| Requirement                     | Symbol                  | Test                    | Docs              |
| ------------------------------- | ----------------------- | ----------------------- | ----------------- |
| Exact money                     | `Money`                 | Money suite             | NUMBERS           |
| Value-dated balances            | `calculateBalanceAtDay` | replay closings         | AMBIGUITIES       |
| Overdraft fees (daily negative) | `assessOverdraftFees`   | E7 three-fee test       | REJECTED, NUMBERS |
| Holds / settlement              | `decideEvent`           | Auth-A / funded hold    | ARCHITECTURE      |
| Reject E6 / E8                  | rejection codes         | atomicity tests         | REJECTED          |
| Reversal retains fees           | E9 path                 | retained-fee test       | AMBIGUITIES       |
| Interest sum                    | `calculateInterest`     | interest + replay       | NUMBERS           |
| Installments                    | `allocateInstallments`  | allocator + refuse test | REJECTED          |
| Deterministic report            | `buildReport`           | report suite            | README            |
