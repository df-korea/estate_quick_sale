import { NextRequest, NextResponse } from 'next/server';
import pg from 'pg';

/**
 * 포인트줍줍 토스 로그인 연결끊기 콜백
 *
 * 토스앱에서 사용자가 연결 해제 시 호출됨.
 * - POST: { userKey, referrer }
 *
 * referrer: UNLINK | WITHDRAWAL_TERMS | WITHDRAWAL_TOSS
 */

// Basic Auth: jupjup:Zup2026!cb
const BASIC_AUTH = 'jupjup:Zup2026!cb';

const JUPJUP_DB = {
  host: 'localhost',
  port: 8081,
  database: 'point_jupjup',
  user: 'point_jupjup',
  password: 'jupjup2024!',
};

const ALLOWED_ORIGINS = [
  'https://apps-in-toss.toss.im',
  'https://developers-apps-in-toss.toss.im',
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function verifyBasicAuth(authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  return decoded === BASIC_AUTH;
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Basic Auth 검증
  const authHeader = request.headers.get('authorization');
  if (!verifyBasicAuth(authHeader)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const body = await request.json().catch(() => ({}));
  const { userKey, referrer } = body as { userKey?: string | number; referrer?: string };

  console.log(`[jupjup-toss-disconnect] userKey=${userKey}, referrer=${referrer}`);

  // 테스트 호출(userKey=0) 스킵
  if (userKey && String(userKey) !== '0') {
    const pool = new pg.Pool(JUPJUP_DB);
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM user_profiles WHERE user_id = $1`,
        [String(userKey)]
      );
      console.log(`[jupjup-toss-disconnect] deleted ${rowCount} user(s) for userKey=${userKey}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[jupjup-toss-disconnect] DB error:', msg);
    } finally {
      await pool.end();
    }
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}

// GET도 지원 (토스 콘솔 테스트용)
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  const url = new URL(request.url);
  const userKey = url.searchParams.get('userKey');
  const referrer = url.searchParams.get('referrer');

  console.log(`[jupjup-toss-disconnect] GET userKey=${userKey}, referrer=${referrer}`);

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
