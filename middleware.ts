import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: "",
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const url = new URL(request.url);
  const path = url.pathname;

  // 1. Handle Public/Asset paths early — /home is the public landing page
  const publicPaths = ["/login", "/home"];
  const isPublic = publicPaths.some(p => path === p || path.startsWith(p + "/"));

  if (!path || isPublic) {
    if (user && path === "/login") {
      if (url.searchParams.has('error')) return response;
      const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
      if (profile?.role === "admin" || profile?.role === "super_admin") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.redirect(new URL("/app", request.url));
    }
    return response;
  }

  // 2. Redirect root / to landing page
  if (path === "/") {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // 3. Protected Routes
  if (path.startsWith("/admin") || path.startsWith("/app")) {
    if (!user) return NextResponse.redirect(new URL("/login", request.url));

    // 2FA Check — verify HMAC-signed cookie (not plaintext "true")
    const has2fa = request.cookies.get("wpshield_2fa_verified");
    const is2FAValid = (() => {
      if (!has2fa?.value) return false;
      try {
        const secret = process.env.MFA_COOKIE_SECRET || process.env.CRON_SECRET;
        if (!secret) return false;
        const decoded = Buffer.from(has2fa.value, 'base64').toString();
        const parts   = decoded.split(':');
        if (parts.length !== 3) return false;
        const [userId, timestamp, sig] = parts;
        if (Date.now() - parseInt(timestamp) > 8 * 60 * 60 * 1000) return false;
        const crypto   = require('crypto');
        const expected = crypto.createHmac('sha256', secret).update(`${userId}:${timestamp}`).digest('hex');
        return expected === sig;
      } catch { return false; }
    })();
    if (!is2FAValid) {
      return NextResponse.redirect(new URL("/2fa-verify", request.url));
    }

    // Consolidate profile and company lookup for /app
    if (path.startsWith("/app")) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, company_id, companies(status)")
        .eq("id", user.id)
        .single();
        
      if (!profile || profile.role !== "client") {
        return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
      }

      // @ts-ignore - Supabase nested join
      if (profile.companies?.status === "suspended") {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL("/login?error=suspended", request.url));
      }
    } else {
      // Admin route
      const { data: profile } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin" && profile?.role !== "super_admin") {
        return NextResponse.redirect(new URL("/login?error=unauthorized", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     * - logos (brand logos)
     */
    "/((?!_next/static|_next/image|favicon.ico|api|logos).*)",
  ],
};