PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  real_e164 TEXT NOT NULL UNIQUE,
  caller_endpoint TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS virtual_numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  e164 TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'sip',
  enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  server TEXT,
  username TEXT,
  password TEXT,
  from_domain TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS id_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  callee_e164 TEXT NOT NULL UNIQUE,
  virtual_number_id INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (virtual_number_id) REFERENCES virtual_numbers(id)
);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  caller_user_id TEXT NOT NULL,
  caller_real_e164 TEXT NOT NULL,
  callee_e164 TEXT NOT NULL,
  selected_virtual_number_id INTEGER NOT NULL,
  selected_virtual_e164 TEXT NOT NULL,
  trunk_name TEXT,
  dial_target TEXT,
  action_id TEXT,
  status TEXT NOT NULL,
  bridge_status TEXT NOT NULL,
  failure_reason TEXT,
  requested_by TEXT NOT NULL,
  timeout_sec INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  ended_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (caller_user_id) REFERENCES users(id),
  FOREIGN KEY (selected_virtual_number_id) REFERENCES virtual_numbers(id)
);

CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_action_id ON calls(action_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_e164);

CREATE TABLE IF NOT EXISTS call_legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id TEXT NOT NULL,
  leg_type TEXT NOT NULL,
  channel TEXT,
  status TEXT NOT NULL,
  hangup_cause TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(call_id, leg_type),
  FOREIGN KEY (call_id) REFERENCES calls(id)
);

CREATE INDEX IF NOT EXISTS idx_call_legs_call_id ON call_legs(call_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender_user_id TEXT NOT NULL,
  sender_endpoint TEXT NOT NULL,
  sender_real_e164 TEXT NOT NULL,
  target_endpoint TEXT NOT NULL,
  target_e164 TEXT NOT NULL,
  selected_virtual_e164 TEXT NOT NULL,
  content_type TEXT NOT NULL,
  body TEXT NOT NULL,
  body_bytes INTEGER NOT NULL,
  status TEXT NOT NULL,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  delivered_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sender_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_user_id ON messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_target_endpoint ON messages(target_endpoint);

CREATE TABLE IF NOT EXISTS ops_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  result TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_events_created_at
  ON ops_audit_events(created_at DESC);
