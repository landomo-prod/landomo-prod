-- 005_delivery_log.sql
-- Tracks delivery attempts for each notification across channels
-- Service-level only — not exposed to end users via RLS

CREATE TABLE IF NOT EXISTS public.delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  external_id TEXT,
  error TEXT,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_delivery_log_notification_id ON public.delivery_log(notification_id);
CREATE INDEX idx_delivery_log_pending ON public.delivery_log(status) WHERE status = 'pending';

-- RLS — end users have no access; only service_role backend can read/write
ALTER TABLE public.delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to delivery_log"
  ON public.delivery_log FOR ALL
  USING (auth.role() = 'service_role');
