/**
 * Adapter to bridge Next.js App Router request/response to
 * Express-style req/res that our existing Vercel handlers expect.
 */
import { NextRequest, NextResponse } from 'next/server';

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  ended: boolean;
  headersSent: boolean;
  status: (code: number) => MockRes;
  json: (data: unknown) => void;
  end: () => void;
  setHeader: (key: string, value: string) => void;
  getHeader: (key: string) => string | undefined;
}

function createMockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    headersSent: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      res.headers['content-type'] = 'application/json';
      res.ended = true;
      res.headersSent = true;
    },
    end() {
      res.ended = true;
      res.headersSent = true;
    },
    setHeader(key: string, value: string) {
      res.headers[key.toLowerCase()] = value;
    },
    getHeader(key: string) {
      return res.headers[key.toLowerCase()];
    },
  };
  return res;
}

interface MockReq {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  params: Record<string, string>;
}

async function createMockReq(nextReq: NextRequest, params?: Record<string, string>): Promise<MockReq> {
  const headers: Record<string, string> = {};
  nextReq.headers.forEach((v, k) => { headers[k] = v; });

  const query: Record<string, string> = {};
  nextReq.nextUrl.searchParams.forEach((v, k) => { query[k] = v; });

  let body: unknown = null;
  if (nextReq.method === 'POST' || nextReq.method === 'PUT' || nextReq.method === 'DELETE') {
    try {
      body = await nextReq.json();
    } catch {
      body = null;
    }
  }

  return {
    method: nextReq.method,
    url: nextReq.nextUrl.pathname + nextReq.nextUrl.search,
    headers,
    query,
    body,
    params: params || {},
  };
}

function mockResToNextResponse(res: MockRes): NextResponse {
  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (value) responseHeaders.set(key, value);
  }

  if (res.statusCode === 204) {
    return new NextResponse(null, { status: 204, headers: responseHeaders });
  }

  return NextResponse.json(res.body ?? {}, {
    status: res.statusCode,
    headers: responseHeaders,
  });
}

/**
 * Wrap a Vercel-style handler (req, res) => void into a Next.js App Router handler.
 */
export function wrapHandler(handler: (req: MockReq, res: MockRes) => Promise<void>) {
  return async (nextReq: NextRequest) => {
    const req = await createMockReq(nextReq);
    const res = createMockRes();

    try {
      await handler(req as any, res as any);
    } catch (e) {
      console.error('[handler-adapter] error:', e);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }

    return mockResToNextResponse(res);
  };
}

/**
 * Wrap the catch-all route() function.
 * Calls route(req, res, apiPath) and returns NextResponse.
 */
export async function callRoute(
  nextReq: NextRequest,
  apiPath: string,
  routeFn: (req: any, res: any, path: string) => Promise<boolean>,
  setCors: (req: any, res: any) => boolean,
): Promise<NextResponse> {
  const req = await createMockReq(nextReq);
  const res = createMockRes();

  try {
    if (setCors(req as any, res as any)) {
      return mockResToNextResponse(res);
    }

    const handled = await routeFn(req as any, res as any, apiPath);
    if (!handled) {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (e: any) {
    console.error('[handler-adapter] route error:', e?.message, e?.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  return mockResToNextResponse(res);
}
