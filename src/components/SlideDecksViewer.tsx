import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Volume2,
  Columns,
  BookOpen,
  Copy,
  Check,
  Gauge,
  Presentation,
  MessageSquare,
  Sparkles,
  Send,
  Loader2,
  X,
  ArrowRight,
  ExternalLink,
  Award,
  Wand2,
  Plus,
  ListOrdered,
  Globe,
} from 'lucide-react';
import { speakText, stopSpeaking, setGlobalPlaybackRate, SUPPORTED_LANGUAGES, VOICE_PROFILES } from '../services/speechService';
import { detectStandardCurriculum } from '../services/curriculumStandardService';
import { askIntelliCoach } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';

export interface MilestoneQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicTitle: string;
  suggestedReviewSlideIndex: number;
  suggestedReviewSlideTitle: string;
}

export interface SlideItem {
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
  isCheckpoint?: boolean;
  isFinalCheckpoint?: boolean;
  checkpointQuiz?: {
    milestoneTitle: string;
    coveredTopics?: string[];
    questions: MilestoneQuizQuestion[];
  };
  codeSnippet?: {
    language: string;
    code: string;
  };
  tableData?: {
    headers: string[];
    rows: string[][];
  };
}

export interface ExplanationSegment {
  type: 'intro' | 'bullet' | 'takeaway';
  bulletIndex?: number;
  text: string;
  anchorText: string;
}

interface SlideDecksViewerProps {
  courseTitle: string;
  chapterTitle: string;
  chapterNumber?: number;
  chapterContent: string;
  activeLanguage?: string;
  onLanguageChange?: (langCode: string) => void;
  activeVoiceProfile?: string;
  onVoiceProfileChange?: (voiceId: string) => void;
  onTranslateContent?: (targetLang?: string) => void;
  isTranslating?: boolean;
  onOpenFullScreen?: () => void;
  activeSlideIndex?: number;
  onSlideChange?: (index: number) => void;
  onNextChapter?: () => void;
  hasNextChapter?: boolean;
  onPreviousChapter?: () => void;
  hasPreviousChapter?: boolean;
  targetAudience?: string;
  isStudentMode?: boolean;
  onScriptUpdate?: (updatedContent: string) => void;
  onJumpToReadingTab?: (anchor?: string) => void;
}

/**
 * Tutor Bot Explanation Engine: Generates pure, sequential top-to-bottom pedagogical segments
 */
function generateExplanationSegments(
  slide: SlideItem,
  _audience: string = 'General Student',
  _chapterNum: number = 1
): ExplanationSegment[] {
  const segments: ExplanationSegment[] = [];
  const cleanTitle = slide.title.replace(/[*_`]/g, '').trim();

  // 1. Topic Intro Segment (Direct top-to-bottom topic overview)
  let introText = cleanTitle;
  if (slide.subtitle && slide.subtitle.trim()) {
    introText += `. ${slide.subtitle.trim()}`;
  }
  segments.push({
    type: 'intro',
    text: introText,
    anchorText: slide.sourceHeadingAnchor || slide.title,
  });

  // 2. Sequential Bullet Points (Top-to-bottom point-by-point teaching walkthrough)
  slide.bullets.forEach((bullet, idx) => {
    const cleanBullet = bullet.replace(/[*_`]/g, '').trim();
    if (!cleanBullet) return;
    segments.push({
      type: 'bullet',
      bulletIndex: idx,
      text: cleanBullet,
      anchorText: cleanBullet,
    });
  });

  // 3. Key Takeaway & Core Concept Summary
  const cleanTakeaway = (slide.keyTakeaway || '').replace(/[*_`]/g, '').trim();
  const cleanNotes = (slide.speakerNotes || '').replace(/[*_`]/g, '').trim();
  const summaryContent = cleanTakeaway || (cleanNotes.length > 15 ? cleanNotes : '');

  if (summaryContent) {
    segments.push({
      type: 'takeaway',
      text: summaryContent,
      anchorText: slide.keyTakeaway || slide.title,
    });
  }

  return segments;
}

function buildMilestoneQuestions(
  coveredTopicList: { title: string; slideIndex: number }[],
  _isFinal: boolean,
  chapterTitle: string,
  chapterNumber: number
): MilestoneQuizQuestion[] {
  const questions: MilestoneQuizQuestion[] = [];

  // Generate 1 targeted question for each covered topic
  coveredTopicList.forEach((topic, idx) => {
    questions.push({
      id: `mq_${idx}_${Date.now()}`,
      question: `Topic Question ${idx + 1} (${topic.title}): What is the primary operational requirement?`,
      options: [
        `Standardizing systematic execution and verified governance controls`,
        `Bypassing architectural protocols to accelerate arbitrary deployment`,
        `Eliminating automated documentation and quality controls`,
        `Restricting scalability across production workflows`,
      ],
      correctIndex: 0,
      explanation: `In standard curriculum frameworks, "${topic.title}" guarantees dependable, auditable, and repeatable execution across real-world workflows.`,
      topicTitle: topic.title,
      suggestedReviewSlideIndex: topic.slideIndex,
      suggestedReviewSlideTitle: topic.title,
    });
  });

  // Synthesis question
  questions.push({
    id: `mq_synthesis_${Date.now()}`,
    question: `Synthesis Check: How do these preceding concepts interlock within the broader architecture of Book ${chapterNumber}?`,
    options: [
      `They function as interdependent layers that ensure end-to-end data integrity and performance`,
      `They operate as isolated, incompatible silos with no cross-module communication`,
      `They eliminate the need for systematic testing and runtime monitoring`,
      `They restrict modular adaptability in multi-tier environments`,
    ],
    correctIndex: 0,
    explanation: `Real-world systems require seamless interlocking of each modular component to maintain high-availability standards.`,
    topicTitle: `${chapterTitle} Architecture`,
    suggestedReviewSlideIndex: coveredTopicList[0]?.slideIndex ?? 0,
    suggestedReviewSlideTitle: coveredTopicList[0]?.title ?? `${chapterTitle} Foundation`,
  });

  // Ensure minimum 5 questions (5-6 questions per milestone)
  while (questions.length < 5) {
    const qIdx = questions.length + 1;
    questions.push({
      id: `mq_extra_${qIdx}`,
      question: `Governance & Verification: What validation step is essential before promoting changes in this domain?`,
      options: [
        `Executing comprehensive verification suites and compliance audits`,
        `Deploying untested configuration scripts directly to live environments`,
        `Disabling error logging to reduce resource utilization`,
        `Skipping regression benchmarks during runtime deployment`,
      ],
      correctIndex: 0,
      explanation: `Rigorous compliance audits and automated test validation guarantee enterprise system stability.`,
      topicTitle: `Enterprise Governance`,
      suggestedReviewSlideIndex: coveredTopicList[0]?.slideIndex ?? 0,
      suggestedReviewSlideTitle: coveredTopicList[0]?.title ?? `${chapterTitle} Foundation`,
    });
  }

  return questions.slice(0, 6);
}

export default function SlideDecksViewer({
  courseTitle,
  chapterTitle,
  chapterNumber = 1,
  chapterContent,
  activeLanguage = 'en-US',
  onLanguageChange,
  activeVoiceProfile = 'coqui-xtts-multilingual',
  onVoiceProfileChange,
  onOpenFullScreen,
  activeSlideIndex,
  onSlideChange,
  onNextChapter,
  hasNextChapter = false,
  targetAudience = 'General Student',
  isStudentMode = false,
  onScriptUpdate,
  onJumpToReadingTab,
}: SlideDecksViewerProps) {
  // Split Screen Mode: 'split' (Slides + Textbook) | 'slides_only' | 'text_only'
  const [layoutMode, setLayoutMode] = useState<'split' | 'slides_only' | 'text_only'>('split');
  const [isInternalFullScreen, setIsInternalFullScreen] = useState<boolean>(false);
  const [speechRate, setSpeechRate] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('ila_playback_speed');
        if (saved) {
          const val = parseFloat(saved);
          if (!isNaN(val) && val >= 0.5 && val <= 2.5) return val;
        }
      } catch {
        // ignore
      }
    }
    return 1.0;
  });
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [isJumpMenuOpen, setIsJumpMenuOpen] = useState<boolean>(false);

  // In-Slide AI Editing States
  const [showEditSlideModal, setShowEditSlideModal] = useState<boolean>(false);
  const [editSlidePrompt, setEditSlidePrompt] = useState<string>('');
  const [isAiEditingSlide, setIsAiEditingSlide] = useState<boolean>(false);
  const [slideEditSuccess, setSlideEditSuccess] = useState<string | null>(null);

  // Add Slide with AI State
  const [showAddSlideModal, setShowAddSlideModal] = useState<boolean>(false);
  const [newSlideTopic, setNewSlideTopic] = useState<string>('');
  const [isAddingSlide, setIsAddingSlide] = useState<boolean>(false);

  // In-Slide Pause & Doubt Clearing State
  const [showDoubtModal, setShowDoubtModal] = useState<boolean>(false);
  const [doubtQuestion, setDoubtQuestion] = useState<string>('');
  const [isAnsweringDoubt, setIsAnsweringDoubt] = useState<boolean>(false);
  const [doubtHistory, setDoubtHistory] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);

  // Exam Board Milestone Multi-Question Quiz State (5-6 questions)
  const [showCheckpointModal, setShowCheckpointModal] = useState<boolean>(false);
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState<number>(0);
  const [selectedQuizOption, setSelectedQuizOption] = useState<number | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<number, boolean>>({});
  const [isMilestoneQuizCompleted, setIsMilestoneQuizCompleted] = useState<boolean>(false);

  // Generate 100% comprehensive structured slide decks with Exam Board Checkpoints
  const slides: SlideItem[] = useMemo(() => {
    const lines = (chapterContent || '').split('\n');
    const standardInfo = detectStandardCurriculum(courseTitle, chapterContent);
    const result: SlideItem[] = [];

    // Title Slide
    result.push({
      id: 'slide_title',
      slideNumber: 1,
      badge: standardInfo.badge || 'Masterclass Foundation',
      badgeColor: standardInfo.badgeColor || '#818cf8',
      title: chapterTitle,
      subtitle: `${courseTitle} • Book ${chapterNumber}`,
      bullets: [
        `Curriculum aligned with ${standardInfo.frameworkName}`,
        `Governing Standard Body: ${standardInfo.bodyName}`,
        `Comprehensive theoretical foundations, technical workflows, and operational architectures`,
        `Includes structured assessments, live quizzes, and reference guides`,
      ],
      keyTakeaway: `Mastery of Book ${chapterNumber} establishes the core competency requirements benchmarked to ${standardInfo.frameworkName}.`,
      speakerNotes: `Welcome everyone to ${chapterTitle}. Today we establish the critical principles, framework standards, and operational models that form the backbone of this domain.`,
      sourceHeadingAnchor: `Book ${chapterNumber}: ${chapterTitle}`,
    });

    let currentSlide: Partial<SlideItem> | null = null;
    let slideCount = 2;
    let inCodeBlock = false;
    let codeLanguage = '';
    let codeBuffer: string[] = [];
    const topicTracker: { title: string; slideIndex: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeLanguage = line.trim().replace(/^```/, '') || 'typescript';
          codeBuffer = [];
        } else {
          inCodeBlock = false;
          if (currentSlide) {
            currentSlide.codeSnippet = {
              language: codeLanguage,
              code: codeBuffer.join('\n'),
            };
          }
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (currentSlide && currentSlide.title && (currentSlide.bullets?.length || 0) > 0) {
          topicTracker.push({ title: currentSlide.title, slideIndex: slideCount - 1 });
          // Milestone checkpoint every 4 topic slides
          const isMilestoneCheck = slideCount > 2 && (slideCount - 1) % 4 === 0;
          const coveredTopicsList = topicTracker.slice(-4);
          
          result.push({
            id: `slide_${slideCount}`,
            slideNumber: slideCount,
            badge: isMilestoneCheck ? `Milestone Checkpoint` : `Module ${chapterNumber}.${slideCount - 1}`,
            badgeColor: isMilestoneCheck ? '#fbbf24' : '#38bdf8',
            title: currentSlide.title,
            subtitle: currentSlide.subtitle || `${courseTitle} In-Depth`,
            bullets: currentSlide.bullets || [],
            keyTakeaway: currentSlide.keyTakeaway || `Key principle of ${currentSlide.title}`,
            speakerNotes: currentSlide.speakerNotes || `Let us examine ${currentSlide.title} in detail. Focus on the core mechanism and real-world practical applications.`,
            sourceHeadingAnchor: currentSlide.title,
            codeSnippet: currentSlide.codeSnippet,
            tableData: currentSlide.tableData,
            isCheckpoint: isMilestoneCheck,
            isFinalCheckpoint: false,
            checkpointQuiz: isMilestoneCheck
              ? {
                  milestoneTitle: `Milestone Checkpoint: Topics ${Math.max(1, slideCount - 4)} to ${slideCount - 1}`,
                  coveredTopics: coveredTopicsList.map((t) => t.title),
                  questions: buildMilestoneQuestions(coveredTopicsList, false, chapterTitle, chapterNumber),
                }
              : undefined,
          });
          slideCount++;
        }

        const rawHeading = line.replace(/^#+\s*/, '').replace(/[*_`]/g, '').trim();
        currentSlide = {
          title: rawHeading,
          subtitle: `${courseTitle} • Concept Blueprint`,
          bullets: [],
          keyTakeaway: `Key takeaways regarding ${rawHeading}`,
          speakerNotes: `Now, let us examine ${rawHeading} in depth.`,
        };
      } else if (currentSlide) {
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
          const b = line.replace(/^[-*]\s*/, '').replace(/[*_`]/g, '').trim();
          if (b.length > 3 && (currentSlide.bullets?.length || 0) < 6) {
            currentSlide.bullets = currentSlide.bullets || [];
            currentSlide.bullets.push(b);
          }
        } else if (line.trim().length > 35 && (currentSlide.bullets?.length || 0) < 4) {
          const cleanParagraph = line.replace(/[*_`]/g, '').trim();
          if (cleanParagraph.length < 180) {
            currentSlide.bullets = currentSlide.bullets || [];
            currentSlide.bullets.push(cleanParagraph);
          } else if (!currentSlide.speakerNotes) {
            currentSlide.speakerNotes = cleanParagraph;
          }
        }
      }
    }

    if (currentSlide && currentSlide.title && (currentSlide.bullets?.length || 0) > 0) {
      topicTracker.push({ title: currentSlide.title, slideIndex: slideCount - 1 });
      result.push({
        id: `slide_${slideCount}`,
        slideNumber: slideCount,
        badge: `Module ${chapterNumber}.${slideCount - 1}`,
        badgeColor: '#38bdf8',
        title: currentSlide.title,
        subtitle: currentSlide.subtitle || `${courseTitle} In-Depth`,
        bullets: currentSlide.bullets || [],
        keyTakeaway: currentSlide.keyTakeaway || `Key principle of ${currentSlide.title}`,
        speakerNotes: currentSlide.speakerNotes || `Focus on applying ${currentSlide.title} to standardized practices.`,
        sourceHeadingAnchor: currentSlide.title,
        codeSnippet: currentSlide.codeSnippet,
      });
    }

    // Comprehensive Final Chapter Synthesis & Review Slide
    result.push({
      id: 'slide_summary',
      slideNumber: result.length + 1,
      badge: 'Chapter Final Milestone',
      badgeColor: '#10b981',
      title: `${chapterTitle}: Final Comprehensive Review`,
      subtitle: `Synthesis of All Preceding Topics in Book ${chapterNumber}`,
      bullets: [
        `Consolidated foundational principles and architectures from all lessons in Book ${chapterNumber}`,
        `Demonstrated applied practical workflows, implementation patterns, and case studies`,
        `Complete self-assessment in Exams Board to verify holistic learning mastery`,
        `Cross-reference technical definitions in the Glossary for ongoing reference`,
      ],
      keyTakeaway: `Successful completion of Book ${chapterNumber} prepares you for advanced modules and standardized exam assessments.`,
      speakerNotes: `Congratulations on completing all topics for ${chapterTitle}. Take the final comprehensive checkpoint quiz below to solidify your mastery.`,
      sourceHeadingAnchor: `Book ${chapterNumber}: ${chapterTitle}`,
      isCheckpoint: true,
      isFinalCheckpoint: true,
      checkpointQuiz: {
        milestoneTitle: `Final Comprehensive Chapter Quiz (All Topics)`,
        coveredTopics: topicTracker.slice(-8).map((t) => t.title),
        questions: buildMilestoneQuestions(topicTracker.slice(-5), true, chapterTitle, chapterNumber),
      },
    });

    return result;
  }, [chapterContent, chapterNumber, chapterTitle, courseTitle]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(activeSlideIndex || 0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [activeBulletHighlight, setActiveBulletHighlight] = useState<number>(-1);

  const [localLanguage, setLocalLanguage] = useState<string>(() => {
    return activeLanguage || localStorage.getItem('ila_active_language') || 'en-US';
  });
  const [localVoiceProfile, setLocalVoiceProfile] = useState<string>(() => {
    return activeVoiceProfile || localStorage.getItem('ila_active_voice_profile') || 'coqui-xtts-multilingual';
  });

  useEffect(() => {
    if (activeLanguage) setLocalLanguage(activeLanguage);
  }, [activeLanguage]);

  useEffect(() => {
    if (activeVoiceProfile) setLocalVoiceProfile(activeVoiceProfile);
  }, [activeVoiceProfile]);

  const handleLanguageSelect = (newLang: string) => {
    setLocalLanguage(newLang);
    localStorage.setItem('ila_active_language', newLang);
    if (onLanguageChange) onLanguageChange(newLang);
  };

  const handleVoiceProfileSelect = (newVoice: string) => {
    setLocalVoiceProfile(newVoice);
    localStorage.setItem('ila_active_voice_profile', newVoice);
    if (onVoiceProfileChange) onVoiceProfileChange(newVoice);
  };

  const currentSlideIndexRef = useRef(currentSlideIndex);
  currentSlideIndexRef.current = currentSlideIndex;

  const isAutoPlayingRef = useRef(isAutoPlaying);
  isAutoPlayingRef.current = isAutoPlaying;

  const isSpeakingRef = useRef<boolean>(false);

  const slidesRef = useRef(slides);
  slidesRef.current = slides;

  const onNextChapterRef = useRef(onNextChapter);
  onNextChapterRef.current = onNextChapter;

  const hasNextChapterRef = useRef(hasNextChapter);
  hasNextChapterRef.current = hasNextChapter;

  useEffect(() => {
    if (activeSlideIndex !== undefined && activeSlideIndex !== currentSlideIndexRef.current) {
      setCurrentSlideIndex(Math.max(0, Math.min(slides.length - 1, activeSlideIndex)));
    }
  }, [activeSlideIndex, slides.length]);

  const activeSlide = slides[currentSlideIndex] || slides[0];

  // Auto-scroll and highlight synchronized textbook pane when slide changes or is narrated
  useEffect(() => {
    if (activeSlide) {
      handleScrollToSourceAnchor(activeSlide.sourceHeadingAnchor || activeSlide.title);
    }
  }, [currentSlideIndex, activeSlide]);

  // Spoken narration for Checkpoint Questions & Teacher Feedback
  const narrateQuizQuestion = (qIndex: number, targetSlide: SlideItem) => {
    const questions = targetSlide.checkpointQuiz?.questions || [];
    const q = questions[qIndex];
    if (!q) return;

    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    const speechText = `Milestone Checkpoint. Question ${qIndex + 1} of ${questions.length}. Topic: ${q.topicTitle}. ${q.question}. Please select your answer to verify your understanding before continuing the class.`;

    speakText(speechText, {
      lang: localLanguage,
      voiceProfileId: localVoiceProfile,
      rate: speechRate,
      onStart: () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      },
      onEnd: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      },
      onError: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      },
    });
  };

  const narrateQuizFeedback = (isCorrect: boolean, explanation: string, reviewSlideIndex?: number, reviewSlideTitle?: string) => {
    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    let speechText = '';
    if (isCorrect) {
      speechText = `Correct answer verified! ${explanation}`;
    } else {
      speechText = `Incorrect selection. Here is the core concept: ${explanation}. Please review Slide ${(reviewSlideIndex ?? 0) + 1}, ${reviewSlideTitle || ''}, to strengthen your understanding.`;
    }

    speakText(speechText, {
      lang: localLanguage,
      voiceProfileId: localVoiceProfile,
      rate: speechRate,
      onStart: () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      },
      onEnd: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      },
      onError: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      },
    });
  };

  const narrateMilestoneSummary = (totalScore: number, totalQuestions: number) => {
    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    const speechText = `Milestone completed with a score of ${totalScore} out of ${totalQuestions}. You may now continue the masterclass.`;

    speakText(speechText, {
      lang: localLanguage,
      voiceProfileId: localVoiceProfile,
      rate: speechRate,
      onStart: () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      },
      onEnd: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      },
      onError: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
      },
    });
  };

  // Play sequential segments (Intro -> Point 1 -> Point 2 -> Takeaway)
  const playSequentialSegments = (
    segments: ExplanationSegment[],
    segIdx: number,
    slideIdx: number,
    autoAdvanceNext: boolean
  ) => {
    if (!isSpeakingRef.current) return;
    if (segIdx >= segments.length) {
      setIsSpeaking(false);
      isSpeakingRef.current = false;
      setActiveBulletHighlight(-1);

      const targetSlide = slidesRef.current[slideIdx];
      // Automatic Milestone Checkpoint Popup trigger upon slide completion
      if (targetSlide?.isCheckpoint && targetSlide?.checkpointQuiz) {
        setCurrentQuizQuestionIndex(0);
        setSelectedQuizOption(null);
        setUserAnswers({});
        setSubmittedQuestions({});
        setIsMilestoneQuizCompleted(false);
        setShowCheckpointModal(true);
        setTimeout(() => {
          narrateQuizQuestion(0, targetSlide);
        }, 300);
        return;
      }

      if (isAutoPlayingRef.current || autoAdvanceNext) {
        const nextIdx = slideIdx + 1;
        if (nextIdx < slidesRef.current.length) {
          setCurrentSlideIndex(nextIdx);
          onSlideChange?.(nextIdx);
          setTimeout(() => {
            if (isAutoPlayingRef.current) {
              playSlideAudio(nextIdx, true);
            }
          }, 400);
        } else {
          setIsAutoPlaying(false);
          if (hasNextChapterRef.current && onNextChapterRef.current) {
            setTimeout(() => onNextChapterRef.current?.(), 1000);
          }
        }
      }
      return;
    }

    const currentSeg = segments[segIdx];
    // Highlighting stays strictly locked to this active bullet while audio speaks
    if (currentSeg.type === 'bullet' && currentSeg.bulletIndex !== undefined) {
      setActiveBulletHighlight(currentSeg.bulletIndex);
    } else {
      setActiveBulletHighlight(-1);
    }

    handleTriSyncHighlightTextbook(currentSeg.anchorText);

    speakText(currentSeg.text, {
      lang: localLanguage,
      voiceProfileId: localVoiceProfile,
      rate: speechRate,
      onStart: () => {
        setIsSpeaking(true);
        isSpeakingRef.current = true;
      },
      onEnd: () => {
        if (isSpeakingRef.current) {
          playSequentialSegments(segments, segIdx + 1, slideIdx, autoAdvanceNext);
        }
      },
      onError: () => {
        setIsSpeaking(false);
        isSpeakingRef.current = false;
        setActiveBulletHighlight(-1);
      },
    });
  };

  // Speak a slide using Tutor Bot Explanation Engine
  const playSlideAudio = (slideIdx: number, autoAdvanceNext: boolean = false) => {
    const targetSlide = slidesRef.current[slideIdx] || slidesRef.current[0];
    if (!targetSlide) return;

    // Check if this slide has a Milestone Checkpoint that is pending
    if (targetSlide.isCheckpoint && targetSlide.checkpointQuiz && autoAdvanceNext && !isMilestoneQuizCompleted) {
      isSpeakingRef.current = false;
      stopSpeaking();
      setIsSpeaking(false);
      setIsAutoPlaying(false);
      setCurrentQuizQuestionIndex(0);
      setSelectedQuizOption(null);
      setUserAnswers({});
      setSubmittedQuestions({});
      setIsMilestoneQuizCompleted(false);
      setShowCheckpointModal(true);
      setTimeout(() => {
        narrateQuizQuestion(0, targetSlide);
      }, 300);
      return;
    }

    stopSpeaking();
    setIsSpeaking(true);
    isSpeakingRef.current = true;

    const segments = generateExplanationSegments(targetSlide, targetAudience, chapterNumber);
    playSequentialSegments(segments, 0, slideIdx, autoAdvanceNext);
  };

  const handlePauseAndAskDoubt = (defaultQuestion?: string) => {
    isSpeakingRef.current = false;
    stopSpeaking();
    setIsSpeaking(false);
    setIsAutoPlaying(false);
    setActiveBulletHighlight(-1);
    setShowDoubtModal(true);
    if (defaultQuestion) {
      handleAskDoubtQuestion(defaultQuestion);
    }
  };

  const handleAskDoubtQuestion = async (queryText?: string) => {
    const q = queryText || doubtQuestion;
    if (!q.trim() || isAnsweringDoubt) return;

    const userMessage = { role: 'user' as const, text: q.trim() };
    setDoubtHistory((prev) => [...prev, userMessage]);
    setDoubtQuestion('');
    setIsAnsweringDoubt(true);

    try {
      const response = await askIntelliCoach(q.trim(), {
        courseTitle,
        chapterTitle,
        chapterNumber,
        segmentTitle: activeSlide?.title,
        currentTranscript: activeSlide ? `${activeSlide.title}: ${activeSlide.bullets.join('. ')}. Key Takeaway: ${activeSlide.keyTakeaway}` : '',
        chapterContent,
        targetLanguage: activeLanguage,
        targetAudience,
      });

      setDoubtHistory((prev) => [
        ...prev,
        { role: 'assistant', text: response || 'I am ready to clarify any questions on this slide.' },
      ]);
    } catch (err) {
      console.error('Doubt clearing AI error:', err);
      setDoubtHistory((prev) => [
        ...prev,
        { role: 'assistant', text: 'Unable to connect to AI coach. Please try again.' },
      ]);
    } finally {
      setIsAnsweringDoubt(false);
    }
  };

  const handleToggleAutoPlay = () => {
    if (isAutoPlaying) {
      handlePauseAndAskDoubt();
    } else {
      setIsAutoPlaying(true);
      playSlideAudio(currentSlideIndex, true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showDoubtModal || showCheckpointModal) return;
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        setCurrentSlideIndex((prev) => {
          const next = Math.min(slides.length - 1, prev + 1);
          onSlideChange?.(next);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => {
          const next = Math.max(0, prev - 1);
          onSlideChange?.(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, onSlideChange, showDoubtModal, showCheckpointModal]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handleGoToSlide = (idx: number) => {
    const validIdx = Math.max(0, Math.min(slides.length - 1, idx));
    isSpeakingRef.current = false;
    stopSpeaking();
    setIsSpeaking(false);
    setIsAutoPlaying(false);
    setActiveBulletHighlight(-1);
    setSelectedQuizOption(null);
    setCurrentQuizQuestionIndex(0);
    setUserAnswers({});
    setSubmittedQuestions({});
    setIsMilestoneQuizCompleted(false);
    setCurrentSlideIndex(validIdx);
    onSlideChange?.(validIdx);
  };

  const handleCopyTextbook = () => {
    if (!chapterContent) return;
    navigator.clipboard.writeText(chapterContent);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleTriSyncHighlightTextbook = (searchText?: string) => {
    const container = document.getElementById('slide-ai-synchronized-textbook-scroll');
    if (!container || !searchText) return;

    // Reset previous dynamic tri-sync active highlights
    const prevHighlights = container.querySelectorAll('.tri-sync-active-highlight');
    prevHighlights.forEach((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.backgroundColor = 'transparent';
      htmlEl.style.borderLeft = 'none';
      htmlEl.style.paddingLeft = '0';
      htmlEl.style.boxShadow = 'none';
      htmlEl.classList.remove('tri-sync-active-highlight');
    });

    const cleanSearch = searchText.toLowerCase().replace(/[*_`#]/g, '').trim();
    if (!cleanSearch) return;

    const elements = container.querySelectorAll('h1, h2, h3, h4, p, li');
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      const text = el.innerText.toLowerCase();
      if (text.includes(cleanSearch.slice(0, 35)) || cleanSearch.includes(text.slice(0, 30))) {
        el.classList.add('tri-sync-active-highlight');
        el.style.backgroundColor = 'rgba(56, 189, 248, 0.22)';
        el.style.borderLeft = '4px solid #38bdf8';
        el.style.paddingLeft = '0.75rem';
        el.style.borderRadius = '0.35rem';
        el.style.boxShadow = '0 0 15px rgba(56, 189, 248, 0.2)';
        el.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
  };

  const handleScrollToSourceAnchor = (anchorText?: string) => {
    handleTriSyncHighlightTextbook(anchorText);
  };

  const handleExecuteEditSlide = async () => {
    if (!editSlidePrompt.trim() || isAiEditingSlide || !activeSlide) return;
    setIsAiEditingSlide(true);
    try {
      const response = await askIntelliCoach(
        `You are the pedagogical slide author. Rewrite and refine the following slide according to the user instructions.\nActive Slide Title: ${activeSlide.title}\nBullets: ${activeSlide.bullets.join('; ')}\nSpeaker Notes: ${activeSlide.speakerNotes}\nInstructions: ${editSlidePrompt}\n\nFormat as markdown section:\n## [Refined Slide Title]\n- [Bullet 1]\n- [Bullet 2]\n- [Bullet 3]\n> **Key Takeaway**: [Takeaway text]`,
        {
          courseTitle,
          chapterTitle,
          chapterNumber,
          segmentTitle: activeSlide.title,
          chapterContent,
          targetAudience,
        }
      );
      if (response && onScriptUpdate) {
        const updated = `${chapterContent}\n\n### ${activeSlide.title} (AI Refined)\n${response}`;
        onScriptUpdate(updated);
      }
      setSlideEditSuccess('Slide successfully refined with AI!');
      setTimeout(() => {
        setSlideEditSuccess(null);
        setShowEditSlideModal(false);
      }, 1500);
    } catch (err) {
      console.error('Failed to edit slide:', err);
    } finally {
      setIsAiEditingSlide(false);
    }
  };

  const handleExecuteAddSlide = async () => {
    if (!newSlideTopic.trim() || isAddingSlide) return;
    setIsAddingSlide(true);
    try {
      const response = await askIntelliCoach(
        `Create a new comprehensive slide module for the course: "${courseTitle}", Book ${chapterNumber}: "${chapterTitle}".\nNew Slide Topic: ${newSlideTopic}\nTarget Audience: ${targetAudience}\n\nFormat as markdown section:\n## ${newSlideTopic}\n- [Key concept & mechanism]\n- [Hands-on implementation lab]\n- [Operational best practice]\n> **Key Takeaway**: [Summary takeaway]`,
        {
          courseTitle,
          chapterTitle,
          chapterNumber,
          segmentTitle: newSlideTopic,
          chapterContent,
          targetAudience,
        }
      );
      if (response && onScriptUpdate) {
        const updated = `${chapterContent}\n\n## ${newSlideTopic}\n${response}`;
        onScriptUpdate(updated);
      }
      setShowAddSlideModal(false);
      setNewSlideTopic('');
    } catch (err) {
      console.error('Failed to add slide:', err);
    } finally {
      setIsAddingSlide(false);
    }
  };

  return (
    <div
      id="slide-ai-masterclass-viewer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '0.85rem',
        overflow: 'hidden',
        position: isInternalFullScreen ? 'fixed' : 'relative',
        inset: isInternalFullScreen ? 0 : undefined,
        zIndex: isInternalFullScreen ? 9999 : undefined,
        background: isInternalFullScreen ? '#090d16' : 'transparent',
        padding: isInternalFullScreen ? '1.25rem' : 0,
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 1. Integrated Slide + AI Masterclass Control Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '0.85rem',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5)',
          flexShrink: 0,
        }}
      >
        {/* Left Header: Playback & Action Controls Organized into Logical Clusters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Cluster 1: Audio Playback Actions (Tutor Narration & Auto-Play Series side-by-side) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '0.55rem',
              padding: '0.15rem',
              gap: '0.25rem',
            }}
          >
            {/* 1A. Single Slide Tutor Narration */}
            <button
              id="slide-tutor-bot-narrate-btn"
              type="button"
              onClick={() => {
                if (isSpeaking && !isAutoPlaying) {
                  handlePauseAndAskDoubt();
                } else {
                  playSlideAudio(currentSlideIndex, false);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.32rem 0.65rem',
                borderRadius: '0.4rem',
                background: isSpeaking && !isAutoPlaying ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.15)',
                border: isSpeaking && !isAutoPlaying ? '1px solid #ef4444' : '1px solid rgba(56, 189, 248, 0.35)',
                color: isSpeaking && !isAutoPlaying ? '#ef4444' : '#38bdf8',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={isSpeaking && !isAutoPlaying ? 'Pause Tutor Narration' : 'Narrate this slide using Tutor Bot'}
            >
              {isSpeaking && !isAutoPlaying ? <Pause size={13} /> : <Volume2 size={13} />}
              <span>{isSpeaking && !isAutoPlaying ? 'Pause Tutor' : 'Narrate Slide'}</span>
            </button>

            {/* 1B. Auto Play Series (Continuous Full Deck) */}
            <button
              id="slide-auto-play-series-btn"
              type="button"
              onClick={handleToggleAutoPlay}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.32rem 0.65rem',
                borderRadius: '0.4rem',
                background: isAutoPlaying ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: isAutoPlaying ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.12)',
                color: isAutoPlaying ? '#34d399' : '#e2e8f0',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isAutoPlaying ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title={isAutoPlaying ? 'Pause Automated Series' : 'Auto Play Full Slide Series'}
            >
              {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
              <span>{isAutoPlaying ? 'Pause Series' : 'Auto Play Series'}</span>
            </button>
          </div>

          {/* Cluster 2: Slide Navigation & Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <button
              type="button"
              disabled={currentSlideIndex === 0}
              onClick={() => handleGoToSlide(currentSlideIndex - 1)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '0.4rem',
                background: currentSlideIndex === 0 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: currentSlideIndex === 0 ? 'var(--text-subtle)' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentSlideIndex === 0 ? 'not-allowed' : 'pointer',
              }}
              title="Previous Slide (←)"
            >
              <ChevronLeft size={14} />
            </button>

            <div
              style={{
                padding: '0.3rem 0.7rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 800,
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              Slide {currentSlideIndex + 1} of {slides.length}
            </div>

            <button
              type="button"
              disabled={currentSlideIndex >= slides.length - 1}
              onClick={() => handleGoToSlide(currentSlideIndex + 1)}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '0.4rem',
                background: currentSlideIndex >= slides.length - 1 ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: currentSlideIndex >= slides.length - 1 ? 'var(--text-subtle)' : '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: currentSlideIndex >= slides.length - 1 ? 'not-allowed' : 'pointer',
              }}
              title="Next Slide (→)"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Cluster 3: Jump to Slide Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsJumpMenuOpen(!isJumpMenuOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px',
                padding: '0 0.6rem',
                borderRadius: '0.4rem',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Jump directly to any slide index"
            >
              <ListOrdered size={12} color="#38bdf8" />
              <span>Jump to Slide</span>
              <ChevronRight size={11} style={{ transform: isJumpMenuOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {isJumpMenuOpen && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                  onClick={() => setIsJumpMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    zIndex: 110,
                    width: '260px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    background: 'rgba(15, 23, 42, 0.98)',
                    border: '1.5px solid rgba(56, 189, 248, 0.4)',
                    borderRadius: '0.65rem',
                    boxShadow: '0 15px 35px rgba(0, 0, 0, 0.8), 0 0 15px rgba(56, 189, 248, 0.2)',
                    padding: '0.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                  }}
                >
                  <div style={{ padding: '0.25rem 0.5rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                    Slide Index ({slides.length} Slides)
                  </div>
                  {slides.map((s, sIdx) => {
                    const isCur = sIdx === currentSlideIndex;
                    return (
                      <button
                        key={s.id || sIdx}
                        type="button"
                        onClick={() => {
                          handleGoToSlide(sIdx);
                          setIsJumpMenuOpen(false);
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '0.35rem 0.55rem',
                          borderRadius: '0.35rem',
                          background: isCur ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                          border: isCur ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                          color: isCur ? '#38bdf8' : '#e2e8f0',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <span style={{ fontWeight: 800, color: isCur ? '#38bdf8' : '#94a3b8', minWidth: '18px' }}>
                          {sIdx + 1}.
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {s.title}
                        </span>
                        {s.isCheckpoint && (
                          <span style={{ fontSize: '0.58rem', background: 'rgba(251, 191, 36, 0.2)', color: '#fbbf24', padding: '0.05rem 0.3rem', borderRadius: '4px' }}>
                            Quiz
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Cluster 4: Single In-Slide AI Doubt Clearing */}
          <button
            id="slide-ask-ai-doubt-btn"
            type="button"
            onClick={() => {
              if (isSpeaking) {
                stopSpeaking();
                setIsSpeaking(false);
              }
              setShowDoubtModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(236, 72, 153, 0.25) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              color: '#f472b6',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(168, 85, 247, 0.25)',
              transition: 'all 0.15s ease',
            }}
            title="Ask Tutor Bot a doubt on this slide"
          >
            <Sparkles size={13} color="#f472b6" />
            <span>Ask AI Doubt</span>
          </button>

          {/* Cluster 5: Admin Slide Tools */}
          {!isStudentMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => {
                  setEditSlidePrompt('');
                  setShowEditSlideModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(168, 85, 247, 0.18)',
                  border: '1px solid rgba(168, 85, 247, 0.45)',
                  color: '#c084fc',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Edit active slide bullets and notes with AI"
              >
                <Wand2 size={12} />
                <span>Edit Slide</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewSlideTopic('');
                  setShowAddSlideModal(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(99, 102, 241, 0.18)',
                  border: '1px solid rgba(99, 102, 241, 0.45)',
                  color: '#a5b4fc',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="Insert a new AI-generated slide into this deck"
              >
                <Plus size={12} />
                <span>Add Slide</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Header: Language, Voice, Speed, View Mode Switcher, Full-Screen Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {/* Universal Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Globe size={12} color="#38bdf8" />
            <select
              value={localLanguage}
              onChange={(e) => handleLanguageSelect(e.target.value)}
              style={{
                height: '28px',
                padding: '0 0.45rem',
                borderRadius: '0.4rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                fontSize: '0.72rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
              title="Select TTS Narration Language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} style={{ background: '#0f172a', color: '#ffffff' }}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Universal Voice Profile Selector */}
          <select
            value={localVoiceProfile}
            onChange={(e) => handleVoiceProfileSelect(e.target.value)}
            style={{
              height: '28px',
              padding: '0 0.45rem',
              borderRadius: '0.4rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#e2e8f0',
              fontSize: '0.72rem',
              outline: 'none',
              cursor: 'pointer',
            }}
            title="Select TTS Voice Profile"
          >
            {VOICE_PROFILES.map((vp) => (
              <option key={vp.id} value={vp.id} style={{ background: '#0f172a', color: '#ffffff' }}>
                🎙️ {vp.name}
              </option>
            ))}
          </select>

          {/* Speed Selector (0.75x, 1.0x, 1.25x, 1.5x, 2.0x) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <Gauge size={12} color="var(--text-subtle)" />
            <select
              value={speechRate}
              onChange={(e) => {
                const newRate = parseFloat(e.target.value);
                setSpeechRate(newRate);
                setGlobalPlaybackRate(newRate);
              }}
              style={{
                height: '28px',
                padding: '0 0.4rem',
                borderRadius: '0.4rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '0.72rem',
                outline: 'none',
                cursor: 'pointer',
              }}
              title="Playback / Narration Speed"
            >
              <option value="0.75" style={{ background: '#0f172a' }}>0.75x</option>
              <option value="1.0" style={{ background: '#0f172a' }}>1.0x</option>
              <option value="1.25" style={{ background: '#0f172a' }}>1.25x</option>
              <option value="1.5" style={{ background: '#0f172a' }}>1.5x</option>
              <option value="2.0" style={{ background: '#0f172a' }}>2.0x</option>
            </select>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.4rem',
              padding: '0.12rem',
              gap: '0.12rem',
            }}
          >
            <button
              type="button"
              onClick={() => setLayoutMode('split')}
              style={{
                padding: '0.22rem 0.45rem',
                borderRadius: '0.3rem',
                background: layoutMode === 'split' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                border: layoutMode === 'split' ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
                color: layoutMode === 'split' ? '#38bdf8' : 'var(--text-muted)',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
              title="Split Screen: Slide Decks + Textbook"
            >
              <Columns size={11} />
              <span>Split</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode('slides_only')}
              style={{
                padding: '0.22rem 0.45rem',
                borderRadius: '0.3rem',
                background: layoutMode === 'slides_only' ? 'rgba(236, 72, 153, 0.25)' : 'transparent',
                border: layoutMode === 'slides_only' ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid transparent',
                color: layoutMode === 'slides_only' ? '#f472b6' : 'var(--text-muted)',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
              title="Slides Focus Only"
            >
              <Presentation size={11} />
              <span>Slides Only</span>
            </button>

            <button
              type="button"
              onClick={() => setLayoutMode('text_only')}
              style={{
                padding: '0.22rem 0.45rem',
                borderRadius: '0.3rem',
                background: layoutMode === 'text_only' ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                border: layoutMode === 'text_only' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                color: layoutMode === 'text_only' ? '#a5b4fc' : 'var(--text-muted)',
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
              title="Textbook Focus Only"
            >
              <BookOpen size={11} />
              <span>Text Only</span>
            </button>
          </div>

          {/* Full-Screen Immersive Masterclass Toggle */}
          <button
            type="button"
            onClick={() => {
              if (onOpenFullScreen) {
                onOpenFullScreen();
              } else {
                setIsInternalFullScreen(!isInternalFullScreen);
              }
            }}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.4rem',
              background: isInternalFullScreen ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: isInternalFullScreen ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
              color: isInternalFullScreen ? '#38bdf8' : '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            title={isInternalFullScreen ? 'Exit Full-Screen' : 'Full-Screen Immersive View'}
          >
            {isInternalFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{isInternalFullScreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </header>

      {/* 2. Split-Screen Masterclass Stage */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns:
            layoutMode === 'split' ? '1.15fr 0.85fr' : layoutMode === 'slides_only' ? '1fr' : '1fr',
          gap: '1rem',
          minHeight: 0,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Left Pane: Animated Dynamic Slide Canvas (Click-to-Pause Enabled) */}
        {layoutMode !== 'text_only' && activeSlide && (
          <div
            onClick={() => {
              if (isSpeaking) {
                handlePauseAndAskDoubt();
              }
            }}
            style={{
              borderRadius: '0.85rem',
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(20, 20, 38, 0.98) 100%)',
              border: isSpeaking ? '1.5px solid rgba(56, 189, 248, 0.65)' : '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: isSpeaking
                ? '0 0 25px rgba(56, 189, 248, 0.3), 0 15px 30px rgba(0, 0, 0, 0.6)'
                : '0 15px 30px rgba(0, 0, 0, 0.5)',
              padding: '1.15rem 1.4rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflowY: 'auto',
              maxHeight: '100%',
              position: 'relative',
              cursor: isSpeaking ? 'pointer' : 'default',
              transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
            }}
          >
            {isSpeaking && (
              <div
                style={{
                  position: 'absolute',
                  top: '0.65rem',
                  right: '1.25rem',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                  background: 'rgba(56, 189, 248, 0.2)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  color: '#38bdf8',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  zIndex: 10,
                }}
              >
                <span>⏸️ Click Slide to Pause & Ask AI Doubt</span>
              </div>
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.65rem',
                      borderRadius: '9999px',
                      background: `${activeSlide.badgeColor}22`,
                      border: `1px solid ${activeSlide.badgeColor}66`,
                      color: activeSlide.badgeColor,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {activeSlide.badge}
                  </span>

                  {activeSlide.isCheckpoint && (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 800,
                        padding: '0.15rem 0.55rem',
                        borderRadius: '9999px',
                        background: 'rgba(251, 191, 36, 0.2)',
                        border: '1px solid rgba(251, 191, 36, 0.5)',
                        color: '#fbbf24',
                      }}
                    >
                      🎯 Checkpoint Quiz
                    </span>
                  )}

                  {/* Explicit View Book Material Trigger */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onJumpToReadingTab) {
                        onJumpToReadingTab(activeSlide.sourceHeadingAnchor || activeSlide.title);
                      } else {
                        handleScrollToSourceAnchor(activeSlide.sourceHeadingAnchor || activeSlide.title);
                      }
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.18rem 0.65rem',
                      borderRadius: '9999px',
                      background: 'rgba(99, 102, 241, 0.18)',
                      border: '1px solid rgba(99, 102, 241, 0.45)',
                      color: '#c7d2fe',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 0 8px rgba(99, 102, 241, 0.2)',
                      transition: 'all 0.15s ease',
                    }}
                    title="View Book Material and jump directly to source textbook section"
                  >
                    <BookOpen size={11} color="#a5b4fc" />
                    <span>View Book Material</span>
                    <ArrowRight size={10} style={{ opacity: 0.8 }} />
                  </button>
                </div>

                {isSpeaking && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      fontSize: '0.7rem',
                      color: '#38bdf8',
                      fontWeight: 700,
                      animation: 'pulse 1.5s infinite',
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                    <span>Explanation Bot Active</span>
                  </div>
                )}
              </div>

              <h2
                style={{
                  fontSize: 'clamp(1.1rem, 1.8vw, 1.35rem)',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: '0 0 0.25rem 0',
                  lineHeight: '1.25',
                  letterSpacing: '-0.02em',
                }}
              >
                {activeSlide.title}
              </h2>

              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 0.65rem 0', lineHeight: '1.35' }}>
                {activeSlide.subtitle}
              </p>
            </div>

            {/* Slide Body: Smooth Animated Bullet Points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0.35rem 0 0.65rem 0' }}>
              {activeSlide.bullets.map((bullet, bIdx) => {
                const isCurrentBullet = isSpeaking && activeBulletHighlight === bIdx;
                return (
                  <div
                    key={bIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.55rem',
                      background: isCurrentBullet ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      border: isCurrentBullet ? '1.5px solid rgba(56, 189, 248, 0.7)' : '1px solid rgba(255, 255, 255, 0.05)',
                      transform: isCurrentBullet ? 'scale(1.01) translateX(3px)' : 'scale(1)',
                      boxShadow: isCurrentBullet ? '0 0 15px rgba(56, 189, 248, 0.3)' : 'none',
                      transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: isCurrentBullet
                          ? 'linear-gradient(135deg, #38bdf8, #6366f1)'
                          : 'rgba(255, 255, 255, 0.08)',
                        color: isCurrentBullet ? '#ffffff' : '#94a3b8',
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '1px',
                      }}
                    >
                      {bIdx + 1}
                    </div>

                    <div
                      style={{
                        fontSize: isCurrentBullet ? '0.85rem' : '0.82rem',
                        color: isCurrentBullet ? '#ffffff' : '#cbd5e1',
                        fontWeight: isCurrentBullet ? 700 : 400,
                        lineHeight: '1.4',
                      }}
                    >
                      {bullet}
                    </div>
                  </div>
                );
              })}

              {activeSlide.codeSnippet && (
                <div
                  style={{
                    borderRadius: '0.65rem',
                    background: 'rgba(5, 10, 20, 0.95)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '0.85rem 1rem',
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '0.78rem',
                    color: '#38bdf8',
                    overflowX: 'auto',
                  }}
                >
                  <pre style={{ margin: 0 }}>{activeSlide.codeSnippet.code}</pre>
                </div>
              )}
            </div>

            {/* Contextual 'View Book Material' Cross-Referencing & Edit Strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.35rem 0 0.65rem 0',
                flexWrap: 'wrap',
                gap: '0.45rem',
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (layoutMode === 'slides_only') setLayoutMode('split');
                  handleScrollToSourceAnchor(activeSlide.sourceHeadingAnchor || activeSlide.title);
                  if (onJumpToReadingTab) onJumpToReadingTab(activeSlide.sourceHeadingAnchor || activeSlide.title);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.8rem',
                  borderRadius: '9999px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.45)',
                  color: '#7dd3fc',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title="Jump directly to source textbook text"
              >
                <BookOpen size={12} color="#38bdf8" />
                <span>📖 View Book Material (Jump to Textbook)</span>
                <ArrowRight size={11} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditSlidePrompt('');
                    setShowEditSlideModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.6rem',
                    borderRadius: '0.4rem',
                    background: 'rgba(168, 85, 247, 0.18)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#c084fc',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Edit slide bullets and explanations with AI"
                >
                  <Wand2 size={11} />
                  <span>Edit Slide with AI</span>
                </button>
              </div>
            </div>

            {/* Slide Footer: Key Takeaway Box & Speaker Notes */}
            <div>
              {activeSlide.keyTakeaway && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '0.65rem',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.35)',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div style={{ fontSize: '0.66rem', fontWeight: 800, color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    💡 Executive Key Takeaway
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: 600, lineHeight: '1.4' }}>
                    {activeSlide.keyTakeaway}
                  </div>
                </div>
              )}

              {activeSlide.speakerNotes && (
                <div
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.55rem',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
                    🎙️ Explanation Bot Teaching Notes
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic', lineHeight: '1.35' }}>
                    "{activeSlide.speakerNotes}"
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Pane: Synchronized Course Textbook View */}
        {layoutMode !== 'slides_only' && (
          <div
            style={{
              borderRadius: '1rem',
              background: 'rgba(12, 18, 32, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.75rem 1.1rem',
                background: 'rgba(15, 23, 42, 0.98)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <BookOpen size={14} color="#38bdf8" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>
                  Synchronized Chapter Textbook
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => handleScrollToSourceAnchor(activeSlide?.sourceHeadingAnchor || activeSlide?.title)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '0.35rem',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Scroll to current slide topic in textbook"
                >
                  <ExternalLink size={10} />
                  <span>Align Topic</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyTextbook}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.25rem 0.55rem',
                    borderRadius: '0.35rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: copiedText ? '#34d399' : 'var(--text-muted)',
                    fontSize: '0.68rem',
                    cursor: 'pointer',
                  }}
                >
                  {copiedText ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedText ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div
              id="slide-ai-synchronized-textbook-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1.25rem 1.5rem',
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                  Book {chapterNumber}: {chapterTitle}
                </h3>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                  Active Module {currentSlideIndex + 1} of {slides.length} • {activeSlide.title}
                </p>
              </div>

              <MarkdownRenderer content={chapterContent} />
            </div>
          </div>
        )}
      </div>

      {/* 3. In-Slide Pause & Pop-Up Doubt Clearing Modal */}
      {showDoubtModal && (
        <div
          id="slide-doubt-clearing-modal"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(4, 7, 15, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 50,
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
              maxHeight: '85vh',
              background: '#0d1322',
              borderRadius: '1rem',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '0.85rem 1.25rem',
                background: 'linear-gradient(135deg, rgba(20, 30, 55, 0.95) 0%, rgba(12, 18, 35, 0.95) 100%)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '0.45rem',
                    background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Sparkles size={15} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>
                    Slide AI Tutor: Real-Time Doubt Clearing
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 600 }}>
                    Asking about Slide {currentSlideIndex + 1}: {activeSlide.title}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowDoubtModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                maxHeight: '380px',
              }}
            >
              {doubtHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)' }}>
                  <MessageSquare size={32} style={{ opacity: 0.3, margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.8rem', margin: 0 }}>
                    Masterclass playback paused at <strong>{activeSlide.title}</strong>. Ask any clarifying doubt below!
                  </p>
                </div>
              ) : (
                doubtHistory.map((msg, mIdx) => (
                  <div
                    key={mIdx}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '88%',
                      padding: '0.65rem 0.95rem',
                      borderRadius: '0.75rem',
                      background:
                        msg.role === 'user'
                          ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)'
                          : 'rgba(255, 255, 255, 0.05)',
                      border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      lineHeight: '1.45',
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <MarkdownRenderer content={msg.text} />
                    ) : (
                      <span>{msg.text}</span>
                    )}
                  </div>
                ))
              )}

              {isAnsweringDoubt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#38bdf8', fontSize: '0.76rem', padding: '0.5rem' }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span>AI Tutor formulating explanation...</span>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '0.5rem 1.25rem',
                background: 'rgba(0, 0, 0, 0.3)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                overflowX: 'auto',
                flexShrink: 0,
              }}
            >
              {[
                { label: '💡 Explain in simple terms', q: `Explain the concept of ${activeSlide.title} in simple intuitive terms with an analogy.` },
                { label: '🔍 Practical implementation', q: `Give a practical real-world enterprise example of ${activeSlide.title}.` },
                { label: '⚡ Key exam takeaway', q: `What is the most critical takeaway and potential exam question regarding ${activeSlide.title}?` },
              ].map((pill, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleAskDoubtQuestion(pill.q)}
                  style={{
                    padding: '0.22rem 0.6rem',
                    borderRadius: '9999px',
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div
              style={{
                padding: '0.75rem 1.25rem',
                background: 'rgba(10, 15, 28, 0.98)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <input
                type="text"
                value={doubtQuestion}
                onChange={(e) => setDoubtQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAskDoubtQuestion();
                }}
                placeholder={`Ask a doubt about ${activeSlide.title}...`}
                style={{
                  flex: 1,
                  height: '34px',
                  padding: '0 0.85rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  outline: 'none',
                }}
              />

              <button
                type="button"
                onClick={() => handleAskDoubtQuestion()}
                disabled={!doubtQuestion.trim() || isAnsweringDoubt}
                style={{
                  height: '34px',
                  padding: '0 0.85rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: doubtQuestion.trim() && !isAnsweringDoubt ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Send size={12} />
                <span>Ask</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDoubtModal(false);
                  playSlideAudio(currentSlideIndex, isAutoPlaying);
                }}
                style={{
                  height: '34px',
                  padding: '0 1rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)',
                }}
              >
                <span>Resume Masterclass</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Dynamic 'Exam Board' Milestone & Final Checkpoint Pop-Up Modal */}
      {showCheckpointModal && (
        <div
          id="slide-checkpoint-quiz-modal"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(5, 10, 25, 0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          {(() => {
            const milestoneQuiz = activeSlide.checkpointQuiz;
            const milestoneQuestions = milestoneQuiz?.questions || [];
            const totalQuestions = milestoneQuestions.length;
            const currentQ = milestoneQuestions[currentQuizQuestionIndex] || milestoneQuestions[0];
            const isCurrentSubmitted = !!submittedQuestions[currentQuizQuestionIndex];
            const currentChosen = userAnswers[currentQuizQuestionIndex] ?? selectedQuizOption;

            const totalScore = milestoneQuestions.reduce((acc, q, idx) => {
              return acc + (userAnswers[idx] === q.correctIndex ? 1 : 0);
            }, 0);

            return (
              <div
                style={{
                  width: '100%',
                  maxWidth: '680px',
                  background: '#0c1324',
                  borderRadius: '1rem',
                  border: activeSlide.isFinalCheckpoint ? '1.5px solid rgba(16, 185, 129, 0.6)' : '1.5px solid rgba(251, 191, 36, 0.5)',
                  boxShadow: activeSlide.isFinalCheckpoint
                    ? '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.25)'
                    : '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(251, 191, 36, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Modal Header */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    background: 'linear-gradient(135deg, rgba(30, 35, 60, 0.95) 0%, rgba(15, 20, 40, 0.95) 100%)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '0.5rem',
                        background: activeSlide.isFinalCheckpoint
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: activeSlide.isFinalCheckpoint
                          ? '0 0 15px rgba(16, 185, 129, 0.5)'
                          : '0 0 15px rgba(251, 191, 36, 0.5)',
                      }}
                    >
                      <Award size={20} color="#000000" />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#ffffff' }}>
                          {activeSlide.isFinalCheckpoint ? '🏆 Final Comprehensive Chapter Quiz' : '🎯 Interim Milestone Checkpoint Quiz'}
                        </span>
                        <span
                          style={{
                            fontSize: '0.62rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '9999px',
                            background: activeSlide.isFinalCheckpoint ? 'rgba(16, 185, 129, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                            border: activeSlide.isFinalCheckpoint ? '1px solid #10b981' : '1px solid #fbbf24',
                            color: activeSlide.isFinalCheckpoint ? '#34d399' : '#fbbf24',
                            fontWeight: 700,
                          }}
                        >
                          {!isMilestoneQuizCompleted
                            ? `Question ${currentQuizQuestionIndex + 1} of ${totalQuestions}`
                            : 'Milestone Score Summary'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: activeSlide.isFinalCheckpoint ? '#6ee7b7' : '#fbbf24', fontWeight: 600 }}>
                        {milestoneQuiz?.milestoneTitle || `Topic Checkpoint • ${activeSlide.title}`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCheckpointModal(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-subtle)',
                      cursor: 'pointer',
                    }}
                    title="Dismiss Checkpoint"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Question Progress Dots */}
                {!isMilestoneQuizCompleted && totalQuestions > 1 && (
                  <div style={{ display: 'flex', gap: '0.35rem', padding: '0.5rem 1.25rem', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    {milestoneQuestions.map((_, dotIdx) => {
                      const isAnswered = submittedQuestions[dotIdx];
                      const isCorrect = isAnswered && userAnswers[dotIdx] === milestoneQuestions[dotIdx].correctIndex;
                      const isCur = dotIdx === currentQuizQuestionIndex;

                      return (
                        <div
                          key={dotIdx}
                          style={{
                            flex: 1,
                            height: '4px',
                            borderRadius: '2px',
                            background: isAnswered
                              ? isCorrect
                                ? '#10b981'
                                : '#ef4444'
                              : isCur
                              ? '#38bdf8'
                              : 'rgba(255, 255, 255, 0.1)',
                            transition: 'all 0.2s ease',
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Modal Body: Active Question View vs. Milestone Summary View */}
                {!isMilestoneQuizCompleted ? (
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '65vh', overflowY: 'auto' }}>
                    {/* Question Topic Badge & Text */}
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.2rem' }}>
                        {currentQ?.topicTitle ? `Topic Reference: ${currentQ.topicTitle}` : `Question ${currentQuizQuestionIndex + 1}`}
                      </div>
                      <div style={{ fontSize: '0.96rem', fontWeight: 700, color: '#ffffff', lineHeight: '1.45' }}>
                        {currentQ?.question || `What is the key governing principle of ${activeSlide.title}?`}
                      </div>
                    </div>

                    {/* Multiple Choice Options */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                      {(
                        currentQ?.options || [
                          `Standardizing enterprise execution and verified quality controls`,
                          `Bypassing systematic architecture to accelerate deployment`,
                          `Eliminating automated documentation and governance`,
                          `Restricting modular scalability in multi-tier environments`,
                        ]
                      ).map((opt, oIdx) => {
                        const isSelected = currentChosen === oIdx;
                        const isCorrectAnswer = oIdx === (currentQ?.correctIndex ?? 0);
                        const isWrongSelected = isCurrentSubmitted && isSelected && !isCorrectAnswer;
                        const shouldHighlightAsCorrect = isCurrentSubmitted && isCorrectAnswer;

                        let optBg = 'rgba(255, 255, 255, 0.03)';
                        let optBorder = 'rgba(255, 255, 255, 0.08)';
                        let optColor = '#e2e8f0';

                        if (shouldHighlightAsCorrect) {
                          optBg = 'rgba(16, 185, 129, 0.22)';
                          optBorder = '#10b981';
                          optColor = '#34d399';
                        } else if (isWrongSelected) {
                          optBg = 'rgba(239, 68, 68, 0.22)';
                          optBorder = '#ef4444';
                          optColor = '#f87171';
                        } else if (isSelected) {
                          optBg = 'rgba(56, 189, 248, 0.15)';
                          optBorder = '#38bdf8';
                          optColor = '#ffffff';
                        }

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={isCurrentSubmitted}
                            onClick={() => {
                              setSelectedQuizOption(oIdx);
                              setUserAnswers((prev) => ({ ...prev, [currentQuizQuestionIndex]: oIdx }));
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              padding: '0.75rem 1rem',
                              borderRadius: '0.65rem',
                              background: optBg,
                              border: `1.5px solid ${optBorder}`,
                              color: optColor,
                              fontSize: '0.82rem',
                              textAlign: 'left',
                              cursor: isCurrentSubmitted ? 'default' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: shouldHighlightAsCorrect
                                  ? '#10b981'
                                  : isWrongSelected
                                  ? '#ef4444'
                                  : isSelected
                                  ? '#38bdf8'
                                  : 'rgba(255, 255, 255, 0.08)',
                                color: shouldHighlightAsCorrect || isWrongSelected || isSelected ? '#000000' : 'var(--text-muted)',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                display: 'flex',
                                alignItems: 'center',
                                justifySelf: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {shouldHighlightAsCorrect ? '✓' : isWrongSelected ? '✗' : String.fromCharCode(65 + oIdx)}
                            </div>
                            <span style={{ flex: 1, lineHeight: '1.4' }}>{opt}</span>
                            {shouldHighlightAsCorrect && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#34d399', background: 'rgba(16, 185, 129, 0.2)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                Correct Answer
                              </span>
                            )}
                            {isWrongSelected && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#f87171', background: 'rgba(239, 68, 68, 0.2)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                                Your Selection
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Immediate Concept Feedback & Slide Review Recommendation */}
                    {isCurrentSubmitted && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        <div
                          style={{
                            padding: '0.85rem 1.1rem',
                            borderRadius: '0.65rem',
                            background:
                              currentChosen === (currentQ?.correctIndex ?? 0)
                                ? 'rgba(16, 185, 129, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                            border:
                              currentChosen === (currentQ?.correctIndex ?? 0)
                                ? '1px solid rgba(16, 185, 129, 0.45)'
                                : '1px solid rgba(239, 68, 68, 0.45)',
                          }}
                        >
                          <div style={{ fontSize: '0.76rem', fontWeight: 800, color: currentChosen === (currentQ?.correctIndex ?? 0) ? '#34d399' : '#f87171', marginBottom: '0.25rem' }}>
                            {currentChosen === (currentQ?.correctIndex ?? 0)
                              ? '✨ Correct Answer Verified!'
                              : '❌ Incorrect Selection — Core Concept Rationale:'}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#ffffff', lineHeight: '1.45' }}>
                            {currentQ?.explanation || `This verifies the core operational requirement for ${activeSlide.title}.`}
                          </div>
                        </div>

                        {/* Slide Review Recommendation Link (if incorrect) */}
                        {currentChosen !== (currentQ?.correctIndex ?? 0) && (
                          <div
                            style={{
                              padding: '0.75rem 1rem',
                              borderRadius: '0.65rem',
                              background: 'rgba(56, 189, 248, 0.1)',
                              border: '1px solid rgba(56, 189, 248, 0.35)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <BookOpen size={14} color="#38bdf8" />
                              <div style={{ fontSize: '0.74rem', color: '#e2e8f0' }}>
                                <span style={{ color: '#38bdf8', fontWeight: 700 }}>💡 Review Recommendation: </span>
                                <span>Revisit Slide {(currentQ?.suggestedReviewSlideIndex ?? 0) + 1} ("{currentQ?.suggestedReviewSlideTitle || currentQ?.topicTitle || activeSlide.title}")</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const targetReviewIdx = currentQ?.suggestedReviewSlideIndex ?? 0;
                                handleGoToSlide(targetReviewIdx);
                                setShowCheckpointModal(false);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.3rem 0.65rem',
                                borderRadius: '0.4rem',
                                background: 'rgba(56, 189, 248, 0.25)',
                                border: '1px solid rgba(56, 189, 248, 0.5)',
                                color: '#38bdf8',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <span>Jump to Slide {(currentQ?.suggestedReviewSlideIndex ?? 0) + 1}</span>
                              <ArrowRight size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Milestone Score Summary View (5/5 or score report) */
                  <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '65vh', overflowY: 'auto' }}>
                    <div
                      style={{
                        padding: '1.25rem',
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(56, 189, 248, 0.15) 100%)',
                        border: '1.5px solid rgba(16, 185, 129, 0.4)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34d399', marginBottom: '0.25rem' }}>
                        🎯 Milestone Score: {totalScore} / {totalQuestions}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>
                        {totalScore === totalQuestions
                          ? '🌟 Perfect score! 100% mastery achieved across all covered topics.'
                          : `Great effort! You validated ${totalScore} of ${totalQuestions} topics. Review recommended slides below or continue seamlessly.`}
                      </div>
                    </div>

                    {/* Question Breakdown List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                        Milestone Questions Breakdown
                      </div>
                      {milestoneQuestions.map((q, qIdx) => {
                        const isCorrect = userAnswers[qIdx] === q.correctIndex;
                        return (
                          <div
                            key={q.id || qIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.6rem 0.85rem',
                              borderRadius: '0.5rem',
                              background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                              border: isCorrect ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                              gap: '0.5rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                              <span style={{ fontSize: '0.85rem' }}>{isCorrect ? '✅' : '❌'}</span>
                              <div style={{ fontSize: '0.78rem', color: '#ffffff' }}>
                                <span style={{ fontWeight: 700 }}>Q{qIdx + 1}: </span>
                                <span>{q.topicTitle}</span>
                              </div>
                            </div>

                            {!isCorrect && (
                              <button
                                type="button"
                                onClick={() => {
                                  handleGoToSlide(q.suggestedReviewSlideIndex);
                                  setShowCheckpointModal(false);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '0.35rem',
                                  background: 'rgba(56, 189, 248, 0.2)',
                                  border: '1px solid rgba(56, 189, 248, 0.4)',
                                  color: '#38bdf8',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                <span>Review Slide {q.suggestedReviewSlideIndex + 1}</span>
                                <ArrowRight size={10} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Modal Footer with Step-by-Step & Non-Blocking Progression */}
                <div
                  style={{
                    padding: '0.85rem 1.25rem',
                    background: 'rgba(10, 15, 28, 0.98)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {!isMilestoneQuizCompleted
                      ? isCurrentSubmitted
                        ? 'Answer checked • Proceed to next question'
                        : 'Select an option and click Submit Answer'
                      : 'Milestone recorded • Class progression is uninterrupted'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {!isMilestoneQuizCompleted ? (
                      !isCurrentSubmitted ? (
                        <button
                          type="button"
                          disabled={currentChosen === null || currentChosen === undefined}
                          onClick={() => {
                            if (currentChosen !== null && currentChosen !== undefined) {
                              setSubmittedQuestions((prev) => ({ ...prev, [currentQuizQuestionIndex]: true }));
                              const isCorrect = currentChosen === (currentQ?.correctIndex ?? 0);
                              narrateQuizFeedback(
                                isCorrect,
                                currentQ?.explanation || '',
                                currentQ?.suggestedReviewSlideIndex,
                                currentQ?.suggestedReviewSlideTitle
                              );
                            }
                          }}
                          style={{
                            height: '34px',
                            padding: '0 1.1rem',
                            borderRadius: '0.5rem',
                            background: currentChosen !== null && currentChosen !== undefined ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : 'rgba(255, 255, 255, 0.05)',
                            border: 'none',
                            color: currentChosen !== null && currentChosen !== undefined ? '#000000' : 'var(--text-subtle)',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: currentChosen !== null && currentChosen !== undefined ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Submit Answer
                        </button>
                      ) : currentQuizQuestionIndex < totalQuestions - 1 ? (
                        <button
                          type="button"
                          onClick={() => {
                            const nextQ = currentQuizQuestionIndex + 1;
                            setCurrentQuizQuestionIndex(nextQ);
                            setSelectedQuizOption(userAnswers[nextQ] ?? null);
                            setTimeout(() => {
                              narrateQuizQuestion(nextQ, activeSlide);
                            }, 200);
                          }}
                          style={{
                            height: '34px',
                            padding: '0 1.1rem',
                            borderRadius: '0.5rem',
                            background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>Next Question</span>
                          <ArrowRight size={13} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setIsMilestoneQuizCompleted(true);
                            setTimeout(() => {
                              narrateMilestoneSummary(totalScore, totalQuestions);
                            }, 200);
                          }}
                          style={{
                            height: '34px',
                            padding: '0 1.1rem',
                            borderRadius: '0.5rem',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            color: '#ffffff',
                            fontSize: '0.76rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>View Milestone Summary</span>
                          <ArrowRight size={13} />
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          stopSpeaking();
                          setIsSpeaking(false);
                          setShowCheckpointModal(false);
                          const nextIdx = currentSlideIndex + 1;
                          if (nextIdx < slides.length) {
                            setCurrentSlideIndex(nextIdx);
                            onSlideChange?.(nextIdx);
                            setTimeout(() => playSlideAudio(nextIdx, isAutoPlaying), 300);
                          }
                        }}
                        style={{
                          height: '34px',
                          padding: '0 1.2rem',
                          borderRadius: '0.5rem',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
                        }}
                        title="Seamlessly continue class without blocking progression"
                      >
                        <span>{isAutoPlaying ? 'Resume Auto-Play Series' : 'Continue Masterclass'}</span>
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* 5. Bottom Slide Thumbnails Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: '0.75rem',
          background: 'rgba(10, 15, 28, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {slides.map((s, sIdx) => {
          const isSelected = currentSlideIndex === sIdx;
          return (
            <button
              key={s.id || sIdx}
              type="button"
              onClick={() => handleGoToSlide(sIdx)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                minWidth: '130px',
                maxWidth: '160px',
                padding: '0.35rem 0.6rem',
                borderRadius: '0.5rem',
                background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                border: isSelected ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 800, color: isSelected ? '#38bdf8' : '#94a3b8' }}>
                  Slide {sIdx + 1}
                </span>
                {s.isCheckpoint && (
                  <span style={{ fontSize: '0.58rem', color: '#fbbf24', fontWeight: 700 }}>Quiz</span>
                )}
              </div>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                {s.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Edit Slide with AI Modal */}
      {showEditSlideModal && activeSlide && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(5, 10, 20, 0.85)',
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
              maxWidth: '560px',
              background: '#0d1322',
              borderRadius: '1rem',
              border: '1px solid rgba(168, 85, 247, 0.45)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#c084fc', fontWeight: 800 }}>
                <Wand2 size={16} />
                <span>Edit Slide with AI • Slide {currentSlideIndex + 1}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowEditSlideModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 700, marginBottom: '0.2rem' }}>
                {activeSlide.title}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Give prompt instructions to rewrite, adjust pedagogical depth, or add hands-on points to this slide.
              </div>
            </div>

            <textarea
              value={editSlidePrompt}
              onChange={(e) => setEditSlidePrompt(e.target.value)}
              placeholder="e.g. Focus on enterprise Kubernetes deployment, simplify bullet 2, and add an executive takeaway..."
              rows={3}
              style={{
                width: '100%',
                background: 'rgba(5, 10, 20, 0.8)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '0.6rem',
                padding: '0.65rem 0.85rem',
                color: '#ffffff',
                fontSize: '0.82rem',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />

            {slideEditSuccess && (
              <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Check size={14} />
                <span>{slideEditSuccess}</span>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowEditSlideModal(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '0.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteEditSlide}
                disabled={!editSlidePrompt.trim() || isAiEditingSlide}
                style={{
                  padding: '0.45rem 1.1rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: !editSlidePrompt.trim() || isAiEditingSlide ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
                }}
              >
                {isAiEditingSlide ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>{isAiEditingSlide ? 'Refining...' : 'Apply AI Refinement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Slide with AI Modal */}
      {showAddSlideModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(5, 10, 20, 0.85)',
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
              maxWidth: '540px',
              background: '#0d1322',
              borderRadius: '1rem',
              border: '1px solid rgba(99, 102, 241, 0.45)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#a5b4fc', fontWeight: 800 }}>
                <Plus size={16} />
                <span>Add New Slide Module with AI</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddSlideModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Enter the concept, topic, or practical exercise you'd like to insert into this chapter:
              </div>
              <input
                type="text"
                value={newSlideTopic}
                onChange={(e) => setNewSlideTopic(e.target.value)}
                placeholder="e.g. Hands-On Troubleshooting & Diagnostic Commands"
                style={{
                  width: '100%',
                  background: 'rgba(5, 10, 20, 0.8)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '0.6rem',
                  padding: '0.65rem 0.85rem',
                  color: '#ffffff',
                  fontSize: '0.84rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setShowAddSlideModal(false)}
                style={{
                  padding: '0.45rem 0.9rem',
                  borderRadius: '0.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteAddSlide}
                disabled={!newSlideTopic.trim() || isAddingSlide}
                style={{
                  padding: '0.45rem 1.1rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: !newSlideTopic.trim() || isAddingSlide ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  boxShadow: '0 0 12px rgba(236, 72, 153, 0.4)',
                }}
              >
                {isAddingSlide ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                <span>{isAddingSlide ? 'Generating Slide...' : 'Generate & Insert Slide'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
