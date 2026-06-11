import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCompanyAccess } from "@/lib/auth/verify-company-access";

// GET — list all blocked countries for a company
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const company_id = searchParams.get("company_id");
  if (!company_id) return NextResponse.json({ error: "company_id required" }, { status: 400 });

  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wpshield_blocked_countries")
    .select("*")
    .eq("company_id", company_id)
    .order("country_name", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST — add a blocked country
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { company_id, country_code, country_name } = body;

  if (!company_id || !country_code || !country_name) {
    return NextResponse.json({ error: "company_id, country_code and country_name are required" }, { status: 400 });
  }

  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("wpshield_blocked_countries")
    .select("id")
    .eq("company_id", company_id)
    .eq("country_code", country_code)
    .single();

  if (existing) {
    return NextResponse.json({ error: "This country is already blocked" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("wpshield_blocked_countries")
    .insert({ company_id, country_code, country_name })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — remove a blocked country
export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, company_id } = body;

  if (!id || !company_id) {
    return NextResponse.json({ error: "id and company_id are required" }, { status: 400 });
  }

  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  const admin = createAdminClient();
  const { error } = await admin
    .from("wpshield_blocked_countries")
    .delete()
    .eq("id", id)
    .eq("company_id", company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}