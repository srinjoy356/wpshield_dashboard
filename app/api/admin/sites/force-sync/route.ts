import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

/**
 * POST /api/admin/sites/force-sync
 * Body: { site_id: string }
 *
 * Calls the WordPress plugin's /wp-json/wpshield/v1/purge-config-cache endpoint
 * to immediately invalidate the plugin's config transient.
 *
 * The plugin verifies a Bearer token = SHA-256(raw_site_token).
 * The raw token never leaves the server — only the hash is sent over the wire.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { site_id } = body;

  if (!site_id) {
    return NextResponse.json({ error: "site_id is required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load site URL and token — verify user owns this site
  const { data: site } = await admin
    .from("sites")
    .select("id, url, company_id")
    .eq("id", site_id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  const isAdmin     = profile?.role === "admin" || profile?.role === "super_admin";
  const ownsCompany = profile?.company_id === site.company_id;

  if (!isAdmin && !ownsCompany) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  // Load the raw site token (never exposed to the browser)
  // site_tokens uses 'revoked' boolean, not 'is_active'
  const { data: tokenRow } = await admin
    .from("site_tokens")
    .select("token_hash")
    .eq("site_id", site_id)
    .eq("revoked", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRow) {
    return NextResponse.json({ error: "No active token for this site" }, { status: 400 });
  }

  // The plugin's verify_bearer_token() checks: hash('sha256', $site_token) === $bearer
  // token_hash in our DB is already SHA-256(raw_token), which is exactly what the plugin expects
  const bearerValue = tokenRow.token_hash;

  const siteUrl = site.url.replace(/\/$/, '');
  const endpoint = `${siteUrl}/wp-json/wpshield/v1/purge-config-cache`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerValue}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json(
        { error: `Plugin returned ${response.status}`, detail: text.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await response.json().catch(() => ({ success: true }));
    return NextResponse.json({ success: true, plugin_response: data });

  } catch (err: any) {
    const msg = err.name === 'TimeoutError'
      ? 'Request to WordPress site timed out (10s)'
      : err.message;
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}