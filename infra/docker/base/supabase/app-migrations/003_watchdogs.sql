-- 003_watchdogs.sql
-- User-defined watchdogs: saved searches that trigger notifications

CREATE TABLE IF NOT EXISTS public.watchdogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  country TEXT NOT NULL DEFAULT 'czech',
  filters JSONB NOT NULL DEFAULT '{}',
  trigger_events TEXT[] NOT NULL DEFAULT '{new_listing,price_drop}',
  frequency TEXT NOT NULL DEFAULT 'instant' CHECK (frequency IN ('instant', 'hourly', 'daily', 'weekly')),
  channels TEXT[] NOT NULL DEFAULT '{in_app}',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  max_notifications_per_day INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ
);

CREATE INDEX idx_watchdogs_user_id ON public.watchdogs(user_id);
CREATE INDEX idx_watchdogs_active_country ON public.watchdogs(country, active) WHERE active = TRUE;

-- RLS
ALTER TABLE public.watchdogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchdogs"
  ON public.watchdogs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchdogs"
  ON public.watchdogs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchdogs"
  ON public.watchdogs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchdogs"
  ON public.watchdogs FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to watchdogs"
  ON public.watchdogs FOR ALL
  USING (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER trg_watchdogs_updated_at
  BEFORE UPDATE ON public.watchdogs
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_updated_at();
