"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { format } from "date-fns";
import { Clock, CheckCircle2, XCircle } from "lucide-react";

export function ReportsHistoryClient() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/reports/history");
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <PageHeader
        title="Report History"
        subtitle="Log of all automated PDF reports generated and emailed to your team."
      />

      <div className="rounded-2xl border border-[var(--border)] bg-surface shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--muted)]">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="p-16 text-center space-y-4">
            <Clock className="w-12 h-12 mx-auto text-[var(--muted)]/50" />
            <div className="text-lg font-bold text-[var(--foreground)]">No Reports Yet</div>
            <p className="text-sm text-[var(--muted)] max-w-sm mx-auto">
              You haven't generated any automated reports yet. Setup Automated Delivery in the Export Reports tab.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-[var(--muted)] uppercase bg-[var(--surface-subtle)] border-b border-[var(--border)]">
              <tr>
                <th className="px-6 py-4 font-semibold">Date Generated</th>
                <th className="px-6 py-4 font-semibold">Report Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {history.map((log) => (
                <tr key={log.id} className="hover:bg-[var(--surface-subtle)]/50 transition-colors">
                  <td className="px-6 py-4 text-[var(--foreground)] font-medium">
                    {format(new Date(log.generated_at), "MMM d, yyyy 'at' h:mm a")}
                  </td>
                  <td className="px-6 py-4 text-[var(--foreground)] capitalize">
                    {log.report_type}
                  </td>
                  <td className="px-6 py-4">
                    {log.status === "success" ? (
                      <span className="flex items-center text-emerald-500 gap-1 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" /> Delivered
                      </span>
                    ) : (
                      <span className="flex items-center text-red-500 gap-1 text-xs font-bold">
                        <XCircle className="w-4 h-4" /> Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}