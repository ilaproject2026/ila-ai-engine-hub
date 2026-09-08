import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface AttachedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // extracted text content
  dataUrl?: string; // optional preview URL
  uploadedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  modelDisplayName?: string;
  responseTimeMs?: number;
  documents?: AttachedDocument[];
  groundingSources?: Array<{ title: string; url: string; snippet?: string }>;
  nextModuleInfo?: {
    moduleNumber: number;
    title: string;
    description?: string;
  };
}

export interface CoursePlanModule {
  moduleNumber: number;
  title: string;
  summary: string;
  subTopics?: string[];
  status: 'completed' | 'generating' | 'ready' | 'pending';
}

export interface CoursePlan {
  title: string;
  subtitle?: string;
  totalModules: number;
  modules: CoursePlanModule[];
  createdAt: number;
  updatedAt: number;
}

export interface AutonomousTaskStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  type: 'blueprint' | 'book_generation' | 'synthesis';
  bookNumber?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  progressPercent?: number;
  error?: string;
  resultSummary?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface AutonomousCoursePlan {
  id: string;
  prompt: string;
  courseTitle: string;
  courseSubtitle: string;
  totalSteps: number;
  currentStepIndex: number;
  status: 'planning' | 'executing' | 'completed' | 'paused' | 'error';
  steps: AutonomousTaskStep[];
  startedAt: number;
  completedAt?: number;
}

export interface LearnerCategoryOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  badgeColor: string;
}

export interface CourseCategory {
  id: string;
  name: string;
  department?: string;
  description?: string;
  color?: string;
  createdAt?: number;
  updatedAt?: number;
}

export const LEARNER_CATEGORIES: LearnerCategoryOption[] = [
  {
    id: 'all_categories',
    name: 'All Departments & Categories (Batch Generate)',
    description: 'Autonomous generation of tailored variations across all 5 key departments, saving distinct blocks in the library.',
    icon: 'Layers',
    badgeColor: '#ec4899',
  },
  {
    id: 'executive_business',
    name: 'Enterprises & Business Leaders',
    description: 'Strategic ROI, corporate negotiations, enterprise governance, risk mitigation, and executive decision frameworks.',
    icon: 'Briefcase',
    badgeColor: '#a855f7',
  },
  {
    id: 'doctor_healthcare',
    name: 'Doctors & Healthcare Specialists',
    description: 'Clinical efficacy, patient communication, medical terminology, diagnosis, medical reports (Arztbriefe), and exam preparation.',
    icon: 'Stethoscope',
    badgeColor: '#ec4899',
  },
  {
    id: 'finance_operations',
    name: 'Finance & Operations Specialists',
    description: 'IFRS/HGB accounting, fiscal audits, banking regulations, valuation models, risk management, and balance sheet impacts.',
    icon: 'BarChart',
    badgeColor: '#10b981',
  },
  {
    id: 'teachers_academia',
    name: 'Teachers & Academic Researchers',
    description: 'Academic discourse, scientific methodology, university entrance standards (TestDaF/IELTS), and peer-reviewed publishing.',
    icon: 'BookOpen',
    badgeColor: '#6366f1',
  },
  {
    id: 'general_career',
    name: 'General Students & Career Professionals',
    description: 'Foundational language fluency, structured communicative competence (CEFR A1–B2), and career readiness coaching.',
    icon: 'GraduationCap',
    badgeColor: '#38bdf8',
  },
];

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  attachedDocuments?: AttachedDocument[];
  isPinned?: boolean;
  coursePlan?: CoursePlan;
  autonomousPlan?: AutonomousCoursePlan;
  studiedBy?: string; // e.g. "Doctor", "Engineer", "IT Professional", etc.
  targetAudience?: string;
  authorizedStructure?: any;
}

// Sub-topic within a chapter in the Library (e.g. 1.1, 1.2)
export interface CourseSubTopic {
  id: string;
  topicNumber: string;
  title: string;
  summary?: string;
}

// Chapter within a Library Course
export interface CourseChapter {
  id: string;
  chapterNumber: number;
  title: string;
  summary?: string;
  subTopics?: CourseSubTopic[];
  content: string; // Detailed educational text/markdown with screenshots, exercises, workflows
  isCompleted?: boolean;
}

// Course Version Snapshot for Local Version History & Auto-Save
export interface CourseVersion {
  id: string;
  versionNumber: string; // e.g. "v1.0", "v1.1", "v2.0"
  timestamp: number;
  label?: string;
  chaptersSnapshot: CourseChapter[];
  autoSaved?: boolean;
}

// Slide Item for Slide + AI Masterclass Library
export interface LibrarySlideItem {
  id: string;
  slideNumber: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  bullets: string[];
  keyTakeaway: string;
  speakerNotes: string;
  sourceHeadingAnchor?: string;
  codeSnippet?: {
    language: string;
    code: string;
  };
  tableData?: {
    headers: string[];
    rows: string[][];
  };
}

// Slide + AI Library Course Structured Data
export interface SlideAiCourseData {
  courseId: string;
  slideDecksByChapter: Record<number, LibrarySlideItem[]>;
  activeSlideIndex?: number;
  updatedAt: number;
}

// IntelliCoach AI Interactive Data
export interface IntelliCoachCourseData {
  courseId: string;
  dialogueHistoryByChapter?: Record<number, Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    topicNumber?: string;
  }>>;
  lastVideoTimestampSeconds?: number;
  updatedAt: number;
}

// Admin Library Full Authoring & Versioning Data
export interface AdminLibraryCourseData {
  courseId: string;
  fullMarkdownContent: string;
  versionSnapshots: CourseVersion[];
  lastExportedDocx?: number;
  curriculumStandards?: any;
  updatedAt: number;
}

// Course stored in the dedicated Library
export interface LibraryCourse {
  id: string;
  title: string;
  subtitle: string;
  category?: string;
  overview: string;
  totalChapters: number;
  chapters: CourseChapter[];
  createdAt: number;
  updatedAt: number;
  sourceSessionId?: string;
  tags?: string[];
  isFavorite?: boolean;
  versions?: CourseVersion[];
  activeVersionNumber?: string;
  studiedBy?: string; // e.g. "Doctor", "Engineer", "IT Professional", etc.
  targetAudience?: string;
  authorizedStructure?: any;
  // Multi-Library Structured Instances
  adminCourseData?: AdminLibraryCourseData;
  slideAiCourseData?: SlideAiCourseData;
  intelliCoachCourseData?: IntelliCoachCourseData;
}

// Backwards-compatible ChatHistoryItem for single interactions
export interface ChatHistoryItem {
  id: string;
  query: string;
  response: string;
  model: string;
  modelDisplayName: string;
  timestamp: number;
  responseTimeMs?: number;
  isFavorite?: boolean;
}

export interface DbStatusInfo {
  isConnected: boolean;
  engine: string;
  dbPath: string;
  relativeDbPath: string;
  sessionsCount: number;
  coursesCount: number;
  fileSizeBytes?: number;
}

/* =========================================================================
   LOCAL INDEXEDDB FALLBACK SCHEMA & HELPERS
   ========================================================================= */

interface VelaDBSchema extends DBSchema {
  chat_sessions: {
    key: string;
    value: ChatSession;
    indexes: {
      'by-updated': number;
      'by-created': number;
      'by-title': string;
    };
  };
  chat_history: {
    key: string;
    value: ChatHistoryItem;
    indexes: {
      'by-timestamp': number;
      'by-model': string;
      'by-query': string;
    };
  };
  library_courses: {
    key: string;
    value: LibraryCourse;
    indexes: {
      'by-updated': number;
      'by-created': number;
      'by-title': string;
    };
  };
  course_categories: {
    key: string;
    value: CourseCategory;
    indexes: {
      'by-updated': number;
      'by-name': string;
    };
  };
}

const DB_NAME = 'VelaIlaCourseCreatorDB';
const DB_VERSION = 4;
const SESSIONS_STORE = 'chat_sessions';
const HISTORY_STORE = 'chat_history';
const LIBRARY_STORE = 'library_courses';
const CATEGORIES_STORE = 'course_categories';

let idbPromise: Promise<IDBPDatabase<VelaDBSchema>> | null = null;

async function getLocalIDB(): Promise<IDBPDatabase<VelaDBSchema>> {
  if (!idbPromise) {
    idbPromise = openDB<VelaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
          sessionsStore.createIndex('by-updated', 'updatedAt');
          sessionsStore.createIndex('by-created', 'createdAt');
          sessionsStore.createIndex('by-title', 'title');
        }
        if (!db.objectStoreNames.contains(HISTORY_STORE)) {
          const historyStore = db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
          historyStore.createIndex('by-timestamp', 'timestamp');
          historyStore.createIndex('by-model', 'model');
          historyStore.createIndex('by-query', 'query');
        }
        if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
          const libraryStore = db.createObjectStore(LIBRARY_STORE, { keyPath: 'id' });
          libraryStore.createIndex('by-updated', 'updatedAt');
          libraryStore.createIndex('by-created', 'createdAt');
          libraryStore.createIndex('by-title', 'title');
        }
        if (!db.objectStoreNames.contains(CATEGORIES_STORE)) {
          const categoriesStore = db.createObjectStore(CATEGORIES_STORE, { keyPath: 'id' });
          categoriesStore.createIndex('by-updated', 'updatedAt');
          categoriesStore.createIndex('by-name', 'name');
        }
      },
    });
  }
  return idbPromise;
}

/* =========================================================================
   API CLIENT HELPERS (SQLITE FILE BACKEND)
   ========================================================================= */

const API_BASE = '/api';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    if (!res.ok) {
      console.warn(`[SQLite API] ${options?.method || 'GET'} ${path} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[SQLite API] Network error on ${path}:`, err);
    return null;
  }
}

/**
 * Retrieves SQLite Database Health and Statistics.
 */
export async function getDbHealthInfo(): Promise<DbStatusInfo> {
  const result = await fetchApi<{
    status: string;
    engine: string;
    dbPath: string;
    relativeDbPath: string;
    sessionsCount: number;
    coursesCount: number;
    fileSizeBytes?: number;
  }>('/health');

  if (result && result.status === 'ok') {
    return {
      isConnected: true,
      engine: result.engine || 'SQLite',
      dbPath: result.dbPath || 'data/course_creator.db',
      relativeDbPath: result.relativeDbPath || 'data/course_creator.db',
      sessionsCount: result.sessionsCount || 0,
      coursesCount: result.coursesCount || 0,
      fileSizeBytes: result.fileSizeBytes,
    };
  }

  return {
    isConnected: false,
    engine: 'IndexedDB (Offline Fallback)',
    dbPath: 'IndexedDB / LocalStorage',
    relativeDbPath: 'IndexedDB',
    sessionsCount: 0,
    coursesCount: 0,
  };
}

/**
 * Checks if storage is persisted (SQLite file DB active or browser storage persisted).
 */
export async function isStoragePersisted(): Promise<boolean> {
  try {
    const health = await getDbHealthInfo();
    if (health.isConnected) return true;

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
  } catch {
    // fallback
  }
  return false;
}

/**
 * Enforces a complete, pristine clean slate for Version 6 by wiping out any
 * legacy or trial datasets cached in browser IndexedDB, LocalStorage, or SQLite.
 */
export async function enforceVersion6CleanSlate(): Promise<void> {
  if (typeof window === 'undefined') return;
  const PURGE_KEY = 'ila_v6_clean_slate_enforced_v6_0_0';
  if (localStorage.getItem(PURGE_KEY)) return;

  try {
    console.info('[Version 6 Purge] Enforcing clean slate across all storage engines...');
    // Clear SQLite
    await fetchApi<{ success: boolean }>('/courses', { method: 'DELETE' });
    await fetchApi<{ success: boolean }>('/sessions', { method: 'DELETE' });
    await fetchApi<{ success: boolean }>('/history', { method: 'DELETE' });

    // Clear IndexedDB
    const idb = await getLocalIDB();
    await idb.clear(LIBRARY_STORE);
    await idb.clear(SESSIONS_STORE);
    await idb.clear(HISTORY_STORE);

    // Clear legacy localStorage keys
    localStorage.removeItem('ila_chat_sessions_backup');
    localStorage.removeItem('ila_chat_sessions');
    localStorage.removeItem('chat_sessions');
    localStorage.removeItem('ila_saved_courses');
    localStorage.removeItem('ila_legacy_courses');
    localStorage.removeItem('ila_last_saved_session_id');

    localStorage.setItem(PURGE_KEY, 'true');
    console.info('[Version 6 Purge] Complete database and UI content purge finished.');

    window.dispatchEvent(new CustomEvent('ila_library_courses_updated', { detail: { cleared: true } }));
    window.dispatchEvent(new CustomEvent('ila_sessions_updated', { detail: { cleared: true } }));
  } catch (err) {
    console.warn('[Version 6 Purge] Note during clean slate enforcement:', err);
  }
}

if (typeof window !== 'undefined') {
  enforceVersion6CleanSlate();
}

/* =========================================================================
   CHAT SESSIONS MANAGEMENT (Multi-turn conversations & course workspaces)
   ========================================================================= */

/**
 * Intelligently extracts a clean, concise, professional course title from a raw user prompt or topic.
 * Strips conversational fluff ("Please generate...", "I want to create a course on..."),
 * strips technical instruction suffixes ("with lab exercises and interactive screens..."),
 * and formats the core subject in 3-6 clean capitalized words (max ~55 chars).
 */
export function extractSmartCourseTitle(
  rawInput: string,
  fallback: string = 'Masterclass Course'
): string {
  if (!rawInput || typeof rawInput !== 'string') return fallback;

  let cleaned = rawInput.trim();

  // Strip markdown formatting, backticks, quotes, hashes
  cleaned = cleaned
    .replace(/^["'`#*\s]+|["'`#*\s]+$/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ');

  // Iteratively strip conversational/instructional opening phrases (case-insensitive)
  const prefixPatterns = [
    /^(?:please\s+)?(?:can\s+you\s+)?(?:could\s+you\s+)?(?:i\s+(?:want|need|would\s+like)\s+(?:you\s+to\s+)?)?(?:create|generate|author|write|make|build|design|provide|produce|construct|develop|structure|teach|explain|give\s+me)\s+(?:a\s+|an\s+|the\s+)?(?:full\s+|complete\s+|comprehensive\s+|exhaustive\s+|deep\s+|detailed\s+|in-depth\s+|step-by-step\s+|4-book\s+|interactive\s+|modular\s+)?(?:course|masterclass|curriculum|curricula|learning\s+pathway|learning\s+track|guide|syllabus|training|tutorial|handbook|program|study\s+guide|blueprint|video\s+course|video\s+version|video\s+script)?\s*(?:on|for|about|regarding|in|covering|with|of|:)?\s*/i,
    /^(?:a\s+|an\s+)?(?:full\s+|complete\s+|comprehensive\s+|exhaustive\s+|deep\s+|detailed\s+|in-depth\s+|step-by-step\s+|4-book\s+)?(?:course|masterclass|curriculum|guide|syllabus|tutorial|handbook|program)\s+(?:on|for|about|in|covering|regarding|of)?\s*/i,
    /^(?:i\s+need|i\s+want|i\s+would\s+like)\s+(?:to\s+learn|to\s+study|a\s+course\s+on|a\s+masterclass\s+on)?\s*/i,
    /^(?:create|generate|author|write|make|build)\s+/i,
    /^(?:book|module)\s+\d+[:\s-]+/i,
  ];

  let previous = '';
  while (cleaned !== previous) {
    previous = cleaned;
    for (const pat of prefixPatterns) {
      cleaned = cleaned.replace(pat, '').trim();
    }
  }

  // Strip trailing instruction / feature / format specifications
  cleaned = cleaned
    .replace(/(?:\s*[,–-]\s*|\s+)(?:with|including|incorporating|featuring|focusing\s+on|along\s+with|aimed\s+at)\s+(?:deep|theoretical|hands-on|interactive|lab|certification|exercises|quizzes|exams|visual|screenshots|diagrams|case\s+studies|touchpoints|t-codes|dialogues|assessments|video|step-by-step|all\s+books|all\s+modules|grading|vocabulary|grammar).*$/i, '')
    .replace(/(?:\s*[,–-]\s*|\s+)(?:please\s+)?(?:do\s+not\s+provide|ensure\s+to|make\s+sure\s+to|write\s+the\s+complete|benchmark\s+to|detail\s+the|cover\s+everything).*$/i, '')
    .replace(/(?:\s*[,–-]\s*|\s+)(?:for\s+every\s+single|for\s+each\s+book|for\s+beginners\s+and\s+advanced).*$/i, '')
    .replace(/[.,;:!?–—\-_]+$/g, '')
    .trim();

  // If input was stripped to empty or too short, fallback
  if (!cleaned || cleaned.length < 2) {
    return fallback;
  }

  // If still very long (> 55 chars or > 7 words), condense to the first 4-6 meaningful words
  const words = cleaned.split(/\s+/);
  if (words.length > 7 || cleaned.length > 55) {
    let cutWords = words.slice(0, 6);
    const stopWords = new Set(['for', 'to', 'in', 'on', 'with', 'and', 'of', 'a', 'an', 'the', 'by', 'from', 'about', 'regarding', '&']);
    while (cutWords.length > 3 && stopWords.has(cutWords[cutWords.length - 1].toLowerCase())) {
      cutWords.pop();
    }
    cleaned = cutWords.join(' ');
  }

  // Ensure clean Title Case / Capitalization
  const formatted = cleaned
    .split(' ')
    .map((word, idx) => {
      const lower = word.toLowerCase();
      const minorWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'from', 'by', 'in', 'of', 'with', 'vs']);
      if (idx > 0 && minorWords.has(lower)) {
        return lower;
      }
      if (word.length >= 2 && word === word.toUpperCase() && /^[A-Z0-9/_-]+$/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');

  return formatted.slice(0, 60).trim() || fallback;
}

/**
 * Extracts a clean, authoritative course title from AI markdown response content (e.g., from the main H1 / H2 header).
 */
export function extractCourseTitleFromContent(aiContent: string): string | null {
  if (!aiContent || typeof aiContent !== 'string') return null;

  const lines = aiContent.split('\n').slice(0, 25);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check for H1 or H2 headers
    const headerMatch = line.match(/^#+\s+(.+)$/);
    if (headerMatch) {
      let candidate = headerMatch[1].trim();

      // Remove bold/italic markdown marks
      candidate = candidate.replace(/[*_`#]/g, '').trim();

      // Remove leading emojis/icons
      candidate = candidate.replace(/^[\p{Emoji}\p{Extended_Pictographic}\s]+/gu, '').trim();

      // Strip common meta-headers that are NOT actual course titles
      const ignorePatterns = [
        /^authorized\s+standard/i,
        /^table\s+of\s+contents/i,
        /^executive\s+summary/i,
        /^curriculum\s+architecture\s+blueprint\s*$/i,
        /^course\s+overview\s*$/i,
        /^course\s+introduction\s*$/i,
        /^module\s+\d+\s*$/i,
        /^book\s+\d+\s*$/i,
      ];

      if (ignorePatterns.some((pat) => pat.test(candidate))) {
        continue;
      }

      candidate = candidate
        .replace(/^(?:Master\s+)?Curriculum\s+Architecture\s+Blueprint\s*(?:for|:|-)\s*/i, '')
        .replace(/^(?:Masterclass|Course|Curriculum|Learning\s+Pathway)\s*(?:on|for|:|-)\s*/i, '')
        .trim();

      if (candidate.length >= 3 && candidate.length <= 75) {
        return extractSmartCourseTitle(candidate);
      }
    }

    // Check for explicit "Course Title: ..." or "**Course Title:** ..."
    const explicitMatch = line.match(/(?:Course|Masterclass)\s+Title\s*:\s*(?:\*\*)?([^\n*]+)(?:\*\*)?/i);
    if (explicitMatch) {
      const candidate = explicitMatch[1].replace(/[*_`]/g, '').trim();
      if (candidate.length >= 3 && candidate.length <= 75) {
        return extractSmartCourseTitle(candidate);
      }
    }
  }

  return null;
}

export function createNewSessionObject(title: string = 'New Course Workspace'): ChatSession {
  const now = Date.now();
  return {
    id: `session_${now}_${Math.random().toString(36).substring(2, 9)}`,
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
    attachedDocuments: [],
    isPinned: false,
  };
}

export async function saveChatSession(session: ChatSession): Promise<ChatSession> {
  // Ensure session title is never a raw long prompt
  let cleanSessionTitle = session.title;
  if (
    cleanSessionTitle &&
    (cleanSessionTitle.startsWith('Please ') ||
      cleanSessionTitle.startsWith('Can you ') ||
      cleanSessionTitle.startsWith('I want ') ||
      cleanSessionTitle.length > 55)
  ) {
    cleanSessionTitle = extractSmartCourseTitle(cleanSessionTitle, 'Course Workspace');
  }

  const sessionToSave: ChatSession = {
    ...session,
    title: cleanSessionTitle || 'New Course Workspace',
    updatedAt: Date.now(),
  };

  // 1. Primary: Save to local SQLite database via API
  const res = await fetchApi<{ session: ChatSession }>('/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionToSave),
  });

  const finalSaved = res?.session || sessionToSave;

  // 2. Backup to IndexedDB / LocalStorage
  try {
    const idb = await getLocalIDB();
    await idb.put(SESSIONS_STORE, finalSaved);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ila_last_saved_session_id', finalSaved.id);
    }
  } catch {
    // Ignore backup failure
  }

  return finalSaved;
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  try {
    // 1. Primary: Fetch from local SQLite file backend
    const res = await fetchApi<{ sessions: ChatSession[] }>('/sessions');
    let sessions = res?.sessions || [];

    // 2. Fallback to local IndexedDB if SQLite API is unavailable
    if (!res && sessions.length === 0) {
      const idb = await getLocalIDB();
      sessions = await idb.getAllFromIndex(SESSIONS_STORE, 'by-updated');
    }

    // Sanitize any legacy session titles that might contain long raw prompt text
    sessions = sessions.map((s) => {
      if (s.title && (s.title.startsWith('Please ') || s.title.startsWith('Can you ') || s.title.length > 55)) {
        return {
          ...s,
          title: extractSmartCourseTitle(s.title, 'Course Workspace'),
        };
      }
      return s;
    });

    return sessions.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  } catch (err) {
    console.error('[dbService] Failed to get sessions:', err);
    return [];
  }
}

export async function getChatSessionById(id: string): Promise<ChatSession | undefined> {
  try {
    const res = await fetchApi<{ session: ChatSession }>(`/sessions/${encodeURIComponent(id)}`);
    if (res?.session) return res.session;

    const idb = await getLocalIDB();
    return await idb.get(SESSIONS_STORE, id);
  } catch (err) {
    console.error('[dbService] Failed to get session by id:', err);
    return undefined;
  }
}

export async function deleteChatSession(id: string): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ success: boolean }>(`/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.delete(SESSIONS_STORE, id);
  } catch {
    // ignore
  }
}

export async function clearAllChatSessions(): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ success: boolean }>('/sessions', {
    method: 'DELETE',
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.clear(SESSIONS_STORE);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('ila_chat_sessions_backup');
    }
  } catch {
    // ignore
  }
}

export async function updateChatSessionTitle(id: string, newTitle: string): Promise<void> {
  const cleanTitle = newTitle.trim() || 'Untitled Course';

  // 1. SQLite file DB
  await fetchApi<{ session: ChatSession }>(`/sessions/${encodeURIComponent(id)}/title`, {
    method: 'PUT',
    body: JSON.stringify({ title: cleanTitle }),
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    const session = await idb.get(SESSIONS_STORE, id);
    if (session) {
      session.title = cleanTitle;
      session.updatedAt = Date.now();
      await idb.put(SESSIONS_STORE, session);
    }
  } catch {
    // ignore
  }
}

export async function togglePinSession(id: string): Promise<boolean> {
  // 1. SQLite file DB
  const res = await fetchApi<{ isPinned: boolean }>(`/sessions/${encodeURIComponent(id)}/pin`, {
    method: 'PUT',
  });

  let isPinned = res?.isPinned ?? false;

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    const session = await idb.get(SESSIONS_STORE, id);
    if (session) {
      session.isPinned = !session.isPinned;
      session.updatedAt = Date.now();
      await idb.put(SESSIONS_STORE, session);
      if (res === null) isPinned = session.isPinned;
    }
  } catch {
    // ignore
  }

  return isPinned;
}

export async function searchChatSessions(searchTerm: string): Promise<ChatSession[]> {
  const allSessions = await getAllChatSessions();
  const term = searchTerm.toLowerCase().trim();
  if (!term) return allSessions;

  return allSessions.filter((session) => {
    if (session.title.toLowerCase().includes(term)) return true;
    const matchesMessage = session.messages.some((msg) =>
      msg.content.toLowerCase().includes(term)
    );
    if (matchesMessage) return true;
    const matchesDoc = session.attachedDocuments?.some((doc) =>
      doc.name.toLowerCase().includes(term) || doc.content.toLowerCase().includes(term)
    );
    if (matchesDoc) return true;
    return false;
  });
}

export async function exportAllSessionsJSON(): Promise<string> {
  const sessions = await getAllChatSessions();
  const health = await getDbHealthInfo();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'Ila Course Creator - SQLite Database',
      databasePath: health.relativeDbPath,
      totalSessions: sessions.length,
      sessions,
    },
    null,
    2
  );
}

export async function importSessionsJSON(jsonStr: string): Promise<number> {
  const data = JSON.parse(jsonStr);
  const sessions: ChatSession[] = Array.isArray(data) ? data : data.sessions || [];

  // 1. SQLite file DB
  const res = await fetchApi<{ count: number }>('/sessions/import', {
    method: 'POST',
    body: JSON.stringify({ sessions }),
  });

  const importedCount = res?.count ?? 0;

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    for (const session of sessions) {
      if (session && session.id && Array.isArray(session.messages)) {
        await idb.put(SESSIONS_STORE, session);
      }
    }
  } catch {
    // ignore
  }

  return importedCount > 0 ? importedCount : sessions.length;
}

/* =========================================================================
   DEDICATED LIBRARY COURSES & STRUCTURED CHAPTER MANAGEMENT
   ========================================================================= */

/**
 * Compiles all generated course messages in a ChatSession into a structured LibraryCourse entity.
 */
export function compileCourseFromChatSession(
  session: ChatSession,
  customTitle?: string
): LibraryCourse {
  const now = Date.now();

  // Gather all assistant messages (modules)
  const assistantMessages = session.messages.filter((m) => m.role === 'assistant');

  // 1. Derive smartest authoritative title
  let derivedTitle = '';

  if (customTitle && customTitle.trim() && !customTitle.startsWith('Please ') && !customTitle.startsWith('Can you ') && customTitle !== 'New Course Workspace') {
    derivedTitle = extractSmartCourseTitle(customTitle);
  }

  if (!derivedTitle && assistantMessages.length > 0) {
    // Attempt extraction from assistant messages (blueprint or module 1)
    for (const msg of assistantMessages) {
      const fromContent = extractCourseTitleFromContent(msg.content);
      if (fromContent) {
        derivedTitle = fromContent;
        break;
      }
    }
  }

  if (!derivedTitle) {
    const rawFallback = session.coursePlan?.title || session.title || 'Enterprise Masterclass';
    derivedTitle = extractSmartCourseTitle(rawFallback, 'Enterprise Masterclass');
  }

  const title = derivedTitle;
  const chapters: CourseChapter[] = [];

  assistantMessages.forEach((msg, idx) => {
    const rawText = msg.content;
    const lines = rawText.split('\n');

    // Detect chapter title from first header
    let chapterTitle = `Module ${idx + 1}: Core Concepts`;
    const h1 = lines.find((l) => l.startsWith('# '));
    const h2 = lines.find((l) => l.startsWith('## '));
    if (h1) chapterTitle = h1.replace(/^#\s+/, '').replace(/[*_`]/g, '').trim();
    else if (h2) chapterTitle = h2.replace(/^##\s+/, '').replace(/[*_`]/g, '').trim();

    // Clean any prompt leftovers from chapter title
    if (chapterTitle.startsWith('Please') || chapterTitle.length > 80) {
      chapterTitle = extractSmartCourseTitle(chapterTitle, `Module ${idx + 1}: Core Concepts`);
    }

    // Extract sub-topics (e.g. 1.1, 1.2, 1.3 or ### sub-headings)
    const subTopics: CourseSubTopic[] = [];
    let subIdx = 1;

    lines.forEach((l) => {
      if (l.startsWith('### ')) {
        const cleanSub = l.replace(/^###\s+/, '').replace(/[*_`]/g, '').trim();
        subTopics.push({
          id: `sub_${now}_${idx + 1}_${subIdx}`,
          topicNumber: `${idx + 1}.${subIdx}`,
          title: cleanSub,
          summary: 'Detailed topic overview and implementation',
        });
        subIdx++;
      }
    });

    // If no ### headings found, create standard subtopics
    if (subTopics.length === 0) {
      subTopics.push(
        { id: `sub_${now}_${idx + 1}_1`, topicNumber: `${idx + 1}.1`, title: 'Theoretical Foundation & Architecture' },
        { id: `sub_${now}_${idx + 1}_2`, topicNumber: `${idx + 1}.2`, title: 'Real-World Business Workflows & UI' },
        { id: `sub_${now}_${idx + 1}_3`, topicNumber: `${idx + 1}.3`, title: 'Hands-on Lab Exercise & Simulation' }
      );
    }

    chapters.push({
      id: `ch_${now}_${idx + 1}`,
      chapterNumber: idx + 1,
      title: chapterTitle,
      summary:
        lines.find((l) => l.trim().length > 25 && !l.startsWith('#'))?.slice(0, 140) ||
        'Comprehensive educational module',
      subTopics,
      content: rawText,
      isCompleted: false,
    });
  });

  // Fallback if no assistant message exists
  if (chapters.length === 0) {
    chapters.push({
      id: `ch_${now}_1`,
      chapterNumber: 1,
      title: 'Module 1: Course Overview',
      summary: 'Comprehensive curriculum introduction and initial module',
      subTopics: [
        { id: `sub_${now}_1_1`, topicNumber: '1.1', title: 'Introduction & Core Architecture' },
        { id: `sub_${now}_1_2`, topicNumber: '1.2', title: 'System Navigation & Configuration' },
      ],
      content: `# ${title}\n\nComprehensive enterprise masterclass content generated with Ila AI.`,
      isCompleted: false,
    });
  }

  return {
    id: `course_${now}_${Math.random().toString(36).substring(2, 9)}`,
    title,
    subtitle: `Comprehensive Masterclass • ${chapters.length} ${chapters.length === 1 ? 'Module' : 'Modules'}`,
    category: 'Enterprise Education',
    overview: `Complete step-by-step masterclass curriculum for ${title} created with Ila Course Creator & VELA search.`,
    totalChapters: chapters.length,
    chapters,
    createdAt: now,
    updatedAt: now,
    sourceSessionId: session.id,
    isFavorite: false,
  };
}

/**
 * Saves a LibraryCourse to SQLite database.
 */
export async function saveLibraryCourse(course: LibraryCourse): Promise<LibraryCourse> {
  // Ensure course title is clean
  let cleanCourseTitle = course.title;
  if (
    cleanCourseTitle &&
    (cleanCourseTitle.startsWith('Please ') ||
      cleanCourseTitle.startsWith('Can you ') ||
      cleanCourseTitle.length > 60)
  ) {
    cleanCourseTitle = extractSmartCourseTitle(cleanCourseTitle, 'Enterprise Masterclass');
  }

  const toSave: LibraryCourse = {
    ...course,
    title: cleanCourseTitle || 'Enterprise Masterclass',
    updatedAt: Date.now(),
  };

  // Ensure Multi-Library structured separation instances are populated
  if (!toSave.adminCourseData) {
    toSave.adminCourseData = {
      courseId: toSave.id,
      fullMarkdownContent: toSave.chapters.map((ch) => `# Book ${ch.chapterNumber}: ${ch.title}\n\n${ch.content}`).join('\n\n---\n\n'),
      versionSnapshots: toSave.versions || [],
      updatedAt: Date.now(),
    };
  }

  if (!toSave.slideAiCourseData) {
    const slideDecksByChapter: Record<number, LibrarySlideItem[]> = {};
    toSave.chapters.forEach((ch) => {
      slideDecksByChapter[ch.chapterNumber] = generateStructuredSlideItemsFromMarkdown(ch.content, toSave.title, ch.title, ch.chapterNumber);
    });
    toSave.slideAiCourseData = {
      courseId: toSave.id,
      slideDecksByChapter,
      updatedAt: Date.now(),
    };
  }

  if (!toSave.intelliCoachCourseData) {
    toSave.intelliCoachCourseData = {
      courseId: toSave.id,
      dialogueHistoryByChapter: {},
      updatedAt: Date.now(),
    };
  }

  // 1. SQLite file DB
  const res = await fetchApi<{ course: LibraryCourse }>('/courses', {
    method: 'POST',
    body: JSON.stringify(toSave),
  });

  const finalSaved = res?.course || toSave;

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.put(LIBRARY_STORE, finalSaved);
  } catch {
    // ignore
  }

  // Real-time Master-Slave Synchronization notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ila_library_courses_updated', { detail: { courseId: finalSaved.id } }));
  }

  return finalSaved;
}

/**
 * Batch Department Generation: Creates and saves customized variations of a course across selected departments
 * in LEARNER_CATEGORIES directly into the Admin Library.
 */
export async function batchGenerateAndSaveDepartmentCourses(
  baseCourseOrSession: LibraryCourse | ChatSession,
  customTitle?: string,
  targetDepartmentIds?: string[]
): Promise<LibraryCourse[]> {
  const baseCourse: LibraryCourse =
    'chapters' in baseCourseOrSession
      ? baseCourseOrSession
      : compileCourseFromChatSession(baseCourseOrSession, customTitle);

  const savedCourses: LibraryCourse[] = [];
  const categoriesToGenerate = LEARNER_CATEGORIES.filter((c) => {
    if (c.id === 'all_categories') return false;
    if (targetDepartmentIds && targetDepartmentIds.length > 0) {
      if (targetDepartmentIds.includes('all_categories')) return true;
      return targetDepartmentIds.includes(c.id);
    }
    return true;
  });

  for (const cat of categoriesToGenerate) {
    const tailoredTitle = `${baseCourse.title} (${cat.name})`;
    const tailoredChapters = baseCourse.chapters.map((ch) => ({
      ...ch,
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: `${ch.title} - ${cat.name} Edition`,
      summary: `${ch.summary || ''} (Tailored for ${cat.name})`,
      content: `# Book ${ch.chapterNumber}: ${ch.title} (${cat.name} Track)\n\n> **Target Department**: ${cat.name}\n> **Domain Focus**: ${cat.description}\n\n${ch.content}`,
    }));

    const tailoredCourse: LibraryCourse = {
      ...baseCourse,
      id: `course_${Date.now()}_${cat.id}_${Math.random().toString(36).substring(2, 7)}`,
      title: tailoredTitle,
      subtitle: `${baseCourse.subtitle || 'Comprehensive Masterclass'} • ${cat.name} Specialization`,
      studiedBy: cat.name,
      targetAudience: cat.name,
      chapters: tailoredChapters,
      totalChapters: tailoredChapters.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const saved = await saveLibraryCourse(tailoredCourse);
    savedCourses.push(saved);
  }

  return savedCourses;
}

/**
 * Utility: Converts 100% of chapter markdown content into structured SlideItem objects
 */
export function generateStructuredSlideItemsFromMarkdown(
  chapterContent: string,
  courseTitle: string,
  chapterTitle: string,
  chapterNumber: number
): LibrarySlideItem[] {
  const lines = (chapterContent || '').split('\n');
  const result: LibrarySlideItem[] = [];

  // Title Slide
  result.push({
    id: `slide_${chapterNumber}_title`,
    slideNumber: 1,
    badge: 'Masterclass Foundation',
    badgeColor: '#818cf8',
    title: chapterTitle,
    subtitle: `${courseTitle} • Book ${chapterNumber}`,
    bullets: [
      `Authoritative curriculum structure for ${chapterTitle}`,
      `Structured theoretical principles, operational models, and architectures`,
      `Includes integrated slide masterclass, textbook reading, and exam assessments`,
    ],
    keyTakeaway: `Mastery of Book ${chapterNumber} establishes core competency requirements for ${courseTitle}.`,
    speakerNotes: `Welcome to ${chapterTitle}. Today we establish the critical principles and frameworks.`,
    sourceHeadingAnchor: `Book ${chapterNumber}: ${chapterTitle}`,
  });

  let currentSlide: Partial<LibrarySlideItem> | null = null;
  let slideCount = 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ') || line.startsWith('### ')) {
      if (currentSlide && currentSlide.title && (currentSlide.bullets?.length || 0) > 0) {
        result.push({
          id: `slide_${chapterNumber}_${slideCount}`,
          slideNumber: slideCount,
          badge: `Module ${chapterNumber}.${slideCount - 1}`,
          badgeColor: '#38bdf8',
          title: currentSlide.title,
          subtitle: currentSlide.subtitle || `${courseTitle} In-Depth`,
          bullets: currentSlide.bullets || [],
          keyTakeaway: currentSlide.keyTakeaway || `Key takeaway regarding ${currentSlide.title}`,
          speakerNotes: currentSlide.speakerNotes || `Let us examine ${currentSlide.title} in detail.`,
          sourceHeadingAnchor: currentSlide.title,
          codeSnippet: currentSlide.codeSnippet,
          tableData: currentSlide.tableData,
        });
        slideCount++;
      }

      const rawHeading = line.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim();
      currentSlide = {
        title: rawHeading,
        subtitle: `${courseTitle} • Core Concept`,
        bullets: [],
        keyTakeaway: `Key principle of ${rawHeading}`,
        speakerNotes: `Focus on the application of ${rawHeading}.`,
      };
    } else if (currentSlide) {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const b = line.replace(/^[-*]\s*/, '').trim();
        if (b.length > 5 && (currentSlide.bullets?.length || 0) < 6) {
          currentSlide.bullets = currentSlide.bullets || [];
          currentSlide.bullets.push(b);
        }
      } else if (line.trim().length > 30 && !currentSlide.speakerNotes) {
        currentSlide.speakerNotes = line.trim();
      }
    }
  }

  if (currentSlide && currentSlide.title && (currentSlide.bullets?.length || 0) > 0) {
    result.push({
      id: `slide_${chapterNumber}_${slideCount}`,
      slideNumber: slideCount,
      badge: `Module ${chapterNumber}.${slideCount - 1}`,
      badgeColor: '#38bdf8',
      title: currentSlide.title,
      subtitle: currentSlide.subtitle || `${courseTitle} In-Depth`,
      bullets: currentSlide.bullets || [],
      keyTakeaway: currentSlide.keyTakeaway || `Key principle of ${currentSlide.title}`,
      speakerNotes: currentSlide.speakerNotes || `Let us master ${currentSlide.title}.`,
      sourceHeadingAnchor: currentSlide.title,
    });
  }

  // Summary Slide
  result.push({
    id: `slide_${chapterNumber}_summary`,
    slideNumber: result.length + 1,
    badge: 'Curriculum Synthesis',
    badgeColor: '#10b981',
    title: `${chapterTitle}: Review & Summary`,
    subtitle: `Self-Paced Mastery & Checkpoint`,
    bullets: [
      `Consolidated foundational principles from all lesson modules`,
      `Applied practical workflows and real-world scenarios`,
      `Proceed to Exams Board for self-assessment verification`,
    ],
    keyTakeaway: `Successful completion of Book ${chapterNumber} prepares you for next-tier modules.`,
    speakerNotes: `Congratulations on completing Book ${chapterNumber}. Review key terms in the glossary.`,
    sourceHeadingAnchor: `Book ${chapterNumber}: ${chapterTitle}`,
  });

  return result;
}

/**
 * Gets dedicated Slide + AI course structured instance
 */
export async function getSlideAiCourseData(courseId: string): Promise<SlideAiCourseData | null> {
  const course = await getLibraryCourseById(courseId);
  if (!course) return null;
  if (course.slideAiCourseData) return course.slideAiCourseData;

  const slideDecksByChapter: Record<number, LibrarySlideItem[]> = {};
  course.chapters.forEach((ch) => {
    slideDecksByChapter[ch.chapterNumber] = generateStructuredSlideItemsFromMarkdown(ch.content, course.title, ch.title, ch.chapterNumber);
  });
  return {
    courseId,
    slideDecksByChapter,
    updatedAt: course.updatedAt,
  };
}

/**
 * Gets dedicated IntelliCoach AI interactive instance
 */
export async function getIntelliCoachCourseData(courseId: string): Promise<IntelliCoachCourseData | null> {
  const course = await getLibraryCourseById(courseId);
  if (!course) return null;
  return course.intelliCoachCourseData || {
    courseId,
    dialogueHistoryByChapter: {},
    updatedAt: course.updatedAt,
  };
}

/**
 * Creates and records a version snapshot of a LibraryCourse, preserving version history.
 */
export async function saveCourseVersionSnapshot(
  course: LibraryCourse,
  isAutoSave: boolean = false,
  customLabel?: string
): Promise<{ updatedCourse: LibraryCourse; newVersion: CourseVersion }> {
  const existingVersions = course.versions || [];
  const nextMajor = existingVersions.length === 0 ? 1 : Math.floor(existingVersions.length / 5) + 1;
  const nextMinor = existingVersions.length % 5;
  const versionNumber = isAutoSave
    ? `v${nextMajor}.${nextMinor || 1}-auto`
    : `v${nextMajor}.${nextMinor || 0}`;

  const newVersion: CourseVersion = {
    id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    versionNumber,
    timestamp: Date.now(),
    label: customLabel || (isAutoSave ? `Auto-Saved Snapshot (${new Date().toLocaleTimeString()})` : `Version ${versionNumber}`),
    chaptersSnapshot: JSON.parse(JSON.stringify(course.chapters)),
    autoSaved: isAutoSave,
  };

  // Keep up to latest 30 versions per course to prevent unbounded size
  const updatedVersions = [newVersion, ...existingVersions.slice(0, 29)];

  const updatedCourse: LibraryCourse = {
    ...course,
    versions: updatedVersions,
    activeVersionNumber: versionNumber,
    updatedAt: Date.now(),
  };

  await saveLibraryCourse(updatedCourse);
  return { updatedCourse, newVersion };
}

/**
 * Restores a specific version snapshot of a LibraryCourse.
 */
export async function restoreCourseVersion(
  course: LibraryCourse,
  versionId: string
): Promise<LibraryCourse> {
  const version = course.versions?.find((v) => v.id === versionId);
  if (!version) {
    throw new Error(`Version snapshot ${versionId} not found.`);
  }

  const updatedCourse: LibraryCourse = {
    ...course,
    chapters: JSON.parse(JSON.stringify(version.chaptersSnapshot)),
    activeVersionNumber: version.versionNumber,
    totalChapters: version.chaptersSnapshot.length,
    updatedAt: Date.now(),
  };

  await saveLibraryCourse(updatedCourse);
  return updatedCourse;
}

/**
 * Retrieves all saved Library courses.
 */
export async function getAllLibraryCourses(): Promise<LibraryCourse[]> {
  try {
    // 1. SQLite file DB
    const res = await fetchApi<{ courses: LibraryCourse[] }>('/courses');
    let courses = res?.courses || [];

    // 2. Fallback to IndexedDB
    if (!res && courses.length === 0) {
      const idb = await getLocalIDB();
      courses = await idb.getAllFromIndex(LIBRARY_STORE, 'by-updated');
    }

    // Sanitize any legacy course titles that might contain long raw prompt text
    courses = courses.map((course) => {
      if (course.title && (course.title.startsWith('Please ') || course.title.startsWith('Can you ') || course.title.length > 60)) {
        return {
          ...course,
          title: extractSmartCourseTitle(course.title, 'Enterprise Masterclass'),
        };
      }
      return course;
    });

    return courses.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('[dbService] Failed to get library courses:', err);
    return [];
  }
}

/**
 * Retrieves a single Library course by ID.
 */
export async function getLibraryCourseById(id: string): Promise<LibraryCourse | undefined> {
  try {
    const res = await fetchApi<{ course: LibraryCourse }>(`/courses/${encodeURIComponent(id)}`);
    if (res?.course) return res.course;

    const idb = await getLocalIDB();
    return await idb.get(LIBRARY_STORE, id);
  } catch (err) {
    console.error('[dbService] Failed to get course by id:', err);
    return undefined;
  }
}

/**
 * Deletes a course from the Library.
 */
export async function deleteLibraryCourse(id: string): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ success: boolean }>(`/courses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.delete(LIBRARY_STORE, id);
  } catch {
    // ignore
  }

  // Real-time Master-Slave Synchronization notification
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ila_library_courses_updated', { detail: { courseId: id, deleted: true } }));
  }
}

/**
 * Clears all courses from the Library (both SQLite and IndexedDB).
 */
export async function clearAllLibraryCourses(): Promise<void> {
  // 1. SQLite
  await fetchApi<{ success: boolean }>('/courses', {
    method: 'DELETE',
  });

  // 2. IndexedDB
  try {
    const idb = await getLocalIDB();
    await idb.clear(LIBRARY_STORE);
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ila_library_courses_updated', { detail: { cleared: true } }));
  }
}

/**
 * Clears all database data (sessions, courses, history, categories).
 */
export async function clearAllDatabaseData(): Promise<void> {
  await fetchApi<{ success: boolean }>('/sessions', { method: 'DELETE' });
  await fetchApi<{ success: boolean }>('/courses', { method: 'DELETE' });
  await fetchApi<{ success: boolean }>('/history', { method: 'DELETE' });
  await fetchApi<{ success: boolean }>('/categories', { method: 'DELETE' });

  try {
    const idb = await getLocalIDB();
    await idb.clear(SESSIONS_STORE);
    await idb.clear(LIBRARY_STORE);
    await idb.clear(HISTORY_STORE);
    await idb.clear(CATEGORIES_STORE);
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ila_library_courses_updated', { detail: { cleared: true } }));
    window.dispatchEvent(new CustomEvent('ila_sessions_updated', { detail: { cleared: true } }));
    window.dispatchEvent(new CustomEvent('ila_categories_updated', { detail: { cleared: true } }));
  }
}

/**
 * Toggles completion status for a specific chapter in a Library course.
 */
export async function toggleChapterCompletion(courseId: string, chapterId: string): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ course: LibraryCourse }>(
    `/courses/${encodeURIComponent(courseId)}/toggle-chapter`,
    {
      method: 'POST',
      body: JSON.stringify({ chapterId }),
    }
  );

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    const course = await idb.get(LIBRARY_STORE, courseId);
    if (course) {
      course.chapters = course.chapters.map((ch) =>
        ch.id === chapterId ? { ...ch, isCompleted: !ch.isCompleted } : ch
      );
      course.updatedAt = Date.now();
      await idb.put(LIBRARY_STORE, course);
    }
  } catch {
    // ignore
  }
}

/**
 * Exports all library courses to JSON.
 */
export async function exportAllLibraryJSON(): Promise<string> {
  const courses = await getAllLibraryCourses();
  const health = await getDbHealthInfo();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      app: 'Ila Course Creator - Course Library',
      databasePath: health.relativeDbPath,
      totalCourses: courses.length,
      courses,
    },
    null,
    2
  );
}

/**
 * Imports library courses from JSON.
 */
export async function importLibraryJSON(jsonStr: string): Promise<number> {
  const data = JSON.parse(jsonStr);
  const courses: LibraryCourse[] = Array.isArray(data) ? data : data.courses || [];

  // 1. SQLite file DB
  const res = await fetchApi<{ count: number }>('/courses/import', {
    method: 'POST',
    body: JSON.stringify({ courses }),
  });

  const importedCount = res?.count ?? 0;

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    for (const course of courses) {
      if (course && course.id && Array.isArray(course.chapters)) {
        await idb.put(LIBRARY_STORE, course);
      }
    }
  } catch {
    // ignore
  }

  return importedCount > 0 ? importedCount : courses.length;
}

/* =========================================================================
   SINGLE INTERACTION COMPATIBILITY METHODS
   ========================================================================= */

export async function saveChatHistoryItem(
  item: Omit<ChatHistoryItem, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): Promise<ChatHistoryItem> {
  const newItem: ChatHistoryItem = {
    id: item.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    query: item.query,
    response: item.response,
    model: item.model,
    modelDisplayName: item.modelDisplayName,
    timestamp: item.timestamp || Date.now(),
    responseTimeMs: item.responseTimeMs,
    isFavorite: item.isFavorite || false,
  };

  // 1. SQLite file DB
  const res = await fetchApi<{ item: ChatHistoryItem }>('/history', {
    method: 'POST',
    body: JSON.stringify(newItem),
  });

  const finalSaved = res?.item || newItem;

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.put(HISTORY_STORE, finalSaved);
  } catch {
    // ignore
  }

  return finalSaved;
}

export async function getAllChatHistory(): Promise<ChatHistoryItem[]> {
  try {
    // 1. SQLite file DB
    const res = await fetchApi<{ history: ChatHistoryItem[] }>('/history');
    let history = res?.history || [];

    // 2. Fallback to IndexedDB
    if (!res && history.length === 0) {
      const idb = await getLocalIDB();
      history = await idb.getAllFromIndex(HISTORY_STORE, 'by-timestamp');
      history = history.reverse();
    }

    return history;
  } catch (err) {
    console.error('[dbService] Failed to get chat history:', err);
    return [];
  }
}

export async function deleteChatHistoryItem(id: string): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ success: boolean }>(`/history/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.delete(HISTORY_STORE, id);
  } catch {
    // ignore
  }
}

export async function clearAllChatHistory(): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ success: boolean }>('/history', {
    method: 'DELETE',
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.clear(HISTORY_STORE);
  } catch {
    // ignore
  }
}

export async function exportChatHistoryJSON(): Promise<string> {
  const history = await getAllChatHistory();
  const health = await getDbHealthInfo();
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      databasePath: health.relativeDbPath,
      totalCount: history.length,
      history,
    },
    null,
    2
  );
}

/* =========================================================================
   DYNAMIC COURSE CATEGORIES MANAGEMENT
   ========================================================================= */

export async function getAllCategories(): Promise<CourseCategory[]> {
  try {
    // 1. SQLite file DB
    const res = await fetchApi<{ categories: CourseCategory[] }>('/categories');
    if (res && Array.isArray(res.categories)) {
      return res.categories;
    }

    // 2. Fallback to IndexedDB
    const idb = await getLocalIDB();
    const categories = await idb.getAll(CATEGORIES_STORE);
    return categories || [];
  } catch (err) {
    console.error('[dbService] Failed to get categories:', err);
    return [];
  }
}

export async function saveCategory(category: Partial<CourseCategory> & { name: string }): Promise<CourseCategory> {
  const now = Date.now();
  const toSave: CourseCategory = {
    id: category.id || `cat_${now}_${Math.random().toString(36).substring(2, 9)}`,
    name: category.name.trim(),
    department: category.department?.trim() || '',
    description: category.description?.trim() || '',
    color: category.color || '#38bdf8',
    createdAt: category.createdAt || now,
    updatedAt: now,
  };

  // 1. SQLite file DB
  const res = await fetchApi<{ category: CourseCategory }>('/categories', {
    method: 'POST',
    body: JSON.stringify(toSave),
  });

  const finalSaved = res?.category || toSave;

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.put(CATEGORIES_STORE, finalSaved);
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ila_categories_updated', { detail: { categoryId: finalSaved.id } }));
  }

  return finalSaved;
}

export async function deleteCategory(id: string): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ success: boolean }>(`/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.delete(CATEGORIES_STORE, id);
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ila_categories_updated', { detail: { deletedId: id } }));
  }
}

export async function clearAllCategories(): Promise<void> {
  // 1. SQLite file DB
  await fetchApi<{ success: boolean }>('/categories', {
    method: 'DELETE',
  });

  // 2. IndexedDB backup
  try {
    const idb = await getLocalIDB();
    await idb.clear(CATEGORIES_STORE);
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ila_categories_updated', { detail: { cleared: true } }));
  }
}
