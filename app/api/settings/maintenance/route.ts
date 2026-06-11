import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCompanyAccess } from "@/lib/auth/verify-company-access";

export async function POST(request: Request) {
  // 1. Authenticate
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body — company_id comes from client (same pattern as all other settings routes)
  const body = await request.json();
  const { enabled, company_id } = body;

  if (!company_id) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }
  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // 3. Verify the logged-in user owns this company (SEC-001 fix)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  // 4. Write via admin client
  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ maintenance_mode: enabled })
    .eq("company_id", company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}