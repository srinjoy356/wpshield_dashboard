"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── Color tokens (light theme) ───────────────────────────────────────────
const C = {
  bg:        "#f7f9fb",
  bgSurface: "#F5F5F5",
  white:     "#ffffff",
  navy:      "#00288e",
  navyDark:  "#001453",
  shield:    "#2D3748",
  mint:      "#26E6C6",
  mintDark:  "#107C6B",
  lime:      "#8DC63F",
  text:      "#191c1e",
  textMid:   "#444653",
  textMuted: "#757684",
  border:    "#c4c5d5",
  borderSub: "#E2E8F0",
};

// ─── Shield logo ──────────────────────────────────────────────────────────
function ShieldLogo({ size = 44 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 90" width={size * 6} height={size} fill="none">
      <defs>
        <linearGradient id="mg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#26E6C6"/><stop offset="100%" stopColor="#107C6B"/>
        </linearGradient>
        <linearGradient id="sd" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#14232A"/><stop offset="100%" stopColor="#091014"/>
        </linearGradient>
      </defs>
      <g transform="translate(16,11)">
        <path d="M35,6 L64,18 L64,44 C64,63 35,76 35,76 C35,76 6,63 6,44 L6,18 Z" fill="url(#sd)"/>
        <path d="M35,6 L6,18 L6,44 C6,63 35,76 Z" fill="url(#mg)" opacity="0.15"/>
        <path d="M35,6 L6,18 L6,44 C6,63 35,76" stroke="#26E6C6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M35,6 L64,18 L64,44 C64,63 35,76" stroke="#149A86" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21,34 C21,46 27,50 30,42 C33,34 37,34 40,42 C43,50 49,46 49,34" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="35" cy="24" r="3" fill="#26E6C6"/>
      </g>
      <g transform="translate(104,53)">
        <text fontFamily="'Plus Jakarta Sans','Inter',sans-serif" fontSize="36" fontWeight="800" fill="#26E6C6" letterSpacing="0.5">WP</text>
        <text x="64" fontFamily="'Plus Jakarta Sans','Inter',sans-serif" fontSize="36" fontWeight="400" fill="#191c1e" letterSpacing="1">SHIELDER</text>
        <text x="2" y="20" fontFamily="'Plus Jakarta Sans','Inter',sans-serif" fontSize="10" fontWeight="700" fill="#149A86" letterSpacing="5.5">BY CYBERNARA ECOSYSTEM</text>
      </g>
    </svg>
  );
}

// ─── Floating shields — two mirrored, different sizes and speeds ─────────
function ShieldSVG() {
  return (
    <svg viewBox="0 0 100 110" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <path d="M50,5 L95,22 L95,58 C95,82 50,98 50,98 C50,98 5,82 5,58 L5,22 Z" stroke={C.navy} strokeWidth="1.5"/>
      <path d="M30,50 C30,66 40,70 45,58 C50,46 50,46 55,58 C60,70 70,66 70,50" stroke={C.navy} strokeWidth="2" strokeLinecap="round"/>
      <circle cx="50" cy="32" r="5" fill={C.navy}/>
      <path d="M50,5 L95,22 L95,58 C95,82 50,98" stroke={C.navy} strokeWidth="0.6" opacity="0.4"/>
    </svg>
  );
}

function FloatingShield({ scrollY }: { scrollY: number }) {
  const rotateRight = scrollY * 0.01;
  const floatRight  = Math.sin(scrollY * 0.003) * 22;
  const rotateLeft  = -(scrollY * 0.018);
  const floatLeft   = Math.sin(scrollY * 0.005 + 1.8) * 14;

  const base: React.CSSProperties = {
    position: "fixed",
    pointerEvents: "none",
    zIndex: 50,
    transition: "transform 0.08s linear",
    willChange: "transform",
    mixBlendMode: "multiply",
  };

  return (
    <>
      <div style={{ ...base, right: "2%", top: "50%", width: 540, height: 540, opacity: 0.05,
        transform: `translateY(calc(-50% + ${floatRight}px)) rotate(${rotateRight}deg)` }}>
        <ShieldSVG/>
      </div>
      <div style={{ ...base, left: "1%", top: "35%", width: 280, height: 280, opacity: 0.035,
        transform: `translateY(calc(-50% + ${floatLeft}px)) rotate(${rotateLeft}deg)` }}>
        <ShieldSVG/>
      </div>
    </>
  );
}
// ─── Scroll reveal ────────────────────────────────────────────────────────
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

function Reveal({ children, delay = 0, direction = "up", className = "" }: { children: React.ReactNode; delay?: number; direction?: "up"|"left"|"right"; className?: string }) {
  const { ref, visible } = useReveal();
  const from = direction === "left" ? "translateX(-28px)" : direction === "right" ? "translateX(28px)" : "translateY(24px)";
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : from, transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

// ─── Count-up ─────────────────────────────────────────────────────────────
function useCountUp(target: number, active: boolean) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let s = 0; const step = target / (1800 / 16);
    const id = setInterval(() => { s = Math.min(s + step, target); setVal(Math.floor(s)); if (s >= target) clearInterval(id); }, 16);
    return () => clearInterval(id);
  }, [active, target]);
  return val;
}

function StatCard({ target, suffix, label, delay = 0 }: { target: number; suffix: string; label: string; delay?: number }) {
  const { ref, visible } = useReveal(0.3);
  const val = useCountUp(target, visible);
  return (
    <div ref={ref} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "28px 20px", textAlign: "center", opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 36, fontWeight: 800, color: C.lime, lineHeight: 1 }}>{val.toLocaleString()}{suffix}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 8, letterSpacing: "1.5px", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

// ─── Live dashboard mock ──────────────────────────────────────────────────
const EVENTS = [
  { sev: "HIGH", bg: "rgba(186,26,26,0.1)", col: "#ba1a1a", bdr: "rgba(186,26,26,0.25)", text: "SQL Injection attempt blocked" },
  { sev: "HIGH", bg: "rgba(186,26,26,0.1)", col: "#ba1a1a", bdr: "rgba(186,26,26,0.25)", text: "Scanner: sqlmap/1.7 detected" },
  { sev: "MED",  bg: "rgba(141,198,63,0.1)", col: "#426900", bdr: "rgba(141,198,63,0.25)", text: "Brute force login — 14 attempts" },
  { sev: "HIGH", bg: "rgba(186,26,26,0.1)", col: "#ba1a1a", bdr: "rgba(186,26,26,0.25)", text: "LFI probe: ../../etc/passwd" },
  { sev: "LOW",  bg: "rgba(38,230,198,0.1)", col: "#107C6B", bdr: "rgba(38,230,198,0.2)", text: "File integrity scan — all clear" },
  { sev: "HIGH", bg: "rgba(186,26,26,0.1)", col: "#ba1a1a", bdr: "rgba(186,26,26,0.25)", text: "XSS payload blocked in ?q=" },
];

function DashboardMock() {
  const [evts, setEvts] = useState(EVENTS.slice(0, 4));
  const [count, setCount] = useState(2847);
  const idx = useRef(0);
  useEffect(() => {
    const id = setInterval(() => {
      idx.current = (idx.current + 1) % EVENTS.length;
      setEvts(prev => [EVENTS[idx.current], ...prev.slice(0, 3)]);
      setCount(c => c + Math.floor(Math.random() * 3) + 1);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ background: C.white, border: `1px solid ${C.borderSub}`, borderRadius: 16, padding: 20, width: "100%", maxWidth: 500, boxShadow: "0 20px 60px rgba(0,40,142,0.1), 0 4px 16px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.borderSub}` }}>
        {["#FF5F57","#FEBC2E","#28C840"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }}/>)}
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: "0.8px", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>WP SHIELDER DASHBOARD</span>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(141,198,63,0.12)", border: "1px solid rgba(141,198,63,0.3)", borderRadius: 20, padding: "3px 10px", fontSize: 11, color: "#426900", fontWeight: 700, marginBottom: 12 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.lime, animation: "livePulse 1.5s ease-in-out infinite" }}/>LIVE
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
        {[{ val: count.toLocaleString(), lbl: "Attacks Blocked", col: C.navy },{ val: "3", lbl: "Open Alerts", col: "#ba1a1a" },{ val: "100", lbl: "Security Score", col: "#426900" }].map(s => (
          <div key={s.lbl} style={{ background: C.bgSurface, border: `1px solid ${C.borderSub}`, borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.col, lineHeight: 1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.val}</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{s.lbl}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {evts.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.bgSurface, border: `1px solid ${C.borderSub}`, borderRadius: 7, padding: "8px 10px", fontSize: 12, opacity: i === 0 ? 1 : 0.8, transition: "opacity 0.3s" }}>
            <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: e.col, background: e.bg, border: `1px solid ${e.bdr}`, fontFamily: "'Plus Jakarta Sans',sans-serif", flexShrink: 0 }}>{e.sev}</span>
            <span style={{ color: C.text, flex: 1 }}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay = 0 }: { icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  const { ref, visible } = useReveal();
  const [hov, setHov] = useState(false);
  return (
    <div ref={ref} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: C.white, border: `1px solid ${hov ? C.navy : C.borderSub}`, borderRadius: 12, padding: 24, opacity: visible ? 1 : 0, transform: visible ? (hov ? "translateY(-3px)" : "none") : "translateY(24px)", transition: `opacity 0.6s ease ${delay}ms, transform 0.3s ease, border-color 0.2s`, boxShadow: hov ? "0 12px 32px rgba(0,40,142,0.08)" : "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(0,40,142,0.06)", border: `1px solid rgba(0,40,142,0.12)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>{icon}</div>
      <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 8, color: C.text }}>{title}</h3>
      <p style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>{desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  const [navScrolled, setNavScrolled] = useState(false);
  useEffect(() => {
    const h = () => { setScrollY(window.scrollY); setNavScrolled(window.scrollY > 40); };
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const btnPrimary = { background: C.lime, color: C.shield, padding: "14px 28px", borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-flex" as const, alignItems: "center" as const, gap: 8, transition: "transform 0.2s, box-shadow 0.2s", boxShadow: "0 4px 16px rgba(141,198,63,0.3)" };
  const btnOutline = { border: `1.5px solid ${C.navy}`, color: C.navy, padding: "14px 28px", borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-flex" as const, alignItems: "center" as const, gap: 8, transition: "background 0.2s" };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:${C.bg};color:${C.text};font-family:'Inter',sans-serif;overflow-x:hidden}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.navy};border-radius:4px}
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.75)}}
        @keyframes ringPulse{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.05);opacity:1}}
        @media(max-width:900px){.hgrid{grid-template-columns:1fr!important}.hvis{display:none!important}.wgrid{grid-template-columns:1fr!important}.pgrid{grid-template-columns:1fr!important}.steps{grid-template-columns:1fr!important}.sgrid{grid-template-columns:repeat(2,1fr)!important}.tbadges{grid-template-columns:repeat(3,1fr)!important}}
        @media(max-width:600px){.fgrid{grid-template-columns:1fr!important}.sgrid{grid-template-columns:repeat(2,1fr)!important}.tbadges{grid-template-columns:repeat(2,1fr)!important}}
        @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
      `}</style>

      {/* Floating shield — fixed, always visible */}
      <FloatingShield scrollY={scrollY}/>

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: navScrolled ? "10px 6%" : "14px 6%", display: "flex", alignItems: "center", justifyContent: "space-between", background: navScrolled ? "rgba(247,249,251,0.98)" : "rgba(247,249,251,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.borderSub}`, transition: "all 0.3s ease", boxShadow: navScrolled ? "0 2px 16px rgba(0,40,142,0.06)" : "none" }}>
        <ShieldLogo size={52}/>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["Features","How It Works","Pricing"].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,"-")}`} style={{ color: C.textMid, textDecoration: "none", fontSize: 14, fontWeight: 500, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = C.navy)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textMid)}>{l}</a>
          ))}
          <Link href="/login" style={{ color: C.navy, textDecoration: "none", fontSize: 14, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "color 0.2s" }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.mintDark)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.navy)}>Log In</Link>
          <Link href="/sign-up" style={{ background: C.navy, color: "#fff", padding: "10px 22px", borderRadius: 7, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 13, textDecoration: "none", letterSpacing: "0.3px", transition: "background 0.2s, transform 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.navyDark; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.navy; (e.currentTarget as HTMLElement).style.transform = "none"; }}>Get Protected</Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "120px 6% 80px", position: "relative", overflow: "hidden", background: `radial-gradient(at 0% 0%, rgba(184,245,104,0.15) 0, transparent 50%), radial-gradient(at 100% 0%, rgba(55,85,195,0.05) 0, transparent 50%), ${C.bg}` }}>
        <div className="hgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", maxWidth: 1240, margin: "0 auto", width: "100%" }}>
          <div>
            <Reveal>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(141,198,63,0.12)", border: "1px solid rgba(141,198,63,0.3)", borderRadius: 100, padding: "6px 14px", fontSize: 12, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", color: "#304f00", letterSpacing: "0.5px", marginBottom: 24 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.lime, animation: "livePulse 2s ease-in-out infinite" }}/>
                Security that actually works
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(36px,4vw,58px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-1.5px", marginBottom: 20, color: C.text }}>
                The Leading Independent<br/><span style={{ color: C.navy }}>WordPress Security</span><br/>Plugin.
              </h1>
            </Reveal>
            <Reveal delay={140}>
              <p style={{ fontSize: 18, color: C.textMid, lineHeight: 1.7, marginBottom: 32, maxWidth: 520 }}>Shield your site from bots, malware, brute-force logins, and vulnerable plugins. Real-time protection that actually works — without slowing down WordPress.</p>
            </Reveal>
            <Reveal delay={200}>
              <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 36 }}>
                {["Attack Detection & Real-time Logging","File Integrity Monitoring (FIM)","Active IP & Geo Blocking","Malware & Core Integrity Scanner","Login & User Activity Tracking"].map(b => (
                  <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: C.textMid }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(141,198,63,0.15)", border: `1.5px solid ${C.lime}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    {b}
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={260}>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Link href="/sign-up" style={btnPrimary}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(141,198,63,0.4)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(141,198,63,0.3)"; }}>
                  Shield Your Sites Today
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
                <a href="#features" style={btnOutline}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(0,40,142,0.04)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}>Explore Features</a>
              </div>
            </Reveal>
          </div>
          <div className="hvis" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Reveal direction="right"><DashboardMock/></Reveal>
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section style={{ padding: "96px 6%", background: C.white }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <Reveal><p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: C.navy, marginBottom: 14 }}>The Threat Reality</p></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 16, color: C.text }}>Your WordPress Site Is<br/>Constantly Being Targeted</h2></Reveal>
          <div className="wgrid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, marginTop: 48 }}>
            <Reveal direction="left">
              <p style={{ fontSize: 16, color: C.textMid, lineHeight: 1.8, marginBottom: 24 }}>Bots, malware, brute-force attempts, and vulnerable plugins attack WordPress sites every day. Even small websites are automated targets.</p>
              <div style={{ background: C.bgSurface, borderLeft: `4px solid ${C.lime}`, borderRadius: "0 8px 8px 0", padding: "20px 24px", marginBottom: 24 }}>
                <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontStyle: "italic", color: C.navy, fontWeight: 600 }}>"WP Shielder is antifragile: every attack makes it stronger."</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.18-5.14"/></svg>, text: "Website downtime & revenue loss" },
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>, text: "SEO blacklisting by Google" },
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>, text: "Stolen customer data & credentials" },
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, text: "Malware injections & backdoors" },
                  { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ba1a1a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M3.27 9h17.46"/></svg>, text: "Hosting account suspension" },
                ].map(item => (
                  <div key={item.text} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.textMid }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(186,26,26,0.08)", border: "1px solid rgba(186,26,26,0.18)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {item.icon}
                    </div>
                    {item.text}
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal direction="right">
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[["01","24/7 Monitoring","Continuously monitors activity, logins, files, and suspicious behaviour around the clock."],["02","Instant Threat Detection","Detect SQLi, XSS, malware, and unauthorized file changes the moment they happen."],["03","Proactive Blocking","Automatically block malicious IPs, scanners, and suspicious traffic before damage is done."]].map(([n,t,d]) => (
                  <div key={n as string} style={{ background: C.bg, border: `1px solid ${C.borderSub}`, borderRadius: 12, padding: "20px 22px", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s", cursor: "default" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.navy; (e.currentTarget as HTMLElement).style.transform = "translateX(4px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,40,142,0.08)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderSub; (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.navy, letterSpacing: 2, marginBottom: 6, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{n}</div>
                    <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 6, color: C.text }}>{t as string}</h3>
                    <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6, margin: 0 }}>{d as string}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: "96px 6%", background: C.bgSurface }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <Reveal><p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: C.navy, marginBottom: 14 }}>Full Protection Suite</p></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,3vw,42px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 56, color: C.text }}>Engineered for Absolute Defense</h2></Reveal>
          <div className="fgrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
            {[
              { title: "Attack Detection & Logging", desc: "Track SQLi, XSS, LFI, and RCE attempts in real time with full request context.", delay: 0 },
              { title: "Login Monitoring", desc: "Detect brute-force patterns and get alerted on suspicious authentication events.", delay: 60 },
              { title: "File Integrity Monitoring", desc: "Hash-based verification detects unauthorized changes to WordPress core, themes, plugins.", delay: 120 },
              { title: "Malware Scanner", desc: "Scan for malicious code and suspicious patterns against WordPress checksums.", delay: 0 },
              { title: "Active IP Blocking", desc: "Coraza Shadow WAF auto-bans attackers within seconds of detection.", delay: 60 },
              { title: "Geo Blocking", desc: "Restrict traffic from specific countries using geolocation intelligence.", delay: 120 },
              { title: "User Activity Logs", desc: "Track admin actions, plugin changes, and user events with full timestamps.", delay: 0 },
              { title: "XML-RPC Protection", desc: "Disable XML-RPC to eliminate DDoS amplification and credential stuffing vectors.", delay: 60 },
              { title: "Away & Maintenance Mode", desc: "Restrict wp-admin to business hours and show branded maintenance pages.", delay: 120 },
              { title: "Config Sync", desc: "Security settings push to WordPress every 2 minutes — or instantly with Force Sync.", delay: 0 },
            ].map((f, i) => (
              <FeatureCard key={f.title} icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              } title={f.title} desc={f.desc} delay={f.delay}/>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS (dark band) ── */}
      <section style={{ padding: "88px 6%", background: C.navy }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <Reveal><div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Global Protection Stats</p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(26px,3vw,40px)", fontWeight: 800, letterSpacing: "-1px", color: "#fff" }}>Real-Time Defense Across the Network</h2>
          </div></Reveal>
          <div className="sgrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            <StatCard target={637} suffix="M+" label="Firewall Blocks" delay={0}/>
            <StatCard target={80}  suffix="M+" label="Malicious Bots" delay={100}/>
            <StatCard target={97}  suffix="M+" label="IPs Blocked" delay={200}/>
            <StatCard target={34}  suffix="M+" label="Login Blocks" delay={300}/>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: "96px 6%", background: C.white }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", textAlign: "center" }}>
          <Reveal><p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: C.navy, marginBottom: 14 }}>Simple Setup</p></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(26px,3vw,42px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 64, color: C.text }}>Simple Setup. Continuous Protection.</h2></Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 20 }}>
            {[
              ["Attack Detection","Real-time logging of SQLi, XSS, LFI and RCE attempts with full context."],
              ["File Monitoring","Hash-based verification of WordPress core, themes and plugin files."],
              ["IP Blocking","Coraza WAF auto-bans attackers within seconds of detection."],
              ["Geo Blocking","Restrict traffic from specific countries using geolocation."],
              ["Login Shield","Monitor brute-force attempts and suspicious auth events."],
              ["Malware Scan","Scan for malicious code against WordPress core checksums."],
              ["Activity Logs","Track admin actions and user events with full timestamps."],
              ["XML-RPC Off","Disable XML-RPC to eliminate DDoS and credential stuffing."],
              ["Away Mode","Lock wp-admin outside business hours automatically."],
              ["Config Sync","Settings push to WordPress every 2 minutes automatically."],
            ].map(([t, d], i) => (
              <Reveal key={t as string} delay={i * 60}>
                <div style={{ background: C.bg, border: `1px solid ${C.borderSub}`, borderRadius: 12, padding: "20px 16px", textAlign: "left", transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.navy; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,40,142,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderSub; (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(0,40,142,0.07)", border: `1px solid rgba(0,40,142,0.12)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 800, color: C.navy }}>{String(i + 1).padStart(2,"0")}</span>
                  </div>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 6, color: C.text }}>{t as string}</h3>
                  <p style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.55, margin: 0 }}>{d as string}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ── */}
      <section style={{ padding: "96px 6%", background: C.bgSurface }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <Reveal><div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: C.navy, marginBottom: 14 }}>Trusted Protection</p>
            <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(26px,3vw,42px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", color: C.text }}>Trusted by WordPress Professionals</h2>
          </div></Reveal>
          <Reveal delay={80}>
            <div style={{ background: C.white, border: `1px solid ${C.borderSub}`, borderLeft: `4px solid ${C.navy}`, borderRadius: "0 12px 12px 0", padding: "32px 36px", marginBottom: 36, boxShadow: "0 4px 20px rgba(0,40,142,0.05)" }}>
              <p style={{ fontSize: 17, lineHeight: 1.75, fontStyle: "italic", color: C.textMid, marginBottom: 16 }}>"WP Shielder helped us detect suspicious login attempts and SQL injection probes before they became a real issue. The dashboard gives us complete visibility at all times."</p>
              <cite style={{ fontStyle: "normal", fontSize: 14, color: C.textMuted, fontWeight: 600 }}>— Website Administrator, Digital Marketing Agency</cite>
            </div>
          </Reveal>
          <div className="tbadges" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14 }}>
            {[
              { label: "Real-Time Monitoring", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
              { label: "Malware Detection", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg> },
              { label: "WordPress Focused", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
              { label: "Performance Friendly", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
              { label: "Agency Ready", icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
            ].map((b, i) => (
              <Reveal key={b.label} delay={i * 70}>
                <div style={{ background: C.white, border: `1px solid ${C.borderSub}`, borderRadius: 10, padding: "18px 14px", textAlign: "center", transition: "border-color 0.2s, box-shadow 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.navy; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,40,142,0.08)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.borderSub; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(0,40,142,0.07)", border: `1px solid rgba(0,40,142,0.12)`, margin: "0 auto 10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {b.icon}
                  </div>
                  <p style={{ fontSize: 12, color: C.textMid, fontWeight: 600, lineHeight: 1.4, margin: 0 }}>{b.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: "96px 6%", background: C.bg }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", textAlign: "center" }}>
          <Reveal><p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", color: C.navy, marginBottom: 14 }}>Simple Pricing</p></Reveal>
          <Reveal delay={60}><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(26px,3vw,42px)", fontWeight: 800, lineHeight: 1.12, letterSpacing: "-1px", marginBottom: 16, color: C.text }}>One Plan. Full Protection.</h2></Reveal>
          <Reveal delay={120}><p style={{ fontSize: 16, color: C.textMid, margin: "0 auto 48px", maxWidth: 500 }}>Complete protection for professional WordPress sites. No hidden fees.</p></Reveal>
          <Reveal delay={180}>
            <div style={{ maxWidth: 520, margin: "0 auto", background: C.white, border: `1px solid ${C.borderSub}`, borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,40,142,0.1)" }}>
              <div style={{ background: C.navy, padding: "40px 40px 32px", textAlign: "center" }}>
                <span style={{ display: "inline-block", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>Best Value</span>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>WP Shielder Pro</h3>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 52, fontWeight: 800, color: C.lime, lineHeight: 1, margin: "16px 0 4px" }}>$10<span style={{ fontSize: 20, color: "rgba(255,255,255,0.6)" }}>/mo</span></div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>per WordPress site · billed monthly</p>
              </div>
              <div style={{ padding: "32px 40px" }}>
                <ul style={{ listStyle: "none", textAlign: "left", marginBottom: 28, display: "flex", flexDirection: "column", gap: 10 }}>
                  {["Real-time attack detection & logging","File integrity monitoring (FIM)","Malware & core integrity scanner","Active IP & geo blocking","Login & user activity monitoring","XML-RPC protection","Config sync & instant enforcement","Away & maintenance mode","Cloud security dashboard","Security hardening audit","PDF & Excel security reports","Priority updates"].map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.textMid }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up" style={{ display: "block", width: "100%", background: C.lime, color: C.shield, textAlign: "center", padding: 16, borderRadius: 10, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 800, fontSize: 16, textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(141,198,63,0.35)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                  Start Protecting Your Site
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "100px 6%", background: C.navy, textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <Reveal><h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1px", color: "#fff", marginBottom: 16 }}>Secure Your WordPress<br/>Website Today</h2></Reveal>
          <Reveal delay={80}><p style={{ fontSize: 17, color: "rgba(255,255,255,0.65)", lineHeight: 1.75, marginBottom: 36 }}>Stop attacks, monitor changes, and protect your WordPress installation. Setup takes under 2 minutes.</p></Reveal>
          <Reveal delay={160}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/sign-up" style={{ background: C.lime, color: C.shield, padding: "14px 28px", borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, transition: "transform 0.2s, box-shadow 0.2s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 28px rgba(141,198,63,0.35)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                Get Started for $10/month
              </Link>
              <Link href="/login" style={{ border: "1.5px solid rgba(255,255,255,0.3)", color: "#fff", padding: "14px 28px", borderRadius: 8, fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: 600, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8, transition: "border-color 0.2s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.6)")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.3)")}>
                Log In
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: C.bgSurface, borderTop: `1px solid ${C.borderSub}`, padding: "36px 6%" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <ShieldLogo size={48}/>
          <div style={{ display: "flex", gap: 24 }}>
            {[["#features","Features"],["#how-it-works","How It Works"],["#pricing","Pricing"],["https://cybernara.com","Cybernara"]].map(([href, label]) => (
              <a key={label as string} href={href as string} style={{ fontSize: 13, color: C.textMuted, textDecoration: "none", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = C.navy)}
                onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>{label}</a>
            ))}
          </div>
          <p style={{ fontSize: 13, color: C.textMuted }}>© 2026 WP Shielder by Cybernara. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}