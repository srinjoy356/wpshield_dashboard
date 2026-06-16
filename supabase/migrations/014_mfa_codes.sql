-- mfa_codes — also missing from the migration chain entirely (only existed in
-- wpshield_full_schema.sql). Adds the `attempts` column the verify-2fa hardening fix
-- needs for lockout after repeated failed guesses, and a PRIMARY KEY so upserts target
-- the right row reliably (the table previously had no primary key at all).

CREATE TABLE IF NOT EXISTS public.mfa_codes (
  user_id    uuid        NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code       text        NOT NULL, -- HMAC-SHA256(MFA_OTP_PEPPER, otp) — never stored in plaintext
  attempts   integer     NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL
);
COMMENT ON TABLE public.mfa_codes IS 'One row per user — code is hashed, not the raw 6-digit OTP';

-- If the table already existed from a previous manual run of wpshield_full_schema.sql,
-- make sure the new column exists too.
ALTER TABLE public.mfa_codes ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;