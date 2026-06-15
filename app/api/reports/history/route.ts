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
      .from("report_history")
      .select("*")
      .eq("company_id", company_id)
      .order("generated_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}