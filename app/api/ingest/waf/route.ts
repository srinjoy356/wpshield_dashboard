import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { evaluateShadowPayload } from '@/lib/security/waf-engine';

/**
 * POST /api/ingest/waf
 *
 * Receives pre-filtered attack events from the WordPress plugin.
 * PHP pattern matching already confirmed these are suspicious —
 * Coraza applies richer SecRules and auto-bans confirmed attackers.
 *
 * Nothing is written to Supabase unless Coraza fires a rule match.
 */
export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const payload = await request.json();
    const data    = payload.data || {};

    const ip        = data.ip             || '127.0.0.1';
    const method    = data.request_method || 'GET';
    const uri       = data.request_uri    || '/';
    const userAgent = data.user_agent     || '';
    const bodyB64   = data.request_body   || '';
    const body      = bodyB64 ? Buffer.from(bodyB64, 'base64').toString('utf8') : '';

    evaluateShadowPayload(
      auth.site.company_id,
      ip,
      method,
      uri,
      userAgent,
      body
    ).catch((err: Error) => {
      console.error('[WAF Ingest] Coraza evaluation error:', err);
    });

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[WAF Ingest] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}