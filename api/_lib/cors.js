const ALLOWED_ORIGINS = [
  'https://estate-quick-sale.apps.tossmini.com',
  'https://estate-quick-sale.private-apps.tossmini.com',
  'https://estate-rader.com',
  'https://www.estate-rader.com',
];

export function setCors(req, res) {
  const origin = req.headers.origin;
  if (!origin || ALLOWED_ORIGINS.includes(origin)) {
    // Allow: listed origins + no-origin requests (Toss WebView, server-to-server)
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
