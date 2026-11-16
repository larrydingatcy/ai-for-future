// Serve the static export (out/) under the basePath, like GitHub Pages does.
// Usage: npm run serve  →  http://localhost:3000/ai-for-future/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? '/ai-for-future').replace(/\/$/, '');
const PORT = Number(process.env.PORT ?? 3000);
const ROOT = path.resolve('out');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (BASE && !url.startsWith(`${BASE}/`) && url !== BASE) {
      res.writeHead(302, { Location: `${BASE}/` });
      return res.end();
    }
    let rel = url.slice(BASE.length) || '/';
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) return res.writeHead(403).end();
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) {
      file = path.join(ROOT, '404.html');
      res.statusCode = 404;
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => console.log(`Serving out/ at http://localhost:${PORT}${BASE}/`));
