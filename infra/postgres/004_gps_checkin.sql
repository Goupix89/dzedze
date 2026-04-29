-- ============================================================
-- DZEDZE — GPS check-in/check-out + actual_end on missions
-- ============================================================

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS checkin_lat   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkin_lon   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkout_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS checkout_lon  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS actual_end    TIMESTAMPTZ;

-- Backfill actual_end from completed_at for existing data
UPDATE missions SET actual_end = completed_at WHERE actual_end IS NULL AND completed_at IS NOT NULL;

-- View for agent location tracking (last known position)
CREATE OR REPLACE VIEW v_agent_locations AS
SELECT
  u.id            AS agent_id,
  u.first_name,
  u.last_name,
  u.status,
  m.id            AS mission_id,
  m.title         AS mission_title,
  s.name          AS site_name,
  s.latitude      AS site_lat,
  s.longitude     AS site_lon,
  m.checkin_lat   AS agent_lat,
  m.checkin_lon   AS agent_lon,
  m.started_at    AS checkin_time
FROM users u
JOIN missions m ON m.agent_id = u.id AND m.status = 'in_progress'
JOIN sites    s ON s.id = m.site_id
WHERE u.role = 'agent' AND u.is_active = true;
