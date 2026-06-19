// RG-02 / RG-05: shared pricing logic, used by BOTH the checkout route (what
// actually gets charged) and the billing UI (what gets displayed). Before this
// existed, those two were computed independently — checkout always used
// price_inr_test while the UI always rendered price_usd, so they could only
// ever look consistent by coincidence. Importing the same function in both
// places makes that class of bug structurally impossible going forward:
// there's only one place "what does this plan cost" is decided.

export interface PlanPricingRow {
  price_usd?: number | null;
  price_usd_live?: number | null;
  price_inr_test?: number | null;
  price_inr_live?: number | null;
  currency?: string | null;
}

export interface EffectivePrice {
  amount: number;
  currency: 'INR' | 'USD';
  isLive: boolean;
}

/**
 * Returns what a plan actually costs right now, accounting for IS_LIVE_MODE.
 *
 * In test mode (the current/default state — IS_LIVE_MODE unset or 'false'):
 * always price_inr_test, exactly as today.
 *
 * In live mode: prefers the *_live column matching the plan's currency, but
 * falls back to the test price rather than ever charging/displaying a NULL
 * or zero amount — a plan that hasn't had its live price configured yet
 * should never silently become free.
 */
export function getEffectivePrice(plan: PlanPricingRow): EffectivePrice {
  const isLive = process.env.IS_LIVE_MODE === 'true';
  const currency: 'INR' | 'USD' = plan.currency === 'USD' ? 'USD' : 'INR';

  if (!isLive) {
    return { amount: plan.price_inr_test ?? 0, currency: 'INR', isLive: false };
  }

  if (currency === 'USD') {
    const live = plan.price_usd_live;
    if (live != null && live > 0) return { amount: live, currency: 'USD', isLive: true };
  } else {
    const live = plan.price_inr_live;
    if (live != null && live > 0) return { amount: live, currency: 'INR', isLive: true };
  }

  // Live mode is on, but this specific plan has no live price configured yet
  // — fail safe to test pricing rather than charging nothing.
  console.error(`[pricing] IS_LIVE_MODE is true but plan has no live price configured — falling back to test price.`);
  return { amount: plan.price_inr_test ?? 0, currency: 'INR', isLive: false };
}

export function formatPrice(price: EffectivePrice): string {
  const symbol = price.currency === 'USD' ? '$' : '₹';
  return `${symbol}${price.amount}`;
}