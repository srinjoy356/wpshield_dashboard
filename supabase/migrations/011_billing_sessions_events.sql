-- Commercial schema, part 2: checkout sessions + webhook events
-- Includes provider_txn_id, used by the paynimo-return idempotency fix to block
-- replayed/duplicate provider callbacks from re-running provisioning.

CREATE TABLE IF NOT EXISTS public.pending_checkouts (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id),
  plan_id             text        NOT NULL REFERENCES public.plans(id),
  txn_ref             text        NOT NULL UNIQUE,
  provider_txn_id     text,
  expected_amount_inr integer     NOT NULL,
  status              text        NOT NULL DEFAULT 'pending',
  expires_at          timestamptz NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.pending_checkouts IS 'In-flight Paynimo checkout sessions. status: pending -> processing -> completed (or amount_mismatch/expired)';

-- pending_checkouts already exists on your live database (without this column) —
-- CREATE TABLE IF NOT EXISTS above is a no-op in that case. Without this line, the
-- CREATE UNIQUE INDEX right below would fail outright with "column provider_txn_id
-- does not exist."
ALTER TABLE public.pending_checkouts ADD COLUMN IF NOT EXISTS provider_txn_id text;

CREATE UNIQUE INDEX IF NOT EXISTS pending_checkouts_provider_txn_id_key
  ON public.pending_checkouts (provider_txn_id)
  WHERE provider_txn_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_user_id ON public.pending_checkouts (user_id);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider           text        NOT NULL,
  provider_event_id  text        NOT NULL,
  payload            jsonb       NOT NULL,
  status             text        NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.webhook_events IS 'Raw provider webhook log, reserved for reconciliation';

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_provider_event_key
  ON public.webhook_events (provider, provider_event_id);