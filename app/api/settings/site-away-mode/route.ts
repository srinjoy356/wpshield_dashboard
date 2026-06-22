import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AwayModeSchedule } from "@/types";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { site_id, schedule } = body as { site_id: string; schedule: AwayModeSchedule };

  if (!site_id) {
    return NextResponse.json({ error: "site_id is required" }, { status: 400 });
  }

  // Validate schedule shape
  if (
    typeof schedule.enabled !== "boolean" ||
    typeof schedule.timezone !== "string" ||
    !Array.isArray(schedule.allowed_days) ||
    typeof schedule.allowed_start !== "string" ||
    typeof schedule.allowed_end !== "string" ||
    !Array.isArray(schedule.whitelist_ips)
  ) {
    return NextResponse.json({ error: "Invalid schedule format" }, { status: 400 });
  }

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timeRegex.test(schedule.allowed_start) || !timeRegex.test(schedule.allowed_end)) {
    return NextResponse.json({ error: "Times must be in HH:MM format" }, { status: 400 });
  }

  // Verify ownership
  const admin = createAdminClient();
  const { data: site } = await admin
    .from("sites")
    .select("company_id")
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

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 401 });
  }

  const isAdmin     = profile.role === "admin" || profile.role === "super_admin";
  const ownsCompany = profile.company_id === site.company_id;

  if (!isAdmin && !ownsCompany) {
    return NextResponse.json({ error: "Access Denied" }, { status: 403 });
  }

  const { error } = await admin
    .from("sites")
    .update({
      away_mode_schedule:    schedule,
      site_controls_enabled: true,
    })
    .eq("id", site_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}