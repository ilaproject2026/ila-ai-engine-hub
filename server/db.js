import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE_PATH = path.join(DATA_DIR, 'course_creator.db');

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_FILE_PATH);
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function getDatabasePath() {
  return DB_FILE_PATH;
}

function initSchema(db) {
  // Optimize SQLite PRAGMAs for concurrency and performance
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      course_plan TEXT,
      attached_documents TEXT,
      messages TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_pinned ON chat_sessions(is_pinned DESC, updated_at DESC);

    CREATE TABLE IF NOT EXISTS library_courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT,
      category TEXT,
      overview TEXT,
      total_chapters INTEGER DEFAULT 0,
      chapters TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      source_session_id TEXT,
      tags TEXT,
      is_favorite INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_courses_updated ON library_courses(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_courses_favorite ON library_courses(is_favorite DESC, updated_at DESC);

    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      query TEXT NOT NULL,
      response TEXT NOT NULL,
      model TEXT,
      model_display_name TEXT,
      timestamp INTEGER NOT NULL,
      response_time_ms INTEGER,
      is_favorite INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_history_timestamp ON chat_history(timestamp DESC);

    CREATE TABLE IF NOT EXISTS course_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      department TEXT,
      description TEXT,
      color TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_categories_updated ON course_categories(updated_at DESC);
  `);
}

// -------------------------------------------------------------
// CHAT SESSIONS OPERATIONS
// -------------------------------------------------------------

export function getAllSessions() {
  const db = getDatabase();
  const query = db.prepare(`
    SELECT * FROM chat_sessions 
    ORDER BY is_pinned DESC, updated_at DESC
  `);
  const rows = query.all();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPinned: Boolean(row.is_pinned),
    coursePlan: row.course_plan ? JSON.parse(row.course_plan) : undefined,
    attachedDocuments: row.attached_documents ? JSON.parse(row.attached_documents) : [],
    messages: row.messages ? JSON.parse(row.messages) : [],
  }));
}

export function getSessionById(id) {
  const db = getDatabase();
  const query = db.prepare(`SELECT * FROM chat_sessions WHERE id = ?`);
  const row = query.get(id);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPinned: Boolean(row.is_pinned),
    coursePlan: row.course_plan ? JSON.parse(row.course_plan) : undefined,
    attachedDocuments: row.attached_documents ? JSON.parse(row.attached_documents) : [],
    messages: row.messages ? JSON.parse(row.messages) : [],
  };
}

export function saveSession(session) {
  const db = getDatabase();
  const now = Date.now();
  const id = session.id || `session_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const title = session.title || 'New Course Workspace';
  const createdAt = session.createdAt || now;
  const updatedAt = session.updatedAt || now;
  const isPinned = session.isPinned ? 1 : 0;
  const coursePlan = session.coursePlan ? JSON.stringify(session.coursePlan) : null;
  const attachedDocuments = JSON.stringify(session.attachedDocuments || []);
  const messages = JSON.stringify(session.messages || []);

  const stmt = db.prepare(`
    INSERT INTO chat_sessions (id, title, created_at, updated_at, is_pinned, course_plan, attached_documents, messages)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      updated_at = excluded.updated_at,
      is_pinned = excluded.is_pinned,
      course_plan = excluded.course_plan,
      attached_documents = excluded.attached_documents,
      messages = excluded.messages
  `);

  stmt.run(id, title, createdAt, updatedAt, isPinned, coursePlan, attachedDocuments, messages);

  return {
    id,
    title,
    createdAt,
    updatedAt,
    isPinned: Boolean(isPinned),
    coursePlan: session.coursePlan,
    attachedDocuments: session.attachedDocuments || [],
    messages: session.messages || [],
  };
}

export function updateSessionTitle(id, newTitle) {
  const db = getDatabase();
  const updatedAt = Date.now();
  const stmt = db.prepare(`
    UPDATE chat_sessions
    SET title = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(newTitle.trim() || 'Untitled Course', updatedAt, id);
  return getSessionById(id);
}

export function togglePinSession(id) {
  const db = getDatabase();
  const session = getSessionById(id);
  if (!session) return null;
  const newPinned = session.isPinned ? 0 : 1;
  const updatedAt = Date.now();
  const stmt = db.prepare(`
    UPDATE chat_sessions
    SET is_pinned = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(newPinned, updatedAt, id);
  return Boolean(newPinned);
}

export function deleteSession(id) {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM chat_sessions WHERE id = ?`);
  stmt.run(id);
  return true;
}

export function clearAllSessions() {
  const db = getDatabase();
  db.exec(`DELETE FROM chat_sessions`);
  return true;
}

export function importSessions(sessions) {
  const db = getDatabase();
  let count = 0;
  if (!Array.isArray(sessions)) return 0;

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const session of sessions) {
      if (session && session.id && Array.isArray(session.messages)) {
        saveSession(session);
        count++;
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
  return count;
}

// -------------------------------------------------------------
// LIBRARY COURSES OPERATIONS
// -------------------------------------------------------------

export function getAllCourses() {
  const db = getDatabase();
  const query = db.prepare(`
    SELECT * FROM library_courses 
    ORDER BY is_favorite DESC, updated_at DESC
  `);
  const rows = query.all();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    overview: row.overview,
    totalChapters: row.total_chapters,
    chapters: row.chapters ? JSON.parse(row.chapters) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceSessionId: row.source_session_id,
    tags: row.tags ? JSON.parse(row.tags) : [],
    isFavorite: Boolean(row.is_favorite),
  }));
}

export function getCourseById(id) {
  const db = getDatabase();
  const query = db.prepare(`SELECT * FROM library_courses WHERE id = ?`);
  const row = query.get(id);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    category: row.category,
    overview: row.overview,
    totalChapters: row.total_chapters,
    chapters: row.chapters ? JSON.parse(row.chapters) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceSessionId: row.source_session_id,
    tags: row.tags ? JSON.parse(row.tags) : [],
    isFavorite: Boolean(row.is_favorite),
  };
}

export function saveCourse(course) {
  const db = getDatabase();
  const now = Date.now();
  const id = course.id || `course_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const title = course.title || 'Masterclass Course';
  const subtitle = course.subtitle || '';
  const category = course.category || 'Enterprise Education';
  const overview = course.overview || '';
  const totalChapters = course.chapters ? course.chapters.length : 0;
  const chapters = JSON.stringify(course.chapters || []);
  const createdAt = course.createdAt || now;
  const updatedAt = course.updatedAt || now;
  const sourceSessionId = course.sourceSessionId || null;
  const tags = JSON.stringify(course.tags || []);
  const isFavorite = course.isFavorite ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO library_courses (id, title, subtitle, category, overview, total_chapters, chapters, created_at, updated_at, source_session_id, tags, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      subtitle = excluded.subtitle,
      category = excluded.category,
      overview = excluded.overview,
      total_chapters = excluded.total_chapters,
      chapters = excluded.chapters,
      updated_at = excluded.updated_at,
      source_session_id = excluded.source_session_id,
      tags = excluded.tags,
      is_favorite = excluded.is_favorite
  `);

  stmt.run(id, title, subtitle, category, overview, totalChapters, chapters, createdAt, updatedAt, sourceSessionId, tags, isFavorite);

  return {
    id,
    title,
    subtitle,
    category,
    overview,
    totalChapters,
    chapters: course.chapters || [],
    createdAt,
    updatedAt,
    sourceSessionId,
    tags: course.tags || [],
    isFavorite: Boolean(isFavorite),
  };
}

export function deleteCourse(id) {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM library_courses WHERE id = ?`);
  stmt.run(id);
  return true;
}

export function clearAllCourses() {
  const db = getDatabase();
  db.exec(`DELETE FROM library_courses`);
  return true;
}

export function toggleChapterCompletion(courseId, chapterId) {
  const course = getCourseById(courseId);
  if (!course) return null;

  course.chapters = course.chapters.map((ch) =>
    ch.id === chapterId ? { ...ch, isCompleted: !ch.isCompleted } : ch
  );
  course.updatedAt = Date.now();
  return saveCourse(course);
}

export function importCourses(courses) {
  const db = getDatabase();
  let count = 0;
  if (!Array.isArray(courses)) return 0;

  db.exec('BEGIN TRANSACTION;');
  try {
    for (const course of courses) {
      if (course && course.id && Array.isArray(course.chapters)) {
        saveCourse(course);
        count++;
      }
    }
    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
  return count;
}

// -------------------------------------------------------------
// CHAT HISTORY (LEGACY COMPATIBILITY)
// -------------------------------------------------------------

export function getAllHistory() {
  const db = getDatabase();
  const query = db.prepare(`SELECT * FROM chat_history ORDER BY timestamp DESC`);
  const rows = query.all();
  return rows.map((row) => ({
    id: row.id,
    query: row.query,
    response: row.response,
    model: row.model,
    modelDisplayName: row.model_display_name,
    timestamp: row.timestamp,
    responseTimeMs: row.response_time_ms,
    isFavorite: Boolean(row.is_favorite),
  }));
}

export function saveHistoryItem(item) {
  const db = getDatabase();
  const id = item.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const query = item.query || '';
  const response = item.response || '';
  const model = item.model || '';
  const modelDisplayName = item.modelDisplayName || '';
  const timestamp = item.timestamp || Date.now();
  const responseTimeMs = item.responseTimeMs || 0;
  const isFavorite = item.isFavorite ? 1 : 0;

  const stmt = db.prepare(`
    INSERT INTO chat_history (id, query, response, model, model_display_name, timestamp, response_time_ms, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      query = excluded.query,
      response = excluded.response,
      model = excluded.model,
      model_display_name = excluded.model_display_name,
      timestamp = excluded.timestamp,
      response_time_ms = excluded.response_time_ms,
      is_favorite = excluded.is_favorite
  `);

  stmt.run(id, query, response, model, modelDisplayName, timestamp, responseTimeMs, isFavorite);

  return {
    id,
    query,
    response,
    model,
    modelDisplayName,
    timestamp,
    responseTimeMs,
    isFavorite: Boolean(isFavorite),
  };
}

export function deleteHistoryItem(id) {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM chat_history WHERE id = ?`);
  stmt.run(id);
  return true;
}

export function clearAllHistory() {
  const db = getDatabase();
  db.exec(`DELETE FROM chat_history`);
  return true;
}

// -------------------------------------------------------------
// COURSE CATEGORIES OPERATIONS
// -------------------------------------------------------------

export function getAllCategories() {
  const db = getDatabase();
  const query = db.prepare(`SELECT * FROM course_categories ORDER BY name ASC`);
  const rows = query.all();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    department: row.department || '',
    description: row.description || '',
    color: row.color || '#38bdf8',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function saveCategory(category) {
  const db = getDatabase();
  const now = Date.now();
  const id = category.id || `cat_${now}_${Math.random().toString(36).substring(2, 9)}`;
  const name = (category.name || '').trim();
  const department = (category.department || '').trim();
  const description = (category.description || '').trim();
  const color = category.color || '#38bdf8';
  const createdAt = category.createdAt || now;
  const updatedAt = category.updatedAt || now;

  const stmt = db.prepare(`
    INSERT INTO course_categories (id, name, department, description, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      department = excluded.department,
      description = excluded.description,
      color = excluded.color,
      updated_at = excluded.updated_at
  `);

  stmt.run(id, name, department, description, color, createdAt, updatedAt);

  return {
    id,
    name,
    department,
    description,
    color,
    createdAt,
    updatedAt,
  };
}

export function deleteCategory(id) {
  const db = getDatabase();
  const stmt = db.prepare(`DELETE FROM course_categories WHERE id = ?`);
  stmt.run(id);
  return true;
}

export function clearAllCategories() {
  const db = getDatabase();
  db.exec(`DELETE FROM course_categories`);
  return true;
}

// -------------------------------------------------------------
// STATS & DIAGNOSTICS
// -------------------------------------------------------------

export function getDbStats() {
  const db = getDatabase();
  const sessionsCount = db.prepare(`SELECT COUNT(*) AS count FROM chat_sessions`).get()?.count || 0;
  const coursesCount = db.prepare(`SELECT COUNT(*) AS count FROM library_courses`).get()?.count || 0;
  const historyCount = db.prepare(`SELECT COUNT(*) AS count FROM chat_history`).get()?.count || 0;
  const categoriesCount = db.prepare(`SELECT COUNT(*) AS count FROM course_categories`).get()?.count || 0;

  let fileSizeBytes = 0;
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      fileSizeBytes = fs.statSync(DB_FILE_PATH).size;
    }
  } catch {
    // Ignore stat error
  }

  return {
    dbPath: DB_FILE_PATH,
    relativeDbPath: 'data/course_creator.db',
    fileSizeBytes,
    sessionsCount,
    coursesCount,
    historyCount,
    categoriesCount,
  };
}
