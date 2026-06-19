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

  // RG-06: real paid amounts via invoices, not a hardcoded fallback. Invoices
  // link to customer_id rather than subscription_id directly, so for each
  // subscription we take that customer's most recent invoice — a reasonable
  // "what did this customer actually last pay" view for an admin overview,
  // and far more accurate than a single number applied to every row.
  const { data: invoices } = await adminClient
    .from("invoices")
    .select("customer_id, amount, currency, status, invoice_number, created_at")
    .order("created_at", { ascending: false });

  // Map data together
  const mappedSubscriptions = subscriptions?.map((sub: any) => {
    const customer = customers?.find((c) => c.id === sub.customer_id);
    const profile = profiles?.find((p) => p.id === customer?.owner_user_id);
    const plan = plans?.find((p) => p.id === sub.plan_id);
    // invoices is already sorted newest-first, so the first match for this
    // customer is their most recent invoice.
    const latestInvoice = invoices?.find((inv) => inv.customer_id === sub.customer_id);

    return {
      ...sub,
      customerName: profile?.display_name || "Unknown Customer",
      planName: plan?.name || "Premium Plan",
      // amount is stored in minor units (paise) per invoices.amount's existing
      // convention — divide by 100 for display, same as the rest of the app.
      paidAmount: latestInvoice ? latestInvoice.amount / 100 : null,
      paidCurrency: latestInvoice?.currency || null,
      invoiceNumber: latestInvoice?.invoice_number || null,
      invoiceStatus: latestInvoice?.status || null,
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Paid</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renewal</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {mappedSubscriptions?.map((sub: any) => (
              <tr key={sub.id}>
                <td className="px-6 py-4 whitespace-nowrap">{sub.customerName}</td>
                <td className="px-6 py-4 whitespace-nowrap">{sub.planName}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {sub.paidAmount != null
                    ? `${sub.paidCurrency === 'USD' ? '$' : '₹'}${sub.paidAmount.toLocaleString()}`
                    : <span className="text-gray-400 italic">No invoice on record</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                  {sub.invoiceNumber || "—"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    sub.status === 'active' ? 'bg-green-100 text-green-800' :
                    sub.status === 'past_due' ? 'bg-amber-100 text-amber-800' :
                    'bg-red-100 text-red-800'
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