import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // Block private/internal hosts
    if (isPrivateHost(parsed.hostname)) {
      return NextResponse.json({ error: "Private or internal URLs are not allowed" }, { status: 400 });
    }

    const response = await fetch(parsed.toString(), {
      method: "HEAD",
      headers: { "User-Agent": "WPShield-Validator/1.0" },
      signal: AbortSignal.timeout(5000),
      redirect: "manual", // Don't follow redirects to private IPs
    });

    // Check redirect target isn't private
    const location = response.headers.get("location");
    if (location) {
      try {
        const redirectUrl = new URL(location);
        if (isPrivateHost(redirectUrl.hostname)) {
          return NextResponse.json({ error: "Redirect to private IP blocked" }, { status: 400 });
        }
      } catch {}
    }

    return NextResponse.json({ success: true, status: response.status });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || "Unreachable" });
  }
}