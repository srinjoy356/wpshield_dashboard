export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckoutButton } from "./checkout-button";
import { CheckCircle, Shield, Zap } from "lucide-react";

const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    "1 WordPress Site",
    "Real-time Attack Detection & Logging",
    "File Integrity Monitoring",
    "Active IP & Geo Blocking",
    "Malware Scanner",
    "Login & User Activity Monitoring",
    "Away & Maintenance Mode",
    "Cloud Security Dashboard",
    "Security Hardening Audit",
    "PDF & Excel Reports",
    "Email Alerts",
  ],
  growth: [
    "Up to 5 WordPress Sites",
    "Everything in Starter",
    "Multi-site Dashboard",
    "Per-site Event Filtering",
    "Priority Support",
  ],
};

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
      .select("id, status, current_period_end, created_at, plan:plans(id, name, price_usd, max_sites)")
      .eq("customer_id", customer.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subData) {
      subscription  = subData;
      currentPlan   = Array.isArray(subData.plan) ? subData.plan[0] : subData.plan;

      // Get license key (masked)
      const { data: lic } = await supabase
        .from("licenses")
        .select("id, status, key_hash")
        .eq("subscription_id", subData.id)
        .maybeSingle();
      currentLicense = lic;
    }
  }

  const { data: plans } = await supabase
    .from("plans")
    .select("id, name, price_usd, max_sites, plan_family")
    .not("id", "eq", "trial")
    .order("price_usd", { ascending: true });

  const isActive = subscription?.status === "active"
    && new Date(subscription.current_period_end) > new Date();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Billing & Subscription</h1>
        <p className="text-sm text-[var(--muted)] mt-1">Manage your WPShield subscription and license.</p>
      </div>

      {/* Current subscription */}
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
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide">Sites Allowed</p>
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
              <p className="text-xs text-emerald-700 font-medium uppercase tracking-wide mb-1">License Status</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                <CheckCircle className="h-3.5 w-3.5"/> Active — check your email for your license key
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
          <h2 className="text-lg font-semibold text-amber-800 mb-1">No Active Subscription</h2>
          <p className="text-sm text-amber-700">Choose a plan below to start protecting your WordPress site.</p>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-xl font-bold mb-5">Available Plans</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {plans?.map((p) => {
            const features  = PLAN_FEATURES[p.id] || [];
            const isCurrent = currentPlan?.id === p.id && isActive;
            const isGrowth  = p.plan_family === 'growth';

            return (
              <div key={p.id} className={`relative rounded-2xl border-2 ${isCurrent ? 'border-[var(--brand)]' : isGrowth ? 'border-[var(--foreground)]' : 'border-[var(--border)]'} bg-surface p-6 flex flex-col shadow-sm`}>
                {isGrowth && !isCurrent && (
                  <div className="absolute -top-3 left-6 bg-[var(--foreground)] text-white text-xs font-bold px-3 py-1 rounded-full">
                    BEST VALUE
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-6 bg-[var(--brand)] text-white text-xs font-bold px-3 py-1 rounded-full">
                    CURRENT PLAN
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {isGrowth
                        ? <Zap className="h-5 w-5 text-[var(--foreground)]" strokeWidth={1.5}/>
                        : <Shield className="h-5 w-5 text-[var(--brand)]" strokeWidth={1.5}/>}
                      <h3 className="text-lg font-bold">{p.name}</h3>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{p.max_sites} WordPress site{p.max_sites > 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold">${p.price_usd}<span className="text-sm text-[var(--muted)] font-normal">/mo</span></div>
                    <p className="text-xs text-[var(--muted)]">per month</p>
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
                ) : (
                  <CheckoutButton planId={p.id} userEmail={user.email!} userId={user.id}/>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted)] mt-4 text-center">
          Payments processed securely via Worldline. Your license key will be emailed after payment.
        </p>
      </div>
    </div>
  );
}