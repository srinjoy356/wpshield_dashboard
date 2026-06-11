import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckoutButton } from "./checkout-button";

export default async function AppBillingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  let subscription = null;
  let plan = null;

  if (customer) {
    const { data: subData } = await supabase
      .from("subscriptions")
      .select(`
        id, status, current_period_end, created_at,
        plan:plans(id, name, price)
      `)
      .eq("customer_id", customer.id)
      .eq("status", "active")
      .maybeSingle();

    if (subData) {
      subscription = subData;
      plan = subData.plan;
    }
  }

  // Fetch available plans
  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("price", { ascending: true });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Billing & Subscription</h1>

      {subscription && subscription.status === 'active' ? (
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200 mb-8">
          <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Plan</p>
              <p className="font-medium text-lg">{plan?.name || "Premium"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium text-green-600">Active</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Activation Date</p>
              <p className="font-medium">{new Date(subscription.created_at || Date.now()).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Renewal Date</p>
              <p className="font-medium">{new Date(subscription.current_period_end).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200 mb-8">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">No Active Subscription</h2>
          <p className="text-yellow-700">Please upgrade to a premium plan to secure your WordPress sites.</p>
        </div>
      )}

      <h2 className="text-2xl font-bold mb-6">Available Plans</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {plans?.filter(p => p.id !== 'trial').map((p) => (
          <div key={p.id} className="bg-white p-6 rounded-lg shadow border border-gray-200 flex flex-col">
            <h3 className="text-xl font-bold mb-2">{p.name}</h3>
            <p className="text-3xl font-extrabold mb-4">${p.price}<span className="text-sm text-gray-500 font-normal">/mo</span></p>
            <ul className="text-gray-600 mb-8 space-y-2 flex-grow">
              <li>✔️ Advanced Threat Detection</li>
              <li>✔️ Malware Scanning</li>
              <li>✔️ 24/7 Monitoring</li>
            </ul>
            <CheckoutButton planId={p.id} userEmail={user.email!} userId={user.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
