-- ====================================================================
-- WPShield — Add site_url to companies
-- ====================================================================
-- This adds the missing site_url column to the companies table
-- so we can track the WordPress URL for onboarded clients.

ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS site_url text;

-- Re-verify permissions
GRANT SELECT ON public.companies TO authenticated;
