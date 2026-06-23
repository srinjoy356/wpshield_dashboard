'use client'
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Mail, Lock, Eye, EyeClosed, ArrowRight, Shield, Activity, Zap, CheckCircle2 } from 'lucide-react';

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-transparent flex h-9 w-full min-w-0 px-3 py-1 text-base transition-all outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus:outline-none focus-visible:outline-none focus-visible:ring-0",
        className
      )}
      {...props}
    />
  )
}

interface SignInCardProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  error: string | null;
  successMessage: string | null;
}

export function Component({
  email,
  setEmail,
  password,
  setPassword,
  isLoading,
  onSubmit,
  error,
  successMessage
}: SignInCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // For 3D card effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [6, -6]);
  const rotateY = useTransform(mouseX, [-300, 300], [-6, 6]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
    setMousePosition({ x: e.clientX, y: e.clientY });
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

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
              Securing WordPress <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#B0E4CC] via-[#408A71] to-[#285A48]">
                At the Core.
              </span>
            </h1>
            <p className="text-white/60 text-[21px] leading-relaxed">
              Enterprise-grade real-time security dashboard monitoring, vulnerability scanning, and instant patch orchestration for scaling WordPress ecosystems.
            </p>
          </div>

          {/* Core features list */}
          <div className="space-y-6 pt-6 border-t border-white/5">
            <div className="flex items-start gap-4">
              <div className="mt-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B0E4CC]" />
              </div>
              <div>
                <h4 className="text-[19px] font-semibold text-white">Advanced Core Monitoring</h4>
                <p className="text-[16px] text-white/45 mt-0.5">Instant monitoring of modifications to core codebases.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="mt-1.5 flex items-center justify-center w-6 h-6 rounded-full bg-white/5 border border-white/10 shrink-0">
                <Zap className="w-3.5 h-3.5 text-[#B0E4CC]" />
              </div>
              <div>
                <h4 className="text-[19px] font-semibold text-white">Smart Firewall Protection</h4>
                <p className="text-[16px] text-white/45 mt-0.5">Proactive defense barriers blocking SQLi and XSS payloads.</p>
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16 relative">
        {/* Dynamic mesh gradient blob that flows behind the glass container, refracting beautifully */}
        <motion.div 
          className="absolute w-[350px] h-[350px] rounded-full bg-gradient-to-tr from-[#B0E4CC]/15 to-[#408A71]/5 blur-[60px]"
          animate={{
            x: [-60, 60, -60],
            y: [50, -50, 50],
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
          className="w-full max-w-[500px] relative z-10"
          style={{ perspective: 1500 }}
        >
          <motion.div
            style={{ rotateX, rotateY }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="group"
          >
            {/* The Glass Panel */}
            <div className="relative bg-white/[0.03] backdrop-blur-3xl rounded-3xl pt-14 pb-10 px-10 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] overflow-hidden transition-all duration-500 group-hover:border-white/15">
              
              {/* Highlight spotlight border hover */}
              <div className="absolute -inset-[1px] bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none -z-10" />

              {/* Logo inside card */}
              <div className="flex justify-center mb-6">
                <img src="/white-logo.png" alt="WPxShield" style={{ height: "64px", width: "auto" }} />
              </div>

              {/* Header */}
              <div className="text-center space-y-2 mb-8">
                <h2 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                  Welcome back
                </h2>
                <p className="text-sm text-white/50">
                  Sign in to manage your shield nodes
                </p>
              </div>

              {/* Status messages */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center font-medium"
                >
                  {error}
                </motion.div>
              )}
              {successMessage && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-5 p-3.5 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-xs text-center font-medium"
                >
                  {successMessage}
                </motion.div>
              )}

              {/* Main Auth Form */}
              <form onSubmit={onSubmit} className="space-y-4">
                
                {/* Email Field */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-white/60 pl-1">Email Address</label>
                  <div className="relative flex items-center rounded-xl overflow-hidden">
                    <Mail className={`absolute left-3.5 w-4 h-4 transition-colors duration-300 z-10 ${
                      focusedInput === "email" ? 'text-[#B0E4CC]' : 'text-white/35'
                    }`} />
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full bg-white/[0.02] border-white/10 focus:border-white/20 text-white placeholder:text-white/20 h-11 transition-all duration-300 pl-11 pr-4 focus:bg-white/[0.06] backdrop-blur-sm rounded-xl"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-xs font-semibold text-white/60">Password</label>
                    <Link href="/forgot-password" className="text-xs text-[#B0E4CC]/75 hover:text-[#B0E4CC] transition-colors">
                      Forgot?
                    </Link>
                  </div>
                  <div className="relative flex items-center rounded-xl overflow-hidden">
                    <Lock className={`absolute left-3.5 w-4 h-4 transition-colors duration-300 z-10 ${
                      focusedInput === "password" ? 'text-[#B0E4CC]' : 'text-white/35'
                    }`} />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full bg-white/[0.02] border-white/10 focus:border-white/20 text-white placeholder:text-white/20 h-11 transition-all duration-300 pl-11 pr-11 focus:bg-white/[0.06] backdrop-blur-sm rounded-xl"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 cursor-pointer z-10"
                    >
                      {showPassword ? (
                        <Eye className="w-4 h-4 text-white/35 hover:text-white transition-colors duration-300" />
                      ) : (
                        <EyeClosed className="w-4 h-4 text-white/35 hover:text-white transition-colors duration-300" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember Me */}
                <div className="flex items-center space-x-2.5 pt-1 pl-1">
                  <div className="relative flex items-center">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                      className="appearance-none h-4 w-4 rounded-md border border-white/15 bg-white/5 checked:bg-white checked:border-white focus:outline-none transition-all duration-200 cursor-pointer"
                    />
                    {rememberMe && (
                      <div className="absolute inset-0 flex items-center justify-center text-[#091413] pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                    )}
                  </div>
                  <label htmlFor="remember-me" className="text-xs font-medium text-white/50 hover:text-white/80 transition-colors duration-200 cursor-pointer select-none">
                    Keep me signed in
                  </label>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative group/btn mt-6"
                >
                  <div className="absolute inset-0 bg-[#B0E4CC]/20 rounded-xl blur-md opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                  <div className="relative overflow-hidden bg-white text-black font-semibold h-11 rounded-xl transition-all duration-300 flex items-center justify-center text-sm hover:bg-[#eefcf6] active:scale-[0.99]">
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-black/70 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="flex items-center gap-1.5">
                        Access Control
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
                      </span>
                    )}
                  </div>
                </button>

                {/* Sign up footer */}
                <p className="text-center text-xs text-white/40 mt-6">
                  Don't have an operator key?{' '}
                  <Link href="/sign-up" className="text-[#B0E4CC] hover:underline font-semibold">
                    Sign up
                  </Link>
                </p>
              </form>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
