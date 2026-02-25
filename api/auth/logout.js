import { postWithMtls } from '../_lib/toss-mtls.js';
import { getPool } from '../_lib/db.js';
import { extractUser } from '../_lib/jwt.js';
import { setCors } from '../_lib/cors.js';

const AUTH_BASE = '/api-partner/v1/apps-in-toss/user/oauth2';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = extractUser(req);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await postWithMtls(`${AUTH_BASE}/access/remove-by-user-key`, {
      userKey: payload.userKey,
    });
  } catch (e) {
    console.warn('[auth/logout] remove-by-user-key failed:', e.message);
  }

  try {
    const pool = getPool();
    await pool.query(
      `UPDATE users SET toss_refresh_token = NULL WHERE id = $1`,
      [payload.userId]
    );
  } catch (e) {
    console.error('[auth/logout] db error:', e);
  }

  return res.status(200).json({ success: true });
}
