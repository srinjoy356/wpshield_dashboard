-- 1. Identify and delete duplicate sites (keeping the most recently active one)
WITH RankedSites AS (
    SELECT 
        id,
        company_id,
        url,
        ROW_NUMBER() OVER (
            PARTITION BY company_id, url 
            ORDER BY COALESCE(last_seen_at, created_at) DESC, created_at DESC
        ) as rank
    FROM public.sites
)
DELETE FROM public.sites
WHERE id IN (
    SELECT id 
    FROM RankedSites 
    WHERE rank > 1
);

-- Note: The above DELETE will automatically cascade and delete orphaned site_tokens 
-- as long as your site_tokens table has ON DELETE CASCADE (which it does).

-- 2. Apply a UNIQUE constraint to ensure duplicates can NEVER happen again
ALTER TABLE public.sites 
DROP CONSTRAINT IF EXISTS unique_company_url;

ALTER TABLE public.sites 
ADD CONSTRAINT unique_company_url UNIQUE (company_id, url);
