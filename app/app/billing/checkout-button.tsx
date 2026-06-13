"use client";

import { useState } from "react";
import Script from "next/script";

export function CheckoutButton({ planId, userEmail, userId }: {
  planId: string; userEmail: string; userId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/paynimo-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planId, customer_email: userEmail, user_id: userId }),
      });
      const data = await res.json();
      if (data.reqJson) {
        const $ = (window as any).$;
        if ($ && $.pnCheckout) {
          $.pnCheckout(data.reqJson);
        } else {
          alert("Payment gateway is still loading. Please wait a moment and try again.");
        }
      } else {
        alert(data.error || "Checkout failed. Please try again.");
      }
    } catch {
      alert("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Script src="https://www.paynimo.com/paynimocheckout/client/lib/jquery.min.js" strategy="lazyOnload"/>
      <Script src="https://www.paynimo.com/paynimocheckout/server/lib/checkout.js" strategy="lazyOnload"/>
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-[#0a6358] text-white py-3 px-4 rounded-lg font-semibold hover:bg-[#084d44] transition-colors disabled:opacity-50"
      >
        {loading ? "Initializing..." : "Subscribe Now"}
      </button>
    </div>
  );
}