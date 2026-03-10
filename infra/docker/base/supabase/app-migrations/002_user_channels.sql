-- 002_user_channels.sql
-- Notification delivery channels per user (email, telegram, discord, sms, push)

CREATE TABLE IF NOT EXISTS public.user_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'telegram', 'discord', 'sms', 'push')),
  channel_config JSONB NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, channel_type)
);

CREATE INDEX idx_user_channels_user_id ON public.user_channels(user_id);

-- RLS
ALTER TABLE public.user_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own channels"
  ON public.user_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own channels"
  ON public.user_channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own channels"
  ON public.user_channels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own channels"
  ON public.user_channels FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to user_channels"
  ON public.user_channels FOR ALL
  USING (auth.role() = 'service_role');
