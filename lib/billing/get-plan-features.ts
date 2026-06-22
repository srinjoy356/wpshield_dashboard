/**
 * get-plan-features.ts
 *
 * Server-side helper. Given a Supabase client scoped to an authenticated user,
 * resolves what plan they are on and returns their feature entitlements.
 *
 * Called from every server page that needs to gate features.
 * Returns a null-safe object — callers never need to handle undefined.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface PlanFeatures {
  // Which plan
  planId:          string | null;
  planName:        string | null;
  planFamily:      string | null;
  billingInterval: string | null;
  maxSites:        number;
  isActive:        boolean;       // subscription active + not expired

  // Feature gates — mirrors the feature_ columns added in plans setup SQL
  cloudDashboard:     boolean;
  emailAlerts:        boolean;
  slackAlerts:        boolean;
  fileIntegrityFull:  boolean;   // false = limited (last 7 days only, no download)
  activityLogsFull:   boolean;   // false = limited (last 7 days only)
  ipBlocking:         boolean;
  geoBlocking:        boolean;
  awayMode:           boolean;
  maintenanceMode:    boolean;
  pdfReports:         boolean;
  whitelabelReports:  boolean;
  multisiteDashboard: boolean;   // false = single site only
}

const FREE_FEATURES: PlanFeatures = {
  planId:              'core',
  planName:            'Core',
  planFamily:          'core',
  billingInterval:     'free',
  maxSites:            1,
  isActive:            true,      // core is always "active" — no subscription needed
  cloudDashboard:      false,
  emailAlerts:         false,
  slackAlerts:         false,
  fileIntegrityFull:   false,
  activityLogsFull:    false,
  ipBlocking:          false,
  geoBlocking:         false,
  awayMode:            false,
  maintenanceMode:     true,      // core gets maintenance mode per feature table
  pdfReports:          false,
  whitelabelReports:   false,
  multisiteDashboard:  false,
};

export const NO_PLAN = FREE_FEATURES;

/**
 * Load the current user's plan features.
 * Always returns a valid PlanFeatures object — falls back to Core (free) if
 * there is no active subscription.
 */
export async function getPlanFeatures(
  supabase: SupabaseClient,
  userId: string,
): Promise<PlanFeatures> {
  // 1. Find customer record
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (!customer) return FREE_FEATURES;

  // 2. Find active subscription with plan details
  const { data: sub } = await supabase
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

  if (!sub) return FREE_FEATURES;

  const isActive = sub.status === 'active' &&
    !!sub.current_period_end &&
    new Date(sub.current_period_end) > new Date();

  if (!isActive) return FREE_FEATURES;

  const plan: any = Array.isArray(sub.plan) ? sub.plan[0] : sub.plan;
  if (!plan) return FREE_FEATURES;

  return {
    planId:              plan.id,
    planName:            plan.name,
    planFamily:          plan.plan_family,
    billingInterval:     plan.billing_interval,
    maxSites:            plan.max_sites ?? 1,
    isActive:            true,
    cloudDashboard:      plan.feature_cloud_dashboard      ?? false,
    emailAlerts:         plan.feature_email_alerts         ?? false,
    slackAlerts:         plan.feature_slack_alerts         ?? false,
    fileIntegrityFull:   plan.feature_file_integrity_full  ?? false,
    activityLogsFull:    plan.feature_activity_logs_full   ?? false,
    ipBlocking:          plan.feature_ip_blocking          ?? false,
    geoBlocking:         plan.feature_geo_blocking         ?? false,
    awayMode:            plan.feature_away_mode            ?? false,
    maintenanceMode:     plan.feature_maintenance_mode     ?? true,
    pdfReports:          plan.feature_pdf_reports          ?? false,
    whitelabelReports:   plan.feature_whitelabel_reports   ?? false,
    multisiteDashboard:  plan.feature_multisite_dashboard  ?? false,
  };
}