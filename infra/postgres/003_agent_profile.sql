-- ============================================================
-- DZEDZE — Extended agent profile fields
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS id_card_number         VARCHAR(50),
  ADD COLUMN IF NOT EXISTS birth_date             DATE,
  ADD COLUMN IF NOT EXISTS birth_place            VARCHAR(150),
  ADD COLUMN IF NOT EXISTS home_address           TEXT,
  ADD COLUMN IF NOT EXISTS blood_type             VARCHAR(5)
    CHECK (blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  ADD COLUMN IF NOT EXISTS emergency_contact_name  VARCHAR(150),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(30),
  ADD COLUMN IF NOT EXISTS contract_type          VARCHAR(20)  DEFAULT 'cdd'
    CHECK (contract_type IN ('cdi','cdd','interim','vacataire','freelance')),
  ADD COLUMN IF NOT EXISTS hire_date              DATE,
  ADD COLUMN IF NOT EXISTS specialties            TEXT[]       DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS uniform_size           VARCHAR(10),
  ADD COLUMN IF NOT EXISTS shoe_size              VARCHAR(5),
  ADD COLUMN IF NOT EXISTS notes                  TEXT;
