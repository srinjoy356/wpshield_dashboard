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

    if (!profile || (!profile.company_id && !["admin","super_admin"].includes(profile.role))) {
      return NextResponse.json({ error: "No company associated" }, { status: 400 });
    }

    const url = new URL(request.url);
    const company_id = ["admin","super_admin"].includes(profile.role) ? (url.searchParams.get("company_id") || profile.company_id) : profile.company_id;

    if (!company_id) {
      return NextResponse.json({ error: "company_id required for admin" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("company_id", company_id)
      .maybeSingle();

    if (error && error.code !== "PGRST116") throw error;
    
    return NextResponse.json(data || null);
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
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const targetCompanyId = ["admin","super_admin"].includes(profile.role) ? (body.company_id || profile.company_id) : profile.company_id;

    if (!targetCompanyId) {
       return NextResponse.json({ error: "company_id required" }, { status: 400 });
    }

    const { frequency, recipient_emails, is_active } = body;

    // Calculate next_run_at if activating or creating (e.g. 1st of next month for monthly)
    let next_run_at = null;
    if (is_active) {
       const now = new Date();
       if (frequency === "monthly") {
          next_run_at = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
       } else if (frequency === "weekly") {
          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);
          next_run_at = nextWeek.toISOString();
       }
    }

    const { data, error } = await supabase
      .from("scheduled_reports")
      .upsert({
        company_id: targetCompanyId,
        frequency: frequency || "monthly",
        recipient_emails: recipient_emails || [],
        is_active: is_active !== undefined ? is_active : true,
        next_run_at: next_run_at
      }, { onConflict: "company_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}