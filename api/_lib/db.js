import pg from 'pg';
const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const isRemote = process.env.PGHOST && process.env.PGHOST !== 'localhost';
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '8081'),
      database: process.env.PGDATABASE || 'estate_quick_sale',
      user: process.env.PGUSER || 'estate_app',
      password: process.env.PGPASSWORD || '',
      max: 20,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ...(isRemote && { ssl: { rejectUnauthorized: false } }),
    });
  }
  return pool;
}
