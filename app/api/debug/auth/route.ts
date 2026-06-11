import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();

  const [sessionRes, userRes] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
  ]);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const maskedUrl = supabaseUrl.substring(0, 30);

  return NextResponse.json({
    session: sessionRes.data.session,
    sessionError: sessionRes.error ? sessionRes.error.message : null,
    user: userRes.data.user,
    userError: userRes.error ? userRes.error.message : null,
    supabaseUrl: maskedUrl,
    timestamp: new Date().toISOString(),
  });
}
