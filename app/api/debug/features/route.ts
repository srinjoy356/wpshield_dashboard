import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/features
 * Temporary debug endpoint — delete after diagnosis.
 * Runs each step of getPlanFeatures separately and returns what each step finds.
 */
export async function GET() {
  const result: Record<string, any> = {};

  try {
    // Step 1: who is logged in?
    const userSupabase = createClient();
    const { data: { user }, error: authErr } = await userSupabase.auth.getUser();
    result.step1_auth = {
      userId:  user?.id ?? null,
      email:   user?.email ?? null,
      error:   authErr?.message ?? null,
    };

    if (!user) {
      return NextResponse.json({ ...result, stopped: 'no user' });
    }

    const admin = createAdminClient();

    // Step 2: find customer by owner_user_id
    const { data: customer, error: custErr } = await admin
      .from('customers')
      .select('id, owner_user_id, email')
      .eq('owner_user_id', user.id)
      .maybeSingle();

    result.step2_customer = {
      found:  !!customer,
      id:     customer?.id ?? null,
      email:  customer?.email ?? null,
      error:  custErr?.message ?? null,
    };

    if (!customer) {
      // Also check if there's ANY customer in the table
      const { data: allCustomers } = await admin
        .from('customers')
        .select('id, owner_user_id, email')
        .limit(5);
      result.step2_all_customers = allCustomers;
      return NextResponse.json({ ...result, stopped: 'no customer for this user' });
    }

    // Step 3: find active subscription
    const { data: sub, error: subErr } = await admin
      .from('subscriptions')
      .select('id, status, current_period_end, plan_id, customer_id')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    result.step3_subscription = {
      found:      !!sub,
      id:         sub?.id ?? null,
      status:     sub?.status ?? null,
      plan_id:    sub?.plan_id ?? null,
      expires:    sub?.current_period_end ?? null,
      expired:    sub ? new Date(sub.current_period_end) < new Date() : null,
      error:      subErr?.message ?? null,
    };

    if (!sub) {
      // Check all subscriptions for this customer regardless of status
      const { data: allSubs } = await admin
        .from('subscriptions')
        .select('id, status, plan_id, current_period_end')
        .eq('customer_id', customer.id);
      result.step3_all_subscriptions = allSubs;
      return NextResponse.json({ ...result, stopped: 'no active subscription' });
    }

    // Step 4: fetch plan with feature flags
    const { data: plan, error: planErr } = await admin
      .from('plans')
      .select(`
        id, name, active, is_active,
        feature_ip_blocking,
        feature_geo_blocking,
        feature_away_mode,
        feature_cloud_dashboard,
        feature_pdf_reports
      `)
      .eq('id', sub.plan_id)
      .maybeSingle();

    result.step4_plan = {
      found:          !!plan,
      id:             plan?.id ?? null,
      name:           plan?.name ?? null,
      active:         plan?.active ?? null,
      is_active:      plan?.is_active ?? null,
      ip_blocking:    plan?.feature_ip_blocking ?? null,
      geo_blocking:   plan?.feature_geo_blocking ?? null,
      away_mode:      plan?.feature_away_mode ?? null,
      cloud:          plan?.feature_cloud_dashboard ?? null,
      pdf:            plan?.feature_pdf_reports ?? null,
      error:          planErr?.message ?? null,
    };

    // Step 5: try the joined query (what getPlanFeatures actually does)
    const { data: subWithPlan, error: joinErr } = await admin
      .from('subscriptions')
      .select(`
        id, status,
        plan:plans(
          id, feature_ip_blocking, feature_away_mode, feature_geo_blocking
        )
      `)
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    const joinedPlan: any = subWithPlan
      ? (Array.isArray(subWithPlan.plan) ? subWithPlan.plan[0] : subWithPlan.plan)
      : null;

    result.step5_joined_query = {
      sub_found:   !!subWithPlan,
      plan_found:  !!joinedPlan,
      plan_id:     joinedPlan?.id ?? null,
      ip_blocking: joinedPlan?.feature_ip_blocking ?? null,
      away_mode:   joinedPlan?.feature_away_mode ?? null,
      join_error:  joinErr?.message ?? null,
    };

    result.conclusion = result.step5_joined_query.ip_blocking === true
      ? 'SHOULD WORK — ip_blocking=true returned from joined query'
      : 'PROBLEM — ip_blocking not true from joined query, check step4 vs step5';

  } catch (err: any) {
    result.exception = err.message;
  }

  return NextResponse.json(result, { status: 200 });
}