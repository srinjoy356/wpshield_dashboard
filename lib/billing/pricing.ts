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
 * In test mode (IS_LIVE_MODE unset or 'false'): always price_inr_test.
 *
 * In live mode: uses price_inr_live. If that column is null or zero, we THROW
 * rather than falling back to the test price — a misconfigured plan should fail
 * loudly in live mode, not silently charge ₹0 or the wrong amount.
 *
 * Fix if you see this error:
 *   UPDATE plans SET price_inr_live = <amount> WHERE id = '<plan_id>';
 */
export function getEffectivePrice(plan: PlanPricingRow): EffectivePrice {
  const isLive = process.env.IS_LIVE_MODE === 'true';

  if (!isLive) {
    return { amount: plan.price_inr_test ?? 0, currency: 'INR', isLive: false };
  }

  const live = plan.price_inr_live;
  if (live != null && live > 0) {
    return { amount: live, currency: 'INR', isLive: true };
  }

  // Hard fail — no silent fallback to test prices in live mode.
  // If you hit this it means price_inr_live was not set before IS_LIVE_MODE=true.
  // Fix: run  UPDATE plans SET price_inr_live = <amount> WHERE id = '<id>';
  throw new Error(
    `[pricing] IS_LIVE_MODE=true but plan has no price_inr_live configured. ` +
    `Set price_inr_live on this plan in the database before going live.`
  );
}

export function formatPrice(price: EffectivePrice): string {
  const symbol = price.currency === 'USD' ? '$' : '₹';
  return `${symbol}${price.amount}`;
}