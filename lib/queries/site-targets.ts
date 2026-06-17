import { SupabaseClient } from "@supabase/supabase-js";

/**
 * One thing to actively check for a company: either a real activated site (site_id is
 * a genuine sites.id) or, for a company that's never activated a site via a license yet,
 * the legacy single companies.site_url field (site_id is null in that case).
 *
 * Every monitoring cron route (uptime-check, safe-browsing, vuln-check, hardening-audit)
 * needs this same resolution — a company can now have zero, one, or several active sites,
 * and all of them need to be checked independently, not just whichever one happens to be
 * sitting in companies.site_url.
 */
export type CheckTarget = {
  site_id: string | null;
  url: string;
  last_seen_at: string | null;
  uptime_status: string | null;
  uptime_response_ms: number | null;
  last_uptime_check: string | null;
  safebrowsing_status: string | null;
  last_safebrowsing_check: string | null;
};

export async function getCheckTargets(
  supabase: SupabaseClient,
  company: {
    company_id: string;
    site_url?: string | null;
    last_seen_at?: string | null;
    uptime_status?: string | null;
    uptime_response_ms?: number | null;
    last_uptime_check?: string | null;
    safebrowsing_status?: string | null;
    last_safebrowsing_check?: string | null;
  }
): Promise<CheckTarget[]> {
  const { data: activeSites, error } = await supabase
    .from("sites")
    .select(
      "id, url, last_seen_at, uptime_status, uptime_response_ms, last_uptime_check, safebrowsing_status, last_safebrowsing_check"
    )
    .eq("company_id", company.company_id)
    .eq("is_active", true);

  if (error) {
    console.error(`Failed to fetch sites for ${company.company_id}:`, error.message);
  }

  if (activeSites && activeSites.length > 0) {
    return activeSites.map((s) => ({
      site_id: s.id as string,
      url: s.url as string,
      last_seen_at: (s.last_seen_at as string | null) ?? null,
      uptime_status: (s.uptime_status as string | null) ?? null,
      uptime_response_ms: (s.uptime_response_ms as number | null) ?? null,
      last_uptime_check: (s.last_uptime_check as string | null) ?? null,
      safebrowsing_status: (s.safebrowsing_status as string | null) ?? null,
      last_safebrowsing_check: (s.last_safebrowsing_check as string | null) ?? null,
    }));
  }

  return company.site_url
    ? [
        {
          site_id: null,
          url: company.site_url,
          last_seen_at: company.last_seen_at ?? null,
          uptime_status: company.uptime_status ?? null,
          uptime_response_ms: company.uptime_response_ms ?? null,
          last_uptime_check: company.last_uptime_check ?? null,
          safebrowsing_status: company.safebrowsing_status ?? null,
          last_safebrowsing_check: company.last_safebrowsing_check ?? null,
        },
      ]
    : [];
}