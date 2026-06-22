'use client';

import { useEffect, useState } from 'react';

interface Props {
  amountInr: number;
}

/**
 * Shows approximate foreign currency equivalents for an INR amount.
 * Fetches live exchange rates from exchangerate-api.com (free tier, no key).
 * Degrades gracefully — if the API is unreachable, nothing is shown.
 * The INR amount is always what Paynimo actually charges;
 * these figures are display-only for foreign visitors.
 */
export function CurrencyHint({ amountInr }: Props) {
  const [rates, setRates] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/INR')
      .then((r) => r.json())
      .then((d) => {
        if (d?.rates) setRates(d.rates);
      })
      .catch(() => {
        // Silent — just don't show the hint if the API is unavailable
      });
  }, []);

  if (!rates) return null;

  const convert = (code: string, symbol: string) => {
    const val = amountInr * (rates[code] ?? 0);
    if (!val) return null;
    return `${symbol}${val < 1 ? val.toFixed(2) : val < 10 ? val.toFixed(1) : Math.round(val)}`;
  };

  const usd = convert('USD', '$');
  const eur = convert('EUR', '€');
  const gbp = convert('GBP', '£');

  const parts = [usd, eur, gbp].filter(Boolean).join(' / ');
  if (!parts) return null;

  return (
    <p className="text-xs text-[var(--muted)] mt-1">
      ≈ {parts} <span className="opacity-60">(approx.)</span>
    </p>
  );
}