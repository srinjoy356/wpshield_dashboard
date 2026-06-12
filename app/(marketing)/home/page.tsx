"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Shield SVG Logo ───────────────────────────────────────────────────────
function ShieldLogo({ size = 52 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 90" width={size * 6} height={size} fill="none">
      <defs>
        <linearGradient id="mintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#26E6C6"/><stop offset="100%" stopColor="#107C6B"/>
        </linearGradient>
        <linearGradient id="shieldDep" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#14232A"/><stop offset="100%" stopColor="#091014"/>
        </linearGradient>
      </defs>
      <g transform="translate(16,11)">
        <path d="M35,6 L64,18 L64,44 C64,63 35,76 35,76 C35,76 6,63 6,44 L6,18 Z" fill="url(#shieldDep)"/>
        <path d="M35,6 L6,18 L6,44 C6,63 35,76 Z" fill="url(#mintGrad)" opacity="0.15"/>
        <path d="M35,6 L6,18 L6,44 C6,63 35,76" stroke="#26E6C6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M35,6 L64,18 L64,44 C64,63 35,76" stroke="#149A86" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21,34 C21,46 27,50 30,42 C33,34 37,34 40,42 C43,50 49,46 49,34" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="35" cy="24" r="3" fill="#26E6C6"/>
      </g>
      <g transform="translate(104,53)">
        <text fontFamily="'Plus Jakarta Sans','Inter','Segoe UI',sans-serif" fontSize="36" fontWeight="800" fill="#26E6C6" letterSpacing="0.5">WP</text>
        <text x="64" fontFamily="'Plus Jakarta Sans','Inter','Segoe UI',sans-serif" fontSize="36" fontWeight="400" fill="#E2E8F0" letterSpacing="1">SHIELDER</text>
        <text x="2" y="20" fontFamily="'Plus Jakarta Sans','Inter',sans-serif" fontSize="10" fontWeight="700" fill="#149A86" letterSpacing="5.5">BY CYBERNARA ECOSYSTEM</text>
      </g>
    </svg>
  );
}

// ─── Parallax Shield Background ───────────────────────────────────────────
function ParallaxShield({ scrollY }: { scrollY: number }) {
  return (
    <svg
      style={{
        position: "absolute",
        right: "-5%",
        top: "50%",
        width: 640,
        height: 640,
        opacity: 0.038,
        pointerEvents: "none",
        transform: `translateY(calc(-50% + ${scrollY * 0.2}px)) rotate(${scrollY * 0.015}deg)`,
        transition: "transform 0.05s linear",
        willChange: "transform",
      }}
      viewBox="0 0 100 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M50,5 L95,22 L95,58 C95,82 50,98 50,98 C50,98 5,82 5,58 L5,22 Z" stroke="#26E6C6" strokeWidth="1.2"/>
      <path d="M30,50 C30,66 40,70 45,58 C50,46 50,46 55,58 C60,70 70,66 70,50" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx="50" cy="32" r="5" fill="#26E6C6"/>
      <path d="M50,5 L95,22 L95,58 C95,82 50,98" stroke="#26E6C6" strokeWidth="0.5" opacity="0.5"/>
    </svg>
  );
}

// ─── Animated counter hook ─────────────────────────────────────────────────
function useCountUp(target: number, active: boolean, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(Math.floor(start));
      if (start >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [active, target, duration]);
  return val;
}

// ─── Scroll reveal hook ────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

// ─── Reveal wrapper ────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, direction = "up", className = "" }: {
  children: React.ReactNode; delay?: number; direction?: "up" | "left" | "right"; className?: string;
}) {
  const { ref, visible } = useReveal();
  const from = direction === "left" ? "translateX(-32px)" : direction === "right" ? "translateX(32px)" : "translateY(28px)";
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : from,
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Live event mock ───────────────────────────────────────────────────────
const MOCK_EVENTS = [
  { sev: "HIGH", color: "#F87171", bg: "rgba(220,38,38,0.12)", text: "SQL Injection attempt blocked", time: "just now" },
  { sev: "HIGH", color: "#F87171", bg: "rgba(220,38,38,0.12)", text: "Scanner detected: sqlmap/1.7", time: "1m ago" },
  { sev: "MED",  color: "#FCD34D", bg: "rgba(234,179,8,0.12)",  text: "Brute force login — 14 attempts", time: "2m ago" },
  { sev: "HIGH", color: "#F87171", bg: "rgba(220,38,38,0.12)", text: "LFI probe: ../../etc/passwd", time: "3m ago" },
  { sev: "LOW",  color: "#26E6C6", bg: "rgba(38,230,198,0.1)",  text: "File integrity scan — clean", time: "9m ago" },
  { sev: "HIGH", color: "#F87171", bg: "rgba(220,38,38,0.12)", text: "XSS payload in ?q= blocked", time: "just now" },
];

function DashboardMock() {
  const [events, setEvents] = useState(MOCK_EVENTS.slice(0, 4));
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(2847);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx(i => (i + 1) % MOCK_EVENTS.length);
      setCount(c => c + Math.floor(Math.random() * 3) + 1);
      setEvents(prev => [MOCK_EVENTS[(idx + 1) % MOCK_EVENTS.length], ...prev.slice(0, 3)]);
    }, 3200);
    return () => clearInterval(id);
  }, [idx]);

  return (
    <div style={{
      background: "#0D1B24", border: "1px solid rgba(38,230,198,0.15)",
      borderRadius: 16, padding: 20, width: "100%", maxWidth: 520,
      boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(38,230,198,0.06)",
    }}>
      {/* Title bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid rgba(38,230,198,0.12)" }}>
        {["#FF5F57","#FEBC2E","#28C840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }}/>)}
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#7A9AAE", letterSpacing: "0.5px", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>WP SHIELDER DASHBOARD</span>
      </div>
      {/* Live badge */}
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(38,230,198,0.1)", border: "1px solid rgba(38,230,198,0.2)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#26E6C6", fontWeight: 600, marginBottom: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#26E6C6", animation: "livePulse 1.5s ease-in-out infinite" }}/>
        Live
      </div>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          { val: count.toLocaleString(), lbl: "Attacks Blocked", color: "#26E6C6" },
          { val: "3", lbl: "Open Alerts", color: "#F87171" },
          { val: "100", lbl: "Security Score", color: "#26E6C6" },
        ].map(s => (
          <div key={s.lbl} style={{ background: "#0A1620", border: "1px solid rgba(38,230,198,0.1)", borderRadius: 8, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, lineHeight: 1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.val}</div>
            <div style={{ fontSize: 10, color: "#7A9AAE", marginTop: 4, letterSpacing: "0.3px" }}>{s.lbl}</div>
          </div>
        ))}
      </div>
      {/* Events */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {events.map((e, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#0A1620", border: "1px solid rgba(38,230,198,0.08)",
            borderRadius: 7, padding: "9px 12px", fontSize: 12,
            opacity: i === 0 ? 1 : 0.85 + i * 0.05,
            transition: "opacity 0.3s",
          }}>
            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: e.color, background: e.bg, border: `1px solid ${e.color}33`, fontFamily: "'Plus Jakarta Sans',sans-serif", flexShrink: 0 }}>{e.sev}</span>
            <span style={{ color: "#E2E8F0", flex: 1 }}>{e.text}</span>
            <span style={{ color: "#7A9AAE", fontSize: 10, whiteSpace: "nowrap" }}>{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature card ──────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay = 0 }: { icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      style={{
        background: "#0D1B24", border: "1px solid rgba(38,230,198,0.12)",
        borderRadius: 12, padding: 24, position: "relative", overflow: "hidden",
        opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(24px)",
        transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
        cursor: "default",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(38,230,198,0.35)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(38,230,198,0.12)";
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {/* top glow line */}
      <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg,transparent,#26E6C6,transparent)", opacity: 0 }}/>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(38,230,198,0.08)", border: "1px solid rgba(38,230,198,0.15)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        {icon}
      </div>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#E2E8F0" }}>{title}</h3>
      <p style={{ fontSize: 13, color: "#7A9AAE", lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

// ─── Step ─────────────────────────────────────────────────────────────────
function Step({ num, title, desc, delay = 0 }: { num: string; title: string; desc: string; delay?: number }) {
  const { ref, visible } = useReveal();
  return (
    <div ref={ref} style={{ textAlign: "center", padding: "0 24px", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(24px)", transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms` }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#0A1620", border: "1.5px solid #26E6C6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 18, color: "#26E6C6", position: "relative", zIndex: 2 }}>{num}</div>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 10, color: "#E2E8F0" }}>{title}</h3>
      <p style={{ fontSize: 14, color: "#7A9AAE", lineHeight: 1.7, margin: 0 }}>{desc}</p>
    </div>
  );
}

// ─── Stats section ────────────────────────────────────────────────────────
function StatCard({ target, suffix, label, delay = 0 }: { target: number; suffix: string; label: string; delay?: number }) {
  const { ref, visible } = useReveal(0.3);
  const val = useCountUp(target, visible, 2000);
  return (
    <div ref={ref} style={{
      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12, padding: "28px 24px", textAlign: "center",
      opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 36, fontWeight: 800, color: "#26E6C6", lineHeight: 1 }}>{val.toLocaleString()}{suffix}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 8, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setNavScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #060D10; color: #E2E8F0; font-family: 'Inter', sans-serif; overflow-x: hidden; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #060D10; }
        ::-webkit-scrollbar-thumb { background: #107C6B; border-radius: 4px; }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        @keyframes ringPulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.04);opacity:.9} }
        @keyframes dotPulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-visual { display: none !important; }
          .perf-grid { grid-template-columns: 1fr !important; }
          .why-grid { grid-template-columns: 1fr !important; }
          .steps-row { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .trust-badges { grid-template-columns: repeat(2,1fr) !important; }
          .features-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (max-width: 600px) {
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: navScrolled ? "12px 6%" : "16px 6%",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: navScrolled ? "rgba(6,13,16,0.97)" : "rgba(6,13,16,0.85)",
        backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(38,230,198,0.12)",
        transition: "all 0.3s ease",
      }}>
        <ShieldLogo size={44}/>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["Features","How It Works","Pricing"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,"-")}`} style={{ color: "#7A9AAE", textDecoration: "none", fontSize: 14, fontWeight: 500, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color="#26E6C6")}
              onMouseLeave={e => (e.currentTarget.style.color="#7A9AAE")}>{l}</a>
          ))}
          <Link href="/sign-up" style={{
            background: "#26E6C6", color: "#060D10", padding: "10px 22px", borderRadius: 7,
            fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 13,
            textDecoration: "none", letterSpacing: "0.4px", transition: "opacity 0.2s, transform 0.2s",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "120px 6% 80px", position: "relative", overflow: "hidden" }}>
        {/* Ambient glows */}
        <div style={{ position: "absolute", width: 600, height: 600, background: "radial-gradient(circle,rgba(38,230,198,0.055) 0%,transparent 70%)", top: -100, left: -100, pointerEvents: "none" }}/>
        <div style={{ position: "absolute", width: 400, height: 400, background: "radial-gradient(circle,rgba(16,124,107,0.07) 0%,transparent 70%)", bottom: 0, right: "8%", pointerEvents: "none" }}/>

        <ParallaxShield scrollY={scrollY}/>

        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", maxWidth: 1240, margin: "0 auto", width: "100%", position: "relative", zIndex: 2 }}>
          {/* Left */}
          <div>
            <Reveal>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(38,230,198,0.1)", border: "1px solid rgba(38,230,198,0.2)", borderRadius: 100, padding: "6px 14px", fontSize: 11, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", color: "#26E6C6", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 24 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#26E6C6", animation: "dotPulse 2s ease-in-out infinite" }}/>
                Live WordPress Protection
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(38px,4.5vw,62px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-1.5px", marginBottom: 20 }}>
                Protect Your WordPress<br/>
                <span style={{ color: "#26E6C6" }}>Before Attackers</span><br/>
                Even Reach It
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p style={{ fontSize: 17, color: "#7A9AAE", lineHeight: 1.75, marginBottom: 32, maxWidth: 520 }}>
                WP Shielder continuously monitors your site, blocks malicious activity, detects file changes, and protects your WordPress installation — without slowing it down.
              </p>
            </Reveal>
            <Reveal delay={220}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 36 }}>
                {["Attack Detection & Real-time Logging","File Integrity Monitoring (FIM)","Active IP & Geo Blocking","Malware & Core Integrity Scanner","Login & User Activity Tracking"].map(b => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#7A9AAE" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(38,230,198,0.1)", border: "1.5px solid #26E6C6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    {b}
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={280}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Link href="/sign-up" style={{
                  background: "#26E6C6", color: "#060D10", padding: "14px 28px", borderRadius: 8,
                  fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 15,
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8,
                  boxShadow: "0 4px 24px rgba(38,230,198,0.2)", transition: "transform 0.2s, box-shadow 0.2s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(38,230,198,0.35)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(38,230,198,0.2)"; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Get WP Shielder
                </Link>
                <a href="#features" style={{
                  border: "1.5px solid rgba(38,230,198,0.2)", color: "#E2E8F0", padding: "14px 28px", borderRadius: 8,
                  fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 15,
                  textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, transition: "border-color 0.2s, color 0.2s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#26E6C6"; (e.currentTarget as HTMLElement).style.color = "#26E6C6"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(38,230,198,0.2)"; (e.currentTarget as HTMLElement).style.color = "#E2E8F0"; }}>
                  View Features
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right — Dashboard */}
          <div className="hero-visual" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Reveal direction="right">
              <DashboardMock/>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section id="why" style={{ padding: "96px 6%", background: "#0A1620" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <Reveal><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>The Threat Reality</div></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3.2vw,44px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 16 }}>Your WordPress Site Is<br/>Constantly Being Targeted</h2></Reveal>
          <div className="why-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, marginTop: 56 }}>
            <Reveal direction="left">
              <p style={{ fontSize: 16, color: "#7A9AAE", lineHeight: 1.8, marginBottom: 24 }}>Bots, malware, brute-force attempts, and vulnerable plugins attack WordPress sites every day. Even small sites are automated targets — the question is whether you'll be protected when it happens.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["↓","Website downtime & revenue loss"],["⛔","SEO blacklisting by Google"],["⚠","Stolen customer data & credentials"],["💉","Malware injections & backdoors"],["⚡","Hosting account suspension"],].map(([icon, text]) => (
                  <div key={text as string} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "#7A9AAE" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13 }}>{icon}</div>
                    {text}
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal direction="right">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[["01","24/7 Monitoring","Continuously monitors activity, logins, files, and suspicious behaviour — even while you sleep."],["02","Instant Threat Detection","Detect SQLi, XSS, malware, and unauthorized file changes the moment they happen."],["03","Proactive Blocking","Automatically block malicious IPs, scanners, and suspicious traffic before damage is done."]].map(([num,title,desc]) => (
                  <div key={num as string} style={{ background: "#0D1B24", border: "1px solid rgba(38,230,198,0.12)", borderRadius: 12, padding: "22px 24px", transition: "border-color 0.3s, transform 0.3s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#26E6C6"; (e.currentTarget as HTMLElement).style.transform = "translateX(4px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(38,230,198,0.12)"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: "#26E6C6", letterSpacing: 2, marginBottom: 6 }}>{num}</div>
                    <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6, color: "#E2E8F0" }}>{title as string}</h3>
                    <p style={{ fontSize: 14, color: "#7A9AAE", lineHeight: 1.6, margin: 0 }}>{desc as string}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "96px 6%", background: "#060D10", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <Reveal><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>Full Protection Suite</div></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3.2vw,44px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 56 }}>Everything You Need to<br/>Secure WordPress</h2></Reveal>
          <div className="features-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
            {[
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, title: "Attack Detection & Logging", desc: "Track SQLi, XSS, LFI, and RCE attempts in real time with full request context and severity scoring.", delay: 0 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>, title: "Login Monitoring", desc: "Monitor every login attempt, detect brute-force patterns, and get alerted on suspicious auth events.", delay: 60 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>, title: "File Integrity Monitoring", desc: "Hash-based verification detects unauthorized changes to WordPress core, themes, and plugins.", delay: 120 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, title: "Malware Scanner", desc: "Scan for malicious code and suspicious patterns with core file integrity checks against WordPress checksums.", delay: 0 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>, title: "Active IP Blocking", desc: "Coraza Shadow WAF auto-bans attackers within seconds of detection. No manual action needed.", delay: 60 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>, title: "Geo Blocking", desc: "Restrict traffic from specific countries using Cloudflare headers and ip-api.com geolocation.", delay: 120 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>, title: "User Activity Logs", desc: "Track admin actions, plugin changes, settings updates, and important user events with full timestamps.", delay: 0 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: "XML-RPC Protection", desc: "Disable XML-RPC to eliminate DDoS amplification, credential stuffing, and brute force vectors.", delay: 60 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>, title: "Away & Maintenance Mode", desc: "Restrict wp-admin to business hours and show branded maintenance pages with a single toggle.", delay: 120 },
              { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>, title: "Config Sync", desc: "Security settings sync automatically to WordPress every 2 minutes — or instantly with Force Sync.", delay: 0 },
            ].map(f => <FeatureCard key={f.title} {...f}/>)}
          </div>
        </div>
      </section>

      {/* ── PERFORMANCE ── */}
      <section style={{ padding: "96px 6%", background: "#0A1620" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div className="perf-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }}>
            <Reveal direction="left">
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", height: 320 }}>
                {/* Animated rings */}
                {[300,240,180].map((size, i) => (
                  <div key={size} style={{ position: "absolute", width: size, height: size, borderRadius: "50%", border: `1px solid rgba(38,230,198,${0.08 + i * 0.05})`, animation: `ringPulse ${4}s ease-in-out ${i * 0.8}s infinite` }}/>
                ))}
                <svg width="100" height="110" viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "relative", zIndex: 2 }}>
                  <path d="M50,8 L90,24 L90,56 C90,78 50,95 50,95 C50,95 10,78 10,56 L10,24 Z" fill="rgba(38,230,198,0.06)" stroke="#26E6C6" strokeWidth="2"/>
                  <path d="M32,50 C32,64 40,68 44,58 C48,48 52,48 56,58 C60,68 68,64 68,50" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="50" cy="34" r="5" fill="#26E6C6"/>
                </svg>
              </div>
            </Reveal>
            <div>
              <Reveal direction="right"><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>Built for Performance</div></Reveal>
              <Reveal direction="right" delay={80}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 16 }}>Powerful Security Without<br/>Slowing Down WordPress</h2></Reveal>
              <Reveal direction="right" delay={140}><p style={{ fontSize: 16, color: "#7A9AAE", lineHeight: 1.75, marginBottom: 8 }}>WP Shielder runs efficiently in the background using asynchronous telemetry and optimized monitoring. Enterprise-grade protection, zero site impact.</p></Reveal>
              <Reveal direction="right" delay={200}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
                  {["Lightweight async architecture — zero page slowdown","Smart telemetry queue — batches events every 2 minutes","Coraza WAF runs server-side — never on visitor requests","Optimized for all modern WordPress hosting environments"].map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, color: "#7A9AAE" }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(38,230,198,0.08)", border: "1px solid rgba(38,230,198,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      {t}
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ padding: "96px 6%", background: "linear-gradient(135deg,#060D10 0%,#0A1E1A 50%,#060D10 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,rgba(38,230,198,0.06) 0%,transparent 65%)", pointerEvents: "none" }}/>
        <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <Reveal><div style={{ textAlign: "center", marginBottom: 48 }}><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>Global Protection Stats</div><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3.2vw,44px)", fontWeight: 800, letterSpacing: "-1px" }}>Real-Time Defense Across the Network</h2></div></Reveal>
          <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <StatCard target={637} suffix="M+" label="Firewall Blocks" delay={0}/>
            <StatCard target={80} suffix="M+" label="Malicious Bots" delay={100}/>
            <StatCard target={97} suffix="M+" label="IPs Blocked" delay={200}/>
            <StatCard target={34} suffix="M+" label="Login Blocks" delay={300}/>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: "96px 6%", background: "#060D10", overflow: "hidden" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", textAlign: "center" }}>
          <Reveal><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>Simple Setup</div></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3.2vw,44px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 64 }}>Simple Setup.<br/>Continuous Protection.</h2></Reveal>
          <div className="steps-row" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, position: "relative" }}>
            <div style={{ position: "absolute", top: 28, left: "16.66%", right: "16.66%", height: 1, background: "linear-gradient(90deg,transparent,rgba(38,230,198,0.4),transparent)" }}/>
            <Step num="1" title="Install WP Shielder" desc="Activate the plugin from your WordPress dashboard and enter your license key. Under 2 minutes." delay={0}/>
            <Step num="2" title="Configure Protection" desc="Enable monitoring, scanning, geo blocking, and security modes from the WP Shielder cloud dashboard." delay={150}/>
            <Step num="3" title="Stay Protected" desc="WP Shielder continuously watches your site 24/7 and alerts you the moment anything suspicious is detected." delay={300}/>
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section style={{ padding: "96px 6%", background: "#0A1620" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <Reveal><div style={{ textAlign: "center", marginBottom: 48 }}><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>Trusted Protection</div><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3.2vw,44px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px" }}>Trusted by WordPress<br/>Professionals</h2></div></Reveal>
          <Reveal delay={80}>
            <div style={{ background: "#0D1B24", border: "1px solid rgba(38,230,198,0.15)", borderRadius: 16, padding: "36px 40px", marginBottom: 40, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -20, left: 24, fontSize: 140, color: "#26E6C6", opacity: 0.06, fontFamily: "Georgia,serif", lineHeight: 1, pointerEvents: "none" }}>&ldquo;</div>
              <p style={{ fontSize: 18, lineHeight: 1.7, fontStyle: "italic", color: "#E2E8F0", marginBottom: 20, position: "relative" }}>"WP Shielder helped us detect suspicious login attempts and SQL injection probes before they became a real issue. The dashboard gives us complete visibility into what's happening on our site at all times."</p>
              <cite style={{ fontStyle: "normal", fontSize: 14, color: "#7A9AAE", fontWeight: 600 }}>— Website Administrator, Digital Marketing Agency</cite>
            </div>
          </Reveal>
          <div className="trust-badges" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16 }}>
            {[
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, label: "Real-Time Threat Monitoring" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, label: "Malware Detection" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, label: "WordPress Focused" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 13 9 20 9"/><polygon points="13 2 3 9 13 22 21 9 13 2"/></svg>, label: "Performance Friendly" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, label: "Agency Ready" },
            ].map((b, i) => (
              <Reveal key={b.label} delay={i * 80}>
                <div style={{ background: "#0D1B24", border: "1px solid rgba(38,230,198,0.12)", borderRadius: 10, padding: "20px 16px", textAlign: "center", transition: "border-color 0.3s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(38,230,198,0.35)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = "rgba(38,230,198,0.12)"}>
                  <div style={{ marginBottom: 10 }}>{b.icon}</div>
                  <p style={{ fontSize: 12, color: "#7A9AAE", fontWeight: 500, lineHeight: 1.4, margin: 0 }}>{b.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: "96px 6%", background: "#060D10" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", textAlign: "center" }}>
          <Reveal><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>Simple Pricing</div></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3.2vw,44px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 16 }}>One Plan. Full Protection.</h2></Reveal>
          <Reveal delay={120}><p style={{ fontSize: 16, color: "#7A9AAE", margin: "0 auto 48px", maxWidth: 520 }}>Powerful WordPress security for agencies, businesses, and growing websites. No hidden fees.</p></Reveal>
          <Reveal delay={180}>
            <div style={{ maxWidth: 480, margin: "0 auto" }}>
              <div style={{ background: "#0D1B24", border: "1.5px solid #26E6C6", borderRadius: 20, padding: 40, position: "relative", overflow: "hidden", boxShadow: "0 0 60px rgba(38,230,198,0.07)" }}>
                <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top center,rgba(38,230,198,0.05) 0%,transparent 60%)", pointerEvents: "none" }}/>
                <div style={{ background: "#26E6C6", color: "#060D10", fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, display: "inline-block", marginBottom: 20 }}>Most Popular</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 4 }}>WP Shielder Pro</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 56, fontWeight: 800, lineHeight: 1, color: "#26E6C6", margin: "16px 0 4px" }}>$10<span style={{ fontSize: 20, color: "#7A9AAE" }}>/mo</span></div>
                <p style={{ fontSize: 14, color: "#7A9AAE", marginBottom: 28 }}>per WordPress site · billed monthly</p>
                <ul style={{ listStyle: "none", textAlign: "left", marginBottom: 32, display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Real-time attack detection & logging","File integrity monitoring (FIM)","Malware & core integrity scanner","Active IP & geo blocking","Login & user activity monitoring","XML-RPC protection","Config sync & instant enforcement","Away & maintenance mode","Cloud security dashboard","Security hardening audit","PDF & Excel security reports","Priority updates"].map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#7A9AAE" }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, background: "rgba(38,230,198,0.1)", border: "1px solid rgba(38,230,198,0.3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#26E6C6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" style={{
                  display: "block", width: "100%", background: "#26E6C6", color: "#060D10",
                  textAlign: "center", padding: 16, borderRadius: 9,
                  fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 16,
                  textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(38,230,198,0.3)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                  Start Protecting Your Site
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "120px 6%", background: "linear-gradient(135deg,#060D10 0%,#0A1E1A 50%,#060D10 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center,rgba(38,230,198,0.07) 0%,transparent 65%)", pointerEvents: "none" }}/>
        <div style={{ maxWidth: 700, margin: "0 auto", position: "relative", zIndex: 2 }}>
          <Reveal><div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "#26E6C6", marginBottom: 14 }}>Get Started Today</div></Reveal>
          <Reveal delay={80}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(32px,4vw,52px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-1.5px", marginBottom: 16 }}>Secure Your WordPress<br/>Website Today</h2></Reveal>
          <Reveal delay={140}><p style={{ fontSize: 17, color: "#7A9AAE", lineHeight: 1.75, marginBottom: 36 }}>Stop attacks, monitor changes, and protect your WordPress installation. Setup takes under 2 minutes.</p></Reveal>
          <Reveal delay={200}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/sign-up" style={{ background: "#26E6C6", color: "#060D10", padding: "14px 28px", borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 4px 24px rgba(38,230,198,0.2)", transition: "transform 0.2s,box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(38,230,198,0.35)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px rgba(38,230,198,0.2)"; }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Get Started for $10/month
              </Link>
              <a href="#features" style={{ border: "1.5px solid rgba(38,230,198,0.2)", color: "#E2E8F0", padding: "14px 28px", borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, transition: "border-color 0.2s,color 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#26E6C6"; (e.currentTarget as HTMLElement).style.color = "#26E6C6"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(38,230,198,0.2)"; (e.currentTarget as HTMLElement).style.color = "#E2E8F0"; }}>
                See All Features
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: "#0A1620", borderTop: "1px solid rgba(38,230,198,0.12)", padding: "40px 6%", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
        <ShieldLogo size={38}/>
        <div style={{ display: "flex", gap: 24 }}>
          {["Why WP Shielder","Features","How It Works","Pricing","Cybernara"].map((l, i) => (
            <a key={l} href={i === 4 ? "https://cybernara.com" : `#${l.toLowerCase().replace(/ /g,"-")}`} style={{ fontSize: 13, color: "#7A9AAE", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color="#26E6C6")}
              onMouseLeave={e => (e.currentTarget.style.color="#7A9AAE")}>{l}</a>
          ))}
        </div>
        <p style={{ fontSize: 13, color: "#7A9AAE" }}>© 2026 WP Shielder by Cybernara. All rights reserved.</p>
      </footer>
    </>
  );
}