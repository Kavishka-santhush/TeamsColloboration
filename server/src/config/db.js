const { Pool } = require('pg');
const env = require('./env');

/**
 * Raw pg connection pool used only for PostgreSQL full-text / trigram search
 * queries (pg_trgm) that Prisma cannot express directly. Everything else goes
 * through the Prisma client.
 */
const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
});

/** Startup reachability probe used by index.js (does not throw on absence). */
async function assertDbReachable() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  assertDbReachable,
};
