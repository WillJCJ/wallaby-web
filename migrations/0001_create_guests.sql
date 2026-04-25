CREATE TABLE IF NOT EXISTS guests (
  guest_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  rsvp TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp IN ('pending', 'yes', 'no')),
  additional_guests INTEGER NOT NULL DEFAULT 0,
  dietary_requirements TEXT NOT NULL DEFAULT '',
  rsvp_message TEXT NOT NULL DEFAULT '',
  access_enabled INTEGER NOT NULL DEFAULT 0,
  invited_at TEXT,
  last_synced_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'never' CHECK (sync_status IN ('never', 'in_sync', 'pending', 'failed', 'drift')),
  sync_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
CREATE INDEX IF NOT EXISTS idx_guests_access_enabled ON guests(access_enabled);
CREATE INDEX IF NOT EXISTS idx_guests_sync_status ON guests(sync_status);
 