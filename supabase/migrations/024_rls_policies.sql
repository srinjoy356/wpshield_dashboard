-- Fixes a real "permission denied" bug from migration 023: creating a table
-- with RLS enabled is NOT the same as granting access to it. RLS policies
-- control which ROWS a role can see/touch; the base GRANT controls whether
-- the role can touch the table AT ALL, and is checked first — a role with
-- zero GRANT gets "permission denied for table X" before RLS even gets a
-- chance to evaluate. service_role bypasses RLS row-filtering in Supabase,
-- but it still needs an explicit GRANT like every other role; that step was
-- missing for the two new tables migration 023 created, and for the new
-- sequence backing sequential invoice numbers. Every other sensitive table
-- in this schema already has this exact grant from migration 016 — this
-- migration just extends the same pattern to the objects 023 added.

GRANT ALL ON public.license_reveal_otps TO service_role;
GRANT ALL ON public.license_access_log  TO service_role;

-- next_invoice_number() is a plain (non-SECURITY DEFINER) SQL function, so it
-- runs with the calling role's own privileges — meaning the caller needs
-- direct USAGE on the sequence itself, not just EXECUTE on the function.
GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO service_role;