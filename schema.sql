CREATE TABLE IF NOT EXISTS donations (
  id BIGSERIAL PRIMARY KEY,
  donor_name TEXT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  message TEXT,
  anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  provider_reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS donations_status_created_idx
  ON donations(status, created_at DESC);

CREATE TABLE IF NOT EXISTS attendance_events (
  id BIGSERIAL PRIMARY KEY,
  session_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS attendance_created_idx
  ON attendance_events(created_at DESC);
