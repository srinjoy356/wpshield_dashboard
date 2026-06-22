export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { CheckoutButton } from "./checkout-button";
import { CheckCircle, Shield, Zap, Building2, Star } from "lucide-react";
import { getEffectivePrice, formatPrice } from "@/lib/billing/pricing";
import { CurrencyHint } from "@/components/billing/CurrencyHint";

// Feature lists per plan — matches the feature_* columns in the DB
const PLAN_FEATURES: Record<string, string[]> = {
  core: [
    "1 WordPress Site",
    "Basic Attack Detection & Logging",
    "Login Event Logs",
    "Plugin & Theme Inventory",
    "XML-RPC Disable",
    "Maintenance Mode",
    "File Integrity (7-day history)",
    "Activity Logs (7-day history)",
  ],
  solo: [
    "1 WordPress Site",
    "Everything in Core",
    "Cloud Security Dashboard",
    "Real-time Email Alerts",
    "Slack Alerts",
    "Full File Integrity (90-day history)",
    "Full Activity Logs (90-day history)",
    "Manual & Auto IP Blocking",
    "Geo Blocking",
    "Away Mode",
    "PDF & Excel Reports",
  ],
  growth: [
    "Up to 5 WordPress Sites",
    "Everything in Solo",
    "Multi-site Dashboard",
    "Per-site Event Filtering",
    "Per-site Maintenance & Away Mode",
    "Priority Support",
  ],
  agency: [
    "Up to 25 WordPress Sites",
    "Everything in Growth",
    "White-label PDF Reports",
    "Full Multi-site Dashboard",
    "Agency Client Management",
    "Dedicated Support",
  ],
  managed_review: [
    "Monthly analyst security review",
    "Plugin & hardening audit",
    "Suspicious login review",
    "Written PDF report",
    "Per-site add-on (requires existing plan)",
  ],
};

const PLAN_ICONS: Record<string, any> = {
  core:           Shield,
  solo:           Star,
  growth:         Zap,
  agency:         Building2,
  managed_review: CheckCircle,
};

const BEST_VALUE_PLAN  = 'growth';
const PLAN_ORDER       = ['core', 'solo', 'growth', 'agency', 'managed_review'];

export default async function AppBillingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  let subscription: any = null;
  let currentPlan: any  = null;
  let currentLicense: any = null;

  if (customer) {
    const { data: subData } = await supabase
      .from("subscriptions")
      .select("id, status, current_period_end, created_at, plan:plans(id, name, max_sites)")
      .eq("customer_id", customer.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subData) {
      subscription = subData;
      currentPlan  = Array.isArray(subData.plan) ? subData.plan[0] : subData.plan;

      const adminSupabase = createAdminClient();
      const { data: lic } = await adminSupabase
        .from("licenses")
        .select("id, status, key_hash")
        .eq("subscription_id", subData.id)
        .maybeSingle();
      currentLicense = lic;
    }
  }

  const { data: plansRaw } = await supabase
    .from("plans")
    .select("id, name, price_inr_test, price_inr_live, currency, max_sites, plan_family, billing_interval, is_active")
    .eq("is_active", true)
    .order("price_inr_live", { ascending: true, nullsFirst: true });

  // Sort plans in our defined order
  const plans = (plansRaw ?? []).sort((a, b) => {
    const ai = PLAN_ORDER.indexOf(a.id);
    const bi = PLAN_ORDER.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const isActive = subscription?.status === "active"
    && new Date(subscription.current_period_end) > new Date();

  const isLiveMode = process.env.IS_LIVE_MODE === 'true';

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Billing & Subscription</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Manage your WPShield subscription and license.</p>
        {isLiveMode && (
          <span className="inline-flex items-center gap-1.5 mt-2 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            ● Live Payments Active
          </span>
        )}
      </div>

      {/* Active subscription card */}
      {isActive ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" strokeWidth={1.5}/>
            <h2 className="text-lg font-semibold text-emerald-800">Active Subscription</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Plan</p>
              <p className="font-semibold text-emerald-900 mt-0.5">{currentPlan?.name ?? "Premium"}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Sites</p>
              <p className="font-semibold text-emerald-900 mt-0.5">{currentPlan?.max_sites ?? 1}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Activated</p>
              <p className="font-semibold text-emerald-900 mt-0.5">{new Date(subscription.created_at).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Renews</p>
              <p className="font-semibold text-emerald-900 mt-0.5">{new Date(subscription.current_period_end).toLocaleDateString()}</p>
            </div>
          </div>
          {currentLicense && (
            <div className="pt-2 border-t border-emerald-200">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <CheckCircle className="h-3.5 w-3.5"/> License active — check your email for the key
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
          <h2 className="text-lg font-semibold text-amber-800 mb-1">No Active Subscription</h2>
          <p className="text-sm text-amber-700">Choose a plan below. Your Core (free) features are active.</p>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-xl font-bold mb-5">Plans</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {plans.map((p) => {
            let effectivePrice;
            try { effectivePrice = getEffectivePrice(p); }
            catch { return null; }

            const features   = PLAN_FEATURES[p.id] ?? [];
            const isCurrent  = currentPlan?.id === p.id && isActive;
            const isBestVal  = p.id === BEST_VALUE_PLAN;
            const isFree     = effectivePrice.amount === 0;
            const isAddon    = p.plan_family === 'addon';
            const Icon       = PLAN_ICONS[p.id] ?? Shield;

            const intervalLabel = p.billing_interval === 'yearly'  ? '/yr'
                                : p.billing_interval === 'monthly' ? '/mo'
                                : p.billing_interval === 'free'    ? ''
                                : '/mo';

            return (
              <div
                key={p.id}
                className={`relative rounded-2xl border-2 bg-surface p-6 flex flex-col shadow-sm ${
                  isCurrent  ? 'border-[var(--brand)]' :
                  isBestVal  ? 'border-[var(--foreground)]' :
                  isAddon    ? 'border-dashed border-[var(--border)]' :
                               'border-[var(--border)]'
                }`}
              >
                {isBestVal && !isCurrent && (
                  <div className="absolute -top-3 left-6 bg-[var(--foreground)] text-white text-xs font-bold px-3 py-1 rounded-full">
                    BEST VALUE
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-6 bg-[var(--brand)] text-white text-xs font-bold px-3 py-1 rounded-full">
                    CURRENT PLAN
                  </div>
                )}
                {isAddon && (
                  <div className="absolute -top-3 left-6 bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--muted)] text-xs font-bold px-3 py-1 rounded-full">
                    ADD-ON
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.5}/>
                      <h3 className="text-lg font-bold">{p.name}</h3>
                    </div>
                    <p className="text-xs text-[var(--muted)]">
                      {isAddon ? 'per site · add-on' : `${p.max_sites} site${p.max_sites > 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold">
                      {isFree ? (
                        <span>Free</span>
                      ) : (
                        <>{formatPrice(effectivePrice)}<span className="text-sm text-[var(--muted)] font-normal">{intervalLabel}</span></>
                      )}
                    </div>
                    {!isFree && <CurrencyHint amountInr={effectivePrice.amount} />}
                  </div>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[var(--muted)]">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" strokeWidth={1.5}/>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full text-center py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] font-medium">
                    Current Plan — renews {new Date(subscription.current_period_end).toLocaleDateString()}
                  </div>
                ) : isFree ? (
                  <div className="w-full text-center py-2.5 rounded-lg border border-[var(--border)] text-sm text-[var(--muted)] font-medium">
                    Active by default
                  </div>
                ) : (
                  <CheckoutButton planId={p.id} />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] mt-4 text-center">
          Payments processed securely via Worldline/Paynimo · All prices in INR · License key emailed after payment
        </p>
      </div>
    </div>
  );
}