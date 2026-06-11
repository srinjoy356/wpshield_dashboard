"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Verify2FAPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetch("/api/auth/send-2fa", { method: "POST" })
      .then(res => res.json())
      .then(data => {
        if (data.success) setSent(true);
      });
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const res = await fetch("/api/auth/verify-2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    
    const data = await res.json();
    if (data.success) {
      window.location.href = data.redirectUrl || "/app";
    } else {
      alert("Invalid or expired code");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md border border-gray-200">
        <h1 className="text-2xl font-bold mb-6 text-center text-[#0a6358]">Two-Factor Authentication</h1>
        {sent ? (
          <p className="text-sm text-gray-600 mb-6 text-center">We've sent a 6-digit verification code to your email.</p>
        ) : (
          <p className="text-sm text-gray-600 mb-6 text-center">Sending code to your email...</p>
        )}
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <input 
              type="text" 
              maxLength={6} 
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="w-full px-4 py-3 border rounded text-center text-3xl tracking-widest focus:ring-2 focus:ring-[#0a6358] focus:border-transparent outline-none"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || code.length !== 6 || !sent}
            className="w-full bg-[#0a6358] text-white py-3 rounded-lg hover:bg-[#084d44] font-semibold disabled:opacity-50 transition-colors"
          >
            {loading ? "Verifying..." : "Verify Code"}
          </button>
        </form>
      </div>
    </div>
  );
}
