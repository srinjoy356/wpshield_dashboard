-- Grant permissions to authenticated and service_role for user_profiles
-- This fixes the 'permission denied' 42501 error even when RLS is disabled.

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles TO service_role;
GRANT SELECT ON public.user_profiles TO anon;

-- Also ensure companies table has permissions if needed
GRANT SELECT ON public.companies TO authenticated;
GRANT SELECT ON public.companies TO service_role;
GRANT SELECT ON public.companies TO anon;
