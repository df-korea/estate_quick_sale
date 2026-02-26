import pg from 'pg';
const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const isRemote = process.env.PGHOST && process.env.PGHOST !== 'localhost';
    pool = new Pool({
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE || 'estate_quick_sale',
      user: process.env.PGUSER || 'backjs',
      password: process.env.PGPASSWORD || '',
      max: 3,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000,
      ...(isRemote && { ssl: { rejectUnauthorized: false } }),
    });
  }
  return pool;
}
