"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/ui/large-name-footer";
import { Tiles } from "@/components/ui/tiles";

// ─── Color tokens (Light theme with white as primary background) ────────────
const C = {
  bg:        "#ffffff", // White primary background
  bgLight:   "#f4f7f6", // Very soft sage/mint tinted light background
  primary:   "#285A48", // Forest green for main branding and primary actions
  sage:      "#408A71", // Sage green for secondary text and borders
  mint:      "#B0E4CC", // Mint green for highlights
  dark:      "#091413", // Dark forest black for headings and high contrast text
  border:    "rgba(40, 90, 72, 0.18)",
  borderSub: "rgba(40, 90, 72, 0.08)",
};

// ─── Live dashboard mock events ───────────────────────────────────────────
const EVENTS = [
  { sev: "HIGH", bg: "rgba(255, 95, 87, 0.15)", col: "#FF5F57", bdr: "rgba(255, 95, 87, 0.3)", text: "SQL Injection attempt blocked" },
  { sev: "HIGH", bg: "rgba(255, 95, 87, 0.15)", col: "#FF5F57", bdr: "rgba(255, 95, 87, 0.3)", text: "Scanner: sqlmap/1.7 detected" },
  { sev: "MED",  bg: "rgba(40, 90, 72, 0.12)", col: "#285A48", bdr: "rgba(40, 90, 72, 0.25)", text: "Brute force login — 14 attempts" },
  { sev: "HIGH", bg: "rgba(255, 95, 87, 0.15)", col: "#FF5F57", bdr: "rgba(255, 95, 87, 0.3)", text: "LFI probe: ../../etc/passwd" },
  { sev: "LOW",  bg: "rgba(40, 90, 72, 0.08)", col: "#408A71", bdr: "rgba(40, 90, 72, 0.15)", text: "File integrity scan — all clear" },
  { sev: "HIGH", bg: "rgba(255, 95, 87, 0.15)", col: "#FF5F57", bdr: "rgba(255, 95, 87, 0.3)", text: "XSS payload blocked in ?q=" },
];

function DashboardMock() {
  const [evts, setEvts] = useState(EVENTS.slice(0, 3));
  const [count, setCount] = useState(2847);
  const idx = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      idx.current = (idx.current + 1) % EVENTS.length;
      setEvts(prev => [EVENTS[idx.current], ...prev.slice(0, 2)]);
      setCount(c => c + Math.floor(Math.random() * 3) + 1);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.3))", backdropFilter: "blur(16px) saturate(110%)", border: "1px solid rgba(255, 255, 255, 0.65)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 500, boxShadow: "0 20px 40px rgba(9, 20, 19, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7), inset 0 -2px 10px 0 rgba(255, 255, 255, 0.1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, paddingBottom: 12, borderBottom: `1px solid ${C.borderSub}` }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map(c => <div key={c} style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />)}
        <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: C.sage, letterSpacing: "1px", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>SHIELDER INTERACTIVE ACTIVE</span>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(40, 90, 72, 0.08)", border: "1px solid rgba(40, 90, 72, 0.25)", borderRadius: 20, padding: "3px 8px", fontSize: 9, color: C.primary, fontWeight: 700, marginBottom: 16 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, animation: "livePulse 2s ease-in-out infinite" }} />LIVE
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { val: count.toLocaleString(), lbl: "Attacks Blocked", col: C.primary },
          { val: "3", lbl: "Open Alerts", col: "#FF5F57" },
          { val: "100", lbl: "Security Score", col: "#28C840" }
        ].map(s => (
          <div key={s.lbl} style={{ background: "rgba(255, 255, 255, 0.4)", border: "1px solid rgba(255, 255, 255, 0.5)", borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.col, lineHeight: 1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.val}</div>
            <div style={{ fontSize: 9, color: C.sage, marginTop: 4 }}>{s.lbl}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {evts.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(255, 255, 255, 0.5)", borderRadius: 6, padding: "8px 12px", fontSize: 11, transition: "opacity 0.3s" }}>
            <span style={{ padding: "2px 6px", borderRadius: 4, fontSize: 8, fontWeight: 700, letterSpacing: "0.5px", color: e.col, background: e.bg, border: `1px solid ${e.bdr}`, fontFamily: "'Plus Jakarta Sans',sans-serif", flexShrink: 0 }}>{e.sev}</span>
            <span style={{ color: C.dark, flex: 1, fontWeight: 500 }}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    name: "Basic Attack Logs",
    desc: "Monitor SQLi, XSS, and LFI probe events in real-time.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  {
    name: "Login Logs",
    desc: "Track every success, failure, and brute-force attempt.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m-2 4a2 2 0 012 2m-8-3a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
      </svg>
    )
  },
  {
    name: "Plugin & Theme Inventory",
    desc: "Auto-scan and catalog all plugins and themes for active vulnerabilities.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    )
  },
  {
    name: "XML-RPC Disable",
    desc: "Block API requests that malicious bots leverage to brute-force logins.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )
  },
  {
    name: "Maintenance Mode",
    desc: "Enable a secure splash screen to protect your site during edits.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    name: "Cloud Dashboard",
    desc: "Manage multiple WordPress sites from one centralized cloud console.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
      </svg>
    )
  },
  {
    name: "Real-Time Email Alerts",
    desc: "Get notified by email instantly whenever high-severity threats occur.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  },
  {
    name: "Slack Alerts",
    desc: "Forward security alerts directly to your Slack channels for prompt action.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )
  },
  {
    name: "File Integrity Alerts",
    desc: "Get warned if core files are modified or unexpected scripts appear.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
  {
    name: "User Activity Logs",
    desc: "Comprehensive audit trail of admin, editor, and user actions.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    name: "Manual IP Blocking",
    desc: "Manually ban specific IP addresses or subnets from your site.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    )
  },
  {
    name: "Automatic IP Blocking",
    desc: "Auto-ban bots and attackers detected performing suspicious behaviors.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    )
  },
  {
    name: "Geo Blocking",
    desc: "Restrict administrative pages or core features to specific countries.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h2.918M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    name: "Away Mode",
    desc: "Completely lock down your administrative panel during off-duty hours.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
      </svg>
    )
  },
  {
    name: "PDF Reports",
    desc: "Generate professional summary reports of blocked threats easily.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  },

  {
    name: "Multi-Site Dashboard",
    desc: "Global reporting and configuration panel for all your sites.",
    icon: (
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )
  }
];

export default function LandingPage() {
  const [navScrolled, setNavScrolled] = useState(false);
  const [isIndia, setIsIndia] = useState(true);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % FEATURES.length);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Auto-detect if user is in India using timezone and locale
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const isIndiaTz = tz && (tz.includes("Kolkata") || tz.includes("Calcutta") || tz.includes("Asia/Kolkata"));
      const isIndiaLocale = navigator.language === "en-IN" || (navigator.languages && navigator.languages.includes("en-IN"));
      
      if (isIndiaTz || isIndiaLocale) {
        setIsIndia(true);
      } else {
        setIsIndia(false);
      }
    } catch (e) {
      // Fallback
      setIsIndia(true);
    }

    const handleScroll = () => {
      setNavScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        
        :root {
          --tile: rgba(40, 90, 72, 0.08);
        }

        html, body {
          background: #ffffff !important;
          color: #091413 !important;
          font-family: 'Inter', sans-serif;
          overflow-x: hidden;
          scroll-behavior: smooth;
        }

         @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.75); }
        }

        @keyframes marqueeText {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-100%, 0, 0); }
        }
        
        .hgrid, .second-container {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 48px;
          align-items: center;
          max-width: 1240px;
          width: 100%;
        }

        .btn-primary {
          background: #285A48;
          color: #ffffff;
          padding: 12px 28px;
          border-radius: 6px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          font-size: 15px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s, transform 0.2s;
          border: none;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #408A71;
          transform: translateY(-1px);
        }

        .showcase-container {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 48px;
          align-items: center;
          width: 100%;
          max-width: 1240px;
        }

        .showcase-square {
          width: 100%;
          aspect-ratio: 1 / 1;
          max-width: 440px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.25));
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 24px;
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(20px) saturate(110%);
          box-shadow: 0 30px 60px rgba(9, 20, 19, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7);
          margin-left: auto;
        }

        .scanner-h {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #285A48, #B0E4CC, #285A48, transparent);
          animation: scanH 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          opacity: 0.6;
          pointer-events: none;
        }

        .scanner-v {
          position: absolute;
          top: 0;
          left: 0;
          width: 2px;
          height: 100%;
          background: linear-gradient(180deg, transparent, #285A48, #B0E4CC, #285A48, transparent);
          animation: scanV 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          opacity: 0.6;
          pointer-events: none;
        }

        @keyframes scanH {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }

        @keyframes scanV {
          0% { left: 0%; }
          50% { left: 100%; }
          100% { left: 0%; }
        }

        .feat-list-nav {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .feat-nav-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.4);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          color: #408A71;
          font-size: 13px;
          backdrop-filter: blur(8px);
        }

        .feat-nav-btn:hover {
          background: rgba(40, 90, 72, 0.05);
          color: #285A48;
          border-color: rgba(255, 255, 255, 0.8);
        }

        .feat-nav-btn.active {
          background: rgba(176, 228, 204, 0.35);
          color: #285A48;
          font-weight: 700;
          border-color: rgba(40, 90, 72, 0.4);
          box-shadow: inset 0 1px 1px 0 rgba(255, 255, 255, 0.4);
        }

        .showcase-content {
          animation: showcaseSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes showcaseSlideUp {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 768px) {
          .feat-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .hgrid, .second-container {
            grid-template-columns: 1fr;
            gap: 32px;
          }
        }

        .pricing-toggle-btn {
          padding: 6px 14px;
          border-radius: 20px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          font-size: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .pricing-creative-container {
          display: flex;
          align-items: stretch;
          justify-content: center;
          gap: 24px;
          margin-top: 48px;
          width: 100%;
          max-width: 1240px;
          flex-wrap: nowrap;
        }

        .creative-card {
          width: 270px;
          border-radius: 20px;
          padding: 36px 28px;
          position: relative;
          transition: all 0.5s cubic-bezier(0.25, 1, 0.5, 1);
          backdrop-filter: blur(20px) saturate(110%);
        }

        .creative-card.card-1 {
          transform: translateY(0);
          z-index: 10;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.25));
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 0 10px 30px rgba(9, 20, 19, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7);
        }

        .creative-card.card-2 {
          transform: translateY(0);
          z-index: 12;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.25));
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 0 10px 30px rgba(9, 20, 19, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7);
        }

        .creative-card.card-4 {
          transform: translateY(0);
          z-index: 10;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0.25));
          border: 1px solid rgba(255, 255, 255, 0.65);
          box-shadow: 0 10px 30px rgba(9, 20, 19, 0.04), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7);
        }

        .creative-card.card-3 {
          transform: scale(1.05) translateY(-8px);
          z-index: 20;
          background: linear-gradient(135deg, rgba(40, 90, 72, 0.95), rgba(9, 20, 19, 0.98));
          border: 2px solid #B0E4CC;
          box-shadow: 0 20px 50px rgba(9, 20, 19, 0.15), inset 0 1px 2px 0 rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }

        /* Sibling Hover Fade */
        .pricing-creative-container:hover .creative-card {
          opacity: 0.65;
          filter: brightness(0.9) blur(0.5px);
        }

        .pricing-creative-container:hover .creative-card:hover {
          opacity: 1;
          filter: brightness(1) blur(0);
          z-index: 30;
        }

        .pricing-creative-container:hover .creative-card.card-1:hover {
          transform: scale(1.1) translateY(-20px);
          box-shadow: 0 20px 40px rgba(9, 20, 19, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8);
        }
        .pricing-creative-container:hover .creative-card.card-2:hover {
          transform: scale(1.1) translateY(-20px);
          box-shadow: 0 20px 40px rgba(9, 20, 19, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8);
        }
        .pricing-creative-container:hover .creative-card.card-3:hover {
          transform: scale(1.15) translateY(-24px);
          box-shadow: 0 25px 60px rgba(9, 20, 19, 0.25), 0 0 25px rgba(176, 228, 204, 0.35), inset 0 1px 2px 0 rgba(255, 255, 255, 0.4);
        }
        .pricing-creative-container:hover .creative-card.card-4:hover {
          transform: scale(1.1) translateY(-20px);
          box-shadow: 0 20px 40px rgba(9, 20, 19, 0.08), inset 0 1px 1px 0 rgba(255, 255, 255, 0.8);
        }

        .best-deal-badge {
          position: absolute;
          top: -14px;
          left: 50%;
          transform: translateX(-50%);
          background: #B0E4CC;
          color: #091413;
          padding: 4px 16px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
          box-shadow: 0 4px 12px rgba(9, 20, 19, 0.1);
          animation: floatBadge 2s ease-in-out infinite;
        }

        @keyframes floatBadge {
          0%, 100% { transform: translate(-50%, 0px); }
          50% { transform: translate(-50%, -4px); }
        }

        .addon-banner {
          transition: all 0.3s ease;
        }

        .addon-banner:hover {
          transform: translateY(-2px);
          border-color: #285A48 !important;
          box-shadow: 0 10px 25px rgba(9, 20, 19, 0.05);
        }

        @media (max-width: 1024px) {
          .pricing-creative-container {
            flex-wrap: wrap;
            gap: 32px;
            padding-top: 32px;
            align-items: center;
          }
          .creative-card {
            width: 280px;
            transform: none !important;
            opacity: 1 !important;
            filter: none !important;
          }
          .pricing-creative-container:hover .creative-card {
            opacity: 1 !important;
            filter: none !important;
          }
          .creative-card.card-3 {
            transform: scale(1.05) !important;
          }
          .creative-card.card-1:hover, .creative-card.card-2:hover, .creative-card.card-4:hover, .creative-card.card-3:hover {
            transform: scale(1.08) translateY(-6px) !important;
          }
             .ticker-container:hover .ticker-scroll {
          animation-play-state: paused;
          cursor: pointer;
        }
      `}</style>

      {/* Strategic Partnership Marquee Bar */}
      <div 
        className="ticker-container"
        style={{ 
          position: "fixed", 
          top: 0, 
          left: 0, 
          right: 0, 
          zIndex: 101, 
          background: "linear-gradient(90deg, #091413 0%, #285A48 50%, #091413 100%)", 
          color: "#f4f7f6", 
          overflow: "hidden", 
          whiteSpace: "nowrap", 
          display: "flex", 
          padding: "4px 0", 
          fontSize: 11, 
          fontWeight: 500, 
          fontFamily: "'Plus Jakarta Sans', sans-serif", 
          borderBottom: "1px solid rgba(176, 228, 204, 0.2)", 
          height: 34, 
          alignItems: "center",
          boxShadow: "0 2px 10px rgba(9, 20, 19, 0.2)"
        }}
      >
        <div className="ticker-scroll" style={{ display: "inline-block", animation: "marqueeText 25s linear infinite", whiteSpace: "nowrap", flexShrink: 0 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginRight: 80 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(176, 228, 204, 0.12)", border: "1px solid rgba(176, 228, 204, 0.25)", padding: "2px 8px", borderRadius: "20px", fontSize: "9px", fontWeight: 700, color: C.mint, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.mint, display: "inline-block", boxShadow: "0 0 6px #B0E4CC", animation: "livePulse 2s infinite" }} />
                Partnership
              </span>
              <span style={{ color: "#ffffff", fontWeight: 400, letterSpacing: "0.2px" }}>
                <strong style={{ color: C.mint, fontWeight: 700 }}>Cybernara</strong> is in a strategic partnership with <strong style={{ color: C.mint, fontWeight: 700 }}>3C ITS</strong> in India
              </span>
            </span>
          ))}
        </div>
        <div className="ticker-scroll" style={{ display: "inline-block", animation: "marqueeText 25s linear infinite", whiteSpace: "nowrap", flexShrink: 0 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i + 5} style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginRight: 80 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(176, 228, 204, 0.12)", border: "1px solid rgba(176, 228, 204, 0.25)", padding: "2px 8px", borderRadius: "20px", fontSize: "9px", fontWeight: 700, color: C.mint, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.mint, display: "inline-block", boxShadow: "0 0 6px #B0E4CC", animation: "livePulse 2s infinite" }} />
                Partnership
              </span>
              <span style={{ color: "#ffffff", fontWeight: 400, letterSpacing: "0.2px" }}>
                <strong style={{ color: C.mint, fontWeight: 700 }}>Cybernara</strong> is in a strategic partnership with <strong style={{ color: C.mint, fontWeight: 700 }}>3C ITS</strong> in India
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ position: "fixed", top: 34, left: 0, right: 0, zIndex: 100, padding: "11px 6%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.45))", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255, 255, 255, 0.6)", boxShadow: "0 8px 32px 0 rgba(9, 20, 19, 0.04), inset 0 1px 0 0 rgba(255, 255, 255, 0.8)", transition: "all 0.3s ease" }}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <div>
            <img src="/wpx-logo.png" alt="WPxShield" style={{ height: "53px", width: "auto" }} />
          </div>
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#features" style={{ color: C.sage, textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = C.primary} onMouseLeave={e => e.currentTarget.style.color = C.sage}>Features</a>
          <a href="#pricing" style={{ color: C.sage, textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color 0.2s" }} onMouseEnter={e => e.currentTarget.style.color = C.primary} onMouseLeave={e => e.currentTarget.style.color = C.sage}>Pricing</a>
          <Link href="/login" style={{ color: C.primary, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Log In</Link>
          <Link href="/sign-up" className="btn-primary" style={{ padding: "8px 18px" }}>Get Protected</Link>
        </div>
      </nav>

      {/* Scroll 1: Hero & Live Dashboard */}
      <section style={{ height: "auto", minHeight: "90vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", padding: "140px 6% 20px", position: "relative", overflow: "hidden", background: "radial-gradient(circle at 80% 20%, rgba(176, 228, 204, 0.22) 0%, transparent 50%), radial-gradient(circle at 10% 80%, rgba(176, 228, 204, 0.12) 0%, transparent 50%), #ffffff" }}>
        {/* Tiles background */}
        <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", opacity: 0.35, zIndex: 0 }}>
          <Tiles rows={50} cols={8} tileSize="md" />
        </div>
        <div className="hgrid" style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-content">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(40, 90, 72, 0.08)", border: "1px solid rgba(40, 90, 72, 0.25)", padding: "3px 8px", borderRadius: "20px", fontSize: 9, fontWeight: 700, color: C.primary, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.primary, animation: "livePulse 2s infinite" }} />
              Enterprise Security Active
            </div>
            <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 800, lineHeight: 1.15, color: C.dark, marginBottom: 20 }}>
              The Leading Independent <br/><span style={{ color: C.primary }}>WordPress Security</span> Plugin.
            </h1>
            <p style={{ fontSize: 16, color: C.sage, lineHeight: 1.6, marginBottom: 32, maxWidth: 520 }}>
              Shield your site from bots, malware, brute-force logins, and vulnerable plugins. Real-time protection that actually works — without slowing down WordPress.
            </p>
            <div style={{ display: "flex", gap: 16 }}>
              <Link href="/sign-up" className="btn-primary">Shield Your Sites Today</Link>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <DashboardMock />
          </div>
        </div>
      </section>

      {/* How It Works Banner (Offloaded Telemetry) */}
      <section style={{ background: "#ffffff", padding: "16px 6%", display: "flex", justifyContent: "center", backgroundImage: "radial-gradient(circle at 50% 50%, rgba(176, 228, 204, 0.08) 0%, transparent 80%)" }}>
        <div style={{ maxWidth: 1240, width: "100%", background: "linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.3))", backdropFilter: "blur(16px) saturate(110%)", border: "1px solid rgba(255, 255, 255, 0.65)", borderRadius: 20, padding: "32px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32, boxShadow: "0 10px 30px rgba(9, 20, 19, 0.03), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(40, 90, 72, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: C.primary, flexShrink: 0 }}>
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" /></svg>
            </div>
            <div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 18, fontWeight: 800, color: C.primary, margin: "0 0 4px" }}>Decoupled Cloud Security Architecture</h3>
              <p style={{ fontSize: 13, color: C.sage, margin: 0, lineHeight: 1.5, maxWidth: 640 }}>
                Our lightweight companion plugin runs silently on your server to collect data and block threats, offloading all dashboard processing to our secure cloud dashboard. <strong>Zero reliance on wp-admin</strong> means absolute speed, zero server overhead, and uninterrupted security analytics even if your site goes offline.
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, fontWeight: 700, color: C.primary, background: "rgba(255, 255, 255, 0.7)", padding: "8px 16px", borderRadius: 30, border: "1px solid rgba(255, 255, 255, 0.8)", flexShrink: 0, backdropFilter: "blur(4px)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#28C840" }} />
            WP-ADMIN INDEPENDENT
          </div>
        </div>
      </section>

      {/* Scroll 2: Features */}
      <section id="features" style={{ minHeight: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 6% 80px", background: "#ffffff", backgroundImage: "radial-gradient(circle at 10% 20%, rgba(176, 228, 204, 0.18) 0%, transparent 60%), radial-gradient(circle at 90% 80%, rgba(176, 228, 204, 0.12) 0%, transparent 60%)" }}>
        <div style={{ maxWidth: 1240, width: "100%" }}>
          <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 36, fontWeight: 800, marginBottom: 12, color: C.dark, textAlign: "center" }}>Engineered for Absolute Defense</h2>
          <p style={{ fontSize: 16, color: C.sage, textAlign: "center", marginBottom: 54, maxWidth: 640, marginLeft: "auto", marginRight: "auto" }}>A complete enterprise security suite engineered specifically to guard WordPress installations against active threats, bots, and configuration vulnerabilities.</p>
          
          <div className="showcase-container">
            {/* Left side: Navigator List of all 17 features */}
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: C.primary, marginBottom: 20, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Feature Directory</h3>
              <div className="feat-list-nav">
                {FEATURES.map((f, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveFeature(idx)}
                    className={`feat-nav-btn ${activeFeature === idx ? "active" : ""}`}
                  >
                    <span style={{ display: "inline-flex", color: activeFeature === idx ? C.primary : C.sage, transition: "color 0.2s" }}>
                      {f.icon}
                    </span>
                    <span>{f.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right side: Premium Showcase Square Card with sweeping lasers */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div className="showcase-square">
                {/* Rolling scan lines */}
                <div className="scanner-h" />
                <div className="scanner-v" />
                
                {/* Active Feature Content */}
                <div key={activeFeature} className="showcase-content" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(40, 90, 72, 0.08)", color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, boxShadow: "0 10px 20px rgba(40,90,72,0.06)" }}>
                    {FEATURES[activeFeature].icon}
                  </div>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 24, fontWeight: 800, color: C.primary, margin: "0 0 16px" }}>
                    {FEATURES[activeFeature].name}
                  </h3>
                  <p style={{ fontSize: 15, color: C.sage, lineHeight: 1.6, margin: 0, maxWidth: 320 }}>
                    {FEATURES[activeFeature].desc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll 3: Pricing & Footer */}
      <section id="pricing" style={{ minHeight: "100vh", width: "100vw", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "100px 6% 0", background: "#f4f7f6", backgroundImage: "radial-gradient(circle at 50% 10%, rgba(176, 228, 204, 0.22) 0%, transparent 60%)", position: "relative" }}>
        <div style={{ maxWidth: 1240, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", flex: 1, justifyContent: "center", paddingBottom: 120 }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 36, fontWeight: 800, color: C.dark, margin: 0 }}>Plans that Scale with You</h2>
            <p style={{ fontSize: 15, color: C.sage, marginTop: 8 }}>Choose the level of defense your WordPress sites require.</p>
            
            {/* Currency Toggle */}
            <div style={{ display: "inline-flex", background: "rgba(255, 255, 255, 0.5)", padding: 4, borderRadius: 24, border: "1px solid rgba(255, 255, 255, 0.6)", marginTop: 24, backdropFilter: "blur(8px)" }}>
              <button onClick={() => setIsIndia(false)} className="pricing-toggle-btn" style={{ background: !isIndia ? C.primary : "transparent", color: !isIndia ? "#ffffff" : C.sage }}>Global Pricing ($)</button>
              <button onClick={() => setIsIndia(true)} className="pricing-toggle-btn" style={{ background: isIndia ? C.primary : "transparent", color: isIndia ? "#ffffff" : C.sage }}>India Pricing (₹)</button>
            </div>
          </div>

          {/* Pricing Grid */}
          <div className="pricing-creative-container">
            {/* Core Card */}
            <div className="creative-card card-1" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 800, color: C.primary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Core</div>
              <span style={{ fontSize: 11, color: C.sage, fontWeight: 600, display: "inline-block", marginBottom: 16, background: "rgba(40, 90, 72, 0.08)", padding: "2px 8px", borderRadius: 4, width: "fit-content" }}>Free tier</span>
              <div style={{ marginBottom: 4, fontSize: 12, color: C.sage, lineHeight: 1.4, flexGrow: 1 }}>Essential security logging and basic active response tools.</div>
              <div style={{ margin: "20px 0", fontSize: 32, fontWeight: 800, color: C.dark, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Free</div>
              <ul style={{ marginBottom: 24, padding: 0, listStyle: "none", fontSize: 13, color: C.sage, lineHeight: 1.8, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Basic Attack Logs</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Plugin & Theme Inventory</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Security Score Tracking</li>
              </ul>
              <Link href="/login?redirect=/app/billing" className="btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>Get Started</Link>
            </div>

            {/* Solo Card */}
            <div className="creative-card card-2" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 800, color: C.primary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Solo</div>
              <span style={{ fontSize: 11, color: C.sage, fontWeight: 600, display: "inline-block", marginBottom: 16, background: "rgba(40, 90, 72, 0.08)", padding: "2px 8px", borderRadius: 4, width: "fit-content" }}>1 site</span>
              <div style={{ marginBottom: 4, fontSize: 12, color: C.sage, lineHeight: 1.4, flexGrow: 1 }}>Comprehensive protection for a single personal WordPress website.</div>
              <div style={{ margin: "20px 0", fontSize: 32, fontWeight: 800, color: C.dark, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{isIndia ? "₹2,999/yr" : "$49/yr"}</div>
              <ul style={{ marginBottom: 24, padding: 0, listStyle: "none", fontSize: 13, color: C.sage, lineHeight: 1.8, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Login Failure Logs</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>XML-RPC Disable</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Maintenance Mode</li>
              </ul>
              <Link href="/login?redirect=/app/billing" className="btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>Get Started</Link>
            </div>

            {/* Growth Card (Best Deal) */}
            <div className="creative-card card-3" style={{ display: "flex", flexDirection: "column" }}>
              <div className="best-deal-badge">BEST DEAL</div>
              <div style={{ marginBottom: 4, fontSize: 20, fontWeight: 800, color: "#B0E4CC", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Growth</div>
              <span style={{ fontSize: 11, color: "#B0E4CC", fontWeight: 600, display: "inline-block", marginBottom: 16, background: "rgba(176, 228, 204, 0.15)", padding: "2px 8px", borderRadius: 4, width: "fit-content" }}>Up to 5 sites</span>
              <div style={{ marginBottom: 4, fontSize: 12, color: "rgba(255,255,255,0.75)", lineHeight: 1.4, flexGrow: 1 }}>Advanced protection suite engineered for professional portfolios.</div>
              <div style={{ margin: "20px 0", fontSize: 44, fontWeight: 900, color: "#ffffff", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{isIndia ? "₹11,999/yr" : "$199/yr"}</div>
              <ul style={{ marginBottom: 24, padding: 0, listStyle: "none", fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 1.8, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#B0E4CC" }}><polyline points="20 6 9 17 4 12" /></svg>Real-Time Email & Slack Alerts</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#B0E4CC" }}><polyline points="20 6 9 17 4 12" /></svg>File Integrity & Activity Logs</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#B0E4CC" }}><polyline points="20 6 9 17 4 12" /></svg>Automatic IP Blocking</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#B0E4CC" }}><polyline points="20 6 9 17 4 12" /></svg>Geo & Away Lockdowns</li>
              </ul>
              <Link href="/login?redirect=/app/billing" className="btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 14, background: "#B0E4CC", color: "#091413" }} onMouseEnter={e => e.currentTarget.style.background = "#ffffff"} onMouseLeave={e => e.currentTarget.style.background = "#B0E4CC"}>Start Now</Link>
            </div>

            {/* Agency Card */}
            <div className="creative-card card-4" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ marginBottom: 4, fontSize: 18, fontWeight: 800, color: C.primary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Agency</div>
              <span style={{ fontSize: 11, color: C.sage, fontWeight: 600, display: "inline-block", marginBottom: 16, background: "rgba(40, 90, 72, 0.08)", padding: "2px 8px", borderRadius: 4, width: "fit-content" }}>Up to 25 sites</span>
              <div style={{ marginBottom: 4, fontSize: 12, color: C.sage, lineHeight: 1.4, flexGrow: 1 }}>Unrestricted defense resources and priority support for developers.</div>
              <div style={{ margin: "20px 0", fontSize: 32, fontWeight: 800, color: C.dark, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{isIndia ? "₹49,999/yr" : "$999/yr"}</div>
              <ul style={{ marginBottom: 24, padding: 0, listStyle: "none", fontSize: 13, color: C.sage, lineHeight: 1.8, textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Unrestricted Cloud Resources</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Priority Developer Support</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>PDF Reports Exporting</li>
                <li style={{ display: "flex", alignItems: "center", gap: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "#28C840" }}><polyline points="20 6 9 17 4 12" /></svg>Multi-Site Central Panel</li>
              </ul>
              <Link href="/login?redirect=/app/billing" className="btn-primary" style={{ width: "100%", justifyContent: "center", fontSize: 14 }}>Get Started</Link>
            </div>
          </div>

          {/* Add-on banner */}
          <div className="addon-banner" style={{ marginTop: 64, width: "100%", background: "linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.3))", backdropFilter: "blur(16px) saturate(110%)", border: "1px solid rgba(255, 255, 255, 0.65)", borderRadius: 16, padding: "24px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, boxShadow: "0 10px 30px rgba(9, 20, 19, 0.03), inset 0 1px 1px 0 rgba(255, 255, 255, 0.7)" }}>
            <div>
              <span style={{ fontSize: 8, background: C.sage, color: "#ffffff", padding: "3px 8px", borderRadius: 10, fontWeight: 800, letterSpacing: "0.5px" }}>ADD-ON EXCLUSIVE</span>
              <h4 style={{ fontSize: 16, fontWeight: 800, color: C.dark, margin: "8px 0 4px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Managed Security Review</h4>
              <p style={{ fontSize: 13, color: C.sage, margin: 0 }}>Get expert manual review and threat hunting for your critical sites every month.</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.primary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{isIndia ? "₹1,499 / mo / site" : "$19 / mo / site"}</div>
              <span style={{ fontSize: 11, color: C.sage }}>Billed monthly</span>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}