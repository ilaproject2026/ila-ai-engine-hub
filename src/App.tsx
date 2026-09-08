import { useState, useEffect } from 'react';
import ChatSidebar from './components/ChatSidebar';
import SearchBox from './components/SearchBox';
import QuestionTreeDrawer from './components/QuestionTreeDrawer';
import LibraryWorkspaceView from './components/LibraryWorkspaceView';
import DedicatedLibraryView from './components/DedicatedLibraryView';
import SlideAiLibraryView from './components/SlideAiLibraryView';
import VideoAiLibraryView from './components/VideoAiLibraryView';
import IntelliCoachView from './components/IntelliCoachView';
import MasterclassVideoPlayer from './components/MasterclassVideoPlayer';
import TeachingSlidesModal from './components/TeachingSlidesModal';
import {
  Sparkles,
  PanelLeft,
  Check,
  AlertCircle,
  RefreshCw,
  GraduationCap,
  Sun,
  Moon,
  Palette,
  ChevronDown,
  Droplets,
  ShieldCheck,
  MessageSquare,
  Presentation,
  Tv,
  Bot,
} from 'lucide-react';
import {
  getAllChatSessions,
  saveChatSession,
  deleteChatSession,
  clearAllChatSessions,
  updateChatSessionTitle,
  togglePinSession,
  exportAllSessionsJSON,
  importSessionsJSON,
  createNewSessionObject,
  isStoragePersisted,
  getDbHealthInfo,
  saveLibraryCourse,
  compileCourseFromChatSession,
  extractSmartCourseTitle,
  extractCourseTitleFromContent,
  type ChatSession,
  type ChatMessage,
  type AttachedDocument,
  type DbStatusInfo,
  type CoursePlan,
  type CoursePlanModule,
  type LibraryCourse,
  type AutonomousCoursePlan,
  type AutonomousTaskStep,
} from './services/dbService';
import {
  generateIlaResponse,
  getIlaModelDisplayName,
} from './services/geminiService';
import { useVoice } from './hooks/useVoice';

export type AppTheme = 'obsidian' | 'sunny-day' | 'sapphire' | 'emerald' | 'amber';

interface ThemeOption {
  id: AppTheme;
  name: string;
  badge: string;
  icon: typeof Sun;
  color: string;
  description: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'obsidian',
    name: 'Midnight Cyber',
    badge: 'Dark',
    icon: Moon,
    color: '#818cf8',
    description: 'Deep obsidian dark mode with neon indigo accents',
  },
  {
    id: 'sunny-day',
    name: 'Sunny Day',
    badge: 'Anti-Glare',
    icon: Sun,
    color: '#f59e0b',
    description: 'Anti-reflection high-contrast daylight mode for outdoor sunlight visibility',
  },
  {
    id: 'sapphire',
    name: 'Ocean Sapphire',
    badge: 'Blue',
    icon: Droplets,
    color: '#38bdf8',
    description: 'Deep naval sapphire slate with arctic blue accents',
  },
  {
    id: 'emerald',
    name: 'Forest Emerald',
    badge: 'Mint',
    icon: Sparkles,
    color: '#34d399',
    description: 'Deep matrix emerald theme with mint accents',
  },
  {
    id: 'amber',
    name: 'Solar Sunset',
    badge: 'Warm',
    icon: Palette,
    color: '#fbbf24',
    description: 'Warm obsidian and amber glow with gold accents',
  },
];

export default function App() {
  // Theme State: Persisted to localStorage and applied to data-theme attribute
  const [theme, setTheme] = useState<AppTheme>(() => {
    return (localStorage.getItem('ila_app_theme') as AppTheme) || 'obsidian';
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ila_app_theme', theme);
  }, [theme]);

  // Main Navigation Tab State: 'home' (Home / Chat Workspace), 'admin_library' (Teacher Admin Workspace), 'slide_ai' (Slide + AI Masterclass Library), 'video_ai' (Video + AI Masterclass Library), 'intelli_coach' (Interactive AI Coaching & Diagnostic Onboarding)
  const [mainNavTab, setMainNavTab] = useState<'home' | 'admin_library' | 'slide_ai' | 'video_ai' | 'intelli_coach'>('home');

  // Left Chat Sidebar State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isDbPersisted, setIsDbPersisted] = useState<boolean>(false);
  const [dbHealth, setDbHealth] = useState<DbStatusInfo | null>(null);
  const [attachedDocuments, setAttachedDocuments] = useState<AttachedDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBulkPlannerActive, setIsBulkPlannerActive] = useState<boolean>(false);

  // Global Multi-Language & Open-Source Voice Profile States
  const [globalLanguage] = useState<string>(() => {
    return localStorage.getItem('ila_active_language') || 'en-US';
  });
  const [globalVoiceProfile] = useState<string>(() => {
    const saved = localStorage.getItem('ila_active_voice_profile');
    if (saved && !saved.startsWith('piper')) return saved;
    return 'coqui-xtts-multilingual';
  });

  // Interactive Masterclass Video Player state in Result View
  const [activeVideoCourseData, setActiveVideoCourseData] = useState<{
    courseTitle: string;
    chapterTitle: string;
    chapterNumber: number;
    chapterContent: string;
    topicNumber?: string;
  } | null>(null);

  // Presentation-Ready Teaching Slides state in Result View
  const [activeSlidesData, setActiveSlidesData] = useState<{
    courseTitle: string;
    chapterTitle: string;
    chapterNumber: number;
    chapterContent: string;
  } | null>(null);

  // Question Tree Navigation State
  const [isQuestionTreeOpen, setIsQuestionTreeOpen] = useState<boolean>(false);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const { isSpeaking, activeSpeakingId, speak, stopAllSpeech } = useVoice();

  // Active Session object
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // List of all user questions in the active session
  const userQuestions = (activeSession?.messages || []).filter((m) => m.role === 'user');
  const totalUserQuestions = userQuestions.length;

  // Initial load of all chat sessions from SQLite DB on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const loaded = await getAllChatSessions();
        if (isMounted) {
          setSessions(loaded);
          if (loaded.length > 0) {
            setActiveSessionId(loaded[0].id);
          } else {
            const fresh = createNewSessionObject('New Course Workspace');
            await saveChatSession(fresh);
            setSessions([fresh]);
            setActiveSessionId(fresh.id);
          }
        }
      } catch (err) {
        console.error('Failed to load chat sessions:', err);
      }

      // Check SQLite persistence and health info
      try {
        const [persisted, health] = await Promise.all([
          isStoragePersisted(),
          getDbHealthInfo(),
        ]);
        if (isMounted) {
          setIsDbPersisted(persisted);
          setDbHealth(health);
        }
      } catch (err) {
        console.warn('Storage check failed:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync active question id when active session changes
  useEffect(() => {
    if (userQuestions.length > 0) {
      setActiveQuestionId(userQuestions[userQuestions.length - 1].id);
    } else {
      setActiveQuestionId(null);
    }
  }, [activeSessionId]);

  // Handle session selection
  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setError(null);
    stopAllSpeech();
    setMainNavTab('home');
    if (window.innerWidth < 768) {
      setIsLeftSidebarOpen(false);
    }
  };

  // Create a brand new chat session
  const handleNewChat = async () => {
    const newSession = createNewSessionObject('New Course Workspace');
    await saveChatSession(newSession);
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setAttachedDocuments([]);
    setError(null);
    stopAllSpeech();
    setMainNavTab('home');
  };

  // Delete chat session
  const handleDeleteSession = async (sessionId: string) => {
    stopAllSpeech();
    await deleteChatSession(sessionId);
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);

    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        setActiveSessionId(updated[0].id);
      } else {
        const fresh = createNewSessionObject('New Course Workspace');
        await saveChatSession(fresh);
        setSessions([fresh]);
        setActiveSessionId(fresh.id);
      }
    }
  };

  // Rename session title
  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    await updateChatSessionTitle(sessionId, newTitle);
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
    );
  };

  // Toggle pin session
  const handleTogglePinSession = async (sessionId: string) => {
    await togglePinSession(sessionId);
    setSessions((prev) =>
      prev
        .map((s) => (s.id === sessionId ? { ...s, isPinned: !s.isPinned, updatedAt: Date.now() } : s))
        .sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.updatedAt - a.updatedAt;
        })
    );
  };

  // Clear all sessions
  const handleClearAllSessions = async () => {
    stopAllSpeech();
    await clearAllChatSessions();
    const fresh = createNewSessionObject('New Course Workspace');
    await saveChatSession(fresh);
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
  };

  // Export all sessions as JSON
  const handleExportJSON = async () => {
    try {
      const jsonStr = await exportAllSessionsJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ila-courses-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Import sessions from JSON backup
  const handleImportJSON = async (jsonStr: string) => {
    try {
      const count = await importSessionsJSON(jsonStr);
      const reloaded = await getAllChatSessions();
      setSessions(reloaded);
      if (reloaded.length > 0) {
        setActiveSessionId(reloaded[0].id);
      }
      alert(`Successfully imported ${count} sessions into SQLite DB!`);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Failed to import JSON backup. Please verify file format.');
    }
  };

  // Helper to update session message in place after in-place AI chapter refinement
  const handleUpdateSessionMessage = async (messageId: string, updatedContent: string) => {
    if (!activeSession) return;
    const updatedMessages = activeSession.messages.map((m) =>
      m.id === messageId ? { ...m, content: updatedContent } : m
    );
    const updatedSession: ChatSession = {
      ...activeSession,
      messages: updatedMessages,
      updatedAt: Date.now(),
    };
    await saveChatSession(updatedSession);
    setSessions((prev) =>
      prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    );
  };

  // Build or extract multi-book course plan
  const createOrUpdateCoursePlan = (query: string, currentSession: ChatSession): CoursePlan => {
    if (currentSession.coursePlan && currentSession.coursePlan.modules.length > 0) {
      return currentSession.coursePlan;
    }

    const smartTitle = extractSmartCourseTitle(query, 'Enterprise Masterclass');

    return {
      title: smartTitle,
      subtitle: 'Comprehensive Enterprise Modular Curriculum with Hands-on Labs',
      totalModules: 4,
      modules: [
        {
          moduleNumber: 1,
          title: `Book 1: Foundations, Architecture & Core Fundamentals`,
          summary: `Core principles, data models, initial configuration, and underlying mechanisms for ${smartTitle}.`,
          status: 'completed',
        },
        {
          moduleNumber: 2,
          title: `Book 2: Master Data, Workflows & Business Transactions`,
          summary: `End-to-end operational execution, transaction codes, UI screens, and core workflows.`,
          status: 'ready',
        },
        {
          moduleNumber: 3,
          title: `Book 3: Advanced Configuration, Integration & Optimization`,
          summary: `Enterprise cross-module integrations, compliance policies, analytics dashboards, and tuning.`,
          status: 'pending',
        },
        {
          moduleNumber: 4,
          title: `Book 4: Hands-on Enterprise Labs, Case Studies & Assessments`,
          summary: `Practical lab simulations, scenario challenges, real-world case studies, and certification questions.`,
          status: 'pending',
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  };

  // Autonomous Bulk Task Decomposition & Step-by-Step Execution Engine
  const executeAutonomousCoursePlan = async (query: string, docs: AttachedDocument[], targetAudience?: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery || loading) return;

    setError(null);
    setLoading(true);
    stopAllSpeech();

    const audience = targetAudience || localStorage.getItem('ila_learner_category') || 'General Student / Lifelong Learner';

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: cleanQuery,
      timestamp: Date.now(),
      documents: docs.length > 0 ? [...docs] : undefined,
    };

    let targetSession = sessions.find((s) => s.id === activeSessionId);
    if (!targetSession) {
      targetSession = createNewSessionObject('New Course Workspace');
    }

    let smartTitle = extractSmartCourseTitle(cleanQuery, 'Enterprise Masterclass');

    // 1. Task Decomposition: Create initial steps
    const initialSteps: AutonomousTaskStep[] = [
      {
        id: `step_1_${Date.now()}`,
        stepNumber: 1,
        title: 'Curriculum Architecture & Module Decomposition',
        description: `Structuring comprehensive 4-Book curriculum roadmap for ${smartTitle} tailored for ${audience}.`,
        type: 'blueprint',
        status: 'in_progress',
        startedAt: Date.now(),
      },
      {
        id: `step_2_${Date.now()}`,
        stepNumber: 2,
        title: 'Book 1: Foundations, Architecture & Core Fundamentals',
        description: 'Theoretical foundations, underlying mechanisms, initial configuration, and core data models.',
        type: 'book_generation',
        bookNumber: 1,
        status: 'pending',
      },
      {
        id: `step_3_${Date.now()}`,
        stepNumber: 3,
        title: 'Book 2: Applied Workflows & Domain Practice',
        description: 'Step-by-step practical workflows, execution methods, demonstrations, and process standards.',
        type: 'book_generation',
        bookNumber: 2,
        status: 'pending',
      },
      {
        id: `step_4_${Date.now()}`,
        stepNumber: 4,
        title: 'Book 3: Advanced Architectures, Integration & Systems',
        description: 'Complex integrations, governance standards, analytics, and performance optimization.',
        type: 'book_generation',
        bookNumber: 3,
        status: 'pending',
      },
      {
        id: `step_5_${Date.now()}`,
        stepNumber: 5,
        title: 'Book 4: Hands-on Labs, Capstone Case Studies & Assessments',
        description: 'Practical scenario challenges, capstone case studies, and standardized certification quizzes.',
        type: 'book_generation',
        bookNumber: 4,
        status: 'pending',
      },
      {
        id: `step_6_${Date.now()}`,
        stepNumber: 6,
        title: 'Synthesis & Automatic Compilation to SQLite Library Workspace',
        description: 'Aggregating all modules and chapters into persistent multi-book interactive library repository.',
        type: 'synthesis',
        status: 'pending',
      },
    ];

    const autonomousPlan: AutonomousCoursePlan = {
      id: `auto_plan_${Date.now()}`,
      prompt: cleanQuery,
      courseTitle: smartTitle,
      courseSubtitle: `Autonomous Modular Task Planner for ${audience}`,
      totalSteps: initialSteps.length,
      currentStepIndex: 0,
      status: 'executing',
      steps: initialSteps,
      startedAt: Date.now(),
    };

    const coursePlan = createOrUpdateCoursePlan(cleanQuery, targetSession);
    coursePlan.title = smartTitle;
    coursePlan.modules = coursePlan.modules.map((m, idx) => ({
      ...m,
      status: idx === 0 ? 'generating' : 'pending',
    }));

    let currentSession: ChatSession = {
      ...targetSession,
      title: smartTitle,
      messages: [...targetSession.messages, userMessage],
      attachedDocuments: docs,
      coursePlan,
      autonomousPlan,
      studiedBy: audience,
      updatedAt: Date.now(),
    };

    setSessions((prev) => {
      const exists = prev.some((s) => s.id === currentSession.id);
      if (exists) {
        return prev.map((s) => (s.id === currentSession.id ? currentSession : s));
      }
      return [currentSession, ...prev];
    });
    setActiveSessionId(currentSession.id);
    await saveChatSession(currentSession);

    try {
      // Step 1: Curriculum Blueprint Generation
      const blueprintPrompt = `Create an exhaustive Master Curriculum Architecture Blueprint for: "${cleanQuery}".
Detail the complete 4-Book curriculum roadmap with learning outcomes, domain architecture diagrams, practical workflows, and lab goals strictly tailored for: ${audience}.`;

      const blueprintResponse = await generateIlaResponse(
        blueprintPrompt,
        currentSession.messages,
        docs,
        undefined,
        audience
      );

      // Smartly extract title from the AI's generated blueprint header if available
      const aiExtractedTitle = extractCourseTitleFromContent(blueprintResponse);
      if (aiExtractedTitle) {
        smartTitle = aiExtractedTitle;
        autonomousPlan.courseTitle = smartTitle;
        coursePlan.title = smartTitle;
      }

      const step1Msg: ChatMessage = {
        id: `msg_asst_step1_${Date.now()}`,
        role: 'assistant',
        content: blueprintResponse,
        timestamp: Date.now(),
        modelDisplayName: getIlaModelDisplayName(),
      };

      autonomousPlan.steps[0].status = 'completed';
      autonomousPlan.steps[0].completedAt = Date.now();
      autonomousPlan.steps[1].status = 'in_progress';
      autonomousPlan.steps[1].startedAt = Date.now();
      autonomousPlan.currentStepIndex = 1;

      currentSession = {
        ...currentSession,
        title: smartTitle,
        messages: [...currentSession.messages, step1Msg],
        coursePlan,
        autonomousPlan: { ...autonomousPlan },
        updatedAt: Date.now(),
      };
      setSessions((prev) => prev.map((s) => (s.id === currentSession.id ? currentSession : s)));
      await saveChatSession(currentSession);

      // Steps 2 to 5: Sequential Book Generation
      const bookConfigs = [
        {
          bookNum: 1,
          stepIdx: 1,
          prompt: `Please author the complete, exhaustive content for Book 1: Foundations, Architecture & Core Fundamentals for "${smartTitle}". Include deep theoretical foundations, data models, initial configuration, architectural mechanisms, real-world domain scenarios, and visual diagrams tailored for ${audience}. Do NOT provide an outline; write the complete textbook-grade material with lab exercises.`,
        },
        {
          bookNum: 2,
          stepIdx: 2,
          prompt: `Please author the complete, exhaustive content for Book 2: Applied Workflows & Domain Practice for "${smartTitle}". Include end-to-end operational execution, domain-specific methods, practical guidance, and embedded visual screenshot tags tailored for ${audience}.`,
        },
        {
          bookNum: 3,
          stepIdx: 3,
          prompt: `Please author the complete, exhaustive content for Book 3: Advanced Configuration, Integration & Optimization for "${smartTitle}". Include system integrations, compliance policies, domain reporting dashboards, security controls, and optimization techniques tailored for ${audience}.`,
        },
        {
          bookNum: 4,
          stepIdx: 4,
          prompt: `Please author the complete, exhaustive content for Book 4: Hands-on Labs, Capstone Case Studies & Knowledge Assessments for "${smartTitle}". Include detailed hands-on lab exercises with scenario setup, step-by-step instructions, troubleshooting checklists, case studies, and multiple-choice certification questions with answer keys tailored for ${audience}.`,
        },
      ];

      for (let i = 0; i < bookConfigs.length; i++) {
        const { bookNum, stepIdx, prompt } = bookConfigs[i];

        const bookResponse = await generateIlaResponse(
          prompt,
          currentSession.messages,
          docs,
          undefined,
          audience
        );

        const bookMsg: ChatMessage = {
          id: `msg_asst_book${bookNum}_${Date.now()}`,
          role: 'assistant',
          content: bookResponse,
          timestamp: Date.now(),
          modelDisplayName: getIlaModelDisplayName(),
        };

        autonomousPlan.steps[stepIdx].status = 'completed';
        autonomousPlan.steps[stepIdx].completedAt = Date.now();
        coursePlan.modules[i].status = 'completed';

        if (stepIdx + 1 < autonomousPlan.steps.length) {
          autonomousPlan.steps[stepIdx + 1].status = 'in_progress';
          autonomousPlan.steps[stepIdx + 1].startedAt = Date.now();
          autonomousPlan.currentStepIndex = stepIdx + 1;
          if (coursePlan.modules[i + 1]) {
            coursePlan.modules[i + 1].status = 'generating';
          }
        }

        currentSession = {
          ...currentSession,
          messages: [...currentSession.messages, bookMsg],
          coursePlan,
          autonomousPlan: { ...autonomousPlan },
          updatedAt: Date.now(),
        };
        setSessions((prev) => prev.map((s) => (s.id === currentSession.id ? currentSession : s)));
        await saveChatSession(currentSession);
      }

      // Step 6: Synthesis & Automatic Compilation to SQLite Library
      const finalStepIdx = 5;
      try {
        const compiled = compileCourseFromChatSession(currentSession, smartTitle);
        compiled.studiedBy = audience;
        await saveLibraryCourse(compiled);

        // If All Categories / Batch Generate was selected, create tailored department course blocks
        if (audience.toLowerCase().includes('all') || audience.toLowerCase().includes('batch')) {
          const targetDepts = [
            'Enterprises & Business Leaders',
            'Doctors & Healthcare Specialists',
            'Finance & Operations Specialists',
            'Teachers & Academic Researchers',
            'General Students & Career Professionals',
          ];
          for (let dIdx = 0; dIdx < targetDepts.length; dIdx++) {
            const dept = targetDepts[dIdx];
            try {
              const deptCourse = {
                ...compiled,
                id: `lib_course_${Date.now()}_${dIdx}_${dept.slice(0, 3).toLowerCase()}`,
                title: `${smartTitle} [${dept.split(' ')[0]} Edition]`,
                studiedBy: dept,
                targetAudience: dept,
                updatedAt: Date.now(),
              };
              await saveLibraryCourse(deptCourse);
            } catch (dErr) {
              console.warn('Batch department adaptation save notice:', dErr);
            }
          }
        }

        autonomousPlan.steps[finalStepIdx].status = 'completed';
        autonomousPlan.steps[finalStepIdx].completedAt = Date.now();
        autonomousPlan.status = 'completed';
        autonomousPlan.completedAt = Date.now();
      } catch (e) {
        console.warn('Library compilation notice:', e);
        autonomousPlan.steps[finalStepIdx].status = 'completed';
        autonomousPlan.status = 'completed';
      }

      currentSession = {
        ...currentSession,
        autonomousPlan: { ...autonomousPlan },
        updatedAt: Date.now(),
      };
      setSessions((prev) => prev.map((s) => (s.id === currentSession.id ? currentSession : s)));
      await saveChatSession(currentSession);
    } catch (err: unknown) {
      console.error('Autonomous Execution Error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during autonomous course execution.');
      }
      autonomousPlan.status = 'error';
    } finally {
      setLoading(false);
    }
  };

  // Send message handler (Multi-turn generation or Autonomous Planner with ILA AI)
  const handleSendMessage = async (query: string, docs: AttachedDocument[], targetAudience?: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery || loading) return;

    const audience = targetAudience || localStorage.getItem('ila_learner_category') || 'General Student / Lifelong Learner';

    // Check if Bulk Task Planner is active OR if the prompt is an autonomous course generation request
    const lowerQuery = cleanQuery.toLowerCase();
    const isExplicitBulkRequest =
      isBulkPlannerActive ||
      ((lowerQuery.includes('comprehensive') ||
        lowerQuery.includes('full course') ||
        lowerQuery.includes('all books') ||
        lowerQuery.includes('all modules') ||
        lowerQuery.includes('masterclass')) &&
        cleanQuery.length > 50);

    if (isExplicitBulkRequest) {
      await executeAutonomousCoursePlan(cleanQuery, docs, audience);
      return;
    }

    setError(null);
    setLoading(true);
    stopAllSpeech();

    const userMessage: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: cleanQuery,
      timestamp: Date.now(),
      documents: docs.length > 0 ? [...docs] : undefined,
    };

    // Determine target session
    let targetSession = sessions.find((s) => s.id === activeSessionId);
    if (!targetSession) {
      targetSession = createNewSessionObject('New Course Workspace');
    }

    // Auto-set title from first prompt if default or long title
    let newTitle = targetSession.title;
    if (
      targetSession.messages.length === 0 ||
      targetSession.title === 'New Course Workspace' ||
      targetSession.title === 'Untitled Course' ||
      targetSession.title.startsWith('Please ') ||
      targetSession.title.startsWith('Can you ') ||
      targetSession.title.length > 55
    ) {
      newTitle = extractSmartCourseTitle(cleanQuery, 'Course Workspace');
    }

    // Generate or update Course Plan
    const coursePlan = createOrUpdateCoursePlan(cleanQuery, targetSession);

    // Update completed status of modules based on message count
    const assistantCount = targetSession.messages.filter((m) => m.role === 'assistant').length + 1;
    const updatedModules: CoursePlanModule[] = coursePlan.modules.map((m) => {
      if (m.moduleNumber <= assistantCount) {
        return { ...m, status: 'completed' as const };
      }
      if (m.moduleNumber === assistantCount + 1) {
        return { ...m, status: 'ready' as const };
      }
      return m;
    });
    coursePlan.modules = updatedModules;

    const updatedMessagesWithUser = [...targetSession.messages, userMessage];
    const sessionWithUser: ChatSession = {
      ...targetSession,
      title: newTitle,
      messages: updatedMessagesWithUser,
      attachedDocuments: docs,
      coursePlan,
      studiedBy: audience,
      updatedAt: Date.now(),
    };

    // Update state immediately so user sees their message
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === sessionWithUser.id);
      if (exists) {
        return prev.map((s) => (s.id === sessionWithUser.id ? sessionWithUser : s));
      }
      return [sessionWithUser, ...prev];
    });
    setActiveSessionId(sessionWithUser.id);

    const startTime = performance.now();
    const modelDisplayName = getIlaModelDisplayName();

    try {
      const responseText = await generateIlaResponse(
        cleanQuery,
        updatedMessagesWithUser,
        docs,
        undefined,
        audience
      );
      const durationMs = Math.round(performance.now() - startTime);

      const assistantMessage: ChatMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        modelDisplayName,
        responseTimeMs: durationMs,
      };

      // Extract smart title from AI response if session has generic or default title
      const aiExtractedTitle = extractCourseTitleFromContent(responseText);
      const finalTitle =
        aiExtractedTitle ||
        (newTitle !== 'Course Workspace' && newTitle !== 'New Course Workspace'
          ? newTitle
          : extractSmartCourseTitle(cleanQuery, 'Masterclass Course'));

      if (coursePlan && (!coursePlan.title || coursePlan.title.startsWith('Please') || coursePlan.title === 'Enterprise Masterclass')) {
        coursePlan.title = finalTitle;
      }

      const finalSession: ChatSession = {
        ...sessionWithUser,
        title: finalTitle,
        messages: [...updatedMessagesWithUser, assistantMessage],
        coursePlan,
        updatedAt: Date.now(),
      };

      // Save permanently to SQLite
      await saveChatSession(finalSession);

      // Update state
      setSessions((prev) =>
        prev.map((s) => (s.id === finalSession.id ? finalSession : s))
      );
    } catch (err: unknown) {
      console.error('Error generating AI response:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while communicating with ILA AI.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Jump to specific message element smoothly
  const handleJumpToMessage = (messageId: string) => {
    setActiveQuestionId(messageId);
    const el = document.getElementById(`msg-item-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        color: 'var(--text-main)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 1. Left Chat History Sidebar (Exclusive to Home / Course Creator View) */}
      {mainNavTab === 'home' && (
        <ChatSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onTogglePinSession={handleTogglePinSession}
          onClearAllSessions={handleClearAllSessions}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          isOpen={isLeftSidebarOpen}
          onToggleOpen={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
          isDbPersisted={isDbPersisted}
          dbHealth={dbHealth}
        />
      )}

      {/* 2. Main Workspace View Area */}
      <div
        id="main-workspace-container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top Header Navigation Bar (Clean & Uncluttered) */}
        <header
          id="main-top-header"
          style={{
            padding: '0.6rem 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            background: 'rgba(10, 13, 20, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 100,
            flexShrink: 0,
          }}
        >
          {/* Left: Sidebar Toggle (in Home tab), Brand Title, and Main Nav Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
            {mainNavTab === 'home' && (
              <button
                id="sidebar-toggle-btn"
                type="button"
                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '0.5rem',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  padding: '0.45rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                title={isLeftSidebarOpen ? 'Collapse Chat History' : 'Expand Chat History'}
              >
                <PanelLeft size={17} />
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '0.6rem',
                  background: 'var(--accent-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px var(--accent-glow)',
                  flexShrink: 0,
                }}
              >
                <GraduationCap size={18} color="#ffffff" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h1
                    style={{
                      fontSize: '0.98rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '-0.02em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={activeSession?.title || 'Ila Course Creator'}
                  >
                    {activeSession?.title || 'Ila Course Creator'}
                  </h1>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'rgba(99, 102, 241, 0.25)',
                      border: '1px solid rgba(99, 102, 241, 0.45)',
                      color: '#a5b4fc',
                      lineHeight: '1.2',
                      flexShrink: 0,
                    }}
                    title="Version 6"
                  >
                    v6
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Powered by Ila Academy</span>
                  <span>•</span>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                    {getIlaModelDisplayName()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Main Navigation Tabs (Home/Chat, Admin Library, Video + AI Library, IntelliCoach AI Library) + Theme Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Unified 4-Mode Main Navigation */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '9999px',
                padding: '0.2rem',
                gap: '0.2rem',
              }}
            >
              {/* 1. Home / Chat Workspace (Active Creator Studio, Prompts, Streaming Generation & Left Sidebar) */}
              <button
                id="main-nav-home-btn"
                type="button"
                onClick={() => setMainNavTab('home')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.32rem 0.8rem',
                  borderRadius: '9999px',
                  background:
                    mainNavTab === 'home'
                      ? 'var(--accent-gradient)'
                      : 'transparent',
                  border: 'none',
                  color: mainNavTab === 'home' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow:
                    mainNavTab === 'home'
                      ? '0 2px 10px var(--accent-glow)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Home / Chat Workspace: Authoring Studio, Sidebar History, Prompts & Live Course Generation"
              >
                <MessageSquare size={13} />
                <span>Home / Chat Workspace</span>
              </button>

              {/* 2. Admin Library (Full Teacher/Admin Course Catalog & Management) */}
              <button
                id="main-nav-admin-lib-btn"
                type="button"
                onClick={() => setMainNavTab('admin_library')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.32rem 0.8rem',
                  borderRadius: '9999px',
                  background:
                    mainNavTab === 'admin_library'
                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                      : 'transparent',
                  border: 'none',
                  color:
                    mainNavTab === 'admin_library'
                      ? '#ffffff'
                      : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow:
                    mainNavTab === 'admin_library'
                      ? '0 2px 10px rgba(99, 102, 241, 0.4)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Admin Library: Manage authorized courses, inspect versions, DOCX downloads & course structures"
              >
                <ShieldCheck size={13} />
                <span>Admin Library</span>
              </button>

              {/* 3. Slide + AI Library (Dedicated Standalone Dynamic Slide Masterclass) */}
              <button
                id="main-nav-slide-ai-btn"
                type="button"
                onClick={() => setMainNavTab('slide_ai')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.32rem 0.8rem',
                  borderRadius: '9999px',
                  background:
                    mainNavTab === 'slide_ai'
                      ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)'
                      : 'transparent',
                  border: 'none',
                  color: mainNavTab === 'slide_ai' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow:
                    mainNavTab === 'slide_ai'
                      ? '0 2px 10px rgba(56, 189, 248, 0.4)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Slide + AI Library: Dynamic Slide Masterclasses with live TTS narration, synchronized textbook & doubt clearing"
              >
                <Presentation size={13} />
                <span>Slide + AI</span>
              </button>

              {/* 4. Video + AI Library (Dedicated Standalone Video Masterclass) */}
              <button
                id="main-nav-video-ai-btn"
                type="button"
                onClick={() => setMainNavTab('video_ai')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.32rem 0.8rem',
                  borderRadius: '9999px',
                  background:
                    mainNavTab === 'video_ai'
                      ? 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)'
                      : 'transparent',
                  border: 'none',
                  color: mainNavTab === 'video_ai' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow:
                    mainNavTab === 'video_ai'
                      ? '0 2px 10px rgba(236, 72, 153, 0.4)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Video + AI Library: Studio Video Masterclasses with structured 1.1 / 1.2 chapter navigation and enterprise playback controls"
              >
                <Tv size={13} />
                <span>Video + AI</span>
              </button>

              {/* 5. Intelli Coach (Dedicated Interactive AI Coaching & Diagnostic Onboarding) */}
              <button
                id="main-nav-intelli-coach-btn"
                type="button"
                onClick={() => setMainNavTab('intelli_coach')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.32rem 0.8rem',
                  borderRadius: '9999px',
                  background:
                    mainNavTab === 'intelli_coach'
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                      : 'transparent',
                  border: 'none',
                  color: mainNavTab === 'intelli_coach' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow:
                    mainNavTab === 'intelli_coach'
                      ? '0 2px 10px rgba(16, 185, 129, 0.4)'
                      : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Intelli Coach: Interactive AI Tutoring, Diagnostic Onboarding & Personalized Curriculum Blueprints"
              >
                <Bot size={13} />
                <span>Intelli Coach</span>
              </button>
            </div>

            {/* Theme Selector Dropdown (Includes Anti-Reflection Sunlight Mode) */}
            <div style={{ position: 'relative' }}>
              <button
                id="theme-switcher-btn"
                type="button"
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.38rem',
                  padding: '0.32rem 0.75rem',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-main)',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Select Color Palette & Sunlight Anti-Glare Mode"
              >
                {theme === 'sunny-day' ? (
                  <Sun size={13} color="#f59e0b" />
                ) : theme === 'obsidian' ? (
                  <Moon size={13} color="#818cf8" />
                ) : theme === 'sapphire' ? (
                  <Droplets size={13} color="#38bdf8" />
                ) : theme === 'emerald' ? (
                  <Sparkles size={13} color="#34d399" />
                ) : (
                  <Palette size={13} color="#fbbf24" />
                )}
                <span>
                  {THEME_OPTIONS.find((t) => t.id === theme)?.name || 'Theme'}
                </span>
                <ChevronDown size={11} style={{ opacity: 0.6 }} />
              </button>

              {/* Theme Menu Dropdown */}
              {isThemeMenuOpen && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                    onClick={() => setIsThemeMenuOpen(false)}
                  />
                  <div
                    className="animate-fade-in"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 0.4rem)',
                      width: '260px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '0.85rem',
                      padding: '0.4rem',
                      boxShadow: '0 15px 35px -5px rgba(0, 0, 0, 0.5), 0 0 15px var(--accent-glow)',
                      zIndex: 95,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                  >
                    <div style={{ padding: '0.4rem 0.6rem 0.2rem 0.6rem', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Color Palette & Sunlight Mode
                    </div>

                    {THEME_OPTIONS.map((t) => {
                      const IconComp = t.icon;
                      const isSelected = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTheme(t.id);
                            setIsThemeMenuOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.65rem',
                            borderRadius: '0.5rem',
                            background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                            border: isSelected ? '1px solid var(--border-focus)' : '1px solid transparent',
                            color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '6px',
                                background: isSelected ? t.color : 'rgba(255, 255, 255, 0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isSelected ? '#ffffff' : t.color,
                              }}
                            >
                              <IconComp size={12} />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                {t.name}
                              </div>
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-subtle)' }}>
                                {t.badge}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check size={13} color="var(--accent-primary)" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* View Mode Switcher: Standalone Intelli Coach vs Slide + AI vs Video + AI vs Admin Library vs Home / Chat Workspace */}
        {mainNavTab === 'intelli_coach' ? (
          <IntelliCoachView
            key="intelli_coach_standalone_view"
            onLaunchCourse={(_courseTitle, targetAudience, promptQuery) => {
              setMainNavTab('home');
              const targetAudienceValue = targetAudience || 'General Student / Lifelong Learner';
              localStorage.setItem('ila_learner_category', targetAudienceValue);
              handleNewChat().then(() => {
                if (promptQuery) {
                  executeAutonomousCoursePlan(promptQuery, [], targetAudienceValue);
                }
              });
            }}
            onOpenReadingTab={() => setMainNavTab('home')}
            onOpenSlideTab={() => setMainNavTab('slide_ai')}
            onOpenVideoTab={() => setMainNavTab('video_ai')}
          />
        ) : mainNavTab === 'slide_ai' ? (
          <SlideAiLibraryView
            key="slide_ai_standalone_view"
            onOpenCreator={() => {
              setMainNavTab('home');
              handleNewChat();
            }}
          />
        ) : mainNavTab === 'video_ai' ? (
          <VideoAiLibraryView
            key="video_ai_standalone_view"
            onOpenCreator={() => {
              setMainNavTab('home');
              handleNewChat();
            }}
          />
        ) : mainNavTab === 'admin_library' ? (
          <DedicatedLibraryView
            onOpenInWorkspace={(course: LibraryCourse) => {
              const matchedSession = sessions.find((s) => s.id === course.sourceSessionId);
              if (matchedSession) {
                setActiveSessionId(matchedSession.id);
              }
              setMainNavTab('home');
            }}
            onBackToChat={() => setMainNavTab('home')}
            onCreateNewCourse={() => {
              setMainNavTab('home');
              handleNewChat();
            }}
          />
        ) : (
          <>
            {/* Upper Search Bar & Creator Controls (Relocated into Flush Sticky Container) */}
            <div
              id="upper-search-container"
              style={{
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--header-bg)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '0.55rem 1.25rem 0.5rem 1.25rem',
                zIndex: 28,
                flexShrink: 0,
              }}
            >
              <div style={{ width: '100%', maxWidth: '100%', margin: '0' }}>
                <SearchBox
                  key={activeSessionId || 'default'}
                  onSendMessage={handleSendMessage}
                  loading={loading}
                  attachedDocuments={attachedDocuments}
                  onDocumentsChange={setAttachedDocuments}
                  placeholder="Create enterprise course or ask anything..."
                  onNewChat={handleNewChat}
                  isBulkPlannerActive={isBulkPlannerActive}
                  onToggleBulkPlanner={setIsBulkPlannerActive}
                />
              </div>
            </div>            {/* Direct Comprehensive Course Workspace View */}
            {activeSession && activeSession.messages.length > 0 ? (
              <div
                id="main-course-workspace-container"
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Real-time AI Generation Progress Notification Banner */}
                {loading && (
                  <div
                    style={{
                      padding: '0.45rem 1.5rem',
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                      borderBottom: '1px solid rgba(165, 180, 252, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.78rem',
                      color: '#c7d2fe',
                      fontWeight: 600,
                      animation: 'pulse 2s infinite ease-in-out',
                      zIndex: 25,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={14} className="animate-spin" color="var(--accent-primary)" />
                      <span>ILA AI is actively authoring & compiling your course curriculum in real-time...</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', opacity: 0.85, color: '#a5b4fc' }}>
                      Auto-compiling to SQLite Course Workspace
                    </span>
                  </div>
                )}

                <LibraryWorkspaceView
                  key={activeSession.id}
                  session={activeSession}
                  onSpeak={speak}
                  isSpeaking={isSpeaking}
                  activeSpeakingId={activeSpeakingId}
                  onUpdateSessionMessage={handleUpdateSessionMessage}
                  onOpenQuestionTree={() => setIsQuestionTreeOpen(true)}
                  totalQuestions={totalUserQuestions}
                />
              </div>
            ) : (
              /* Blank / Starter Hero Banner when no messages in session */
              <div
                id="workspace-starter-hero"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '2rem 1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  maxWidth: '1000px',
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                {loading ? (
                  <div
                    style={{
                      width: '100%',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '1.25rem',
                      padding: '2.5rem 2rem',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1rem',
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '1rem',
                        background: 'var(--accent-gradient)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 20px var(--accent-glow)',
                      }}
                    >
                      <RefreshCw size={24} className="animate-spin" color="#ffffff" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                      Authoring Masterclass with ILA AI...
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', maxWidth: '500px', lineHeight: '1.5' }}>
                      Decomposing multi-book architecture, structuring curriculum roadmaps, and synthesizing complete textbooks with lab exercises.
                    </p>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '1.25rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '9999px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.8rem',
                        color: '#818cf8',
                        fontWeight: 600,
                      }}
                    >
                      <Sparkles size={14} />
                      <span>ILA AI Course Creator • Ila Academy [v6]</span>
                    </div>

                    <h2
                      style={{
                        fontSize: '2.4rem',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        background: 'linear-gradient(180deg, #FFFFFF 0%, #cbd5e1 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        lineHeight: '1.2',
                      }}
                    >
                      ILA Course Creator Studio
                    </h2>

                    <p style={{ fontSize: '0.94rem', color: 'var(--text-subtle)', maxWidth: '620px', lineHeight: '1.6' }}>
                      Enter any topic, curriculum standard, or upload reference documents to generate an authoritative multi-book masterclass with dynamic slides, video tutors, and exams.
                    </p>

                    {/* Error Alert Box */}
                    {error && !loading && (
                      <div
                        className="animate-fade-in"
                        style={{
                          background: 'var(--error-bg)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '1rem',
                          padding: '1.25rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.875rem',
                          width: '100%',
                          marginTop: '1rem',
                        }}
                      >
                        <AlertCircle size={22} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                          <h4 style={{ color: 'var(--error)', fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                            Error communicating with ILA AI
                          </h4>
                          <p style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.85rem', lineHeight: '1.5' }}>
                            {error}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (activeSession && activeSession.messages.length > 0) {
                              const lastUser = [...activeSession.messages].reverse().find((m) => m.role === 'user');
                              if (lastUser) {
                                handleSendMessage(lastUser.content, lastUser.documents || []);
                              }
                            }
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            color: '#ffffff',
                            borderRadius: '0.45rem',
                            padding: '0.35rem 0.65rem',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          <RefreshCw size={13} />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Preserved Bottom Info Bar */}
            <div
              style={{
                borderTop: '1px solid var(--border-subtle)',
                background: 'rgba(10, 13, 20, 0.95)',
                padding: '0.45rem 1.5rem',
                textAlign: 'center',
                fontSize: '0.72rem',
                color: 'var(--text-subtle)',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>Ila Course Creator [v6] • SQLite Local DB</span>
                {totalUserQuestions > 0 && (
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                    • {totalUserQuestions} {totalUserQuestions === 1 ? 'Question' : 'Questions'} Active
                  </span>
                )}
              </div>
              <div>
                <span>Powered by Ila Academy</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Question Tree & Query Navigation Drawer */}
      <QuestionTreeDrawer
        isOpen={isQuestionTreeOpen}
        onClose={() => setIsQuestionTreeOpen(false)}
        messages={activeSession?.messages || []}
        activeQuestionId={activeQuestionId}
        onJumpToMessage={handleJumpToMessage}
      />

      {/* Interactive Masterclass Video Player Modal in Chat / Workspace */}
      {activeVideoCourseData && (
        <MasterclassVideoPlayer
          courseTitle={activeVideoCourseData.courseTitle}
          chapterTitle={activeVideoCourseData.chapterTitle}
          chapterNumber={activeVideoCourseData.chapterNumber}
          chapterContent={activeVideoCourseData.chapterContent}
          initialTopicNumber={activeVideoCourseData.topicNumber}
          onClose={() => setActiveVideoCourseData(null)}
        />
      )}

      {/* Presentation-Ready Teaching Slides Modal in Chat / Workspace */}
      {activeSlidesData && (
        <TeachingSlidesModal
          courseTitle={activeSlidesData.courseTitle}
          chapterTitle={activeSlidesData.chapterTitle}
          chapterNumber={activeSlidesData.chapterNumber}
          chapterContent={activeSlidesData.chapterContent}
          activeLanguage={globalLanguage}
          activeVoiceProfile={globalVoiceProfile}
          onClose={() => setActiveSlidesData(null)}
          onOpenInVideo={() => {
            const data = activeSlidesData;
            setActiveSlidesData(null);
            setActiveVideoCourseData({
              courseTitle: data.courseTitle,
              chapterTitle: data.chapterTitle,
              chapterNumber: data.chapterNumber,
              chapterContent: data.chapterContent,
              topicNumber: `${data.chapterNumber}.1`,
            });
          }}
        />
      )}
    </div>
  );
}
