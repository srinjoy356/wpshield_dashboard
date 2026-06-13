import { NextResponse } from 'next/server';
import { verifySiteToken, validateJson } from '@/lib/security/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { evaluateShadowPayload } from '@/lib/security/waf-engine';
import { z } from 'zod';

const EventPayloadSchema = z.object({
  event_type: z.string().optional(),
  type: z.string().optional(),
  site_url: z.string().optional(),
  severity: z.string().optional(),
  pattern_type: z.string().optional(),
  ip: z.string().optional(),
  occurred_at: z.string().optional(),
  data: z.record(z.string(), z.any()).optional()
}).passthrough();

export async function POST(request: Request) {
  try {
    const auth = await verifySiteToken(request);
    if (auth.error || !auth.site) {
      return NextResponse.json({ error: auth.error ?? 'Unauthorized' }, { status: auth.status ?? 401 });
    }

    const rawPayload = await request.json();

    const validation = validateJson(rawPayload, EventPayloadSchema);
    if (!validation.success) {
      return validation.response;
    }

    const payload   = validation.data;
    const supabase  = createAdminClient();
    const eventType = payload.event_type || payload.type;

    if (eventType === 'attack') {
      const { error } = await supabase.from('wpshield_events_attack').insert({
        company_id:   auth.site.company_id,
        site_url:     payload.site_url || 'unknown',
        severity:     payload.severity || 'low',
        pattern_type: payload.data?.pattern_type || payload.pattern_type || 'unknown',
        ip:           payload.data?.ip || payload.ip,
        occurred_at:  payload.occurred_at || new Date().toISOString()
      });
      if (error) throw new Error(`Attack insert error: ${error.message}`);

      // Pass to Coraza for deep inspection + auto-ban if rule fires.
      // PHP already confirmed this is a suspicious request — Coraza
      // applies richer rules and decides whether to ban the IP.
      if (payload.data?.request_body || payload.data?.request_uri) {
        evaluateShadowPayload(
          auth.site.company_id,
          payload.data?.ip || payload.ip || '127.0.0.1',
          payload.data?.request_method || 'POST',
          payload.data?.request_uri    || '/',
          payload.data?.user_agent     || 'unknown',
          payload.data?.request_body
            ? Buffer.from(payload.data.request_body, 'base64').toString('utf8')
            : ''
        ).catch(console.error);
      }

    } else if (eventType === 'file') {
      const { error } = await supabase.from('wpshield_events_file').insert({
        company_id:  auth.site.company_id,
        site_url:    payload.site_url || 'unknown',
        severity:    payload.severity || 'low',
        path:        payload.data?.path  || 'unknown',
        event:       payload.data?.event || 'unknown',
        occurred_at: payload.occurred_at || new Date().toISOString()
      });
      if (error) throw new Error(`File insert error: ${error.message}`);

    } else if (eventType === 'activity' || eventType === 'login') {
      const { error } = await supabase.from('wpshield_events_activity').insert({
        company_id:  auth.site.company_id,
        site_url:    payload.site_url || 'unknown',
        severity:    payload.severity || 'low',
        action_type: payload.data?.action_type || payload.data?.event || payload.action_type || 'unknown',
        user_id:     payload.data?.user_id  || payload.user_id  || null,
        user_login:  payload.data?.user_login || payload.data?.login || payload.user_login || 'unknown',
        ip:          payload.data?.ip || payload.ip,
        details:     payload.data || {},
        occurred_at: payload.occurred_at || new Date().toISOString()
      });
      if (error) throw new Error(`Activity insert error: ${error.message}`);

    } else if (eventType === 'inventory' || eventType === 'health') {
      const { error } = await supabase.from('wpshield_inventory_snapshots').insert({
        company_id:  auth.site.company_id,
        site_url:    payload.site_url || 'unknown',
        severity:    payload.severity || 'info',
        kind:        payload.data?.kind || 'plugins',
        payload:     payload.data || {},
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