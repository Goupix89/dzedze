-- ============================================================
-- DZEDZE — Supervision Nettoyage
-- Schéma PostgreSQL complet v1.0
-- Mobile : Flutter (iOS + Android)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES MÉTIER
-- ============================================================

-- ─── UTILISATEURS ───────────────────────────────────────────
CREATE TABLE users (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             VARCHAR(255) UNIQUE NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,
  first_name        VARCHAR(100) NOT NULL,
  last_name         VARCHAR(100) NOT NULL,
  role              VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'manager', 'agent')),
  phone             VARCHAR(20),
  avatar_url        TEXT,
  -- statut opérationnel de l'agent (disponible, en_mission, hors_ligne)
  status            VARCHAR(20)  DEFAULT 'disponible'
                    CHECK (status IN ('disponible', 'en_mission', 'hors_ligne', 'conge')),
  is_active         BOOLEAN      DEFAULT true,
  -- score qualité global calculé à partir des analyses IA
  quality_score     DECIMAL(3,1) DEFAULT 0.0,
  -- RGPD
  consent_given     BOOLEAN      DEFAULT false,
  consent_date      TIMESTAMPTZ,
  consent_version   VARCHAR(10),
  -- Push notifications Flutter (FCM token)
  fcm_token         TEXT,
  -- DeviceID Flutter pour le pairing GoPro
  device_id         VARCHAR(255),
  last_login        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── SITES ──────────────────────────────────────────────────
CREATE TABLE sites (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255) NOT NULL,
  address       TEXT         NOT NULL,
  city          VARCHAR(100) NOT NULL,
  country       VARCHAR(100) DEFAULT 'France',
  latitude      DECIMAL(10,8),
  longitude     DECIMAL(11,8),
  description   TEXT,
  surface_m2    INTEGER,
  site_type     VARCHAR(50)  DEFAULT 'bureau'
                CHECK (site_type IN ('bureau', 'entrepot', 'hopital', 'école', 'commerce', 'autre')),
  -- Checklist type par défaut pour ce site (JSONB pour flexibilité)
  checklist_template JSONB   DEFAULT '[]',
  is_active     BOOLEAN      DEFAULT true,
  manager_id    UUID         REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── MISSIONS ───────────────────────────────────────────────
-- Nommage aligné avec le code (started_at, completed_at)
CREATE TABLE missions (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  site_id         UUID         NOT NULL REFERENCES sites(id),
  agent_id        UUID         NOT NULL REFERENCES users(id),
  manager_id      UUID         REFERENCES users(id),
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20)  DEFAULT 'planned'
                  CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled', 'review')),
  -- Planification
  scheduled_start TIMESTAMPTZ  NOT NULL,
  scheduled_end   TIMESTAMPTZ  NOT NULL,
  -- Exécution réelle (noms alignés avec le code)
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  -- Qualité
  quality_score   DECIMAL(3,1),
  -- Checklist spécifique à cette mission (copie du template au moment de la création)
  checklist       JSONB        DEFAULT '[]',
  notes           TEXT,
  -- Rapport IA final
  ai_report       JSONB,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── MÉDIAS ─────────────────────────────────────────────────
-- storage_key nullable → set to NULL lors de la suppression RGPD
-- (l'enregistrement reste pour l'audit mais le fichier est effacé)
CREATE TABLE media (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id          UUID         NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  uploaded_by         UUID         NOT NULL REFERENCES users(id),
  type                VARCHAR(10)  NOT NULL CHECK (type IN ('photo', 'video', 'stream_clip')),
  phase               VARCHAR(10)  CHECK (phase IN ('before', 'during', 'after')),
  filename            VARCHAR(255) NOT NULL,
  -- NULL après suppression RGPD (intentionnellement nullable)
  storage_key         TEXT,
  thumbnail_key       TEXT,
  storage_bucket      VARCHAR(100) NOT NULL,
  size_bytes          BIGINT,
  duration_seconds    INTEGER,
  mime_type           VARCHAR(100),
  -- Chiffrement
  is_encrypted        BOOLEAN      DEFAULT true,
  encryption_key_id   VARCHAR(100),
  -- IA
  ai_analysis         JSONB,
  quality_score       DECIMAL(3,1),
  anomalies           JSONB        DEFAULT '[]',
  -- RGPD : rétention configurable 7–30 jours
  retention_days      INTEGER      DEFAULT 30 CHECK (retention_days BETWEEN 7 AND 30),
  expires_at          TIMESTAMPTZ  NOT NULL,
  -- Supprimé logiquement (flag RGPD) : fichier effacé, metadata conservée
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── SESSIONS LIVE STREAM ───────────────────────────────────
CREATE TABLE stream_sessions (
  id                    UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id            UUID         NOT NULL REFERENCES missions(id),
  agent_id              UUID         NOT NULL REFERENCES users(id),
  requested_by          UUID         NOT NULL REFERENCES users(id),
  -- Clé unique pour le flux HLS/WebRTC
  stream_key            VARCHAR(255) UNIQUE NOT NULL,
  status                VARCHAR(20)  DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'refused', 'active', 'ended')),
  -- Consentement explicite agent (RGPD obligatoire)
  agent_consent         BOOLEAN      DEFAULT false,
  consent_at            TIMESTAMPTZ,
  max_duration_minutes  INTEGER      DEFAULT 15 CHECK (max_duration_minutes BETWEEN 5 AND 30),
  started_at            TIMESTAMPTZ,
  ended_at              TIMESTAMPTZ,
  actual_duration_sec   INTEGER,     -- calculé à la fin
  reason                TEXT,        -- motif obligatoire saisi par le manager
  created_at            TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── JOURNAL D'AUDIT (RGPD) ─────────────────────────────────
CREATE TABLE audit_logs (
  id            UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50)  NOT NULL,
  resource_id   UUID,
  details       JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── JOURNAL D'ACCÈS AUX MÉDIAS (RGPD) ─────────────────────
CREATE TABLE media_access_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_id      UUID        NOT NULL REFERENCES media(id),
  accessed_by   UUID        NOT NULL REFERENCES users(id),
  access_type   VARCHAR(20) CHECK (access_type IN ('view', 'download', 'delete', 'stream')),
  ip_address    INET,
  justification TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CONSENTEMENTS ENREGISTRÉS ──────────────────────────────
CREATE TABLE consent_records (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES users(id),
  consent_type  VARCHAR(50) NOT NULL
                CHECK (consent_type IN ('data_processing', 'live_stream', 'ai_analysis', 'media_storage')),
  version       VARCHAR(10) NOT NULL,
  given         BOOLEAN     NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── NOTIFICATIONS ──────────────────────────────────────────
CREATE TABLE notifications (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  title      VARCHAR(255) NOT NULL,
  message    TEXT,
  data       JSONB,
  is_read    BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TOKENS REFRESH (révocation possible) ───────────────────
CREATE TABLE refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN     DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEX DE PERFORMANCE
-- ============================================================

-- Missions
CREATE INDEX idx_missions_agent      ON missions(agent_id);
CREATE INDEX idx_missions_site       ON missions(site_id);
CREATE INDEX idx_missions_manager    ON missions(manager_id);
CREATE INDEX idx_missions_status     ON missions(status);
CREATE INDEX idx_missions_scheduled  ON missions(scheduled_start);
CREATE INDEX idx_missions_started    ON missions(started_at) WHERE started_at IS NOT NULL;

-- Médias
CREATE INDEX idx_media_mission       ON media(mission_id);
CREATE INDEX idx_media_expires       ON media(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_media_type_phase    ON media(type, phase);

-- Audit
CREATE INDEX idx_audit_user          ON audit_logs(user_id);
CREATE INDEX idx_audit_resource      ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created       ON audit_logs(created_at DESC);

-- Accès médias
CREATE INDEX idx_media_access_media  ON media_access_logs(media_id);
CREATE INDEX idx_media_access_user   ON media_access_logs(accessed_by);

-- Stream sessions
CREATE INDEX idx_stream_mission      ON stream_sessions(mission_id);
CREATE INDEX idx_stream_agent        ON stream_sessions(agent_id);
CREATE INDEX idx_stream_status       ON stream_sessions(status);

-- Notifications
CREATE INDEX idx_notif_user_unread   ON notifications(user_id) WHERE is_read = false;

-- Users
CREATE INDEX idx_users_role          ON users(role) WHERE is_active = true;

-- ============================================================
-- VUES POUR LE DASHBOARD
-- ============================================================

-- Vue missions enrichies (JOIN sites + users)
CREATE VIEW v_missions AS
SELECT
  m.*,
  s.name                                   AS site_name,
  s.address                                AS site_address,
  s.city                                   AS site_city,
  s.latitude                               AS site_latitude,
  s.longitude                              AS site_longitude,
  a.first_name || ' ' || a.last_name       AS agent_name,
  a.phone                                  AS agent_phone,
  a.status                                 AS agent_status,
  a.quality_score                          AS agent_quality_score,
  mg.first_name || ' ' || mg.last_name     AS manager_name
FROM missions m
JOIN sites   s  ON m.site_id    = s.id
JOIN users   a  ON m.agent_id   = a.id
LEFT JOIN users mg ON m.manager_id = mg.id;

-- Vue statistiques dashboard (utilisée par /missions/stats)
CREATE VIEW v_dashboard_stats AS
SELECT
  -- Missions du jour
  COUNT(*) FILTER (
    WHERE DATE(scheduled_start) = CURRENT_DATE
  )                                                     AS today_missions,

  -- En cours
  COUNT(*) FILTER (WHERE status = 'in_progress')        AS in_progress,

  -- Terminées cette semaine
  COUNT(*) FILTER (
    WHERE status = 'completed'
    AND completed_at >= DATE_TRUNC('week', NOW())
  )                                                     AS completed_this_week,

  -- Score qualité moyen (30 derniers jours)
  ROUND(AVG(quality_score) FILTER (
    WHERE quality_score IS NOT NULL
    AND completed_at >= NOW() - INTERVAL '30 days'
  ), 1)                                                 AS avg_quality_score

FROM missions;

-- Vue agents avec stats
CREATE VIEW v_agent_stats AS
SELECT
  u.id,
  u.first_name,
  u.last_name,
  u.email,
  u.phone,
  u.status,
  u.quality_score,
  u.last_login,
  COUNT(m.id) FILTER (WHERE m.status = 'in_progress')   AS active_missions,
  COUNT(m.id) FILTER (
    WHERE m.status = 'completed'
    AND m.completed_at >= NOW() - INTERVAL '30 days'
  )                                                      AS missions_last_30d,
  ROUND(AVG(m.quality_score) FILTER (
    WHERE m.quality_score IS NOT NULL
    AND m.completed_at >= NOW() - INTERVAL '30 days'
  ), 1)                                                  AS recent_avg_score
FROM users u
LEFT JOIN missions m ON m.agent_id = u.id
WHERE u.role = 'agent' AND u.is_active = true
GROUP BY u.id;

-- ============================================================
-- FONCTIONS & TRIGGERS
-- ============================================================

-- Auto updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_sites_updated    BEFORE UPDATE ON sites    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();
CREATE TRIGGER trg_missions_updated BEFORE UPDATE ON missions FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Mise à jour automatique du statut agent selon les missions
CREATE OR REPLACE FUNCTION fn_sync_agent_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'in_progress' THEN
    UPDATE users SET status = 'en_mission'  WHERE id = NEW.agent_id;
  ELSIF NEW.status IN ('completed', 'cancelled') THEN
    UPDATE users SET status = 'disponible'  WHERE id = NEW.agent_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mission_agent_status
  AFTER INSERT OR UPDATE OF status ON missions
  FOR EACH ROW EXECUTE FUNCTION fn_sync_agent_status();

-- Suppression logique des médias expirés (RGPD)
-- Conserve la ligne pour l'audit mais efface les clés de stockage
CREATE OR REPLACE FUNCTION fn_expire_media()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE media
  SET storage_key       = NULL,
      thumbnail_key     = NULL,
      encryption_key_id = NULL,
      deleted_at        = NOW()
  WHERE expires_at < NOW()
    AND deleted_at  IS NULL
    AND storage_key IS NOT NULL;
END;
$$;

-- Calcul du score qualité agent (appelé après analyse IA)
CREATE OR REPLACE FUNCTION fn_update_agent_quality_score(p_agent_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE users
  SET quality_score = (
    SELECT ROUND(AVG(quality_score), 1)
    FROM missions
    WHERE agent_id    = p_agent_id
      AND quality_score IS NOT NULL
      AND completed_at  >= NOW() - INTERVAL '90 days'
  )
  WHERE id = p_agent_id;
END;
$$;

-- ============================================================
-- DONNÉES DE DÉMARRAGE
-- ============================================================

-- Admin par défaut (mot de passe : Admin@123!)
INSERT INTO users (email, password_hash, first_name, last_name, role,
                   consent_given, consent_date, consent_version, status)
VALUES (
  'admin@dzedze.app',
  crypt('Admin@123!', gen_salt('bf', 12)),
  'Super', 'Admin', 'admin',
  true, NOW(), '1.0', 'disponible'
);

-- Manager de démonstration (mot de passe : Manager@123!)
INSERT INTO users (email, password_hash, first_name, last_name, role,
                   phone, consent_given, consent_date, consent_version, status)
VALUES (
  'manager@dzedze.app',
  crypt('Manager@123!', gen_salt('bf', 12)),
  'Kofi', 'Mensah', 'manager',
  '+33600000001', true, NOW(), '1.0', 'disponible'
);

-- Agent de démonstration (mot de passe : Agent@123!)
INSERT INTO users (email, password_hash, first_name, last_name, role,
                   phone, consent_given, consent_date, consent_version, status)
VALUES (
  'agent@dzedze.app',
  crypt('Agent@123!', gen_salt('bf', 12)),
  'Ama', 'Koffi', 'agent',
  '+33600000002', true, NOW(), '1.0', 'disponible'
);

-- Site de démonstration
INSERT INTO sites (name, address, city, country, surface_m2, site_type,
                   manager_id, checklist_template)
SELECT
  'Bureau Central Dzedze',
  '12 Rue de la Propreté',
  'Paris',
  'France',
  850,
  'bureau',
  u.id,
  '[
    {"id":"1","label":"Aspiration des sols","done":false,"required":true},
    {"id":"2","label":"Nettoyage des sanitaires","done":false,"required":true},
    {"id":"3","label":"Vidage des corbeilles","done":false,"required":true},
    {"id":"4","label":"Dépoussiérage mobilier","done":false,"required":false},
    {"id":"5","label":"Désinfection poignées de porte","done":false,"required":true},
    {"id":"6","label":"Nettoyage vitres entrée","done":false,"required":false}
  ]'::jsonb
FROM users u WHERE u.email = 'manager@dzedze.app';

-- Mission de démonstration (planned)
INSERT INTO missions (site_id, agent_id, manager_id, title, description,
                      status, scheduled_start, scheduled_end, checklist)
SELECT
  s.id,
  a.id,
  m.id,
  'Nettoyage quotidien — Bureau Central',
  'Nettoyage standard du bureau central. Photos avant/après obligatoires.',
  'planned',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '4 hours',
  '[
    {"id":"1","label":"Aspiration des sols","done":false,"required":true},
    {"id":"2","label":"Nettoyage des sanitaires","done":false,"required":true},
    {"id":"3","label":"Vidage des corbeilles","done":false,"required":true},
    {"id":"5","label":"Désinfection poignées de porte","done":false,"required":true}
  ]'::jsonb
FROM sites   s JOIN users m ON s.manager_id  = m.id
               JOIN users a ON a.email = 'agent@dzedze.app'
WHERE s.name = 'Bureau Central Dzedze';

-- Consentements enregistrés pour les utilisateurs de démo
INSERT INTO consent_records (user_id, consent_type, version, given)
SELECT id, 'data_processing', '1.0', true FROM users WHERE role IN ('manager', 'agent');

INSERT INTO consent_records (user_id, consent_type, version, given)
SELECT id, 'media_storage', '1.0', true FROM users WHERE role = 'agent';

INSERT INTO consent_records (user_id, consent_type, version, given)
SELECT id, 'ai_analysis', '1.0', true FROM users WHERE role = 'agent';
