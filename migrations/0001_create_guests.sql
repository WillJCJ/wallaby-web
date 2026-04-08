CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  rsvp TEXT NOT NULL DEFAULT 'pending' CHECK (rsvp IN ('pending', 'yes', 'no')),
  additional_guests INTEGER NOT NULL DEFAULT 0,
  dietary_requirements TEXT NOT NULL DEFAULT '',
  rsvp_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_guests_name ON guests(name);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);
