import {
  getAllSessions,
  getSessionById,
  saveSession,
  updateSessionTitle,
  togglePinSession,
  deleteSession,
  clearAllSessions,
  importSessions,
  getAllCourses,
  getCourseById,
  saveCourse,
  deleteCourse,
  clearAllCourses,
  toggleChapterCompletion,
  importCourses,
  getAllHistory,
  saveHistoryItem,
  deleteHistoryItem,
  clearAllHistory,
  getAllCategories,
  saveCategory,
  deleteCategory,
  clearAllCategories,
  getDbStats,
} from './db.js';

/**
 * Helper to read request JSON body
 */
export async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Safeguard: 50MB max body
      if (body.length > 50 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        if (!body.trim()) return resolve({});
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper to send JSON response
 */
export function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

/**
 * Main API Request Handler
 */
export async function handleApiRequest(req, res) {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = parsedUrl.pathname || '';
  const method = req.method ? req.method.toUpperCase() : 'GET';

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return true;
  }

  // Only handle /api/* routes
  if (!pathname.startsWith('/api/')) {
    return false;
  }

  const endpoint = pathname.replace(/^\/api/, '');

  try {
    // -------------------------------------------------------------
    // HEALTH & STATS
    // -------------------------------------------------------------
    if (endpoint === '/health' && method === 'GET') {
      const stats = getDbStats();
      sendJson(res, 200, {
        status: 'ok',
        engine: 'SQLite (node:sqlite)',
        ...stats,
      });
      return true;
    }

    // -------------------------------------------------------------
    // CHAT SESSIONS ROUTES
    // -------------------------------------------------------------
    if (endpoint === '/sessions' && method === 'GET') {
      const sessions = getAllSessions();
      sendJson(res, 200, { sessions });
      return true;
    }

    if (endpoint === '/sessions' && method === 'POST') {
      const body = await readJsonBody(req);
      const saved = saveSession(body);
      sendJson(res, 200, { session: saved });
      return true;
    }

    if (endpoint === '/sessions' && method === 'DELETE') {
      clearAllSessions();
      sendJson(res, 200, { success: true });
      return true;
    }

    if (endpoint === '/sessions/import' && method === 'POST') {
      const body = await readJsonBody(req);
      const rawList = Array.isArray(body) ? body : body.sessions || [];
      const count = importSessions(rawList);
      sendJson(res, 200, { count });
      return true;
    }

    const sessionMatch = endpoint.match(/^\/sessions\/([^/]+)$/);
    if (sessionMatch) {
      const sessionId = decodeURIComponent(sessionMatch[1]);
      if (method === 'GET') {
        const session = getSessionById(sessionId);
        if (!session) return sendJson(res, 404, { error: 'Session not found' });
        sendJson(res, 200, { session });
        return true;
      }
      if (method === 'DELETE') {
        deleteSession(sessionId);
        sendJson(res, 200, { success: true });
        return true;
      }
    }

    const sessionTitleMatch = endpoint.match(/^\/sessions\/([^/]+)\/title$/);
    if (sessionTitleMatch && (method === 'PUT' || method === 'POST')) {
      const sessionId = decodeURIComponent(sessionTitleMatch[1]);
      const body = await readJsonBody(req);
      const updated = updateSessionTitle(sessionId, body.title || '');
      sendJson(res, 200, { session: updated });
      return true;
    }

    const sessionPinMatch = endpoint.match(/^\/sessions\/([^/]+)\/pin$/);
    if (sessionPinMatch && (method === 'PUT' || method === 'POST')) {
      const sessionId = decodeURIComponent(sessionPinMatch[1]);
      const isPinned = togglePinSession(sessionId);
      sendJson(res, 200, { isPinned });
      return true;
    }

    // -------------------------------------------------------------
    // LIBRARY COURSES ROUTES
    // -------------------------------------------------------------
    if (endpoint === '/courses' && method === 'GET') {
      const courses = getAllCourses();
      sendJson(res, 200, { courses });
      return true;
    }

    if (endpoint === '/courses' && method === 'DELETE') {
      clearAllCourses();
      sendJson(res, 200, { success: true });
      return true;
    }

    if (endpoint === '/courses' && method === 'POST') {
      const body = await readJsonBody(req);
      const saved = saveCourse(body);
      sendJson(res, 200, { course: saved });
      return true;
    }

    if (endpoint === '/courses/import' && method === 'POST') {
      const body = await readJsonBody(req);
      const rawList = Array.isArray(body) ? body : body.courses || [];
      const count = importCourses(rawList);
      sendJson(res, 200, { count });
      return true;
    }

    const courseMatch = endpoint.match(/^\/courses\/([^/]+)$/);
    if (courseMatch) {
      const courseId = decodeURIComponent(courseMatch[1]);
      if (method === 'GET') {
        const course = getCourseById(courseId);
        if (!course) return sendJson(res, 404, { error: 'Course not found' });
        sendJson(res, 200, { course });
        return true;
      }
      if (method === 'DELETE') {
        deleteCourse(courseId);
        sendJson(res, 200, { success: true });
        return true;
      }
    }

    const toggleChapterMatch = endpoint.match(/^\/courses\/([^/]+)\/toggle-chapter$/);
    if (toggleChapterMatch && method === 'POST') {
      const courseId = decodeURIComponent(toggleChapterMatch[1]);
      const body = await readJsonBody(req);
      const updated = toggleChapterCompletion(courseId, body.chapterId);
      sendJson(res, 200, { course: updated });
      return true;
    }

    // -------------------------------------------------------------
    // CHAT HISTORY ROUTES (LEGACY COMPATIBILITY)
    // -------------------------------------------------------------
    if (endpoint === '/history' && method === 'GET') {
      const history = getAllHistory();
      sendJson(res, 200, { history });
      return true;
    }

    if (endpoint === '/history' && method === 'POST') {
      const body = await readJsonBody(req);
      const saved = saveHistoryItem(body);
      sendJson(res, 200, { item: saved });
      return true;
    }

    if (endpoint === '/history' && method === 'DELETE') {
      clearAllHistory();
      sendJson(res, 200, { success: true });
      return true;
    }

    const historyItemMatch = endpoint.match(/^\/history\/([^/]+)$/);
    if (historyItemMatch && method === 'DELETE') {
      const id = decodeURIComponent(historyItemMatch[1]);
      deleteHistoryItem(id);
      sendJson(res, 200, { success: true });
      return true;
    }

    // -------------------------------------------------------------
    // COURSE CATEGORIES ROUTES
    // -------------------------------------------------------------
    if (endpoint === '/categories' && method === 'GET') {
      const categories = getAllCategories();
      sendJson(res, 200, { categories });
      return true;
    }

    if (endpoint === '/categories' && method === 'POST') {
      const body = await readJsonBody(req);
      const saved = saveCategory(body);
      sendJson(res, 200, { category: saved });
      return true;
    }

    if (endpoint === '/categories' && method === 'DELETE') {
      clearAllCategories();
      sendJson(res, 200, { success: true });
      return true;
    }

    const categoryItemMatch = endpoint.match(/^\/categories\/([^/]+)$/);
    if (categoryItemMatch && method === 'DELETE') {
      const id = decodeURIComponent(categoryItemMatch[1]);
      deleteCategory(id);
      sendJson(res, 200, { success: true });
      return true;
    }

    // -------------------------------------------------------------
    // REGIONAL MULTI-LANGUAGE TTS STREAMING PROXY ROUTE
    // (Used to stream native Malayalam, Tamil, Hindi, German, Arabic, etc. audio)
    // -------------------------------------------------------------
    if (endpoint === '/tts' && method === 'GET') {
      const q = parsedUrl.searchParams.get('q') || '';
      const tl = parsedUrl.searchParams.get('tl') || 'en';

      if (!q.trim()) {
        sendJson(res, 400, { error: 'Missing text parameter q' });
        return true;
      }

      const encoded = encodeURIComponent(q.trim());
      const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(tl)}&client=tw-ob&q=${encoded}`;

      try {
        const fetchRes = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          },
        });

        if (!fetchRes.ok) {
          throw new Error(`TTS upstream error: ${fetchRes.status}`);
        }

        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(buffer);
        return true;
      } catch (streamErr) {
        console.error('[TTS Proxy Error]:', streamErr);
        sendJson(res, 502, { error: 'Failed to fetch regional TTS audio stream', message: String(streamErr) });
        return true;
      }
    }

    // -------------------------------------------------------------
    // BULK MIGRATION SYNC ROUTE
    // (Used when browser IndexedDB data is migrated into SQLite)
    // -------------------------------------------------------------
    if (endpoint === '/sync/migrate' && method === 'POST') {
      const body = await readJsonBody(req);
      let sessionsCount = 0;
      let coursesCount = 0;
      let historyCount = 0;

      if (Array.isArray(body.sessions)) {
        sessionsCount = importSessions(body.sessions);
      }
      if (Array.isArray(body.courses)) {
        coursesCount = importCourses(body.courses);
      }
      if (Array.isArray(body.history)) {
        for (const h of body.history) {
          saveHistoryItem(h);
          historyCount++;
        }
      }

      sendJson(res, 200, {
        success: true,
        migrated: {
          sessions: sessionsCount,
          courses: coursesCount,
          history: historyCount,
        },
      });
      return true;
    }

    // Unmatched API route
    sendJson(res, 404, { error: `Endpoint not found: ${method} ${pathname}` });
    return true;
  } catch (err) {
    console.error(`[API Error] ${method} ${pathname}:`, err);
    sendJson(res, 500, {
      error: 'Internal Server Error',
      message: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}
