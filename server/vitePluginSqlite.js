import { handleApiRequest } from './api.js';

/**
 * Vite plugin that intercepts /api/* calls and routes them to the local SQLite database
 */
export function vitePluginSqlite() {
  return {
    name: 'vite-plugin-sqlite',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          try {
            const handled = await handleApiRequest(req, res);
            if (handled) return;
          } catch (err) {
            console.error('[Vite SQLite Plugin Error]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database server error', message: String(err) }));
            return;
          }
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/')) {
          try {
            const handled = await handleApiRequest(req, res);
            if (handled) return;
          } catch (err) {
            console.error('[Vite Preview SQLite Plugin Error]:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Database server error', message: String(err) }));
            return;
          }
        }
        next();
      });
    },
  };
}
