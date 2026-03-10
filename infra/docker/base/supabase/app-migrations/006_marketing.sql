-- 006_marketing.sql
-- Marketing automation rules and post log
-- Admin-only tables, no user-facing RLS

CREATE TABLE IF NOT EXISTS public.marketing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL DEFAULT 'czech',
  filters JSONB NOT NULL DEFAULT '{}',
  targets JSONB NOT NULL DEFAULT '[]',
  template TEXT,
  max_posts_per_day INT NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marketing_rules_active ON public.marketing_rules(country, active) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS public.marketing_post_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.marketing_rules(id) ON DELETE SET NULL,
  property_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_marketing_post_log_rule_id ON public.marketing_post_log(rule_id);
CREATE INDEX idx_marketing_post_log_property ON public.marketing_post_log(property_id);

-- RLS — admin-only tables, no end-user access; only service_role backend
ALTER TABLE public.marketing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_post_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to marketing_rules"
  ON public.marketing_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role has full access to marketing_post_log"
  ON public.marketing_post_log FOR ALL
  USING (auth.role() = 'service_role');
