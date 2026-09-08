import { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Copy,
  Volume2,
  VolumeX,
  FileText,
  Search,
  Sparkles,
  Send,
  Loader2,
  X,
  Wand2,
  ExternalLink,
  Video,
  Presentation,
  History,
  RotateCcw,
  Clock,
  Save,
  Award,
  HelpCircle,
  UserCheck,
  Download,
  ListTree,
  GraduationCap,
  CheckSquare,
  Square,
  Edit3,
  Trash2,
  Plus,
  AlertCircle,
  Bot,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import MasterclassVideoPlayer from './MasterclassVideoPlayer';
import AuthorizedCurriculumBanner from './AuthorizedCurriculumBanner';
import TeachingSlidesModal from './TeachingSlidesModal';
import SlideDecksViewer from './SlideDecksViewer';
import AuthorizedCourseStructureTab from './AuthorizedCourseStructureTab';
import IntelliCoachView from './IntelliCoachView';
import ExplanationsBoard from './ExplanationsBoard';
import ExamsBoard from './ExamsBoard';
import CourseDictionary from './CourseDictionary';
import { downloadWordDocx } from '../services/docxExportService';
import { generateIlaResponse } from '../services/geminiService';
import { LEARNER_CATEGORIES, type ChatSession, type CourseChapter, type LibraryCourse } from '../services/dbService';
import {
  compileCourseFromChatSession,
  saveLibraryCourse,
  saveCourseVersionSnapshot,
  restoreCourseVersion,
  batchGenerateAndSaveDepartmentCourses,
} from '../services/dbService';

interface LibraryWorkspaceViewProps {
  session: ChatSession;
  onBackToChat?: () => void;
  onSpeak: (text: string, id: string, lang?: string) => void;
  isSpeaking: boolean;
  activeSpeakingId: string | null;
  onUpdateSessionMessage?: (messageId: string, updatedContent: string) => Promise<void>;
  onOpenQuestionTree?: () => void;
  totalQuestions?: number;
}

export default function LibraryWorkspaceView({
  session,
  onBackToChat: _onBackToChat,
  onSpeak,
  isSpeaking,
  activeSpeakingId,
  onUpdateSessionMessage,
  onOpenQuestionTree,
  totalQuestions,
}: LibraryWorkspaceViewProps) {
  // Compile structured course chapters from session
  const [compiledCourse, setCompiledCourse] = useState<LibraryCourse>(() => {
    return compileCourseFromChatSession(session);
  });

  // Re-sync compiledCourse whenever active session, message count or updated timestamp changes
  useEffect(() => {
    setCompiledCourse(compileCourseFromChatSession(session));
    if (session.studiedBy) {
      setSelectedAudience(session.studiedBy);
    }
  }, [session.id, session.messages.length, session.updatedAt]);

  // Unified Workspace Navigation Tab Type ('reading' | 'structure' | 'slides' | 'video' | 'explanations' | 'dictionary' | 'exams' | 'coach')
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    'reading' | 'structure' | 'slides' | 'video' | 'explanations' | 'dictionary' | 'exams' | 'coach'
  >('reading');

  // Audience-Adaptive Personalization ("Studied By" Feature)
  const [selectedAudience, setSelectedAudience] = useState<string>(() => {
    return (
      compiledCourse.studiedBy ||
      session.studiedBy ||
      localStorage.getItem('ila_learner_category') ||
      'General Student / Lifelong Learner'
    );
  });
  const [isAudienceMenuOpen, setIsAudienceMenuOpen] = useState<boolean>(false);

  // Universal Multi-Language & Open-Source Voice Profile States
  const [workspaceLanguage, setWorkspaceLanguage] = useState<string>(() => {
    return localStorage.getItem('ila_active_language') || 'en-US';
  });
  const [workspaceVoiceProfile, setWorkspaceVoiceProfile] = useState<string>(() => {
    const saved = localStorage.getItem('ila_active_voice_profile');
    if (saved && !saved.startsWith('piper')) return saved;
    return 'coqui-xtts-multilingual';
  });

  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(() => {
    return compiledCourse.chapters[0]?.id || null;
  });
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToLib, setSavedToLib] = useState<boolean>(false);
  const [indexSearchTerm, setIndexSearchTerm] = useState<string>('');

  // Interactive Masterclass Video Player Topic Number State
  const [activeVideoTopicNumber, setActiveVideoTopicNumber] = useState<string | undefined>(undefined);

  // Presentation-Ready Teaching Slides State
  const [showSlidesModal, setShowSlidesModal] = useState<boolean>(false);

  // In-Place Chapter AI Refinement State
  const [refiningChapterId, setRefiningChapterId] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState<string>('');
  const [targetSectionTitle, setTargetSectionTitle] = useState<string | null>(null);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refineSuccess, setRefineSuccess] = useState<boolean>(false);

  // Local Version Tracking & Auto-Save States
  const [versionSaveStatus, setVersionSaveStatus] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState<boolean>(false);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [explicitSaveStatus, setExplicitSaveStatus] = useState<string | null>(null);

  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() =>
    LEARNER_CATEGORIES.filter((c) => c.id !== 'all_categories').map((c) => c.id)
  );
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string>('');
  // Dedicated Full-Page Module Workspace & Inline Editing Suite States
  const [isModuleFullScreen, setIsModuleFullScreen] = useState<boolean>(false);
  const [showDirectEditorModal, setShowDirectEditorModal] = useState<boolean>(false);
  const [directEditContent, setDirectEditContent] = useState<string>('');
  const [showDeleteChapterModal, setShowDeleteChapterModal] = useState<boolean>(false);
  const [showAddNewChapterModal, setShowAddNewChapterModal] = useState<boolean>(false);
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');
  const [newChapterContent, setNewChapterContent] = useState<string>('');

  const initialUserQuery = useMemo(() => {
    const userMsg = session.messages?.find((m) => m.role === 'user');
    return userMsg?.content || session.title || compiledCourse.title;
  }, [session.messages, session.title, compiledCourse.title]);

  const handleModuleScriptUpdate = (updatedMd: string) => {
    if (!activeChapter) return;
    const updatedChapters = compiledCourse.chapters.map((ch) =>
      ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
    );
    const updatedCourse = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
    setCompiledCourse(updatedCourse);
    setHasUnsavedChanges(true);
  };

  const handleExplicitSaveToLibrary = async () => {
    setIsAutoSaving(true);
    try {
      await saveLibraryCourse(compiledCourse);
      if (onUpdateSessionMessage && session.messages && activeChapter) {
        const assistantMsgs = session.messages.filter((m) => m.role === 'assistant');
        const targetMsg = assistantMsgs[activeChapterIndex];
        if (targetMsg) {
          await onUpdateSessionMessage(targetMsg.id, activeChapter.content);
        }
      }
      setHasUnsavedChanges(false);
      setExplicitSaveStatus('Saved to Library!');
      setTimeout(() => setExplicitSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to save library course:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleRestoreVersionSnapshot = async (versionId: string) => {
    try {
      const updated = await restoreCourseVersion(compiledCourse, versionId);
      setCompiledCourse(updated);
      setActiveChapterIndex(0);
      setHasUnsavedChanges(false);
      setExplicitSaveStatus(`Restored to ${updated.activeVersionNumber || 'Version'}!`);
      setShowVersionHistory(false);
      setTimeout(() => setExplicitSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to restore version snapshot:', err);
    }
  };

  const handleExitDedicatedModulePage = async () => {
    if (hasUnsavedChanges) {
      try {
        const { updatedCourse } = await saveCourseVersionSnapshot(
          compiledCourse,
          true,
          `Auto-Snapshot on Exit (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
        );
        setCompiledCourse(updatedCourse);
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('Failed to auto-save snapshot on exit:', err);
      }
    }
    setIsModuleFullScreen(false);
  };

  const handleDirectEditSave = async () => {
    if (!activeChapter) return;
    const updatedChapters = compiledCourse.chapters.map((ch) =>
      ch.id === activeChapter.id ? { ...ch, content: directEditContent } : ch
    );
    const updatedCourse = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
    setCompiledCourse(updatedCourse);
    setHasUnsavedChanges(true);
    setShowDirectEditorModal(false);
  };

  const handleDeleteActiveChapter = async () => {
    if (!activeChapter || compiledCourse.chapters.length <= 1) {
      alert('A course must contain at least one book/chapter.');
      return;
    }
    const updatedChapters = compiledCourse.chapters.filter((ch) => ch.id !== activeChapter.id);
    const reindexed = updatedChapters.map((ch, idx) => ({ ...ch, chapterNumber: idx + 1 }));
    const updatedCourse = { ...compiledCourse, chapters: reindexed, updatedAt: Date.now() };
    setCompiledCourse(updatedCourse);
    setHasUnsavedChanges(true);
    setActiveChapterIndex((prev) => Math.max(0, prev - 1));
    setShowDeleteChapterModal(false);
  };

  const handleAddNewChapter = async () => {
    if (!newChapterTitle.trim()) return;
    const newNum = compiledCourse.chapters.length + 1;
    const newChap: CourseChapter = {
      id: `chap_${Date.now()}`,
      chapterNumber: newNum,
      title: newChapterTitle.trim(),
      content:
        newChapterContent.trim() ||
        `## Book ${newNum}: ${newChapterTitle.trim()}\n\nOverview and foundational principles of ${newChapterTitle.trim()}.\n\n### 1. Architectural Model\nComprehensive concepts, mechanisms, and real-world implementations.`,
      subTopics: [],
    };
    const updatedCourse = {
      ...compiledCourse,
      chapters: [...compiledCourse.chapters, newChap],
      updatedAt: Date.now(),
    };
    setCompiledCourse(updatedCourse);
    setHasUnsavedChanges(true);
    setActiveChapterIndex(compiledCourse.chapters.length);
    setExpandedChapterId(newChap.id);
    setShowAddNewChapterModal(false);
    setNewChapterTitle('');
    setNewChapterContent('');
  };

  const handleBatchDepartmentGeneration = async () => {
    if (selectedDepartments.length === 0 || isBatchGenerating) return;
    setIsBatchGenerating(true);
    setBatchSuccessMessage('');
    try {
      const saved = await batchGenerateAndSaveDepartmentCourses(
        session,
        compiledCourse.title,
        selectedDepartments
      );
      setBatchSuccessMessage(`✨ Generated & saved ${saved.length} department adaptations!`);
      setTimeout(() => setBatchSuccessMessage(''), 4500);
    } catch (err) {
      console.error('Batch generation error:', err);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  // Auto-Save / Update New Version Execution
  const handleUpdateSaveNewVersion = async (isAuto: boolean = false, customLabel?: string) => {
    setIsAutoSaving(true);
    try {
      const { updatedCourse, newVersion } = await saveCourseVersionSnapshot(compiledCourse, isAuto, customLabel);
      setCompiledCourse(updatedCourse);
      setVersionSaveStatus(isAuto ? `Auto-Saved (${newVersion.versionNumber})` : `${newVersion.versionNumber} Saved`);
      setTimeout(() => setVersionSaveStatus(null), 3500);
    } catch (err) {
      console.error('Failed to create version snapshot:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };



  const activeChapter: CourseChapter | undefined =
    compiledCourse.chapters[activeChapterIndex] || compiledCourse.chapters[0];

  // Filter chapters for left menu search
  const filteredChapters = useMemo(() => {
    if (!indexSearchTerm.trim()) return compiledCourse.chapters;
    const term = indexSearchTerm.toLowerCase().trim();
    return compiledCourse.chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        `book ${c.chapterNumber}`.includes(term) ||
        c.subTopics?.some((s) => s.title.toLowerCase().includes(term))
    );
  }, [compiledCourse.chapters, indexSearchTerm]);

  // Accordion toggle: expands the selected chapter and switches to reading view
  const handleToggleAccordion = (chapId: string, originalIndex: number) => {
    setActiveChapterIndex(originalIndex);
    setExpandedChapterId((prev) => (prev === chapId ? null : chapId));
    setActiveWorkspaceTab('reading');
  };

  // Smooth scroll to sub-topic anchor in content viewer
  const handleJumpToSubTopic = (subTopicTitle: string, chapterIndex: number) => {
    setActiveChapterIndex(chapterIndex);
    setActiveWorkspaceTab('reading');
    setTimeout(() => {
      const cleanSlug = subTopicTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      let targetEl = document.getElementById(`heading-${cleanSlug}`);

      if (!targetEl) {
        const allHeadings = document.querySelectorAll('h1, h2, h3, h4, [id^="heading-"]');
        for (let i = 0; i < allHeadings.length; i++) {
          const el = allHeadings[i];
          const text = el.textContent?.toLowerCase() || '';
          if (
            text.includes(subTopicTitle.toLowerCase()) ||
            subTopicTitle.toLowerCase().includes(text)
          ) {
            targetEl = el as HTMLElement;
            break;
          }
        }
      }

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetEl.style.transition = 'all 0.4s ease';
        targetEl.style.outline = '2px solid rgba(168, 85, 247, 0.8)';
        targetEl.style.borderRadius = '0.35rem';
        setTimeout(() => {
          targetEl!.style.outline = 'none';
        }, 1800);
      } else {
        const reader = document.getElementById('workspace-content-scroll');
        if (reader) reader.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 120);
  };

  const handleCopyChapter = () => {
    if (!activeChapter) return;
    navigator.clipboard.writeText(activeChapter.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadDocx = async () => {
    if (!compiledCourse) return;
    try {
      const fullDoc = compiledCourse.chapters
        .map(
          (c) =>
            `# Book ${c.chapterNumber}: ${c.title}\n\n${c.summary || ''}\n\n${c.content}\n\n---\n\n`
        )
        .join('\n');
      await downloadWordDocx(fullDoc, `${compiledCourse.title} - Masterclass Course`);
    } catch (err) {
      console.error('Word export error:', err);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!compiledCourse) return;
    try {
      const fullDoc = compiledCourse.chapters
        .map(
          (c) =>
            `# Book ${c.chapterNumber}: ${c.title}\n\n${c.summary || ''}\n\n${c.content}\n\n---\n\n`
        )
        .join('\n');
      const blob = new Blob([fullDoc], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const sanitized = compiledCourse.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${sanitized || 'course_curriculum'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Markdown export error:', err);
    }
  };

  const handleSaveToMainLibrary = async () => {
    try {
      await saveLibraryCourse(compiledCourse);
      setSavedToLib(true);
      setTimeout(() => setSavedToLib(false), 3000);
    } catch (err) {
      console.error('Failed to save to Library:', err);
    }
  };

  // Trigger in-place section editing from markdown pencil icons
  const handleEditSection = (sectionHeading: string) => {
    if (!activeChapter) return;
    setTargetSectionTitle(sectionHeading);
    setRefiningChapterId(activeChapter.id);
    setRefineInstruction(`Please enhance and expand the section: "${sectionHeading}" with deep practical workflows, field examples, and clear technical explanations.`);
    const scrollEl = document.getElementById('fullpage-reading-content-scroll') || document.getElementById('workspace-content-scroll');
    if (scrollEl) scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Execute in-place AI refinement for the active chapter or targeted sub-section
  const handleExecuteRefinement = async (chapter: CourseChapter) => {
    if (!refineInstruction.trim() || isRefining) return;
    setIsRefining(true);
    setRefineSuccess(false);

    try {
      const refinementPrompt = `You are ILA AI, the Master Educational Editor.
Refine and enhance the following course chapter content based strictly on this instruction:
INSTRUCTION: "${refineInstruction.trim()}"

TARGET CHAPTER: Book ${chapter.chapterNumber}: ${chapter.title}
${targetSectionTitle ? `SPECIFIC FOCUS SECTION: "${targetSectionTitle}"` : 'FULL CHAPTER REFINEMENT'}

CURRENT CHAPTER CONTENT:
${chapter.content}

CRITICAL RULES:
1. Maintain all Markdown syntax: headers (#, ##, ###), bold highlights, tables, and code blocks intact.
2. PRESERVE all Markdown screenshot/image URLs intact (![Title](URL)).
3. Apply the instruction thoroughly to upgrade the educational rigor, clarity, or depth.
4. Output ONLY the refined complete Markdown text for this chapter.`;

      const refinedText = await generateIlaResponse(refinementPrompt, []);

      if (refinedText && refinedText.trim()) {
        const updatedChapters = compiledCourse.chapters.map((ch) =>
          ch.id === chapter.id ? { ...ch, content: refinedText } : ch
        );
        const updatedCourse = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
        setCompiledCourse(updatedCourse);

        const assistantMsgs = session.messages.filter((m) => m.role === 'assistant');
        const targetMsg = assistantMsgs[chapter.chapterNumber - 1] || assistantMsgs[0];
        if (targetMsg && onUpdateSessionMessage) {
          await onUpdateSessionMessage(targetMsg.id, refinedText);
        }

        await saveLibraryCourse(updatedCourse);

        setRefineSuccess(true);
        setRefineInstruction('');
        setTargetSectionTitle(null);
        setTimeout(() => {
          setRefiningChapterId(null);
          setRefineSuccess(false);
        }, 2000);
      }
    } catch (err) {
      console.error('AI Chapter refinement failed:', err);
      alert('AI refinement encountered an error. Please verify your connection.');
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div
      id="library-workspace-view"
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-primary)',
        color: 'var(--text-main)',
        overflow: 'hidden',
      }}
    >
      {/* Sticky Active Query & Result Context Header */}
      <div
        id="workspace-sticky-query-context"
        style={{
          padding: '0.45rem 1.25rem',
          background: 'rgba(10, 14, 26, 0.98)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '0.4rem',
              background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              color: '#a5b4fc',
              fontSize: '0.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}
          >
            <Sparkles size={11} color="#c084fc" />
            <span>Active Prompt</span>
          </div>
          <div
            style={{
              fontSize: '0.8rem',
              color: '#ffffff',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={initialUserQuery}
          >
            "{initialUserQuery}"
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          <div
            style={{
              fontSize: '0.7rem',
              color: '#7dd3fc',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '0.15rem 0.55rem',
              borderRadius: '9999px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <UserCheck size={11} />
            <span>{compiledCourse.studiedBy || selectedAudience}</span>
          </div>
          <div
            style={{
              fontSize: '0.68rem',
              color: 'var(--text-subtle)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '0.15rem 0.5rem',
              borderRadius: '9999px',
            }}
          >
            {compiledCourse.chapters.length} Books • {totalQuestions || 0} Topics
          </div>
        </div>
      </div>

      {/* Unified Single Master Toolbar Architecture (Exact Unbroken Sequential Flow) */}
      <div
        id="workspace-unified-master-toolbar"
        style={{
          padding: '0.5rem 1.25rem',
          background: 'rgba(15, 20, 32, 0.96)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          flexWrap: 'wrap',
          flexShrink: 0,
          position: 'relative',
          zIndex: 60,
          overflow: 'visible',
        }}
      >
        {/* Left & Center Sequence: Modules 1-6 -> Refine -> Save & Version -> Download, Speaker, Copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          {/* 1 to 7: Core Learning Modules */}
          {[
            { id: 'reading', label: '1. Reading', icon: BookOpen, color: '#38bdf8' },
            { id: 'explanations', label: '2. Tutor Bot', icon: GraduationCap, color: '#a855f7' },
            { id: 'slides', label: '3. Slide + AI', icon: Presentation, color: '#f472b6' },
            { id: 'video', label: '4. Video + AI', icon: Video, color: '#f43f5e' },
            { id: 'coach', label: '5. Intelli Coach', icon: Bot, color: '#10b981' },
            { id: 'exams', label: '6. Exam Board', icon: Award, color: '#fbbf24' },
            { id: 'dictionary', label: '7. Glossary', icon: HelpCircle, color: '#2dd4bf' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive =
              activeWorkspaceTab === tab.id ||
              (tab.id === 'reading' &&
                (activeWorkspaceTab === 'reading' || activeWorkspaceTab === 'structure'));
            return (
              <button
                key={tab.id}
                id={`ws-tab-${tab.id}`}
                type="button"
                onClick={() => {
                  setActiveWorkspaceTab(tab.id as any);
                  setIsModuleFullScreen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '9999px',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isActive
                    ? `1.5px solid ${tab.color}`
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? `0 0 10px ${tab.color}33` : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={12} color={isActive ? tab.color : 'var(--text-subtle)'} />
                <span>{tab.label}</span>
              </button>
            );
          })}



          {/* Question Tree Drawer Toggle if questions exist */}
          {onOpenQuestionTree && (totalQuestions || 0) > 0 && (
            <button
              id="workspace-question-tree-btn"
              type="button"
              onClick={onOpenQuestionTree}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px',
                padding: '0 0.55rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                border: '1px solid rgba(165, 180, 252, 0.35)',
                color: 'var(--text-main)',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 10px var(--accent-glow)',
                transition: 'all 0.15s ease',
              }}
              title="Open Question History Navigation Drawer"
            >
              <ListTree size={11} color="var(--accent-primary)" />
              <span>{totalQuestions} Qs</span>
            </button>
          )}

          {/* Section Divider */}
          <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 0.15rem' }} />

          {/* 7. Refine with AI (Compact: 'Refine') */}
          {activeChapter && (
            <button
              id="workspace-refine-chapter-btn"
              type="button"
              onClick={() => {
                setRefiningChapterId((prev) => (prev === activeChapter.id ? null : activeChapter.id));
                setTargetSectionTitle(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px',
                padding: '0 0.65rem',
                borderRadius: '9999px',
                background:
                  refiningChapterId === activeChapter.id
                    ? 'rgba(168, 85, 247, 0.25)'
                    : 'rgba(255, 255, 255, 0.06)',
                border:
                  refiningChapterId === activeChapter.id
                    ? '1px solid rgba(168, 85, 247, 0.5)'
                    : '1px solid var(--border-subtle)',
                color: refiningChapterId === activeChapter.id ? '#c084fc' : 'var(--text-main)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Refine active chapter content with AI"
            >
              <Wand2 size={12} color="#c084fc" />
              <span>Refine</span>
            </button>
          )}

          {/* 8. Save to Library (Compact: 'Save') & Save Version (Compact: 'Version') */}
          <button
            id="workspace-save-library-btn"
            type="button"
            onClick={handleSaveToMainLibrary}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              height: '28px',
              padding: '0 0.65rem',
              borderRadius: '9999px',
              background: savedToLib
                ? 'rgba(16, 185, 129, 0.25)'
                : 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
              border: savedToLib
                ? '1px solid rgba(16, 185, 129, 0.5)'
                : '1px solid rgba(165, 180, 252, 0.45)',
              color: savedToLib ? '#34d399' : '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.25)',
            }}
            title="Save course to SQLite & IndexedDB"
          >
            {savedToLib ? <Check size={11} /> : <Bookmark size={11} />}
            <span>{savedToLib ? 'Saved' : 'Save'}</span>
          </button>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
            <button
              id="workspace-save-new-version-btn"
              type="button"
              onClick={() => handleUpdateSaveNewVersion(false)}
              disabled={isAutoSaving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px',
                padding: '0 0.65rem',
                borderRadius: '9999px 0 0 9999px',
                background: versionSaveStatus
                  ? 'rgba(99, 102, 241, 0.25)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: versionSaveStatus
                  ? '1px solid rgba(99, 102, 241, 0.5)'
                  : '1px solid rgba(255, 255, 255, 0.15)',
                borderRight: 'none',
                color: versionSaveStatus ? '#a5b4fc' : '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: isAutoSaving ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Create a new immutable version history snapshot"
            >
              {isAutoSaving ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : versionSaveStatus ? (
                <>
                  <Check size={11} color="#a5b4fc" />
                  <span>{versionSaveStatus}</span>
                </>
              ) : (
                <>
                  <Save size={11} color="#38bdf8" />
                  <span>Version</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              style={{
                height: '28px',
                padding: '0 0.45rem',
                borderRadius: '0 9999px 9999px 0',
                background: showVersionHistory
                  ? 'rgba(99, 102, 241, 0.3)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-main)',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.15rem',
              }}
              title="View version iterations"
            >
              <Clock size={10} color="var(--text-subtle)" />
              <span>{(compiledCourse.versions || []).length}</span>
            </button>
          </div>

          {/* Section Divider */}
          <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 0.15rem' }} />

          {/* 9. Download, Speaker, & Copy */}
          <div style={{ position: 'relative' }}>
            <button
              id="workspace-download-export-btn"
              type="button"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px',
                padding: '0 0.65rem',
                borderRadius: '9999px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                color: '#a5b4fc',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              title="Download Course Documents (DOCX / Markdown)"
            >
              <Download size={11} color="#818cf8" />
              <span>Download</span>
              <ChevronDown size={9} />
            </button>

            {isExportMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99990 }}
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 'calc(100% + 0.35rem)',
                    width: '200px',
                    background: '#0c101e',
                    border: '1px solid rgba(99, 102, 241, 0.55)',
                    borderRadius: '0.65rem',
                    padding: '0.35rem',
                    boxShadow: '0 20px 45px rgba(0, 0, 0, 0.95), 0 0 20px rgba(99, 102, 241, 0.35)',
                    zIndex: 99999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleDownloadDocx();
                      setIsExportMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.4rem',
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <FileText size={12} color="#818cf8" />
                    <span>Word (.docx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleDownloadMarkdown();
                      setIsExportMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.4rem',
                      background: 'transparent',
                      border: 'none',
                      color: '#cbd5e1',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <Download size={12} color="#38bdf8" />
                    <span>Markdown (.md)</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {activeChapter && (
            <button
              id="workspace-speak-btn"
              type="button"
              onClick={() => onSpeak(activeChapter.content, activeChapter.id, workspaceLanguage)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px',
                padding: '0 0.65rem',
                borderRadius: '9999px',
                background:
                  isSpeaking && activeSpeakingId === activeChapter.id
                    ? 'rgba(99, 102, 241, 0.25)'
                    : 'rgba(255, 255, 255, 0.05)',
                border:
                  isSpeaking && activeSpeakingId === activeChapter.id
                    ? '1px solid rgba(99, 102, 241, 0.5)'
                    : '1px solid var(--border-subtle)',
                color:
                  isSpeaking && activeSpeakingId === activeChapter.id
                    ? 'var(--accent-primary)'
                    : 'var(--text-muted)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              title={isSpeaking && activeSpeakingId === activeChapter.id ? 'Stop reading' : 'Read active chapter aloud'}
            >
              {isSpeaking && activeSpeakingId === activeChapter.id ? <VolumeX size={11} /> : <Volume2 size={11} />}
              <span>{isSpeaking && activeSpeakingId === activeChapter.id ? 'Stop' : 'Speaker'}</span>
            </button>
          )}

          {activeChapter && (
            <button
              id="workspace-copy-chapter-btn"
              type="button"
              onClick={handleCopyChapter}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px',
                padding: '0 0.65rem',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: copied ? 'var(--success)' : 'var(--text-muted)',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.15s ease',
              }}
              title="Copy active chapter content to clipboard"
            >
              {copied ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        {/* Right Section: 10. Department Selection & Multi-Generate (Positioned strictly at the very end of the workflow) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', position: 'relative', zIndex: 60 }}>
          <div style={{ position: 'relative' }}>
            <button
              id="top-workspace-studied-by-btn"
              type="button"
              onClick={() => setIsAudienceMenuOpen(!isAudienceMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                height: '28px',
                padding: '0 0.65rem',
                borderRadius: '9999px',
                background: isAudienceMenuOpen ? 'rgba(56, 189, 248, 0.25)' : 'rgba(56, 189, 248, 0.12)',
                border: isAudienceMenuOpen ? '1px solid #38bdf8' : '1px solid rgba(56, 189, 248, 0.35)',
                color: '#7dd3fc',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Select Target Departments & Multi-Generate Adaptations"
            >
              <UserCheck size={11} color="#38bdf8" />
              <span>Dept ({selectedDepartments.length})</span>
              <ChevronDown size={10} />
            </button>

            {isAudienceMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 99990 }}
                  onClick={() => setIsAudienceMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 0.35rem)',
                    width: '320px',
                    maxWidth: '90vw',
                    background: '#0c101e',
                    border: '1px solid rgba(99, 102, 241, 0.55)',
                    borderRadius: '0.75rem',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 30px rgba(99, 102, 241, 0.45)',
                    zIndex: 99999,
                    padding: '0.6rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Target Departments
                      </span>
                      <span style={{ fontSize: '0.6rem', color: '#93c5fd' }}>
                        Click or Ctrl+Click to select
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = LEARNER_CATEGORIES.filter((c) => c.id !== 'all_categories').map((c) => c.id);
                        if (selectedDepartments.length === allIds.length) {
                          setSelectedDepartments([]);
                        } else {
                          setSelectedDepartments(allIds);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38bdf8',
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {selectedDepartments.length === LEARNER_CATEGORIES.filter((c) => c.id !== 'all_categories').length
                        ? 'Deselect All'
                        : 'Select All (8)'}
                    </button>
                  </div>

                  <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '0.2rem' }}>
                    {LEARNER_CATEGORIES.filter((c) => c.id !== 'all_categories').map((cat) => {
                      const isChecked = selectedDepartments.includes(cat.id);
                      return (
                        <div
                          key={cat.id}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              // Ctrl+Click: Toggle this specific department in multi-select
                              setSelectedDepartments((prev) =>
                                prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                              );
                            } else {
                              // Standard Click: Toggle this department
                              setSelectedDepartments((prev) =>
                                prev.includes(cat.id) ? prev.filter((id) => id !== cat.id) : [...prev, cat.id]
                              );
                            }
                            setSelectedAudience(cat.name);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 0.5rem',
                            borderRadius: '0.45rem',
                            background: isChecked ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                            border: isChecked ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title="Click or Ctrl+Click to toggle department selection"
                        >
                          {isChecked ? (
                            <CheckSquare size={14} color="#38bdf8" style={{ flexShrink: 0 }} />
                          ) : (
                            <Square size={14} color="var(--text-subtle)" style={{ flexShrink: 0 }} />
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isChecked ? '#ffffff' : 'var(--text-main)' }}>
                              {cat.name}
                            </span>
                            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cat.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ paddingTop: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        handleBatchDepartmentGeneration();
                        setIsAudienceMenuOpen(false);
                      }}
                      disabled={isBatchGenerating || selectedDepartments.length === 0}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        padding: '0.5rem',
                        borderRadius: '0.45rem',
                        background: selectedDepartments.length > 0 ? 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)' : 'rgba(255, 255, 255, 0.05)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.74rem',
                        fontWeight: 800,
                        cursor: isBatchGenerating || selectedDepartments.length === 0 ? 'not-allowed' : 'pointer',
                        boxShadow: selectedDepartments.length > 0 ? '0 0 14px rgba(236, 72, 153, 0.4)' : 'none',
                      }}
                    >
                      {isBatchGenerating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      <span>{isBatchGenerating ? 'Generating...' : `Generate ${selectedDepartments.length} Dept Courses`}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Prominent Direct 'Generate Courses' Button */}
          <button
            id="workspace-generate-department-courses-btn"
            type="button"
            onClick={handleBatchDepartmentGeneration}
            disabled={isBatchGenerating || selectedDepartments.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              height: '28px',
              padding: '0 0.75rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: isBatchGenerating || selectedDepartments.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 10px rgba(236, 72, 153, 0.4)',
              transition: 'all 0.15s ease',
            }}
            title="Batch generate adapted course versions for selected departments"
          >
            {isBatchGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>{isBatchGenerating ? 'Generating...' : 'Generate'}</span>
          </button>

          {/* Feedback banner */}
          {batchSuccessMessage && (
            <div
              style={{
                fontSize: '0.68rem',
                color: '#34d399',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
              }}
            >
              <Check size={10} />
              <span>{batchSuccessMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Body: Left Sticky Accordion Index + Center Content Reader */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Left Sticky Book / Chapter Accordion Navigation Menu */}
        <aside
          style={{
            width: '270px',
            minWidth: '270px',
            maxWidth: '270px',
            height: '100%',
            background: 'rgba(10, 13, 22, 0.95)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          {/* Menu Search Box */}
          <div style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '0.5rem',
                padding: '0.3rem 0.6rem',
                fontSize: '0.78rem',
              }}
            >
              <Search size={13} color="var(--text-subtle)" style={{ marginRight: '0.4rem' }} />
              <input
                type="text"
                value={indexSearchTerm}
                onChange={(e) => setIndexSearchTerm(e.target.value)}
                placeholder="Search books & topics..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  width: '100%',
                  fontSize: '0.78rem',
                }}
              />
            </div>
          </div>

          {/* Shrinking/Expanding Accordion Books & Chapters List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem' }}>
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'var(--text-subtle)',
                textTransform: 'uppercase',
                marginBottom: '0.45rem',
                paddingLeft: '0.4rem',
              }}
            >
              Curriculum Books ({compiledCourse.chapters.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {filteredChapters.map((chap) => {
                const originalIndex = compiledCourse.chapters.findIndex((c) => c.id === chap.id);
                const isCurrent = originalIndex === activeChapterIndex;
                const isExpanded = expandedChapterId === chap.id;

                return (
                  <div
                    key={chap.id}
                    style={{
                      background: isCurrent
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.12) 100%)'
                        : 'rgba(255, 255, 255, 0.02)',
                      border: isCurrent
                        ? '1px solid rgba(99, 102, 241, 0.45)'
                        : '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '0.75rem',
                      overflow: 'hidden',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {/* Chapter Accordion Header Row */}
                    <div
                      onClick={() => handleToggleAccordion(chap.id, originalIndex)}
                      style={{
                        padding: '0.65rem 0.75rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: isCurrent ? 'var(--accent-primary)' : 'var(--text-subtle)',
                            }}
                          >
                            Book {chap.chapterNumber}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: '0.6rem',
                                fontWeight: 700,
                                padding: '0.05rem 0.35rem',
                                borderRadius: '9999px',
                                background: 'rgba(10, 185, 129, 0.2)',
                                color: '#34d399',
                              }}
                            >
                              Active
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {/* Inline Edit Icon next to chapter */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveChapterIndex(originalIndex);
                              setRefiningChapterId((prev) => (prev === chap.id ? null : chap.id));
                              setTargetSectionTitle(null);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: refiningChapterId === chap.id ? '#c084fc' : 'var(--text-subtle)',
                              cursor: 'pointer',
                              padding: '0.2rem',
                              borderRadius: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Edit chapter with AI"
                          >
                            <Sparkles size={13} />
                          </button>

                          {/* Accordion Chevron */}
                          <div
                            style={{
                              color: 'var(--text-subtle)',
                              transition: 'transform 0.25s ease',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            }}
                          >
                            <ChevronDown size={14} />
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: isCurrent ? '#ffffff' : 'var(--text-main)',
                          lineHeight: '1.3',
                        }}
                      >
                        {chap.title}
                      </div>
                    </div>

                    {/* Interactive Hyperlinks Subtopics Tray */}
                    {isExpanded && (
                      <div
                        style={{
                          padding: '0.4rem 0.75rem 0.65rem 0.75rem',
                          background: 'rgba(0, 0, 0, 0.25)',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.3rem',
                          animation: 'fadeIn 0.2s ease-out',
                        }}
                      >
                        <div style={{ fontSize: '0.64rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                          Subtopics & Sections (Click to scroll)
                        </div>
                        {chap.subTopics && chap.subTopics.length > 0 ? (
                          chap.subTopics.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => handleJumpToSubTopic(st.title, originalIndex)}
                              style={{
                                fontSize: '0.72rem',
                                color: isCurrent ? '#c7d2fe' : 'var(--text-muted)',
                                padding: '0.25rem 0.45rem',
                                borderRadius: '0.35rem',
                                background: 'rgba(255, 255, 255, 0.03)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)';
                                e.currentTarget.style.color = '#ffffff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                e.currentTarget.style.color = isCurrent ? '#c7d2fe' : 'var(--text-muted)';
                              }}
                            >
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <strong style={{ color: 'var(--accent-primary)', marginRight: '0.3rem' }}>
                                  {st.topicNumber}
                                </strong>
                                <span>{st.title}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveChapterIndex(originalIndex);
                                    setActiveVideoTopicNumber(st.topicNumber);
                                    setActiveWorkspaceTab('video');
                                    const reader = document.getElementById('workspace-content-scroll');
                                    if (reader) reader.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  style={{
                                    background: 'rgba(236, 72, 153, 0.15)',
                                    border: '1px solid rgba(236, 72, 153, 0.35)',
                                    borderRadius: '0.25rem',
                                    color: '#f472b6',
                                    fontSize: '0.65rem',
                                    padding: '0.1rem 0.35rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                  }}
                                  title={`Play Class Video for ${st.topicNumber}`}
                                >
                                  <Video size={10} />
                                  <span>Video</span>
                                </button>
                                <ExternalLink size={10} style={{ opacity: 0.45 }} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                            1.1 Core Architecture • 1.2 Enterprise Labs
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Content Viewer Pane */}
        <main
          id="workspace-content-scroll"
          style={{
            flex: 1,
            height: '100%',
            overflowY: 'auto',
            padding: '1.25rem 2rem 2.5rem 2rem',
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          {activeChapter ? (
            <div style={{ maxWidth: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* In-Place Chapter / Section AI Refinement Drawer/Box */}
              {refiningChapterId === activeChapter.id && (
                <div
                  className="animate-fade-in"
                  style={{
                    background: 'linear-gradient(135deg, rgba(25, 20, 50, 0.98) 0%, rgba(38, 25, 65, 0.98) 100%)',
                    border: '1.5px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '1.25rem',
                    padding: '1.25rem 1.5rem',
                    boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.7), 0 0 25px rgba(168, 85, 247, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Wand2 size={16} color="#c084fc" />
                      <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff' }}>
                        In-Place AI Refinement • {targetSectionTitle ? `Section: ${targetSectionTitle}` : `Book ${activeChapter.chapterNumber}: ${activeChapter.title}`}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRefiningChapterId(null);
                        setTargetSectionTitle(null);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-subtle)',
                        cursor: 'pointer',
                        padding: '0.2rem',
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.4' }}>
                    Give targeted instructions to the AI to rewrite, tone-adjust, expand with enterprise labs, or clarify this section.
                  </p>

                  {/* Quick Preset Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {[
                      '✨ Simplify explanations',
                      '👔 Make tone more professional',
                      '🛠️ Add 3 practical hands-on labs',
                      '📊 Include comparative summary table',
                      '💡 Add key takeaways & cheat sheet',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRefineInstruction(preset)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '9999px',
                          padding: '0.25rem 0.65rem',
                          color: '#f1f5f9',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Refinement Input Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={refineInstruction}
                      onChange={(e) => setRefineInstruction(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleExecuteRefinement(activeChapter);
                      }}
                      placeholder="Type AI refinement instructions..."
                      disabled={isRefining}
                      style={{
                        flex: 1,
                        background: 'rgba(10, 13, 20, 0.75)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        borderRadius: '0.6rem',
                        padding: '0.55rem 0.85rem',
                        color: '#ffffff',
                        fontSize: '0.84rem',
                        outline: 'none',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => handleExecuteRefinement(activeChapter)}
                      disabled={!refineInstruction.trim() || isRefining}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.55rem 1.1rem',
                        borderRadius: '0.6rem',
                        background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: !refineInstruction.trim() || isRefining ? 'not-allowed' : 'pointer',
                        opacity: !refineInstruction.trim() || isRefining ? 0.6 : 1,
                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.4)',
                      }}
                    >
                      {isRefining ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Refining...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Refine Content</span>
                        </>
                      )}
                    </button>
                  </div>

                  {refineSuccess && (
                    <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Check size={14} />
                      <span>Content successfully rewritten and updated with AI instructions!</span>
                    </div>
                  )}
                </div>
              )}

                {/* ======================================================== */}
                {/* UNIFIED WORKSPACE TAB VIEWS                              */}
                {/* ======================================================== */}

                {/* Tab 1: Course Reading / Primary Textbook Learning Material */}
                {activeWorkspaceTab === 'reading' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Chapter Header Card */}
                    <div
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '1.25rem',
                        padding: '1.5rem',
                        boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.6)',
                      }}
                    >
                      {/* Breadcrumb & Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '0.75rem',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                          {compiledCourse.title} • Book {activeChapter.chapterNumber} of {compiledCourse.totalChapters}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {/* Class Video Player Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveWorkspaceTab('video');
                              setActiveVideoTopicNumber(`${activeChapter.chapterNumber}.1`);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '0.4rem',
                              background: 'rgba(236, 72, 153, 0.18)',
                              border: '1px solid rgba(236, 72, 153, 0.4)',
                              color: '#ffffff',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Watch Interactive Masterclass Video & Lesson Production Script"
                          >
                            <Video size={13} />
                            <span>Class Video ({activeChapter.chapterNumber}.1)</span>
                          </button>

                          {/* In-Place Edit Trigger */}
                          <button
                            type="button"
                            onClick={() => {
                              setRefiningChapterId((prev) => (prev === activeChapter.id ? null : activeChapter.id));
                              setTargetSectionTitle(null);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.4rem',
                              background: 'rgba(168, 85, 247, 0.15)',
                              border: '1px solid rgba(168, 85, 247, 0.35)',
                              color: '#c084fc',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            title="Edit or refine this chapter"
                          >
                            <Sparkles size={12} />
                            <span>Edit</span>
                          </button>

                          {/* TTS */}
                          <button
                            type="button"
                            onClick={() => onSpeak(activeChapter.content, activeChapter.id, workspaceLanguage)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.4rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-muted)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                            title="Read aloud"
                          >
                            {isSpeaking && activeSpeakingId === activeChapter.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                            <span>{isSpeaking && activeSpeakingId === activeChapter.id ? 'Stop' : 'Speak'}</span>
                          </button>

                          {/* Copy */}
                          <button
                            type="button"
                            onClick={handleCopyChapter}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.4rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-subtle)',
                              color: copied ? 'var(--success)' : 'var(--text-muted)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                            title="Copy chapter markdown"
                          >
                            {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                            <span>{copied ? 'Copied' : 'Copy'}</span>
                          </button>

                          {/* Download DOCX */}
                          <button
                            type="button"
                            onClick={handleDownloadDocx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '0.4rem',
                              background: 'rgba(99, 102, 241, 0.15)',
                              border: '1px solid rgba(99, 102, 241, 0.35)',
                              color: '#a5b4fc',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                            title="Export course to Word Document"
                          >
                            <FileText size={13} />
                            <span>DOCX</span>
                          </button>
                        </div>
                      </div>

                      <h2
                        style={{
                          fontSize: '1.6rem',
                          fontWeight: 800,
                          color: '#ffffff',
                          marginBottom: '0.4rem',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        Book {activeChapter.chapterNumber}: {activeChapter.title}
                      </h2>
                      {activeChapter.summary && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                          {activeChapter.summary}
                        </p>
                      )}
                    </div>

                    {/* National / International Authorized Curriculum & Framework Reference Card */}
                    <AuthorizedCurriculumBanner
                      courseTitle={compiledCourse.title}
                      content={activeChapter.content}
                    />

                    {/* Markdown Chapter Content */}
                    <div
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '1.25rem',
                        padding: '2rem',
                        boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.6)',
                      }}
                    >
                      <MarkdownRenderer
                        content={activeChapter.content}
                        onEditSection={handleEditSection}
                        onPlayClassVideo={(topicNum: string) => {
                          setActiveWorkspaceTab('video');
                          if (topicNum) setActiveVideoTopicNumber(topicNum);
                        }}
                      />
                    </div>

                    {/* Previous Book & Next Book Navigation Pagination Controls */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '1rem',
                        paddingBottom: '2rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = Math.max(0, activeChapterIndex - 1);
                          setActiveChapterIndex(nextIdx);
                          setExpandedChapterId(compiledCourse.chapters[nextIdx]?.id || null);
                          const reader = document.getElementById('workspace-content-scroll');
                          if (reader) reader.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={activeChapterIndex === 0}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.6rem 1.1rem',
                          borderRadius: '0.6rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: activeChapterIndex === 0 ? 'rgba(255, 255, 255, 0.25)' : '#ffffff',
                          cursor: activeChapterIndex === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                        }}
                      >
                        <ChevronLeft size={16} />
                        <span>Previous Book</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextIdx = Math.min(compiledCourse.chapters.length - 1, activeChapterIndex + 1);
                          setActiveChapterIndex(nextIdx);
                          setExpandedChapterId(compiledCourse.chapters[nextIdx]?.id || null);
                          const reader = document.getElementById('workspace-content-scroll');
                          if (reader) reader.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        disabled={activeChapterIndex >= compiledCourse.chapters.length - 1}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.6rem 1.1rem',
                          borderRadius: '0.6rem',
                          background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                          border: 'none',
                          color: '#ffffff',
                          cursor:
                            activeChapterIndex >= compiledCourse.chapters.length - 1
                              ? 'not-allowed'
                              : 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          opacity: activeChapterIndex >= compiledCourse.chapters.length - 1 ? 0.4 : 1,
                        }}
                      >
                        <span>Next Book</span>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab 2: Authorized Course Structure & Standards */}
                {activeWorkspaceTab === 'structure' && (
                  <AuthorizedCourseStructureTab
                    courseTitle={compiledCourse.title}
                    chapters={compiledCourse.chapters}
                    targetAudience={selectedAudience}
                    initialStandardInfo={compiledCourse.authorizedStructure}
                    onSaveStandardInfo={(info) => {
                      const updated = { ...compiledCourse, authorizedStructure: info };
                      setCompiledCourse(updated);
                      saveLibraryCourse(updated);
                    }}
                  />
                )}

                {/* Tab 3: Slide + AI Masterclass */}
                {activeWorkspaceTab === 'slides' && (
                  <SlideDecksViewer
                    courseTitle={compiledCourse.title}
                    chapterTitle={activeChapter.title}
                    chapterNumber={activeChapter.chapterNumber}
                    chapterContent={activeChapter.content}
                    activeLanguage={workspaceLanguage}
                    onLanguageChange={(lang) => {
                      setWorkspaceLanguage(lang);
                      localStorage.setItem('ila_active_language', lang);
                    }}
                    activeVoiceProfile={workspaceVoiceProfile}
                    onVoiceProfileChange={(vId) => {
                      setWorkspaceVoiceProfile(vId);
                      localStorage.setItem('ila_active_voice_profile', vId);
                    }}
                    targetAudience={selectedAudience}
                    onScriptUpdate={(updatedMd) => {
                      const updatedChapters = compiledCourse.chapters.map((ch) =>
                        ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                      );
                      const updated = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
                      setCompiledCourse(updated);
                      saveLibraryCourse(updated);
                    }}
                    onJumpToReadingTab={() => {
                      setActiveWorkspaceTab('reading');
                    }}
                  />
                )}

                {/* Tab 4: Video Library */}
                {activeWorkspaceTab === 'video' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <MasterclassVideoPlayer
                      courseTitle={compiledCourse.title}
                      chapterTitle={activeChapter.title}
                      chapterNumber={activeChapter.chapterNumber}
                      chapterContent={activeChapter.content}
                      initialTopicNumber={activeVideoTopicNumber}
                      activeLanguage={workspaceLanguage}
                      activeVoiceProfile={workspaceVoiceProfile}
                      isCompact={false}
                      isStudentMode={false}
                      enableCheckpointExam={true}
                      hasNextChapter={activeChapterIndex < compiledCourse.chapters.length - 1}
                      onNextChapter={() =>
                        setActiveChapterIndex((prev) =>
                          Math.min(compiledCourse.chapters.length - 1, prev + 1)
                        )
                      }
                      hasPreviousChapter={activeChapterIndex > 0}
                      onPreviousChapter={() =>
                        setActiveChapterIndex((prev) => Math.max(0, prev - 1))
                      }
                      onScriptUpdate={(updatedMd) => {
                        const updatedChapters = compiledCourse.chapters.map((ch) =>
                          ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                        );
                        const updated = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
                        setCompiledCourse(updated);
                        saveLibraryCourse(updated);
                      }}
                    />
                  </div>
                )}

                {/* Tab 4: Explanation Bot / Board (Tutorial Library) */}
                {activeWorkspaceTab === 'explanations' && (
                  <ExplanationsBoard
                    courseTitle={compiledCourse.title}
                    chapter={activeChapter}
                    chapterNumber={activeChapter.chapterNumber}
                    activeLanguage={workspaceLanguage}
                    targetAudience={selectedAudience}
                    onOpenSlides={() => setActiveWorkspaceTab('slides')}
                    onOpenVideo={(topicNumber) => {
                      setActiveWorkspaceTab('video');
                      if (topicNumber) setActiveVideoTopicNumber(topicNumber);
                    }}
                    onSpeak={onSpeak}
                    isSpeaking={isSpeaking}
                    activeSpeakingId={activeSpeakingId}
                    onScriptUpdate={(updatedMd) => {
                      const updatedChapters = compiledCourse.chapters.map((ch) =>
                        ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                      );
                      const updated = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
                      setCompiledCourse(updated);
                      saveLibraryCourse(updated);
                    }}
                  />
                )}

                {/* Tab 5: Course Dictionary */}
                {activeWorkspaceTab === 'dictionary' && (
                  <CourseDictionary
                    courseTitle={compiledCourse.title}
                    chapter={activeChapter}
                    chapterNumber={activeChapter.chapterNumber}
                    allChapters={compiledCourse.chapters}
                    activeLanguage={workspaceLanguage}
                    onSpeak={onSpeak}
                    isSpeaking={isSpeaking}
                    activeSpeakingId={activeSpeakingId}
                    onScriptUpdate={(updatedMd) => {
                      const updatedChapters = compiledCourse.chapters.map((ch) =>
                        ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                      );
                      const updated = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
                      setCompiledCourse(updated);
                      saveLibraryCourse(updated);
                    }}
                  />
                )}

                {/* Tab 6: Exams Board */}
                {activeWorkspaceTab === 'exams' && (
                  <ExamsBoard
                    courseTitle={compiledCourse.title}
                    chapter={activeChapter}
                    chapterNumber={activeChapter.chapterNumber}
                    allChapters={compiledCourse.chapters}
                    onScriptUpdate={(updatedMd) => {
                      const updatedChapters = compiledCourse.chapters.map((ch) =>
                        ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                      );
                      const updated = { ...compiledCourse, chapters: updatedChapters, updatedAt: Date.now() };
                      setCompiledCourse(updated);
                      saveLibraryCourse(updated);
                    }}
                  />
                )}

                {/* Tab 5: Dedicated Interactive IntelliCoach Tutoring & Onboarding View */}
                {activeWorkspaceTab === 'coach' && (
                  <IntelliCoachView
                    initialCourse={compiledCourse}
                    isEmbedded={true}
                    onOpenReadingTab={() => setActiveWorkspaceTab('reading')}
                    onOpenSlideTab={() => setActiveWorkspaceTab('slides')}
                    onOpenVideoTab={() => setActiveWorkspaceTab('video')}
                  />
                )}
              </div>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-subtle)' }}>
                <BookOpen size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                <p>No chapter selected.</p>
              </div>
            )}
          </main>
        </div>

      {/* Presentation-Ready Teaching Slides Modal */}
      {showSlidesModal && activeChapter && (
        <TeachingSlidesModal
          courseTitle={compiledCourse.title}
          chapterTitle={activeChapter.title}
          chapterNumber={activeChapter.chapterNumber}
          chapterContent={activeChapter.content}
          activeLanguage={workspaceLanguage}
          activeVoiceProfile={workspaceVoiceProfile}
          onClose={() => setShowSlidesModal(false)}
        />
      )}

      {/* Version History & Rollback Modal */}
      {showVersionHistory && (
        <div
          id="version-history-modal"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setShowVersionHistory(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '85vh',
              background: 'linear-gradient(145deg, rgba(14, 18, 32, 0.98) 0%, rgba(22, 28, 50, 0.98) 100%)',
              border: '1.5px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '1.25rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '0.6rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <History size={18} color="#ffffff" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Course Version History
                  </h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                    Automatic local version tracking • 1-click restore to prevent data loss
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowVersionHistory(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.5rem',
                  padding: '0.35rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Version List Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              {(!compiledCourse.versions || compiledCourse.versions.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <Clock size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No previous version snapshots saved yet.</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                    Click "Update / Auto-Save New Version" on the top action bar to capture a snapshot.
                  </p>
                </div>
              ) : (
                [...compiledCourse.versions].reverse().map((ver, idx) => {
                  const isCurrent = compiledCourse.activeVersionNumber === ver.versionNumber || idx === 0;
                  const dateStr = new Date(ver.timestamp).toLocaleString();
                  return (
                    <div
                      key={ver.id}
                      style={{
                        background: isCurrent
                          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.18) 100%)'
                          : 'rgba(255, 255, 255, 0.03)',
                        border: isCurrent
                          ? '1px solid rgba(165, 180, 252, 0.45)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '0.75rem',
                        padding: '1rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 800,
                              color: isCurrent ? '#a5b4fc' : '#ffffff',
                            }}
                          >
                            {ver.versionNumber}
                          </span>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '0.1rem 0.45rem',
                                borderRadius: '9999px',
                                background: 'rgba(52, 211, 153, 0.2)',
                                color: '#34d399',
                                border: '1px solid rgba(52, 211, 153, 0.4)',
                              }}
                            >
                              Active Version
                            </span>
                          )}
                          {ver.autoSaved && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '9999px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              Auto-Saved
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 500 }}>
                          {ver.label || 'Course Snapshot'} • {ver.chaptersSnapshot.length} Books
                        </div>

                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={11} />
                          <span>{dateStr}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRestoreVersionSnapshot(ver.id)}
                        disabled={isCurrent}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.4rem 0.85rem',
                          borderRadius: '0.5rem',
                          background: isCurrent
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                          border: 'none',
                          color: isCurrent ? 'var(--text-muted)' : '#ffffff',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: isCurrent ? 'default' : 'pointer',
                          opacity: isCurrent ? 0.6 : 1,
                          transition: 'all 0.15s ease',
                          flexShrink: 0,
                        }}
                      >
                        <RotateCcw size={12} />
                        <span>{isCurrent ? 'Current' : 'Restore'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(10, 13, 24, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Total snapshots: {(compiledCourse.versions || []).length}
              </span>
              <button
                type="button"
                onClick={() => handleUpdateSaveNewVersion(false, 'Manual Snapshot')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 1rem',
                  borderRadius: '0.55rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Save size={13} />
                <span>Create New Version Snapshot Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Presentation-Ready Teaching Slides Modal */}
      {showSlidesModal && activeChapter && (
        <TeachingSlidesModal
          courseTitle={compiledCourse.title}
          chapterTitle={activeChapter.title}
          chapterNumber={activeChapter.chapterNumber}
          chapterContent={activeChapter.content}
          activeLanguage={workspaceLanguage}
          activeVoiceProfile={workspaceVoiceProfile}
          onClose={() => setShowSlidesModal(false)}
          onOpenInVideo={() => {
            setShowSlidesModal(false);
            setActiveWorkspaceTab('video');
            setActiveVideoTopicNumber(`${activeChapter.chapterNumber}.1`);
          }}
        />
      )}

      {/* Direct Content Editor Modal */}
      {showDirectEditorModal && activeChapter && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '900px',
              height: '85vh',
              background: '#0d1220',
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '1rem',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit3 size={15} color="#38bdf8" />
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>
                  Edit Content: Book {activeChapter.chapterNumber} - {activeChapter.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDirectEditorModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={directEditContent}
                onChange={(e) => setDirectEditContent(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.6rem',
                  padding: '1rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  lineHeight: '1.6',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>

            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(10, 14, 26, 0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.6rem',
              }}
            >
              <button
                type="button"
                onClick={() => setShowDirectEditorModal(false)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDirectEditSave}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
                }}
              >
                Save Changes to Library
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chapter Confirmation Modal */}
      {showDeleteChapterModal && activeChapter && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#0d1220',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '1rem',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171' }}>
              <Trash2 size={18} />
              <span style={{ fontSize: '1rem', fontWeight: 800 }}>Confirm Deletion</span>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>
              Are you sure you want to delete <strong>Book {activeChapter.chapterNumber}: {activeChapter.title}</strong>? This action will remove this chapter across all reading modes.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowDeleteChapterModal(false)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteActiveChapter}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Delete Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Chapter Modal */}
      {showAddNewChapterModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              background: '#0d1220',
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '1rem',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={16} color="#38bdf8" />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Add New Book / Chapter</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddNewChapterModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Chapter Title
              </label>
              <input
                type="text"
                placeholder="e.g. Advanced Integration Architecture & Security Governance"
                value={newChapterTitle}
                onChange={(e) => setNewChapterTitle(e.target.value)}
                style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Initial Chapter Markdown Content (Optional)
              </label>
              <textarea
                rows={6}
                placeholder="Write starting markdown curriculum content..."
                value={newChapterContent}
                onChange={(e) => setNewChapterContent(e.target.value)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  lineHeight: '1.5',
                  resize: 'none',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAddNewChapterModal(false)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewChapter}
                disabled={!newChapterTitle.trim()}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background: newChapterTitle.trim() ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: newChapterTitle.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Create Chapter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Full-Page Module Workspace (Main Top Header remains active & visible above) */}
      {isModuleFullScreen && activeChapter && (
        <div
          id="module-dedicated-fullpage-view"
          style={{
            position: 'fixed',
            top: '56px',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 90,
            background: 'var(--bg-primary, #070b14)',
            display: 'flex',
            flexDirection: 'column',
            width: '100vw',
            height: 'calc(100vh - 56px)',
            overflow: 'hidden',
          }}
        >
          {/* Full-Page Module Master Header Suite */}
          <header
            style={{
              padding: '0.55rem 1.25rem',
              background: 'rgba(13, 18, 32, 0.98)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.6rem',
              flexShrink: 0,
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Left: Back to Workspace Button, Module Switcher & Book Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <button
                id="dedicated-module-back-btn"
                type="button"
                onClick={handleExitDedicatedModulePage}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.8rem',
                  borderRadius: '9999px',
                  background: 'rgba(56, 189, 248, 0.18)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(56, 189, 248, 0.3)',
                  transition: 'all 0.15s ease',
                }}
                title="Return to Course Workspace (Auto-saves uncommitted edits to version history)"
              >
                <ChevronLeft size={14} />
                <span>Back to Workspace</span>
              </button>

              {/* Module Switcher Tabs directly inside Full-Page Header */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '0.15rem',
                  borderRadius: '9999px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {[
                  { id: 'reading', label: '1. Reading', icon: BookOpen, color: '#38bdf8' },
                  { id: 'explanations', label: '2. Tutor Bot', icon: GraduationCap, color: '#a855f7' },
                  { id: 'slides', label: '3. Slide + AI', icon: Presentation, color: '#f472b6' },
                  { id: 'video', label: '4. Video + AI', icon: Video, color: '#f43f5e' },
                  { id: 'coach', label: '5. Intelli Coach', icon: Bot, color: '#10b981' },
                  { id: 'exams', label: '6. Exam Board', icon: Award, color: '#fbbf24' },
                  { id: 'dictionary', label: '7. Glossary', icon: HelpCircle, color: '#2dd4bf' },
                ].map((mTab) => {
                  const Icon = mTab.icon;
                  const isActive =
                    activeWorkspaceTab === mTab.id ||
                    (mTab.id === 'reading' && activeWorkspaceTab === 'structure');
                  return (
                    <button
                      key={mTab.id}
                      type="button"
                      onClick={() => setActiveWorkspaceTab(mTab.id as any)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.25rem 0.55rem',
                        borderRadius: '9999px',
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)'
                          : 'transparent',
                        border: isActive ? `1px solid ${mTab.color}` : '1px solid transparent',
                        color: isActive ? '#ffffff' : 'var(--text-muted)',
                        fontSize: '0.7rem',
                        fontWeight: isActive ? 800 : 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? `0 0 8px ${mTab.color}40` : 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Icon size={11} color={isActive ? mTab.color : 'var(--text-subtle)'} />
                      <span>{mTab.label}</span>
                    </button>
                  );
                })}
              </div>

              <select
                value={activeChapterIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value, 10);
                  setActiveChapterIndex(idx);
                  setExpandedChapterId(compiledCourse.chapters[idx]?.id || null);
                }}
                style={{
                  height: '30px',
                  padding: '0 0.65rem',
                  borderRadius: '0.4rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {compiledCourse.chapters.map((ch, cIdx) => (
                  <option key={ch.id} value={cIdx} style={{ background: '#0d1220' }}>
                    Book {ch.chapterNumber}: {ch.title}
                  </option>
                ))}
              </select>

                {/* Live Synchronization Status Badge */}
                {hasUnsavedChanges ? (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#fbbf24',
                      background: 'rgba(251, 191, 36, 0.15)',
                      border: '1px solid rgba(251, 191, 36, 0.35)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                    title="Unsaved modifications will be automatically captured as a new version snapshot upon exit"
                  >
                    <AlertCircle size={11} />
                    <span>Unsaved Edits (Auto-Snapshot on Exit)</span>
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: '#34d399',
                      background: 'rgba(52, 211, 153, 0.12)',
                      border: '1px solid rgba(52, 211, 153, 0.3)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Check size={11} />
                    <span>Synced with Library</span>
                  </span>
                )}
              </div>

            {/* Center: Universal Inline Editing Suite (Edit with AI, Edit Content, Delete, Add New) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setRefiningChapterId(activeChapter.id);
                  setTargetSectionTitle(null);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '0.45rem',
                  background: 'rgba(168, 85, 247, 0.18)',
                  border: '1px solid rgba(168, 85, 247, 0.45)',
                  color: '#c084fc',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Refine this module with AI"
              >
                <Wand2 size={13} />
                <span>Edit with AI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirectEditContent(activeChapter.content);
                  setShowDirectEditorModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.7rem',
                  borderRadius: '0.45rem',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: '#7dd3fc',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Directly edit text and code"
              >
                <Edit3 size={13} />
                <span>Edit Content</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeleteChapterModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.45rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#f87171',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Delete this chapter or module"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewChapterTitle('');
                  setNewChapterContent('');
                  setShowAddNewChapterModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '0.45rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 10px rgba(236, 72, 153, 0.4)',
                }}
                title="Add a new chapter or module"
              >
                <Plus size={13} />
                <span>Add New</span>
              </button>
            </div>

            {/* Right: Explicit Save, Versioning & History Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {/* 1. Explicit Save Button */}
              <button
                id="dedicated-explicit-save-btn"
                type="button"
                onClick={handleExplicitSaveToLibrary}
                disabled={isAutoSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  height: '30px',
                  padding: '0 0.85rem',
                  borderRadius: '9999px',
                  background: hasUnsavedChanges
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(16, 185, 129, 0.2)',
                  border: hasUnsavedChanges
                    ? '1px solid #34d399'
                    : '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: isAutoSaving ? 'not-allowed' : 'pointer',
                  boxShadow: hasUnsavedChanges ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
                  transition: 'all 0.15s ease',
                }}
                title="Explicitly save and overwrite course in SQLite library"
              >
                {isAutoSaving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save size={13} />
                    <span>{explicitSaveStatus || (hasUnsavedChanges ? 'Save Changes' : 'Saved')}</span>
                  </>
                )}
              </button>

              {/* 2. Save New Version Snapshot */}
              <button
                id="dedicated-create-version-btn"
                type="button"
                onClick={() => handleUpdateSaveNewVersion(false, 'Manual Version Snapshot')}
                disabled={isAutoSaving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  height: '30px',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.45)',
                  color: '#a5b4fc',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: isAutoSaving ? 'not-allowed' : 'pointer',
                }}
                title="Create a dedicated historical version snapshot"
              >
                <Plus size={12} />
                <span>Save New Version</span>
              </button>

              {/* 3. Version History Management Button */}
              <button
                id="dedicated-version-history-btn"
                type="button"
                onClick={() => setShowVersionHistory(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  height: '30px',
                  padding: '0 0.75rem',
                  borderRadius: '9999px',
                  background: 'rgba(168, 85, 247, 0.18)',
                  border: '1px solid rgba(168, 85, 247, 0.45)',
                  color: '#c084fc',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Browse and restore saved historical versions"
              >
                <History size={12} />
                <span>Versions ({(compiledCourse?.versions || []).length})</span>
              </button>
            </div>
          </header>

          {/* Full-Page Body Content */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '1rem', height: 'calc(100% - 60px)' }}>
            {(activeWorkspaceTab === 'reading' || activeWorkspaceTab === 'structure') && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '1rem', height: '100%', overflow: 'hidden' }}>
                {/* Pinned Chapter & Subtopic Index Navigation Sidebar */}
                <aside
                  id="fullpage-reading-index-sidebar"
                  style={{
                    width: '300px',
                    minWidth: '260px',
                    maxWidth: '340px',
                    flexShrink: 0,
                    height: '100%',
                    overflowY: 'auto',
                    background: 'rgba(12, 18, 32, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '1rem',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <BookOpen size={15} color="#38bdf8" />
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                        Course Index & Outline
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>
                      {compiledCourse.chapters.length} Books
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto' }}>
                    {compiledCourse.chapters.map((chap, idx) => {
                      const isCurrent = idx === activeChapterIndex;
                      const isExpanded = expandedChapterId === chap.id || isCurrent;
                      return (
                        <div
                          key={chap.id}
                          style={{
                            background: isCurrent
                              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)'
                              : 'rgba(255, 255, 255, 0.02)',
                            border: isCurrent
                              ? '1px solid rgba(99, 102, 241, 0.5)'
                              : '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '0.75rem',
                            overflow: 'hidden',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div
                            onClick={() => {
                              setActiveChapterIndex(idx);
                              setExpandedChapterId((prev) => (prev === chap.id ? null : chap.id));
                            }}
                            style={{
                              padding: '0.6rem 0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.66rem', fontWeight: 700, color: isCurrent ? '#38bdf8' : 'var(--text-subtle)' }}>
                                Book {chap.chapterNumber}
                              </span>
                              {isCurrent && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#34d399', background: 'rgba(52, 211, 153, 0.15)', padding: '0.05rem 0.35rem', borderRadius: '9999px' }}>
                                  Active
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: isCurrent ? '#ffffff' : 'var(--text-main)', lineHeight: '1.3' }}>
                              {chap.title}
                            </div>
                          </div>

                          {isExpanded && chap.subTopics && chap.subTopics.length > 0 && (
                            <div style={{ padding: '0.35rem 0.65rem 0.55rem', background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {chap.subTopics.map((st) => (
                                <div
                                  key={st.id}
                                  onClick={() => handleJumpToSubTopic(st.title, idx)}
                                  style={{
                                    fontSize: '0.7rem',
                                    color: isCurrent ? '#c7d2fe' : 'var(--text-muted)',
                                    padding: '0.2rem 0.4rem',
                                    borderRadius: '0.35rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                  }}
                                >
                                  <span style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.65rem' }}>{st.topicNumber}</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.title}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </aside>

                {/* Main Reading Content Area */}
                <div id="fullpage-reading-content-scroll" style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', background: 'rgba(12, 18, 32, 0.95)', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '2rem' }}>
                  {/* In-Place AI Refinement Card if active */}
                  {refiningChapterId === activeChapter.id && (
                    <div
                      style={{
                        marginBottom: '1.5rem',
                        padding: '1.25rem',
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                        border: '1.5px solid rgba(168, 85, 247, 0.45)',
                        borderRadius: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Wand2 size={16} color="#c084fc" />
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
                            {targetSectionTitle ? `Refine Section: "${targetSectionTitle}" with AI` : 'Refine Full Chapter with AI'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setRefiningChapterId(null)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                      <textarea
                        value={refineInstruction}
                        onChange={(e) => setRefineInstruction(e.target.value)}
                        placeholder="Enter your custom instructions for AI refinement..."
                        rows={3}
                        style={{
                          width: '100%',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          borderRadius: '0.5rem',
                          padding: '0.65rem 0.75rem',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          outline: 'none',
                          resize: 'vertical',
                          marginBottom: '0.75rem',
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => setRefiningChapterId(null)}
                          style={{ padding: '0.4rem 0.8rem', borderRadius: '0.5rem', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.15)', color: 'var(--text-muted)', fontSize: '0.76rem', cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExecuteRefinement(activeChapter)}
                          disabled={isRefining || !refineInstruction.trim()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.4rem 0.95rem',
                            borderRadius: '0.5rem',
                            background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: isRefining || !refineInstruction.trim() ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {isRefining ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                          <span>{isRefining ? 'Refining...' : 'Execute AI Refinement'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <MarkdownRenderer
                    content={activeChapter.content}
                    onEditSection={handleEditSection}
                    onPlayClassVideo={() => setActiveWorkspaceTab('video')}
                  />
                </div>
              </div>
            )}
            {activeWorkspaceTab === 'explanations' && (
              <ExplanationsBoard
                courseTitle={compiledCourse.title}
                chapter={activeChapter}
                chapterNumber={activeChapter.chapterNumber}
                activeLanguage={workspaceLanguage}
                targetAudience={selectedAudience}
                onOpenSlides={() => setActiveWorkspaceTab('slides')}
                onOpenVideo={(topicNumber) => {
                  setActiveWorkspaceTab('video');
                  if (topicNumber) setActiveVideoTopicNumber(topicNumber);
                }}
                onSpeak={onSpeak}
                isSpeaking={isSpeaking}
                activeSpeakingId={activeSpeakingId}
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeWorkspaceTab === 'slides' && (
              <SlideDecksViewer
                courseTitle={compiledCourse.title}
                chapterTitle={activeChapter.title}
                chapterNumber={activeChapter.chapterNumber}
                chapterContent={activeChapter.content}
                activeLanguage={workspaceLanguage}
                activeVoiceProfile={workspaceVoiceProfile}
                targetAudience={selectedAudience}
                onScriptUpdate={handleModuleScriptUpdate}
                onJumpToReadingTab={() => {
                  setActiveWorkspaceTab('reading');
                }}
              />
            )}
            {activeWorkspaceTab === 'video' && (
              <MasterclassVideoPlayer
                courseTitle={compiledCourse.title}
                chapterTitle={activeChapter.title}
                chapterNumber={activeChapter.chapterNumber}
                chapterContent={activeChapter.content}
                initialTopicNumber={activeVideoTopicNumber}
                activeLanguage={workspaceLanguage}
                activeVoiceProfile={workspaceVoiceProfile}
                isCompact={false}
                isStudentMode={false}
                enableCheckpointExam={true}
                hasNextChapter={activeChapterIndex < compiledCourse.chapters.length - 1}
                onNextChapter={() =>
                  setActiveChapterIndex((prev) =>
                    Math.min(compiledCourse.chapters.length - 1, prev + 1)
                  )
                }
                hasPreviousChapter={activeChapterIndex > 0}
                onPreviousChapter={() =>
                  setActiveChapterIndex((prev) => Math.max(0, prev - 1))
                }
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeWorkspaceTab === 'exams' && (
              <ExamsBoard
                courseTitle={compiledCourse.title}
                chapter={activeChapter}
                chapterNumber={activeChapter.chapterNumber}
                allChapters={compiledCourse.chapters}
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeWorkspaceTab === 'dictionary' && (
              <CourseDictionary
                courseTitle={compiledCourse.title}
                chapter={activeChapter}
                chapterNumber={activeChapter.chapterNumber}
                allChapters={compiledCourse.chapters}
                activeLanguage={workspaceLanguage}
                onSpeak={onSpeak}
                isSpeaking={isSpeaking}
                activeSpeakingId={activeSpeakingId}
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
