import crypto from 'crypto';

const ALG = 'HS256';
const EXPIRY_DAYS = 7;

function getSecret() {
  const secret = process.env.TOSS_AIT_API_KEY;
  if (!secret) throw new Error('TOSS_AIT_API_KEY required');
  return secret;
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

export function signJwt(payload) {
  const secret = getSecret();
  const header = base64url(JSON.stringify({ alg: ALG, typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 86400;
  const body = base64url(JSON.stringify({ ...payload, exp }));
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token) {
  if (!token) return null;
  const secret = getSecret();
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function extractUser(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyJwt(auth.slice(7));
}
