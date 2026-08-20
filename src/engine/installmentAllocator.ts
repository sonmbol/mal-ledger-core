import { Money } from "../domain/money.js";

/**
 * Splits exact minor units and assigns indivisible residual units to the final
 * installments. This keeps the schedule sum equal to the posted source amount.
 */
export function allocateInstallments(
  amount: Money,
  count: number,
): readonly Money[] {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new Error("Installment count must be a positive integer");
  }

  if (amount.minor < 0n) {
    throw new Error("Installment amount must not be negative");
  }

  const divisor = BigInt(count);
  const baseInstallment = amount.minor / divisor;
  const residualMinorUnits = amount.minor % divisor;
  const residualStartIndex = divisor - residualMinorUnits;

  return Array.from({ length: count }, (_, index) => {
    const receivesResidual = BigInt(index) >= residualStartIndex;
    const minor = baseInstallment + (receivesResidual ? 1n : 0n);

    return Money.fromMinor(amount.currency, minor);
  });
}
