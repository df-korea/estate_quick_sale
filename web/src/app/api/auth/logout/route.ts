import { wrapHandler } from '@/lib/handler-adapter';
import handler from '@api/auth/logout.js';

const handle: ReturnType<typeof wrapHandler> = wrapHandler(handler);

export const POST = handle;
export const OPTIONS = handle;
