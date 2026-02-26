import pg from 'pg';
const { Pool } = pg;

const isRemote = process.env.PGHOST && process.env.PGHOST !== 'localhost';

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'estate_quick_sale',
  user: process.env.PGUSER || 'backjs',
  password: process.env.PGPASSWORD || '',
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  ...(isRemote && { ssl: { rejectUnauthorized: false } }),
});
