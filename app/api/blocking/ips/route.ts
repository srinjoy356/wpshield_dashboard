import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCompanyAccess } from "@/lib/auth/verify-company-access";

// GET — list all active blocked IPs for a company
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const company_id = searchParams.get("company_id");

  if (!company_id) {
    return NextResponse.json({ error: "company_id is required" }, { status: 400 });
  }

  // Verify tenant ownership (SEC-001)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wpshield_blocked_ips")
    .select("*")
    .eq("company_id", company_id)
    .eq("is_active", true)
    .order("blocked_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// POST — add a new blocked IP
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { company_id, ip, reason } = body;

  if (!company_id || !ip) {
    return NextResponse.json({ error: "company_id and ip are required" }, { status: 400 });
  }

  // Verify tenant ownership (SEC-001)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  // Basic IPv4 validation
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4.test(ip)) {
    return NextResponse.json({ error: "Invalid IPv4 address" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Check for duplicate active block
  const { data: existing } = await admin
    .from("wpshield_blocked_ips")
    .select("id")
    .eq("company_id", company_id)
    .eq("ip", ip)
    .eq("is_active", true)
    .single();

  if (existing) {
    return NextResponse.json({ error: "This IP is already blocked" }, { status: 409 });
  }

  const { data, error } = await admin
    .from("wpshield_blocked_ips")
    .insert({
      company_id,
      ip,
      reason: reason || null,
      source: "manual",
      is_active: true,
      blocked_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// DELETE — soft-delete (set is_active = false)
export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, company_id } = body;

  if (!id || !company_id) {
    return NextResponse.json({ error: "id and company_id are required" }, { status: 400 });
  }

  // Verify tenant ownership (SEC-001)
  const { allowed, response: denyResponse } = await verifyCompanyAccess(supabase, user.id, company_id);
  if (!allowed) return denyResponse!;

  const admin = createAdminClient();
  const { error } = await admin
    .from("wpshield_blocked_ips")
    .update({ is_active: false })
    .eq("id", id)
    .eq("company_id", company_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}