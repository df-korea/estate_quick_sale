import { postWithMtls, getWithMtls } from '../_lib/toss-mtls.js';
import { getPool } from '../_lib/db.js';
import { signJwt } from '../_lib/jwt.js';
import { setCors } from '../_lib/cors.js';

const AUTH_BASE = '/api-partner/v1/apps-in-toss/user/oauth2';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorizationCode, referrer } = req.body || {};
  if (!authorizationCode || !referrer) {
    return res.status(400).json({ error: 'authorizationCode and referrer required' });
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await postWithMtls(`${AUTH_BASE}/generate-token`, {
      authorizationCode,
      referrer,
    });
    const accessToken = tokenRes?.success?.accessToken;
    const refreshToken = tokenRes?.success?.refreshToken;
    if (!accessToken) {
      console.error('[auth/login] generate-token failed:', tokenRes);
      return res.status(401).json({ error: 'Failed to get access token', debug: tokenRes });
    }

    // 2. Get user info
    const userRes = await getWithMtls(`${AUTH_BASE}/login-me`, {
      Authorization: accessToken,
    });
    const userKey = userRes?.success?.userKey;
    if (!userKey) {
      console.error('[auth/login] login-me failed:', userRes);
      return res.status(401).json({ error: 'Failed to get user info', debug: userRes });
    }

    // 3. UPSERT user
    const pool = getPool();
    const { rows } = await pool.query(`
      INSERT INTO users (toss_user_id, toss_refresh_token, last_login_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (toss_user_id) DO UPDATE SET
        toss_refresh_token = $2,
        last_login_at = NOW()
      RETURNING id, toss_user_id, nickname
    `, [userKey, refreshToken]);
    const user = rows[0];

    // 4. Sign JWT
    const token = signJwt({
      userId: user.id,
      userKey: user.toss_user_id,
    });

    return res.status(200).json({
      token,
      userKey: user.toss_user_id,
      nickname: user.nickname,
      userId: user.id,
    });
  } catch (e) {
    console.error('[auth/login] error:', e);
    return res.status(500).json({ error: e.message, debug: e.body || null });
  }
}
