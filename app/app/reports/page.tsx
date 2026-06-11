"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { FileDown, Loader2, Save, Mail, Clock, History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PROBLEM_NAMES: Record<string, string> = {
  "No Vulnerable Plugins": "Vulnerable Plugins Detected",
  "No High Open Alerts": "Too Many High Severity Alerts",
  "No Recent File Modification Alerts": "Unexpected File Modifications",
  "No Critical Open Alerts": "Critical Alerts Unresolved",
  "Uptime Healthy": "Site Offline or Unreachable",
  "Plugin Heartbeat Recent": "Plugin Not Reporting Data",
  "HTTPS Enforced": "HTTPS Not Configured",
};

const mapAttackType = (t: string) => {
  switch (t?.toUpperCase()) {
    case "SENSITIVE_404":
      return "Sensitive File Probe";
    case "SQLI":
      return "SQL Injection";
    case "XSS":
      return "Cross-Site Scripting";
    case "LFI":
      return "Local File Inclusion";
    case "RCE":
      return "Remote Code Execution";
    default:
      return t || "Unknown";
  }
};

export default function ReportsPage() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [emailInput, setEmailInput] = useState("");
  const { toast } = useToast();

  const fetchReportData = async (selectedPeriod: string) => {
    const res = await fetch(`/api/reports/data?period=${selectedPeriod}`);
    if (!res.ok) {
      throw new Error("Failed to fetch report data");
    }
    return res.json();
  };

  const loadSchedule = async () => {
    try {
      const res = await fetch("/api/reports/schedule");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setScheduleData(data);
          setEmailInput(data.recipient_emails?.join(", ") || "");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveSchedule = async () => {
    setScheduleLoading(true);
    try {
      const emails = emailInput.split(",").map(e => e.trim()).filter(e => e);
      const res = await fetch("/api/reports/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frequency: "monthly",
          recipient_emails: emails,
          is_active: scheduleData?.is_active ?? true
        })
      });
      if (!res.ok) throw new Error("Failed to save schedule");
      const data = await res.json();
      setScheduleData(data);
      toast({ title: "Success", description: "Schedule updated successfully." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const getSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  };

  const getDateStr = () => {
    return new Date().toISOString().split("T")[0];
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = months[d.getMonth()];
      const day = d.getDate();
      const year = d.getFullYear();
      
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      
      return `${month} ${day} ${year}, ${hours}:${minutes} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  const mapFileEvent = (e: string) => {
    switch (e?.toLowerCase()) {
      case "file_modified":
        return "Modified";
      case "file_added":
        return "Added";
      case "file_deleted":
        return "Deleted";
      default:
        return e || "";
    }
  };

  const capitalize = (s: string) => {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  };

  const handleDownloadPDF = async () => {
    setLoadingPdf(true);
    try {
      const data = await fetchReportData(period);
      const companySlug = getSlug(data.company.display_name);
      const dateStr = getDateStr();

      const response = await fetch(`/api/reports/pdf?period=${period}`);
      if (!response.ok) {
        throw new Error("Failed to download PDF report from server");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-report-${companySlug}-${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "PDF report downloaded successfully.",
      });
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      toast({
        title: "PDF Export Failed",
        description: err.message || "An unexpected error occurred during PDF generation.",
        variant: "destructive",
      });
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setLoadingCsv(true);
    try {
      const data = await fetchReportData(period);
      const companySlug = getSlug(data.company.display_name);
      const dateStr = getDateStr();

      const response = await fetch(`/api/reports/excel?period=${period}`);
      if (!response.ok) {
        throw new Error("Failed to download Excel report from server");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-data-${companySlug}-${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Excel report downloaded successfully.",
      });
    } catch (err: any) {
      console.error("Excel generation failed:", err);
      toast({
        title: "Excel Export Failed",
        description: err.message || "An unexpected error occurred during Excel generation.",
        variant: "destructive",
      });
    } finally {
      setLoadingCsv(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader
          title="Export Reports"
          subtitle="Download your security report as PDF or Excel"
        />
        <Link href="/app/reports/history">
          <Button variant="outline" className="gap-2 border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-subtle)]">
            <History className="w-4 h-4" />
            Delivery History
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface p-8 shadow-sm space-y-8">
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--muted)]">
            Select Report Timeframe
          </h3>
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-1 w-fit">
            <button
              onClick={() => setPeriod("7")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                period === "7"
                  ? "bg-surface shadow-sm text-[var(--foreground)] border border-[var(--border)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => setPeriod("30")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                period === "30"
                  ? "bg-surface shadow-sm text-[var(--foreground)] border border-[var(--border)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setPeriod("90")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                period === "90"
                  ? "bg-surface shadow-sm text-[var(--foreground)] border border-[var(--border)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Last 90 Days
            </button>
          </div>
        </div>

        <hr className="border-[var(--border)]" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PDF Card */}
          <div className="flex flex-col justify-between p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] space-y-4">
            <div className="space-y-2">
              <h4 className="text-base font-bold text-[var(--foreground)]">
                Executive Security Report (PDF)
              </h4>
              <p className="text-xs text-[var(--muted)]">
                A highly-polished 4-page PDF summary detailing maturity score, events, vulnerabilities, and recommended actionable steps. Formatted for team and stakeholder presentation.
              </p>
            </div>

            <Button
              onClick={handleDownloadPDF}
              disabled={loadingPdf}
              className="w-full h-11 px-6 font-semibold border border-[#2DD4BF] text-[#0D9488] bg-white hover:bg-[#2DD4BF]/10 transition-all rounded-xl gap-2 flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              {loadingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Download PDF Report
                </>
              )}
            </Button>
          </div>

          {/* Excel Card */}
          <div className="flex flex-col justify-between p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] space-y-4">
            <div className="space-y-2">
              <h4 className="text-base font-bold text-[var(--foreground)]">
                Raw Event Data (Excel)
              </h4>
              <p className="text-xs text-[var(--muted)]">
                Detailed multi-sheet spreadsheet document containing event summaries, attack vectors, file events, vulnerability metrics, and checks. Excellent for analytics.
              </p>
            </div>

            <Button
              onClick={handleDownloadExcel}
              disabled={loadingCsv}
              className="w-full h-11 px-6 font-semibold border border-[#2DD4BF] text-[#0D9488] bg-white hover:bg-[#2DD4BF]/10 transition-all rounded-xl gap-2 flex items-center justify-center shadow-sm disabled:opacity-50"
            >
              {loadingCsv ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Excel...
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" />
                  Download Excel Report
                </>
              )}
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-[var(--muted)] font-medium text-center">
          PDF is formatted for sharing with non-technical stakeholders. Excel contains raw data for analysis.
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-surface p-8 shadow-sm space-y-8 mt-8">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-[var(--foreground)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#2DD4BF]" /> Automated Delivery
            </h3>
            <p className="text-sm text-[var(--muted)]">Configure monthly PDF reports to be emailed automatically.</p>
          </div>
          <Button onClick={saveSchedule} disabled={scheduleLoading} className="bg-[#2DD4BF] text-[#0A6358] hover:bg-[#20B2AA] font-bold h-10 px-6 rounded-xl">
            {scheduleLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Settings
          </Button>
        </div>

        <hr className="border-[var(--border)]" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-sm font-semibold text-[var(--foreground)]">Recipient Emails (comma separated)</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-[var(--muted)]" />
              <input
                type="text"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="admin@example.com, client@example.com"
                className="w-full pl-9 pr-4 py-2 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[#2DD4BF] focus:border-transparent outline-none transition-all text-[var(--foreground)]"
              />
            </div>
            <p className="text-xs text-[var(--muted)]">These emails will receive the PDF attachment on the 1st of every month.</p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-semibold text-[var(--foreground)]">Automation Status</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setScheduleData({ ...scheduleData, is_active: true })}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-all ${
                  (scheduleData?.is_active !== false) ? 'bg-[#2DD4BF]/10 border-[#2DD4BF] text-[#2DD4BF]' : 'bg-[var(--surface-subtle)] border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                Enabled
              </button>
              <button
                onClick={() => setScheduleData({ ...scheduleData, is_active: false })}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-all ${
                  (scheduleData?.is_active === false) ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-[var(--surface-subtle)] border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                Disabled
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
