/**
 * get-plan-features.ts — v3 with diagnostic logging
 *
 * Uses the ADMIN client deliberately so RLS never silently filters rows.
 * Server-only. Never import in client components.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface PlanFeatures {
  planId:             string | null;
  planName:           string | null;
  planFamily:         string | null;
  billingInterval:    string | null;
  maxSites:           number;
  isActive:           boolean;
  cloudDashboard:     boolean;
  emailAlerts:        boolean;
  slackAlerts:        boolean;
  fileIntegrityFull:  boolean;
  activityLogsFull:   boolean;
  ipBlocking:         boolean;
  geoBlocking:        boolean;
  awayMode:           boolean;
  maintenanceMode:    boolean;
  pdfReports:         boolean;
  whitelabelReports:  boolean;
  multisiteDashboard: boolean;
}

export const FREE_FEATURES: PlanFeatures = {
  planId:             'core',
  planName:           'Core',
  planFamily:         'core',
  billingInterval:    'free',
  maxSites:           1,
  isActive:           true,
  cloudDashboard:     false,
  emailAlerts:        false,
  slackAlerts:        false,
  fileIntegrityFull:  false,
  activityLogsFull:   false,
  ipBlocking:         false,
  geoBlocking:        false,
  awayMode:           false,
  maintenanceMode:    true,
  pdfReports:         false,
  whitelabelReports:  false,
  multisiteDashboard: false,
};

export const NO_PLAN = FREE_FEATURES;

export async function getPlanFeatures(
  _unusedUserScopedClient: unknown,
  userId: string,
): Promise<PlanFeatures> {
  console.log('[getPlanFeatures] called for userId:', userId);

  const supabase = createAdminClient();

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();

  console.log('[getPlanFeatures] customer:', customer?.id ?? null, 'err:', custErr?.message ?? null);
  if (!customer) return FREE_FEATURES;

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select(`
      id, status, current_period_end, plan_id,
      plan:plans(
        id, name, plan_family, billing_interval, max_sites,
        feature_cloud_dashboard,
        feature_email_alerts,
        feature_slack_alerts,
        feature_file_integrity_full,
        feature_activity_logs_full,
        feature_ip_blocking,
        feature_geo_blocking,
        feature_away_mode,
        feature_maintenance_mode,
        feature_pdf_reports,
        feature_whitelabel_reports,
        feature_multisite_dashboard
      )
    `)
    .eq('customer_id', customer.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log('[getPlanFeatures] sub:', sub?.id ?? null, 'plan_id:', sub?.plan_id ?? null, 'err:', subErr?.message ?? null);
  if (!sub) return FREE_FEATURES;

  const isActive =
    sub.status === 'active' &&
    !!sub.current_period_end &&
    new Date(sub.current_period_end) > new Date();

  console.log('[getPlanFeatures] isActive:', isActive, 'expires:', sub.current_period_end);
  if (!isActive) return FREE_FEATURES;

  const plan: any = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
  console.log('[getPlanFeatures] plan:', plan?.id ?? null, 'ip_blocking:', plan?.feature_ip_blocking ?? null);
  if (!plan) return FREE_FEATURES;

  const result = {
    planId:             plan.id,
    planName:           plan.name,
    planFamily:         plan.plan_family,
    billingInterval:    plan.billing_interval,
    maxSites:           plan.max_sites ?? 1,
    isActive:           true,
    cloudDashboard:     plan.feature_cloud_dashboard      ?? false,
    emailAlerts:        plan.feature_email_alerts         ?? false,
    slackAlerts:        plan.feature_slack_alerts         ?? false,
    fileIntegrityFull:  plan.feature_file_integrity_full  ?? false,
    activityLogsFull:   plan.feature_activity_logs_full   ?? false,
    ipBlocking:         plan.feature_ip_blocking          ?? false,
    geoBlocking:        plan.feature_geo_blocking         ?? false,
    awayMode:           plan.feature_away_mode            ?? false,
    maintenanceMode:    plan.feature_maintenance_mode     ?? true,
    pdfReports:         plan.feature_pdf_reports          ?? false,
    whitelabelReports:  plan.feature_whitelabel_reports   ?? false,
    multisiteDashboard: plan.feature_multisite_dashboard  ?? false,
  };

  console.log('[getPlanFeatures] returning ipBlocking:', result.ipBlocking, 'awayMode:', result.awayMode);
  return result;
}