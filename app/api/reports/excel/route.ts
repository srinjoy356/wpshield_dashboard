/**
 * Excel Report Route — Node.js/ExcelJS implementation
 * Faithfully replicates generate_excel.py output:
 * 5 sheets: Summary, Attacks, File Changes, Vulnerable Plugins, Action Items
 * Brand: Dark Teal #0A6358, Light Teal BG #E6F4F1
 * No Python, no openpyxl — works on Render out of the box.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/queries/profile";
import { getReportData } from "@/lib/reportData";
import type ExcelJS from "exceljs";

export const dynamic = "force-dynamic";

const DARK_TEAL   = "0A6358";
const LIGHT_TEAL  = "E6F4F1";
const WHITE       = "FFFFFF";
const BLACK       = "000000";
const GRAY        = "6B7280";
const RED         = "DC2626";
const ORANGE      = "EA580C";
const GREEN       = "16A34A";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return dateStr; }
}

function formatAttackType(pattern: string): string {
  const m: Record<string, string> = {
    sensitive_404: "Sensitive File Probe",
    sqli: "SQL Injection",
    xss: "Cross-Site Scripting",
    lfi: "Local File Inclusion",
    rce: "Remote Code Execution",
    xmlrpc: "XML-RPC Abuse",
    scanner_ua: "Security Scanner",
    wpscan_ua: "WPScan Detected",
  };
  return m[pattern?.toLowerCase()] || (pattern || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const profile  = await getCurrentProfile(supabase);

    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get("company_id");
    const companyId = ["admin","super_admin"].includes(profile.role) && requestedCompanyId
      ? requestedCompanyId
      : profile.company_id;

    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 });
    }

    const periodDays = parseInt(searchParams.get("period") || "30", 10);
    const reportData = await getReportData(supabase, companyId, periodDays);

    // ── Build workbook with ExcelJS ──────────────────────────────────────────
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();

    wb.creator  = "Cybernara WPShield";
    wb.created  = new Date();
    wb.modified = new Date();

    const company  = reportData.company  || {};
    const maturity = reportData.maturity || {};
    const stats    = reportData.stats    || {};
    const sites    = reportData.sites    || [];
    const vulns    = reportData.vulnerablePlugins || [];
    const ips      = reportData.topAttackingIps   || [];
    const files    = reportData.recentFileChanges || [];
    const failed   = reportData.failedChecks      || [];
    const score    = maturity.score  ?? 0;
    const label    = maturity.label  ?? "Needs Attention";

    const FAIL_NAMES: Record<string, string> = {
      "No Vulnerable Plugins":               "Vulnerable Plugins Detected",
      "No High Open Alerts":                "Too Many High Severity Alerts",
      "No Critical Open Alerts":            "Critical Alerts Unresolved",
      "No Recent File Modification Alerts": "Unexpected File Modifications",
      "Uptime Healthy":                     "Site Offline or Unreachable",
      "Plugin Heartbeat Recent":            "Plugin Not Reporting Data",
      "HTTPS Enforced":                     "HTTPS Not Configured",
    };

    // Helper: title cell
    function addTitle(ws: ExcelJS.Worksheet, text: string, colSpan: number) {
      ws.mergeCells(1, 1, 1, colSpan);
      const cell = ws.getCell("A1");
      cell.value = text;
      cell.font  = { name: "Calibri", size: 16, bold: true, color: { argb: `FF${WHITE}` } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${DARK_TEAL}` } };
      cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      ws.getRow(1).height = 40;
      ws.getRow(2).height = 10; // spacer
    }

    // Helper: header row
    function addHeaders(ws: ExcelJS.Worksheet, headers: string[], rowNum: number) {
      ws.getRow(rowNum).height = 26;
      headers.forEach((h, i) => {
        const cell = ws.getCell(rowNum, i + 1);
        cell.value = h;
        cell.font  = { name: "Calibri", size: 11, bold: true, color: { argb: `FF${WHITE}` } };
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${DARK_TEAL}` } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      });
    }

    // Helper: data row
    function styleDataRow(ws: ExcelJS.Worksheet, rowNum: number, colCount: number, isOdd: boolean) {
      ws.getRow(rowNum).height = 22;
      const fillColor = isOdd ? `FF${LIGHT_TEAL}` : `FF${WHITE}`;
      for (let c = 1; c <= colCount; c++) {
        const cell = ws.getCell(rowNum, c);
        cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        cell.font  = { name: "Calibri", size: 10, color: { argb: `FF${BLACK}` } };
        cell.alignment = { vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD1D5DB" } },
          left: { style: "thin", color: { argb: "FFD1D5DB" } },
          bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
          right: { style: "thin", color: { argb: "FFD1D5DB" } },
        };
      }
    }

    // ── SHEET 1: SUMMARY ───────────────────────────────────────────────────
    const ws1 = wb.addWorksheet("Summary");
    addTitle(ws1, "SECURITY REPORT SUMMARY", 5);

    // Section label
    ws1.getRow(3).height = 20;
    const secLabel = ws1.getCell("A3");
    secLabel.value = "Report Details";
    secLabel.font  = { name: "Calibri", size: 12, bold: true, color: { argb: `FF${DARK_TEAL}` } };

    const meta = [
      ["Company Name",    company.display_name || ""],
      ["Site(s)",         sites.length > 1 ? `${sites.length} sites (see Sites sheet)` : (company.site_url || "")],
      ["Report Period",   reportData.period     || "Last 30 Days"],
      ["Hardening Score", score],
      ["Hardening Level", label],
    ];
    meta.forEach(([k, v], i) => {
      const r = 4 + i;
      ws1.getRow(r).height = 22;
      const lCell = ws1.getCell(r, 1);
      lCell.value = k;
      lCell.font  = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${BLACK}` } };
      lCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${LIGHT_TEAL}` } };
      lCell.alignment = { vertical: "middle", indent: 1 };
      lCell.border = { top: { style: "thin", color: { argb: "FFD1D5DB" } }, left: { style: "thin", color: { argb: "FFD1D5DB" } }, bottom: { style: "thin", color: { argb: "FFD1D5DB" } }, right: { style: "thin", color: { argb: "FFD1D5DB" } } };

      ws1.mergeCells(r, 2, r, 5);
      const vCell = ws1.getCell(r, 2);
      vCell.value = v;
      vCell.font  = { name: "Calibri", size: 10, bold: k === "Hardening Score", color: { argb: k === "Hardening Score" ? `FF${DARK_TEAL}` : `FF${BLACK}` } };
      vCell.alignment = { vertical: "middle", indent: 1 };
      vCell.border = { top: { style: "thin", color: { argb: "FFD1D5DB" } }, left: { style: "thin", color: { argb: "FFD1D5DB" } }, bottom: { style: "thin", color: { argb: "FFD1D5DB" } }, right: { style: "thin", color: { argb: "FFD1D5DB" } } };
    });

    // Stats block
    ws1.getRow(11).height = 20;
    ws1.getCell("A11").value = "Core Security Metrics";
    ws1.getCell("A11").font  = { name: "Calibri", size: 12, bold: true, color: { argb: `FF${DARK_TEAL}` } };

    addHeaders(ws1, ["Metric", "Count"], 12);
    const statsRows = [
      ["Total Attack Attempts",  stats.totalAttacks     ?? 0],
      ["Total Login Attempts",   stats.totalLogins      ?? 0],
      ["Total File Changes",     stats.totalFileChanges ?? 0],
      ["Open Security Alerts",   stats.openAlerts       ?? 0],
    ];
    statsRows.forEach(([k, v], i) => {
      const r = 13 + i;
      styleDataRow(ws1, r, 2, i % 2 === 1);
      ws1.getCell(r, 1).value = k;
      ws1.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
      ws1.getCell(r, 2).value = v;
      ws1.getCell(r, 2).alignment = { horizontal: "center", vertical: "middle" };
    });

    ws1.getColumn(1).width = 25;
    ws1.getColumn(2).width = 15;
    [3, 4, 5].forEach(c => ws1.getColumn(c).width = 15);

    // ── SHEET: SITES (only when there's more than one to break out) ───────
    if (sites.length > 1) {
      const wsSites = wb.addWorksheet("Sites");
      addTitle(wsSites, "SITES MONITORED", 3);
      addHeaders(wsSites, ["Site URL", "Hardening Score", "Maturity"], 3);
      sites.forEach((s: any, i: number) => {
        const r = 4 + i;
        styleDataRow(wsSites, r, 3, i % 2 === 1);
        wsSites.getCell(r, 1).value = s.url || "";
        wsSites.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
        wsSites.getCell(r, 2).value = s.score ?? 0;
        wsSites.getCell(r, 2).font = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${DARK_TEAL}` } };
        wsSites.getCell(r, 2).alignment = { horizontal: "center", vertical: "middle" };
        wsSites.getCell(r, 3).value = s.maturity || "";
        wsSites.getCell(r, 3).alignment = { vertical: "middle", indent: 1 };
      });
      [1, 2, 3].forEach((c, i) => { wsSites.getColumn(c).width = [40, 18, 20][i]; });
    }

    // ── SHEET 2: ATTACKS ──────────────────────────────────────────────────
    const ws2 = wb.addWorksheet("Attacks");
    addTitle(ws2, "TOP ATTACKING IP ADDRESSES", 3);
    addHeaders(ws2, ["IP Address", "Attack Count", "Attack Type"], 3);
    ips.forEach((ip: any, i: number) => {
      const r = 4 + i;
      styleDataRow(ws2, r, 3, i % 2 === 1);
      ws2.getCell(r, 1).value = ip.ip || "";
      ws2.getCell(r, 1).font  = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${BLACK}` } };
      ws2.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
      ws2.getCell(r, 2).value = ip.count || 0;
      ws2.getCell(r, 2).alignment = { horizontal: "center", vertical: "middle" };
      ws2.getCell(r, 3).value = formatAttackType(ip.pattern_type);
      ws2.getCell(r, 3).alignment = { vertical: "middle", indent: 1 };
    });
    [1, 2, 3].forEach(c => { ws2.getColumn(c).width = c === 1 ? 20 : c === 2 ? 15 : 25; });

    // ── SHEET 3: FILE CHANGES ─────────────────────────────────────────────
    const ws3 = wb.addWorksheet("File Changes");
    addTitle(ws3, "RECENT FILE MODIFICATIONS", 4);
    addHeaders(ws3, ["File Path", "Site", "Change Type", "Date"], 3);
    files.forEach((f: any, i: number) => {
      const r = 4 + i;
      styleDataRow(ws3, r, 4, i % 2 === 1);
      ws3.getCell(r, 1).value = f.path || "";
      ws3.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
      ws3.getCell(r, 2).value = f.site_url || "—";
      ws3.getCell(r, 2).alignment = { vertical: "middle", indent: 1 };
      ws3.getCell(r, 3).value = (f.event || "").replace("file_", "").replace(/\b\w/g, (c: string) => c.toUpperCase());
      ws3.getCell(r, 3).alignment = { horizontal: "center", vertical: "middle" };
      ws3.getCell(r, 4).value = formatDate(f.occurred_at);
      ws3.getCell(r, 4).alignment = { vertical: "middle", indent: 1 };
    });
    [1, 2, 3, 4].forEach((c, i) => { ws3.getColumn(c).width = [55, 35, 18, 28][i]; });

    // ── SHEET 4: VULNERABLE PLUGINS ───────────────────────────────────────
    const ws4 = wb.addWorksheet("Vulnerable Plugins");
    addTitle(ws4, "VULNERABLE PLUGINS DETECTED", 6);
    addHeaders(ws4, ["Plugin Name", "Site", "Version", "CVE ID", "Severity", "Fixed In"], 3);
    vulns.forEach((v: any, i: number) => {
      const r = 4 + i;
      styleDataRow(ws4, r, 6, i % 2 === 1);
      ws4.getCell(r, 1).value = v.plugin_name || "";
      ws4.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
      ws4.getCell(r, 2).value = v.site_url || "—";
      ws4.getCell(r, 2).alignment = { vertical: "middle", indent: 1 };
      ws4.getCell(r, 3).value = v.plugin_version || "";
      ws4.getCell(r, 3).alignment = { horizontal: "center", vertical: "middle" };
      ws4.getCell(r, 4).value = v.cve_id || "—";
      ws4.getCell(r, 4).alignment = { horizontal: "center", vertical: "middle" };
      const sev = String(v.severity || "").toUpperCase();
      ws4.getCell(r, 5).value = sev;
      ws4.getCell(r, 5).font  = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${sev === "CRITICAL" || sev === "HIGH" ? RED : ORANGE}` } };
      ws4.getCell(r, 5).alignment = { horizontal: "center", vertical: "middle" };
      ws4.getCell(r, 6).value = v.fixed_in || "Unpatched";
      ws4.getCell(r, 6).alignment = { vertical: "middle", indent: 1 };
    });
    [1, 2, 3, 4, 5, 6].forEach((c, i) => { ws4.getColumn(c).width = [30, 32, 12, 20, 14, 15][i]; });

    // ── SHEET 5: ACTION ITEMS ─────────────────────────────────────────────
    const ws5 = wb.addWorksheet("Action Items");
    addTitle(ws5, "ACTION ITEMS REQUIRED", 4);
    addHeaders(ws5, ["Check Name", "Site", "Risk Level", "Recommendation"], 3);
    failed.forEach((c: any, i: number) => {
      const r = 4 + i;
      styleDataRow(ws5, r, 4, i % 2 === 1);
      ws5.getCell(r, 1).value = FAIL_NAMES[c.check_name] || c.check_name || "";
      ws5.getCell(r, 1).alignment = { vertical: "middle", indent: 1 };
      ws5.getCell(r, 2).value = c.site_url || "—";
      ws5.getCell(r, 2).alignment = { vertical: "middle", indent: 1 };
      const pri = String(c.priority || "medium").toUpperCase();
      ws5.getCell(r, 3).value = pri;
      ws5.getCell(r, 3).font  = { name: "Calibri", size: 10, bold: true, color: { argb: `FF${pri === "HIGH" ? RED : pri === "MEDIUM" ? ORANGE : GREEN}` } };
      ws5.getCell(r, 3).alignment = { horizontal: "center", vertical: "middle" };
      ws5.getCell(r, 4).value = c.recommendation || "";
      ws5.getCell(r, 4).alignment = { vertical: "middle", wrapText: true, indent: 1 };
    });
    [1, 2, 3, 4].forEach((c, i) => { ws5.getColumn(c).width = [35, 32, 15, 55][i]; });

    // ── Output ────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer() as unknown as Buffer;
    const safeCompanyName = (company.display_name || companyId).replace(/[^a-zA-Z0-9-_]/g, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `security-data-${safeCompanyName}-${dateStr}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error("Failed to generate Excel report:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}