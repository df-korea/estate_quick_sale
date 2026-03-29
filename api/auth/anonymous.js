import { getPool } from '../_lib/db.js';
import { signJwt } from '../_lib/jwt.js';
import { setCors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nickname } = req.body || {};
  if (!nickname || nickname.length < 2 || nickname.length > 10) {
    return res.status(400).json({ error: '닉네임은 2~10자여야 합니다' });
  }

  // Sanitize nickname
  const cleanNickname = nickname.replace(/[<>&"']/g, '').trim();
  if (cleanNickname.length < 2) {
    return res.status(400).json({ error: '유효한 닉네임을 입력하세요' });
  }

  try {
    const pool = getPool();

    // Create anonymous user
    const tag = Math.floor(Math.random() * 9000) + 1000;
    const displayNickname = `${cleanNickname}#${tag}`;

    const { rows } = await pool.query(`
      INSERT INTO users (nickname, auth_provider, last_login_at)
      VALUES ($1, 'anonymous', NOW())
      RETURNING id, nickname
    `, [displayNickname]);

    const user = rows[0];

    // Sign JWT with 1-day expiry
    const token = signJwt({
      userId: user.id,
      userKey: `anon_${user.id}`,
      authProvider: 'anonymous',
    }, 1);

    console.log(`[auth/anonymous] login: userId=${user.id}, nickname=${displayNickname}`);

    return res.json({
      token,
      userId: user.id,
      userKey: `anon_${user.id}`,
      nickname: displayNickname,
      authProvider: 'anonymous',
    });
  } catch (err) {
    console.error('[auth/anonymous] error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
