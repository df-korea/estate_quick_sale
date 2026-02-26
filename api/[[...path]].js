import { setCors } from './_lib/cors.js';
import { route } from './_lib/routes.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  // Build path from URL, stripping /api prefix
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/^\/api\/?/, '/').replace(/\/+/g, '/') || '/';

  // Remove catch-all 'path' key from query so handlers only see real query params
  const { path: _, ...query } = req.query;
  req.query = query;

  const handled = await route(req, res, path);
  if (!handled) {
    res.status(404).json({ error: 'Not found' });
  }
}
