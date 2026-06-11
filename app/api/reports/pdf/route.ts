import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getReportData } from "@/lib/reportData";
import { generatePdfBuffer } from "@/lib/pdfGenerator";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const profile = await getCurrentProfile(supabase);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("company_id");

    const companyId = profile.role === "admin" && requestedCompanyId 
      ? requestedCompanyId 
      : profile.company_id;

    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }

    const periodDays = parseInt(searchParams.get("period") || "30", 10);

    const reportData = await getReportData(supabase, companyId, periodDays);
    const pdfBuffer = await generatePdfBuffer(reportData);

    const safeCompanyName = reportData.company.display_name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `security-report-${safeCompanyName}-${dateStr}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error("Failed to generate PDF report:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
