-- ============================================================
-- DZEDZE SaaS — Multi-tenancy & Subscriptions v2.0
-- Run once after init.sql on an existing DB
-- ============================================================

-- ─── ORGANIZATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  owner_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
  plan          VARCHAR(20)  NOT NULL DEFAULT 'trial'
                CHECK (plan IN ('trial','essential','business','enterprise')),
  agent_limit   INTEGER      NOT NULL DEFAULT 3,
  site_limit    INTEGER      NOT NULL DEFAULT 1,
  -- -1 = illimité (Entreprise)
  features      TEXT[]       NOT NULL DEFAULT ARRAY[
    'missions','checklist','photo_upload','dashboard',
    'agents','sites','notifications','offline','quality_score','pdf_export'
  ],
  platforms     TEXT[]       NOT NULL DEFAULT ARRAY['android'],
  trial_ends_at TIMESTAMPTZ,
  is_active     BOOLEAN      DEFAULT true,
  logo_url      TEXT,
  custom_domain TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan            VARCHAR(20)  NOT NULL,
  price_fcfa      INTEGER      NOT NULL DEFAULT 0,
  starts_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  status          VARCHAR(20)  NOT NULL DEFAULT 'trial'
                  CHECK (status IN ('trial','active','past_due','cancelled','expired')),
  payment_ref     TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── Add organization_id to existing tables ─────────────────
ALTER TABLE users    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE sites    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
ALTER TABLE media    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

-- ─── Migrate existing demo data ─────────────────────────────
-- Create a default org for the existing admin/demo accounts
DO $$
DECLARE
  v_org_id UUID;
  v_owner_id UUID;
BEGIN
  SELECT id INTO v_owner_id FROM users WHERE email = 'admin@dzedze.app';
  IF v_owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM organizations LIMIT 1) THEN
    INSERT INTO organizations (name, owner_id, plan, agent_limit, site_limit,
      features, platforms, is_active)
    VALUES (
      'Dzedze Demo Agency', v_owner_id, 'enterprise', -1, -1,
      ARRAY['missions','checklist','photo_upload','dashboard','agents','sites',
            'notifications','offline','quality_score','pdf_export',
            'ai_analysis','video_capture','live_stream','audit_logs','ai_report',
            'api_access','customization'],
      ARRAY['android','ios','web','api'],
      true
    )
    RETURNING id INTO v_org_id;

    INSERT INTO subscriptions (organization_id, plan, price_fcfa, status)
    VALUES (v_org_id, 'enterprise', 200000, 'active');

    UPDATE users    SET organization_id = v_org_id;
    UPDATE sites    SET organization_id = v_org_id;
    UPDATE missions SET organization_id = v_org_id;
    UPDATE media    SET organization_id = v_org_id;
  END IF;
END $$;

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_org    ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_sites_org    ON sites(organization_id);
CREATE INDEX IF NOT EXISTS idx_missions_org ON missions(organization_id);
CREATE INDEX IF NOT EXISTS idx_media_org    ON media(organization_id);
CREATE INDEX IF NOT EXISTS idx_subs_org     ON subscriptions(organization_id);

-- ─── Auto updated_at ─────────────────────────────────────────
CREATE TRIGGER trg_orgs_updated
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ─── View: org usage ─────────────────────────────────────────
CREATE OR REPLACE VIEW v_org_usage AS
SELECT
  o.id                                                  AS organization_id,
  o.name,
  o.plan,
  o.agent_limit,
  o.site_limit,
  o.features,
  o.platforms,
  o.trial_ends_at,
  o.is_active,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'agent' AND u.is_active) AS agents_used,
  COUNT(DISTINCT s.id) FILTER (WHERE s.is_active)                       AS sites_used,
  COUNT(DISTINCT m.id) FILTER (
    WHERE m.status IN ('planned','in_progress','review')
    AND DATE_TRUNC('month', m.created_at) = DATE_TRUNC('month', NOW())
  )                                                      AS missions_this_month
FROM organizations o
LEFT JOIN users    u ON u.organization_id = o.id
LEFT JOIN sites    s ON s.organization_id = o.id
LEFT JOIN missions m ON m.organization_id = o.id
GROUP BY o.id;
