import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '8081'),
  database: 'estate_rt',
  user: process.env.PGUSER || 'estate_app',
  password: process.env.PGPASSWORD || '',
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});
