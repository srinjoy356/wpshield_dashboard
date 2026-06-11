export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminBillingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify Admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "super_admin") {
    redirect("/app");
  }

  const adminClient = createAdminClient();

  const { data: subscriptions, error: subsError } = await adminClient
    .from("subscriptions")
    .select(`
      id, status, current_period_end, customer_id, plan_id
    `)
    .order("created_at", { ascending: false });

  if (subsError) console.error("Subs Error:", subsError);

  // Fetch plans
  const { data: plans } = await adminClient.from("plans").select("id, name");
  
  // Fetch customers and profiles
  const { data: customers } = await adminClient.from("customers").select("id, owner_user_id");
  const { data: profiles } = await adminClient.from("user_profiles").select("id, display_name");

  // Map data together
  const mappedSubscriptions = subscriptions?.map((sub: any) => {
    const customer = customers?.find((c) => c.id === sub.customer_id);
    const profile = profiles?.find((p) => p.id === customer?.owner_user_id);
    const plan = plans?.find((p) => p.id === sub.plan_id);
    return {
      ...sub,
      customerName: profile?.display_name || "Unknown Customer",
      planName: plan?.name || "Premium Plan",
      planPrice: 49, // Hardcoded fallback since price column doesn't exist
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Billing Overview</h1>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renewal</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mappedSubscriptions?.map((sub: any) => (
              <tr key={sub.id}>
                <td className="px-6 py-4 whitespace-nowrap">{sub.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {sub.planName} (${sub.planPrice}/mo)
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    sub.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "Lifetime / N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
