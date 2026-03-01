import { NextRequest } from 'next/server';
import { callRoute } from '@/lib/handler-adapter';
import { route } from '@api/_lib/routes.js';
import { setCors } from '@api/_lib/cors.js';

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = '/' + path.join('/');
  return callRoute(req, apiPath, route, setCors);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const OPTIONS = handler;
