import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getReportData } from "@/lib/reportData";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const profile = await getCurrentProfile(supabase);

    if (!profile || !profile.company_id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = profile.company_id;

    const { searchParams } = new URL(request.url);
    const periodDays = parseInt(searchParams.get("period") || "30", 10);

    // This route used to carry its own full copy of getReportData's logic inline —
    // including the same hardening-score double-counting bug, since it was never
    // touched when that bug was fixed in lib/reportData.ts. Delegating to the shared
    // function means this in-app preview and the actual downloaded PDF/Excel always
    // show the same numbers, and any future fix here only needs to happen once.
    const reportData = await getReportData(supabase, companyId, periodDays);

    return NextResponse.json(reportData);
  } catch (error: any) {
    console.error("Failed to generate report data:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}