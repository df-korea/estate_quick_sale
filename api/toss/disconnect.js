/**
 * 토스 로그인 연결끊기 콜백 엔드포인트
 *
 * 토스앱에서 사용자가 연결 해제 시 호출됨.
 * - GET: ?userKey={userKey}&referrer={referrer}
 * - POST: { userKey, referrer }
 *
 * referrer: UNLINK | WITHDRAWAL_TERMS | WITHDRAWAL_TOSS
 */

const BASIC_AUTH_VALUE = process.env.TOSS_DISCONNECT_BASIC_AUTH || '';

function verifyBasicAuth(authHeader) {
  if (!BASIC_AUTH_VALUE) return true; // 미설정 시 스킵
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;

  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  return decoded === BASIC_AUTH_VALUE;
}

export default async function handler(req, res) {
  // Basic Auth 검증
  const authHeader = req.headers.authorization;
  if (!verifyBasicAuth(authHeader)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET / POST 둘 다 지원
  let userKey, referrer;
  if (req.method === 'GET') {
    userKey = req.query.userKey;
    referrer = req.query.referrer;
  } else if (req.method === 'POST') {
    userKey = req.body?.userKey;
    referrer = req.body?.referrer;
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log(`[toss-disconnect] userKey=${userKey}, referrer=${referrer}`);

  // TODO: 실제 세션/토큰 정리 로직 추가
  // 예: Supabase에서 해당 userKey의 세션 삭제

  return res.status(200).json({ success: true });
}
