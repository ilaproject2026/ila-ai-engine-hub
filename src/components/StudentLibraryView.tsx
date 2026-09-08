import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Presentation,
  Tv,
  Award,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  TrendingUp,
  Search,
  Filter,
  Grid,
  PanelLeft,
  Play,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Clock,
  Loader2,
  Sparkles,
  Send,
  X,
} from 'lucide-react';
import {
  LibraryCourse,
  getAllLibraryCourses,
  LEARNER_CATEGORIES,
  CourseChapter,
} from '../services/dbService';
import SlideDecksViewer from './SlideDecksViewer';
import MasterclassVideoPlayer from './MasterclassVideoPlayer';
import ExamsBoard from './ExamsBoard';
import CourseDictionary from './CourseDictionary';
import MarkdownRenderer from './MarkdownRenderer';
import LanguageVoiceSelector from './LanguageVoiceSelector';
import { useVoice } from '../hooks/useVoice';
import { cleanMarkdownForSpeech, getScopedVoiceProfilesForLanguage } from '../services/speechService';
import { translateCourseContent, askIntelliCoach } from '../services/geminiService';

interface StudentLibraryViewProps {
  mode?: 'slide_ai' | 'video_ai';
  onSelectCourse?: (course: LibraryCourse) => void;
  onNavigateToCatalog?: () => void;
}

interface SubTopicItem {
  id: string;
  topicNumber: string;
  title: string;
  slideIndex: number;
}

export default function StudentLibraryView({
  mode = 'slide_ai',
}: StudentLibraryViewProps) {
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [activeCourse, setActiveCourse] = useState<LibraryCourse | null>(null);
  
  // Student Portal View Mode: 'catalog' (Grid/Block View) vs 'reader' (Chapter Tree & Masterclass View)
  const [studentViewMode, setStudentViewMode] = useState<'catalog' | 'reader'>('catalog');
  
  // Active Tab in Reader: 'slides' (Slide + AI Masterclass) | 'reading' (Textbook) | 'video' (Video AI) | 'exams' | 'dictionary'
  const isSlideAiMode = mode === 'slide_ai';
  const isVideoAiMode = mode === 'video_ai';

  const [activeTab, setActiveTab] = useState<'slides' | 'reading' | 'video' | 'exams' | 'dictionary'>(
    isSlideAiMode ? 'slides' : 'video'
  );
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [activeVideoTopicNumber, setActiveVideoTopicNumber] = useState<string | undefined>(undefined);

  // Left Chapter Navigation Tree Collapsible State
  const [isChapterTreeOpen, setIsChapterTreeOpen] = useState<boolean>(true);
  const [chapterSearchTerm, setChapterSearchTerm] = useState<string>('');
  const [expandedChapterIds, setExpandedChapterIds] = useState<Record<string, boolean>>({});

  // Real-Time Language Translation State
  const [studentLanguage, setStudentLanguage] = useState<string>(() => {
    return localStorage.getItem('ila_active_language') || 'en-US';
  });
  const [studentVoiceProfile, setStudentVoiceProfile] = useState<string>(() => {
    return localStorage.getItem('ila_active_voice_profile') || 'coqui-xtts-multilingual';
  });
  const [isTranslating, setIsTranslating] = useState<boolean>(false);
  const [translationBannerText, setTranslationBannerText] = useState<string>('');
  // In-memory Translation Cache: key is `${courseId}_${chapterId}_${langCode}`
  const [translationsCache, setTranslationsCache] = useState<Record<string, string>>({});

  // Reading Actions State
  const [copiedTextbook, setCopiedTextbook] = useState<boolean>(false);

  // In-Session Doubt Clearing State for Students
  const [showStudentDoubtModal, setShowStudentDoubtModal] = useState<boolean>(false);
  const [studentDoubtQuery, setStudentDoubtQuery] = useState<string>('');
  const [isAskingStudentDoubt, setIsAskingStudentDoubt] = useState<boolean>(false);
  const [studentDoubtAnswer, setStudentDoubtAnswer] = useState<string | null>(null);

  const { isSpeaking, speak, stopAllSpeech } = useVoice();

  // Load library courses
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const fetched = await getAllLibraryCourses();
        setCourses(fetched);
        if (fetched.length > 0) {
          setActiveCourse((prev) => prev ? fetched.find((c) => c.id === prev.id) || fetched[0] : fetched[0]);
        }
      } catch (err) {
        console.error('Failed to load student courses:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();

    // Master-Slave Architecture: Real-time listener for Admin Library updates
    const handleCoursesUpdated = async () => {
      try {
        const fetched = await getAllLibraryCourses();
        setCourses(fetched);
        setActiveCourse((prev) => {
          if (!prev) return fetched[0] || null;
          const matching = fetched.find((c) => c.id === prev.id);
          return matching || prev;
        });
      } catch (err) {
        console.error('Failed to sync student library on admin update:', err);
      }
    };

    window.addEventListener('ila_library_courses_updated', handleCoursesUpdated);
    return () => {
      window.removeEventListener('ila_library_courses_updated', handleCoursesUpdated);
    };
  }, []);

  // Filter courses by search and department
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.subtitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.overview || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept =
        selectedDepartment === 'all' ||
        c.studiedBy === selectedDepartment ||
        c.targetAudience === selectedDepartment;
      return matchSearch && matchDept;
    });
  }, [courses, searchQuery, selectedDepartment]);

  const rawActiveChapter = activeCourse?.chapters?.[activeChapterIndex] || activeCourse?.chapters?.[0];

  // Derive active chapter content with real-time translation applied
  const activeChapterContent = useMemo(() => {
    if (!rawActiveChapter || !activeCourse) return '';
    if (studentLanguage === 'en-US' || studentLanguage === 'en') {
      return rawActiveChapter.content;
    }
    const cacheKey = `${activeCourse.id}_${rawActiveChapter.id}_${studentLanguage}`;
    return translationsCache[cacheKey] || rawActiveChapter.content;
  }, [activeCourse, rawActiveChapter, studentLanguage, translationsCache]);

  const activeChapter: CourseChapter | undefined = useMemo(() => {
    if (!rawActiveChapter) return undefined;
    return {
      ...rawActiveChapter,
      content: activeChapterContent,
    };
  }, [rawActiveChapter, activeChapterContent]);

  // Real-Time Language Translation Trigger Function
  const handleTranslateActiveContent = useCallback(
    async (targetLangCode?: string) => {
      const langToTranslate = targetLangCode || studentLanguage;
      if (!rawActiveChapter || !activeCourse) return;
      if (langToTranslate === 'en-US' || langToTranslate === 'en') {
        return;
      }
      const cacheKey = `${activeCourse.id}_${rawActiveChapter.id}_${langToTranslate}`;
      if (translationsCache[cacheKey]) {
        return; // Already translated in cache
      }

      setIsTranslating(true);
      setTranslationBannerText(`Translating Book ${rawActiveChapter.chapterNumber} into ${langToTranslate}... ✨`);
      try {
        const translated = await translateCourseContent(rawActiveChapter.content, langToTranslate);
        if (translated && translated.trim().length > 0) {
          setTranslationsCache((prev) => ({
            ...prev,
            [cacheKey]: translated,
          }));
        }
      } catch (err) {
        console.error('Real-time translation error in student portal:', err);
      } finally {
        setIsTranslating(false);
        setTranslationBannerText('');
      }
    },
    [activeCourse, rawActiveChapter, studentLanguage, translationsCache]
  );

  // Handle language change from selector
  const handleLanguageChange = (langCode: string) => {
    setStudentLanguage(langCode);
    localStorage.setItem('ila_active_language', langCode);

    // Auto-select first scoped voice for this language
    const scopedVoices = getScopedVoiceProfilesForLanguage(langCode);
    if (scopedVoices.length > 0) {
      const bestVoice = scopedVoices[0].id;
      setStudentVoiceProfile(bestVoice);
      localStorage.setItem('ila_active_voice_profile', bestVoice);
    }

    // Auto-trigger translation
    handleTranslateActiveContent(langCode);
  };

  // Extract 1.1, 1.2, 1.3 subtopics dynamically for chapter
  const getSubtopicsForChapter = (ch: CourseChapter, chIndex: number): SubTopicItem[] => {
    if (ch.subTopics && ch.subTopics.length > 0) {
      return ch.subTopics.map((st, sIdx) => ({
        id: st.id || `sub_${chIndex}_${sIdx}`,
        topicNumber: st.topicNumber || `${ch.chapterNumber}.${sIdx + 1}`,
        title: st.title,
        slideIndex: sIdx + 1,
      }));
    }

    // Extract subheadings (## or ###) from chapter content
    const lines = (ch.content || '').split('\n');
    const items: SubTopicItem[] = [];
    let count = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ') || line.startsWith('### ')) {
        const clean = line.replace(/^#+\s*/, '').trim();
        if (clean.length > 2) {
          items.push({
            id: `sub_${ch.id}_${count}`,
            topicNumber: `${ch.chapterNumber}.${count}`,
            title: clean,
            slideIndex: count,
          });
          count++;
        }
      }
    }

    if (items.length > 0) return items;

    // Fallback standard subtopics
    return [
      { id: `sub_${ch.id}_1`, topicNumber: `${ch.chapterNumber}.1`, title: 'Core Concepts & Principles', slideIndex: 1 },
      { id: `sub_${ch.id}_2`, topicNumber: `${ch.chapterNumber}.2`, title: 'Technical Architecture & Operations', slideIndex: 2 },
      { id: `sub_${ch.id}_3`, topicNumber: `${ch.chapterNumber}.3`, title: 'Practical Workflows & Best Practices', slideIndex: 3 },
    ];
  };

  const handleOpenCourseInReader = (
    course: LibraryCourse,
    tab: 'slides' | 'reading' | 'video' = isSlideAiMode ? 'slides' : 'video',
    chapterIdx: number = 0,
    slideIdx: number = 0
  ) => {
    setActiveCourse(course);
    setActiveChapterIndex(chapterIdx);
    setActiveSlideIndex(slideIdx);
    setActiveTab(tab);
    setStudentViewMode('reader');
    stopAllSpeech();

    // Auto translate if foreign language active
    if (studentLanguage !== 'en-US' && studentLanguage !== 'en') {
      const targetCh = course.chapters?.[chapterIdx];
      if (targetCh) {
        const cacheKey = `${course.id}_${targetCh.id}_${studentLanguage}`;
        if (!translationsCache[cacheKey]) {
          handleTranslateActiveContent(studentLanguage);
        }
      }
    }
  };

  const handleToggleChapterExpand = (chId: string) => {
    setExpandedChapterIds((prev) => ({
      ...prev,
      [chId]: !prev[chId],
    }));
  };

  const handleCopyChapterContent = () => {
    if (!activeChapter?.content) return;
    navigator.clipboard.writeText(activeChapter.content);
    setCopiedTextbook(true);
    setTimeout(() => setCopiedTextbook(false), 2000);
  };

  const handleSpeakChapterContent = () => {
    if (isSpeaking) {
      stopAllSpeech();
      return;
    }
    if (!activeChapter?.content) return;
    const clean = cleanMarkdownForSpeech(activeChapter.content);
    speak(clean, `student_ch_${activeChapter.id}`, studentLanguage);
  };

  return (
    <div
      id="student-library-portal"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#090d16',
        color: '#f8fafc',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 1. Student Portal Top Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1.5rem',
          background: 'rgba(12, 17, 30, 0.98)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '0.65rem',
              background: isVideoAiMode
                ? 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)'
                : 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isVideoAiMode
                ? '0 0 15px rgba(236, 72, 153, 0.4)'
                : '0 0 15px rgba(56, 189, 248, 0.4)',
              flexShrink: 0,
            }}
          >
            {isSlideAiMode ? (
              <Presentation size={19} color="#ffffff" />
            ) : (
              <Tv size={19} color="#ffffff" />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h1 style={{ fontSize: '1.02rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isVideoAiMode ? 'Video + AI Masterclass Library' : 'Slide + AI Masterclass Library'}
              </h1>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.12rem 0.55rem',
                  borderRadius: '9999px',
                  background: isVideoAiMode ? 'rgba(236, 72, 153, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                  border: isVideoAiMode ? '1px solid rgba(236, 72, 153, 0.45)' : '1px solid rgba(56, 189, 248, 0.4)',
                  color: isVideoAiMode ? '#f472b6' : '#38bdf8',
                  flexShrink: 0,
                }}
              >
                {isVideoAiMode ? 'ENTERPRISE VIDEO PLAYER & 1.1/1.2 CUES' : 'DYNAMIC SLIDE DECKS & TTS NARRATION'}
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isVideoAiMode
                ? 'Studio video masterclasses with structured 1.1 / 1.2 chapter navigation, timeline scrubbing, speed control, and video checkpoints.'
                : 'Interactive split-screen slide decks with live narration highlights, synchronized textbook reading, and instant translation.'}
            </p>
          </div>
        </div>

        {/* Right Header: View Mode Switcher, Department Filter, Search & Scoped Voice Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
          {/* View Mode Toggle: Catalog (Grid) vs Reader (Chapter Navigation) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.45rem',
              padding: '0.15rem',
              gap: '0.15rem',
            }}
          >
            <button
              type="button"
              onClick={() => setStudentViewMode('catalog')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.28rem 0.65rem',
                borderRadius: '0.35rem',
                background: studentViewMode === 'catalog' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                border: studentViewMode === 'catalog' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
                color: studentViewMode === 'catalog' ? '#38bdf8' : 'var(--text-muted)',
                fontSize: '0.74rem',
                fontWeight: studentViewMode === 'catalog' ? 700 : 500,
                cursor: 'pointer',
              }}
              title="Course Catalog (Grid/Block View)"
            >
              <Grid size={13} />
              <span>Course Catalog</span>
            </button>

            <button
              type="button"
              onClick={() => setStudentViewMode('reader')}
              disabled={!activeCourse}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.28rem 0.65rem',
                borderRadius: '0.35rem',
                background: studentViewMode === 'reader' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                border: studentViewMode === 'reader' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                color: studentViewMode === 'reader' ? '#a5b4fc' : 'var(--text-muted)',
                fontSize: '0.74rem',
                fontWeight: studentViewMode === 'reader' ? 700 : 500,
                cursor: activeCourse ? 'pointer' : 'not-allowed',
              }}
              title="Chapter Textbook & Masterclass Reader Mode"
            >
              <BookOpen size={13} />
              <span>Read Mode</span>
            </button>
          </div>

          {/* Department Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Filter size={12} color="var(--text-subtle)" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                height: '32px',
                padding: '0 0.65rem',
                borderRadius: '0.45rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '0.74rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ background: '#0f172a' }}>All Profiles / Categories</option>
              {LEARNER_CATEGORIES.filter((c) => c.id !== 'all_categories').map((cat) => (
                <option key={cat.id} value={cat.name} style={{ background: '#0f172a' }}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student Multi-Language & Scoped Voice Selector with Live Translation */}
          <LanguageVoiceSelector
            compact
            currentLanguage={studentLanguage}
            onLanguageChange={handleLanguageChange}
            currentVoiceProfile={studentVoiceProfile}
            onVoiceProfileChange={(vId) => {
              setStudentVoiceProfile(vId);
              localStorage.setItem('ila_active_voice_profile', vId);
            }}
            onTranslateContent={handleTranslateActiveContent}
            isTranslating={isTranslating}
            showVoiceProfile={true}
            showTranslateButton={true}
          />

          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '32px',
              padding: '0 0.6rem',
              borderRadius: '0.45rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <Search size={12} color="var(--text-subtle)" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                fontSize: '0.74rem',
                width: '130px',
              }}
            />
          </div>
        </div>
      </header>

      {/* 2. Promotional Level Upgrade Banner (Replacing 'Create New Course' in Student Library) */}
      <div
        id="student-promotional-upgrade-banner"
        style={{
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.15) 100%)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.25)',
          padding: '0.45rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ec4899, #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={11} color="#ffffff" />
          </div>
          <div style={{ fontSize: '0.74rem' }}>
            <span style={{ fontWeight: 700, color: '#ffffff' }}>Level 2 & 3 Advanced Upgrades & Official Certifications: </span>
            <span style={{ color: '#cbd5e1' }}>
              Explore over 12+ specialized curriculum tracks with split-screen slide masterclasses, practical labs, and real-time multi-lingual narration.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStudentViewMode('catalog')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            height: '26px',
            padding: '0 0.85rem',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            border: 'none',
            color: '#ffffff',
            fontSize: '0.72rem',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(236, 72, 153, 0.35)',
          }}
        >
          <span>Explore 12+ Course Tracks</span>
          <ChevronRight size={11} />
        </button>
      </div>

      {/* Translation Progress Alert Bar */}
      {isTranslating && (
        <div
          style={{
            background: 'linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)',
            color: '#ffffff',
            padding: '0.35rem 1.5rem',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: '0 2px 10px rgba(59, 130, 246, 0.4)',
            flexShrink: 0,
          }}
        >
          <Loader2 size={13} className="animate-spin" />
          <span>{translationBannerText || 'Translating active course and slide deck in real-time...'}</span>
        </div>
      )}

      {/* 3. Main Workspace: Course Catalog Grid View OR Chapter-by-Chapter Reader View */}
      {studentViewMode === 'catalog' ? (
        /* Course Catalog (Grid / Block View) */
        <div
          id="student-course-catalog-grid"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem 2rem',
            background: 'radial-gradient(circle at 50% 20%, rgba(20, 28, 48, 0.6) 0%, rgba(9, 13, 22, 1) 100%)',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Enrolled Course Catalog ({filteredCourses.length} Courses)
                </h2>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Select any course card to launch the comprehensive chapter navigation tree, split-screen slide masterclass, and textbook.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading course library...
              </div>
            ) : filteredCourses.length === 0 ? (
              <div
                style={{
                  padding: '3rem',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '1rem',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                }}
              >
                <BookOpen size={40} style={{ opacity: 0.3, margin: '0 auto 0.75rem' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem' }}>
                  No courses matching your filter
                </h3>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Try adjusting the department filter or search query.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: '1.25rem',
                }}
              >
                {filteredCourses.map((c) => {
                  const totalChapters = c.chapters?.length || 0;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleOpenCourseInReader(c, isSlideAiMode ? 'slides' : 'video', 0)}
                      style={{
                        borderRadius: '0.85rem',
                        background: 'rgba(15, 22, 38, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.45)';
                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(56, 189, 248, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.4)';
                      }}
                    >
                      {/* Course Card Header Gradient */}
                      <div
                        style={{
                          padding: '1.1rem 1.25rem 0.85rem 1.25rem',
                          background: 'linear-gradient(135deg, rgba(30, 41, 70, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              padding: '0.12rem 0.5rem',
                              borderRadius: '9999px',
                              background: 'rgba(56, 189, 248, 0.15)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              color: '#38bdf8',
                            }}
                          >
                            {c.studiedBy || c.targetAudience || 'General Audience'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#a5b4fc', fontWeight: 600 }}>
                            {totalChapters} Books / Modules
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.35rem 0', lineHeight: '1.3' }}>
                          {c.title}
                        </h3>

                        {c.subtitle && (
                          <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                            {c.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Course Card Body */}
                      <div style={{ padding: '0.85rem 1.25rem', flex: 1 }}>
                        <p style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: '1.45', margin: '0 0 0.85rem 0' }}>
                          {c.overview ? (c.overview.length > 140 ? c.overview.substring(0, 140) + '...' : c.overview) : 'Comprehensive enterprise curriculum with structured slide decks, textbook reading, and live quizzes.'}
                        </p>

                        {/* Chapter Breakdown Preview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {(c.chapters || []).slice(0, 3).map((ch, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                fontSize: '0.7rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <span style={{ color: '#38bdf8', fontWeight: 700 }}>▸</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Book {ch.chapterNumber}: {ch.title}
                              </span>
                            </div>
                          ))}
                          {(c.chapters || []).length > 3 && (
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                              + {c.chapters.length - 3} more book chapters
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div
                        style={{
                          padding: '0.75rem 1.25rem',
                          background: 'rgba(10, 15, 28, 0.95)',
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                        }}
                      >
                        {isSlideAiMode ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCourseInReader(c, 'slides', 0);
                            }}
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.5rem',
                              background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 0 10px rgba(56, 189, 248, 0.3)',
                            }}
                          >
                            <Presentation size={13} />
                            <span>Slide + AI Masterclass</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCourseInReader(c, 'video', 0);
                            }}
                            style={{
                              flex: 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.35rem',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.5rem',
                              background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                              border: 'none',
                              color: '#ffffff',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: '0 0 10px rgba(236, 72, 153, 0.3)',
                            }}
                          >
                            <Tv size={13} />
                            <span>Video + AI Masterclass</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCourseInReader(c, 'reading', 0);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.75rem',
                            borderRadius: '0.5rem',
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#ffffff',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Read Course Textbook"
                        >
                          <BookOpen size={12} color="#a5b4fc" />
                          <span>Text</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Chapter-by-Chapter Textbook Reader & Masterclass View with Admin-Style 1.1 / 1.2 Breakdown Tree */
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Left Sticky Admin-Style Chapter Navigation Tree with 1.1, 1.2 Subtopics */}
          {isChapterTreeOpen && activeCourse && (
            <aside
              id="student-chapter-navigation-tree"
              style={{
                width: '300px',
                minWidth: '300px',
                maxWidth: '300px',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(8, 12, 22, 0.96)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflowY: 'auto',
              }}
            >
              {/* Chapter Sidebar Header */}
              <div
                style={{
                  padding: '0.75rem 0.85rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'rgba(12, 17, 30, 0.98)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexShrink: 0,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Course Navigation Tree
                  </div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '210px' }}>
                    {activeCourse.title}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsChapterTreeOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-subtle)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                  }}
                  title="Collapse Chapter Tree"
                >
                  <ChevronLeft size={15} />
                </button>
              </div>

              {/* Chapter Search Filter */}
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '0.45rem',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.74rem',
                  }}
                >
                  <Search size={12} color="var(--text-subtle)" style={{ marginRight: '0.35rem' }} />
                  <input
                    type="text"
                    value={chapterSearchTerm}
                    onChange={(e) => setChapterSearchTerm(e.target.value)}
                    placeholder="Filter chapters & 1.1 topics..."
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      width: '100%',
                    }}
                  />
                </div>
              </div>

              {/* Accordion Chapters List with 1.1, 1.2 Breakdown */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {(activeCourse.chapters || [])
                  .filter((ch) =>
                    !chapterSearchTerm.trim() ||
                    ch.title.toLowerCase().includes(chapterSearchTerm.toLowerCase()) ||
                    `Book ${ch.chapterNumber}`.toLowerCase().includes(chapterSearchTerm.toLowerCase())
                  )
                  .map((ch, idx) => {
                    const isSelected = activeChapterIndex === idx;
                    const isExpanded = expandedChapterIds[ch.id] ?? true;
                    const subtopics = getSubtopicsForChapter(ch, idx);

                    return (
                      <div
                        key={ch.id || idx}
                        style={{
                          marginBottom: '0.45rem',
                          borderRadius: '0.55rem',
                          background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.06)',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Chapter Accordion Header Button */}
                        <div
                          onClick={() => {
                            setActiveChapterIndex(idx);
                            setActiveSlideIndex(0);
                            stopAllSpeech();
                          }}
                          style={{
                            padding: '0.6rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                            <span
                              style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: isSelected ? 'linear-gradient(135deg, #38bdf8, #6366f1)' : 'rgba(255, 255, 255, 0.08)',
                                color: '#ffffff',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {ch.chapterNumber}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isSelected ? '#38bdf8' : '#ffffff', lineHeight: '1.25' }}>
                                Book {ch.chapterNumber}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ch.title}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleChapterExpand(ch.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-subtle)',
                              cursor: 'pointer',
                              padding: '0.2rem',
                            }}
                          >
                            <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }} />
                          </button>
                        </div>

                        {/* Chapter 1.1, 1.2 Subtopics Breakdown Tree */}
                        {isExpanded && (
                          <div
                            style={{
                              padding: '0.35rem 0.65rem 0.5rem 0.65rem',
                              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              background: 'rgba(0, 0, 0, 0.25)',
                            }}
                          >
                            {/* Subtopics List */}
                            {subtopics.map((st) => (
                              <div
                                key={st.id}
                                style={{
                                  fontSize: '0.72rem',
                                  color: isSelected && activeSlideIndex === st.slideIndex ? '#38bdf8' : 'var(--text-muted)',
                                  padding: '0.25rem 0.45rem',
                                  borderRadius: '0.35rem',
                                  background: isSelected && activeSlideIndex === st.slideIndex ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                  border: isSelected && activeSlideIndex === st.slideIndex ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.35rem',
                                }}
                              >
                                <div
                                  onClick={() => {
                                    setActiveChapterIndex(idx);
                                    if (isSlideAiMode) {
                                      setActiveSlideIndex(st.slideIndex);
                                      setActiveTab('slides');
                                    } else {
                                      setActiveVideoTopicNumber(st.topicNumber);
                                      setActiveTab('video');
                                    }
                                    stopAllSpeech();
                                  }}
                                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
                                  title={isSlideAiMode ? `Jump to Slide: ${st.title}` : `Jump to Video Topic ${st.topicNumber}: ${st.title}`}
                                >
                                  <strong style={{ color: isSelected && (isSlideAiMode ? activeSlideIndex === st.slideIndex : activeVideoTopicNumber === st.topicNumber) ? '#38bdf8' : '#a5b4fc', marginRight: '0.3rem' }}>
                                    {st.topicNumber}
                                  </strong>
                                  <span>{st.title}</span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveChapterIndex(idx);
                                      setActiveTab('reading');
                                      stopAllSpeech();
                                    }}
                                    style={{
                                      fontSize: '0.62rem',
                                      color: '#a5b4fc',
                                      background: 'rgba(99, 102, 241, 0.15)',
                                      border: '1px solid rgba(99, 102, 241, 0.3)',
                                      borderRadius: '9999px',
                                      padding: '0.1rem 0.4rem',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.2rem',
                                    }}
                                    title="Link to Book Chapter text"
                                  >
                                    <BookOpen size={9} />
                                    <span>Link to Book</span>
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Quick Action Pathway Buttons */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                paddingTop: '0.35rem',
                                marginTop: '0.2rem',
                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                              }}
                            >
                              {isSlideAiMode ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveChapterIndex(idx);
                                    setActiveTab('slides');
                                    stopAllSpeech();
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '0.22rem 0.35rem',
                                    borderRadius: '0.35rem',
                                    background: isSelected && activeTab === 'slides' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    color: isSelected && activeTab === 'slides' ? '#38bdf8' : '#cbd5e1',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.2rem',
                                  }}
                                >
                                  <Presentation size={10} />
                                  <span>Slides</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveChapterIndex(idx);
                                    setActiveTab('video');
                                    stopAllSpeech();
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '0.22rem 0.35rem',
                                    borderRadius: '0.35rem',
                                    background: isSelected && activeTab === 'video' ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    color: isSelected && activeTab === 'video' ? '#f472b6' : '#cbd5e1',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.2rem',
                                  }}
                                >
                                  <Tv size={10} />
                                  <span>Video AI</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setActiveChapterIndex(idx);
                                  setActiveTab('reading');
                                  stopAllSpeech();
                                }}
                                style={{
                                  flex: 1,
                                  padding: '0.22rem 0.35rem',
                                  borderRadius: '0.35rem',
                                  background: isSelected && activeTab === 'reading' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  color: isSelected && activeTab === 'reading' ? '#a5b4fc' : '#cbd5e1',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.2rem',
                                }}
                              >
                                <BookOpen size={10} />
                                <span>Textbook</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </aside>
          )}

          {/* Center Main Stage Reader / Slide + AI Masterclass View */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            {activeCourse && activeChapter ? (
              <>
                {/* Course & Chapter Top Breadcrumb Navigation */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 1.25rem',
                    background: 'rgba(12, 17, 30, 0.96)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    flexShrink: 0,
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Chapter Tree Expand Button (when collapsed) */}
                    {!isChapterTreeOpen && (
                      <button
                        type="button"
                        onClick={() => setIsChapterTreeOpen(true)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '0.4rem',
                          color: '#ffffff',
                          cursor: 'pointer',
                          padding: '0.3rem 0.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                        title="Expand Chapter Navigation Tree"
                      >
                        <PanelLeft size={13} />
                        <span>Chapters</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setStudentViewMode('catalog')}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-subtle)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        padding: '0.2rem 0.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span>‹ Catalog</span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                      <span>{activeCourse.title}</span>
                      <span>›</span>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                        Book {activeChapter.chapterNumber}: {activeChapter.title}
                      </span>
                    </div>
                  </div>

                  {/* Student Tab Navigation Strip (Strictly Decoupled by Package Mode) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {(isSlideAiMode
                      ? [
                          { id: 'slides', label: '1. Slide + AI Decks', icon: Presentation, color: '#38bdf8' },
                          { id: 'reading', label: '2. Course Textbook', icon: BookOpen, color: '#a5b4fc' },
                          { id: 'exams', label: '3. Exam Board', icon: Award, color: '#fbbf24' },
                          { id: 'dictionary', label: '4. Glossary', icon: HelpCircle, color: '#2dd4bf' },
                        ]
                      : [
                          { id: 'video', label: '1. Video Masterclass', icon: Tv, color: '#f43f5e' },
                          { id: 'reading', label: '2. Course Textbook', icon: BookOpen, color: '#a5b4fc' },
                          { id: 'exams', label: '3. Exam Board', icon: Award, color: '#fbbf24' },
                          { id: 'dictionary', label: '4. Glossary', icon: HelpCircle, color: '#2dd4bf' },
                        ]
                    ).map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(tab.id as any);
                            stopAllSpeech();
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '0.45rem',
                            background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            border: isActive ? `1.5px solid ${tab.color}` : '1px solid rgba(255, 255, 255, 0.08)',
                            color: isActive ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '0.74rem',
                            fontWeight: isActive ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <Icon size={12} color={isActive ? tab.color : 'var(--text-subtle)'} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}

                    {/* In-Session Doubt Interaction Trigger */}
                    <button
                      id="student-in-session-doubt-btn"
                      type="button"
                      onClick={() => setShowStudentDoubtModal(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '0.45rem',
                        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%)',
                        border: '1px solid rgba(168, 85, 247, 0.5)',
                        color: '#f472b6',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 0 10px rgba(168, 85, 247, 0.25)',
                        transition: 'all 0.15s ease',
                      }}
                      title="Ask Tutor Bot a doubt on Book content without disrupting playback"
                    >
                      <Sparkles size={12} color="#f472b6" />
                      <span>Ask AI Doubt</span>
                    </button>
                  </div>
                </div>

                {/* Tab Content Display */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                  {activeTab === 'slides' && (
                    <SlideDecksViewer
                      courseTitle={activeCourse.title}
                      chapterTitle={activeChapter.title}
                      chapterNumber={activeChapter.chapterNumber}
                      chapterContent={activeChapter.content}
                      isStudentMode={true}
                      activeLanguage={studentLanguage}
                      onLanguageChange={handleLanguageChange}
                      activeVoiceProfile={studentVoiceProfile}
                      onVoiceProfileChange={(vId) => {
                        setStudentVoiceProfile(vId);
                        localStorage.setItem('ila_active_voice_profile', vId);
                      }}
                      onTranslateContent={handleTranslateActiveContent}
                      isTranslating={isTranslating}
                      activeSlideIndex={activeSlideIndex}
                      onSlideChange={(sIdx) => setActiveSlideIndex(sIdx)}
                      hasNextChapter={activeChapterIndex < (activeCourse.chapters || []).length - 1}
                      onNextChapter={() => {
                        setActiveChapterIndex((prev) => Math.min((activeCourse.chapters || []).length - 1, prev + 1));
                        setActiveSlideIndex(0);
                      }}
                      hasPreviousChapter={activeChapterIndex > 0}
                      onPreviousChapter={() => {
                        setActiveChapterIndex((prev) => Math.max(0, prev - 1));
                        setActiveSlideIndex(0);
                      }}
                    />
                  )}

                  {activeTab === 'reading' && (
                    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                      {/* Chapter Reader Header Banner */}
                      <div
                        style={{
                          marginBottom: '1.25rem',
                          padding: '1.25rem',
                          borderRadius: '0.75rem',
                          background: 'linear-gradient(135deg, rgba(20, 30, 55, 0.9) 0%, rgba(12, 18, 35, 0.9) 100%)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.15rem 0.55rem',
                              borderRadius: '9999px',
                              background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                              color: '#ffffff',
                            }}
                          >
                            BOOK {activeChapter.chapterNumber} OF {(activeCourse.chapters || []).length}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={handleSpeakChapterContent}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '0.4rem',
                                background: isSpeaking ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                border: isSpeaking ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                                color: isSpeaking ? '#ef4444' : '#e2e8f0',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                              title={isSpeaking ? 'Stop voice recitation' : 'Listen aloud with neural TTS voice'}
                            >
                              {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                              <span>{isSpeaking ? 'Stop Voice' : 'Listen'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleCopyChapterContent}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '0.4rem',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: copiedTextbook ? '#34d399' : '#e2e8f0',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                              }}
                            >
                              {copiedTextbook ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedTextbook ? 'Copied' : 'Copy Text'}</span>
                            </button>
                          </div>
                        </div>

                        <div>
                          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                            Book {activeChapter.chapterNumber}: {activeChapter.title}
                          </h2>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            <span>Target Audience: <strong style={{ color: '#38bdf8' }}>{activeCourse.studiedBy || activeCourse.targetAudience || 'General Student'}</strong></span>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <Clock size={11} />
                              <span>Estimated Study: 15-20 mins</span>
                            </span>
                          </div>
                        </div>

                        {/* Fast Jump Pathway Links (Strictly Filtered by Package) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.45rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          {isSlideAiMode ? (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('slides');
                                stopAllSpeech();
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '0.4rem',
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <Presentation size={11} />
                              <span>Open Slide + AI Masterclass</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('video');
                                stopAllSpeech();
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.25rem 0.65rem',
                                borderRadius: '0.4rem',
                                background: 'rgba(236, 72, 153, 0.15)',
                                border: '1px solid rgba(236, 72, 153, 0.35)',
                                color: '#f472b6',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              <Play size={10} fill="#f472b6" />
                              <span>Watch In-Video AI Masterclass</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Markdown Reader Body */}
                      <div style={{ background: 'rgba(12, 17, 30, 0.6)', padding: '1.5rem', borderRadius: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <MarkdownRenderer content={activeChapter.content} />
                      </div>

                      {/* Bottom Previous / Next Chapter Navigation Footer */}
                      <div
                        style={{
                          marginTop: '1.5rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '1rem',
                        }}
                      >
                        <button
                          type="button"
                          disabled={activeChapterIndex === 0}
                          onClick={() => {
                            setActiveChapterIndex((prev) => Math.max(0, prev - 1));
                            setActiveSlideIndex(0);
                            stopAllSpeech();
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 0.95rem',
                            borderRadius: '0.5rem',
                            background: activeChapterIndex === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: activeChapterIndex === 0 ? 'var(--text-subtle)' : '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: activeChapterIndex === 0 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <ChevronLeft size={14} />
                          <span>Previous Book Chapter</span>
                        </button>

                        <button
                          type="button"
                          disabled={activeChapterIndex >= (activeCourse.chapters || []).length - 1}
                          onClick={() => {
                            setActiveChapterIndex((prev) => Math.min((activeCourse.chapters || []).length - 1, prev + 1));
                            setActiveSlideIndex(0);
                            stopAllSpeech();
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.45rem 1rem',
                            borderRadius: '0.5rem',
                            background: activeChapterIndex >= (activeCourse.chapters || []).length - 1
                              ? 'rgba(255, 255, 255, 0.03)'
                              : 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                            border: 'none',
                            color: activeChapterIndex >= (activeCourse.chapters || []).length - 1 ? 'var(--text-subtle)' : '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: activeChapterIndex >= (activeCourse.chapters || []).length - 1 ? 'not-allowed' : 'pointer',
                            boxShadow: activeChapterIndex < (activeCourse.chapters || []).length - 1 ? '0 0 12px rgba(56, 189, 248, 0.35)' : 'none',
                          }}
                        >
                          <span>Next Book Chapter</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'video' && (
                    <MasterclassVideoPlayer
                      courseTitle={activeCourse.title}
                      chapterTitle={activeChapter.title}
                      chapterNumber={activeChapter.chapterNumber}
                      chapterContent={activeChapter.content}
                      initialTopicNumber={activeVideoTopicNumber}
                      isStudentMode={true}
                      enableCheckpointExam={true}
                      activeLanguage={studentLanguage}
                      activeVoiceProfile={studentVoiceProfile}
                      hasNextChapter={activeChapterIndex < (activeCourse.chapters || []).length - 1}
                      onNextChapter={() =>
                        setActiveChapterIndex((prev) =>
                          Math.min((activeCourse.chapters || []).length - 1, prev + 1)
                        )
                      }
                      hasPreviousChapter={activeChapterIndex > 0}
                      onPreviousChapter={() =>
                        setActiveChapterIndex((prev) => Math.max(0, prev - 1))
                      }
                    />
                  )}

                  {activeTab === 'exams' && (
                    <ExamsBoard
                      courseTitle={activeCourse.title}
                      chapter={activeChapter}
                      chapterNumber={activeChapter.chapterNumber}
                      allChapters={activeCourse.chapters}
                    />
                  )}

                  {activeTab === 'dictionary' && (
                    <CourseDictionary
                      courseTitle={activeCourse.title}
                      chapter={activeChapter}
                      chapterNumber={activeChapter.chapterNumber}
                      allChapters={activeCourse.chapters}
                      activeLanguage={studentLanguage}
                    />
                  )}
                </div>
              </>
            ) : (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-subtle)' }}>
                <BookOpen size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
                <p>Select an enrolled course from the catalog to begin learning.</p>
                <button
                  type="button"
                  onClick={() => setStudentViewMode('catalog')}
                  style={{
                    padding: '0.4rem 1rem',
                    borderRadius: '9999px',
                    background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginTop: '0.5rem',
                  }}
                >
                  Browse Course Catalog
                </button>
              </div>
            )}
          </main>
        </div>
      )}

      {/* In-Session AI Doubt Dialog for Students */}
      {showStudentDoubtModal && activeChapter && activeCourse && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setShowStudentDoubtModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '620px',
              background: 'linear-gradient(145deg, #0d1222 0%, #171d33 100%)',
              border: '1.5px solid rgba(168, 85, 247, 0.45)',
              borderRadius: '1.25rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(168, 85, 247, 0.3)',
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
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '0.65rem',
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    In-Session Tutor Bot • Doubt Clearing
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                    Grounded in Book {activeChapter.chapterNumber}: {activeChapter.title}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowStudentDoubtModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.5rem',
                  padding: '0.35rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={studentDoubtQuery}
                  onChange={(e) => setStudentDoubtQuery(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && studentDoubtQuery.trim() && !isAskingStudentDoubt) {
                      setIsAskingStudentDoubt(true);
                      try {
                        const ans = await askIntelliCoach(studentDoubtQuery, {
                          courseTitle: activeCourse.title,
                          chapterTitle: activeChapter.title,
                          chapterNumber: activeChapter.chapterNumber,
                          chapterContent: activeChapter.content,
                          targetLanguage: studentLanguage,
                          targetAudience: activeCourse.studiedBy || activeCourse.targetAudience || 'General Student',
                        });
                        setStudentDoubtAnswer(ans);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsAskingStudentDoubt(false);
                      }
                    }
                  }}
                  placeholder={`Ask Tutor Bot anything about this chapter...`}
                  disabled={isAskingStudentDoubt}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    borderRadius: '0.65rem',
                    padding: '0.65rem 0.9rem',
                    color: '#ffffff',
                    fontSize: '0.84rem',
                    outline: 'none',
                  }}
                />

                <button
                  type="button"
                  onClick={async () => {
                    if (!studentDoubtQuery.trim() || isAskingStudentDoubt) return;
                    setIsAskingStudentDoubt(true);
                    try {
                      const ans = await askIntelliCoach(studentDoubtQuery, {
                        courseTitle: activeCourse.title,
                        chapterTitle: activeChapter.title,
                        chapterNumber: activeChapter.chapterNumber,
                        chapterContent: activeChapter.content,
                        targetLanguage: studentLanguage,
                        targetAudience: activeCourse.studiedBy || activeCourse.targetAudience || 'General Student',
                      });
                      setStudentDoubtAnswer(ans);
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsAskingStudentDoubt(false);
                    }
                  }}
                  disabled={!studentDoubtQuery.trim() || isAskingStudentDoubt}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.65rem 1.1rem',
                    borderRadius: '0.65rem',
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: !studentDoubtQuery.trim() || isAskingStudentDoubt ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isAskingStudentDoubt ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />}
                  <span>Ask</span>
                </button>
              </div>

              {studentDoubtAnswer && (
                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: '0.75rem',
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <Sparkles size={13} color="#c084fc" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase' }}>
                      Tutor Bot Explanation
                    </span>
                  </div>
                  <MarkdownRenderer content={studentDoubtAnswer} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
