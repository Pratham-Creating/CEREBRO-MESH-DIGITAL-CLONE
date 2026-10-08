CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  app_name TEXT NULL,
  window_title TEXT NULL,
  process_id INTEGER NULL,
  data TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_time ON activity_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON activity_events(event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_app_time ON activity_events(app_name, occurred_at DESC);

CREATE TABLE IF NOT EXISTS window_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  ended_at TEXT NULL,
  duration_ms INTEGER NULL,
  app_name TEXT NOT NULL,
  window_title TEXT NULL,
  process_id INTEGER NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_start ON window_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_app_start ON window_sessions(app_name, started_at DESC);
