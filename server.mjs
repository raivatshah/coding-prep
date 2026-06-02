import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchProblem,
  fetchRecent,
  hasLeetcodeCsrfToken,
  hasLeetcodeSession,
  normalizeLookbackDays
} from './api/_lib/leetcode-api.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8765);

const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.ico', 'image/x-icon']
]);

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === '/api/health') {
      json(res, 200, {
        ok: true,
        port: PORT,
        leetcodeSessionConfigured: hasLeetcodeSession(),
        csrfConfigured: hasLeetcodeCsrfToken()
      });
      return;
    }

    if (url.pathname === '/api/leetcode/problem') {
      const slug = (url.searchParams.get('slug') || '').trim();
      if (!slug) {
        json(res, 400, { error: 'Missing slug' });
        return;
      }
      json(res, 200, { problem: await fetchProblem(slug) });
      return;
    }

    if (url.pathname === '/api/leetcode/recent') {
      const username = (url.searchParams.get('username') || '').trim();
      const days = normalizeLookbackDays(url.searchParams.get('days'));
      if (!username) {
        json(res, 400, { error: 'Missing username' });
        return;
      }
      json(res, 200, await fetchRecent(username, days));
      return;
    }

    json(res, 404, { error: 'Unknown API route' });
  } catch (error) {
    json(res, 502, { error: error.message || 'LeetCode sync failed' });
  }
}

async function serveStatic(req, res, url) {
  const requestedPath = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));
  const rootPrefix = ROOT.endsWith(path.sep) ? ROOT : `${ROOT}${path.sep}`;

  if (filePath !== ROOT && !filePath.startsWith(rootPrefix)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const file = await stat(filePath);
    if (!file.isFile()) throw new Error('Not a file');
    res.writeHead(200, {
      'content-type': MIME_TYPES.get(path.extname(filePath)) || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`);
  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, url);
    return;
  }
  await serveStatic(req, res, url);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Coding prep running at http://127.0.0.1:${PORT}/index.html`);
});
