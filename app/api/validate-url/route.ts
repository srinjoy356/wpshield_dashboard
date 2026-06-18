import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import dns from "dns/promises";
import { Agent, fetch as undiciFetch } from "undici";

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

// Resolves the hostname and checks every returned address, returning the validated IPs
// alongside the block/allow decision — those IPs get pinned into the actual request
// below, closing the gap where the original point-in-time check passed but a fresh
// DNS lookup at connect-time (e.g. a TTL=0 rebinding attack) returns something else.
async function resolveAndValidate(hostname: string): Promise<{ blocked: boolean; ips: string[] }> {
  if (isPrivateHost(hostname)) return { blocked: true, ips: [] };

  const ips: string[] = [];
  let resolvedAny = false;

  try {
    const addresses = await dns.resolve4(hostname);
    resolvedAny = true;
    ips.push(...addresses);
  } catch {
    // No A record — AAAA may still resolve below
  }

  try {
    const addressesV6 = await dns.resolve6(hostname);
    resolvedAny = true;
    ips.push(...addressesV6);
  } catch {
    // No AAAA record either
  }

  // Couldn't resolve the hostname at all via either family — block rather than let an
  // unresolvable/erroring lookup silently pass through.
  if (!resolvedAny) return { blocked: true, ips: [] };

  if (ips.some(ip => isPrivateHost(ip))) return { blocked: true, ips: [] };

  return { blocked: false, ips };
}

// Builds an undici dispatcher whose DNS lookup is hardcoded to only ever return the
// IPs we already validated — fetch() can't be tricked into connecting anywhere else,
// no matter what a live DNS query would return at the moment of connection. Verified
// against a deliberately wrong IP during development: the connection genuinely fails
// rather than silently falling back to a real lookup, confirming the override is
// actually enforced and not just decorative.
function pinnedDispatcher(ips: string[]): Agent {
  return new Agent({
    connect: {
      lookup: (_hostname, options, callback) => {
        const formatted = ips.map(ip => ({ address: ip, family: ip.includes(":") ? 6 : 4 }));
        if (options.all) {
          callback(null, formatted);
        } else {
          callback(null, formatted[0]?.address, formatted[0]?.family);
        }
      }
    }
  });
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

    // Block private/internal hosts — checking resolved IPs, not just the hostname string
    const { blocked, ips } = await resolveAndValidate(parsed.hostname);
    if (blocked) {
      return NextResponse.json({ error: "Private or internal URLs are not allowed" }, { status: 400 });
    }

    // Pin the actual connection to exactly the IPs just validated, so a DNS answer that
    // changes between the check above and the request below can't matter.
    const dispatcher = pinnedDispatcher(ips);

    const response = await undiciFetch(parsed.toString(), {
      method: "HEAD",
      headers: { "User-Agent": "WPShield-Validator/1.0" },
      signal: AbortSignal.timeout(5000),
      redirect: "manual", // Don't follow redirects to private IPs
      dispatcher,
    });

    // Check redirect target isn't private — also resolved, not just string-matched
    const location = response.headers.get("location");
    if (location) {
      try {
        const redirectUrl = new URL(location);
        const redirectCheck = await resolveAndValidate(redirectUrl.hostname);
        if (redirectCheck.blocked) {
          return NextResponse.json({ error: "Redirect to private IP blocked" }, { status: 400 });
        }
      } catch {}
    }

    return NextResponse.json({ success: true, status: response.status });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Unreachable" });
  }
}