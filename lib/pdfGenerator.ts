/**
 * PDF Generator — Node.js/jsPDF implementation
 * Faithfully replicates generate_report.py output:
 * - Page 1: Cover with score box, company info, period
 * - Page 2: Executive Summary with stat boxes, events table, analyst review
 * - Page 3: Security Issues (vulns, top IPs, file changes)
 * - Page 4: Action Items (failed hardening checks)
 * Brand: Dark Teal #0A6358, Light Teal bg #E6F4F1
 */

const DARK_TEAL   = [10, 99, 88]  as [number, number, number];
const LIGHT_TEAL  = [45, 212, 191] as [number, number, number];
const TEAL_BG     = [230, 244, 241] as [number, number, number];
const BLACK       = [0, 0, 0]      as [number, number, number];
const WHITE       = [255, 255, 255] as [number, number, number];
const GRAY        = [107, 114, 128] as [number, number, number];
const LIGHT_GRAY  = [249, 250, 251] as [number, number, number];
const RED         = [220, 38, 38]   as [number, number, number];
const ORANGE      = [234, 88, 12]   as [number, number, number];
const GREEN       = [22, 163, 74]   as [number, number, number];
const YELLOW      = [202, 138, 4]   as [number, number, number];

function getMaturityColor(score: number): [number, number, number] {
  if (score >= 91) return DARK_TEAL;
  if (score >= 81) return GREEN;
  if (score >= 61) return YELLOW;
  if (score >= 41) return ORANGE;
  return RED;
}

function getMaturityLabel(score: number): string {
  if (score >= 91) return 'EXCELLENT';
  if (score >= 81) return 'GOOD';
  if (score >= 61) return 'NEEDS ATTENTION';
  if (score >= 41) return 'MODERATE RISK';
  return 'CRITICAL RISK';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const dt = new Date(dateStr);
    return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

function stripProtocol(url: string): string {
  return (url || '').replace(/^https?:\/\//, '');
}

function formatAttackType(pattern: string): string {
  const mapping: Record<string, string> = {
    sensitive_404: 'Sensitive File Probe',
    sqli: 'SQL Injection',
    xss: 'Cross-Site Scripting',
    lfi: 'Local File Inclusion',
    rce: 'Remote Code Execution',
    xmlrpc: 'XML-RPC Abuse',
    scanner_ua: 'Security Scanner',
    wpscan_ua: 'WPScan Detected',
  };
  return mapping[pattern?.toLowerCase()] || (pattern || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export async function generatePdfBuffer(reportData: any): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210; // page width
  const PH = 297; // page height
  const M  = 25;  // margin (matches Python 25mm)
  const CW = PW - M * 2; // content width = 160mm
  const HEADER_H = 21;   // 60pt ≈ 21mm
  const FOOTER_H = 16;   // 45pt ≈ 16mm

  const company   = reportData.company   || {};
  const maturity  = reportData.maturity  || {};
  const stats     = reportData.stats     || {};
  const sites     = reportData.sites     || [];
  const score     = maturity.score       ?? 0;
  const matColor  = getMaturityColor(score);
  const matLabel  = getMaturityLabel(score);
  const review    = reportData.analystReview;
  const vulns     = reportData.vulnerablePlugins || [];
  const ips       = reportData.topAttackingIps   || [];
  const files     = reportData.recentFileChanges || [];
  const failed    = reportData.failedChecks      || [];
  const isMultiSite = sites.length > 1;

  const FAIL_NAMES: Record<string, string> = {
    'No Vulnerable Plugins':              'Vulnerable Plugins Detected',
    'No High Open Alerts':               'Too Many High Severity Alerts',
    'No Critical Open Alerts':           'Critical Alerts Unresolved',
    'No Recent File Modification Alerts':'Unexpected File Modifications',
    'Uptime Healthy':                    'Site Offline or Unreachable',
    'Plugin Heartbeat Recent':           'Plugin Not Reporting Data',
    'HTTPS Enforced':                    'HTTPS Not Configured',
  };

  // ── HELPERS ──────────────────────────────────────────────────────────────
  /** Draw horizontal gradient left-to-right (approximated with bands) */
  function drawGradient(x: number, y: number, w: number, h: number,
                        c1: [number,number,number], c2: [number,number,number], steps = 60) {
    const sw = w / steps;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
      doc.setFillColor(r, g, b);
      doc.rect(x + sw * i, y, sw + 0.3, h, 'F');
    }
  }

  /** Draw header + footer on current page */
  function drawHeaderFooter(pageNum: number) {
    // Header gradient
    drawGradient(0, 0, PW, HEADER_H, DARK_TEAL, BLACK);
    // Logo text (fallback — no image loading in jsPDF server-side easily)
    doc.setTextColor(...WHITE);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Cybernara WPShield', M, HEADER_H / 2 + 2);

    // Footer gradient
    drawGradient(0, PH - FOOTER_H, PW, FOOTER_H, DARK_TEAL, BLACK);
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Confidential – Security Report | Page ${pageNum}`, PW - M, PH - FOOTER_H / 2 + 1, { align: 'right' });
  }

  /** Gradient table header row */
  function drawTableHeaderRow(cols: { label: string; x: number; w: number; align?: string }[], y: number, h = 8) {
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    drawGradient(cols[0].x, y, totalW, h, DARK_TEAL, BLACK);
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    cols.forEach(col => {
      const tx = col.align === 'center' ? col.x + col.w / 2 : col.x + 3;
      doc.text(col.label, tx, y + h / 2 + 1.5, { align: col.align === 'center' ? 'center' : 'left' });
    });
    doc.setTextColor(...BLACK);
  }

  /** Alternating row background */
  function rowFill(y: number, h: number, idx: number, cols: { x: number; w: number }[]) {
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    doc.setFillColor(...(idx % 2 === 0 ? WHITE : TEAL_BG));
    doc.rect(cols[0].x, y, totalW, h, 'F');
    // Grid lines
    doc.setDrawColor(...DARK_TEAL);
    doc.setLineWidth(0.2);
    doc.rect(cols[0].x, y, totalW, h, 'S');
  }

  // ── PAGE 1: COVER ────────────────────────────────────────────────────────
  drawHeaderFooter(1);

  let y = HEADER_H + 20;

  // "SECURITY REPORT"
  doc.setTextColor(...DARK_TEAL);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('SECURITY REPORT', PW / 2, y, { align: 'center' });
  y += 10;

  // Company name
  doc.setTextColor(...BLACK);
  doc.setFontSize(18);
  doc.text(company.display_name || '', PW / 2, y, { align: 'center' });
  y += 7;

  // Site URL — for a single site, show it directly; for multiple, show the count
  // instead of just one of several URLs with no indication the others exist.
  doc.setTextColor(...GRAY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(isMultiSite ? `Monitoring ${sites.length} sites` : (company.site_url || ''), PW / 2, y, { align: 'center' });
  y += 5;

  // Thin teal line
  doc.setDrawColor(...DARK_TEAL);
  doc.setLineWidth(0.5);
  doc.line(PW / 2 - 30, y, PW / 2 + 30, y);
  y += 5;

  // Period | Generated
  doc.setFontSize(9);
  const periodText = `Period: ${reportData.period || 'Last 30 Days'}    |    Generated: ${formatDate(reportData.generatedAt)}`;
  doc.text(periodText, PW / 2, y, { align: 'center' });
  y += 12;

  // Score box
  const boxW = 120;
  const boxX = (PW - boxW) / 2;
  const boxH = 48;
  doc.setFillColor(...TEAL_BG);
  doc.setDrawColor(...matColor);
  doc.setLineWidth(1.5);
  doc.roundedRect(boxX, y, boxW, boxH, 3, 3, 'FD');

  // Score number
  doc.setTextColor(...matColor);
  doc.setFontSize(48);
  doc.setFont('helvetica', 'bold');
  doc.text(String(score), PW / 2, y + 24, { align: 'center' });

  // Maturity label
  doc.setFontSize(13);
  doc.text(matLabel, PW / 2, y + 34, { align: 'center' });

  // "out of 100 points"
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('out of 100 points', PW / 2, y + 42, { align: 'center' });
  y += boxH + 8;

  // "Powered by"
  doc.setFontSize(8);
  doc.text('Powered by Cybernara WPShield', PW / 2, y, { align: 'center' });

  // ── PAGE 2: EXECUTIVE SUMMARY ────────────────────────────────────────────
  doc.addPage();
  drawHeaderFooter(2);
  y = HEADER_H + 8;

  doc.setTextColor(...DARK_TEAL);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', M, y);
  y += 3;
  doc.setDrawColor(...DARK_TEAL);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + CW, y);
  y += 8;

  // 4 stat boxes
  const statBoxW = CW / 4;
  const statBoxH = 20;
  const statBoxY = y;
  const statsArr = [
    { label: 'Attacks',      value: stats.totalAttacks     ?? 0 },
    { label: 'Logins',       value: stats.totalLogins      ?? 0 },
    { label: 'File Changes', value: stats.totalFileChanges ?? 0 },
    { label: 'Open Alerts',  value: stats.openAlerts       ?? 0 },
  ];
  statsArr.forEach((s, i) => {
    const bx = M + i * statBoxW;
    doc.setFillColor(...TEAL_BG);
    doc.setDrawColor(...DARK_TEAL);
    doc.setLineWidth(0.3);
    doc.rect(bx, statBoxY, statBoxW, statBoxH, 'FD');
    doc.setTextColor(...DARK_TEAL);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(String(s.value), bx + statBoxW / 2, statBoxY + 11, { align: 'center' });
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(s.label, bx + statBoxW / 2, statBoxY + 17, { align: 'center' });
  });
  y = statBoxY + statBoxH + 8;

  // Per-site score breakdown — only shown when there's more than one site, so a
  // single-site report stays exactly as it was rather than showing a one-row table.
  if (isMultiSite) {
    doc.setTextColor(...DARK_TEAL);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Sites Monitored', M, y);
    y += 6;

    const sCols = [
      { label: 'Site',     x: M,        w: 90 },
      { label: 'Score',    x: M + 90,   w: 30, align: 'center' },
      { label: 'Maturity', x: M + 120,  w: 40 },
    ];
    drawTableHeaderRow(sCols, y, 8);
    y += 8;
    sites.forEach((s: any, i: number) => {
      rowFill(y, 7, i, sCols);
      doc.setTextColor(...BLACK);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(stripProtocol(s.url || '').substring(0, 50), sCols[0].x + 3, y + 5);
      doc.setTextColor(...getMaturityColor(s.score));
      doc.setFont('helvetica', 'bold');
      doc.text(String(s.score), sCols[1].x + sCols[1].w / 2, y + 5, { align: 'center' });
      doc.text(String(s.maturity || ''), sCols[2].x + 3, y + 5);
      y += 7;
    });
    y += 8;
  }

  // Analyst review
  if (review?.status === 'published') {
    doc.setTextColor(...DARK_TEAL);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Security Analyst Summary', M, y);
    y += 6;
    doc.setTextColor(...BLACK);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (review.vulnerable_plugins_note) {
      doc.setFont('helvetica', 'bold');
      doc.text('Plugins: ', M, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(review.vulnerable_plugins_note, CW - 20);
      doc.text(lines, M + 18, y);
      y += lines.length * 5 + 2;
    }
    if (review.failed_hardening_note) {
      doc.setFont('helvetica', 'bold');
      doc.text('Hardening: ', M, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(review.failed_hardening_note, CW - 22);
      doc.text(lines, M + 22, y);
      y += lines.length * 5 + 2;
    }
    if (review.suspicious_logins_note) {
      doc.setFont('helvetica', 'bold');
      doc.text('Logins: ', M, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(review.suspicious_logins_note, CW - 18);
      doc.text(lines, M + 18, y);
      y += lines.length * 5 + 2;
    }
    y += 4;
  }

  // Health sentence
  const health = score >= 80 ? 'Your site is in good security health.'
    : score >= 60 ? 'Your site needs some security attention.'
    : 'Your site has critical security issues that need immediate action.';
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'oblique');
  doc.text(health, M, y);
  y += 8;

  // Events table
  doc.setTextColor(...DARK_TEAL);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Events This Period', M, y);
  y += 5;

  const evCols = [
    { label: 'Type',   x: M,       w: 70 },
    { label: 'Count',  x: M + 70,  w: 40, align: 'center' },
    { label: 'Status', x: M + 110, w: 50 },
  ];
  drawTableHeaderRow(evCols, y);
  y += 8;

  const evRows = [
    ['Attack Attempts', String(stats.totalAttacks ?? 0), 'Review Required'],
    ['Login Attempts',  String(stats.totalLogins  ?? 0), 'Normal Activity'],
    ['File Changes',    String(stats.totalFileChanges ?? 0), 'Review Required'],
    ['Open Alerts',     String(stats.openAlerts   ?? 0), 'Action Needed'],
  ];
  evRows.forEach((row, i) => {
    rowFill(y, 7, i, evCols);
    doc.setTextColor(...BLACK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(row[0], evCols[0].x + 3, y + 5);
    doc.text(row[1], evCols[1].x + evCols[1].w / 2, y + 5, { align: 'center' });
    doc.text(row[2], evCols[2].x + 3, y + 5);
    y += 7;
  });

  // ── PAGE 3: SECURITY ISSUES ──────────────────────────────────────────────
  doc.addPage();
  drawHeaderFooter(3);
  y = HEADER_H + 8;

  doc.setTextColor(...DARK_TEAL);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Security Issues Found', M, y);
  y += 3;
  doc.setDrawColor(...DARK_TEAL);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + CW, y);
  y += 8;

  // Vulnerable Plugins
  doc.setFontSize(13);
  doc.text('Vulnerable Plugins', M, y);
  y += 6;

  if (vulns.length > 0) {
    const vCols = isMultiSite
      ? [
          { label: 'Plugin',      x: M,        w: 38 },
          { label: 'Site',        x: M + 38,   w: 32 },
          { label: 'Version',     x: M + 70,   w: 15 },
          { label: 'CVE ID',      x: M + 85,   w: 20 },
          { label: 'Severity',    x: M + 105,  w: 18 },
          { label: 'Fix Version', x: M + 123,  w: 37 },
        ]
      : [
          { label: 'Plugin',      x: M,        w: 55 },
          { label: 'Version',     x: M + 55,   w: 20 },
          { label: 'CVE ID',      x: M + 75,   w: 28 },
          { label: 'Severity',    x: M + 103,  w: 22 },
          { label: 'Fix Version', x: M + 125,  w: 35 },
        ];
    drawTableHeaderRow(vCols, y, 8);
    y += 8;
    vulns.forEach((v: any, i: number) => {
      const rh = 7;
      rowFill(y, rh, i, vCols);
      doc.setTextColor(...BLACK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      let colIdx = 0;
      doc.text(String(v.plugin_name || '').substring(0, isMultiSite ? 20 : 25), vCols[colIdx].x + 2, y + 5);
      colIdx++;
      if (isMultiSite) {
        doc.text(stripProtocol(v.site_url || '—').substring(0, 22), vCols[colIdx].x + 2, y + 5);
        colIdx++;
      }
      doc.text(String(v.plugin_version || ''), vCols[colIdx].x + 2, y + 5);
      colIdx++;
      doc.text(String(v.cve_id || '—').substring(0, isMultiSite ? 12 : 15), vCols[colIdx].x + 2, y + 5);
      colIdx++;
      const sev = String(v.severity || '').toUpperCase();
      doc.setTextColor(...(sev === 'CRITICAL' || sev === 'HIGH' ? RED : ORANGE));
      doc.setFont('helvetica', 'bold');
      doc.text(sev, vCols[colIdx].x + 2, y + 5);
      colIdx++;
      doc.setTextColor(...BLACK);
      doc.setFont('helvetica', 'normal');
      doc.text(String(v.fixed_in || 'Unpatched'), vCols[colIdx].x + 2, y + 5);
      y += rh;
    });
    y += 4;
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'oblique');
    doc.text('Update these plugins immediately to protect your site.', M, y);
  } else {
    doc.setTextColor(...GREEN);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('No vulnerable plugins detected. ✓', M, y);
  }
  y += 10;

  // Top Attacking IPs
  doc.setTextColor(...DARK_TEAL);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Top Attacking IPs', M, y);
  y += 6;

  if (ips.length > 0) {
    const iCols = [
      { label: 'IP Address',    x: M,       w: 60 },
      { label: 'Attack Count',  x: M + 60,  w: 35, align: 'center' },
      { label: 'Attack Type',   x: M + 95,  w: 65 },
    ];
    drawTableHeaderRow(iCols, y, 8);
    y += 8;
    ips.forEach((ip: any, i: number) => {
      rowFill(y, 7, i, iCols);
      doc.setTextColor(...BLACK);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(String(ip.ip || ''), iCols[0].x + 3, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.text(String(ip.count || 0), iCols[1].x + iCols[1].w / 2, y + 5, { align: 'center' });
      doc.text(formatAttackType(ip.pattern_type), iCols[2].x + 3, y + 5);
      y += 7;
    });
    y += 4;
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'oblique');
    doc.text('These IP addresses have been repeatedly trying to break into your site.', M, y);
  } else {
    doc.setTextColor(...GREEN);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('No suspicious IP activity detected. ✓', M, y);
  }
  y += 10;

  // Recent File Changes
  doc.setTextColor(...DARK_TEAL);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Recent File Changes', M, y);
  y += 6;

  if (files.length > 0) {
    const fCols = isMultiSite
      ? [
          { label: 'File Path',    x: M,       w: 58 },
          { label: 'Site',         x: M + 58,  w: 35 },
          { label: 'Change Type',  x: M + 93,  w: 22, align: 'center' },
          { label: 'Date',         x: M + 115, w: 45 },
        ]
      : [
          { label: 'File Path',    x: M,       w: 85 },
          { label: 'Change Type',  x: M + 85,  w: 25, align: 'center' },
          { label: 'Date',         x: M + 110, w: 50 },
        ];
    drawTableHeaderRow(fCols, y, 8);
    y += 8;
    files.forEach((f: any, i: number) => {
      let path = String(f.path || '');
      const maxPathLen = isMultiSite ? 32 : 45;
      if (path.length > maxPathLen) path = '...' + path.slice(-(maxPathLen - 3));
      const change = String(f.event || '').replace('file_', '').replace(/\b\w/g, (c: string) => c.toUpperCase());
      rowFill(y, 7, i, fCols);
      doc.setTextColor(...BLACK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      let colIdx = 0;
      doc.text(path, fCols[colIdx].x + 2, y + 5);
      colIdx++;
      if (isMultiSite) {
        doc.text(stripProtocol(f.site_url || '—').substring(0, 25), fCols[colIdx].x + 2, y + 5);
        colIdx++;
      }
      doc.text(change, fCols[colIdx].x + fCols[colIdx].w / 2, y + 5, { align: 'center' });
      colIdx++;
      doc.text(formatDate(f.occurred_at), fCols[colIdx].x + 2, y + 5);
      y += 7;
    });
    y += 4;
    doc.setTextColor(...GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'oblique');
    doc.text('These files were modified on your site. Review if unexpected.', M, y);
  } else {
    doc.setTextColor(...GREEN);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('No recent file modifications detected. ✓', M, y);
  }

  // ── PAGE 4: ACTION ITEMS ─────────────────────────────────────────────────
  doc.addPage();
  drawHeaderFooter(4);
  y = HEADER_H + 8;

  doc.setTextColor(...DARK_TEAL);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('What You Need To Do', M, y);
  y += 3;
  doc.setDrawColor(...DARK_TEAL);
  doc.setLineWidth(0.5);
  doc.line(M, y, M + CW, y);
  y += 5;
  doc.setTextColor(...GRAY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'oblique');
  doc.text('These are the security issues that need your attention, sorted by importance.', M, y);
  y += 8;

  if (failed.length > 0) {
    const aCols = isMultiSite
      ? [
          { label: 'Issue',      x: M,       w: 38 },
          { label: 'Site',       x: M + 38,  w: 32 },
          { label: 'Risk Level', x: M + 70,  w: 20, align: 'center' },
          { label: 'What To Do', x: M + 90,  w: 70 },
        ]
      : [
          { label: 'Issue',      x: M,       w: 55 },
          { label: 'Risk Level', x: M + 55,  w: 25, align: 'center' },
          { label: 'What To Do', x: M + 80,  w: 80 },
        ];
    drawTableHeaderRow(aCols, y, 8);
    y += 8;

    failed.forEach((c: any, i: number) => {
      const displayName = FAIL_NAMES[c.check_name] || c.check_name || '';
      const priority    = String(c.priority || 'medium').toUpperCase();
      const priColor: [number,number,number] =
        priority === 'HIGH'   ? RED :
        priority === 'MEDIUM' ? ORANGE : GREEN;
      const whatToDoCol = aCols[aCols.length - 1];
      const rec = String(c.recommendation || '');
      const recLines = doc.splitTextToSize(rec, whatToDoCol.w - 4);
      const rh = Math.max(7, recLines.length * 4.5 + 3);

      rowFill(y, rh, i, aCols);
      doc.setTextColor(...BLACK);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const nameLines = doc.splitTextToSize(displayName, aCols[0].w - 4);
      doc.text(nameLines, aCols[0].x + 3, y + 5);
      let colIdx = 1;
      if (isMultiSite) {
        doc.setFontSize(8);
        doc.text(stripProtocol(c.site_url || '—').substring(0, 26), aCols[colIdx].x + 3, y + 5);
        doc.setFontSize(9);
        colIdx++;
      }
      doc.setTextColor(...priColor);
      doc.setFont('helvetica', 'bold');
      doc.text(priority, aCols[colIdx].x + aCols[colIdx].w / 2, y + 5, { align: 'center' });
      doc.setTextColor(...BLACK);
      doc.setFont('helvetica', 'normal');
      doc.text(recLines, whatToDoCol.x + 3, y + 5);
      y += rh;
    });
  } else {
    doc.setTextColor(...GREEN);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Great job! No action items at this time.', M, y);
  }

  return Buffer.from(doc.output('arraybuffer'));
}