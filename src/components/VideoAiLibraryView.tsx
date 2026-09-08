import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Tv,
  Award,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Filter,
  Grid,
  PanelLeft,
  Play,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Loader2,
  Sparkles,
  Send,
  X,
} from 'lucide-react';
import {
  LibraryCourse,
  getAllLibraryCourses,
  getAllCategories,
  LEARNER_CATEGORIES,
  CourseChapter,
  type CourseCategory,
} from '../services/dbService';
import MasterclassVideoPlayer from './MasterclassVideoPlayer';
import ExamsBoard from './ExamsBoard';
import CourseDictionary from './CourseDictionary';
import MarkdownRenderer from './MarkdownRenderer';
import LanguageVoiceSelector from './LanguageVoiceSelector';
import { useVoice } from '../hooks/useVoice';
import { cleanMarkdownForSpeech, getScopedVoiceProfilesForLanguage } from '../services/speechService';
import { translateCourseContent, askIntelliCoach } from '../services/geminiService';

interface SubTopicItem {
  id: string;
  topicNumber: string;
  title: string;
}

interface VideoAiLibraryViewProps {
  onOpenCreator?: () => void;
}

export default function VideoAiLibraryView({ onOpenCreator }: VideoAiLibraryViewProps = {}) {
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [activeCourse, setActiveCourse] = useState<LibraryCourse | null>(null);
  
  // View Mode: 'catalog' (Grid View) vs 'reader' (Chapter Tree & Masterclass Video Player)
  const [studentViewMode, setStudentViewMode] = useState<'catalog' | 'reader'>('catalog');
  
  // Active Tab in Reader: 'video' | 'reading' | 'exams' | 'dictionary'
  const [activeTab, setActiveTab] = useState<'video' | 'reading' | 'exams' | 'dictionary'>('video');
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [activeVideoTopicNumber, setActiveVideoTopicNumber] = useState<string | undefined>(undefined);

  // Left Chapter Navigation Tree State
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
  const [translationsCache, setTranslationsCache] = useState<Record<string, string>>({});

  // Reading Actions State
  const [copiedTextbook, setCopiedTextbook] = useState<boolean>(false);

  // In-Session Doubt Clearing State
  const [showStudentDoubtModal, setShowStudentDoubtModal] = useState<boolean>(false);
  const [studentDoubtQuery, setStudentDoubtQuery] = useState<string>('');
  const [isAskingStudentDoubt, setIsAskingStudentDoubt] = useState<boolean>(false);
  const [studentDoubtAnswer, setStudentDoubtAnswer] = useState<string | null>(null);

  const { isSpeaking, speak, stopAllSpeech } = useVoice();

  // Load library courses & categories
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const [fetchedCourses, fetchedCategories] = await Promise.all([
          getAllLibraryCourses(),
          getAllCategories(),
        ]);
        setCourses(fetchedCourses);
        setCategories(fetchedCategories);
        if (fetchedCourses.length > 0) {
          setActiveCourse((prev) => prev ? fetchedCourses.find((c) => c.id === prev.id) || fetchedCourses[0] : fetchedCourses[0]);
        }
      } catch (err) {
        console.error('Failed to load Video + AI courses:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();

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
        console.error('Failed to sync Video + AI library:', err);
      }
    };

    const handleCategoriesUpdated = async () => {
      try {
        const fetchedCats = await getAllCategories();
        setCategories(fetchedCats);
      } catch (err) {
        console.error('Failed to sync categories in Video + AI:', err);
      }
    };

    window.addEventListener('ila_library_courses_updated', handleCoursesUpdated);
    window.addEventListener('ila_categories_updated', handleCategoriesUpdated);
    return () => {
      window.removeEventListener('ila_library_courses_updated', handleCoursesUpdated);
      window.removeEventListener('ila_categories_updated', handleCategoriesUpdated);
    };
  }, []);

  // Filter courses by search and department/category
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.subtitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.overview || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept =
        selectedDepartment === 'all' ||
        c.category === selectedDepartment ||
        c.studiedBy === selectedDepartment ||
        c.targetAudience === selectedDepartment ||
        c.tags?.includes(selectedDepartment) ||
        (c.category && c.category.toLowerCase().includes(selectedDepartment.toLowerCase()));
      return matchSearch && matchDept;
    });
  }, [courses, searchQuery, selectedDepartment]);

  const rawActiveChapter = activeCourse?.chapters?.[activeChapterIndex] || activeCourse?.chapters?.[0];

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

  const handleTranslateActiveContent = useCallback(
    async (targetLangCode?: string) => {
      const langToTranslate = targetLangCode || studentLanguage;
      if (!rawActiveChapter || !activeCourse) return;
      if (langToTranslate === 'en-US' || langToTranslate === 'en') {
        return;
      }
      const cacheKey = `${activeCourse.id}_${rawActiveChapter.id}_${langToTranslate}`;
      if (translationsCache[cacheKey]) {
        return;
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
        console.error('Real-time translation error in Video + AI portal:', err);
      } finally {
        setIsTranslating(false);
        setTranslationBannerText('');
      }
    },
    [activeCourse, rawActiveChapter, studentLanguage, translationsCache]
  );

  const handleLanguageChange = (langCode: string) => {
    setStudentLanguage(langCode);
    localStorage.setItem('ila_active_language', langCode);

    const scopedVoices = getScopedVoiceProfilesForLanguage(langCode);
    if (scopedVoices.length > 0) {
      const bestVoice = scopedVoices[0].id;
      setStudentVoiceProfile(bestVoice);
      localStorage.setItem('ila_active_voice_profile', bestVoice);
    }

    handleTranslateActiveContent(langCode);
  };

  const getSubtopicsForChapter = (ch: CourseChapter, chIndex: number): SubTopicItem[] => {
    if (ch.subTopics && ch.subTopics.length > 0) {
      return ch.subTopics.map((st, sIdx) => ({
        id: st.id || `sub_${chIndex}_${sIdx}`,
        topicNumber: st.topicNumber || `${ch.chapterNumber}.${sIdx + 1}`,
        title: st.title,
      }));
    }

    const lines = (ch.content || '').split('\n');
    const items: SubTopicItem[] = [];
    let count = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ') || line.startsWith('### ')) {
        const clean = line.replace(/^#+\s*/, '').trim();
        if (clean && clean.length > 2) {
          items.push({
            id: `sub_${chIndex}_${count}`,
            topicNumber: `${ch.chapterNumber}.${count}`,
            title: clean,
          });
          count++;
        }
      }
    }

    if (items.length === 0) {
      return [
        {
          id: `sub_${chIndex}_1`,
          topicNumber: `${ch.chapterNumber}.1`,
          title: `${ch.title} Foundations`,
        },
      ];
    }

    return items;
  };

  const handleOpenCourseInReader = (course: LibraryCourse, tab: 'video' | 'reading' = 'video', chapterIdx = 0, topicNum?: string) => {
    setActiveCourse(course);
    setActiveChapterIndex(chapterIdx);
    setActiveVideoTopicNumber(topicNum);
    setActiveTab(tab);
    setStudentViewMode('reader');
    stopAllSpeech();

    const exp: Record<string, boolean> = {};
    (course.chapters || []).forEach((ch) => {
      exp[ch.id] = true;
    });
    setExpandedChapterIds(exp);
  };

  const toggleChapterExpand = (chapterId: string) => {
    setExpandedChapterIds((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const handleSpeakTextbook = () => {
    if (isSpeaking) {
      stopAllSpeech();
      return;
    }
    if (!activeChapter) return;
    const cleanText = cleanMarkdownForSpeech(activeChapter.content);
    speak(cleanText, 'textbook', {
      voiceProfileId: studentVoiceProfile,
      lang: studentLanguage,
    });
  };

  const handleCopyTextbook = async () => {
    if (!activeChapter) return;
    try {
      await navigator.clipboard.writeText(activeChapter.content);
      setCopiedTextbook(true);
      setTimeout(() => setCopiedTextbook(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div
      id="video-ai-library-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--bg-primary, #090d16)',
        color: '#f8fafc',
        overflow: 'hidden',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 1. Header Bar */}
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
              background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(236, 72, 153, 0.4)',
              flexShrink: 0,
            }}
          >
            <Tv size={19} color="#ffffff" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <h1 style={{ fontSize: '1.02rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Video + AI Masterclass Library
              </h1>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.12rem 0.55rem',
                  borderRadius: '9999px',
                  background: 'rgba(236, 72, 153, 0.2)',
                  border: '1px solid rgba(236, 72, 153, 0.45)',
                  color: '#f472b6',
                  flexShrink: 0,
                }}
              >
                ENTERPRISE VIDEO PLAYER & 1.1/1.2 CUES
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Studio video masterclasses with structured 1.1 / 1.2 chapter navigation, timeline scrubbing, speed control, and video checkpoints.
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.45rem',
              padding: '0.15rem',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setStudentViewMode('catalog');
                stopAllSpeech();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.28rem 0.65rem',
                borderRadius: '0.35rem',
                background: studentViewMode === 'catalog' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                border: studentViewMode === 'catalog' ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid transparent',
                color: studentViewMode === 'catalog' ? '#f472b6' : 'var(--text-muted)',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Grid size={13} />
              <span>Catalog</span>
            </button>

            <button
              type="button"
              disabled={!activeCourse}
              onClick={() => {
                if (activeCourse) setStudentViewMode('reader');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.28rem 0.65rem',
                borderRadius: '0.35rem',
                background: studentViewMode === 'reader' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                border: studentViewMode === 'reader' ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid transparent',
                color: studentViewMode === 'reader' ? '#f472b6' : !activeCourse ? 'var(--text-subtle)' : 'var(--text-muted)',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: !activeCourse ? 'not-allowed' : 'pointer',
              }}
            >
              <Tv size={13} />
              <span>Video Player</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(255, 255, 255, 0.05)', padding: '0.28rem 0.55rem', borderRadius: '0.45rem', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <Filter size={12} color="var(--text-muted)" />
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ background: '#0d1222' }}>All Departments & Categories</option>
              {categories.length > 0 && categories.map((cat) => (
                <option key={cat.id} value={cat.name} style={{ background: '#0d1222' }}>
                  {cat.name}
                </option>
              ))}
              {LEARNER_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.name} style={{ background: '#0d1222' }}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={12} color="var(--text-muted)" style={{ position: 'absolute', left: '0.55rem' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search video courses..."
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.45rem',
                padding: '0.28rem 0.6rem 0.28rem 1.65rem',
                color: '#ffffff',
                fontSize: '0.74rem',
                outline: 'none',
                width: '130px',
              }}
            />
          </div>

          <LanguageVoiceSelector
            currentLanguage={studentLanguage}
            currentVoiceProfile={studentVoiceProfile}
            onLanguageChange={handleLanguageChange}
            onVoiceProfileChange={(voiceId) => {
              setStudentVoiceProfile(voiceId);
              localStorage.setItem('ila_active_voice_profile', voiceId);
            }}
          />
        </div>
      </header>

      {/* Real-Time Translation Notification */}
      {isTranslating && (
        <div
          style={{
            background: 'linear-gradient(90deg, #831843 0%, #db2777 50%, #831843 100%)',
            color: '#ffffff',
            padding: '0.35rem 1.5rem',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: '0 2px 10px rgba(219, 39, 119, 0.4)',
            flexShrink: 0,
          }}
        >
          <Loader2 size={13} className="animate-spin" />
          <span>{translationBannerText || 'Translating active video masterclass in real-time...'}</span>
        </div>
      )}

      {/* Main Content Area */}
      {studentViewMode === 'catalog' ? (
        /* Video Course Catalog (Grid View) */
        <div
          id="video-ai-course-catalog-grid"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem 2rem',
            background: 'radial-gradient(circle at 50% 20%, rgba(30, 20, 40, 0.6) 0%, rgba(9, 13, 22, 1) 100%)',
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Enrolled Video Masterclasses ({filteredCourses.length} Courses)
                </h2>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Select any course card to launch the comprehensive chapter navigation tree and enterprise video masterclass player.
                </p>
              </div>
            </div>

            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading video library...
              </div>
            ) : filteredCourses.length === 0 ? (
              <div
                style={{
                  padding: '3.5rem 2rem',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.5) 100%)',
                  borderRadius: '1.25rem',
                  border: '1px dashed rgba(236, 72, 153, 0.35)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1rem',
                  boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.5)',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '1rem',
                    background: 'rgba(236, 72, 153, 0.15)',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ec4899',
                  }}
                >
                  <Tv size={28} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.35rem' }}>
                    {courses.length === 0 ? 'Video Masterclass Library is Ready' : 'No matching video courses found'}
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)', maxWidth: '460px', lineHeight: 1.5, margin: '0 auto' }}>
                    {courses.length === 0
                      ? 'No trial courses remain. Author a new course curriculum in the Course Creator workspace to automatically compile structured studio video teleprompters & lesson modules.'
                      : 'Try clearing your search query or selecting "All Departments & Categories".'}
                  </p>
                </div>
                {courses.length === 0 && onOpenCreator && (
                  <button
                    type="button"
                    onClick={onOpenCreator}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.65rem 1.3rem',
                      borderRadius: '0.7rem',
                      background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.84rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 4px 18px rgba(236, 72, 153, 0.4)',
                    }}
                  >
                    <Sparkles size={15} />
                    <span>[+ Add New Course]</span>
                  </button>
                )}
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
                      onClick={() => handleOpenCourseInReader(c, 'video', 0)}
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
                        e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.45)';
                        e.currentTarget.style.boxShadow = '0 12px 30px rgba(236, 72, 153, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.4)';
                      }}
                    >
                      {/* Card Header */}
                      <div
                        style={{
                          padding: '1.1rem 1.25rem 0.85rem 1.25rem',
                          background: 'linear-gradient(135deg, rgba(40, 25, 50, 0.8) 0%, rgba(15, 23, 42, 0.9) 100%)',
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
                              background: 'rgba(236, 72, 153, 0.15)',
                              border: '1px solid rgba(236, 72, 153, 0.35)',
                              color: '#f472b6',
                            }}
                          >
                            {c.studiedBy || c.targetAudience || 'General Audience'}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#f472b6', fontWeight: 600 }}>
                            {totalChapters} Video Modules
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

                      {/* Card Body */}
                      <div style={{ padding: '0.85rem 1.25rem', flex: 1 }}>
                        <p style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: '1.45', margin: '0 0 0.85rem 0' }}>
                          {c.overview ? (c.overview.length > 140 ? c.overview.substring(0, 140) + '...' : c.overview) : 'Studio video masterclasses with structured 1.1 / 1.2 chapter navigation and interactive video checkpoints.'}
                        </p>

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
                              <span style={{ color: '#f472b6', fontWeight: 700 }}>▸</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Book {ch.chapterNumber}: {ch.title}
                              </span>
                            </div>
                          ))}
                          {(c.chapters || []).length > 3 && (
                            <div style={{ fontSize: '0.68rem', color: '#f472b6', fontStyle: 'italic', marginTop: '2px' }}>
                              + {c.chapters.length - 3} more video modules
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
                          <span>Launch Video Masterclass</span>
                        </button>

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
        /* Chapter-by-Chapter Video Masterclass & Textbook View */
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
          {/* Left Chapter Navigation Tree */}
          {isChapterTreeOpen && activeCourse && (
            <aside
              id="video-ai-chapter-navigation-tree"
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
              {/* Sidebar Header */}
              <div
                style={{
                  padding: '0.85rem 1rem 0.65rem 1rem',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                  <Tv size={14} color="#f472b6" />
                  <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Video Navigation Tree
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChapterTreeOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                  }}
                  title="Collapse Tree"
                >
                  <PanelLeft size={14} />
                </button>
              </div>

              {/* Course Title Badge */}
              <div style={{ padding: '0.65rem 1rem', background: 'rgba(236, 72, 153, 0.08)', borderBottom: '1px solid rgba(236, 72, 153, 0.15)' }}>
                <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#f472b6', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                  ACTIVE VIDEO MASTERCLASS
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff', lineHeight: '1.25' }}>
                  {activeCourse.title}
                </div>
              </div>

              {/* Search Filter */}
              <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <input
                  type="text"
                  value={chapterSearchTerm}
                  onChange={(e) => setChapterSearchTerm(e.target.value)}
                  placeholder="Filter chapters..."
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '0.35rem',
                    padding: '0.25rem 0.5rem',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Chapters List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {(activeCourse.chapters || [])
                  .filter((ch) =>
                    !chapterSearchTerm ||
                    ch.title.toLowerCase().includes(chapterSearchTerm.toLowerCase()) ||
                    String(ch.chapterNumber).includes(chapterSearchTerm)
                  )
                  .map((ch, idx) => {
                    const isSelected = activeChapterIndex === idx;
                    const isExpanded = expandedChapterIds[ch.id] ?? true;
                    const subtopics = getSubtopicsForChapter(ch, idx);

                    return (
                      <div
                        key={ch.id}
                        style={{
                          borderRadius: '0.5rem',
                          background: isSelected ? 'rgba(236, 72, 153, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                          border: isSelected ? '1px solid rgba(236, 72, 153, 0.4)' : '1px solid rgba(255, 255, 255, 0.04)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            padding: '0.55rem 0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.4rem',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setActiveChapterIndex(idx);
                            setActiveVideoTopicNumber(undefined);
                            stopAllSpeech();
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                fontSize: '0.64rem',
                                fontWeight: 800,
                                color: isSelected ? '#f472b6' : 'var(--text-subtle)',
                                background: isSelected ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                flexShrink: 0,
                              }}
                            >
                              Book {ch.chapterNumber}
                            </span>
                            <span style={{ fontSize: '0.76rem', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#ffffff' : '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ch.title}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleChapterExpand(ch.id);
                            }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.1rem' }}
                          >
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        </div>

                        {/* 1.1, 1.2 Topic Cues */}
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
                            {subtopics.map((st) => (
                              <div
                                key={st.id}
                                style={{
                                  fontSize: '0.72rem',
                                  color: isSelected && activeVideoTopicNumber === st.topicNumber ? '#f472b6' : 'var(--text-muted)',
                                  padding: '0.25rem 0.45rem',
                                  borderRadius: '0.35rem',
                                  background: isSelected && activeVideoTopicNumber === st.topicNumber ? 'rgba(236, 72, 153, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                  border: isSelected && activeVideoTopicNumber === st.topicNumber ? '1px solid rgba(236, 72, 153, 0.35)' : '1px solid transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.35rem',
                                }}
                              >
                                <div
                                  onClick={() => {
                                    setActiveChapterIndex(idx);
                                    setActiveVideoTopicNumber(st.topicNumber);
                                    setActiveTab('video');
                                    stopAllSpeech();
                                  }}
                                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, cursor: 'pointer' }}
                                  title={`Play Video Topic ${st.topicNumber}: ${st.title}`}
                                >
                                  <strong style={{ color: isSelected && activeVideoTopicNumber === st.topicNumber ? '#f472b6' : '#a5b4fc', marginRight: '0.3rem' }}>
                                    {st.topicNumber}
                                  </strong>
                                  <span>{st.title}</span>
                                </div>

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
                                  <span>Text</span>
                                </button>
                              </div>
                            ))}

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

          {/* Right Main Stage */}
          <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            {activeChapter && activeCourse ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Secondary Tab Bar */}
                <div
                  style={{
                    padding: '0.45rem 1.25rem',
                    background: 'rgba(10, 15, 26, 0.95)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        title="Expand Chapter Tree"
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
                      <span style={{ color: '#f472b6', fontWeight: 700 }}>
                        Book {activeChapter.chapterNumber}: {activeChapter.title}
                      </span>
                    </div>
                  </div>

                  {/* Tab Navigation Strip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {[
                      { id: 'video', label: '1. Video Masterclass', icon: Tv, color: '#f43f5e' },
                      { id: 'reading', label: '2. Course Textbook', icon: BookOpen, color: '#a5b4fc' },
                      { id: 'exams', label: '3. Exam Board', icon: Award, color: '#fbbf24' },
                      { id: 'dictionary', label: '4. Glossary', icon: HelpCircle, color: '#2dd4bf' },
                    ].map((tab) => {
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
                            background: isActive ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
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

                    <button
                      id="video-student-doubt-btn"
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
                      title="Ask Tutor Bot a doubt on Video Masterclass"
                    >
                      <Sparkles size={12} color="#f472b6" />
                      <span>Ask AI Doubt</span>
                    </button>
                  </div>
                </div>

                {/* Workspace Body */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
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

                  {activeTab === 'reading' && (
                    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
                      <div
                        style={{
                          marginBottom: '1.5rem',
                          padding: '1.25rem',
                          background: 'linear-gradient(135deg, rgba(40, 25, 50, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f472b6', textTransform: 'uppercase' }}>
                            Course Textbook • Book {activeChapter.chapterNumber}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <button
                              type="button"
                              onClick={handleSpeakTextbook}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '0.4rem',
                                background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(236, 72, 153, 0.15)',
                                border: isSpeaking ? '1px solid #ef4444' : '1px solid rgba(236, 72, 153, 0.4)',
                                color: isSpeaking ? '#f87171' : '#f472b6',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                              <span>{isSpeaking ? 'Stop Reading' : 'Listen with TTS'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleCopyTextbook}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '0.4rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: copiedTextbook ? '#34d399' : '#cbd5e1',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {copiedTextbook ? <Check size={12} /> : <Copy size={12} />}
                              <span>{copiedTextbook ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                        </div>

                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                          {activeChapter.title}
                        </h2>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.45rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
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
                            <span>Watch In-Video Masterclass</span>
                          </button>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(12, 17, 30, 0.6)', padding: '1.5rem', borderRadius: '0.85rem', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <MarkdownRenderer content={activeChapter.content} />
                      </div>

                      {/* Footer Navigation */}
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
                            setActiveVideoTopicNumber(undefined);
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
                          <span>Previous Video Chapter</span>
                        </button>

                        <button
                          type="button"
                          disabled={activeChapterIndex >= (activeCourse.chapters || []).length - 1}
                          onClick={() => {
                            setActiveChapterIndex((prev) => Math.min((activeCourse.chapters || []).length - 1, prev + 1));
                            setActiveVideoTopicNumber(undefined);
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
                              : 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                            border: 'none',
                            color: activeChapterIndex >= (activeCourse.chapters || []).length - 1 ? 'var(--text-subtle)' : '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: activeChapterIndex >= (activeCourse.chapters || []).length - 1 ? 'not-allowed' : 'pointer',
                            boxShadow: activeChapterIndex < (activeCourse.chapters || []).length - 1 ? '0 0 12px rgba(236, 72, 153, 0.35)' : 'none',
                          }}
                        >
                          <span>Next Video Chapter</span>
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
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
              </div>
            ) : (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Please select a video masterclass course.
              </div>
            )}
          </main>
        </div>
      )}

      {/* In-Session AI Doubt Dialog */}
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
              border: '1.5px solid rgba(236, 72, 153, 0.45)',
              borderRadius: '1.25rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(236, 72, 153, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                    background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
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
                    Video Masterclass Tutor • Doubt Clearing
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
                  placeholder={`Ask AI anything about this video masterclass...`}
                  disabled={isAskingStudentDoubt}
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(236, 72, 153, 0.4)',
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
                    background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
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
                    background: 'rgba(236, 72, 153, 0.1)',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <Sparkles size={13} color="#f472b6" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f472b6', textTransform: 'uppercase' }}>
                      AI Tutor Explanation
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
