import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getReportData } from "@/lib/reportData";
import { generatePdfBuffer } from "@/lib/pdfGenerator";
import { sendEmailViaGraph } from "@/lib/email";

export async function POST(request: Request) {
  // 1. Validate Secret for Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized cron trigger" }, { status: 401 });
  }

  try {
    // 2. Initialize Service Role Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Find due reports
    const { data: dueReports, error } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", new Date().toISOString());

    if (error) throw error;

    const results = [];

    // 4. Process each report
    for (const report of dueReports || []) {
      try {
        console.log(`[Cron Reports] Processing report for company ${report.company_id}`);

        // Generate data & PDF
        // Using 30 days default for monthly reports. Could customize based on frequency.
        const periodDays = report.frequency === "weekly" ? 7 : 30;
        const reportData = await getReportData(supabase, report.company_id, periodDays);
        const pdfBuffer = await generatePdfBuffer(reportData);

        const base64Pdf = pdfBuffer.toString('base64');
        const filename = `Security_Report_${report.company_id}_${new Date().toISOString().split('T')[0]}.pdf`;

        // Send Email
        const emailContent = `
          <h2>Your Cybernara WPShield Security Report</h2>
          <p>Hello,</p>
          <p>Please find attached your ${report.frequency} security report for ${reportData.company.display_name}.</p>
          <p>This report covers the period: ${reportData.period}.</p>
          <br/>
          <p>Best regards,<br/>Cybernara Team</p>
        `;

        for (const recipient of report.recipient_emails || []) {
            await sendEmailViaGraph(
                recipient,
                `${reportData.company.display_name} - Security Report`,
                emailContent,
                [{
                    name: filename,
                    contentType: 'application/pdf',
                    contentBytes: base64Pdf
                }]
            );
        }

        // Record history
        await supabase.from("report_history").insert({
            company_id: report.company_id,
            report_type: report.frequency,
            status: "success"
        });

        // Update next run
        const now = new Date();
        let next_run_at;
        if (report.frequency === "monthly") {
            next_run_at = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
        } else {
            const nextWeek = new Date(now);
            nextWeek.setDate(now.getDate() + 7);
            next_run_at = nextWeek.toISOString();
        }

        await supabase
            .from("scheduled_reports")
            .update({ next_run_at })
            .eq("id", report.id);

        results.push({ company_id: report.company_id, status: 'success' });
      } catch (err: any) {
        console.error(`[Cron Reports] Failed for ${report.company_id}:`, err);
        
        await supabase.from("report_history").insert({
            company_id: report.company_id,
            report_type: report.frequency,
            status: "failed"
        });

        results.push({ company_id: report.company_id, status: 'failed', error: err.message });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err: any) {
    console.error("[Cron Reports] Global error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
