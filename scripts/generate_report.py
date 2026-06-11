import sys
import json
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, HRFlowable, Flowable
)
from reportlab.platypus.flowables import KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate
import io
from datetime import datetime, timezone
from reportlab.lib.utils import ImageReader
from typing import Optional

# BRAND COLORS
DARK_TEAL = colors.HexColor('#0a6358')
LIGHT_TEAL = colors.HexColor('#2DD4BF')
LIGHT_TEAL_BG = colors.HexColor('#e6f4f1')
BLACK = colors.black
WHITE = colors.white
GRAY = colors.HexColor('#6b7280')
LIGHT_GRAY = colors.HexColor('#f9fafb')
RED = colors.HexColor('#dc2626')
ORANGE = colors.HexColor('#ea580c')
GREEN = colors.HexColor('#16a34a')
YELLOW = colors.HexColor('#ca8a04')

GRADIENT_START = colors.HexColor('#0a6358')
GRADIENT_END = colors.HexColor('#000000')
HEADER_HEIGHT = 60
FOOTER_HEIGHT = 45
LOGO_HEIGHT = 28
LOGO_MARGIN_LEFT = 25

PAGE_WIDTH, PAGE_HEIGHT = A4

def format_date(date_str):
    if not date_str:
        return ''
    try:
        # Handle ISO format with timezone
        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return dt.strftime('%b %d %Y, %I:%M %p')
    except:
        return date_str

def format_attack_type(pattern):
    if not pattern:
        return ''
    mapping = {
        'sensitive_404': 'Sensitive File Probe',
        'sqli': 'SQL Injection',
        'xss': 'Cross-Site Scripting',
        'lfi': 'Local File Inclusion',
        'rce': 'Remote Code Execution',
        'xmlrpc': 'XML-RPC Abuse',
        'scanner_ua': 'Security Scanner',
        'wpscan_ua': 'WPScan Detected',
    }
    return mapping.get(pattern.lower(), pattern.replace('_', ' ').title())

def _draw_horizontal_gradient(c, x, y, width, height, color_start, color_end, steps=600):
    r1, g1, b1 = color_start.red, color_start.green, color_start.blue
    r2, g2, b2 = color_end.red, color_end.green, color_end.blue
    step_width = width / steps
    for i in range(steps):
        ratio = i / steps
        r = r1 + (r2 - r1) * ratio
        g = g1 + (g2 - g1) * ratio
        b = b1 + (b2 - b1) * ratio
        c.setFillColorRGB(r, g, b)
        c.rect(
            x + (step_width * i),
            y,
            step_width + 0.5,
            height,
            stroke=0,
            fill=1
        )

class GradientHeaderCell(Flowable):
    def __init__(self, text, width, total_width, offset, height=8*mm, textColor=WHITE, fontSize=10, fontName='Helvetica-Bold', alignment=TA_LEFT):
        Flowable.__init__(self)
        self.text = text
        self.width = width
        self.total_width = total_width
        self.offset = offset
        self.height = height
        self.textColor = textColor
        self.fontSize = fontSize
        self.fontName = fontName
        self.alignment = alignment

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        self.canv.saveState()
        # Draw unified gradient slice relative to table start X
        _draw_horizontal_gradient(self.canv, -self.offset, 0, self.total_width, self.height, GRADIENT_START, GRADIENT_END)
        
        style = ParagraphStyle(
            'HeaderGradStyle',
            fontName=self.fontName,
            fontSize=self.fontSize,
            leading=self.fontSize + 2,
            textColor=self.textColor,
            alignment=self.alignment
        )
        p = Paragraph(self.text, style)
        # Apply padding of 8pt on left/right for text wrap
        pw, ph = p.wrap(self.width - 16, self.height)
        
        if self.alignment == TA_CENTER:
            x = (self.width - pw) / 2
        elif self.alignment == TA_RIGHT:
            x = self.width - pw - 8
        else:
            x = 8
            
        y = (self.height - ph) / 2
        p.drawOn(self.canv, x, y)
        self.canv.restoreState()

class GradientCell(Flowable):
    def __init__(self, text, width, height=8*mm, color_start=colors.red, color_end=colors.black, textColor=WHITE, fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER):
        Flowable.__init__(self)
        self.text = text
        self.width = width
        self.height = height
        self.color_start = color_start
        self.color_end = color_end
        self.textColor = textColor
        self.fontSize = fontSize
        self.fontName = fontName
        self.alignment = alignment

    def wrap(self, availWidth, availHeight):
        return self.width, self.height

    def draw(self):
        self.canv.saveState()
        # Draw premium slice gradient
        _draw_horizontal_gradient(self.canv, 0, 0, self.width, self.height, self.color_start, self.color_end)
        
        style = ParagraphStyle(
            'CellGradStyle',
            fontName=self.fontName,
            fontSize=self.fontSize,
            leading=self.fontSize + 2,
            textColor=self.textColor,
            alignment=self.alignment
        )
        p = Paragraph(self.text, style)
        pw, ph = p.wrap(self.width - 10, self.height)
        
        if self.alignment == TA_CENTER:
            x = (self.width - pw) / 2
        elif self.alignment == TA_RIGHT:
            x = self.width - pw - 6
        else:
            x = 6
            
        y = (self.height - ph) / 2
        p.drawOn(self.canv, x, y)
        self.canv.restoreState()

def make_unified_header_row(titles, col_widths, alignments, fontSize=10):
    total_width = sum(col_widths)
    row = []
    current_offset = 0
    for title, width, align in zip(titles, col_widths, alignments):
        row.append(GradientHeaderCell(title, width, total_width, current_offset, alignment=align, fontSize=fontSize))
        current_offset += width
    return row

def header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    page_width = doc.pagesize[0]
    page_height = doc.pagesize[1]

    # HEADER gradient left to right
    _draw_horizontal_gradient(
        canvas_obj,
        x=0,
        y=page_height - HEADER_HEIGHT,
        width=page_width,
        height=HEADER_HEIGHT,
        color_start=GRADIENT_START,
        color_end=GRADIENT_END
    )

    # FOOTER gradient left to right
    _draw_horizontal_gradient(
        canvas_obj,
        x=0,
        y=0,
        width=page_width,
        height=FOOTER_HEIGHT,
        color_start=GRADIENT_START,
        color_end=GRADIENT_END
    )

    # Logo in header — check public/logos/cybernara-white.png
    logo_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 
                             'public', 'logos', 'cybernara-white.png')
    if os.path.exists(logo_path):
        try:
            logo = ImageReader(logo_path)
            lw, lh = logo.getSize()
            aspect = lw / lh
            draw_width = LOGO_HEIGHT * aspect
            canvas_obj.drawImage(
                logo,
                LOGO_MARGIN_LEFT,
                page_height - HEADER_HEIGHT + (HEADER_HEIGHT - LOGO_HEIGHT) / 2,
                width=draw_width,
                height=LOGO_HEIGHT,
                preserveAspectRatio=True,
                mask='auto'
            )
        except Exception:
            # fallback text if logo fails
            canvas_obj.setFillColor(colors.white)
            canvas_obj.setFont('Helvetica-Bold', 14)
            canvas_obj.drawString(LOGO_MARGIN_LEFT, 
                                  page_height - HEADER_HEIGHT + 20, 
                                  'Cybernara WPShield')
    else:
        # fallback text if logo file doesn't exist
        canvas_obj.setFillColor(colors.white)
        canvas_obj.setFont('Helvetica-Bold', 14)
        canvas_obj.drawString(LOGO_MARGIN_LEFT, 
                              page_height - HEADER_HEIGHT + 20, 
                              'Cybernara WPShield')

    # Footer text right aligned
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont('Helvetica', 8)
    canvas_obj.drawRightString(
        page_width - 30,
        18,
        f'Confidential – Security Report | Page {doc.page}'
    )
    canvas_obj.restoreState()

def get_maturity_color(score):
    if score >= 91: return DARK_TEAL
    if score >= 81: return GREEN
    if score >= 61: return YELLOW
    if score >= 41: return ORANGE
    return RED

def get_maturity_label(score):
    if score >= 91: return 'EXCELLENT'
    if score >= 81: return 'GOOD'
    if score >= 61: return 'NEEDS ATTENTION'
    if score >= 41: return 'MODERATE RISK'
    return 'CRITICAL RISK'

def generate_pdf(data):
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=70,
        bottomMargin=55,
        leftMargin=25*mm,
        rightMargin=25*mm
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle('Title', 
        fontSize=24, fontName='Helvetica-Bold',
        textColor=DARK_TEAL, alignment=TA_CENTER, spaceAfter=6)
    
    h1_style = ParagraphStyle('H1',
        fontSize=16, fontName='Helvetica-Bold',
        textColor=DARK_TEAL, spaceAfter=8, spaceBefore=12)
    
    h2_style = ParagraphStyle('H2',
        fontSize=13, fontName='Helvetica-Bold',
        textColor=DARK_TEAL, spaceAfter=6, spaceBefore=10)
    
    body_style = ParagraphStyle('Body',
        fontSize=10, fontName='Helvetica',
        textColor=BLACK, spaceAfter=4)
    
    italic_style = ParagraphStyle('Italic',
        fontSize=9, fontName='Helvetica-Oblique',
        textColor=GRAY, spaceAfter=8)
    
    center_style = ParagraphStyle('Center',
        fontSize=10, fontName='Helvetica',
        textColor=GRAY, alignment=TA_CENTER, spaceAfter=4)
    
    small_gray = ParagraphStyle('SmallGray',
        fontSize=8, fontName='Helvetica',
        textColor=GRAY, alignment=TA_CENTER)
    
    story = []
    
    company = data.get('company', {})
    maturity = data.get('maturity', {})
    stats = data.get('stats', {})
    score = maturity.get('score', 0)
    maturity_color = get_maturity_color(score)
    maturity_label = get_maturity_label(score)
    
    # ─── PAGE 1: COVER ───────────────────────────────────────────
    story.append(Spacer(1, 20*mm))
    
    # SECURITY REPORT style
    sec_report_style = ParagraphStyle('SecReport',
        fontSize=26, leading=32, fontName='Helvetica-Bold',
        textColor=DARK_TEAL, alignment=TA_CENTER)
    story.append(Paragraph('SECURITY REPORT', sec_report_style))
    story.append(Spacer(1, 8*mm))
    
    # Company name style
    comp_name_style = ParagraphStyle('CompName',
        fontSize=18, leading=22, fontName='Helvetica-Bold',
        textColor=BLACK, alignment=TA_CENTER)
    story.append(Paragraph(company.get('display_name', ''), comp_name_style))
    
    # Site URL style
    site_url_style = ParagraphStyle('SiteUrl',
        fontSize=10, leading=14, fontName='Helvetica',
        textColor=GRAY, alignment=TA_CENTER)
    story.append(Paragraph(company.get('site_url', ''), site_url_style))
    story.append(Spacer(1, 4*mm))
    
    # Thin horizontal line
    story.append(HRFlowable(width=60*mm, color=DARK_TEAL, thickness=1, spaceAfter=4))
    
    # Period and Generated on same line centered
    period_gen_style = ParagraphStyle('PeriodGen',
        fontSize=9, leading=12, fontName='Helvetica',
        textColor=GRAY, alignment=TA_CENTER)
    period_text = f"Period: {data.get('period', 'Last 30 Days')}    |    Generated: {format_date(data.get('generatedAt', ''))}"
    story.append(Paragraph(period_text, period_gen_style))
    story.append(Spacer(1, 10*mm))
    
    # Maturity score box - 3 separate rows in table
    score_table = Table([
        [Paragraph(str(score), ParagraphStyle('ScoreNum',
            fontSize=56, leading=64, fontName='Helvetica-Bold',
            textColor=maturity_color, alignment=TA_CENTER))],
        [Paragraph(maturity_label, ParagraphStyle('MaturityLabelText',
            fontSize=14, leading=18, fontName='Helvetica-Bold',
            textColor=maturity_color, alignment=TA_CENTER, letterSpacing=1.5))],
        [Paragraph('out of 100 points', ParagraphStyle('ScoreLabelText',
            fontSize=9, leading=12, fontName='Helvetica',
            textColor=GRAY, alignment=TA_CENTER))],
    ], colWidths=[120*mm])
    
    score_table.setStyle(TableStyle([
        ('BOX', (0,0), (-1,-1), 2.0, maturity_color),
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_TEAL_BG),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,0), 16),
        ('BOTTOMPADDING', (0,2), (-1,2), 16),
    ]))
    
    wrapper_data = [[score_table]]
    wrapper = Table(wrapper_data, colWidths=[doc.width])
    wrapper.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(wrapper)
    story.append(Spacer(1, 8*mm))
    
    # "Powered by Cybernara WPShield"
    powered_style = ParagraphStyle('PoweredStyle',
        fontSize=8, leading=11, fontName='Helvetica',
        textColor=GRAY, alignment=TA_CENTER)
    story.append(Paragraph('Powered by Cybernara WPShield', powered_style))
    story.append(PageBreak())
    
    # ─── PAGE 2: EXECUTIVE SUMMARY ───────────────────────────────
    story.append(Paragraph('Executive Summary', h1_style))
    story.append(HRFlowable(width='100%', thickness=1, color=DARK_TEAL))
    story.append(Spacer(1, 6*mm))
    
    # 4 stat boxes
    def stat_box(label, value):
        t = Table([
            [Paragraph(str(value), ParagraphStyle('StatNum',
                fontSize=26, fontName='Helvetica-Bold',
                textColor=DARK_TEAL, alignment=TA_CENTER))],
            [Paragraph(label, ParagraphStyle('StatLabel',
                fontSize=9, fontName='Helvetica',
                textColor=GRAY, alignment=TA_CENTER))],
        ], colWidths=[38*mm])
        t.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        return t
    
    stat_data = [[
        stat_box('Attacks', stats.get('totalAttacks', 0)),
        stat_box('Logins', stats.get('totalLogins', 0)),
        stat_box('File Changes', stats.get('totalFileChanges', 0)),
        stat_box('Open Alerts', stats.get('openAlerts', 0)),
    ]]
    stat_table = Table(stat_data, colWidths=[38*mm, 38*mm, 38*mm, 38*mm])
    stat_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), LIGHT_TEAL_BG),
        ('BOX', (0,0), (-1,-1), 0.5, DARK_TEAL),
        ('INNERGRID', (0,0), (-1,-1), 0.5, DARK_TEAL),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(stat_table)
    story.append(Spacer(1, 6*mm))
    
    review = data.get('analystReview')
    if review and review.get('status') == 'published':
        story.append(Paragraph('Security Analyst Summary', h2_style))
        if review.get('vulnerable_plugins_note'):
            story.append(Paragraph('<b>Plugins:</b> ' + review.get('vulnerable_plugins_note'), body_style))
        if review.get('failed_hardening_note'):
            story.append(Paragraph('<b>Hardening:</b> ' + review.get('failed_hardening_note'), body_style))
        if review.get('suspicious_logins_note'):
            story.append(Paragraph('<b>Logins:</b> ' + review.get('suspicious_logins_note'), body_style))
        story.append(Spacer(1, 6*mm))
    
    # Health sentence
    if score >= 80:
        health = 'Your site is in good security health.'
    elif score >= 60:
        health = 'Your site needs some security attention.'
    else:
        health = 'Your site has critical security issues that need immediate action.'
    story.append(Paragraph(health, italic_style))
    story.append(Spacer(1, 6*mm))  # FIX 4 spacer
    
    # Events table
    story.append(Paragraph('Events This Period', h2_style))
    
    table_cell_style = ParagraphStyle(
        'TableCellStyle',
        fontSize=9,
        leading=11,
        fontName='Helvetica',
        textColor=BLACK
    )
    table_cell_center = ParagraphStyle(
        'TableCellCenter',
        fontSize=9,
        leading=11,
        fontName='Helvetica',
        textColor=BLACK,
        alignment=TA_CENTER
    )

    events_cols = [70*mm, 40*mm, 50*mm]
    events_data = [
        [
            GradientCell('Type', events_cols[0], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=10, fontName='Helvetica-Bold', alignment=TA_LEFT),
            GradientCell('Count', events_cols[1], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=10, fontName='Helvetica-Bold', alignment=TA_CENTER),
            GradientCell('Status', events_cols[2], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=10, fontName='Helvetica-Bold', alignment=TA_LEFT),
        ],
        [Paragraph('Attack Attempts', table_cell_style), Paragraph(str(stats.get('totalAttacks', 0)), table_cell_center), Paragraph('Review Required', table_cell_style)],
        [Paragraph('Login Attempts', table_cell_style), Paragraph(str(stats.get('totalLogins', 0)), table_cell_center), Paragraph('Normal Activity', table_cell_style)],
        [Paragraph('File Changes', table_cell_style), Paragraph(str(stats.get('totalFileChanges', 0)), table_cell_center), Paragraph('Review Required', table_cell_style)],
        [Paragraph('Open Alerts', table_cell_style), Paragraph(str(stats.get('openAlerts', 0)), table_cell_center), Paragraph('Action Needed', table_cell_style)],
    ]
    events_table = Table(events_data, colWidths=events_cols)
    events_table.setStyle(TableStyle([
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_TEAL_BG]),
        ('GRID', (0,0), (-1,-1), 0.5, DARK_TEAL),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,1), (-1,-1), 6),
        ('BOTTOMPADDING', (0,1), (-1,-1), 6),
        ('LEFTPADDING', (0,1), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,0), 0),
        ('BOTTOMPADDING', (0,0), (-1,0), 0),
        ('LEFTPADDING', (0,0), (-1,0), 0),
        ('RIGHTPADDING', (0,0), (-1,0), 0),
    ]))
    story.append(events_table)
    story.append(Spacer(1, 4*mm))  # FIX 4 spacer
    story.append(PageBreak())
    
    # ─── PAGE 3: SECURITY ISSUES ─────────────────────────────────
    story.append(Paragraph('Security Issues Found', h1_style))
    story.append(HRFlowable(width='100%', thickness=1, color=DARK_TEAL))
    story.append(Spacer(1, 6*mm))  # FIX 4 spacer
    
    # Vulnerable plugins section
    vulns_section = []
    vulns_section.append(Paragraph('Vulnerable Plugins', h2_style))
    vulns = data.get('vulnerablePlugins', [])
    if vulns:
        vuln_cols = [55*mm, 20*mm, 28*mm, 22*mm, 35*mm]
        vuln_data = [[
            GradientCell('Plugin', vuln_cols[0], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=8, fontName='Helvetica-Bold', alignment=TA_LEFT),
            GradientCell('Version', vuln_cols[1], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=8, fontName='Helvetica-Bold', alignment=TA_LEFT),
            GradientCell('CVE ID', vuln_cols[2], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=8, fontName='Helvetica-Bold', alignment=TA_LEFT),
            GradientCell('Severity', vuln_cols[3], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=8, fontName='Helvetica-Bold', alignment=TA_LEFT),
            GradientCell('Fix Version', vuln_cols[4], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=8, fontName='Helvetica-Bold', alignment=TA_LEFT),
        ]]
        for v in vulns:
            vuln_data.append([
                Paragraph(v.get('plugin_name', ''), table_cell_style),
                Paragraph(v.get('plugin_version', ''), table_cell_style),
                Paragraph(v.get('cve_id', ''), table_cell_style),
                Paragraph(v.get('severity', '').upper(), table_cell_style),
                Paragraph(v.get('fixed_in', ''), table_cell_style),
            ])
        vuln_table = Table(vuln_data, colWidths=vuln_cols)
        vuln_table.setStyle(TableStyle([
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_TEAL_BG]),
            ('GRID', (0,0), (-1,-1), 0.5, DARK_TEAL),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,1), (-1,-1), 5),
            ('BOTTOMPADDING', (0,1), (-1,-1), 5),
            ('LEFTPADDING', (0,1), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,0), 0),
            ('BOTTOMPADDING', (0,0), (-1,0), 0),
            ('LEFTPADDING', (0,0), (-1,0), 0),
            ('RIGHTPADDING', (0,0), (-1,0), 0),
        ]))
        vulns_section.append(vuln_table)
        vulns_section.append(Spacer(1, 4*mm))  # FIX 4 spacer
        vulns_section.append(Paragraph('Update these plugins immediately to protect your site.', italic_style))
    else:
        vulns_section.append(Paragraph('No vulnerable plugins detected. ✓', ParagraphStyle('Good',
            fontSize=10, fontName='Helvetica', textColor=GREEN)))
    vulns_section.append(Spacer(1, 6*mm))  # FIX 4 spacer
    story.append(KeepTogether(vulns_section))
    
    # Top attacking IPs section
    ips_section = []
    ips_section.append(Paragraph('Top Attacking IPs', h2_style))
    ips = data.get('topAttackingIps', [])
    if ips:
        ip_cols = [60*mm, 35*mm, 65*mm]
        ip_data = [[
            GradientCell('IP Address', ip_cols[0], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=9, fontName='Helvetica-Bold', alignment=TA_LEFT),
            GradientCell('Attack Count', ip_cols[1], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER),
            GradientCell('Attack Type', ip_cols[2], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=9, fontName='Helvetica-Bold', alignment=TA_LEFT),
        ]]
        for ip in ips:
            ip_data.append([
                Paragraph(ip.get('ip', ''), table_cell_style),
                Paragraph(str(ip.get('count', 0)), table_cell_center),
                Paragraph(format_attack_type(ip.get('pattern_type', '')), table_cell_style),
            ])
        ip_table = Table(ip_data, colWidths=ip_cols)
        ip_table.setStyle(TableStyle([
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_TEAL_BG]),
            ('GRID', (0,0), (-1,-1), 0.5, DARK_TEAL),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,1), (-1,-1), 6),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6),
            ('LEFTPADDING', (0,1), (-1,-1), 8),
            ('TOPPADDING', (0,0), (-1,0), 0),
            ('BOTTOMPADDING', (0,0), (-1,0), 0),
            ('LEFTPADDING', (0,0), (-1,0), 0),
            ('RIGHTPADDING', (0,0), (-1,0), 0),
        ]))
        ips_section.append(ip_table)
        ips_section.append(Spacer(1, 4*mm))  # FIX 4 spacer
        ips_section.append(Paragraph(
            'These IP addresses have been repeatedly trying to break into your site.',
            italic_style))
    else:
        ips_section.append(Paragraph('No suspicious IP activity detected. ✓', body_style))
    ips_section.append(Spacer(1, 6*mm))  # FIX 4 spacer
    story.append(KeepTogether(ips_section))
    
    # Recent file changes section
    files_section = []
    files_section.append(Paragraph('Recent File Changes', h2_style))
    files = data.get('recentFileChanges', [])
    if files:
        file_cols = [85*mm, 25*mm, 50*mm]
        file_data = [[
            GradientCell('File Path', file_cols[0], 8*mm, fontSize=8, color_start=GRADIENT_START, color_end=GRADIENT_END),
            GradientCell('Change Type', file_cols[1], 8*mm, fontSize=8, color_start=GRADIENT_START, color_end=GRADIENT_END),
            GradientCell('Date', file_cols[2], 8*mm, fontSize=8, color_start=GRADIENT_START, color_end=GRADIENT_END),
        ]]
        for f in files:
            path = f.get('path', '')
            if len(path) > 45:
                path = '...' + path[-42:]
            change = f.get('event', '').replace('file_', '').title()
            file_data.append([
                Paragraph(path, table_cell_style),
                Paragraph(change, table_cell_style),
                Paragraph(format_date(f.get('occurred_at', '')), table_cell_style),
            ])
        file_table = Table(file_data, colWidths=file_cols)
        file_table.setStyle(TableStyle([
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_TEAL_BG]),
            ('GRID', (0,0), (-1,-1), 0.5, DARK_TEAL),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,1), (-1,-1), 5),
            ('BOTTOMPADDING', (0,1), (-1,-1), 5),
            ('LEFTPADDING', (0,1), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,0), 0),
            ('BOTTOMPADDING', (0,0), (-1,0), 0),
            ('LEFTPADDING', (0,0), (-1,0), 0),
            ('RIGHTPADDING', (0,0), (-1,0), 0),
        ]))
        files_section.append(file_table)
        files_section.append(Spacer(1, 4*mm))  # FIX 4 spacer
        files_section.append(Paragraph(
            'These files were modified on your site. Review if unexpected.',
            italic_style))
    else:
        files_section.append(Paragraph('No recent file modifications detected. ✓', body_style))
    files_section.append(Spacer(1, 6*mm))  # FIX 4 spacer
    story.append(KeepTogether(files_section))
    
    story.append(PageBreak())
    
    # ─── PAGE 4: ACTION ITEMS ─────────────────────────────────────
    story.append(Paragraph('What You Need To Do', h1_style))
    story.append(HRFlowable(width='100%', thickness=1, color=DARK_TEAL))
    story.append(Spacer(1, 6*mm))  # FIX 4 spacer
    story.append(Paragraph(
        'These are the security issues that need your attention, sorted by importance.',
        italic_style))
    story.append(Spacer(1, 6*mm))  # FIX 4 spacer
    
    failed = data.get('failedChecks', [])
    
    FAIL_NAMES = {
        'No Vulnerable Plugins': 'Vulnerable Plugins Detected',
        'No High Open Alerts': 'Too Many High Severity Alerts',
        'No Critical Open Alerts': 'Critical Alerts Unresolved',
        'No Recent File Modification Alerts': 'Unexpected File Modifications',
        'Uptime Healthy': 'Site Offline or Unreachable',
        'Plugin Heartbeat Recent': 'Plugin Not Reporting Data',
        'HTTPS Enforced': 'HTTPS Not Configured',
    }
    
    if failed:
        action_cols = [55*mm, 25*mm, 80*mm]
        
        risk_high_style = ParagraphStyle(
            'RiskHighStyle',
            fontSize=11,
            leading=13,
            fontName='Helvetica-Bold',
            textColor=RED,
            alignment=TA_CENTER
        )
        risk_medium_style = ParagraphStyle(
            'RiskMediumStyle',
            fontSize=11,
            leading=13,
            fontName='Helvetica-Bold',
            textColor=ORANGE,
            alignment=TA_CENTER
        )
        risk_low_style = ParagraphStyle(
            'RiskLowStyle',
            fontSize=11,
            leading=13,
            fontName='Helvetica-Bold',
            textColor=GREEN,
            alignment=TA_CENTER
        )

        action_data = [[
            GradientCell('Issue', action_cols[0], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=9, fontName='Helvetica-Bold', alignment=TA_LEFT),
            GradientCell('Risk Level', action_cols[1], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=9, fontName='Helvetica-Bold', alignment=TA_CENTER),
            GradientCell('What To Do', action_cols[2], 8*mm, GRADIENT_START, GRADIENT_END, textColor=WHITE, fontSize=9, fontName='Helvetica-Bold', alignment=TA_LEFT),
        ]]
        for check in failed:
            name_val = check.get('check_name', '')
            display_name = FAIL_NAMES.get(name_val, name_val)
            priority = check.get('priority', 'medium').upper()
            
            if priority == 'HIGH':
                risk_cell = Paragraph('HIGH', risk_high_style)
            elif priority == 'MEDIUM':
                risk_cell = Paragraph('MEDIUM', risk_medium_style)
            else:
                risk_cell = Paragraph('LOW', risk_low_style)
                
            action_data.append([
                Paragraph(display_name, table_cell_style),
                risk_cell,
                Paragraph(check.get('recommendation', ''), table_cell_style),
            ])
        
        action_table = Table(action_data, colWidths=action_cols)
        
        # Build row styles for risk colors
        table_style = [
            ('GRID', (0,0), (-1,-1), 0.5, DARK_TEAL),
            ('TOPPADDING', (0,1), (-1,-1), 6),
            ('BOTTOMPADDING', (0,1), (-1,-1), 6),
            ('LEFTPADDING', (0,1), (-1,-1), 8),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [WHITE, LIGHT_TEAL_BG]),
            ('TOPPADDING', (0,0), (-1,0), 0),
            ('BOTTOMPADDING', (0,0), (-1,0), 0),
            ('LEFTPADDING', (0,0), (-1,0), 0),
            ('RIGHTPADDING', (0,0), (-1,0), 0),
        ]
        
        action_table.setStyle(TableStyle(table_style))
        story.append(action_table)
        story.append(Spacer(1, 4*mm))  # FIX 4 spacer
    else:
        story.append(Paragraph(
            'Great job! No action items at this time.',
            ParagraphStyle('Good', fontSize=11, fontName='Helvetica-Bold', textColor=GREEN)))
    
    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    return buffer.getvalue()

if __name__ == '__main__':
    data = json.loads(sys.stdin.read())
    pdf_bytes = generate_pdf(data)
    sys.stdout.buffer.write(pdf_bytes)
