import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { verifyCompanyAccess } from '@/lib/auth/verify-company-access';

export async function verifySiteToken(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const supabase = createAdminClient();
  const { data: siteToken } = await supabase
    .from('site_tokens')
    .select('id, site_id, revoked, last_used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!siteToken || siteToken.revoked) {
    return { error: 'Invalid or revoked token', status: 401 };
  }

  const { data: site } = await supabase
    .from('sites')
    .select('company_id, license_id')
    .eq('id', siteToken.site_id)
    .single();

  if (!site) {
    return { error: 'Site not found', status: 404 };
  }

  // Throttled write: only touch last_used_at once per hour per token, rather than on
  // every single ingest call (this route gets hit far too often for a write every
  // time to be worth the extra DB load). Fire-and-forget — a missed update here
  // should never block or slow down the actual request being authenticated.
  const lastUsed = siteToken.last_used_at ? new Date(siteToken.last_used_at).getTime() : 0;
  if (Date.now() - lastUsed > 60 * 60 * 1000) {
    supabase.from('site_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', siteToken.id)
      .then(() => {}, (err) => console.error('[verifySiteToken] last_used_at update failed:', err));
  }

  return { site, site_id: siteToken.site_id };
}

export async function requireUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { 
      allowed: false as const, 
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }
  
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { 
      allowed: false as const, 
      response: NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    };
  }

  return { allowed: true as const, user, profile };
}

export async function requireAdmin(supabase: SupabaseClient) {
  const userCheck = await requireUser(supabase);
  if (!userCheck.allowed) return userCheck;

  // middleware.ts already treats 'admin' and 'super_admin' as equivalent for page
  // routing — this had fallen out of sync, only accepting 'admin', so a super_admin
  // could see the admin UI shell but get 403'd on the API routes behind it.
  if (userCheck.profile.role !== 'admin' && userCheck.profile.role !== 'super_admin') {
    return { 
      allowed: false as const, 
      response: NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    };
  }

  return { allowed: true as const, user: userCheck.user, profile: userCheck.profile };
}

/** Stricter variant for actions that should be super_admin-only (e.g. managing other admins). */
export async function requireSuperAdmin(supabase: SupabaseClient) {
  const userCheck = await requireUser(supabase);
  if (!userCheck.allowed) return userCheck;

  if (userCheck.profile.role !== 'super_admin') {
    return {
      allowed: false as const,
      response: NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 })
    };
  }

  return { allowed: true as const, user: userCheck.user, profile: userCheck.profile };
}

export async function requireCustomerAccess(supabase: SupabaseClient, companyId: string) {
  const userCheck = await requireUser(supabase);
  if (!userCheck.allowed || !userCheck.user) return userCheck;

  const { allowed, response } = await verifyCompanyAccess(supabase, userCheck.user.id, companyId);
  if (!allowed) {
    return { 
      allowed: false as const, 
      response: response || NextResponse.json({ error: 'Forbidden: Tenant boundary breach' }, { status: 403 }) 
    };
  }

  return { allowed: true as const, user: userCheck.user, profile: userCheck.profile };
}

export function validateJson<T>(data: any, schema: z.ZodSchema<T>): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { 
      success: false, 
      response: NextResponse.json({ 
        error: 'Validation Error', 
        details: result.error.issues 
      }, { status: 400 }) 
    };
  }
  return { success: true, data: result.data };
}

export async function withAuditLog(action: string, actorId: string, meta: any = {}) {
  try {
    const adminClient = createAdminClient();
    // Use the existing activity table if audit_logs isn't formally separated yet
    await adminClient.from('wpshield_events_activity').insert({
      event_type: 'audit',
      ip: 'internal',
      severity: 'low',
      company_id: meta.company_id || null,
      data: {
        action,
        actor_id: actorId,
        ...meta
      },
      occurred_at: new Date().toISOString()
    });
    console.log(`[AUDIT] ${action} by ${actorId}`);
  } catch (err) {
    console.error(`[AUDIT LOG FAILED] ${action} by ${actorId}:`, err);
  }
}

// -------------------------------------------------------------------------
// WAF GUARD: Next.js API Protection
// -------------------------------------------------------------------------
import { getWafEngine } from '@/lib/security/waf-engine';

export async function runWafGuard(request: Request) {
  try {
    const url = new URL(request.url);
    const method = request.method;
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const waf = await getWafEngine();
    const transaction = waf.newTransaction();

    transaction.processConnection(ip, 12345, "127.0.0.1", 443);
    transaction.processRequestURL(url.pathname + url.search, method, "HTTP/1.1");
    
    request.headers.forEach((value, key) => {
      transaction.addRequestHeader(key, value);
    });
    transaction.processRequestHeaders();

    if (transaction.isInterrupted()) {
      transaction.free();
      return { allowed: false, response: NextResponse.json({ error: "WAF: Request blocked by security rules." }, { status: 403 }) };
    }

    // We skip body evaluation for standard Dashboard API routes to avoid false positives 
    // on large JSON payloads unless explicitly required, ensuring high performance.
    
    transaction.free();
    return { allowed: true };
  } catch (err) {
    console.error("[WAF GUARD ERROR]", err);
    return { allowed: true }; // Fail-open to prevent locking admins out if WAF crashes
  }
}