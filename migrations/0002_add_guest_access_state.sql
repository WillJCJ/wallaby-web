ALTER TABLE guests ADD COLUMN access_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE guests ADD COLUMN invited_at TEXT;
ALTER TABLE guests ADD COLUMN last_synced_at TEXT;
ALTER TABLE guests ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'never' CHECK (sync_status IN ('never', 'in_sync', 'pending', 'failed', 'drift'));
ALTER TABLE guests ADD COLUMN sync_error TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_guests_access_enabled ON guests(access_enabled);
CREATE INDEX IF NOT EXISTS idx_guests_sync_status ON guests(sync_status);
