import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import dns from "dns/promises";

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
  /^169\.254\./,
];

function isPrivateHost(hostname: string): boolean {
  return PRIVATE_IP_PATTERNS.some(p => p.test(hostname));
}

// Resolves the hostname and checks every returned address — this closes the gap where
// an attacker-controlled domain (e.g. evil.example.com) resolves to a private/internal
// IP like 169.254.169.254 (cloud metadata) while the hostname string itself looks public.
//
// Note: this is a point-in-time check, not a fully pinned connection. Node's own fetch()
// re-resolves DNS independently when it actually connects, so a sub-second DNS-rebinding
// attack (TTL=0, different answer on the second lookup) could theoretically still slip
// through between this check and the fetch call below. Fully closing that requires a
// custom fetch dispatcher that connects to the IP we already resolved rather than letting
// fetch() re-resolve — flagging this as a known residual gap rather than leaving it unsaid.
async function isPrivateHostAfterResolution(hostname: string): Promise<boolean> {
  if (isPrivateHost(hostname)) return true; // fast path for obvious cases

  let resolvedAny = false;

  try {
    const addresses = await dns.resolve4(hostname);
    resolvedAny = true;
    if (addresses.some(ip => isPrivateHost(ip))) return true;
  } catch {
    // No A record — try AAAA below before deciding
  }

  try {
    const addressesV6 = await dns.resolve6(hostname);
    resolvedAny = true;
    if (addressesV6.some(ip => isPrivateHost(ip))) return true;
  } catch {
    // No AAAA record either
  }

  // Couldn't resolve the hostname at all via either family — block rather than let an
  // unresolvable/erroring lookup silently pass through.
  if (!resolvedAny) return true;

  return false;
}

export async function POST(request: Request) {
  try {
    // Must be authenticated
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only http and https URLs are allowed" }, { status: 400 });
    }

    // Block private/internal hosts — now checking resolved IPs, not just the hostname string
    if (await isPrivateHostAfterResolution(parsed.hostname)) {
      return NextResponse.json({ error: "Private or internal URLs are not allowed" }, { status: 400 });
    }

    const response = await fetch(parsed.toString(), {
      method: "HEAD",
      headers: { "User-Agent": "WPShield-Validator/1.0" },
      signal: AbortSignal.timeout(5000),
      redirect: "manual", // Don't follow redirects to private IPs
    });

    // Check redirect target isn't private — also resolved, not just string-matched
    const location = response.headers.get("location");
    if (location) {
      try {
        const redirectUrl = new URL(location);
        if (await isPrivateHostAfterResolution(redirectUrl.hostname)) {
          return NextResponse.json({ error: "Redirect to private IP blocked" }, { status: 400 });
        }
      } catch {}
    }

    return NextResponse.json({ success: true, status: response.status });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Unreachable" });
  }
}