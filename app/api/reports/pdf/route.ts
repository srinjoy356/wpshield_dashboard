import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getPlanFeatures } from "@/lib/billing/get-plan-features";
import { getReportData } from "@/lib/reportData";
import { generatePdfBuffer } from "@/lib/pdfGenerator";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const profile  = await getCurrentProfile(supabase);
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser();
    const features = await getPlanFeatures(supabase, user!.id);

    // Gate: PDF reports require Solo+ (feature_pdf_reports)
    if (!features.pdfReports) {
      return NextResponse.json(
        { error: "PDF reports require Solo plan or above. Please upgrade your subscription." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("company_id");
    const companyId = ["admin","super_admin"].includes(profile.role as string) && requestedCompanyId
      ? requestedCompanyId
      : profile.company_id;

    if (!companyId) return NextResponse.json({ error: "Company ID required" }, { status: 400 });

    const periodDays = parseInt(searchParams.get("period") || "30", 10);
    const reportData = await getReportData(supabase, companyId, periodDays);
    const pdfBuffer  = await generatePdfBuffer(reportData);

    return new Response(pdfBuffer as any, {
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="wpshield-report-${companyId}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[reports/pdf]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}