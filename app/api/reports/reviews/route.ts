import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(request.url);
    const company_id = profile.role === "admin" ? (url.searchParams.get("company_id") || profile.company_id) : profile.company_id;
    const month_year = url.searchParams.get("month_year"); // e.g., '2026-06'

    if (!company_id) {
      return NextResponse.json({ error: "company_id required" }, { status: 400 });
    }

    let query = supabase.from("managed_reviews").select("*").eq("company_id", company_id);
    if (month_year) {
      query = query.eq("month_year", month_year);
    }
    query = query.order("month_year", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Only admins can manage reviews" }, { status: 403 });
    }

    const body = await request.json();
    const { company_id, month_year, vulnerable_plugins_note, failed_hardening_note, suspicious_logins_note, status } = body;

    if (!company_id || !month_year) {
      return NextResponse.json({ error: "company_id and month_year are required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("managed_reviews")
      .upsert({
        company_id,
        month_year,
        analyst_id: user.id,
        vulnerable_plugins_note,
        failed_hardening_note,
        suspicious_logins_note,
        status: status || 'draft',
        updated_at: new Date().toISOString()
      }, { onConflict: "company_id,month_year" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
