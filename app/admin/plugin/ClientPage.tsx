"use client";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Upload, CheckCircle, Package } from "lucide-react";

interface Release {
  id: string;
  version: string;
  changelog: string;
  zip_url: string;
  is_latest: boolean;
  released_at: string;
}

export default function AdminPluginPage() {
  const [releases, setReleases]   = useState<Release[]>([]);
  const [version, setVersion]     = useState("");
  const [changelog, setChangelog] = useState("");
  const [file, setFile]           = useState<File | null>(null);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadReleases = async () => {
    const res = await fetch("/api/admin/plugin/upload");
    const data = await res.json();
    if (data.releases) setReleases(data.releases);
  };

  useEffect(() => { loadReleases(); }, []);

  const handleUpload = async () => {
    if (!file || !version.trim()) {
      setMessage({ type: "error", text: "Version and zip file are required." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("zip", file);
      form.append("version", version.trim());
      form.append("changelog", changelog.trim());

      const res  = await fetch("/api/admin/plugin/upload", { method: "POST", body: form });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: `Version ${data.release.version} uploaded and set as latest.` });
        setVersion(""); setChangelog(""); setFile(null);
        loadReleases();
      } else {
        setMessage({ type: "error", text: data.error || "Upload failed." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Plugin Releases" subtitle="Upload new plugin versions for auto-update delivery"/>

      {/* Upload form */}
      <div className="rounded-2xl border border-[var(--border)] bg-surface p-6 space-y-4 max-w-xl">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Upload className="h-5 w-5" strokeWidth={1.5}/> Upload New Release
        </h2>

        <div>
          <label className="block text-sm font-medium mb-1">Version <span className="text-red-500">*</span></label>
          <input
            value={version}
            onChange={e => setVersion(e.target.value)}
            placeholder="e.g. 3.1.0"
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Changelog</label>
          <textarea
            value={changelog}
            onChange={e => setChangelog(e.target.value)}
            placeholder="What changed in this version..."
            rows={3}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Plugin ZIP <span className="text-red-500">*</span></label>
          <input
            type="file"
            accept=".zip"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm"
          />
          {file && <p className="text-xs text-[var(--muted)] mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
        </div>

        {message && (
          <div className={`text-sm p-3 rounded-lg ${message.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {message.text}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full bg-[var(--foreground)] text-white py-2.5 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? "Uploading..." : "Upload & Set as Latest"}
        </button>
      </div>

      {/* Release history */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          <Package className="h-5 w-5" strokeWidth={1.5}/> Release History
        </h2>
        {releases.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No releases uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {releases.map(r => (
              <div key={r.id} className="flex items-start justify-between rounded-xl border border-[var(--border)] bg-surface p-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm">v{r.version}</span>
                    {r.is_latest && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle className="h-3 w-3"/> Latest
                      </span>
                    )}
                  </div>
                  {r.changelog && <p className="text-xs text-[var(--muted)] max-w-md">{r.changelog}</p>}
                  <p className="text-xs text-[var(--muted)] mt-1">{new Date(r.released_at).toLocaleString()}</p>
                </div>
                <a href={r.zip_url} className="text-xs text-[var(--brand)] hover:underline shrink-0 ml-4">Download</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}