const { loadConfig } = require('../src/config');
const { DatabaseService } = require('../src/db');

function main() {
  const config = loadConfig();
  const db = new DatabaseService(config.db.path);
  db.close();
  // eslint-disable-next-line no-console
  console.log(`Database initialized: ${config.db.path}`);
}

main();
