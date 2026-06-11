-- ═══════════════════════════════════════════════════════════════════
-- Cybernara WPShield — Client Invitations Migration
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id text NOT NULL REFERENCES public.companies(company_id) ON DELETE CASCADE,
  email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  used_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_invitations IS 'One-time tokens for client password setup';

-- Enable RLS
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

-- Service role only policy
DROP POLICY IF EXISTS "Service role only" ON public.client_invitations;
CREATE POLICY "Service role only"
  ON public.client_invitations
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_client_invitations_token ON public.client_invitations (token);
CREATE INDEX IF NOT EXISTS idx_client_invitations_company ON public.client_invitations (company_id);
