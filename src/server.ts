import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Local secrets (INVENTREE_URL / INVENTREE_TOKEN). In production, set real env vars instead.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const INVENTREE_URL = (process.env['INVENTREE_URL'] ?? '').replace(/\/+$/, '');
const INVENTREE_TOKEN = process.env['INVENTREE_TOKEN'] ?? '';
const PROXY_TIMEOUT_MS = 20_000;
const FORWARDED_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'] as const;

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Read-only InvenTree proxy.
 *
 * The browser calls `/inventree/api/...` and `/inventree/media/...` on this origin; the server
 * forwards them to INVENTREE_URL with the API token attached. The token never reaches the
 * browser and no CORS configuration is needed on InvenTree. Only GET is forwarded.
 */
app.get('/inventree/{*path}', async (req, res) => {
  if (!INVENTREE_URL || !INVENTREE_TOKEN) {
    res.status(503).json({ detail: 'InvenTree proxy is not configured (set INVENTREE_URL and INVENTREE_TOKEN).' });
    return;
  }

  const upstreamPath = req.originalUrl.replace(/^\/inventree/, '');
  if (!/^\/(api|media)\//.test(upstreamPath)) {
    res.status(404).json({ detail: 'Not found.' });
    return;
  }

  try {
    const upstream = await fetch(`${INVENTREE_URL}${upstreamPath}`, {
      headers: {
        Authorization: `Token ${INVENTREE_TOKEN}`,
        Accept: req.get('accept') ?? 'application/json',
      },
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });

    res.status(upstream.status);
    for (const header of FORWARDED_HEADERS) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.status(502).json({ detail: 'InvenTree is unreachable from the dashboard server.' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
