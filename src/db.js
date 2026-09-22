import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  request_key TEXT UNIQUE,
  source TEXT NOT NULL CHECK (source IN ('adhoc', 'calendar')),
  calendar_event_id TEXT UNIQUE,
  title TEXT,
  meeting_url TEXT NOT NULL,
  join_at TEXT NOT NULL,
  status TEXT NOT NULL,
  status_sub_code TEXT,
  status_updated_at TEXT,
  bot_id TEXT,
  schedule_key TEXT,
  recording_id TEXT,
  transcript_id TEXT,
  transcript_status TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS meetings_bot_id ON meetings(bot_id);
CREATE INDEX IF NOT EXISTS meetings_recording_id ON meetings(recording_id);

CREATE TABLE IF NOT EXISTS transcripts (
  meeting_id TEXT PRIMARY KEY REFERENCES meetings(id),
  transcript_id TEXT NOT NULL,
  segments TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_inbox (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS webhook_inbox_pending ON webhook_inbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS calendars (
  id TEXT PRIMARY KEY,
  platform TEXT,
  platform_email TEXT,
  status TEXT,
  last_synced_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL,
  title TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  meeting_url TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  record INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS calendar_events_calendar ON calendar_events(calendar_id, start_time);
`;

export function openDatabase(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  return db;
}

export function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();
