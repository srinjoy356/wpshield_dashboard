/**
 * Pure Node.js PDF generator — no Python, no reportlab, no spawn.
 * Uses jsPDF which is already a dependency in the project.
 * Works on Render, Vercel, or any Node.js environment.
 */

export async function generatePdfBuffer(reportData: any): Promise<Buffer> {
  // Dynamically import jsPDF to avoid SSR issues
  const { jsPDF } = await import('jspdf');
  
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const company     = reportData.company     || {};
  const summary     = reportData.summary     || {};
  const attacks     = reportData.attacks     || [];
  const vulnAlerts  = reportData.vulnAlerts  || [];
  const hardening   = reportData.hardening   || {};

  const pageW  = 210;
  const margin = 16;
  const colW   = pageW - margin * 2;
  let   y      = margin;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const newPageIfNeeded = (needed = 20) => {
    if (y + needed > 277) { doc.addPage(); y = margin; }
  };

  const sectionTitle = (text: string) => {
    newPageIfNeeded(14);
    doc.setFillColor(28, 25, 23);
    doc.rect(margin, y, colW, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(text.toUpperCase(), margin + 3, y + 5.5);
    doc.setTextColor(28, 25, 23);
    y += 12;
  };

  const row = (label: string, value: string, indent = 0) => {
    newPageIfNeeded(7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin + indent, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value ?? '—'), margin + indent + 50, y);
    y += 6;
  };

  const bodyText = (text: string, indent = 0) => {
    newPageIfNeeded(7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, colW - indent);
    doc.text(lines, margin + indent, y);
    y += lines.length * 5 + 2;
  };

  const divider = () => {
    newPageIfNeeded(5);
    doc.setDrawColor(231, 229, 228);
    doc.line(margin, y, margin + colW, y);
    y += 5;
  };

  // ── COVER ──────────────────────────────────────────────────────────────────
  // Header bar
  doc.setFillColor(13, 148, 136); // brand teal
  doc.rect(0, 0, 210, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('WPShield Security Report', margin, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Powered by Cybernara', margin, 23);

  y = 42;
  doc.setTextColor(28, 25, 23);

  // Company info card
  doc.setFillColor(247, 246, 245);
  doc.roundedRect(margin, y, colW, 36, 3, 3, 'F');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(company.display_name || 'Unknown Company', margin + 6, y + 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 113, 108);
  doc.text(`Site: ${company.site_url || '—'}`, margin + 6, y + 18);
  doc.text(`Report Period: Last ${reportData.periodDays || 30} days`, margin + 6, y + 24);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin + 6, y + 30);
  doc.setTextColor(28, 25, 23);
  y += 44;

  // Score badge
  const score = hardening.score ?? 0;
  const scoreColor: [number, number, number] =
    score >= 90 ? [13, 148, 136] :
    score >= 70 ? [34, 197, 94]  :
    score >= 50 ? [234, 179, 8]  :
                  [239, 68, 68];

  doc.setFillColor(...scoreColor);
  doc.roundedRect(margin, y, 60, 24, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${score}/100`, margin + 6, y + 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Security Score', margin + 6, y + 20);
  doc.setTextColor(28, 25, 23);

  // Quick stats beside score
  const stats = [
    { label: 'Total Attacks',    value: String(summary.totalAttacks   ?? attacks.length) },
    { label: 'Open Alerts',      value: String(summary.openAlerts     ?? '0')             },
    { label: 'Vuln Plugins',     value: String(vulnAlerts.length)                         },
  ];
  let sx = margin + 68;
  stats.forEach(s => {
    doc.setFillColor(247, 246, 245);
    doc.roundedRect(sx, y, 38, 24, 3, 3, 'F');
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(s.value, sx + 4, y + 13);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 113, 108);
    doc.text(s.label, sx + 4, y + 20);
    doc.setTextColor(28, 25, 23);
    sx += 42;
  });
  y += 32;
  divider();

  // ── SECTION 1: EXECUTIVE SUMMARY ──────────────────────────────────────────
  sectionTitle('1. Executive Summary');
  row('Company',        company.display_name || '—');
  row('Site URL',       company.site_url     || '—');
  row('Uptime Status',  company.uptime_status || '—');
  row('Period',         `Last ${reportData.periodDays || 30} days`);
  row('Total Attacks',  String(attacks.length));
  row('Open Alerts',    String(summary.openAlerts ?? '0'));
  row('Security Score', `${score} / 100`);
  y += 4;

  // ── SECTION 2: HARDENING CHECKLIST ────────────────────────────────────────
  sectionTitle('2. Hardening Checklist');
  const checks = hardening.checks || [];
  if (checks.length === 0) {
    bodyText('No hardening data available. Run a hardening audit from the dashboard.');
  } else {
    checks.forEach((c: any) => {
      newPageIfNeeded(8);
      const icon = c.status === 'pass' ? '✓' : c.status === 'fail' ? '✗' : '?';
      const col: [number, number, number] =
        c.status === 'pass' ? [21, 128, 61] :
        c.status === 'fail' ? [185, 28, 28] :
                              [120, 113, 108];
      doc.setTextColor(...col);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${icon} ${c.check_name || c.name || '—'}`, margin, y);
      doc.setTextColor(120, 113, 108);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`+${c.score_impact || 0} pts  ·  Priority: ${c.priority || '—'}`, margin + 80, y);
      doc.setTextColor(28, 25, 23);
      y += 6;
    });
  }
  y += 4;

  // ── SECTION 3: ATTACK EVENTS ───────────────────────────────────────────────
  sectionTitle('3. Attack Events');
  if (attacks.length === 0) {
    bodyText('No attack events recorded in the selected period.');
  } else {
    // Table header
    newPageIfNeeded(10);
    doc.setFillColor(245, 245, 244);
    doc.rect(margin, y, colW, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Date',        margin + 2,  y + 5);
    doc.text('Pattern',     margin + 28, y + 5);
    doc.text('IP Address',  margin + 74, y + 5);
    doc.text('Severity',    margin + 120, y + 5);
    y += 9;

    attacks.slice(0, 50).forEach((a: any) => {
      newPageIfNeeded(7);
      const date = a.occurred_at ? new Date(a.occurred_at).toLocaleDateString() : '—';
      const sevColor: [number, number, number] =
        a.severity === 'critical' ? [185, 28, 28]  :
        a.severity === 'high'     ? [194, 65, 12]  :
        a.severity === 'medium'   ? [161, 98, 7]   :
                                    [120, 113, 108];

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(28, 25, 23);
      doc.text(date,                              margin + 2,  y);
      doc.text(String(a.pattern_type || '—').substring(0, 22), margin + 28, y);
      doc.text(String(a.ip           || '—'),     margin + 74, y);
      doc.setTextColor(...sevColor);
      doc.setFont('helvetica', 'bold');
      doc.text(String(a.severity     || '—'),     margin + 120, y);
      doc.setTextColor(28, 25, 23);
      y += 6;
    });

    if (attacks.length > 50) {
      bodyText(`... and ${attacks.length - 50} more events. Download the Excel report for full data.`);
    }
  }
  y += 4;

  // ── SECTION 4: VULNERABLE PLUGINS ─────────────────────────────────────────
  sectionTitle('4. Vulnerable Plugins');
  if (vulnAlerts.length === 0) {
    bodyText('No vulnerable plugins detected. All active plugins are clean.');
  } else {
    vulnAlerts.forEach((v: any) => {
      newPageIfNeeded(16);
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(margin, y, colW, 14, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text(`${v.plugin_name || '—'} v${v.plugin_version || '—'}`, margin + 3, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 113, 108);
      doc.setFontSize(8);
      doc.text(`CVE: ${v.cve_id || '—'}  ·  Severity: ${v.severity || '—'}  ·  Fixed in: ${v.fixed_in || 'Unpatched'}`, margin + 3, y + 11);
      doc.setTextColor(28, 25, 23);
      y += 18;
    });
  }
  y += 4;

  // ── FOOTER on each page ────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(168, 162, 158);
    doc.setFont('helvetica', 'normal');
    doc.text('Confidential — WPShield Security Report by Cybernara', margin, 290);
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin - 20, 290);
  }

  return Buffer.from(doc.output('arraybuffer'));
}