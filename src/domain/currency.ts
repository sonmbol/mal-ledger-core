export interface CurrencyDefinition {
  /** Digits after the decimal point (AED=2, BHD=3). */
  readonly scale: number;
  /**
   * Fixed overdraft fee in minor units when the currency charges one.
   * AED 25.00 → 2500n. BHD has none (no FX invented).
   */
  readonly overdraftFeeMinor?: bigint;
}

export const CURRENCY_DEFINITIONS = {
  AED: { scale: 2, overdraftFeeMinor: 2500n },
  BHD: { scale: 3 },
} as const satisfies Record<string, CurrencyDefinition>;

export type Currency = keyof typeof CURRENCY_DEFINITIONS;

export function scaleOf(currency: Currency): number {
  return CURRENCY_DEFINITIONS[currency].scale;
}

export function overdraftFeeMinorOf(currency: Currency): bigint | undefined {
  const definition: CurrencyDefinition = CURRENCY_DEFINITIONS[currency];
  return definition.overdraftFeeMinor;
}
