export const dynamic = 'force-dynamic';
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppSitesPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  const { data: sites } = await supabase
    .from("sites")
    .select(`
      id, url, status, last_seen_at,
      site_tokens(token_prefix, created_at, revoked),
      license:licenses(
        key_hash,
        created_at,
        subscription:subscriptions(current_period_end)
      )
    `)
    .eq("company_id", profile?.company_id);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Protected Sites</h1>
        <button className="bg-[#0a6358] text-white px-4 py-2 rounded hover:bg-[#084d44] transition-colors">
          Add New Site
        </button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Site URL</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">License Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activation Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiry Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Seen</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sites?.map((site: any) => {
              // Properly safely unwrap the potentially deeply nested object, accounting for single/array returns in Supabase
              const licenseInfo = Array.isArray(site.license) ? site.license[0] : site.license;
              const subInfo = licenseInfo?.subscription;
              const subscription = Array.isArray(subInfo) ? subInfo[0] : subInfo;

              return (
                <tr key={site.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{site.url}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm font-mono">
                    {licenseInfo?.key_hash ? `${licenseInfo.key_hash.substring(0, 16)}...` : 'No License'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {licenseInfo?.created_at ? new Date(licenseInfo.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      site.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {site.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {site.last_seen_at ? new Date(site.last_seen_at).toLocaleString() : 'Never'}
                  </td>
                </tr>
              );
            })}
            {(!sites || sites.length === 0) && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <p className="text-lg mb-2">No sites registered yet.</p>
                  <p className="text-sm">Download the WPShield plugin and activate it using your license key.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
