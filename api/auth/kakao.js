import { getPool } from '../_lib/db.js';
import { signJwt } from '../_lib/jwt.js';
import { setCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, redirectUri } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'code required' });
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_LOGIN_REST_API_KEY,
        redirect_uri: redirectUri || process.env.KAKAO_LOGIN_REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('[auth/kakao] token exchange failed:', tokenData);
      return res.status(401).json({ error: 'Kakao token exchange failed' });
    }

    // 2. Get user info
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json();

    if (!userData.id) {
      console.error('[auth/kakao] user info failed:', userData);
      return res.status(401).json({ error: 'Failed to get Kakao user info' });
    }

    const kakaoId = userData.id;
    const nickname = userData.kakao_account?.profile?.nickname || `카카오${String(kakaoId).slice(-4)}`;
    const profileImage = userData.kakao_account?.profile?.profile_image_url || null;
    const email = userData.kakao_account?.email || null;

    // 3. Upsert user
    const pool = getPool();
    const { rows } = await pool.query(`
      INSERT INTO users (kakao_id, auth_provider, nickname, profile_image_url, email, last_login_at)
      VALUES ($1, 'kakao', $2, $3, $4, NOW())
      ON CONFLICT (kakao_id) DO UPDATE SET
        nickname = CASE WHEN users.nickname IS NULL THEN EXCLUDED.nickname ELSE users.nickname END,
        profile_image_url = EXCLUDED.profile_image_url,
        email = EXCLUDED.email,
        last_login_at = NOW()
      RETURNING id, nickname
    `, [kakaoId, nickname, profileImage, email]);

    const user = rows[0];

    // 4. Sign JWT
    const token = signJwt({
      userId: user.id,
      userKey: `kakao_${kakaoId}`,
      authProvider: 'kakao',
    });

    console.log(`[auth/kakao] login success: userId=${user.id}, kakaoId=${kakaoId}`);

    return res.json({
      token,
      userId: user.id,
      userKey: `kakao_${kakaoId}`,
      nickname: user.nickname,
      authProvider: 'kakao',
    });
  } catch (err) {
    console.error('[auth/kakao] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
