"use client";

// NOTE: We are not using /public/templates/brand.pdf as a base template
// because pdfmake does not support loading existing PDF files as templates.
// pdfmake only generates new PDFs from scratch using a JSON document definition.
// To use an existing PDF as template, we would need a library like pdf-lib
// which supports reading and modifying existing PDF files.
// 
// Instead we replicate the brand style (dark teal header #0a6358, 
// white body, dark footer) programmatically using pdfmake's 
// header/footer functions and canvas rectangles.
// The visual result matches the brand template closely.

export interface ReportData {
  company: {
    display_name: string;
    site_url: string;
    last_seen_at: string;
  };
  period: string;
  generatedAt: string;
  maturity: {
    score: number;
    label: string;
  };
  stats: {
    totalAttacks: number;
    totalLogins: number;
    totalFileChanges: number;
    openAlerts: number;
  };
  vulnerablePlugins: Array<{
    plugin_name: string;
    plugin_version: string;
    cve_id: string | null;
    severity: string;
    fixed_in: string | null;
  }>;
  topAttackingIps: Array<{
    ip: string;
    count: number;
    pattern_type: string;
  }>;
  recentFileChanges: Array<{
    path: string;
    event: string;
    occurred_at: string;
  }>;
  failedChecks: Array<{
    check_name: string;
    priority: string;
    recommendation: string;
  }>;
}

const PROBLEM_NAMES: Record<string, string> = {
  "No Vulnerable Plugins": "Vulnerable Plugins Detected",
  "No High Open Alerts": "Too Many High Severity Alerts",
  "No Recent File Modification Alerts": "Unexpected File Modifications",
  "No Critical Open Alerts": "Critical Alerts Unresolved",
  "Uptime Healthy": "Site Offline or Unreachable",
  "Plugin Heartbeat Recent": "Plugin Not Reporting Data",
  "HTTPS Enforced": "HTTPS Not Configured",
};

const mapEventName = (e: string) => {
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

const truncatePath = (path: string) =>
  path.length > 50 ? "..." + path.slice(-47) : path;

export async function generateSecurityReport(data: ReportData) {
  if (process.env.NEXT_PUBLIC_DEBUG === "true") console.log("[PDF Debug] Data received:", {
    company: data.company.display_name,
    score: data.maturity.score,
    attacks: data.stats.totalAttacks,
    vulns: data.vulnerablePlugins.length,
    failedChecks: data.failedChecks.length
  });
  if (process.env.NEXT_PUBLIC_DEBUG === "true") console.log("[PDF Debug] Starting PDF generation...");

  const pdfMakeModule = await import('pdfmake/build/pdfmake')
  const pdfMake = (pdfMakeModule.default || pdfMakeModule) as any

  // Try multiple ways to load vfs_fonts
  try {
    const vfsModule = await import('pdfmake/build/vfs_fonts')
    const vfs = (vfsModule.default || vfsModule) as any
    
    // Try all possible locations of vfs data
    if (vfs?.pdfMake?.vfs) {
      pdfMake.vfs = vfs.pdfMake.vfs
    } else if (vfs?.vfs) {
      pdfMake.vfs = vfs.vfs
    } else if (typeof vfs === 'object') {
      // Last resort — assign entire module as vfs
      pdfMake.vfs = vfs
    }
  } catch (e) {
    console.error('[PDF Debug] vfs_fonts load error:', e)
  }

  if (process.env.NEXT_PUBLIC_DEBUG === 'true') console.log('[PDF Debug] vfs after fix:', !!pdfMake.vfs)
  if (process.env.NEXT_PUBLIC_DEBUG === 'true') console.log('[PDF Debug] vfs keys sample:', 
    pdfMake.vfs ? Object.keys(pdfMake.vfs).slice(0, 3) : 'none')

  const siteUrl = data.company.site_url || "your-site.com";

  let healthText = "";
  if (data.maturity.score >= 80) {
    healthText = "Your site is in good security health.";
  } else if (data.maturity.score >= 60) {
    healthText = "Your site needs some security attention.";
  } else {
    healthText = "Your site has critical security issues that need immediate action.";
  }

  // 1. Build plugin table body
  const pluginTableBody = [
    [
      { text: "Plugin", style: "tableHeader" },
      { text: "Version", style: "tableHeader" },
      { text: "CVE", style: "tableHeader" },
      { text: "Severity", style: "tableHeader" },
      { text: "Fix Version", style: "tableHeader" },
    ],
  ];
  data.vulnerablePlugins.forEach((p, idx) => {
    const rowColor = idx % 2 === 0 ? "#ffffff" : "#e6f4f1";
    pluginTableBody.push([
      { text: p.plugin_name, style: "tableCell", fillColor: rowColor } as any,
      { text: p.plugin_version, style: "tableCell", fillColor: rowColor } as any,
      { text: p.cve_id || "—", style: "tableCell", fillColor: rowColor } as any,
      { text: p.severity.toUpperCase(), style: "tableCell", fillColor: rowColor } as any,
      { text: p.fixed_in ? `v${p.fixed_in}` : "Unpatched", style: "tableCell", fillColor: rowColor } as any,
    ]);
  });

  // 2. Build attacker table body
  const ipTableBody = [
    [
      { text: "IP Address", style: "tableHeader" },
      { text: "Attack Count", style: "tableHeader" },
      { text: "Attack Type", style: "tableHeader" },
    ],
  ];
  data.topAttackingIps.forEach((ip, idx) => {
    const rowColor = idx % 2 === 0 ? "#ffffff" : "#e6f4f1";
    ipTableBody.push([
      { text: ip.ip, style: "tableCell", fillColor: rowColor } as any,
      { text: String(ip.count), style: "tableCell", fillColor: rowColor } as any,
      { text: mapAttackType(ip.pattern_type), style: "tableCell", fillColor: rowColor } as any,
    ]);
  });

  // 3. Build file changes table body
  const fileTableBody = [
    [
      { text: "File Path", style: "tableHeader" },
      { text: "Change Type", style: "tableHeader" },
      { text: "Date", style: "tableHeader" },
    ],
  ];
  data.recentFileChanges.forEach((f, idx) => {
    const rowColor = idx % 2 === 0 ? "#ffffff" : "#e6f4f1";
    fileTableBody.push([
      { text: truncatePath(f.path), style: "tableCell", fillColor: rowColor } as any,
      { text: mapEventName(f.event), style: "tableCell", fillColor: rowColor } as any,
      { text: new Date(f.occurred_at).toLocaleString(), style: "tableCell", fillColor: rowColor } as any,
    ]);
  });

  // 4. Build action items table body
  const actionTableBody = [
    [
      { text: "Issue", style: "tableHeader" },
      { text: "Risk Level", style: "tableHeader" },
      { text: "What To Do", style: "tableHeader" },
    ],
  ];
  data.failedChecks.forEach((check) => {
    const risk = check.priority.toUpperCase();
    let riskBg = "";
    if (risk === "HIGH") riskBg = "#dc2626";
    else if (risk === "MEDIUM") riskBg = "#ea580c";
    else riskBg = "#16a34a";

    actionTableBody.push([
      { text: PROBLEM_NAMES[check.check_name] || check.check_name, style: "tableCell", bold: true } as any,
      { text: risk, style: "tableCell", color: "#ffffff", fillColor: riskBg, bold: true, alignment: "center" } as any,
      { text: check.recommendation, style: "tableCell" } as any,
    ]);
  });

  const docDefinition: any = {
    pageSize: "A4",
    pageMargins: [40, 80, 40, 60], // room for 50pt header and 30pt footer

    defaultStyle: {
      font: "Roboto"
    },

    header: function (currentPage: number) {
      return {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: 595.28,
            h: 50,
            color: "#0a6358",
          },
        ],
        stack: [
          {
            text: "Cybernara WPShield",
            color: "white",
            bold: true,
            fontSize: 14,
            margin: [20, 15, 0, 0],
          },
        ],
      };
    },

    footer: function (currentPage: number, pageCount: number) {
      return {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: 595.28,
            h: 30,
            color: "#0a6358",
          },
        ],
        stack: [
          {
            text: "Confidential – Security Report | Page " + currentPage + " of " + pageCount,
            color: "white",
            fontSize: 8,
            alignment: "right",
            margin: [0, 8, 20, 0],
          },
        ],
      };
    },

    content: [
      // ==========================================
      // PAGE 1 — Cover
      // ==========================================
      {
        text: "SECURITY REPORT",
        fontSize: 28,
        bold: true,
        color: "#0a6358",
        alignment: "center",
        margin: [0, 40, 0, 20],
      },
      {
        text: data.company.display_name,
        fontSize: 20,
        bold: true,
        color: "#000000",
        alignment: "center",
        margin: [0, 0, 0, 10],
      },
      {
        text: siteUrl,
        fontSize: 11,
        color: "#6b7280",
        alignment: "center",
        margin: [0, 0, 0, 20],
      },
      {
        text: `Period: ${data.period}`,
        fontSize: 10,
        color: "#4b5563",
        alignment: "center",
        margin: [0, 0, 0, 5],
      },
      {
        text: `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
        fontSize: 10,
        color: "#4b5563",
        alignment: "center",
        margin: [0, 0, 0, 40],
      },
      
      // Centered Score Box
      {
        style: "maturityBoxTable",
        table: {
          widths: [200],
          body: [
            [
              {
                stack: [
                  { text: String(data.maturity.score), fontSize: 36, bold: true, color: "#0a6358", alignment: "center" },
                  { text: data.maturity.label.toUpperCase(), fontSize: 14, bold: true, color: "#0a6358", alignment: "center", margin: [0, 5, 0, 0] },
                ],
                margin: [20, 15, 20, 15],
                fillColor: "#F9FAFB",
              },
            ],
          ],
        },
        alignment: "center",
        layout: {
          hLineColor: () => "#0a6358",
          vLineColor: () => "#0a6358",
          hLineWidth: () => 1.5,
          vLineWidth: () => 1.5,
        },
        margin: [0, 0, 0, 60],
      },
      {
        text: "Powered by Cybernara WPShield",
        fontSize: 9,
        color: "#9ca3af",
        alignment: "center",
        margin: [0, 0, 0, 0],
        pageBreak: "after",
      },

      // ==========================================
      // PAGE 2 — Executive Summary
      // ==========================================
      {
        text: "Executive Summary",
        fontSize: 16,
        bold: true,
        color: "#0a6358",
        margin: [0, 10, 0, 20],
      },
      {
        table: {
          widths: ["*", "*", "*", "*"],
          body: [
            [
              {
                stack: [
                  { text: String(data.stats.totalAttacks), fontSize: 18, bold: true, color: "#dc2626" },
                  { text: "Attacks", fontSize: 8, color: "#6b7280", margin: [0, 4, 0, 0] },
                ],
                fillColor: "#e6f4f1",
                margin: [10, 10, 10, 10],
                alignment: "center",
              },
              {
                stack: [
                  { text: String(data.stats.totalLogins), fontSize: 18, bold: true, color: "#0a6358" },
                  { text: "Logins", fontSize: 8, color: "#6b7280", margin: [0, 4, 0, 0] },
                ],
                fillColor: "#e6f4f1",
                margin: [10, 10, 10, 10],
                alignment: "center",
              },
              {
                stack: [
                  { text: String(data.stats.totalFileChanges), fontSize: 18, bold: true, color: "#0a6358" },
                  { text: "File Changes", fontSize: 8, color: "#6b7280", margin: [0, 4, 0, 0] },
                ],
                fillColor: "#e6f4f1",
                margin: [10, 10, 10, 10],
                alignment: "center",
              },
              {
                stack: [
                  { text: String(data.stats.openAlerts), fontSize: 18, bold: true, color: "#0a6358" },
                  { text: "Open Alerts", fontSize: 8, color: "#6b7280", margin: [0, 4, 0, 0] },
                ],
                fillColor: "#e6f4f1",
                margin: [10, 10, 10, 10],
                alignment: "center",
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 30],
      },
      {
        text: "Current Security Health status:",
        bold: true,
        fontSize: 11,
        color: "#1f2937",
        margin: [0, 0, 0, 5],
      },
      {
        text: healthText,
        color: "#6b7280",
        fontStyle: "italic",
        fontSize: 11,
        margin: [0, 0, 0, 35],
      },
      {
        text: "Events This Period",
        fontSize: 12,
        bold: true,
        color: "#111827",
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ["*", "*", "*"],
          headerRows: 1,
          body: [
            [
              { text: "Type", style: "tableHeader" },
              { text: "Count", style: "tableHeader" },
              { text: "Status", style: "tableHeader" },
            ],
            [
              { text: "Attack Attempts", style: "tableCell", fillColor: "#ffffff" } as any,
              { text: String(data.stats.totalAttacks), style: "tableCell", fillColor: "#ffffff" } as any,
              { text: data.stats.totalAttacks > 0 ? "Review Required" : "Safe", style: "tableCell", fillColor: "#ffffff" } as any,
            ],
            [
              { text: "Login Attempts", style: "tableCell", fillColor: "#e6f4f1" } as any,
              { text: String(data.stats.totalLogins), style: "tableCell", fillColor: "#e6f4f1" } as any,
              { text: "Normal Activity", style: "tableCell", fillColor: "#e6f4f1" } as any,
            ],
            [
              { text: "File Changes", style: "tableCell", fillColor: "#ffffff" } as any,
              { text: String(data.stats.totalFileChanges), style: "tableCell", fillColor: "#ffffff" } as any,
              { text: data.stats.totalFileChanges > 0 ? "Review Required" : "No Changes", style: "tableCell", fillColor: "#ffffff" } as any,
            ],
            [
              { text: "Open Alerts", style: "tableCell", fillColor: "#e6f4f1" } as any,
              { text: String(data.stats.openAlerts), style: "tableCell", fillColor: "#e6f4f1" } as any,
              { text: data.stats.openAlerts > 0 ? "Action Needed" : "No Alerts", style: "tableCell", fillColor: "#e6f4f1" } as any,
            ],
          ],
        },
        layout: "lightHorizontalLines",
        pageBreak: "after",
      },

      // ==========================================
      // PAGE 3 — Security Issues Found
      // ==========================================
      {
        text: "Security Issues Found",
        fontSize: 16,
        bold: true,
        color: "#0a6358",
        margin: [0, 10, 0, 20],
      },
      
      // Vulnerable Plugins
      { text: "Vulnerable Plugins", fontSize: 13, bold: true, color: "#0a6358", margin: [0, 0, 0, 8] },
      data.vulnerablePlugins.length === 0
        ? { text: "No vulnerable plugins detected ✅", color: "#16a34a", bold: true, fontSize: 10, margin: [0, 0, 0, 25] }
        : [
            {
              table: {
                widths: ["30%", "12%", "18%", "12%", "13%", "auto"],
                headerRows: 1,
                body: pluginTableBody,
              },
              layout: "lightHorizontalLines",
            },
            {
              text: "Update these plugins immediately to protect your site.",
              fontStyle: "italic",
              color: "#6b7280",
              fontSize: 9,
              margin: [0, 5, 0, 20],
            },
          ],

      // Top Attacking IPs
      { text: "Top Attacking IPs (Last 30 days)", fontSize: 13, bold: true, color: "#0a6358", margin: [0, 10, 0, 8] },
      data.topAttackingIps.length === 0
        ? { text: "No attacking IPs detected in this period.", color: "#6b7280", fontSize: 10, margin: [0, 0, 0, 25] }
        : [
            {
              table: {
                widths: ["40%", "20%", "40%"],
                headerRows: 1,
                body: ipTableBody,
              },
              layout: "lightHorizontalLines",
            },
            {
              text: "These IP addresses have been repeatedly trying to break into your site.",
              fontStyle: "italic",
              color: "#6b7280",
              fontSize: 9,
              margin: [0, 5, 0, 20],
            },
          ],

      // Recent File Changes
      { text: "Recent File Changes", fontSize: 13, bold: true, color: "#0a6358", margin: [0, 10, 0, 8] },
      data.recentFileChanges.length === 0
        ? { text: "No recent file changes detected.", color: "#6b7280", fontSize: 10, margin: [0, 0, 0, 10] }
        : [
            {
              table: {
                widths: ["55%", "15%", "30%"],
                headerRows: 1,
                body: fileTableBody,
              },
              layout: "lightHorizontalLines",
            },
            {
              text: "These files were modified on your site. Review if unexpected.",
              fontStyle: "italic",
              color: "#6b7280",
              fontSize: 9,
              margin: [0, 5, 0, 10],
            },
          ],
      
      { text: "", pageBreak: "after" },

      // ==========================================
      // PAGE 4 — Action Items
      // ==========================================
      {
        text: "What You Need To Do",
        fontSize: 16,
        bold: true,
        color: "#0a6358",
        margin: [0, 10, 0, 5],
      },
      {
        text: "These are the security issues that need your attention, sorted by importance.",
        fontStyle: "italic",
        color: "#6b7280",
        fontSize: 10,
        margin: [0, 0, 0, 20],
      },
      data.failedChecks.length === 0
        ? { text: "Great job! No action items at this time. ✅", color: "#16a34a", bold: true, fontSize: 12, margin: [0, 15, 0, 0] }
        : {
            table: {
              widths: ["35%", "15%", "50%"],
              headerRows: 1,
              body: actionTableBody,
            },
            layout: "grid",
          },
    ],

    styles: {
      tableHeader: {
        fillColor: "#0a6358",
        color: "#ffffff",
        bold: true,
        fontSize: 9,
        margin: [8, 6, 8, 6],
      },
      tableCell: {
        fontSize: 9,
        margin: [8, 6, 8, 6],
      },
    },
  };

  if (process.env.NEXT_PUBLIC_DEBUG === "true") console.log("[PDF Debug] Document definition created, generating...");

  const companySlug = data.company.display_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dateStr = new Date().toISOString().split("T")[0];
  const filename = `security-report-${companySlug}-${dateStr}.pdf`;

  pdfMake.createPdf(docDefinition).download(filename);
}