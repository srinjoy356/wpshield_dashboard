import { NextResponse } from "next/server";
import { verifySiteToken } from "@/lib/security/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? "Unauthorized" }, { status: auth.status ?? 401 });
    }

    const body = await request.json();
    const footer_attribution = body.footer_attribution === true || body.footer_attribution === 1;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("companies")
      .update({ footer_attribution })
      .eq("company_id", auth.site.company_id);

    if (error) {
      console.error("[attribution] DB error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, footer_attribution });

  } catch (err: any) {
    console.error("[attribution] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}