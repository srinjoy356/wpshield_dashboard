-- Commercial schema, part 3: subscriptions + invoices
-- invoices.provider_invoice_id is unique so the upsert in paynimo-return can't create
-- duplicate invoice rows if a webhook/return POST is retried after a partial failure.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id              uuid        REFERENCES public.customers(id),
  plan_id                  text        REFERENCES public.plans(id),
  provider_subscription_id text        NOT NULL,
  status                   text        NOT NULL,
  current_period_end       timestamptz,
  created_at               timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.subscriptions IS 'One row per active/expired subscription period';

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON public.subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id     ON public.subscriptions (plan_id);

CREATE TABLE IF NOT EXISTS public.invoices (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id         uuid        REFERENCES public.customers(id),
  provider_invoice_id text        NOT NULL,
  amount              integer     NOT NULL,
  status              text        NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.invoices IS 'amount is in minor units (paise)';

CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_invoice_id_key
  ON public.invoices (provider_invoice_id);