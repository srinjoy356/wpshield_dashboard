'use client'
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Shield, CheckCircle2, Zap } from "lucide-react";
import { SignUpForm } from "./SignUpForm";
import { motion } from "framer-motion";

function SignUpContent() {
  return (
    <div className="min-h-screen w-screen flex bg-[#091413] text-white overflow-hidden font-sans relative">
      {/* Decorative ambient lighting for the entire viewport */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#B0E4CC]/3 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#285A48]/10 blur-[120px]" />
      </div>

      {/* LEFT PANEL: Cinematic Brand Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-16 border-r border-white/5 bg-gradient-to-b from-[#0e211d] to-[#050a09]">
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Floating light orbs in left panel */}
        <motion.div 
          className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-[#B0E4CC]/5 blur-[80px]"
          animate={{
            x: [0, 40, 0],
            y: [0, -30, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Top Header Logo - shield icon removed */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/wpx-white-logo.png" alt="WPxShield" style={{ height: "104px", width: "auto" }} />
        </div>

        {/* Main Pitch */}
        <div className="relative z-10 my-auto space-y-10 max-w-lg">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[15px] font-semibold bg-[#B0E4CC]/10 text-[#B0E4CC] border border-[#B0E4CC]/20">
              <span className="w-2 h-2 rounded-full bg-[#B0E4CC] animate-pulse" />
              Active Cyber Protection
            </span>
            <h1 className="text-[50px] font-extrabold tracking-tight leading-tight bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/60">
              Join the Shield <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#B0E4CC] via-[#408A71] to-[#285A48]">
                Network Today.
              </span>
            </h1>
            <p className="text-white/60 text-[21px] leading-relaxed">
              Create an operator account to deploy vulnerability monitoring patches, manage firewall rule blocks, and orchestrate site protection across all your environments.
            </p>
          </div>

          {/* Core features list */}
          <div className="space-y-6 pt-6 border-t border-white/5">
            <div className="flex items-start gap-4">
              <div className="mt-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B0E4CC]" />
              </div>
              <div>
                <h4 className="text-[19px] font-semibold text-white">Instant API Key Provisioning</h4>
                <p className="text-[16px] text-white/45 mt-0.5">Get connected instantly with direct access key integration.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 shrink-0">
                <Zap className="w-3.5 h-3.5 text-[#B0E4CC]" />
              </div>
              <div>
                <h4 className="text-[19px] font-semibold text-white">Vulnerability Scanning Nodes</h4>
                <p className="text-[16px] text-white/45 mt-0.5">Inspect plugin structures and block remote execution triggers.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-white/35">
          &copy; 3cits Cybernara &bull; WPxShield Security Platform.
        </div>
      </div>

      {/* RIGHT PANEL: Form Canvas with Glass Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16 relative overflow-y-auto max-h-screen">
        {/* Dynamic mesh gradient blob that flows behind the glass container, refracting beautifully */}
        <motion.div 
          className="absolute w-[350px] h-[350px] rounded-full bg-gradient-to-tr from-[#B0E4CC]/15 to-[#408A71]/5 blur-[60px]"
          animate={{
            x: [60, -60, 60],
            y: [-50, 50, -50],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-[550px] relative z-10 py-8"
        >
          {/* The Glass Panel */}
          <div className="relative bg-white/[0.03] backdrop-blur-3xl rounded-3xl pt-14 pb-10 px-10 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden">
            
            {/* Logo inside card */}
            <div className="flex justify-center mb-6">
              <img src="/white-logo.png" alt="WPxShield" style={{ height: "64px", width: "auto" }} />
            </div>

            {/* Header */}
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                Create an Account
              </h2>
              <p className="text-sm text-white/50">
                Register a new operator instance
              </p>
            </div>

            <SignUpForm />

            <div className="mt-6 text-center text-sm text-white/50">
              Already have an account?{" "}
              <Link href="/login" className="text-[#B0E4CC] hover:underline font-semibold transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#091413]">
        <Loader2 className="h-8 w-8 animate-spin text-[#B0E4CC]" />
      </div>
    }>
      <SignUpContent />
    </Suspense>
  );
}
