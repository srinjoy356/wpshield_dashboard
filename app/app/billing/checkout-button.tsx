"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import Script from "next/script";

export function CheckoutButton({ planId, userEmail, userId }: { planId: string, userEmail: string, userId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // Get Paynimo Checkout JS config
      const res = await fetch("/api/billing/paynimo-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_code: planId, customer_email: userEmail, user_id: userId })
      });
      const data = await res.json();
      
      if (data.reqJson) {
        // Verify scripts are loaded
        const $ = (window as any).$;
        if ($ && $.pnCheckout) {
          // Checkout JS handles the redirect to ReturnURL on its own
          $.pnCheckout(data.reqJson);
        } else {
          alert("Payment gateway is still loading. Please wait a second and try again.");
        }
      } else {
        alert(data.error || "Checkout failed to generate Paynimo payload");
      }
    } catch (err) {
      alert("Error occurred during checkout initialization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Script src="https://www.paynimo.com/paynimocheckout/client/lib/jquery.min.js" strategy="lazyOnload" />
      <Script src="https://www.paynimo.com/paynimocheckout/server/lib/checkout.js" strategy="lazyOnload" />
      
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-[#0a6358] text-white py-2 px-4 rounded hover:bg-[#084d44] transition-colors disabled:opacity-50"
      >
        {loading ? "Initializing..." : "Subscribe Now (Worldline)"}
      </button>

      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={async () => {
             // Quick local bypass trigger
             setLoading(true);
             const res = await fetch("/api/billing/paynimo-dev-bypass", {
               method: "POST",
               headers: {"Content-Type": "application/json"},
               body: JSON.stringify({ planId, userEmail, userId })
             });
             if (res.ok) {
                window.location.reload();
             } else {
                alert("Bypass failed.");
                setLoading(false);
             }
          }}
          disabled={loading}
          className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
        >
          Bypass Gateway (Dev Mode)
        </button>
      )}
    </div>
  );
}
