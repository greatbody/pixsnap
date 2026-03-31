-- PixSnap D1 Schema
-- Migration: 0001_init

CREATE TABLE IF NOT EXISTS images (
  id           TEXT PRIMARY KEY,
  filename     TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size         INTEGER NOT NULL DEFAULT 0,
  width        INTEGER,
  height       INTEGER,
  source_url   TEXT DEFAULT '',
  page_title   TEXT DEFAULT '',
  r2_key       TEXT NOT NULL,
  tags         TEXT DEFAULT '[]',
  capture_mode TEXT NOT NULL DEFAULT 'local',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_capture_mode ON images(capture_mode);
