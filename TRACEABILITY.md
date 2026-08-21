# Traceability

| Requirement                     | Symbol                                             | Test                       | Docs                      |
| ------------------------------- | -------------------------------------------------- | -------------------------- | ------------------------- |
| Exact money                     | `Money`                                            | money suite                | NUMBERS                   |
| Value-dated balances            | `calculateBalanceAtDay`                            | replay closings            | AMBIGUITIES, ARCHITECTURE |
| As-observed vs restated         | `dailyCloses` modes                                | report / replay            | AMBIGUITIES               |
| Overdraft fees (daily negative) | `assessOverdraftFees`                              | E7 three-fee               | REJECTED, NUMBERS         |
| Fees only on debit commit       | `commitAccepted` DEBIT branch                      | fee tests                  | ARCHITECTURE              |
| Holds / available               | `decideAuthorization`, `calculateAvailableBalance` | Auth-A, E8, funded hold    | AMBIGUITIES               |
| Settlement                      | `decideSettlement`                                 | Auth-A settle              | ARCHITECTURE              |
| Reject E6 / E8 atomic           | rejection codes                                    | atomicity tests            | REJECTED                  |
| Reversal retains fees           | E9 path                                            | retained-fee test          | AMBIGUITIES               |
| acceptedEvents for reversal     | `acceptedEvents` map                               | reversal tests             | —                         |
| Interest sum                    | `calculateInterest`                                | interest + replay          | NUMBERS                   |
| Installments conserve           | `allocateInstallments`                             | allocator + refuse 3.334×3 | REJECTED                  |
| Deterministic report            | `buildReport`                                      | report suite               | README                    |
| Scale / cuts / UAE control      | design only                                        | —                          | ARCHITECTURE.pdf          |
