import { wrapHandler } from '@/lib/handler-adapter';
import handler from '@api/auth/me.js';

const handle: ReturnType<typeof wrapHandler> = wrapHandler(handler);

export const GET = handle;
export const OPTIONS = handle;
