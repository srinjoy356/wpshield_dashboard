-- ====================================================================
-- WPShield — Fix Relationship Mappings for PostgREST
-- ====================================================================
-- PostgREST requires formal Foreign Keys to allow joining tables 
-- in .select() queries. This fixes the PGRST200 error on Activity Logs.

-- 1. Link activity_logs.actor_id to user_profiles.id
-- (Currently it only links to auth.users, which PostgREST can't use for public joins)
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_actor_id_fkey_profiles,
  ADD CONSTRAINT activity_logs_actor_id_fkey_profiles
  FOREIGN KEY (actor_id) REFERENCES public.user_profiles(id);

-- 2. Link activity_logs.target_company_id to companies.company_id
-- We need a UNIQUE constraint on companies.company_id first (if not already there)
-- but foundation.sql already has UNIQUE on company_id.
ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_target_company_id_fkey,
  ADD CONSTRAINT activity_logs_target_company_id_fkey
  FOREIGN KEY (target_company_id) REFERENCES public.companies(company_id);

-- 3. Link user_profiles.id to auth.users(id) is already there.

-- 4. Re-verify alerts permissions while we are here
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.companies TO authenticated;
