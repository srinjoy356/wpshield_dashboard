import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AwayModeSchedule } from "@/types";
import { verifyCompanyAccess } from "@/lib/auth/verify-company-access";

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  const body = await request.json();
  const { schedule, company_id } = body;

  if (!company_id) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  // 3. Verify tenant ownership (SEC-001)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  // 4. Validate schedule shape
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

  // 5. Write via admin client
  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ away_mode_schedule: schedule })
    .eq("company_id", company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}