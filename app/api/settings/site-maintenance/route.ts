import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { site_id, enabled } = body;

  if (!site_id) {
    return NextResponse.json({ error: "site_id is required" }, { status: 400 });
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });
  }

  // Verify the user owns the company that owns this site
  const admin = createAdminClient();
  const { data: site } = await admin
    .from("sites")
    .select("company_id")
    .eq("id", site_id)
    .maybeSingle();

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Check user's profile owns this company (or is an admin)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("company_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 401 });
  }

  const isAdmin  = profile.role === "admin" || profile.role === "super_admin";
  const ownsCompany = profile.company_id === site.company_id;

  if (!isAdmin && !ownsCompany) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  // Enable site-level controls and set the maintenance flag for this site only
  const { error } = await admin
    .from("sites")
    .update({
      maintenance_mode:      enabled,
      site_controls_enabled: true,
    })
    .eq("id", site_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}