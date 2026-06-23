"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { signUpAction } from "./actions";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

export function SignUpForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  
  // Math CAPTCHA state
  const [num1, setNum1] = useState(0);
  const [num2, setNum2] = useState(0);

  useEffect(() => {
    setNum1(Math.floor(Math.random() * 10) + 1);
    setNum2(Math.floor(Math.random() * 10) + 1);
  }, []);

  const [form, setForm] = useState({
    company_id: "",
    site_url: "",
    display_name: "",
    contact_email: "",
    captcha_answer: "",
  });

  const [isPending, startTransition] = useTransition();

  // URL Validation State
  const [isValidatingUrl, setIsValidatingUrl] = useState(false);
  const [urlWarning, setUrlWarning] = useState<string | null>(null);
  const [urlBypass, setUrlBypass] = useState(false); // If true, they clicked "Proceed anyway"

  const validateUrl = async (url: string) => {
    setIsValidatingUrl(true);
    setUrlWarning(null);
    try {
      const res = await fetch("/api/validate-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data.success) {
        setUrlWarning(`We couldn't verify this URL (Status: ${data.status || data.error}). Are you sure it's correct?`);
        setUrlBypass(false);
        return false;
      }
      return true;
    } catch (e) {
      setUrlWarning("Failed to reach the URL for verification.");
      setUrlBypass(false);
      return false;
    } finally {
      setIsValidatingUrl(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. CAPTCHA Check
    if (parseInt(form.captcha_answer, 10) !== num1 + num2) {
      setError("CAPTCHA is incorrect. Please try again.");
      setNum1(Math.floor(Math.random() * 10) + 1);
      setNum2(Math.floor(Math.random() * 10) + 1);
      setForm({ ...form, captcha_answer: "" });
      return;
    }

    // 2. URL Validation Check (if not bypassed)
    if (!urlBypass) {
      const isUrlValid = await validateUrl(form.site_url);
      if (!isUrlValid) {
        return; // Stops here, shows warning. User must click "Proceed Anyway" to bypass.
      }
    }

    // 3. Submit
    startTransition(async () => {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      formData.append("captcha_num1", num1.toString());
      formData.append("captcha_num2", num2.toString());

      const result = await signUpAction(formData);

      if (result.error) {
        setError(result.error);
        // Refresh captcha on error
        setNum1(Math.floor(Math.random() * 10) + 1);
        setNum2(Math.floor(Math.random() * 10) + 1);
        setForm(prev => ({ ...prev, captcha_answer: "" }));
      } else if (result.success && result.credentials) {
        const { email, company_id } = result.credentials;
        setUserEmail(email);

        try {
          const inviteRes = await fetch("/api/send-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ company_id, email }),
          });

          if (!inviteRes.ok) {
            toast({
              title: "Account created, but email failed to send.",
              description: "You can still use the Forgot Password link to log in.",
              variant: "destructive",
            });
          }
        } catch (err) {
          // ignore
        }
        
        setSuccess(true);
      }
    });
  };

  if (success) {
    return (
      <div className="mt-8 space-y-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-bold">Account Created!</h2>
        <p className="text-sm text-[var(--muted)]">
          Welcome aboard! We've set up your WPShield account.
        </p>
        <Alert className="bg-blue-50 border-blue-200">
          <AlertDescription className="text-blue-800 text-sm text-left">
            We've sent a welcome email to <strong>{userEmail}</strong>. 
            <br/><br/>
            Since your password was automatically generated for security, please use the <strong>Forgot Password</strong> link on the login page to set your own password and sign in.
          </AlertDescription>
        </Alert>
        <Link href="/login" className="block w-full">
          <Button className="w-full">Go to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4 relative z-10 text-white">
      {error && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Company ID */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-white/80">Company ID (Used for Plugin Activation) <span className="text-red-400">*</span></label>
        <Input
          value={form.company_id}
          onChange={(e) => setForm({ ...form, company_id: e.target.value })}
          placeholder="e.g. acme-corp"
          required
          className="w-full bg-white/[0.04] border-white/10 focus:border-white/25 text-white placeholder:text-white/30 h-10 transition-all duration-300 focus:bg-white/[0.09] backdrop-blur-sm font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        />
      </div>

      {/* Display Name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-white/80">Company Name <span className="text-red-400">*</span></label>
        <Input
          value={form.display_name}
          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
          placeholder="e.g. Acme Corporation"
          required
          className="w-full bg-white/[0.04] border-white/10 focus:border-white/25 text-white placeholder:text-white/30 h-10 transition-all duration-300 focus:bg-white/[0.09] backdrop-blur-sm text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        />
      </div>

      {/* Site URL */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-white/80">WordPress Site URL <span className="text-red-400">*</span></label>
        <Input
          type="url"
          value={form.site_url}
          onChange={(e) => {
            setForm({ ...form, site_url: e.target.value });
            setUrlWarning(null);
            setUrlBypass(false);
          }}
          placeholder="https://example.com"
          required
          className="w-full bg-white/[0.04] border-white/10 focus:border-white/25 text-white placeholder:text-white/30 h-10 transition-all duration-300 focus:bg-white/[0.09] backdrop-blur-sm text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        />
      </div>

      {urlWarning && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
          <AlertCircle className="h-4 w-4 text-red-400" />
          <AlertTitle className="text-xs font-bold">URL Verification Failed</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            {urlWarning}
            <div className="mt-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                onClick={() => {
                  setUrlBypass(true);
                  setUrlWarning(null);
                }}
              >
                It is correct, proceed anyway
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Contact Email */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-white/80">Admin Email <span className="text-red-400">*</span></label>
        <Input
          type="email"
          value={form.contact_email}
          onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
          placeholder="admin@example.com"
          required
          className="w-full bg-white/[0.04] border-white/10 focus:border-white/25 text-white placeholder:text-white/30 h-10 transition-all duration-300 focus:bg-white/[0.09] backdrop-blur-sm text-sm focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
        />
      </div>

      {/* Math CAPTCHA */}
      <div className="space-y-1 pt-1">
        <label className="text-xs font-medium text-white/80">Security Check <span className="text-red-400">*</span></label>
        <div className="flex items-center gap-3">
          <div className="bg-white/[0.05] border border-white/15 rounded px-4 py-2 font-mono font-bold tracking-widest text-base min-w-[100px] text-center text-white backdrop-blur-sm">
            {num1} + {num2} =
          </div>
          <Input
            type="number"
            value={form.captcha_answer}
            onChange={(e) => setForm({ ...form, captcha_answer: e.target.value })}
            placeholder="?"
            required
            className="bg-white/[0.04] border-white/10 focus:border-white/25 text-white placeholder:text-white/30 h-10 transition-all duration-300 focus:bg-white/[0.09] backdrop-blur-sm text-center font-mono text-base focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
          />
        </div>
      </div>

      <div className="pt-3">
        <Button 
          type="submit" 
          disabled={isPending || isValidatingUrl || (!!urlWarning && !urlBypass)} 
          className="w-full bg-white text-black hover:bg-white/95 transition-colors font-medium h-10 rounded-lg text-sm"
        >
          {isValidatingUrl ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-black" />
              <span>Verifying URL...</span>
            </div>
          ) : isPending ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-black" />
              <span>Creating Account...</span>
            </div>
          ) : (
            "Sign Up"
          )}
        </Button>
      </div>
    </form>
  );
}
