import { getPool } from '../_lib/db.js';
import { extractUser } from '../_lib/jwt.js';
import { setCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = extractUser(req);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT id, toss_user_id, nickname, created_at, last_login_at FROM users WHERE id = $1`,
      [payload.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json(rows[0]);
  } catch (e) {
    console.error('[auth/me] error:', e);
    return res.status(500).json({ error: 'Internal error' });
  }
}
