import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { handleApiRequest } from './api.js';
import { getDatabasePath, getDbStats } from './db.js';

const PORT = process.env.PORT || 3001;
const DIST_DIR = path.resolve(process.cwd(), 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (req, res) => {
  // 1. Check if it is an /api/ request
  if (req.url && req.url.startsWith('/api/')) {
    const handled = await handleApiRequest(req, res);
    if (handled) return;
  }

  // 2. Otherwise serve static files from dist/ if it exists
  if (fs.existsSync(DIST_DIR)) {
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Fallback response if dist is not built yet
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <body style="font-family: sans-serif; padding: 2rem; background: #0b0f19; color: #f3f4f6;">
        <h2>Ila Course Creator - SQLite Backend Running</h2>
        <p>Database file: <code>${getDatabasePath()}</code></p>
        <p>Run <code>npm run dev</code> for the full Vite development environment.</p>
      </body>
    </html>
  `);
});

server.listen(PORT, () => {
  const stats = getDbStats();
  console.log(`\n======================================================`);
  console.log(`🚀 Ila Course Creator Backend Server Ready`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`💾 SQLite Database File: ${stats.dbPath}`);
  console.log(`📊 Current Sessions: ${stats.sessionsCount}, Courses: ${stats.coursesCount}`);
  console.log(`======================================================\n`);
});
