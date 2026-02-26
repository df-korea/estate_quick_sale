import { setCors } from './_lib/cors.js';
import { route } from './_lib/routes.js';

export default async function handler(req, res) {
  if (setCors(req, res)) return;

  // Path comes from vercel.json rewrite: /api/:path(.*) → /api/handler?__path=:path
  const apiPath = '/' + (req.query.__path || '');

  // Remove __path from query so handlers only see real query params
  const { __path, ...query } = req.query;
  req.query = query;

  const handled = await route(req, res, apiPath);
  if (!handled) {
    res.status(404).json({ error: 'Not found' });
  }
}
