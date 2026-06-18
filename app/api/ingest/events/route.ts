import { NextResponse } from 'next/server';
import { verifySiteToken } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateShadowPayload } from '@/lib/security/waf-engine';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { z } from 'zod';

// RG-15: previously this was a single loose `passthrough()` schema shared across every
// event type, with no real shape validation on `data`. The schemas below are built
// directly from what the plugin's collectors actually send (class-wpshield-collector-
// attack/files/activity/login/health.php) rather than guessed — each `data` schema is
// still `.passthrough()`'d rather than fully closed, so a future plugin update that adds
// one more field doesn't start getting silently rejected; what's tightened is field
// *types* and *lengths*, which is what actually matters for input validation.

const MAX_PAYLOAD_BYTES = 512 * 1024; // generous enough for a large plugin/theme inventory snapshot

const AttackDataSchema = z.object({
  pattern_type:    z.string().max(100).optional(),
  ip:               z.string().max(64).optional(),
  request_method:  z.string().max(16).optional(),
  request_uri:     z.string().max(600).optional(),
  uri:              z.string().max(600).optional(), // detect_404_probes() uses this key instead of request_uri
  user_agent:      z.string().max(400).optional(),
  request_body:    z.string().max(16384).optional(), // base64 of up to 8KB raw body
}).passthrough();

const FileDataSchema = z.object({
  event:     z.string().max(50).optional(),
  path:      z.string().max(1024).optional(),
  size:      z.number().optional(),
  hash:      z.string().max(128).optional(),
  old_hash:  z.string().max(128).optional(),
  new_hash:  z.string().max(128).optional(),
}).passthrough();

const ActivityDataSchema = z.object({
  action_type: z.string().max(100).optional(),
  event:        z.string().max(100).optional(), // login collector's action key, reused under event_type 'login'
  user_id:      z.union([z.number(), z.string()]).optional(),
  user_login:   z.string().max(200).optional(),
  login:        z.string().max(200).optional(), // login collector uses this key instead of user_login
  ip:           z.string().max(64).optional(),
  action:       z.string().max(500).optional(),
  plugin:       z.string().max(255).optional(),
  theme:        z.string().max(255).optional(),
  roles:        z.array(z.string().max(50)).max(20).optional(),
  new_role:     z.string().max(50).optional(),
  old_roles:    z.array(z.string().max(50)).max(20).optional(),
  option:       z.string().max(255).optional(),
}).passthrough();

const HealthDataSchema = z.object({
  kind:          z.string().max(50).optional(),
  wp_version:    z.string().max(50).optional(),
  php_version:   z.string().max(50).optional(),
  is_multisite:  z.union([z.number(), z.boolean()]).optional(),
  site_url:      z.string().max(2048).optional(),
  admin_email:   z.string().max(320).optional(),
  count:         z.number().optional(),
  plugins:       z.array(z.record(z.string(), z.any())).max(5000).optional(),
  themes:        z.array(z.record(z.string(), z.any())).max(5000).optional(),
}).passthrough();

const EventPayloadSchema = z.object({
  event_type:   z.string().max(50).optional(),
  type:         z.string().max(50).optional(),
  company_id:   z.string().max(200).optional(), // present in the plugin's payload, but ignored — auth.site.company_id (from the verified token) is what's actually trusted, never a client-supplied value
  site_url:     z.string().max(2048).optional(),
  severity:     z.string().max(20).optional(),
  pattern_type: z.string().max(100).optional(),
  ip:           z.string().max(64).optional(),
  occurred_at:  z.string().max(64).optional(), // plugin sends MySQL "Y-m-d H:i:s" format, not ISO 8601 — don't add .datetime() validation here
  data:         z.record(z.string(), z.any()).optional()
});

function validateEventData(eventType: string, data: unknown) {
  const schema =
    eventType === 'attack'                       ? AttackDataSchema :
    eventType === 'file'                         ? FileDataSchema :
    (eventType === 'activity' || eventType === 'login') ? ActivityDataSchema :
    (eventType === 'inventory' || eventType === 'health') ? HealthDataSchema :
    null;

  if (!schema) return { success: false as const, error: `Unknown event_type: ${eventType}` };

  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    return { success: false as const, error: `Invalid data for event_type '${eventType}': ${result.error.issues.map(i => i.message).join(', ')}` };
  }
  return { success: true as const, data: result.data };
}

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const rate = await checkRateLimit('ingest', auth.site_id!);
    if (!rate.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // RG-15: enforce a size ceiling before parsing — without this, nothing stopped an
    // authenticated-but-misbehaving (or compromised) site from sending an arbitrarily
    // large body on every ingest call.
    const rawText = await request.text();
    if (rawText.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const baseValidation = EventPayloadSchema.safeParse(rawPayload);
    if (!baseValidation.success) {
      return NextResponse.json({ error: 'Validation Error', details: baseValidation.error.issues }, { status: 400 });
    }

    const payload   = baseValidation.data;
    const eventType = payload.event_type || payload.type || '';

    const dataValidation = validateEventData(eventType, payload.data);
    if (!dataValidation.success) {
      return NextResponse.json({ error: dataValidation.error }, { status: 400 });
    }
    const data = dataValidation.data as Record<string, any>;

    const supabase  = createAdminClient();

    if (eventType === 'attack') {
      const { error } = await supabase.from('wpshield_events_attack').insert({
        company_id:   auth.site.company_id,
        site_id:      auth.site_id,
        site_url:     payload.site_url || 'unknown',
        severity:     payload.severity || 'low',
        pattern_type: data.pattern_type || payload.pattern_type || 'unknown',
        ip:           data.ip || payload.ip,
        occurred_at:  payload.occurred_at || new Date().toISOString()
      });
      if (error) throw new Error(`Attack insert error: ${error.message}`);

      // Pass to Coraza for deep inspection + auto-ban if rule fires.
      // PHP already confirmed this is a suspicious request — Coraza
      // applies richer rules and decides whether to ban the IP.
      if (data.request_body || data.request_uri || data.uri) {
        evaluateShadowPayload(
          auth.site.company_id,
          auth.site_id ?? null,
          data.ip || payload.ip || '127.0.0.1',
          data.request_method || 'POST',
          data.request_uri || data.uri || '/',
          data.user_agent || 'unknown',
          data.request_body
            ? Buffer.from(data.request_body, 'base64').toString('utf8')
            : ''
        ).catch(console.error);
      }

    } else if (eventType === 'file') {
      const { error } = await supabase.from('wpshield_events_file').insert({
        company_id:  auth.site.company_id,
        site_id:     auth.site_id,
        site_url:    payload.site_url || 'unknown',
        severity:    payload.severity || 'low',
        path:        data.path  || 'unknown',
        event:       data.event || 'unknown',
        occurred_at: payload.occurred_at || new Date().toISOString()
      });
      if (error) throw new Error(`File insert error: ${error.message}`);

    } else if (eventType === 'activity' || eventType === 'login') {
      const { error } = await supabase.from('wpshield_events_activity').insert({
        company_id:  auth.site.company_id,
        site_id:     auth.site_id,
        site_url:    payload.site_url || 'unknown',
        severity:    payload.severity || 'low',
        action_type: data.action_type || data.event || 'unknown',
        user_id:     data.user_id  || null,
        user_login:  data.user_login || data.login || 'unknown',
        ip:          data.ip || payload.ip,
        details:     data || {},
        occurred_at: payload.occurred_at || new Date().toISOString()
      });
      if (error) throw new Error(`Activity insert error: ${error.message}`);

    } else if (eventType === 'inventory' || eventType === 'health') {
      const { error } = await supabase.from('wpshield_inventory_snapshots').insert({
        company_id:  auth.site.company_id,
        site_id:     auth.site_id,
        site_url:    payload.site_url || 'unknown',
        severity:    payload.severity || 'info',
        kind:        data.kind || 'plugins',
        payload:     data || {},
        occurred_at: payload.occurred_at || new Date().toISOString()
      });
      if (error) throw new Error(`Inventory insert error: ${error.message}`);
    } else {
      // Unknown event_type — reject instead of silently succeeding
      return NextResponse.json(
        { error: `Unknown event_type: ${eventType}` },
        { status: 400 }
      );
    }

    // Update last_seen_at on both company and site
    await supabase.from('sites')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('company_id', auth.site.company_id)
      .eq('id', auth.site_id);

    await supabase.from('companies')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('company_id', auth.site.company_id);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[ingest/events]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}