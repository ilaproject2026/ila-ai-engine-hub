import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Search,
  FileText,
  Download,
  Trash2,
  Calendar,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Grid,
  List,
  ChevronDown,
  Check,
  Wand2,
  Send,
  Loader2,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Filter,
  Video,
  Presentation,
  History,
  RotateCcw,
  Clock,
  Save,
  Bookmark,
  Award,
  HelpCircle,
  ShieldCheck,
  UserCheck,
  Edit3,
  Plus,
  AlertCircle,
  Copy,
  Volume2,
  VolumeX,
  CheckSquare,
  Square,
  Mic,
  MicOff,
  Paperclip,
  Tv,
  File,
  Bot,
} from 'lucide-react';
import {
  getAllLibraryCourses,
  deleteLibraryCourse,
  saveLibraryCourse,
  saveCourseVersionSnapshot,
  restoreCourseVersion,
  batchGenerateAndSaveDepartmentCourses,
  getAllCategories,
  saveCategory,
  deleteCategory,
  clearAllLibraryCourses,
  clearAllDatabaseData,
  LEARNER_CATEGORIES,
  type LibraryCourse,
  type CourseChapter,
  type AttachedDocument,
  type CourseCategory,
} from '../services/dbService';
import { downloadWordDocx } from '../services/docxExportService';
import { generateIlaResponse, translateCourseContent } from '../services/geminiService';
import { useVoice } from '../hooks/useVoice';
import { SUPPORTED_LANGUAGES, startListening, stopListening } from '../services/speechService';
import { parseFileToDocument, formatFileSize } from '../services/fileParserService';
import MarkdownRenderer from './MarkdownRenderer';
import MasterclassVideoPlayer from './MasterclassVideoPlayer';
import DeleteConfirmModal from './DeleteConfirmModal';
import LanguageVoiceSelector from './LanguageVoiceSelector';
import AuthorizedCurriculumBanner from './AuthorizedCurriculumBanner';
import TeachingSlidesModal from './TeachingSlidesModal';
import ExplanationsBoard from './ExplanationsBoard';
import ExamsBoard from './ExamsBoard';
import CourseDictionary from './CourseDictionary';
import AuthorizedCourseStructureTab from './AuthorizedCourseStructureTab';
import SlideDecksViewer from './SlideDecksViewer';
import IntelliCoachView from './IntelliCoachView';

interface DedicatedLibraryViewProps {
  onOpenInWorkspace: (course: LibraryCourse) => void;
  onBackToChat?: () => void;
  onCreateNewCourse: () => void;
}

export default function DedicatedLibraryView({
  onOpenInWorkspace,
  onBackToChat: _onBackToChat,
  onCreateNewCourse,
}: DedicatedLibraryViewProps) {
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'catalog' | 'reader'>('catalog');
  const [selectedCourse, setSelectedCourse] = useState<LibraryCourse | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null);

  // Audience-Adaptive Personalization ("Studied By" Feature)
  const [selectedAudience, setSelectedAudience] = useState<string>(() => {
    return localStorage.getItem('ila_learner_category') || 'General Student / Lifelong Learner';
  });
  const [isAudienceMenuOpen, setIsAudienceMenuOpen] = useState<boolean>(false);

  // Unified Reader Tab Sequence: 'reading' | 'explanations' | 'slides' | 'video' | 'coach' | 'exams' | 'dictionary' | 'structure'
  const [activeReaderTab, setActiveReaderTab] = useState<'reading' | 'explanations' | 'slides' | 'video' | 'coach' | 'exams' | 'dictionary' | 'structure'>('reading');

  // Copy Feedback & Export Menu States
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState<boolean>(false);

  // Department Adaptation Batch Generation States
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(() =>
    LEARNER_CATEGORIES.filter((c) => c.id !== 'all_categories').map((c) => c.id)
  );
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string>('');

  // Universal Multi-Language & Voice Profile States
  const [libraryLanguage, setLibraryLanguage] = useState<string>(() => {
    return localStorage.getItem('ila_active_language') || 'en-US';
  });
  const [libraryVoiceProfile, setLibraryVoiceProfile] = useState<string>(() => {
    const saved = localStorage.getItem('ila_active_voice_profile');
    if (saved && !saved.startsWith('piper')) return saved;
    return 'coqui-xtts-multilingual';
  });
  const [isTranslatingChapter, setIsTranslatingChapter] = useState<boolean>(false);

  // Search & Filtering States
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [courseToDelete, setCourseToDelete] = useState<LibraryCourse | null>(null);

  // Dynamic Category Management States
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatDept, setNewCatDept] = useState<string>('');
  const [newCatDesc, setNewCatDesc] = useState<string>('');
  const [newCatColor, setNewCatColor] = useState<string>('#6366f1');
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false);

  // Masterclass Video Player State
  const [activeVideoTopicNumber, setActiveVideoTopicNumber] = useState<string | undefined>(undefined);

  // Presentation-Ready Teaching Slides State
  const [showSlidesModal, setShowSlidesModal] = useState<boolean>(false);

  // In-Place Chapter AI Refinement State (Text, Voice & Document Input)
  const [refiningChapterId, setRefiningChapterId] = useState<string | null>(null);
  const [targetSectionTitle, setTargetSectionTitle] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [refineSuccess, setRefineSuccess] = useState<boolean>(false);
  const [isRecordingRefineVoice, setIsRecordingRefineVoice] = useState<boolean>(false);
  const [attachedRefineDocs, setAttachedRefineDocs] = useState<AttachedDocument[]>([]);

  // Dedicated Full-Screen Module Workspace & Universal Inline Editing Suite States
  const [isModuleFullScreen, setIsModuleFullScreen] = useState<boolean>(false);
  const [showDirectEditorModal, setShowDirectEditorModal] = useState<boolean>(false);
  const [directEditContent, setDirectEditContent] = useState<string>('');
  const [showDeleteChapterModal, setShowDeleteChapterModal] = useState<boolean>(false);
  const [showAddNewChapterModal, setShowAddNewChapterModal] = useState<boolean>(false);
  const [newChapterTitle, setNewChapterTitle] = useState<string>('');
  const [newChapterContent, setNewChapterContent] = useState<string>('');

  const handleDirectEditSave = async () => {
    if (!selectedCourse || !activeChapter) return;
    const updatedChapters = selectedCourse.chapters.map((ch) =>
      ch.id === activeChapter.id ? { ...ch, content: directEditContent } : ch
    );
    const updatedCourse = { ...selectedCourse, chapters: updatedChapters, updatedAt: Date.now() };
    setSelectedCourse(updatedCourse);
    setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
    await saveLibraryCourse(updatedCourse);
    setShowDirectEditorModal(false);
  };

  const handleDeleteActiveChapter = async () => {
    if (!selectedCourse || !activeChapter || selectedCourse.chapters.length <= 1) {
      alert('A course must contain at least one book/chapter.');
      return;
    }
    const updatedChapters = selectedCourse.chapters.filter((ch) => ch.id !== activeChapter.id);
    const reindexed = updatedChapters.map((ch, idx) => ({ ...ch, chapterNumber: idx + 1 }));
    const updatedCourse = { ...selectedCourse, chapters: reindexed, updatedAt: Date.now() };
    setSelectedCourse(updatedCourse);
    setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
    await saveLibraryCourse(updatedCourse);
    setActiveChapterIndex((prev) => Math.max(0, prev - 1));
    setShowDeleteChapterModal(false);
  };

  const handleAddNewChapter = async () => {
    if (!selectedCourse || !newChapterTitle.trim()) return;
    const newNum = selectedCourse.chapters.length + 1;
    const newChap: CourseChapter = {
      id: `chap_${Date.now()}`,
      chapterNumber: newNum,
      title: newChapterTitle.trim(),
      content:
        newChapterContent.trim() ||
        `## Book ${newNum}: ${newChapterTitle.trim()}\n\nOverview and core principles of ${newChapterTitle.trim()}.\n\n### 1. Architectural Foundations\nKey concepts and definitions.`,
      subTopics: [],
    };
    const updatedCourse = {
      ...selectedCourse,
      chapters: [...selectedCourse.chapters, newChap],
      updatedAt: Date.now(),
    };
    setSelectedCourse(updatedCourse);
    setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
    await saveLibraryCourse(updatedCourse);
    setActiveChapterIndex(selectedCourse.chapters.length);
    setExpandedChapterId(newChap.id);
    setShowAddNewChapterModal(false);
    setNewChapterTitle('');
    setNewChapterContent('');
  };

  // Local Version Tracking & Auto-Save States
  const [versionSaveStatus, setVersionSaveStatus] = useState<string | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState<boolean>(false);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [explicitSaveStatus, setExplicitSaveStatus] = useState<string | null>(null);
  const [customVersionLabel, setCustomVersionLabel] = useState<string>('');
  const [showCustomVersionModal, setShowCustomVersionModal] = useState<boolean>(false);

  const handleModuleScriptUpdate = (updatedMd: string) => {
    if (!selectedCourse || !activeChapter) return;
    const updatedChapters = selectedCourse.chapters.map((ch) =>
      ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
    );
    const updatedCourse = { ...selectedCourse, chapters: updatedChapters, updatedAt: Date.now() };
    setSelectedCourse(updatedCourse);
    setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
    setHasUnsavedChanges(true);
  };

  const handleExplicitSaveToLibrary = async () => {
    if (!selectedCourse) return;
    setIsAutoSaving(true);
    try {
      await saveLibraryCourse(selectedCourse);
      setCourses((prev) => prev.map((c) => (c.id === selectedCourse.id ? selectedCourse : c)));
      setHasUnsavedChanges(false);
      setExplicitSaveStatus('Saved to Library!');
      setTimeout(() => setExplicitSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to save library course:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleCreateNewVersionSnapshot = async (label?: string) => {
    if (!selectedCourse) return;
    setIsAutoSaving(true);
    try {
      const { updatedCourse, newVersion } = await saveCourseVersionSnapshot(
        selectedCourse,
        false,
        label || customVersionLabel.trim() || undefined
      );
      setSelectedCourse(updatedCourse);
      setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
      setExplicitSaveStatus(`${newVersion.versionNumber} Created!`);
      setShowCustomVersionModal(false);
      setCustomVersionLabel('');
      setTimeout(() => setExplicitSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to create version snapshot:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleExitDedicatedModulePage = async () => {
    if (hasUnsavedChanges && selectedCourse) {
      try {
        const { updatedCourse } = await saveCourseVersionSnapshot(
          selectedCourse,
          true,
          `Auto-Snapshot on Exit (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
        );
        setSelectedCourse(updatedCourse);
        setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
        setHasUnsavedChanges(false);
      } catch (err) {
        console.error('Failed to auto-save snapshot on exit:', err);
      }
    }
    setIsModuleFullScreen(false);
  };

  const handleUpdateSaveNewVersion = async (isAuto: boolean = false, customLabel?: string) => {
    if (!selectedCourse) return;
    setIsAutoSaving(true);
    try {
      const { updatedCourse, newVersion } = await saveCourseVersionSnapshot(selectedCourse, isAuto, customLabel);
      setSelectedCourse(updatedCourse);
      setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
      setVersionSaveStatus(isAuto ? `Auto-Saved (${newVersion.versionNumber})` : `${newVersion.versionNumber} Saved`);
      setTimeout(() => setVersionSaveStatus(null), 3500);
    } catch (err) {
      console.error('Failed to create version snapshot:', err);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleRestoreVersionSnapshot = async (versionId: string) => {
    if (!selectedCourse) return;
    try {
      const restored = await restoreCourseVersion(selectedCourse, versionId);
      setSelectedCourse(restored);
      setCourses((prev) => prev.map((c) => (c.id === restored.id ? restored : c)));
      setShowVersionHistory(false);
      setHasUnsavedChanges(false);
      setVersionSaveStatus(`Restored to ${restored.activeVersionNumber || 'Version'}`);
      setExplicitSaveStatus(`Restored to ${restored.activeVersionNumber || 'Version'}`);
      setTimeout(() => {
        setVersionSaveStatus(null);
        setExplicitSaveStatus(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to restore version:', err);
      alert('Failed to restore version snapshot.');
    }
  };

  const { isSpeaking, activeSpeakingId, speak, stopAllSpeech } = useVoice();

  const handleCopyContent = () => {
    if (!activeChapter) return;
    navigator.clipboard.writeText(activeChapter.content);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const handleDownloadMarkdown = (course?: LibraryCourse, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetCourse = course || selectedCourse;
    if (!targetCourse) return;
    const fullMd = targetCourse.chapters
      .map((ch) => `# Book ${ch.chapterNumber}: ${ch.title}\n\n${ch.content}`)
      .join('\n\n---\n\n');
    const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${targetCourse.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Curriculum.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBatchDepartmentGeneration = async () => {
    if (!selectedCourse || selectedDepartments.length === 0 || isBatchGenerating) return;
    setIsBatchGenerating(true);
    setBatchSuccessMessage('');
    try {
      const saved = await batchGenerateAndSaveDepartmentCourses(
        selectedCourse,
        selectedCourse.title,
        selectedDepartments
      );
      setCourses((prev) => [...saved, ...prev]);
      setBatchSuccessMessage(`✨ Generated & saved ${saved.length} department adaptations into the library!`);
      setTimeout(() => setBatchSuccessMessage(''), 4500);
    } catch (err) {
      console.error('Batch generation error:', err);
    } finally {
      setIsBatchGenerating(false);
    }
  };

  const loadCourses = async () => {
    setLoading(true);
    try {
      const all = await getAllLibraryCourses();
      setCourses(all);
      if (all.length > 0 && !selectedCourse) {
        setSelectedCourse(all[0]);
        setExpandedChapterId(all[0].chapters[0]?.id || null);
      }
    } catch (err) {
      console.error('Failed to load library courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await getAllCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Failed to load dynamic categories:', err);
    }
  };

  const handleSaveNewCategory = async () => {
    if (!newCatName.trim()) return;
    setIsSavingCategory(true);
    try {
      const saved = await saveCategory({
        name: newCatName.trim(),
        department: newCatDept.trim(),
        description: newCatDesc.trim(),
        color: newCatColor,
      });
      setCategories((prev) => [...prev.filter((c) => c.id !== saved.id), saved]);
      setCategoryFilter(saved.name);
      setNewCatName('');
      setNewCatDept('');
      setNewCatDesc('');
      setShowAddCategoryModal(false);
    } catch (err) {
      console.error('Failed to save category:', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (categoryFilter === id) {
        setCategoryFilter('all');
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  const handlePurgeAllData = async () => {
    if (!window.confirm('Are you sure you want to completely purge and clear all legacy course data from SQLite, IndexedDB, and cache? This leaves a pristine clean slate.')) {
      return;
    }
    setLoading(true);
    try {
      await clearAllLibraryCourses();
      await clearAllDatabaseData();
      setCourses([]);
      setSelectedCourse(null);
      setActiveTab('catalog');
    } catch (err) {
      console.error('Failed to purge library data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    loadCategories();

    const handleCoursesUpdated = () => loadCourses();
    const handleCategoriesUpdated = () => loadCategories();

    window.addEventListener('ila_library_courses_updated', handleCoursesUpdated);
    window.addEventListener('ila_categories_updated', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('ila_library_courses_updated', handleCoursesUpdated);
      window.removeEventListener('ila_categories_updated', handleCategoriesUpdated);
    };
  }, []);

  // Filtered courses based on search & category
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchesSearch =
        !searchTerm.trim() ||
        c.title.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        c.subtitle?.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        c.overview?.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        c.chapters.some((ch) => ch.title.toLowerCase().includes(searchTerm.toLowerCase().trim()));

      const matchesCat =
        categoryFilter === 'all' ||
        (c.category && c.category.toLowerCase() === categoryFilter.toLowerCase()) ||
        (c.studiedBy && c.studiedBy.toLowerCase() === categoryFilter.toLowerCase()) ||
        (c.targetAudience && c.targetAudience.toLowerCase() === categoryFilter.toLowerCase()) ||
        c.tags?.some((t) => t.toLowerCase() === categoryFilter.toLowerCase()) ||
        c.title.toLowerCase().includes(categoryFilter.toLowerCase());

      return matchesSearch && matchesCat;
    });
  }, [courses, searchTerm, categoryFilter]);

  const activeChapter: CourseChapter | undefined =
    selectedCourse?.chapters[activeChapterIndex] || selectedCourse?.chapters[0];

  const handleSelectCourseToRead = (course: LibraryCourse) => {
    setSelectedCourse(course);
    setActiveChapterIndex(0);
    setExpandedChapterId(course.chapters[0]?.id || null);
    setActiveTab('reader');
    stopAllSpeech();
  };

  const handleDeleteCourse = async (courseId: string) => {
    await deleteLibraryCourse(courseId);
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    if (selectedCourse?.id === courseId) {
      const remaining = courses.filter((c) => c.id !== courseId);
      setSelectedCourse(remaining[0] || null);
      if (remaining.length === 0) {
        setActiveTab('catalog');
      }
    }
    setCourseToDelete(null);
  };

  const handleDownloadDocx = async (course: LibraryCourse, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const fullContent = course.chapters
      .map((ch) => `# Book ${ch.chapterNumber}: ${ch.title}\n\n${ch.content}`)
      .join('\n\n---\n\n');
    await downloadWordDocx(fullContent, course.title);
  };



  // Smooth scroll to sub-topic anchor in content viewer
  const handleJumpToSubTopic = (subTopicTitle: string, chapterIndex: number) => {
    setActiveChapterIndex(chapterIndex);
    setTimeout(() => {
      const cleanSlug = subTopicTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      let targetEl = document.getElementById(`heading-${cleanSlug}`);

      if (!targetEl) {
        const allHeadings = document.querySelectorAll('h1, h2, h3, h4, [id^="heading-"]');
        for (const h of Array.from(allHeadings)) {
          if (h.textContent?.toLowerCase().includes(subTopicTitle.toLowerCase().slice(0, 20))) {
            targetEl = h as HTMLElement;
            break;
          }
        }
      }

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetEl.style.transition = 'all 0.3s ease';
        targetEl.style.background = 'rgba(99, 102, 241, 0.25)';
        targetEl.style.borderRadius = '0.4rem';
        targetEl.style.padding = '0.2rem 0.5rem';
        setTimeout(() => {
          if (targetEl) {
            targetEl.style.background = 'transparent';
          }
        }, 2000);
      }
    }, 80);
  };

  // In-place section edit trigger from MarkdownRenderer
  const handleEditSection = (headingTitle: string) => {
    if (!activeChapter) return;
    setRefiningChapterId(activeChapter.id);
    setTargetSectionTitle(headingTitle);
    setRefineInstruction(`Refine section "${headingTitle}": `);
    const reader = document.getElementById('dedicated-reader-scroll');
    if (reader) {
      reader.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Voice Dictation Toggle for Curriculum Refinement
  const handleToggleRefineVoice = () => {
    if (isRecordingRefineVoice) {
      stopListening();
      setIsRecordingRefineVoice(false);
    } else {
      setIsRecordingRefineVoice(true);
      startListening(
        (transcript, isFinal) => {
          if (isFinal && transcript) {
            setRefineInstruction((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
        },
        (err) => {
          console.error('Refine voice error:', err);
          setIsRecordingRefineVoice(false);
        },
        () => {
          setIsRecordingRefineVoice(false);
        },
        libraryLanguage
      );
    }
  };

  // Document Upload & Parsing Handler for Curriculum Refinement
  const handleRefineDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const doc = await parseFileToDocument(file);
      if (doc) {
        setAttachedRefineDocs((prev) => [...prev, doc]);
      }
    } catch (err) {
      console.error('Failed to parse uploaded document:', err);
    }
  };

  // In-Place AI Chapter / Section Refinement Execution (Text, Voice, Document Attachments)
  const handleExecuteRefinement = async (chapter: CourseChapter) => {
    if (!selectedCourse) return;
    const instruction = refineInstruction.trim();
    if ((!instruction && attachedRefineDocs.length === 0) || isRefining) return;

    setIsRefining(true);
    setRefineSuccess(false);

    try {
      let attachedText = '';
      if (attachedRefineDocs.length > 0) {
        attachedText = `\n\nATTACHED REFERENCE SYLLABUS / SOURCE DOCUMENTS:\n` +
          attachedRefineDocs
            .map((d) => `--- File: ${d.name} (${formatFileSize(d.size)}) ---\n${d.content.slice(0, 4000)}`)
            .join('\n\n');
      }

      const refinementPrompt = `You are a Master Educator and Lead Curriculum Architect for Ila Academy:
COURSE: ${selectedCourse.title}
CHAPTER NUMBER: Book ${chapter.chapterNumber}
CHAPTER TITLE: ${chapter.title}
TARGET AUDIENCE: ${selectedAudience}
${targetSectionTitle ? `SPECIFIC SECTION TO UPDATE: ${targetSectionTitle}` : ''}

EXISTING CHAPTER CONTENT:
${chapter.content}

USER REFINEMENT INSTRUCTIONS:
${instruction || 'Refine and enrich this chapter incorporating the attached reference documents thoroughly.'}
${attachedText}

CRITICAL REQUIREMENT:
Rewrite and return the complete, polished textbook-grade chapter content implementing all user requests and reference documents thoroughly.
Preserve rich Markdown formatting, bold headings, code blocks, and embedded diagrams. Return ONLY the full refined markdown chapter content.`;

      const refinedText = await generateIlaResponse(refinementPrompt, []);

      if (refinedText && refinedText.trim()) {
        const updatedChapters = selectedCourse.chapters.map((ch) =>
          ch.id === chapter.id ? { ...ch, content: refinedText } : ch
        );
        const updatedCourse = { ...selectedCourse, chapters: updatedChapters, updatedAt: Date.now() };

        setSelectedCourse(updatedCourse);
        setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));

        await saveLibraryCourse(updatedCourse);

        setRefineSuccess(true);
        setRefineInstruction('');
        setAttachedRefineDocs([]);
        setTargetSectionTitle(null);
        if (isRecordingRefineVoice) {
          stopListening();
          setIsRecordingRefineVoice(false);
        }
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

  // Translate Dedicated Library Active Chapter dynamically
  const handleTranslateLibraryChapter = async (targetLangCode?: string) => {
    const langToUse = targetLangCode || libraryLanguage;
    if (!selectedCourse || !selectedCourse.chapters[activeChapterIndex] || isTranslatingChapter || langToUse === 'en-US') return;
    const currentChap = selectedCourse.chapters[activeChapterIndex];
    const langObj =
      SUPPORTED_LANGUAGES.find((l) => l.code === langToUse) || SUPPORTED_LANGUAGES[0];

    setIsTranslatingChapter(true);
    try {
      const translated = await translateCourseContent(currentChap.content, langObj.name);

      const updatedChapters = selectedCourse.chapters.map((ch) =>
        ch.id === currentChap.id ? { ...ch, content: translated } : ch
      );
      const updatedCourse = { ...selectedCourse, chapters: updatedChapters, updatedAt: Date.now() };

      setSelectedCourse(updatedCourse);
      setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
      await saveLibraryCourse(updatedCourse);
    } catch (err) {
      console.error('Failed to translate library chapter:', err);
    } finally {
      setIsTranslatingChapter(false);
    }
  };

  return (
    <div
      id="dedicated-library-full-view"
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header & Navigation Bar */}
      <div
        style={{
          padding: '0.6rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'rgba(10, 13, 20, 0.95)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {/* Top-Level Library Navigation Tabs: Catalog vs Split Reader */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '9999px',
              padding: '0.2rem',
              gap: '0.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('catalog')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.9rem',
                borderRadius: '9999px',
                background:
                  activeTab === 'catalog'
                    ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                    : 'transparent',
                border: 'none',
                color: activeTab === 'catalog' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow:
                  activeTab === 'catalog' ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Layers size={14} />
              <span>Course Catalog ({courses.length})</span>
            </button>

            {selectedCourse && (
              <button
                type="button"
                onClick={() => setActiveTab('reader')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.9rem',
                  borderRadius: '9999px',
                  background:
                    activeTab === 'reader'
                      ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                      : 'transparent',
                  border: 'none',
                  color: activeTab === 'reader' ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow:
                    activeTab === 'reader' ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <BookOpen size={14} />
                <span>Active Reader: {selectedCourse.title.slice(0, 24)}...</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={handlePurgeAllData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '0.6rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Purge all legacy course data and start clean"
          >
            <Trash2 size={13} />
            <span>Purge All Data</span>
          </button>

          <button
            type="button"
            onClick={onCreateNewCourse}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.9rem',
              borderRadius: '0.6rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 12px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Sparkles size={14} />
            <span>Create New Course</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'catalog' ? (
        /* TAB 1: MASTER COURSE CATALOG & SEARCH FILTERS */
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '2rem 2.5rem 4rem 2.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div style={{ maxWidth: '1100px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Library Top Hero Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(20, 24, 52, 0.95) 0%, rgba(32, 25, 80, 0.95) 50%, rgba(48, 20, 75, 0.95) 100%)',
                border: '1px solid rgba(129, 140, 248, 0.4)',
                borderRadius: '1.5rem',
                padding: '2rem 2.5rem',
                boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 25px rgba(99, 102, 241, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem',
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(99, 102, 241, 0.2)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    borderRadius: '9999px',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#a5b4fc',
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                  }}
                >
                  <BookOpen size={13} />
                  <span>Enterprise Knowledge Base • SQLite DB</span>
                </div>

                <h1
                  style={{
                    fontSize: '2.1rem',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.03em',
                    lineHeight: '1.2',
                  }}
                >
                  Dedicated Course Library
                </h1>
                <p style={{ fontSize: '0.92rem', color: 'rgba(255, 255, 255, 0.75)', marginTop: '0.4rem', maxWidth: '650px' }}>
                  Manage, explore, and read all multi-book masterclasses and curriculums compiled and saved directly into your local SQLite database.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#a5b4fc', lineHeight: 1 }}>
                  {courses.length}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)', fontWeight: 600 }}>
                  Saved Enterprise Courses
                </div>
              </div>
            </div>

            {/* Filter & Search Bar with Category Dropdown and Grid/List View Toggles */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '1rem',
                padding: '0.75rem 1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
                {/* Search Box */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(10, 13, 20, 0.65)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '0.6rem',
                    padding: '0.45rem 0.85rem',
                    minWidth: '260px',
                    flex: 1,
                  }}
                >
                  <Search size={15} color="var(--text-subtle)" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search courses, books, topics..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-main)',
                      width: '100%',
                      fontSize: '0.84rem',
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Category Dropdown Filter */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'rgba(10, 13, 20, 0.65)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '0.6rem',
                    padding: '0.45rem 0.75rem',
                  }}
                >
                  <Filter size={14} color="var(--accent-primary)" />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-main)',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all" style={{ background: '#0f172a' }}>All Categories</option>
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.name} style={{ background: '#0f172a' }}>
                          {cat.name} {cat.department ? `(${cat.department})` : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="German Language" style={{ background: '#0f172a' }}>German Language (A1–C2)</option>
                        <option value="IELTS" style={{ background: '#0f172a' }}>IELTS & Academic Prep</option>
                        <option value="Enterprise ERP" style={{ background: '#0f172a' }}>Enterprise ERP & SAP</option>
                        <option value="Cloud Architecture" style={{ background: '#0f172a' }}>Cloud & Architecture</option>
                        <option value="AI & Machine Learning" style={{ background: '#0f172a' }}>AI & Machine Learning</option>
                        <option value="Full-Stack Engineering" style={{ background: '#0f172a' }}>Full-Stack Engineering</option>
                        <option value="Finance & Healthcare" style={{ background: '#0f172a' }}>Finance & Healthcare Tracks</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Dynamic Add Category Action Button */}
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.6rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    color: '#a5b4fc',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Create custom category or department track"
                >
                  <Plus size={13} />
                  <span>Add Category</span>
                </button>
              </div>

              {/* View Layout Toggle: Grid vs List */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setViewLayout('grid')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '0.5rem',
                    background: viewLayout === 'grid' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                    border: viewLayout === 'grid' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                    color: viewLayout === 'grid' ? 'var(--accent-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  <Grid size={14} />
                  <span>Grid</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewLayout('list')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '0.5rem',
                    background: viewLayout === 'list' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                    border: viewLayout === 'list' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                    color: viewLayout === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  <List size={14} />
                  <span>List</span>
                </button>
              </div>
            </div>

            {/* Courses Display: Grid or List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-subtle)' }}>
                <Sparkles size={32} className="animate-spin" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>Loading course repository from SQLite...</p>
              </div>
            ) : filteredCourses.length === 0 ? (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.5) 100%)',
                  border: '1px dashed rgba(99, 102, 241, 0.35)',
                  borderRadius: '1.25rem',
                  padding: '4rem 2rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1.25rem',
                  boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '1rem',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a5b4fc',
                  }}
                >
                  <BookOpen size={32} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                    {courses.length === 0
                      ? 'Course Library is Ready'
                      : 'No matching courses found'}
                  </h3>
                  <p style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.35rem', maxWidth: '480px', lineHeight: '1.5' }}>
                    {courses.length === 0
                      ? 'Your course library is clean and ready. Click below to begin authoring comprehensive textbooks, slide decks, video masterclasses, and checkpoint exams.'
                      : 'Adjust your search terms or category filter to locate your courses.'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={onCreateNewCourse}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.7rem 1.4rem',
                      borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.88rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(99, 102, 241, 0.45)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Plus size={16} />
                    <span>[+ Add New Course]</span>
                  </button>

                  {categoryFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('all')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.65rem 1.1rem',
                        borderRadius: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#ffffff',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={14} />
                      <span>Show All Courses</span>
                    </button>
                  )}
                </div>
              </div>
            ) : viewLayout === 'grid' ? (
              /* GRID VIEW */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    onClick={() => handleSelectCourseToRead(course)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '1.25rem',
                      padding: '1.5rem',
                      boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '1.25rem',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                      e.currentTarget.style.transform = 'translateY(-3px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                          }}
                        >
                          {course.chapters.length} {course.chapters.length === 1 ? 'Book' : 'Books'}
                        </span>

                        <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={11} />
                          <span>{new Date(course.updatedAt).toLocaleDateString()}</span>
                        </span>
                      </div>

                      <h3
                        style={{
                          fontSize: '1.1rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          letterSpacing: '-0.02em',
                          lineHeight: '1.3',
                          marginBottom: '0.4rem',
                        }}
                      >
                        {course.title}
                      </h3>

                      <p
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          lineHeight: '1.45',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {course.overview || course.subtitle}
                      </p>
                    </div>

                    {/* Actions Toolbar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleSelectCourseToRead(course)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '0.5rem',
                            padding: '0.35rem 0.75rem',
                            color: '#a5b4fc',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <span>Read Course</span>
                          <ArrowRight size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenInWorkspace(course)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '0.5rem',
                            padding: '0.35rem 0.6rem',
                            color: 'var(--text-main)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                          title="Open in Course Creator Workspace"
                        >
                          <Sparkles size={12} color="var(--accent-primary)" />
                          <span>Creator</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadDocx(course, e)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '0.4rem',
                            color: 'var(--text-muted)',
                            padding: '0.3rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Export Word (.docx)"
                        >
                          <FileText size={13} color="#818cf8" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDownloadMarkdown(course, e)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '0.4rem',
                            color: 'var(--text-muted)',
                            padding: '0.3rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Export Markdown (.md)"
                        >
                          <Download size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCourseToDelete(course);
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '0.4rem',
                            color: 'var(--error)',
                            padding: '0.3rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Delete Course"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* LIST VIEW */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '1rem',
                  overflow: 'hidden',
                }}
              >
                {filteredCourses.map((course, idx) => (
                  <div
                    key={course.id}
                    onClick={() => handleSelectCourseToRead(course)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '1rem 1.25rem',
                      borderBottom:
                        idx === filteredCourses.length - 1
                          ? 'none'
                          : '1px solid rgba(255, 255, 255, 0.05)',
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      gap: '1rem',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '0.5rem',
                          background: 'rgba(99, 102, 241, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-primary)',
                          flexShrink: 0,
                        }}
                      >
                        <BookOpen size={18} />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h4
                            style={{
                              fontSize: '0.94rem',
                              fontWeight: 700,
                              color: '#ffffff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {course.title}
                          </h4>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '0.05rem 0.4rem',
                              borderRadius: '9999px',
                              background: 'rgba(99, 102, 241, 0.2)',
                              color: '#a5b4fc',
                              flexShrink: 0,
                            }}
                          >
                            {course.chapters.length} Books
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: '0.76rem',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          {course.overview || course.subtitle}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginRight: '0.5rem' }}>
                        {new Date(course.updatedAt).toLocaleDateString()}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSelectCourseToRead(course)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.2)',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                          borderRadius: '0.45rem',
                          color: '#a5b4fc',
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Read
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDownloadDocx(course, e)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '0.4rem',
                          color: 'var(--text-muted)',
                          padding: '0.3rem',
                          cursor: 'pointer',
                        }}
                        title="Export Word DOCX"
                      >
                        <FileText size={13} color="#818cf8" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCourseToDelete(course);
                        }}
                        style={{
                          background: 'transparent',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: '0.4rem',
                          color: 'var(--error)',
                          padding: '0.3rem',
                          cursor: 'pointer',
                        }}
                        title="Delete Course"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: EXCLUSIVE SPLIT-VIEW COURSE READER */
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {selectedCourse && (
            <>
              {/* Left Sticky Chapters Accordion Menu */}
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
                {/* Course Title Header */}
                <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--accent-primary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                    Reading Course
                  </div>
                  <h3 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>
                    {selectedCourse.title}
                  </h3>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '0.35rem' }}>
                    {selectedCourse.chapters.length} Books • Saved in SQLite
                  </div>
                </div>

                {/* Collapsible Chapters Accordion */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.65rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {selectedCourse.chapters.map((chap, idx) => {
                      const isCurrent = idx === activeChapterIndex;
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
                            transition: 'all 0.2s ease',
                          }}
                        >
                          {/* Accordion Row */}
                          <div
                            onClick={() => {
                              setActiveChapterIndex(idx);
                              setExpandedChapterId((prev) => (prev === chap.id ? null : chap.id));
                            }}
                            style={{
                              padding: '0.65rem 0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                                      background: 'rgba(16, 185, 129, 0.2)',
                                      color: '#34d399',
                                    }}
                                  >
                                    Active
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveChapterIndex(idx);
                                    setRefiningChapterId((prev) => (prev === chap.id ? null : chap.id));
                                    setTargetSectionTitle(null);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: refiningChapterId === chap.id ? '#c084fc' : 'var(--text-subtle)',
                                    cursor: 'pointer',
                                    padding: '0.15rem',
                                  }}
                                  title="Edit chapter with AI"
                                >
                                  <Sparkles size={12} />
                                </button>
                                <ChevronDown
                                  size={14}
                                  style={{
                                    color: 'var(--text-subtle)',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                  }}
                                />
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

                          {/* Subtopics with Interactive Links */}
                          {isExpanded && (
                            <div
                              style={{
                                padding: '0.4rem 0.75rem 0.65rem 0.75rem',
                                background: 'rgba(0, 0, 0, 0.25)',
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.3rem',
                              }}
                            >
                              <div style={{ fontSize: '0.64rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                                Subtopics (Click to scroll)
                              </div>
                              {chap.subTopics && chap.subTopics.length > 0 ? (
                                chap.subTopics.map((st) => (
                                  <div
                                    key={st.id}
                                    onClick={() => handleJumpToSubTopic(st.title, idx)}
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
                                          setActiveChapterIndex(idx);
                                          setActiveVideoTopicNumber(st.topicNumber);
                                          setActiveReaderTab('video');
                                          const reader = document.getElementById('dedicated-reader-scroll');
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
                                  1.1 Core Architecture • 1.2 Practical Labs
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

              {/* Right Content Viewer Pane */}
              <main
                id="dedicated-reader-scroll"
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
                    {/* In-Place AI Refinement Drawer */}
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
                            }}
                          >
                            <X size={15} />
                          </button>
                        </div>

                        <p style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.4' }}>
                          Targeted instructions to rewrite, adjust tone, expand with enterprise labs, or clarify this section via AI.
                        </p>

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
                              }}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

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
                                <span>Refine</span>
                              </>
                            )}
                          </button>
                        </div>

                        {refineSuccess && (
                                  <div style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Check size={14} />
                            <span>Chapter updated with AI instructions and saved to SQLite!</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Top Sticky Context & Department Adaptation Bar */}
                    <div
                      id="dedicated-course-context-bar"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        padding: '0.55rem 1rem',
                        borderRadius: '0.85rem',
                        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(26, 20, 50, 0.95) 100%)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.4)',
                      }}
                    >
                      {/* Left: Active Course Title & Book Count */}
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
                          <BookOpen size={11} color="#38bdf8" />
                          <span>Admin Course</span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.82rem',
                            color: '#ffffff',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={selectedCourse.title}
                        >
                          {selectedCourse.title}
                        </div>
                      </div>

                      {/* Right: Department Adaptation ("Studied By") Selector & Stats */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            id="dedicated-studied-by-btn"
                            type="button"
                            onClick={() => setIsAudienceMenuOpen(!isAudienceMenuOpen)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              height: '28px',
                              padding: '0 0.65rem',
                              borderRadius: '9999px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.4)',
                              color: '#7dd3fc',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            title="Filter or adapt course for specific target learner category"
                          >
                            <UserCheck size={11} color="#38bdf8" />
                            <span>{selectedCourse?.studiedBy || selectedAudience}</span>
                            <ChevronDown size={10} />
                          </button>

                          {isAudienceMenuOpen && (
                            <>
                              <div
                                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                                onClick={() => setIsAudienceMenuOpen(false)}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '100%',
                                  marginTop: '0.4rem',
                                  width: '280px',
                                  background: 'rgba(15, 23, 42, 0.98)',
                                  border: '1px solid rgba(99, 102, 241, 0.4)',
                                  borderRadius: '0.75rem',
                                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                                  zIndex: 9999,
                                  padding: '0.4rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.25rem',
                                }}
                              >
                                <div style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                                  Target Learner Category (9 Departments)
                                </div>
                                {LEARNER_CATEGORIES.map((cat) => {
                                  const isSel = (selectedCourse?.studiedBy || selectedAudience) === cat.name;
                                  return (
                                    <button
                                      key={cat.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedAudience(cat.name);
                                        localStorage.setItem('ila_learner_category', cat.name);
                                        if (selectedCourse) {
                                          const updated = { ...selectedCourse, studiedBy: cat.name };
                                          setSelectedCourse(updated);
                                          saveLibraryCourse(updated);
                                        }
                                        setIsAudienceMenuOpen(false);
                                      }}
                                      style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start',
                                        gap: '0.15rem',
                                        padding: '0.45rem 0.6rem',
                                        borderRadius: '0.45rem',
                                        background: isSel ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                                        border: isSel ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid transparent',
                                        color: isSel ? '#ffffff' : 'var(--text-main)',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>{cat.name}</span>
                                        {isSel && <Check size={12} color="#38bdf8" />}
                                      </div>
                                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                                        {cat.description}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>

                        <div
                          style={{
                            fontSize: '0.68rem',
                            color: 'var(--text-subtle)',
                            background: 'rgba(255, 255, 255, 0.04)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '9999px',
                          }}
                        >
                          {selectedCourse.chapters.length} Books
                        </div>
                      </div>
                    </div>

                    {/* Unified Single Master Toolbar Architecture (Exact Sequential Flow) */}
                    <div
                      id="dedicated-unified-master-toolbar"
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(15, 20, 32, 0.96)',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '0.85rem',
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
                      {/* Left & Center Sequence: Modules 1-6 -> Structure -> Coach -> Refine -> Save & Version -> Download, Speaker, Copy -> Language */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {/* Core Learning Modules (Clean Names without Numeric Prefixes) */}
                        {[
                          { id: 'reading', label: 'Reading Mode', icon: BookOpen, color: '#38bdf8' },
                          { id: 'explanations', label: 'Tutor Bot', icon: GraduationCap, color: '#a855f7' },
                          { id: 'slides', label: 'Slide + AI', icon: Presentation, color: '#f472b6' },
                          { id: 'video', label: 'Video + AI', icon: Tv, color: '#f43f5e' },
                          { id: 'coach', label: 'Intelli Coach', icon: Bot, color: '#10b981' },
                          { id: 'exams', label: 'Exam Board', icon: Award, color: '#fbbf24' },
                          { id: 'dictionary', label: 'Glossary', icon: HelpCircle, color: '#2dd4bf' },
                          { id: 'structure', label: 'Structure', icon: ShieldCheck, color: '#818cf8' },
                        ].map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeReaderTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              id={`dedicated-tab-${tab.id}`}
                              type="button"
                              onClick={() => setActiveReaderTab(tab.id as any)}
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

                        {/* Dedicated Full-Screen Focus Toggle */}


                        {/* Section Divider */}
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 0.15rem' }} />

                        {/* 7. Refine with AI */}
                        {activeChapter && (
                          <button
                            id="dedicated-refine-chapter-btn"
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

                        {/* 8. Save to Library & Save Version */}
                        <button
                          id="dedicated-save-library-btn"
                          type="button"
                          onClick={async () => {
                            if (!selectedCourse) return;
                            await saveLibraryCourse(selectedCourse);
                            setVersionSaveStatus('Saved');
                            setTimeout(() => setVersionSaveStatus(null), 3000);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            height: '28px',
                            padding: '0 0.65rem',
                            borderRadius: '9999px',
                            background: versionSaveStatus
                              ? 'rgba(16, 185, 129, 0.25)'
                              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
                            border: versionSaveStatus
                              ? '1px solid rgba(16, 185, 129, 0.5)'
                              : '1px solid rgba(165, 180, 252, 0.45)',
                            color: versionSaveStatus ? '#34d399' : '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 0 10px rgba(99, 102, 241, 0.25)',
                          }}
                          title="Save course to SQLite & IndexedDB"
                        >
                          {versionSaveStatus ? <Check size={11} /> : <Bookmark size={11} />}
                          <span>{versionSaveStatus || 'Save'}</span>
                        </button>

                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                          <button
                            id="dedicated-save-new-version-btn"
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
                            <span>{(selectedCourse?.versions || []).length}</span>
                          </button>
                        </div>

                        {/* Section Divider */}
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 0.15rem' }} />

                        {/* 9. Download, Speaker, & Copy */}
                        <div style={{ position: 'relative' }}>
                          <button
                            id="dedicated-download-export-btn"
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
                                style={{ position: 'fixed', inset: 0, zIndex: 998 }}
                                onClick={() => setIsExportMenuOpen(false)}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: '100%',
                                  marginTop: '0.35rem',
                                  background: 'rgba(15, 23, 42, 0.98)',
                                  border: '1px solid rgba(99, 102, 241, 0.35)',
                                  borderRadius: '0.6rem',
                                  padding: '0.35rem',
                                  minWidth: '150px',
                                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
                                  zIndex: 999,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.2rem',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    setIsExportMenuOpen(false);
                                    handleDownloadDocx(selectedCourse, e);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '0.4rem',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontWeight: 600,
                                  }}
                                >
                                  <FileText size={12} color="#38bdf8" />
                                  <span>Download DOCX</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsExportMenuOpen(false);
                                    handleDownloadMarkdown();
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    padding: '0.4rem 0.6rem',
                                    borderRadius: '0.4rem',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontWeight: 600,
                                  }}
                                >
                                  <Download size={12} color="#a855f7" />
                                  <span>Download Markdown</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Speaker TTS Read-Aloud */}
                        <button
                          id="dedicated-speaker-btn"
                          type="button"
                          onClick={() => {
                            if (activeChapter) {
                              if (isSpeaking && activeSpeakingId === activeChapter.id) {
                                stopAllSpeech();
                              } else {
                                speak(activeChapter.content, activeChapter.id, libraryLanguage);
                              }
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            height: '28px',
                            padding: '0 0.65rem',
                            borderRadius: '9999px',
                            background:
                              activeChapter && isSpeaking && activeSpeakingId === activeChapter.id
                                ? 'rgba(239, 68, 68, 0.25)'
                                : 'rgba(255, 255, 255, 0.05)',
                            border:
                              activeChapter && isSpeaking && activeSpeakingId === activeChapter.id
                                ? '1px solid rgba(239, 68, 68, 0.5)'
                                : '1px solid rgba(255, 255, 255, 0.12)',
                            color:
                              activeChapter && isSpeaking && activeSpeakingId === activeChapter.id
                                ? '#f87171'
                                : 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title={activeChapter && isSpeaking && activeSpeakingId === activeChapter.id ? 'Stop audio narration' : 'Listen to chapter narration'}
                        >
                          {activeChapter && isSpeaking && activeSpeakingId === activeChapter.id ? (
                            <>
                              <VolumeX size={11} color="#f87171" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 size={11} color="#38bdf8" />
                              <span>Speaker</span>
                            </>
                          )}
                        </button>

                        {/* Copy Markdown Content */}
                        <button
                          id="dedicated-copy-content-btn"
                          type="button"
                          onClick={handleCopyContent}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            height: '28px',
                            padding: '0 0.65rem',
                            borderRadius: '9999px',
                            background: copyFeedback
                              ? 'rgba(16, 185, 129, 0.25)'
                              : 'rgba(255, 255, 255, 0.05)',
                            border: copyFeedback
                              ? '1px solid rgba(16, 185, 129, 0.5)'
                              : '1px solid rgba(255, 255, 255, 0.12)',
                            color: copyFeedback ? '#34d399' : 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          title="Copy raw markdown to clipboard"
                        >
                          {copyFeedback ? <Check size={11} color="#34d399" /> : <Copy size={11} color="var(--text-subtle)" />}
                          <span>{copyFeedback ? 'Copied' : 'Copy'}</span>
                        </button>

                        {/* Section Divider */}
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 0.15rem' }} />

                        {/* 10. Language Selection & Interactive Translate */}
                        <LanguageVoiceSelector
                          compact
                          currentLanguage={libraryLanguage}
                          onLanguageChange={(langCode) => {
                            setLibraryLanguage(langCode);
                            localStorage.setItem('ila_active_language', langCode);
                            handleTranslateLibraryChapter(langCode);
                          }}
                          onTranslateContent={(langCode) => handleTranslateLibraryChapter(langCode || libraryLanguage)}
                          showTranslateButton={true}
                          showVoiceProfile={false}
                          isTranslating={isTranslatingChapter}
                        />

                        {/* Section Divider */}
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 0.15rem' }} />

                        {/* 11. Department Multi-Select & Batch Adaptation Generator */}
                        <div style={{ position: 'relative' }}>
                          <button
                            id="dedicated-studied-by-btn"
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
                                style={{ position: 'fixed', inset: 0, zIndex: 999990 }}
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
                                  zIndex: 999999,
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

                                {batchSuccessMessage && (
                                  <div
                                    style={{
                                      padding: '0.4rem 0.6rem',
                                      borderRadius: '0.4rem',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      border: '1px solid rgba(16, 185, 129, 0.4)',
                                      color: '#34d399',
                                      fontSize: '0.72rem',
                                      fontWeight: 600,
                                      textAlign: 'center',
                                    }}
                                  >
                                    {batchSuccessMessage}
                                  </div>
                                )}

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

                        {/* Direct Generate Button */}
                        <button
                          id="dedicated-generate-dept-btn"
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
                      </div>
                    </div>

                    {/* ======================================================== */}
                    {/* UNIFIED ACTIVE MODULE CONTENT                             */}
                    {/* ====================================                    {/* Tab 1: Reading Mode */}
                    {activeReaderTab === 'reading' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Chapter Header Card with Cross-Module Navigation */}
                        <div
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '1.25rem',
                            padding: '1.5rem',
                            boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.6)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                              {selectedCourse.title} • Book {activeChapter.chapterNumber} of {selectedCourse.chapters.length}
                            </div>

                            {/* Cross-Module Quick Previews from Reading Mode */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => setActiveReaderTab('slides')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(244, 114, 182, 0.15)',
                                  border: '1px solid rgba(244, 114, 182, 0.35)',
                                  color: '#f472b6',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Open Slide + AI for this book"
                              >
                                <Presentation size={12} />
                                <span>Slide + AI</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveReaderTab('video')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(244, 63, 94, 0.15)',
                                  border: '1px solid rgba(244, 63, 94, 0.35)',
                                  color: '#fb7185',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Open Video + AI player for this book"
                              >
                                <Tv size={12} />
                                <span>Video + AI</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveReaderTab('explanations')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(168, 85, 247, 0.15)',
                                  border: '1px solid rgba(168, 85, 247, 0.35)',
                                  color: '#c084fc',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Open Tutor Bot explanations"
                              >
                                <GraduationCap size={12} />
                                <span>Tutor Bot</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveReaderTab('exams')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(251, 191, 36, 0.15)',
                                  border: '1px solid rgba(251, 191, 36, 0.35)',
                                  color: '#fbbf24',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Open Exam Board"
                              >
                                <Award size={12} />
                                <span>Exam Board</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setActiveReaderTab('dictionary')}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: '9999px',
                                  background: 'rgba(45, 212, 191, 0.15)',
                                  border: '1px solid rgba(45, 212, 191, 0.35)',
                                  color: '#2dd4bf',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Open Glossary"
                              >
                                <HelpCircle size={12} />
                                <span>Glossary</span>
                              </button>
                            </div>
                          </div>

                          <h1
                            style={{
                              fontSize: '1.6rem',
                              fontWeight: 800,
                              color: '#ffffff',
                              letterSpacing: '-0.02em',
                              lineHeight: '1.25',
                              margin: '0 0 0.5rem 0',
                            }}
                          >
                            {activeChapter.title}
                          </h1>
                          {activeChapter.summary && (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                              {activeChapter.summary}
                            </p>
                          )}
                        </div>

                        {/* National/International Authorized Curriculum & Framework Reference Card */}
                        <AuthorizedCurriculumBanner
                          courseTitle={selectedCourse.title}
                          content={activeChapter.content}
                        />

                        {/* Advanced Input AI Refinement & Authoring Suite (Text, Voice, Document Upload) */}
                        {refiningChapterId === activeChapter.id && (
                          <div
                            style={{
                              background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
                              border: '1.5px solid rgba(168, 85, 247, 0.5)',
                              borderRadius: '1.25rem',
                              padding: '1.25rem 1.5rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.85rem',
                              boxShadow: '0 15px 35px -10px rgba(168, 85, 247, 0.35)',
                            }}
                          >
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Wand2 size={18} color="#c084fc" />
                                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff' }}>
                                  AI Curriculum Refiner & Authoring Suite
                                </span>
                                {targetSectionTitle && (
                                  <span style={{ fontSize: '0.72rem', background: 'rgba(168, 85, 247, 0.25)', color: '#e9d5ff', padding: '0.1rem 0.5rem', borderRadius: '9999px' }}>
                                    Section: {targetSectionTitle}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setRefiningChapterId(null);
                                  setTargetSectionTitle(null);
                                  if (isRecordingRefineVoice) {
                                    stopListening();
                                    setIsRecordingRefineVoice(false);
                                  }
                                }}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                              >
                                <X size={18} />
                              </button>
                            </div>

                            {/* Quick Suggestion Chips */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              {[
                                'Explain In Greater Depth',
                                'Add Step-by-Step Code Walkthrough',
                                'Add Architecture Diagram & Flows',
                                'Include Real-World Enterprise Scenario',
                                'Add Checkpoint Quiz Questions',
                                'Simplify Tone for Beginners',
                              ].map((chip) => (
                                <button
                                  key={chip}
                                  type="button"
                                  onClick={() => {
                                    setRefineInstruction((prev) => (prev ? `${prev}. ${chip}` : chip));
                                  }}
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '9999px',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: '#cbd5e1',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  + {chip}
                                </button>
                              ))}
                            </div>

                            {/* Textarea Instruction Input */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <textarea
                                rows={3}
                                value={refineInstruction}
                                onChange={(e) => setRefineInstruction(e.target.value)}
                                placeholder="Type custom curriculum instructions or dictate via microphone..."
                                style={{
                                  width: '100%',
                                  padding: '0.75rem',
                                  borderRadius: '0.65rem',
                                  background: 'rgba(5, 8, 16, 0.9)',
                                  border: '1px solid rgba(168, 85, 247, 0.35)',
                                  color: '#ffffff',
                                  fontSize: '0.82rem',
                                  lineHeight: '1.4',
                                  resize: 'none',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />

                              {/* Attached Documents List */}
                              {attachedRefineDocs.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                  {attachedRefineDocs.map((doc) => (
                                    <div
                                      key={doc.id}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.2rem 0.55rem',
                                        borderRadius: '0.4rem',
                                        background: 'rgba(56, 189, 248, 0.15)',
                                        border: '1px solid rgba(56, 189, 248, 0.35)',
                                        color: '#38bdf8',
                                        fontSize: '0.72rem',
                                      }}
                                    >
                                      <File size={12} />
                                      <span>{doc.name} ({formatFileSize(doc.size)})</span>
                                      <button
                                        type="button"
                                        onClick={() => setAttachedRefineDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                                        style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 0 }}
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Authoring Toolbar Row: 🎤 Voice Input + 📎 File Upload + 🚀 Execute */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {/* 🎤 Voice Input Button */}
                                  <button
                                    type="button"
                                    onClick={handleToggleRefineVoice}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '0.5rem',
                                      background: isRecordingRefineVoice ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                      border: isRecordingRefineVoice ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                                      color: isRecordingRefineVoice ? '#ef4444' : '#e2e8f0',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    title={isRecordingRefineVoice ? 'Stop voice recording' : 'Dictate instructions using microphone'}
                                  >
                                    {isRecordingRefineVoice ? <MicOff size={14} className="animate-pulse" /> : <Mic size={14} color="#38bdf8" />}
                                    <span>{isRecordingRefineVoice ? 'Listening (Click to Stop)...' : 'Voice Input'}</span>
                                  </button>

                                  {/* 📎 Document Upload Button */}
                                  <label
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.3rem',
                                      padding: '0.35rem 0.75rem',
                                      borderRadius: '0.5rem',
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      border: '1px solid rgba(255, 255, 255, 0.15)',
                                      color: '#e2e8f0',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    title="Attach .txt, .md, .docx, or .pdf reference documents"
                                  >
                                    <Paperclip size={14} color="#a855f7" />
                                    <span>Upload Doc</span>
                                    <input
                                      type="file"
                                      accept=".txt,.md,.doc,.docx,.pdf,.json"
                                      onChange={handleRefineDocUpload}
                                      style={{ display: 'none' }}
                                    />
                                  </label>
                                </div>

                                {/* 🚀 Execute Refinement Button */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {refineSuccess && (
                                    <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}>
                                      <Check size={14} /> Refined & Saved!
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleExecuteRefinement(activeChapter)}
                                    disabled={isRefining || (!refineInstruction.trim() && attachedRefineDocs.length === 0)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      padding: '0.45rem 1.25rem',
                                      borderRadius: '0.5rem',
                                      background:
                                        !isRefining && (refineInstruction.trim() || attachedRefineDocs.length > 0)
                                          ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)'
                                          : 'rgba(255, 255, 255, 0.08)',
                                      border: 'none',
                                      color: '#ffffff',
                                      fontSize: '0.78rem',
                                      fontWeight: 800,
                                      cursor:
                                        !isRefining && (refineInstruction.trim() || attachedRefineDocs.length > 0)
                                          ? 'pointer'
                                          : 'not-allowed',
                                      boxShadow:
                                        !isRefining && (refineInstruction.trim() || attachedRefineDocs.length > 0)
                                          ? '0 0 15px rgba(168, 85, 247, 0.4)'
                                          : 'none',
                                    }}
                                  >
                                    {isRefining ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                                    <span>{isRefining ? 'Refining Chapter...' : 'Refine with AI'}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Chapter Body */}
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
                            onPlayClassVideo={() => setActiveReaderTab('video')}
                          />
                        </div>

                        {/* Pagination Buttons */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '0.5rem',
                            paddingBottom: '1.5rem',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const nextIdx = Math.max(0, activeChapterIndex - 1);
                              setActiveChapterIndex(nextIdx);
                              setExpandedChapterId(selectedCourse.chapters[nextIdx]?.id || null);
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
                              color: activeChapterIndex === 0 ? 'var(--text-subtle)' : '#ffffff',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: activeChapterIndex === 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <ChevronLeft size={16} />
                            <span>Previous Book</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const nextIdx = Math.min(selectedCourse.chapters.length - 1, activeChapterIndex + 1);
                              setActiveChapterIndex(nextIdx);
                              setExpandedChapterId(selectedCourse.chapters[nextIdx]?.id || null);
                            }}
                            disabled={activeChapterIndex === selectedCourse.chapters.length - 1}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.6rem 1.1rem',
                              borderRadius: '0.6rem',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid var(--border-subtle)',
                              color: activeChapterIndex === selectedCourse.chapters.length - 1 ? 'var(--text-subtle)' : '#ffffff',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: activeChapterIndex === selectedCourse.chapters.length - 1 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <span>Next Book</span>
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tab 2: Tutor Bot / Explanations Board */}
                    {activeReaderTab === 'explanations' && (
                      <ExplanationsBoard
                        courseTitle={selectedCourse.title}
                        chapter={activeChapter}
                        chapterNumber={activeChapter.chapterNumber}
                        activeLanguage={libraryLanguage}
                        targetAudience={selectedAudience}
                        onOpenReading={() => setActiveReaderTab('reading')}
                        onOpenSlides={() => setActiveReaderTab('slides')}
                        onOpenVideo={(topicNumber) => {
                          setActiveReaderTab('video');
                          if (topicNumber) setActiveVideoTopicNumber(topicNumber);
                        }}
                        onScriptUpdate={(updatedMd) => {
                          const updatedChapters = selectedCourse.chapters.map((ch) =>
                            ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                          );
                          const updated = { ...selectedCourse, chapters: updatedChapters, updatedAt: Date.now() };
                          setSelectedCourse(updated);
                          setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                          saveLibraryCourse(updated);
                        }}
                      />
                    )}

                    {/* Tab 3: Slide + AI Masterclass */}
                    {activeReaderTab === 'slides' && (
                      <SlideDecksViewer
                        courseTitle={selectedCourse.title}
                        chapterTitle={activeChapter.title}
                        chapterNumber={activeChapter.chapterNumber}
                        chapterContent={activeChapter.content}
                        activeLanguage={libraryLanguage}
                        onLanguageChange={(lang) => {
                          setLibraryLanguage(lang);
                          localStorage.setItem('ila_active_language', lang);
                        }}
                        activeVoiceProfile={libraryVoiceProfile}
                        onVoiceProfileChange={(vId) => {
                          setLibraryVoiceProfile(vId);
                          localStorage.setItem('ila_active_voice_profile', vId);
                        }}
                        targetAudience={selectedCourse.studiedBy || selectedCourse.targetAudience}
                        onJumpToReadingTab={() => setActiveReaderTab('reading')}
                        onScriptUpdate={(updated) => {
                          const updatedChs = (selectedCourse.chapters || []).map((ch, i) =>
                            i === activeChapterIndex ? { ...ch, content: updated } : ch
                          );
                          const updatedCourse = { ...selectedCourse, chapters: updatedChs };
                          setSelectedCourse(updatedCourse);
                          setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
                          saveLibraryCourse(updatedCourse);
                        }}
                      />
                    )}

                    {/* Tab 4: Video + AI Player */}
                    {activeReaderTab === 'video' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <MasterclassVideoPlayer
                          courseTitle={selectedCourse.title}
                          chapterTitle={activeChapter.title}
                          chapterNumber={activeChapter.chapterNumber}
                          chapterContent={activeChapter.content}
                          initialTopicNumber={activeVideoTopicNumber}
                          activeLanguage={libraryLanguage}
                          activeVoiceProfile={libraryVoiceProfile}
                          isCompact={false}
                          hasNextChapter={activeChapterIndex < selectedCourse.chapters.length - 1}
                          onNextChapter={() =>
                            setActiveChapterIndex((prev) =>
                              Math.min(selectedCourse.chapters.length - 1, prev + 1)
                            )
                          }
                          hasPreviousChapter={activeChapterIndex > 0}
                          onPreviousChapter={() =>
                            setActiveChapterIndex((prev) => Math.max(0, prev - 1))
                          }
                        />
                      </div>
                    )}

                    {/* Tab: Intelli Coach */}
                    {activeReaderTab === 'coach' && (
                      <IntelliCoachView
                        initialCourse={selectedCourse}
                        isEmbedded={true}
                        onOpenReadingTab={() => setActiveReaderTab('reading')}
                        onOpenSlideTab={() => setActiveReaderTab('slides')}
                        onOpenVideoTab={() => setActiveReaderTab('video')}
                      />
                    )}

                    {/* Tab 5: Exam Board */}
                    {activeReaderTab === 'exams' && (
                      <ExamsBoard
                        courseTitle={selectedCourse.title}
                        chapter={activeChapter}
                        chapterNumber={activeChapter.chapterNumber}
                        allChapters={selectedCourse.chapters}
                        onOpenReading={() => setActiveReaderTab('reading')}
                        onOpenSlides={() => setActiveReaderTab('slides')}
                        onOpenVideo={() => setActiveReaderTab('video')}
                        onScriptUpdate={(updatedMd) => {
                          const updatedChapters = selectedCourse.chapters.map((ch) =>
                            ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                          );
                          const updated = { ...selectedCourse, chapters: updatedChapters, updatedAt: Date.now() };
                          setSelectedCourse(updated);
                          setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                          saveLibraryCourse(updated);
                        }}
                      />
                    )}

                    {/* Tab 6: Course Dictionary / Glossary */}
                    {activeReaderTab === 'dictionary' && (
                      <CourseDictionary
                        courseTitle={selectedCourse.title}
                        chapter={activeChapter}
                        chapterNumber={activeChapter.chapterNumber}
                        allChapters={selectedCourse.chapters}
                        activeLanguage={libraryLanguage}
                        onOpenReading={() => setActiveReaderTab('reading')}
                        onOpenSlides={() => setActiveReaderTab('slides')}
                        onOpenVideo={() => setActiveReaderTab('video')}
                        onScriptUpdate={(updatedMd) => {
                          const updatedChapters = selectedCourse.chapters.map((ch) =>
                            ch.id === activeChapter.id ? { ...ch, content: updatedMd } : ch
                          );
                          const updated = { ...selectedCourse, chapters: updatedChapters, updatedAt: Date.now() };
                          setSelectedCourse(updated);
                          setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                          saveLibraryCourse(updated);
                        }}
                      />
                    )}

                    {/* Tab 7: Authorized Course Structure */}
                    {activeReaderTab === 'structure' && (
                      <AuthorizedCourseStructureTab
                        courseTitle={selectedCourse.title}
                        chapters={selectedCourse.chapters}
                        targetAudience={selectedAudience}
                        initialStandardInfo={selectedCourse.authorizedStructure}
                        onSaveStandardInfo={(info) => {
                          const updated = { ...selectedCourse, authorizedStructure: info };
                          setSelectedCourse(updated);
                          saveLibraryCourse(updated);
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-subtle)' }}>
                    <BookOpen size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                    <p>Select a book from the index to start reading.</p>
                  </div>
                )}
              </main>
            </>
          )}
        </div>
      )}

      {/* Secure Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(courseToDelete)}
        title="Delete Course from SQLite Library?"
        itemTitle={courseToDelete?.title || 'Course'}
        onCancel={() => setCourseToDelete(null)}
        onConfirm={() => {
          if (courseToDelete) {
            handleDeleteCourse(courseToDelete.id);
          }
        }}
      />

      {/* Presentation-Ready Teaching Slides Modal */}
      {showSlidesModal && activeChapter && selectedCourse && (
        <TeachingSlidesModal
          courseTitle={selectedCourse.title}
          chapterTitle={activeChapter.title}
          chapterNumber={activeChapter.chapterNumber}
          chapterContent={activeChapter.content}
          activeLanguage={libraryLanguage}
          activeVoiceProfile={libraryVoiceProfile}
          onClose={() => setShowSlidesModal(false)}
        />
      )}

      {/* Version History & Rollback Modal */}
      {showVersionHistory && selectedCourse && (
        <div
          id="dedicated-version-history-modal"
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
              {(!selectedCourse.versions || selectedCourse.versions.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  <Clock size={36} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>No previous version snapshots saved yet.</p>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                    Click "Update / Auto-Save New Version" on the top action bar to capture a snapshot.
                  </p>
                </div>
              ) : (
                [...selectedCourse.versions].reverse().map((ver, idx) => {
                  const isCurrent = selectedCourse.activeVersionNumber === ver.versionNumber || idx === 0;
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
                Total snapshots: {(selectedCourse.versions || []).length}
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
      {showSlidesModal && selectedCourse && activeChapter && (
        <TeachingSlidesModal
          courseTitle={selectedCourse.title}
          chapterTitle={activeChapter.title}
          chapterNumber={activeChapter.chapterNumber}
          chapterContent={activeChapter.content}
          activeLanguage={libraryLanguage}
          activeVoiceProfile={libraryVoiceProfile}
          onClose={() => setShowSlidesModal(false)}
          onOpenInVideo={() => {
            setShowSlidesModal(false);
            setActiveReaderTab('video');
            setActiveVideoTopicNumber(`${activeChapter.chapterNumber}.1`);
          }}
        />
      )}

      {/* Direct Content Editor Modal */}
      {showDirectEditorModal && selectedCourse && activeChapter && (
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
      {showDeleteChapterModal && selectedCourse && activeChapter && (
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
      {showAddNewChapterModal && selectedCourse && (
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
      {isModuleFullScreen && selectedCourse && activeChapter && (
        <div
          id="admin-module-dedicated-fullpage-view"
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
                id="admin-dedicated-module-back-btn"
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
                title="Return to Main Admin Dashboard (Auto-saves uncommitted edits to version history)"
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
                  { id: 'video', label: '4. Video + AI', icon: Tv, color: '#f43f5e' },
                  { id: 'coach', label: '5. Intelli Coach', icon: Bot, color: '#10b981' },
                  { id: 'exams', label: '6. Exam Board', icon: Award, color: '#fbbf24' },
                  { id: 'dictionary', label: '7. Glossary', icon: HelpCircle, color: '#2dd4bf' },
                  { id: 'structure', label: '8. Structure', icon: ShieldCheck, color: '#818cf8' },
                ].map((mTab) => {
                  const Icon = mTab.icon;
                  const isActive = activeReaderTab === mTab.id;
                  return (
                    <button
                      key={mTab.id}
                      type="button"
                      onClick={() => setActiveReaderTab(mTab.id as any)}
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
                  setExpandedChapterId(selectedCourse.chapters[idx]?.id || null);
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
                {selectedCourse.chapters.map((ch, cIdx) => (
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
                id="admin-dedicated-explicit-save-btn"
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
                id="admin-dedicated-create-version-btn"
                type="button"
                onClick={() => setShowCustomVersionModal(true)}
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
                id="admin-dedicated-version-history-btn"
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
                <span>Versions ({(selectedCourse?.versions || []).length})</span>
              </button>
            </div>
          </header>

          {/* Full-Page Body Content */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '1rem', height: 'calc(100% - 60px)' }}>
            {(activeReaderTab === 'reading' || activeReaderTab === 'structure') && (
              <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '1rem', height: '100%', overflow: 'hidden' }}>
                {/* Pinned Chapter & Subtopic Index Navigation Sidebar */}
                <aside
                  id="admin-fullpage-reading-index-sidebar"
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
                      {selectedCourse.chapters.length} Books
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto' }}>
                    {selectedCourse.chapters.map((chap, idx) => {
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
                <div id="admin-fullpage-reading-content-scroll" style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', background: 'rgba(12, 18, 32, 0.95)', borderRadius: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '2rem' }}>
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
                    onPlayClassVideo={() => setActiveReaderTab('video')}
                  />
                </div>
              </div>
            )}
            {activeReaderTab === 'explanations' && (
              <ExplanationsBoard
                courseTitle={selectedCourse.title}
                chapter={activeChapter}
                chapterNumber={activeChapter.chapterNumber}
                activeLanguage={libraryLanguage}
                targetAudience={selectedAudience}
                onOpenSlides={() => setActiveReaderTab('slides')}
                onOpenVideo={(topicNumber) => {
                  setActiveReaderTab('video');
                  if (topicNumber) setActiveVideoTopicNumber(topicNumber);
                }}
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeReaderTab === 'slides' && (
              <SlideDecksViewer
                courseTitle={selectedCourse.title}
                chapterTitle={activeChapter.title}
                chapterNumber={activeChapter.chapterNumber}
                chapterContent={activeChapter.content}
                targetAudience={selectedAudience}
                onJumpToReadingTab={() => setActiveReaderTab('reading')}
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeReaderTab === 'video' && (
              <MasterclassVideoPlayer
                courseTitle={selectedCourse.title}
                chapterTitle={activeChapter.title}
                chapterNumber={activeChapter.chapterNumber}
                chapterContent={activeChapter.content}
                initialTopicNumber={activeVideoTopicNumber}
                activeLanguage={libraryLanguage}
                activeVoiceProfile={libraryVoiceProfile}
                isCompact={false}
                isStudentMode={false}
                enableCheckpointExam={true}
                hasNextChapter={activeChapterIndex < selectedCourse.chapters.length - 1}
                onNextChapter={() =>
                  setActiveChapterIndex((prev) =>
                    Math.min(selectedCourse.chapters.length - 1, prev + 1)
                  )
                }
                hasPreviousChapter={activeChapterIndex > 0}
                onPreviousChapter={() =>
                  setActiveChapterIndex((prev) => Math.max(0, prev - 1))
                }
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeReaderTab === 'coach' && (
              <IntelliCoachView
                initialCourse={selectedCourse}
                isEmbedded={true}
                onOpenReadingTab={() => setActiveReaderTab('reading')}
                onOpenSlideTab={() => setActiveReaderTab('slides')}
                onOpenVideoTab={() => setActiveReaderTab('video')}
              />
            )}
            {activeReaderTab === 'exams' && (
              <ExamsBoard
                courseTitle={selectedCourse.title}
                chapter={activeChapter}
                chapterNumber={activeChapter.chapterNumber}
                allChapters={selectedCourse.chapters}
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeReaderTab === 'dictionary' && (
              <CourseDictionary
                courseTitle={selectedCourse.title}
                chapter={activeChapter}
                chapterNumber={activeChapter.chapterNumber}
                allChapters={selectedCourse.chapters}
                activeLanguage={libraryLanguage}
                onScriptUpdate={handleModuleScriptUpdate}
              />
            )}
            {activeReaderTab === 'structure' && (
              <AuthorizedCourseStructureTab
                courseTitle={selectedCourse.title}
                chapters={selectedCourse.chapters}
                targetAudience={selectedAudience}
                initialStandardInfo={selectedCourse.authorizedStructure}
                onSaveStandardInfo={(info) => {
                  const updated = { ...selectedCourse, authorizedStructure: info };
                  setSelectedCourse(updated);
                  setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                  saveLibraryCourse(updated);
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Custom Version Label Modal */}
      {showCustomVersionModal && selectedCourse && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.75)',
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
              maxWidth: '480px',
              background: '#0d1322',
              borderRadius: '1.25rem',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              padding: '1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
              Save New Version Snapshot
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Capture the current state of all books, slides, video teleprompters, exams, and dictionary terms into SQLite version history.
            </p>

            <input
              type="text"
              value={customVersionLabel}
              onChange={(e) => setCustomVersionLabel(e.target.value)}
              placeholder="e.g. Major curriculum update after department review"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                fontSize: '0.82rem',
                outline: 'none',
                marginBottom: '1.25rem',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCustomVersionModal(false);
                  setCustomVersionLabel('');
                }}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateNewVersionSnapshot(customVersionLabel)}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
                }}
              >
                Create Version Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Add Category Modal */}
      {showAddCategoryModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.75)',
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
              maxWidth: '520px',
              background: '#0d1322',
              borderRadius: '1.25rem',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              padding: '1.75rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '0.6rem',
                    background: 'rgba(99, 102, 241, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#a5b4fc',
                  }}
                >
                  <Plus size={18} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
                  Create Course Category
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              Define a dynamic category or department track (e.g. German A1–C2, IELTS, Cloud Ops, Medical German) to categorize and filter courses across all views.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.35rem' }}>
                  Category Name *
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. German Language (Goethe/Telc)"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.35rem' }}>
                  Department / Track (Optional)
                </label>
                <input
                  type="text"
                  value={newCatDept}
                  onChange={(e) => setNewCatDept(e.target.value)}
                  placeholder="e.g. Languages & CEFR, Engineering, Healthcare"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.35rem' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Brief summary of learning goals or audience for this track..."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    outline: 'none',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

                <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.45rem' }}>
                  Badge Accent Color
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {['#6366f1', '#a855f7', '#ec4899', '#10b981', '#38bdf8', '#f59e0b', '#ef4444'].map((col) => (
                    <div
                      key={col}
                      onClick={() => setNewCatColor(col)}
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        background: col,
                        cursor: 'pointer',
                        border: newCatColor === col ? '2px solid #ffffff' : '2px solid transparent',
                        transform: newCatColor === col ? 'scale(1.2)' : 'scale(1)',
                        transition: 'all 0.15s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#a5b4fc', marginBottom: '0.45rem' }}>
                    Existing Categories ({categories.length})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto' }}>
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.45rem',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: cat.color || '#38bdf8' }} />
                          <span style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: 600 }}>{cat.name}</span>
                          {cat.department && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({cat.department})</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCategory(cat.id, e)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#f87171',
                            cursor: 'pointer',
                            padding: '0.2rem',
                          }}
                          title="Delete category"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowAddCategoryModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewCategory}
                disabled={!newCatName.trim() || isSavingCategory}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 1.35rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: !newCatName.trim() || isSavingCategory ? 'not-allowed' : 'pointer',
                  opacity: !newCatName.trim() || isSavingCategory ? 0.6 : 1,
                  boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
                }}
              >
                {isSavingCategory ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>Save Category</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
