import { scaleOf, type Currency } from "./currency.js";

/**
 * Exact currency-tagged money. Integer minor units avoid the representation
 * drift that binary floating point would introduce into auditable balances.
 */
export class Money {
  private constructor(
    readonly currency: Currency,
    readonly minor: bigint,
  ) {}

  static fromMinor(currency: Currency, minor: bigint): Money {
    return new Money(currency, minor);
  }

  static zero(currency: Currency): Money {
    return new Money(currency, 0n);
  }

  static parse(currency: Currency, text: string): Money {
    const scale = scaleOf(currency);
    const match = /^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.exec(text);

    if (match === null) {
      throw new Error(`Malformed ${currency} amount: ${text}`);
    }

    const [, sign = "", whole = "0", parsedFraction = ""] = match;

    if (parsedFraction.length > scale) {
      throw new Error(`Excess ${currency} precision: ${text}`);
    }

    const factor = 10n ** BigInt(scale);
    const fraction = parsedFraction.padEnd(scale, "0");
    const minor = BigInt(whole) * factor + BigInt(fraction || "0");

    return new Money(currency, sign === "-" ? -minor : minor);
  }

  format(): string {
    const scale = scaleOf(this.currency);
    const factor = 10n ** BigInt(scale);
    const sign = this.minor < 0n ? "-" : "";
    const absolute = this.minor < 0n ? -this.minor : this.minor;
    const fraction = (absolute % factor).toString().padStart(scale, "0");

    return `${sign}${absolute / factor}.${fraction}`;
  }

  add(other: Money): Money {
    this.assertCurrency(other);
    return new Money(this.currency, this.minor + other.minor);
  }

  subtract(other: Money): Money {
    this.assertCurrency(other);
    return new Money(this.currency, this.minor - other.minor);
  }

  negate(): Money {
    return new Money(this.currency, -this.minor);
  }

  compare(other: Money): number {
    this.assertCurrency(other);
    return this.minor < other.minor ? -1 : this.minor > other.minor ? 1 : 0;
  }

  private assertCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency}/${other.currency}`);
    }
  }
}

/** Rounds an exact rational to an integer, moving half ties away from zero. */
export function roundRationalHalfAway(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (denominator <= 0n) {
    throw new Error("Denominator must be positive");
  }

  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  const rounded = quotient + (remainder * 2n >= denominator ? 1n : 0n);

  return sign * rounded;
}
