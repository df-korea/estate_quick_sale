import { wrapHandler } from '@/lib/handler-adapter';
import handler from '@api/toss/disconnect.js';

const handle: ReturnType<typeof wrapHandler> = wrapHandler(handler);

export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
