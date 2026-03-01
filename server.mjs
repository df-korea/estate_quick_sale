#!/usr/bin/env node
/**
 * Production Express server for estate_quick_sale.
 * Wraps Vercel serverless handlers into a single Express app.
 *
 * - Calls route() directly instead of going through handler.js
 *   (handler.js sets req.query which is read-only in Express 5)
 * - Mounts auth & toss handlers on dedicated routes
 * - Serves frontend static files with SPA fallback
 *
 * Usage: node server.mjs
 * Listens on 127.0.0.1:3001 (Cloudflare Tunnel handles external access)
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const PORT = parseInt(process.env.PORT || '3001', 10);

const app = express();
app.use(compression());
app.use(express.json());

// ── Vercel-compatible req/res adapter ──

function adaptHandler(vercelHandler) {
  return async (req, res) => {
    try {
      await vercelHandler(req, res);
    } catch (e) {
      console.error('[server] handler error:', e);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

// ── Import handlers ──
// Import route() directly — bypasses handler.js which sets req.query (read-only in Express 5)

const { route } = await import('./api/_lib/routes.js');
const { setCors } = await import('./api/_lib/cors.js');
const { default: loginHandler } = await import('./api/auth/login.js');
const { default: logoutHandler } = await import('./api/auth/logout.js');
const { default: meHandler } = await import('./api/auth/me.js');
const { default: disconnectHandler } = await import('./api/toss/disconnect.js');

// ── Auth routes (dedicated) ──

app.all('/api/auth/login', adaptHandler(loginHandler));
app.all('/api/auth/logout', adaptHandler(logoutHandler));
app.all('/api/auth/me', adaptHandler(meHandler));

// ── Toss routes ──

app.all('/api/toss/disconnect', adaptHandler(disconnectHandler));

// ── Catch-all API route ──
// Calls route() directly with the path extracted from the URL

app.all('/api/{*path}', async (req, res, next) => {
  try {
    if (setCors(req, res)) return;

    // Express 5 {*path} returns an array of segments
    const segments = Array.isArray(req.params.path)
      ? req.params.path.join('/')
      : (req.params.path || '');
    const apiPath = '/' + segments;
    const handled = await route(req, res, apiPath);
    if (!handled) {
      res.status(404).json({ error: 'Not found' });
    }
  } catch (e) {
    console.error('[server] route error:', e.message, e.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// ── Static files (frontend) ──

// granite build → dist/web/, vite build → dist/ — use whichever exists
import fs from 'fs';
const distWeb = path.join(__dirname, 'apps', 'miniapp', 'dist', 'web');
const distFlat = path.join(__dirname, 'apps', 'miniapp', 'dist');
const distDir = fs.existsSync(path.join(distWeb, 'index.html')) ? distWeb : distFlat;

// Hashed assets (e.g. /assets/index-abc123.js) → cache 1 year
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Other static files → no-cache (always revalidate)
app.use(express.static(distDir, {
  maxAge: 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// SPA fallback: any non-API route serves index.html
app.get('{*path}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(distDir, 'index.html'));
});

// ── Start ──

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[estate-api] listening on 127.0.0.1:${PORT}`);
  console.log(`[estate-api] static files: ${distDir}`);
  console.log(`[estate-api] PGHOST=${process.env.PGHOST || 'localhost'}`);
});
