"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Loader2, Save, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { getCompaniesList } from "./actions";

export default function AdminReviewsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const [review, setReview] = useState({
    vulnerable_plugins_note: "",
    failed_hardening_note: "",
    suspicious_logins_note: "",
    status: "draft"
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function loadCompanies() {
      try {
        const data = await getCompaniesList();
        if (data) {
          setCompanies(data);
          if (data.length > 0) setSelectedCompanyId(data[0].company_id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadCompanies();
  }, []);

  useEffect(() => {
    async function loadReview() {
      if (!selectedCompanyId || !monthYear) return;
      const res = await fetch(`/api/reports/reviews?company_id=${selectedCompanyId}&month_year=${monthYear}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setReview({
            vulnerable_plugins_note: data[0].vulnerable_plugins_note || "",
            failed_hardening_note: data[0].failed_hardening_note || "",
            suspicious_logins_note: data[0].suspicious_logins_note || "",
            status: data[0].status || "draft"
          });
        } else {
          setReview({ vulnerable_plugins_note: "", failed_hardening_note: "", suspicious_logins_note: "", status: "draft" });
        }
      }
    }
    loadReview();
  }, [selectedCompanyId, monthYear]);

  const saveReview = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/reports/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: selectedCompanyId,
          month_year: monthYear,
          ...review
        })
      });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Success", description: "Review notes saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedCompanyId) return;
    setGeneratingPdf(true);
    try {
      const response = await fetch(`/api/reports/pdf?period=30&company_id=${selectedCompanyId}`);
      if (!response.ok) {
        throw new Error("Failed to download PDF report");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `security-report-${selectedCompanyId}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: "Custom PDF report generated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "PDF Export Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-8 p-8 animate-in fade-in duration-300">
      <PageHeader
        title="Managed Analyst Reviews"
        subtitle="Write executive summaries to be included in client's monthly reports."
      />
      <div className="rounded-2xl border border-[var(--border)] bg-surface p-8 shadow-sm space-y-6">
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold">Select Client</label>
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="w-full p-2 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl"
            >
              {companies.map(c => (
                <option key={c.company_id} value={c.company_id}>{c.display_name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold">Month</label>
            <input
              type="month"
              value={monthYear}
              onChange={(e) => setMonthYear(e.target.value)}
              className="w-full p-2 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl"
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-semibold">Status</label>
            <select
              value={review.status}
              onChange={(e) => setReview({...review, status: e.target.value})}
              className="w-full p-2 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl"
            >
              <option value="draft">Draft (Hidden from client)</option>
              <option value="published">Published (Visible in PDF)</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Vulnerable Plugins Note</label>
            <textarea
              value={review.vulnerable_plugins_note}
              onChange={(e) => setReview({...review, vulnerable_plugins_note: e.target.value})}
              className="w-full h-24 p-3 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl"
              placeholder="e.g., We noticed 3 plugins are out of date..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Hardening & Alerts Note</label>
            <textarea
              value={review.failed_hardening_note}
              onChange={(e) => setReview({...review, failed_hardening_note: e.target.value})}
              className="w-full h-24 p-3 bg-[var(--surface-subtle)] border border-[var(--border)] rounded-xl"
              placeholder="e.g., Please disable file editing in wp-config..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 gap-3">
          <Button 
            onClick={handleDownloadPDF} 
            disabled={generatingPdf || !selectedCompanyId} 
            variant="outline"
            className="border-[#2DD4BF] text-[#0A6358] hover:bg-[#2DD4BF]/10 font-bold h-10 px-6 rounded-xl"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />} 
            Generate Custom PDF Report
          </Button>
          <Button onClick={saveReview} disabled={saving} className="bg-[#2DD4BF] text-[#0A6358] hover:bg-[#20B2AA] font-bold h-10 px-6 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Save Analyst Review
          </Button>
        </div>
      </div>
    </div>
  );
}
