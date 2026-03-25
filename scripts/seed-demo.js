const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { loadConfig } = require('../src/config');

function ensureSchema(db) {
  const schemaPath = path.join(__dirname, '..', 'src', 'db', 'schema.sql');
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
}

function upsertUser(db, user) {
  db.prepare(`
    INSERT INTO users (id, display_name, real_e164, caller_endpoint, enabled, created_at, updated_at)
    VALUES (@id, @display_name, @real_e164, @caller_endpoint, 1, datetime('now'), datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      display_name = excluded.display_name,
      real_e164 = excluded.real_e164,
      caller_endpoint = excluded.caller_endpoint,
      enabled = 1,
      updated_at = datetime('now')
  `).run(user);
}

function upsertVirtual(db, e164) {
  db.prepare(`
    INSERT INTO virtual_numbers (e164, enabled, created_at, updated_at)
    VALUES (?, 1, datetime('now'), datetime('now'))
    ON CONFLICT(e164) DO UPDATE SET
      enabled = 1,
      updated_at = datetime('now')
  `).run(e164);
}

function upsertTrunk(db, trunk) {
  db.prepare('UPDATE trunks SET is_default = 0 WHERE is_default = 1').run();

  db.prepare(`
    INSERT INTO trunks (
      name, type, enabled, is_default, server,
      username, password, from_domain, created_at, updated_at
    ) VALUES (
      @name, @type, @enabled, @is_default, @server,
      @username, @password, @from_domain, datetime('now'), datetime('now')
    )
    ON CONFLICT(name) DO UPDATE SET
      type = excluded.type,
      enabled = excluded.enabled,
      is_default = excluded.is_default,
      server = excluded.server,
      username = excluded.username,
      password = excluded.password,
      from_domain = excluded.from_domain,
      updated_at = datetime('now')
  `).run(trunk);
}

function main() {
  const config = loadConfig();
  fs.mkdirSync(path.dirname(config.db.path), { recursive: true });
  const db = new Database(config.db.path);
  db.pragma('foreign_keys = ON');
  ensureSchema(db);

  upsertUser(db, {
    id: 'caller-alice',
    display_name: 'Alice Caller',
    real_e164: '+8613900000001',
    caller_endpoint: 'alice'
  });

  upsertUser(db, {
    id: 'callee-bob',
    display_name: 'Bob Callee',
    real_e164: '+8613900000002',
    caller_endpoint: 'bob'
  });

  upsertUser(db, {
    id: 'caller-charlie',
    display_name: 'Charlie Caller',
    real_e164: '+8613900000003',
    caller_endpoint: 'charlie'
  });

  upsertVirtual(db, '+8613800011111');
  upsertVirtual(db, '+8613800011112');
  upsertVirtual(db, '+8613800011113');

  upsertTrunk(db, {
    name: 'carrier_out',
    type: 'sip',
    enabled: 0,
    is_default: 1,
    server: 'sip.example.com',
    username: 'replace_me',
    password: 'replace_me',
    from_domain: 'example.com'
  });

  db.close();

  // eslint-disable-next-line no-console
  console.log(`Seeded demo data into: ${config.db.path}`);
  // eslint-disable-next-line no-console
  console.log('Demo caller_user_id: caller-alice / caller-charlie');
}

main();
