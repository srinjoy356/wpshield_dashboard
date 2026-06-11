import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCompanyAccess } from "@/lib/auth/verify-company-access";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { company_id, xmlrpc_disabled } = body;

  if (!company_id) {
    return NextResponse.json({ error: "company_id required" }, { status: 400 });
  }
  if (typeof xmlrpc_disabled !== "boolean") {
    return NextResponse.json({ error: "xmlrpc_disabled must be boolean" }, { status: 400 });
  }

  // Verify tenant ownership (SEC-001)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ xmlrpc_disabled })
    .eq("company_id", company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}