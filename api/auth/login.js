import { postWithMtls, getWithMtls } from '../_lib/toss-mtls.js';
import { getPool } from '../_lib/db.js';
import { signJwt } from '../_lib/jwt.js';
import { setCors } from '../_lib/cors.js';
import { decryptTossValue } from '../_lib/toss-decrypt.js';

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
      return res.status(401).json({ error: 'Failed to get access token' });
    }

    // 2. Get user info (Bearer prefix required per Toss API spec)
    const userRes = await getWithMtls(`${AUTH_BASE}/login-me`, {
      Authorization: `Bearer ${accessToken}`,
    });
    const userInfo = userRes?.success;
    const userKey = userInfo?.userKey;
    if (!userKey) {
      console.error('[auth/login] login-me failed:', userRes);
      return res.status(401).json({ error: 'Failed to get user info' });
    }

    // 3. Decrypt user info from Toss (AES-256-GCM)
    const decName = decryptTossValue(userInfo.name) || userInfo.name || null;
    const decBirthday = decryptTossValue(userInfo.birthday) || userInfo.birthday || null;
    const decGender = decryptTossValue(userInfo.gender) || userInfo.gender || null;
    const decPhone = decryptTossValue(userInfo.phone) || userInfo.phone || null;
    const decCi = userInfo.ci || null; // CI는 그대로 저장
    const decDi = userInfo.di || null;

    // 4. UPSERT user with decrypted info
    const pool = getPool();
    const { rows } = await pool.query(`
      INSERT INTO users (toss_user_id, toss_refresh_token, toss_name, toss_birthday, toss_gender, phone, toss_ci, toss_di, last_login_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (toss_user_id) DO UPDATE SET
        toss_refresh_token = $2,
        toss_name = COALESCE($3, users.toss_name),
        toss_birthday = COALESCE($4, users.toss_birthday),
        toss_gender = COALESCE($5, users.toss_gender),
        phone = COALESCE($6, users.phone),
        toss_ci = COALESCE($7, users.toss_ci),
        toss_di = COALESCE($8, users.toss_di),
        last_login_at = NOW()
      RETURNING id, toss_user_id, nickname, toss_name, toss_birthday, toss_gender, phone, profile_image_url
    `, [
      String(userKey),
      refreshToken,
      decName,
      decBirthday,
      decGender,
      decPhone,
      decCi,
      decDi,
    ]);
    const user = rows[0];

    // Set default nickname if not set (use decrypted name if available)
    if (!user.nickname) {
      const defaultNickname = decName || `유저${String(user.id).padStart(4, '0')}`;
      await pool.query(`UPDATE users SET nickname = $1 WHERE id = $2 AND nickname IS NULL`, [defaultNickname, user.id]);
      user.nickname = defaultNickname;
    }

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
    return res.status(500).json({ error: e.message });
  }
}
