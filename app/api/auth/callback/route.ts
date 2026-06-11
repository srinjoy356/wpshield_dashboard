import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code       = searchParams.get('code')
  const next       = searchParams.get('next') ?? '/'
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as any

  // Always use the configured site URL — never trust the origin from the
  // incoming request because Supabase may redirect here with localhost as
  // the origin if its stored Site URL hasn't been updated.
  const siteUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');

  if (token_hash && type) {
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`)
    } else {
      console.error("Auth Callback OTP Error:", error);
    }
  } else if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${siteUrl}${next}`)
    } else {
      console.error("Auth Callback Code Error:", error);
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth-callback-failed`)
}