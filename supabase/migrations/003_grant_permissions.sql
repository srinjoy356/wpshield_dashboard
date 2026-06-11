-- ====================================================================
-- WPShield — COMPREHENSIVE Grant Permissions & RLS Fix
-- ====================================================================
-- This script ensures the 'authenticated' role has full access to all 
-- monitoring tables, and adds RLS policies if RLS is enabled.

-- 1. Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- 2. Grant SELECT on ALL monitoring tables
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.companies TO authenticated;
GRANT SELECT ON public.pending_companies TO authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT SELECT ON public.alerts TO authenticated;
GRANT SELECT ON public.wpshield_events_attack TO authenticated;
GRANT SELECT ON public.wpshield_events_login TO authenticated;
GRANT SELECT ON public.wpshield_events_file TO authenticated;
GRANT SELECT ON public.wpshield_inventory_snapshots TO authenticated;

-- 3. Also grant to service_role
GRANT SELECT ON ALL TABLES IN SCHEMA public TO service_role;

-- 4. RLS POLICIES (Safety net)
-- Even if RLS is enabled, these policies will allow Admins to see EVERYTHING.

-- Function to check if current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply "Admin can see all" policies to all tables
-- This handles the case where RLS was accidentally left ON.

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Admins can see everything" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Admins can see everything" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
    END LOOP;
END $$;
