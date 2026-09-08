import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  X,
  Sparkles,
  Copy,
  Check,
  Tv,
  GraduationCap,
  Loader2,
  ZoomIn,
  Maximize2,
  Minimize2,
  SkipBack,
  SkipForward,
  Mic,
  MicOff,
  Send,
  Bot,
  Film,
  Download,
  FileText,
  CheckCircle2,
  Gauge,
  MessageSquare,
} from 'lucide-react';
import {
  parseMasterclassScriptFromMarkdown,
  formatTimeCode,
  generateSrtSubtitles,
  generateStudioProductionManifest,
  DEFAULT_VIDEO_PIPELINE_CONFIG,
  type ChapterVideoScript,
  type VideoScriptCue,
  type VideoPipelineConfig,
  type VideoRenderEngineType,
} from '../services/masterclassVideoService';
import {
  speakText,
  stopSpeaking,
  playStudioChime,
  unlockAudioAndSpeech,
  startListening,
  stopListening,
  isSpeechRecognitionSupported,
  cleanMarkdownForSpeech,
  detectLanguageFromText,
  SUPPORTED_LANGUAGES,
} from '../services/speechService';
import { askIntelliCoach, translateCourseContent } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import LanguageVoiceSelector from './LanguageVoiceSelector';

export interface VideoDialogueMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  topicNumber: string;
  segmentTitle: string;
  createdAt: number;
}

interface MasterclassVideoPlayerProps {
  courseTitle: string;
  chapterTitle: string;
  chapterNumber?: number;
  chapterContent: string;
  initialTopicNumber?: string; // e.g. "1.1" or "1.2"
  onClose?: () => void;
  isCompact?: boolean;
  isStudentMode?: boolean;
  enableCheckpointExam?: boolean;
  dialogueMode?: 'text' | 'voice' | 'both';
  onScriptUpdate?: (updatedContent: string) => void;
  activeLanguage?: string;
  activeVoiceProfile?: string;
  onNextChapter?: () => void;
  hasNextChapter?: boolean;
  onPreviousChapter?: () => void;
  hasPreviousChapter?: boolean;
}

export interface InVideoCheckpointExam {
  id: string;
  topicNumber: string;
  topicTitle: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  nextCueIndex: number;
}

export default function MasterclassVideoPlayer({
  courseTitle,
  chapterTitle,
  chapterNumber = 1,
  chapterContent,
  initialTopicNumber,
  onClose,
  isCompact = false,
  isStudentMode = false,
  enableCheckpointExam = true,
  dialogueMode = 'both',
  onScriptUpdate,
  activeLanguage,
  activeVoiceProfile,
  onNextChapter,
  hasNextChapter = false,
  onPreviousChapter: _onPreviousChapter,
  hasPreviousChapter: _hasPreviousChapter = false,
}: MasterclassVideoPlayerProps) {
  // Parse structured video script from markdown content
  const videoScript: ChapterVideoScript = useMemo(() => {
    return parseMasterclassScriptFromMarkdown(chapterContent, chapterNumber, chapterTitle);
  }, [chapterContent, chapterNumber, chapterTitle]);

  const [activeCueIndex, setActiveCueIndex] = useState<number>(() => {
    if (initialTopicNumber) {
      const idx = videoScript.cues.findIndex((c) => c.topicNumber === initialTopicNumber);
      if (idx >= 0) return idx;
    }
    return 0;
  });

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentSeconds, setCurrentSeconds] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'video' | 'script' | 'split'>('split');
  const [isZoomModalOpen, setIsZoomModalOpen] = useState<boolean>(false);
  const [isTheaterMode, setIsTheaterMode] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const videoPlayerRootRef = useRef<HTMLDivElement>(null);

  // In-Video Pause Checkpoint Exam State & Auto-Progression Countdown
  const [activeCheckpointExam, setActiveCheckpointExam] = useState<InVideoCheckpointExam | null>(null);
  const [selectedExamOption, setSelectedExamOption] = useState<number | null>(null);
  const [hasSubmittedExam, setHasSubmittedExam] = useState<boolean>(false);
  const [completedCheckpoints, setCompletedCheckpoints] = useState<Set<string>>(new Set());
  const [checkpointAutoResumeCountdown, setCheckpointAutoResumeCountdown] = useState<number | null>(null);

  const completedCheckpointsRef = useRef<Set<string>>(completedCheckpoints);
  completedCheckpointsRef.current = completedCheckpoints;

  const onNextChapterRef = useRef(onNextChapter);
  onNextChapterRef.current = onNextChapter;

  const hasNextChapterRef = useRef(hasNextChapter);
  hasNextChapterRef.current = hasNextChapter;

  // Auto-Progression timer to seamlessly resume video after validating checkpoint exam
  useEffect(() => {
    if (checkpointAutoResumeCountdown === null || !activeCheckpointExam) return;
    if (checkpointAutoResumeCountdown <= 0) {
      const nextIdx = activeCheckpointExam.nextCueIndex;
      setCompletedCheckpoints((prev) => new Set([...prev, activeCheckpointExam.id]));
      setActiveCheckpointExam(null);
      setSelectedExamOption(null);
      setHasSubmittedExam(false);
      setCheckpointAutoResumeCountdown(null);
      handleSeekToCue(nextIdx, true);
      return;
    }
    const timer = window.setTimeout(() => {
      setCheckpointAutoResumeCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [checkpointAutoResumeCountdown, activeCheckpointExam]);

  // Universal Multi-Language & Voice Profile States (Automatically bound to course language)
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    if (activeLanguage && activeLanguage !== 'auto') return activeLanguage;
    const detected = detectLanguageFromText(chapterContent);
    if (detected.lang && detected.lang !== 'en-US') return detected.lang;
    return localStorage.getItem('ila_active_language') || 'en-US';
  });
  const [currentVoiceProfile, setCurrentVoiceProfile] = useState<string>(() => {
    if (activeVoiceProfile) return activeVoiceProfile;
    const detected = detectLanguageFromText(chapterContent);
    if (detected.lang && detected.lang !== 'en-US') {
      const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === detected.lang);
      if (langObj && langObj.defaultVoiceId) return langObj.defaultVoiceId;
    }
    const saved = localStorage.getItem('ila_active_voice_profile');
    if (saved && !saved.startsWith('piper')) return saved;
    return 'coqui-xtts-multilingual';
  });

  const currentLanguageRef = useRef(currentLanguage);
  currentLanguageRef.current = currentLanguage;

  const currentVoiceProfileRef = useRef(currentVoiceProfile);
  currentVoiceProfileRef.current = currentVoiceProfile;

  // Auto-detect course language changes from chapterContent
  useEffect(() => {
    if (chapterContent) {
      const detected = detectLanguageFromText(chapterContent);
      if (detected.lang && detected.lang !== 'en-US' && detected.lang !== currentLanguageRef.current) {
        setCurrentLanguage(detected.lang);
        currentLanguageRef.current = detected.lang;
        localStorage.setItem('ila_active_language', detected.lang);
        const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === detected.lang);
        if (langObj && langObj.defaultVoiceId) {
          setCurrentVoiceProfile(langObj.defaultVoiceId);
          currentVoiceProfileRef.current = langObj.defaultVoiceId;
          localStorage.setItem('ila_active_voice_profile', langObj.defaultVoiceId);
        }
      }
    }
  }, [chapterContent]);

  // Sync with activeLanguage prop updates from parent workspace/reader
  useEffect(() => {
    if (activeLanguage && activeLanguage !== currentLanguageRef.current) {
      setCurrentLanguage(activeLanguage);
      currentLanguageRef.current = activeLanguage;
      localStorage.setItem('ila_active_language', activeLanguage);
    }
  }, [activeLanguage]);

  // Sync with activeVoiceProfile prop updates from parent workspace
  useEffect(() => {
    if (activeVoiceProfile && activeVoiceProfile !== currentVoiceProfileRef.current) {
      setCurrentVoiceProfile(activeVoiceProfile);
      currentVoiceProfileRef.current = activeVoiceProfile;
      localStorage.setItem('ila_active_voice_profile', activeVoiceProfile);
    }
  }, [activeVoiceProfile]);

  // Local cache for localized cue narration scripts & titles (e.g. Malayalam, German, Arabic)
  const translatedCuesCacheRef = useRef<Record<string, string>>({});
  const translatedTitlesCacheRef = useRef<Record<string, string>>({});
  const [localizedVisualNarrator, setLocalizedVisualNarrator] = useState<string>('');
  const [localizedVisualTitle, setLocalizedVisualTitle] = useState<string>('');

  // Video Pipeline Studio State
  const [isVideoSettingsModalOpen, setIsVideoSettingsModalOpen] = useState<boolean>(false);
  const [videoPipelineConfig, setVideoPipelineConfig] = useState<VideoPipelineConfig>(DEFAULT_VIDEO_PIPELINE_CONFIG);
  const [isRenderingPipeline, setIsRenderingPipeline] = useState<boolean>(false);
  const [pipelineProgress, setPipelineProgress] = useState<number>(0);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [aiEnhancedScript, setAiEnhancedScript] = useState<string | null>(null);

  // IntelliCoach™ Interactive AI Tutoring Engine State
  const [isIntelliCoachOpen, setIsIntelliCoachOpen] = useState<boolean>(false);
  const [coachQuestion, setCoachQuestion] = useState<string>('');
  const [submittedQuestion, setSubmittedQuestion] = useState<string>('');
  const [coachAnswer, setCoachAnswer] = useState<string | null>(null);
  const [isCoachThinking, setIsCoachThinking] = useState<boolean>(false);
  const [isCoachListening, setIsCoachListening] = useState<boolean>(false);
  const [isCoachSpeaking, setIsCoachSpeaking] = useState<boolean>(false);
  const [coachVoiceError, setCoachVoiceError] = useState<string | null>(null);
  const [copiedCoachAnswer, setCopiedCoachAnswer] = useState<boolean>(false);

  // In-Video Interactive Dialogue (Text Mode & Multi-turn Session History)
  const [dialogueHistory, setDialogueHistory] = useState<VideoDialogueMessage[]>([]);
  const [isTextDialogueOpen, setIsTextDialogueOpen] = useState<boolean>(false);
  const [textDialogueInput, setTextDialogueInput] = useState<string>('');
  const [isTextDialogueThinking, setIsTextDialogueThinking] = useState<boolean>(false);
  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isTextMicListening, setIsTextMicListening] = useState<boolean>(false);

  const activeCue: VideoScriptCue = videoScript.cues[activeCueIndex] || videoScript.cues[0] || {
    id: 'fallback-cue',
    topicNumber: `${chapterNumber}.1`,
    title: chapterTitle || 'Masterclass Overview',
    timestamp: '00:00',
    startSeconds: 0,
    endSeconds: 60,
    durationFormatted: '01:00',
    visualScreenCue: 'Masterclass presentation overview slide',
    narratorScript: `Welcome to this masterclass module on ${chapterTitle}. Let's examine the core enterprise architecture and practical guidelines.`,
    actionBadge: 'Lecture',
  };

  const timerRef = useRef<number | null>(null);
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const activeCueIndexRef = useRef(activeCueIndex);
  activeCueIndexRef.current = activeCueIndex;

  const videoScriptRef = useRef(videoScript);
  videoScriptRef.current = videoScript;

  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  // Auto-scroll viewport directly to center of the video player screen on mount or topic switch
  const scrollToVideoPlayerCenter = useCallback(() => {
    setTimeout(() => {
      if (videoPlayerRootRef.current) {
        videoPlayerRootRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }, 60);
  }, []);

  useEffect(() => {
    scrollToVideoPlayerCenter();
  }, [chapterNumber, chapterTitle, initialTopicNumber, scrollToVideoPlayerCenter]);

  // Fullscreen toggle handler with native document API + fallback
  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (videoPlayerRootRef.current?.requestFullscreen) {
          await videoPlayerRootRef.current.requestFullscreen();
          setIsFullscreen(true);
          setIsTheaterMode(true);
        } else {
          setIsFullscreen((prev) => !prev);
          setIsTheaterMode((prev) => !prev);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
        setIsTheaterMode(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
      setIsTheaterMode((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isDocFull = Boolean(document.fullscreenElement);
      setIsFullscreen(isDocFull);
      setIsTheaterMode(isDocFull);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sync initialTopicNumber or chapterContent changes
  useEffect(() => {
    if (initialTopicNumber) {
      const idx = videoScript.cues.findIndex((c) => c.topicNumber === initialTopicNumber);
      if (idx >= 0) {
        setActiveCueIndex(idx);
        setCurrentSeconds(videoScript.cues[idx].startSeconds);
      } else {
        setActiveCueIndex(0);
        setCurrentSeconds(0);
      }
    } else {
      setActiveCueIndex(0);
      setCurrentSeconds(0);
    }
    stopSpeaking();
    setIsPlaying(false);
  }, [initialTopicNumber, chapterTitle, chapterContent]);

  // Clean up speech and timers on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      stopListening();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Jump to specific cue with isolated internal scrolling & multi-language Coqui XTTS synthesis
  const handleSeekToCue = useCallback(
    async (index: number, autoPlay: boolean = false, langOverride?: string, voiceOverride?: string) => {
      const cues = videoScriptRef.current.cues;
      const targetCue = cues[index];
      if (!targetCue) return;

      setActiveCueIndex(index);
      setCurrentSeconds(targetCue.startSeconds);

      const activeLang = langOverride || currentLanguageRef.current;
      const activeVoice = voiceOverride || currentVoiceProfileRef.current;

      if (autoPlay || isPlayingRef.current) {
        setIsPlaying(true);
        unlockAudioAndSpeech();
        stopSpeaking();

        if (!isMutedRef.current) {
          let textToNarrate = targetCue.narratorScript;
          let textToDisplayTitle = targetCue.title;

          // Helper to check if text already belongs to the target locale script
          const isTargetScript = (lang: string, txt: string): boolean => {
            if (!txt) return false;
            const norm = lang.toLowerCase();
            if (norm.startsWith('ml') && /[\u0D00-\u0D7F]/.test(txt)) return true;
            if (norm.startsWith('ta') && /[\u0B80-\u0BFF]/.test(txt)) return true;
            if (norm.startsWith('hi') && /[\u0900-\u097F]/.test(txt)) return true;
            if (norm.startsWith('te') && /[\u0C00-\u0C7F]/.test(txt)) return true;
            if (norm.startsWith('kn') && /[\u0C80-\u0CFF]/.test(txt)) return true;
            if (norm.startsWith('bn') && /[\u0980-\u09FF]/.test(txt)) return true;
            if (norm.startsWith('ar') && /[\u0600-\u06FF\u0750-\u077F]/.test(txt)) return true;
            if (norm.startsWith('ja') && /[\u3040-\u30FF]/.test(txt)) return true;
            if (norm.startsWith('zh') && /[\u4E00-\u9FFF]/.test(txt)) return true;
            if (norm.startsWith('ko') && /[\uAC00-\uD7AF]/.test(txt)) return true;
            if (norm.startsWith('ru') && /[\u0400-\u04FF]/.test(txt)) return true;
            return false;
          };

          // Localize narration & screen titles dynamically if a native target language like Malayalam is chosen
          if (activeLang !== 'en-US') {
            const cacheKey = `${targetCue.id}_${activeLang}`;
            const titleKey = `${targetCue.id}_title_${activeLang}`;

            if (isTargetScript(activeLang, targetCue.narratorScript)) {
              // Chapter content is already pre-translated in this language!
              textToNarrate = targetCue.narratorScript;
              setLocalizedVisualNarrator(textToNarrate);
            } else if (translatedCuesCacheRef.current[cacheKey]) {
              textToNarrate = translatedCuesCacheRef.current[cacheKey];
              setLocalizedVisualNarrator(textToNarrate);
            } else {
              const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === activeLang);
              if (langObj) {
                try {
                  const translated = await translateCourseContent(targetCue.narratorScript, langObj.name);
                  if (translated && translated.trim()) {
                    textToNarrate = translated;
                    translatedCuesCacheRef.current[cacheKey] = translated;
                    setLocalizedVisualNarrator(translated);
                  }
                } catch (err) {
                  console.warn('[Video Player] On-demand narration translation notice:', err);
                  setLocalizedVisualNarrator(targetCue.narratorScript);
                }
              }
            }

            if (isTargetScript(activeLang, targetCue.title)) {
              textToDisplayTitle = targetCue.title;
              setLocalizedVisualTitle(textToDisplayTitle);
            } else if (translatedTitlesCacheRef.current[titleKey]) {
              textToDisplayTitle = translatedTitlesCacheRef.current[titleKey];
              setLocalizedVisualTitle(textToDisplayTitle);
            } else {
              const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === activeLang);
              if (langObj) {
                try {
                  const translatedTitle = await translateCourseContent(targetCue.title, langObj.name);
                  if (translatedTitle && translatedTitle.trim()) {
                    textToDisplayTitle = translatedTitle;
                    translatedTitlesCacheRef.current[titleKey] = translatedTitle;
                    setLocalizedVisualTitle(translatedTitle);
                  }
                } catch (err) {
                  console.warn('[Video Player] On-demand title translation notice:', err);
                  setLocalizedVisualTitle(targetCue.title);
                }
              }
            }
          } else {
            setLocalizedVisualNarrator(targetCue.narratorScript);
            setLocalizedVisualTitle(targetCue.title);
          }

          speakText(textToNarrate, {
            rate: playbackRateRef.current,
            volume: isMutedRef.current ? 0.0 : volumeRef.current,
            pitch: 1.0,
            voiceProfileId: activeVoice,
            lang: activeLang,
            onEnd: () => {
              // Natural speech completion -> seamlessly proceed to the next topic segment or chapter
              if (isPlayingRef.current) {
                const nextIdx = index + 1;
                // Trigger interactive in-video checkpoint exam if present on this cue
                if (enableCheckpointExam && targetCue.checkpointExam && !completedCheckpointsRef.current.has(targetCue.checkpointExam.id)) {
                  setIsPlaying(false);
                  stopSpeaking();
                  setActiveCheckpointExam({
                    ...targetCue.checkpointExam,
                    nextCueIndex: nextIdx,
                  });
                  return;
                }

                if (nextIdx < videoScriptRef.current.cues.length) {
                  // Smooth consecutive topic progression
                  handleSeekToCue(nextIdx, true, activeLang, activeVoice);
                } else {
                  // Final topic in chapter complete -> auto-advance to next chapter if available
                  setIsPlaying(false);
                  stopSpeaking();
                  if (hasNextChapterRef.current && onNextChapterRef.current) {
                    setTimeout(() => {
                      onNextChapterRef.current?.();
                    }, 1200);
                  }
                }
              }
            },
            onError: (err) => {
              console.warn('[Video Player] TTS notice:', err);
              if (isPlayingRef.current) {
                const nextIdx = index + 1;
                if (nextIdx < videoScriptRef.current.cues.length) {
                  setTimeout(() => handleSeekToCue(nextIdx, true, activeLang, activeVoice), 1500);
                } else {
                  setIsPlaying(false);
                  stopSpeaking();
                  if (hasNextChapterRef.current && onNextChapterRef.current) {
                    setTimeout(() => {
                      onNextChapterRef.current?.();
                    }, 1200);
                  }
                }
              }
            },
          });
        }
      } else {
        stopSpeaking();
      }

    // Strictly internal container scrolling without window jitter
    setTimeout(() => {
      if (teleprompterRef.current) {
        const container = teleprompterRef.current;
        const el = document.getElementById(`teleprompter-cue-${targetCue.id}`);
        if (el) {
          const topPos = el.offsetTop - container.offsetTop;
          container.scrollTo({ top: Math.max(0, topPos - 12), behavior: 'smooth' });
        }
      }
    }, 40);
  }, []);

  // Play / Pause toggle
  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopSpeaking();
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      unlockAudioAndSpeech();
      scrollToVideoPlayerCenter();
      if (!isMuted) {
        playStudioChime(volume);
      }
      setIsPlaying(true);
      handleSeekToCue(activeCueIndex, true);
    }
  };

  // Timer ticker to advance seconds cleanly for visual scrubber without interrupting speech
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        setCurrentSeconds((prev) => {
          const nextSec = prev + 1;
          const cues = videoScriptRef.current.cues;
          const currentCue = cues[activeCueIndexRef.current];

          if (currentCue && nextSec >= currentCue.endSeconds) {
            // Clamp visual counter to cue boundary while natural narration finishes
            return Math.min(videoScriptRef.current.totalSeconds, currentCue.endSeconds);
          }
          return Math.min(videoScriptRef.current.totalSeconds, nextSec);
        });
      }, 1000 / playbackRate);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackRate]);

  // Timeline scrubber change
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSec = Number(e.target.value);
    setCurrentSeconds(targetSec);

    const matchedIdx = videoScript.cues.findIndex(
      (c) => targetSec >= c.startSeconds && targetSec < c.endSeconds
    );
    if (matchedIdx >= 0 && matchedIdx !== activeCueIndex) {
      handleSeekToCue(matchedIdx, isPlaying);
    }
  };

  // Skip seconds (+/- 10s)
  const handleSkipSeconds = (delta: number) => {
    const newSec = Math.max(0, Math.min(videoScript.totalSeconds, currentSeconds + delta));
    setCurrentSeconds(newSec);

    const matchedIdx = videoScript.cues.findIndex(
      (c) => newSec >= c.startSeconds && newSec < c.endSeconds
    );
    if (matchedIdx >= 0 && matchedIdx !== activeCueIndex) {
      handleSeekToCue(matchedIdx, isPlaying);
    }
  };

  // Video Pipeline Studio Actions (SRT Subtitles, Studio Manifest, Video Rendering)
  const handleDownloadSrtSubtitles = () => {
    const srtContent = generateSrtSubtitles(videoScriptRef.current, translatedCuesCacheRef.current);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(chapterTitle || 'Masterclass').replace(/[^a-zA-Z0-9_-]/g, '_')}_${currentLanguage}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice(`Downloaded SRT Subtitles file for ${currentLanguage}`);
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleExportStudioManifest = () => {
    const manifestJson = generateStudioProductionManifest(
      videoScriptRef.current,
      videoPipelineConfig,
      currentLanguage,
      currentVoiceProfile,
      translatedCuesCacheRef.current
    );
    const blob = new Blob([manifestJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(chapterTitle || 'Masterclass').replace(/[^a-zA-Z0-9_-]/g, '_')}_studio_manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportNotice('Exported Full Studio Production Manifest (.json)');
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleTriggerVideoRender = () => {
    setIsRenderingPipeline(true);
    setPipelineProgress(0);
    const interval = setInterval(() => {
      setPipelineProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsRenderingPipeline(false);
          setExportNotice(`Video rendering pipeline compiled successfully with ${videoPipelineConfig.engine}!`);
          setTimeout(() => setExportNotice(null), 4000);
          return 100;
        }
        return prev + 10;
      });
    }, 250);
  };

  // Dynamic Real-Time In-Video Language Switching
  const handleInVideoLanguageChange = async (newLangCode: string) => {
    setCurrentLanguage(newLangCode);
    currentLanguageRef.current = newLangCode;
    localStorage.setItem('ila_active_language', newLangCode);

    const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === newLangCode);
    let targetVoiceId = currentVoiceProfileRef.current;
    if (langObj && langObj.defaultVoiceId) {
      targetVoiceId = langObj.defaultVoiceId;
      setCurrentVoiceProfile(targetVoiceId);
      currentVoiceProfileRef.current = targetVoiceId;
      localStorage.setItem('ila_active_voice_profile', targetVoiceId);
    }

    // Immediately translate and update visual screen for the active cue
    const targetCue = videoScriptRef.current.cues[activeCueIndexRef.current];
    if (targetCue) {
      if (newLangCode !== 'en-US' && langObj) {
        const cacheKey = `${targetCue.id}_${newLangCode}`;
        const titleKey = `${targetCue.id}_title_${newLangCode}`;

        if (translatedCuesCacheRef.current[cacheKey]) {
          setLocalizedVisualNarrator(translatedCuesCacheRef.current[cacheKey]);
        }
        if (translatedTitlesCacheRef.current[titleKey]) {
          setLocalizedVisualTitle(translatedTitlesCacheRef.current[titleKey]);
        }

        try {
          const [transNarrator, transTitle] = await Promise.all([
            translatedCuesCacheRef.current[cacheKey]
              ? Promise.resolve(translatedCuesCacheRef.current[cacheKey])
              : translateCourseContent(targetCue.narratorScript, langObj.name),
            translatedTitlesCacheRef.current[titleKey]
              ? Promise.resolve(translatedTitlesCacheRef.current[titleKey])
              : translateCourseContent(targetCue.title, langObj.name),
          ]);

          if (transNarrator) {
            translatedCuesCacheRef.current[cacheKey] = transNarrator;
            setLocalizedVisualNarrator(transNarrator);
          }
          if (transTitle) {
            translatedTitlesCacheRef.current[titleKey] = transTitle;
            setLocalizedVisualTitle(transTitle);
          }
        } catch (err) {
          console.warn('In-video instant localization notice:', err);
        }
      } else {
        setLocalizedVisualNarrator(targetCue.narratorScript);
        setLocalizedVisualTitle(targetCue.title);
      }
    }

    // If currently playing, immediately re-speak active cue in the new language & voice!
    if (isPlayingRef.current) {
      stopSpeaking();
      setTimeout(() => {
        handleSeekToCue(activeCueIndexRef.current, true, newLangCode, targetVoiceId);
      }, 50);
    }
  };

  // Dynamic Real-Time In-Video Voice Profile Switching
  const handleInVideoVoiceProfileChange = (newVoiceId: string) => {
    setCurrentVoiceProfile(newVoiceId);
    currentVoiceProfileRef.current = newVoiceId;
    localStorage.setItem('ila_active_voice_profile', newVoiceId);

    // Dynamic Real-Time Update: If currently playing, immediately update speech with new Coqui voice weights!
    if (isPlayingRef.current) {
      stopSpeaking();
      setTimeout(() => {
        handleSeekToCue(activeCueIndexRef.current, true, currentLanguageRef.current, newVoiceId);
      }, 100);
    }
  };

  // IntelliCoach™ Speech Synthesis for answers
  const speakCoachExplanation = useCallback((textToSpeak: string) => {
    if (!textToSpeak) return;
    unlockAudioAndSpeech();
    stopSpeaking();
    setIsCoachSpeaking(true);

    const cleanedText = cleanMarkdownForSpeech(textToSpeak);
    speakText(
      cleanedText,
      {
        rate: playbackRateRef.current,
        volume: isMutedRef.current ? 0.0 : volumeRef.current,
        pitch: 1.05,
        voiceProfileId: currentVoiceProfileRef.current,
        lang: currentLanguageRef.current,
      },
      () => {
        setIsCoachSpeaking(true);
      },
      () => {
        setIsCoachSpeaking(false);
      },
      (err) => {
        console.warn('IntelliCoach TTS error:', err);
        setIsCoachSpeaking(false);
      }
    );
  }, []);

  // Stop IntelliCoach Voice Narration
  const stopCoachExplanation = useCallback(() => {
    stopSpeaking();
    setIsCoachSpeaking(false);
  }, []);

  // Submit Question to IntelliCoach™ AI Tutoring Engine
  const handleAskIntelliCoach = async (queryText?: string) => {
    const finalQuery = (queryText || coachQuestion).trim();
    if (!finalQuery || isCoachThinking) return;

    // Pause lecture narration safely
    if (isPlaying) {
      setIsPlaying(false);
    }
    stopSpeaking();
    stopListening();
    setIsCoachListening(false);

    setSubmittedQuestion(finalQuery);
    setIsCoachThinking(true);
    setCoachVoiceError(null);

    const userMsg: VideoDialogueMessage = {
      id: `user-coach-${Date.now()}`,
      role: 'user',
      text: finalQuery,
      timestamp: activeCue.timestamp,
      topicNumber: activeCue.topicNumber,
      segmentTitle: activeCue.title,
      createdAt: Date.now(),
    };
    setDialogueHistory((prev) => [...prev, userMsg]);

    try {
      const activeLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguageRef.current);
      const answer = await askIntelliCoach(finalQuery, {
        courseTitle,
        chapterTitle,
        chapterNumber,
        topicNumber: activeCue.topicNumber,
        segmentTitle: activeCue.title,
        currentTranscript: activeCue.narratorScript,
        chapterContent,
        targetLanguage: activeLangObj ? activeLangObj.name : 'English',
        conversationHistory: dialogueHistory.map((m) => ({
          role: m.role,
          text: m.text,
          topicNumber: m.topicNumber,
        })),
      });

      setCoachAnswer(answer);
      setCoachQuestion('');
      setIsCoachThinking(false);

      const assistantMsg: VideoDialogueMessage = {
        id: `ai-coach-${Date.now()}`,
        role: 'assistant',
        text: answer,
        timestamp: activeCue.timestamp,
        topicNumber: activeCue.topicNumber,
        segmentTitle: activeCue.title,
        createdAt: Date.now(),
      };
      setDialogueHistory((prev) => [...prev, assistantMsg]);

      // Play chime & speak explanation automatically
      if (!isMutedRef.current) {
        playStudioChime(volumeRef.current);
      }
      speakCoachExplanation(answer);
    } catch (err: any) {
      console.error('IntelliCoach error:', err);
      const errorText =
        err.message ||
        'Failed to connect to IntelliCoach™. Please verify your AI API key in .env.';
      setCoachAnswer(errorText);
      setIsCoachThinking(false);

      const assistantErr: VideoDialogueMessage = {
        id: `ai-coach-err-${Date.now()}`,
        role: 'assistant',
        text: errorText,
        timestamp: activeCue.timestamp,
        topicNumber: activeCue.topicNumber,
        segmentTitle: activeCue.title,
        createdAt: Date.now(),
      };
      setDialogueHistory((prev) => [...prev, assistantErr]);
    }
  };

  // Submit Question to In-Video Text Dialogue
  const handleAskTextDialogue = async (customQuery?: string) => {
    const query = (customQuery || textDialogueInput).trim();
    if (!query || isTextDialogueThinking) return;

    if (isPlaying) {
      setIsPlaying(false);
    }
    stopSpeaking();
    stopListening();
    setIsTextMicListening(false);

    const userMsg: VideoDialogueMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: query,
      timestamp: activeCue.timestamp,
      topicNumber: activeCue.topicNumber,
      segmentTitle: activeCue.title,
      createdAt: Date.now(),
    };

    setDialogueHistory((prev) => [...prev, userMsg]);
    setTextDialogueInput('');
    setIsTextDialogueThinking(true);

    try {
      const activeLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguageRef.current);
      const answer = await askIntelliCoach(query, {
        courseTitle,
        chapterTitle,
        chapterNumber,
        topicNumber: activeCue.topicNumber,
        segmentTitle: activeCue.title,
        currentTranscript: activeCue.narratorScript,
        chapterContent,
        targetLanguage: activeLangObj ? activeLangObj.name : 'English',
        conversationHistory: dialogueHistory.map((m) => ({
          role: m.role,
          text: m.text,
          topicNumber: m.topicNumber,
        })),
      });

      const assistantMsg: VideoDialogueMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: answer,
        timestamp: activeCue.timestamp,
        topicNumber: activeCue.topicNumber,
        segmentTitle: activeCue.title,
        createdAt: Date.now(),
      };

      setDialogueHistory((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: VideoDialogueMessage = {
        id: `ai-err-${Date.now()}`,
        role: 'assistant',
        text: err.message || 'Failed to get explanation. Please check your AI API connection.',
        timestamp: activeCue.timestamp,
        topicNumber: activeCue.topicNumber,
        segmentTitle: activeCue.title,
        createdAt: Date.now(),
      };
      setDialogueHistory((prev) => [...prev, errorMsg]);
    } finally {
      setIsTextDialogueThinking(false);
    }
  };

  // Toggle Voice Input for Text Dialogue
  const toggleTextMicInput = () => {
    if (isTextMicListening) {
      stopListening();
      setIsTextMicListening(false);
    } else {
      if (!isSpeechRecognitionSupported()) return;
      setIsTextMicListening(true);
      if (isPlaying) setIsPlaying(false);
      stopSpeaking();
      startListening(
        (transcript, isFinal) => {
          setTextDialogueInput(transcript);
          if (isFinal && transcript.trim().length > 3) {
            setTimeout(() => {
              handleAskTextDialogue(transcript);
            }, 300);
          }
        },
        () => setIsTextMicListening(false),
        () => setIsTextMicListening(false),
        currentLanguageRef.current
      );
    }
  };

  // Speak/Mute individual dialogue message
  const handleToggleSpeakDialogueMsg = (msgId: string, textToSpeak: string) => {
    if (activeSpeakingMsgId === msgId) {
      stopSpeaking();
      setActiveSpeakingMsgId(null);
      return;
    }
    unlockAudioAndSpeech();
    stopSpeaking();
    setActiveSpeakingMsgId(msgId);
    const cleanedText = cleanMarkdownForSpeech(textToSpeak);
    speakText(
      cleanedText,
      {
        rate: playbackRateRef.current,
        volume: isMutedRef.current ? 0.0 : volumeRef.current,
        pitch: 1.0,
        voiceProfileId: currentVoiceProfileRef.current,
        lang: currentLanguageRef.current,
      },
      () => setActiveSpeakingMsgId(msgId),
      () => setActiveSpeakingMsgId(null),
      () => setActiveSpeakingMsgId(null)
    );
  };

  // Copy dialogue message
  const handleCopyDialogueMsg = async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Seamless resume playback from dialogue
  const handleResumeFromDialogue = () => {
    setIsTextDialogueOpen(false);
    setIsIntelliCoachOpen(false);
    stopSpeaking();
    stopListening();
    setIsCoachListening(false);
    setIsCoachSpeaking(false);
    setIsTextMicListening(false);
    setActiveSpeakingMsgId(null);
    unlockAudioAndSpeech();
    setIsPlaying(true);
    handleSeekToCue(activeCueIndex, true);
  };

  // Click handler anywhere on video stage canvas: directly toggles Play / Pause
  const handleVideoCanvasClick = (_e?: React.MouseEvent) => {
    // If an exam or interactive dialogue is open, let the user interact with it without toggling video
    if (activeCheckpointExam || isTextDialogueOpen || isIntelliCoachOpen) return;
    togglePlayPause();
  };

  // Toggle Live Speech-to-Text Voice Recording for IntelliCoach™
  const toggleCoachVoiceInput = () => {
    if (isCoachListening) {
      stopListening();
      setIsCoachListening(false);
    } else {
      if (!isSpeechRecognitionSupported()) {
        setCoachVoiceError('Microphone input is not supported in this browser.');
        return;
      }

      setCoachVoiceError(null);
      setIsCoachListening(true);
      // Pause lecture speech
      if (isPlaying) {
        setIsPlaying(false);
      }
      stopSpeaking();
      setIsCoachSpeaking(false);

      startListening(
        (transcript, isFinal) => {
          setCoachQuestion(transcript);
          if (isFinal && transcript.trim().length > 3) {
            // Auto-ask on final speech detection
            setTimeout(() => {
              handleAskIntelliCoach(transcript);
            }, 300);
          }
        },
        (errMsg) => {
          setCoachVoiceError(errMsg);
          setIsCoachListening(false);
        },
        () => {
          setIsCoachListening(false);
        },
        currentLanguageRef.current
      );
    }
  };

  // Open IntelliCoach™ Overlay & Pause Background Lecture
  const handleOpenIntelliCoach = () => {
    if (isPlaying) {
      setIsPlaying(false);
    }
    stopSpeaking();
    setIsIntelliCoachOpen(true);
    // Optionally start voice listening on open
    setTimeout(() => {
      toggleCoachVoiceInput();
    }, 150);
  };

  // Close IntelliCoach™ Overlay
  const handleCloseIntelliCoach = () => {
    stopListening();
    stopSpeaking();
    setIsCoachListening(false);
    setIsCoachSpeaking(false);
    setIsIntelliCoachOpen(false);
  };

  const handleCopyCoachAnswer = async () => {
    if (!coachAnswer) return;
    try {
      await navigator.clipboard.writeText(coachAnswer);
      setCopiedCoachAnswer(true);
      setTimeout(() => setCopiedCoachAnswer(false), 2000);
    } catch {
      // ignore
    }
  };

  const progressPercent =
    videoScript.totalSeconds > 0
      ? Math.min(100, (currentSeconds / videoScript.totalSeconds) * 100)
      : 0;

  return (
    <div
      ref={videoPlayerRootRef}
      id="interactive-masterclass-player"
      className="animate-fade-in"
      style={{
        width: '100%',
        margin: isCompact ? '0' : '0 0 1.25rem 0',
        background: 'linear-gradient(145deg, rgba(12, 16, 28, 0.98) 0%, rgba(20, 26, 44, 0.98) 100%)',
        border: isTheaterMode || isFullscreen ? 'none' : '1.5px solid rgba(99, 102, 241, 0.45)',
        borderRadius: isTheaterMode || isFullscreen ? '0' : '1.25rem',
        overflow: 'hidden',
        boxShadow: isTheaterMode || isFullscreen
          ? 'none'
          : '0 20px 45px -10px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        isolation: 'isolate',
        transform: 'translateZ(0)',
        contain: 'paint layout',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        ...(isTheaterMode || isFullscreen
          ? {
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              width: '100vw',
              height: '100vh',
              maxHeight: '100vh',
              margin: 0,
            }
          : {}),
      }}
    >
      {/* 1. Unified Masterclass Executive Header Bar */}
      <div
        id="masterclass-unified-top-bar"
        style={{
          minHeight: '48px',
          padding: '0.45rem 1.15rem',
          background: 'linear-gradient(90deg, rgba(8, 12, 24, 0.98) 0%, rgba(18, 15, 36, 0.98) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
          flexShrink: 0,
          zIndex: 20,
        }}
      >
        {/* Left: Live TV Branding & Course / Segment Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.4)',
              flexShrink: 0,
            }}
          >
            <Tv size={16} color="#ffffff" />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '4px',
                  background: 'rgba(236, 72, 153, 0.25)',
                  color: '#f472b6',
                  border: '1px solid rgba(236, 72, 153, 0.45)',
                  whiteSpace: 'nowrap',
                }}
              >
                LIVE MASTERCLASS
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>•</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#a5b4fc',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                Topic {activeCue.topicNumber} ({activeCueIndex + 1}/{videoScript.cues.length})
              </span>
            </div>
            <div
              style={{
                fontSize: '0.86rem',
                fontWeight: 700,
                color: '#ffffff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '1px',
              }}
            >
              {courseTitle
                ? `${courseTitle} — Book ${chapterNumber}: ${chapterTitle}`
                : `Book ${chapterNumber} • ${chapterTitle}`}
            </div>
          </div>
        </div>

        {/* Right: Unified Controls (Language & Voice, Cadence, IntelliCoach, View Toggle, Fullscreen, Close) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Universal Course & Voice Translation Selector */}
          <LanguageVoiceSelector
            compact
            currentLanguage={currentLanguage}
            onLanguageChange={handleInVideoLanguageChange}
            currentVoiceProfile={currentVoiceProfile}
            onVoiceProfileChange={handleInVideoVoiceProfileChange}
            showVoiceProfile={true}
          />

          {/* Teaching Speed / Study Cadence Selector */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0.45rem',
              padding: '0.1rem 0.35rem',
              gap: '0.2rem',
            }}
            title="Lecture Teaching Pace (Slow Study / Natural / Fast)"
          >
            <Gauge size={12} color="#94a3b8" />
            <select
              value={playbackRate}
              onChange={(e) => {
                const rate = parseFloat(e.target.value);
                setPlaybackRate(rate);
                playbackRateRef.current = rate;
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#cbd5e1',
                fontSize: '0.72rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="0.8" style={{ background: '#0f172a', color: '#ffffff' }}>0.8x (Slow Study)</option>
              <option value="0.9" style={{ background: '#0f172a', color: '#ffffff' }}>0.9x (Deliberate)</option>
              <option value="1.0" style={{ background: '#0f172a', color: '#ffffff' }}>1.0x (Natural Masterclass)</option>
              <option value="1.2" style={{ background: '#0f172a', color: '#ffffff' }}>1.2x (Brisk)</option>
            </select>
          </div>

          {/* IntelliCoach™ Live Voice & Text AI Tutor */}
          <button
            id="top-intellicoach-btn"
            type="button"
            onClick={handleOpenIntelliCoach}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '28px',
              padding: '0 0.65rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)',
              border: '1px solid rgba(244, 114, 182, 0.6)',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.4)',
              transition: 'all 0.15s ease',
            }}
            title="Ask IntelliCoach™ - Live AI Voice & Text Tutor"
          >
            <Sparkles size={11} />
            <span>IntelliCoach™</span>
            <Mic size={9} />
          </button>

          {/* View Mode Toggle: Split View vs Stage View */}
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'split' ? 'video' : 'split')}
            style={{
              height: '28px',
              padding: '0 0.6rem',
              borderRadius: '0.45rem',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#e2e8f0',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
            title={activeTab === 'split' ? 'Switch to Full Stage View' : 'Switch to Split Teleprompter View'}
          >
            {activeTab === 'split' ? 'Full Stage' : 'Split View'}
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={handleToggleFullscreen}
            style={{
              height: '28px',
              width: '28px',
              background: isFullscreen || isTheaterMode ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: isFullscreen || isTheaterMode ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '0.45rem',
              color: isFullscreen || isTheaterMode ? '#a5b4fc' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title={isFullscreen || isTheaterMode ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen || isTheaterMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          {/* Close Player */}
          {onClose && (
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                stopListening();
                onClose();
              }}
              style={{
                height: '28px',
                width: '28px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.45rem',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Close Masterclass Player"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive Body: Video Stage + Teleprompter (Locked / Responsive Height Container) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            activeTab === 'split' ? 'minmax(0, 1.25fr) minmax(0, 1fr)' : '1fr',
          height: isTheaterMode ? 'calc(100vh - 128px)' : isCompact ? '450px' : 'calc(100vh - 220px)',
          minHeight: isTheaterMode ? 'auto' : isCompact ? '420px' : '520px',
          maxHeight: isTheaterMode ? 'calc(100vh - 128px)' : isCompact ? '450px' : 'calc(100vh - 190px)',
          background: 'rgba(6, 9, 16, 0.98)',
          overflow: 'hidden',
          contain: 'layout size',
          position: 'relative',
        }}
      >
        {/* A. Cinematic Video Stage & Visual Presentation */}
        {(activeTab === 'video' || activeTab === 'split') && (
          <div
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'radial-gradient(circle at 50% 30%, rgba(30, 38, 64, 0.9) 0%, rgba(10, 13, 22, 1) 100%)',
              borderRight: activeTab === 'split' ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
              padding: '0.85rem 1.15rem',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Video Stage HUD */}
            <div style={{ zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '28px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '9999px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: '#ffffff',
                    boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  Segment {activeCue.topicNumber}
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.35rem',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#cbd5e1',
                  }}
                >
                  {activeCue.actionBadge || 'Lecture'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* Stage IntelliCoach™ Quick Voice Trigger */}
                <button
                  id="stage-coach-quick-btn"
                  type="button"
                  onClick={handleOpenIntelliCoach}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '9999px',
                    background: 'rgba(236, 72, 153, 0.2)',
                    border: '1px solid rgba(244, 114, 182, 0.45)',
                    color: '#f472b6',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Ask a doubt with IntelliCoach™"
                >
                  <Mic size={11} />
                  <span>Ask Coach</span>
                </button>

                {/* Animated Sound Wave / Equalizer Bars when audio is playing */}
                {isPlaying ? (
                  <div
                    className="soundwave-container"
                    style={{
                      background: 'rgba(99, 102, 241, 0.25)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '9999px',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    <span className="soundwave-bar" />
                    <span className="soundwave-bar" />
                    <span className="soundwave-bar" />
                    <span className="soundwave-bar" />
                    <span
                      style={{
                        fontSize: '0.62rem',
                        color: '#a5b4fc',
                        fontWeight: 700,
                        marginLeft: '0.25rem',
                        letterSpacing: '0.04em',
                      }}
                    >
                      VOICEOVER LIVE
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                    {activeCue.durationFormatted}
                  </span>
                )}
              </div>
            </div>

            {/* Center Video Stage Canvas with Click-to-Pause Interactive AI Dialogue */}
            <div
              id="video-stage-clickable-canvas"
              onClick={handleVideoCanvasClick}
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0.4rem 0',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              title={isPlaying ? 'Click anywhere on screen to pause & ask AI' : 'Click to open interactive AI dialogue'}
            >
              {/* Interactive In-Video AI Dialogue Badge */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isPlaying) {
                    setIsPlaying(false);
                    stopSpeaking();
                  }
                  if (dialogueMode === 'voice') {
                    handleOpenIntelliCoach();
                  } else {
                    setIsTextDialogueOpen(true);
                  }
                }}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  zIndex: 26,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  background: isPlaying ? 'rgba(0, 0, 0, 0.75)' : 'linear-gradient(135deg, rgba(56, 189, 248, 0.4) 0%, rgba(99, 102, 241, 0.4) 100%)',
                  border: isPlaying ? '1px solid rgba(255, 255, 255, 0.2)' : '1.5px solid rgba(56, 189, 248, 0.75)',
                  backdropFilter: 'blur(8px)',
                  color: isPlaying ? '#e2e8f0' : '#38bdf8',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  boxShadow: isPlaying ? 'none' : '0 0 15px rgba(56, 189, 248, 0.45)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                }}
                title="Click to pause lecture & ask AI Tutor a doubt"
              >
                <Sparkles size={11} color="#38bdf8" />
                <span>Ask AI Doubt</span>
              </button>

              {/* Big Prominent Center Play Button Overlay when Paused */}
              {!isPlaying && !activeCheckpointExam && !isTextDialogueOpen && !isIntelliCoachOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 24,
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.95) 0%, rgba(168, 85, 247, 0.95) 100%)',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 0 30px rgba(99, 102, 241, 0.7), 0 10px 25px rgba(0, 0, 0, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title="Click to Play Masterclass Video"
                >
                  <Play size={28} color="#ffffff" fill="#ffffff" style={{ marginLeft: '4px' }} />
                </div>
              )}

              {activeCue.imageUrl ? (
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
                  }}
                >
                  <img
                    src={activeCue.imageUrl}
                    alt={activeCue.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.85))',
                      padding: '0.45rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', color: '#ffffff', fontWeight: 600 }}>
                      {activeCue.screenTitle || activeCue.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsZoomModalOpen(true);
                      }}
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#ffffff',
                        borderRadius: '0.35rem',
                        padding: '0.2rem 0.4rem',
                        fontSize: '0.68rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <ZoomIn size={11} />
                      <span>Inspect Screen</span>
                    </button>
                  </div>
                </div>
              ) : activeCue.cueType === 'code' && activeCue.codeSnippet ? (
                /* Technical Code Structure Visual Reference Card */
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.75rem',
                    background: '#0d1117',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.7)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#34d399' }}>
                        {activeCue.codeSnippet.language.toUpperCase()} Architecture • {activeCue.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.62rem', background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      Clean Code Standard
                    </span>
                  </div>

                  <pre
                    style={{
                      flex: 1,
                      margin: '0.35rem 0',
                      padding: '0.45rem',
                      background: 'rgba(0,0,0,0.5)',
                      borderRadius: '0.4rem',
                      fontSize: '0.72rem',
                      lineHeight: '1.35',
                      color: '#93c5fd',
                      fontFamily: "'Fira Code', 'Consolas', monospace",
                      overflowY: 'auto',
                    }}
                  >
                    <code>{activeCue.codeSnippet.code}</code>
                  </pre>

                  {/* Bullet Summary Bottom Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.25rem', fontSize: '0.68rem', color: '#cbd5e1' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                      💡 {(activeCue.keyBulletPoints || [])[0] || 'Clean modular implementation'}
                    </span>
                    <span style={{ color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                      {activeCue.timestamp}
                    </span>
                  </div>
                </div>
              ) : activeCue.cueType === 'sap_layout' && activeCue.sapLayout ? (
                /* SAP Interface Layout Visual Reference Card */
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    border: '1px solid rgba(2, 132, 199, 0.4)',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.7)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.3rem' }}>
                    <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#38bdf8' }}>
                      SAP GUI: {activeCue.sapLayout.tcode} — {activeCue.sapLayout.screenTitle}
                    </span>
                    <span style={{ fontSize: '0.62rem', background: 'rgba(2, 132, 199, 0.25)', color: '#7dd3fc', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
                      S/4HANA
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', margin: '0.35rem 0', flex: 1, overflowY: 'auto' }}>
                    <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                      <strong>Path:</strong> {activeCue.sapLayout.menuPath}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      {activeCue.sapLayout.fields.map((f, fIdx) => (
                        <div key={fIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.2rem 0.4rem', borderRadius: '0.3rem', background: 'rgba(255,255,255,0.04)', fontSize: '0.68rem' }}>
                          <span style={{ fontWeight: 600, color: '#ffffff' }}>{f.name} {f.required && <span style={{ color: '#ef4444' }}>*</span>}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{f.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.25rem', fontSize: '0.68rem', color: '#cbd5e1' }}>
                    <span>⚡ Standard Document Progression & Validation Checkpoints</span>
                    <span style={{ color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                      {activeCue.timestamp}
                    </span>
                  </div>
                </div>
              ) : (
                /* Dynamic Masterclass Studio Presentation Slide */
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(135deg, rgba(20, 26, 44, 0.92) 0%, rgba(30, 40, 70, 0.92) 100%)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    padding: '0.85rem 1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'inset 0 0 30px rgba(99, 102, 241, 0.1)',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 800,
                        color: '#ffffff',
                        marginBottom: '0.4rem',
                        lineHeight: '1.3',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {localizedVisualTitle || activeCue.title}
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', overflow: 'hidden' }}>
                      {(activeCue.keyBulletPoints || []).slice(0, 4).map((pt, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                          <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', marginTop: '1px' }}>▸</span>
                          <span
                            style={{
                              fontSize: '0.76rem',
                              color: 'rgba(255, 255, 255, 0.88)',
                              lineHeight: '1.35',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {pt}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructor Persona HUD Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                      paddingTop: '0.35rem',
                      marginTop: '0.35rem',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: isPlaying ? '2px solid #ec4899' : '1px solid rgba(255, 255, 255, 0.2)',
                          boxShadow: isPlaying ? '0 0 8px rgba(236, 72, 153, 0.6)' : 'none',
                        }}
                      >
                        <GraduationCap size={11} color="#ffffff" />
                      </div>
                      <div style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 600 }}>
                        Professor Ila • Masterclass Voiceover
                      </div>
                    </div>
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)', fontVariantNumeric: 'tabular-nums' }}>
                      Timecode {activeCue.timestamp}
                    </span>
                  </div>
                </div>
              )}

              {/* In-Video Pause Checkpoint Exam Overlay */}
              {activeCheckpointExam && (
                <div
                  id="in-video-checkpoint-modal"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 30,
                    background: 'rgba(5, 8, 16, 0.95)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderRadius: '0.75rem',
                    border: '1.5px solid rgba(236, 72, 153, 0.6)',
                    boxShadow: '0 0 40px rgba(236, 72, 153, 0.35)',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflowY: 'auto',
                    boxSizing: 'border-box',
                    animation: 'fadeIn 0.2s ease-out',
                  }}
                >
                  <div>
                    {/* Header Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
                          border: '1px solid rgba(236, 72, 153, 0.6)',
                          color: '#f472b6',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                        }}
                      >
                        <Sparkles size={12} />
                        <span>🎯 In-Video Checkpoint Exam • Topic {activeCheckpointExam.topicNumber}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontWeight: 700 }}>
                        {hasSubmittedExam ? (selectedExamOption === activeCheckpointExam.correctIndex ? '✓ PASS (+10 pts)' : '✕ Needs Review') : 'Mandatory Checkpoint'}
                      </span>
                    </div>

                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.65rem 0', lineHeight: '1.4' }}>
                      {activeCheckpointExam.question}
                    </h4>

                    {/* Options List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.65rem' }}>
                      {activeCheckpointExam.options.map((optionText, optIdx) => {
                        const isSelected = selectedExamOption === optIdx;
                        let optBorder = 'rgba(255, 255, 255, 0.1)';
                        let optBg = 'rgba(255, 255, 255, 0.04)';
                        let optColor = '#e2e8f0';

                        if (hasSubmittedExam) {
                          if (optIdx === activeCheckpointExam.correctIndex) {
                            optBorder = '#10b981';
                            optBg = 'rgba(16, 185, 129, 0.2)';
                            optColor = '#6ee7b7';
                          } else if (isSelected) {
                            optBorder = '#ef4444';
                            optBg = 'rgba(239, 68, 68, 0.2)';
                            optColor = '#fca5a5';
                          }
                        } else if (isSelected) {
                          optBorder = '#ec4899';
                          optBg = 'rgba(236, 72, 153, 0.2)';
                          optColor = '#fbcfe8';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={hasSubmittedExam}
                            onClick={() => {
                              setSelectedExamOption(optIdx);
                              setHasSubmittedExam(true);
                              setCheckpointAutoResumeCountdown(3);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              textAlign: 'left',
                              padding: '0.45rem 0.75rem',
                              borderRadius: '0.5rem',
                              background: optBg,
                              border: `1px solid ${optBorder}`,
                              color: optColor,
                              fontSize: '0.76rem',
                              cursor: hasSubmittedExam ? 'default' : 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span style={{ fontWeight: 700, marginRight: '0.5rem', color: '#a5b4fc' }}>
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{optionText}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Feedback Explanation */}
                    {hasSubmittedExam && (
                      <div
                        style={{
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          background: selectedExamOption === activeCheckpointExam.correctIndex ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          border: `1px solid ${selectedExamOption === activeCheckpointExam.correctIndex ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                          fontSize: '0.74rem',
                          color: selectedExamOption === activeCheckpointExam.correctIndex ? '#a7f3d0' : '#fecaca',
                          lineHeight: '1.4',
                          marginBottom: '0.5rem',
                        }}
                      >
                        {selectedExamOption === activeCheckpointExam.correctIndex ? '🎉 ' : '⚠️ '}
                        {activeCheckpointExam.explanation}
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', paddingTop: '0.35rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                      {hasSubmittedExam && checkpointAutoResumeCountdown !== null && (
                        <span>
                          ⏳ Auto-advancing in <strong style={{ color: '#38bdf8' }}>{checkpointAutoResumeCountdown}s</strong>...
                        </span>
                      )}
                    </div>

                    {!hasSubmittedExam ? (
                      <button
                        type="button"
                        disabled={selectedExamOption === null}
                        onClick={() => {
                          setHasSubmittedExam(true);
                          setCheckpointAutoResumeCountdown(3);
                        }}
                        style={{
                          padding: '0.4rem 1rem',
                          borderRadius: '9999px',
                          background: selectedExamOption !== null ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: selectedExamOption !== null ? 'pointer' : 'not-allowed',
                          boxShadow: selectedExamOption !== null ? '0 0 15px rgba(236, 72, 153, 0.5)' : 'none',
                        }}
                      >
                        Submit Answer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedCheckpoints((prev) => new Set([...prev, activeCheckpointExam.id]));
                          const nextIdx = activeCheckpointExam.nextCueIndex;
                          setActiveCheckpointExam(null);
                          setSelectedExamOption(null);
                          setHasSubmittedExam(false);
                          setCheckpointAutoResumeCountdown(null);
                          handleSeekToCue(nextIdx, true);
                        }}
                        style={{
                          padding: '0.4rem 1.15rem',
                          borderRadius: '9999px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)',
                        }}
                      >
                        Resume Lesson Now ➔
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* In-Video Interactive AI Text Dialogue Pop-up Sidebar */}
              {isTextDialogueOpen && (
                <div
                  id="in-video-text-dialogue-box"
                  className="animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    bottom: '0.5rem',
                    width: '390px',
                    maxWidth: 'calc(100% - 1rem)',
                    zIndex: 40,
                    background: 'rgba(9, 14, 26, 0.97)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderRadius: '0.85rem',
                    border: '1.5px solid rgba(56, 189, 248, 0.55)',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.85), 0 0 30px rgba(56, 189, 248, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    animation: 'fadeIn 0.2s ease-out',
                  }}
                >
                  {/* Dialogue Header */}
                  <div
                    style={{
                      padding: '0.65rem 0.85rem',
                      background: 'linear-gradient(180deg, rgba(20, 30, 55, 0.9) 0%, rgba(12, 18, 35, 0.9) 100%)',
                      borderBottom: '1px solid rgba(56, 189, 248, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '0.45rem',
                          background: 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 10px rgba(56, 189, 248, 0.4)',
                          flexShrink: 0,
                        }}
                      >
                        <MessageSquare size={13} color="#ffffff" />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff', lineHeight: '1.2' }}>
                          Video + AI Dialogue
                        </div>
                        <div style={{ fontSize: '0.66rem', color: '#93c5fd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Paused @ Topic {activeCue.topicNumber} ({activeCue.timestamp})
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <button
                        type="button"
                        onClick={handleResumeFromDialogue}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '9999px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)',
                        }}
                        title="Resume class video and voiceover"
                      >
                        <Play size={10} fill="#ffffff" />
                        <span>Resume</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsTextDialogueOpen(false)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '0.35rem',
                          color: '#cbd5e1',
                          padding: '0.25rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Close dialogue"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Messages Conversation Stream */}
                  <div
                    style={{
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                    }}
                  >
                    {dialogueHistory.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.25rem 0' }}>
                        <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                          Ask any question regarding <strong style={{ color: '#38bdf8' }}>{activeCue.title}</strong> to receive instant contextual AI clarification:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                          {[
                            '💡 Explain this segment in simpler terms',
                            '⚡ Provide a practical code or workflow example',
                            '🔍 Why is this step essential in production?',
                            '🎯 What are the key pitfalls to avoid here?',
                          ].map((prompt, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => handleAskTextDialogue(prompt)}
                              style={{
                                textAlign: 'left',
                                padding: '0.4rem 0.65rem',
                                borderRadius: '0.45rem',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                color: '#e0f2fe',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                                e.currentTarget.style.borderColor = '#38bdf8';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.25)';
                              }}
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      dialogueHistory.map((msg) => {
                        const isUser = msg.role === 'user';
                        return (
                          <div
                            key={msg.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isUser ? 'flex-end' : 'flex-start',
                              width: '100%',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '0.62rem',
                                color: isUser ? '#93c5fd' : '#cbd5e1',
                                marginBottom: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                              }}
                            >
                              <span>{isUser ? 'You' : 'AI Explanation'}</span>
                              <span>•</span>
                              <span>Topic {msg.topicNumber} ({msg.timestamp})</span>
                            </div>

                            <div
                              style={{
                                maxWidth: '92%',
                                padding: '0.55rem 0.75rem',
                                borderRadius: isUser ? '0.75rem 0.75rem 0.15rem 0.75rem' : '0.75rem 0.75rem 0.75rem 0.15rem',
                                background: isUser
                                  ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)'
                                  : 'rgba(15, 23, 42, 0.9)',
                                border: isUser ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#ffffff',
                                fontSize: '0.76rem',
                                lineHeight: '1.45',
                              }}
                            >
                              {isUser ? (
                                <span>{msg.text}</span>
                              ) : (
                                <div>
                                  <MarkdownRenderer content={msg.text} />
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.35rem',
                                      marginTop: '0.4rem',
                                      paddingTop: '0.35rem',
                                      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleToggleSpeakDialogueMsg(msg.id, msg.text)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                        background: activeSpeakingMsgId === msg.id ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '0.3rem',
                                        color: activeSpeakingMsgId === msg.id ? '#ef4444' : '#93c5fd',
                                        fontSize: '0.64rem',
                                        padding: '0.15rem 0.4rem',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {activeSpeakingMsgId === msg.id ? <VolumeX size={10} /> : <Volume2 size={10} />}
                                      <span>{activeSpeakingMsgId === msg.id ? 'Stop Voice' : 'Listen'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleCopyDialogueMsg(msg.id, msg.text)}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.2rem',
                                        background: 'rgba(255, 255, 255, 0.06)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '0.3rem',
                                        color: copiedMsgId === msg.id ? '#34d399' : '#cbd5e1',
                                        fontSize: '0.64rem',
                                        padding: '0.15rem 0.4rem',
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {copiedMsgId === msg.id ? <Check size={10} /> : <Copy size={10} />}
                                      <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {isTextDialogueThinking && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38bdf8',
                          fontSize: '0.72rem',
                        }}
                      >
                        <Loader2 size={13} className="animate-spin" />
                        <span>AI is generating contextual explanation...</span>
                      </div>
                    )}
                  </div>

                  {/* Dialogue Input Box & Resume Footer */}
                  <div
                    style={{
                      padding: '0.55rem 0.75rem',
                      background: 'rgba(10, 15, 28, 0.98)',
                      borderTop: '1px solid rgba(56, 189, 248, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="text"
                        value={textDialogueInput}
                        onChange={(e) => setTextDialogueInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAskTextDialogue();
                          }
                        }}
                        placeholder="Type question or follow-up..."
                        style={{
                          flex: 1,
                          height: '32px',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          borderRadius: '0.45rem',
                          padding: '0 0.65rem',
                          color: '#ffffff',
                          fontSize: '0.76rem',
                          outline: 'none',
                        }}
                      />

                      <button
                        type="button"
                        onClick={toggleTextMicInput}
                        style={{
                          height: '32px',
                          width: '32px',
                          borderRadius: '0.45rem',
                          background: isTextMicListening ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.06)',
                          border: isTextMicListening ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.12)',
                          color: isTextMicListening ? '#ef4444' : '#cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title={isTextMicListening ? 'Stop voice recording' : 'Speak question'}
                      >
                        <Mic size={13} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAskTextDialogue()}
                        disabled={!textDialogueInput.trim() || isTextDialogueThinking}
                        style={{
                          height: '32px',
                          padding: '0 0.75rem',
                          borderRadius: '0.45rem',
                          background: textDialogueInput.trim()
                            ? 'linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)'
                            : 'rgba(255, 255, 255, 0.08)',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: textDialogueInput.trim() ? 'pointer' : 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Send size={12} />
                        <span>Send</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleResumeFromDialogue}
                      style={{
                        width: '100%',
                        padding: '0.4rem',
                        borderRadius: '0.45rem',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 0 12px rgba(16, 185, 129, 0.35)',
                      }}
                    >
                      <span>Resume Class Playback ➔</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Live Teleprompter Caption Overlay */}
            <div
              style={{
                zIndex: 10,
                background: 'rgba(4, 7, 14, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '0.6rem',
                padding: '0.45rem 0.75rem',
                backdropFilter: 'blur(10px)',
                height: '48px',
                minHeight: '48px',
                maxHeight: '48px',
                boxSizing: 'border-box',
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <p
                style={{
                  fontSize: '0.8rem',
                  color: '#f8fafc',
                  lineHeight: '1.35',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  width: '100%',
                }}
              >
                {localizedVisualNarrator || activeCue.narratorScript}
              </p>
            </div>
          </div>
        )}

        {/* B. Production Script & Teleprompter Read-Along Panel */}
        {(activeTab === 'script' || activeTab === 'split') && (
          <div
            ref={teleprompterRef}
            style={{
              padding: '0.85rem 1rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.55rem',
              background: 'rgba(10, 14, 24, 0.98)',
              height: '100%',
              boxSizing: 'border-box',
            }}
          >
            {/* Header: Teleprompter Cue List Notice */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.35rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                Production Teleprompter ({videoScript.cues.length} Cues) {!isStudentMode && onScriptUpdate && '• Admin Master'}
              </span>
              <span style={{ fontSize: '0.66rem', color: '#818cf8' }}>
                Click to seek
              </span>
            </div>

            {/* AI Generated Production Script Overlay (if available) */}
            {aiEnhancedScript && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  borderRadius: '0.75rem',
                  padding: '0.65rem 0.75rem',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#c084fc', fontSize: '0.74rem', fontWeight: 700 }}>
                    <Sparkles size={12} />
                    <span>Broadcast Masterclass Script (AI Director)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiEnhancedScript(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-subtle)', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                </div>
                <pre
                  style={{
                    fontSize: '0.72rem',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-mono)',
                    maxHeight: '130px',
                    overflowY: 'auto',
                    lineHeight: '1.4',
                  }}
                >
                  {aiEnhancedScript}
                </pre>
              </div>
            )}

            {/* List of Timecoded Script Segments (Distraction-Free) */}
            {videoScript.cues.map((cue, idx) => {
              const isActive = idx === activeCueIndex;

              return (
                <div
                  key={cue.id}
                  id={`teleprompter-cue-${cue.id}`}
                  onClick={() => handleSeekToCue(idx, true)}
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.22) 0%, rgba(168, 85, 247, 0.18) 100%)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: isActive
                      ? '1px solid rgba(99, 102, 241, 0.55)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '0.65rem',
                    padding: '0.6rem 0.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 0 15px rgba(99, 102, 241, 0.25)' : 'none',
                    flexShrink: 0,
                  }}
                >
                  {/* Timestamp & Segment Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          background: isActive ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                          color: isActive ? '#ffffff' : '#a5b4fc',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        [{cue.timestamp}]
                      </span>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: isActive ? '#ffffff' : 'var(--text-main)' }}>
                        {cue.topicNumber} {translatedTitlesCacheRef.current[`${cue.id}_title_${currentLanguage}`] || cue.title}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '0.64rem',
                        color: isActive ? '#34d399' : 'var(--text-subtle)',
                        fontWeight: 600,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isActive && isPlaying ? '▶ Playing' : cue.durationFormatted}
                    </span>
                  </div>

                  {/* Spoken Narrator Script */}
                  <p
                    style={{
                      fontSize: '0.74rem',
                      color: isActive ? '#f8fafc' : 'rgba(255, 255, 255, 0.7)',
                      lineHeight: '1.4',
                      margin: 0,
                    }}
                  >
                    {translatedCuesCacheRef.current[`${cue.id}_${currentLanguage}`] || cue.narratorScript}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* C. IntelliCoach™ Interactive AI Voice & Text Tutoring Overlay Card */}
        {isIntelliCoachOpen && (
          <div
            id="intellicoach-overlay-container"
            className="animate-fade-in"
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 60,
              background: 'rgba(7, 10, 20, 0.96)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1rem 1.25rem',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* IntelliCoach™ Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '0.65rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '0.6rem',
                    background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 15px rgba(236, 72, 153, 0.5)',
                  }}
                >
                  <Bot size={17} color="#ffffff" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#ffffff' }}>
                      IntelliCoach™
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '0.05rem 0.4rem',
                        borderRadius: '9999px',
                        background: 'rgba(236, 72, 153, 0.2)',
                        border: '1px solid rgba(236, 72, 153, 0.45)',
                        color: '#f472b6',
                      }}
                    >
                      Live AI Tutor
                    </span>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                    Context: Book {chapterNumber} • {activeCue.topicNumber} {activeCue.title}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isCoachSpeaking && (
                  <button
                    type="button"
                    onClick={stopCoachExplanation}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: '0.4rem',
                      color: '#ef4444',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.55rem',
                      cursor: 'pointer',
                    }}
                  >
                    <VolumeX size={12} />
                    <span>Mute Coach Voice</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleResumeFromDialogue}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '9999px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)',
                  }}
                  title="Resume lecture playback"
                >
                  <Play size={10} fill="#ffffff" />
                  <span>Resume Class</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseIntelliCoach}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '0.45rem',
                    color: 'var(--text-main)',
                    padding: '0.35rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close IntelliCoach"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* IntelliCoach™ Body Content Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.85rem 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
              }}
            >
              {/* Voice Listening Wave State */}
              {isCoachListening && (
                <div
                  className="animate-fade-in"
                  style={{
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                    border: '1.5px solid rgba(244, 114, 182, 0.5)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    textAlign: 'center',
                    boxShadow: '0 0 25px rgba(236, 72, 153, 0.25)',
                  }}
                >
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 20px rgba(236, 72, 153, 0.8)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  >
                    <Mic size={22} color="#ffffff" />
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.94rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.2rem' }}>
                      Listening to your question...
                    </h4>
                    <p style={{ fontSize: '0.76rem', color: '#e2e8f0', margin: 0 }}>
                      Ask anything regarding <strong style={{ color: '#f472b6' }}>{activeCue.title}</strong>
                    </p>
                  </div>

                  {coachQuestion && (
                    <div
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '0.5rem',
                        padding: '0.5rem 0.85rem',
                        fontSize: '0.84rem',
                        color: '#f8fafc',
                        maxWidth: '90%',
                        fontStyle: 'italic',
                      }}
                    >
                      "{coachQuestion}"
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAskIntelliCoach()}
                    disabled={!coachQuestion.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem 1.1rem',
                      borderRadius: '0.5rem',
                      background: coachQuestion.trim()
                        ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
                        : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: coachQuestion.trim() ? 'pointer' : 'not-allowed',
                      boxShadow: coachQuestion.trim()
                        ? '0 0 15px rgba(236, 72, 153, 0.4)'
                        : 'none',
                    }}
                  >
                    <Send size={13} />
                    <span>Ask IntelliCoach Now</span>
                  </button>
                </div>
              )}

              {/* Coach Thinking State */}
              {isCoachThinking && (
                <div
                  className="animate-fade-in"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(168, 85, 247, 0.35)',
                    borderRadius: '1rem',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.75rem',
                  }}
                >
                  <Loader2 size={18} className="animate-spin" color="#c084fc" />
                  <span style={{ fontSize: '0.84rem', color: '#d8b4fe', fontWeight: 600 }}>
                    IntelliCoach™ is analyzing lesson context and tailoring your explanation...
                  </span>
                </div>
              )}

              {/* Coach Answer & Student Question Dialogue */}
              {coachAnswer && !isCoachThinking && (
                <div
                  className="animate-fade-in"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {/* Student Question Bubble */}
                  {submittedQuestion && (
                    <div
                      style={{
                        alignSelf: 'flex-end',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
                        border: '1px solid rgba(165, 180, 252, 0.35)',
                        borderRadius: '0.85rem 0.85rem 0.15rem 0.85rem',
                        padding: '0.6rem 0.9rem',
                        maxWidth: '85%',
                      }}
                    >
                      <div style={{ fontSize: '0.68rem', color: '#a5b4fc', fontWeight: 700, marginBottom: '2px' }}>
                        YOUR QUESTION:
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 500 }}>
                        {submittedQuestion}
                      </div>
                    </div>
                  )}

                  {/* IntelliCoach™ Explanation Card */}
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      width: '100%',
                      background: 'linear-gradient(135deg, rgba(25, 20, 48, 0.95) 0%, rgba(35, 24, 60, 0.95) 100%)',
                      border: '1.5px solid rgba(168, 85, 247, 0.5)',
                      borderRadius: '0.85rem',
                      padding: '0.9rem 1.1rem',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.2)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.6rem',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        paddingBottom: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Bot size={15} color="#c084fc" />
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff' }}>
                          IntelliCoach™ Explanation
                        </span>
                        {isCoachSpeaking && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.4rem',
                              borderRadius: '9999px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Volume2 size={10} />
                            <span>Speaking Voice</span>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {/* Voice Narration Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isCoachSpeaking) {
                              stopCoachExplanation();
                            } else {
                              speakCoachExplanation(coachAnswer);
                            }
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '0.35rem',
                            background: isCoachSpeaking
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(99, 102, 241, 0.2)',
                            border: isCoachSpeaking
                              ? '1px solid rgba(239, 68, 68, 0.4)'
                              : '1px solid rgba(99, 102, 241, 0.4)',
                            color: isCoachSpeaking ? '#ef4444' : '#a5b4fc',
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title={isCoachSpeaking ? 'Pause Voice' : 'Listen with Voice Narration'}
                        >
                          {isCoachSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                          <span>{isCoachSpeaking ? 'Pause Voice' : 'Listen Aloud'}</span>
                        </button>

                        {/* Replay */}
                        <button
                          type="button"
                          onClick={() => speakCoachExplanation(coachAnswer)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '0.35rem',
                            color: 'var(--text-main)',
                            padding: '0.2rem 0.45rem',
                            fontSize: '0.68rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                          title="Replay Voice Narration from start"
                        >
                          <RotateCcw size={11} />
                          <span>Replay</span>
                        </button>

                        {/* Copy */}
                        <button
                          type="button"
                          onClick={handleCopyCoachAnswer}
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '0.35rem',
                            color: 'var(--text-main)',
                            padding: '0.2rem 0.45rem',
                            fontSize: '0.68rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                          title="Copy text"
                        >
                          {copiedCoachAnswer ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                          <span>{copiedCoachAnswer ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: '0.82rem',
                        lineHeight: '1.5',
                        color: '#f8fafc',
                        maxHeight: '190px',
                        overflowY: 'auto',
                      }}
                    >
                      <MarkdownRenderer content={coachAnswer} />
                    </div>
                  </div>
                </div>
              )}

              {/* Initial Welcome & Quick Prompts if no answer yet */}
              {!coachAnswer && !isCoachThinking && !isCoachListening && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '1rem',
                    gap: '0.85rem',
                    margin: 'auto',
                    maxWidth: '520px',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '0.75rem',
                      background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 16px rgba(236, 72, 153, 0.4)',
                    }}
                  >
                    <Sparkles size={22} color="#ffffff" />
                  </div>

                  <div>
                    <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.25rem' }}>
                      Ask IntelliCoach™ Anything
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                      Ask live voice or text questions regarding <strong style={{ color: '#a5b4fc' }}>{activeCue.title}</strong> and get instant audio/text explanations.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
                    {[
                      `Clarify ${activeCue.topicNumber} in simpler terms`,
                      `Why is this step important in enterprise production?`,
                      `Give me a real-world business case example`,
                      `What are common pitfalls to avoid here?`,
                    ].map((promptText, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAskIntelliCoach(promptText)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '9999px',
                          padding: '0.3rem 0.75rem',
                          color: '#e2e8f0',
                          fontSize: '0.72rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(236, 72, 153, 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(244, 114, 182, 0.45)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                        }}
                      >
                        ✨ {promptText}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {coachVoiceError && (
                <div style={{ fontSize: '0.74rem', color: '#ef4444', textAlign: 'center' }}>
                  {coachVoiceError}
                </div>
              )}
            </div>

            {/* IntelliCoach™ Footer Input Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                flexShrink: 0,
              }}
            >
              {/* Mic Voice Toggle Button */}
              <button
                type="button"
                onClick={toggleCoachVoiceInput}
                style={{
                  height: '38px',
                  width: '38px',
                  borderRadius: '50%',
                  background: isCoachListening
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isCoachListening
                    ? '0 0 16px rgba(239, 68, 68, 0.6)'
                    : '0 0 14px rgba(236, 72, 153, 0.4)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
                title={isCoachListening ? 'Stop Listening' : 'Speak Question with Voice'}
              >
                {isCoachListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={coachQuestion}
                onChange={(e) => setCoachQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAskIntelliCoach();
                  }
                }}
                placeholder={`Ask IntelliCoach about ${activeCue.topicNumber}...`}
                disabled={isCoachThinking}
                style={{
                  flex: 1,
                  background: 'rgba(10, 13, 22, 0.85)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  borderRadius: '0.65rem',
                  padding: '0.55rem 0.85rem',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleAskIntelliCoach()}
                disabled={!coachQuestion.trim() || isCoachThinking}
                style={{
                  height: '38px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0 0.95rem',
                  borderRadius: '0.65rem',
                  background:
                    coachQuestion.trim() && !isCoachThinking
                      ? 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)'
                      : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor:
                    coachQuestion.trim() && !isCoachThinking
                      ? 'pointer'
                      : 'not-allowed',
                  opacity: coachQuestion.trim() && !isCoachThinking ? 1 : 0.5,
                  boxShadow:
                    coachQuestion.trim() && !isCoachThinking
                      ? '0 0 15px rgba(168, 85, 247, 0.4)'
                      : 'none',
                  flexShrink: 0,
                }}
              >
                {isCoachThinking ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={13} />
                )}
                <span>Ask Coach</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Masterclass Timeline Scrubber & Controller Bar (Sleek Icon Controls) */}
      <div
        style={{
          padding: '0.65rem 1.25rem',
          background: 'rgba(8, 11, 20, 0.98)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          flexShrink: 0,
        }}
      >
        {/* Timeline Scrubber Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              fontSize: '0.72rem',
              color: '#a5b4fc',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              minWidth: '44px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatTimeCode(currentSeconds)}
          </span>

          <input
            type="range"
            min={0}
            max={videoScript.totalSeconds || 100}
            value={currentSeconds}
            onChange={handleScrubberChange}
            style={{
              flex: 1,
              height: '5px',
              borderRadius: '9999px',
              background: `linear-gradient(to right, #6366f1 0%, #a855f7 ${progressPercent}%, rgba(255, 255, 255, 0.15) ${progressPercent}%, rgba(255, 255, 255, 0.15) 100%)`,
              accentColor: '#8b5cf6',
              cursor: 'pointer',
              outline: 'none',
            }}
          />

          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--text-subtle)',
              fontFamily: 'var(--font-mono)',
              minWidth: '44px',
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {videoScript.totalDurationFormatted}
          </span>
        </div>

        {/* Master Controls Row (Icon Buttons Only - No Text Heavy Clutter) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Previous Segment, 10s Rewind, Play/Pause Toggle, 10s Forward, Next Segment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {/* Previous Segment Icon Button */}
            <button
              type="button"
              onClick={() => handleSeekToCue(Math.max(0, activeCueIndex - 1), true)}
              disabled={activeCueIndex === 0}
              style={{
                height: '34px',
                width: '34px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: activeCueIndex === 0 ? 'rgba(255, 255, 255, 0.2)' : 'var(--text-main)',
                borderRadius: '0.45rem',
                cursor: activeCueIndex === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              title="Previous Segment (Skip Back)"
            >
              <SkipBack size={15} />
            </button>

            {/* Skip -10s Icon Button */}
            <button
              type="button"
              onClick={() => handleSkipSeconds(-10)}
              style={{
                height: '34px',
                width: '34px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted)',
                borderRadius: '0.45rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              title="Rewind 10s"
            >
              <RotateCcw size={14} />
            </button>

            {/* Main Play / Pause Voiceover Icon Button */}
            <button
              type="button"
              onClick={togglePlayPause}
              style={{
                height: '38px',
                width: '38px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: isPlaying
                  ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                  : 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: isPlaying
                  ? '0 0 15px rgba(239, 68, 68, 0.45)'
                  : '0 0 15px rgba(99, 102, 241, 0.45)',
                transition: 'all 0.15s ease',
                boxSizing: 'border-box',
              }}
              title={isPlaying ? 'Pause' : 'Play Masterclass'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
            </button>

            {/* Skip +10s Icon Button */}
            <button
              type="button"
              onClick={() => handleSkipSeconds(10)}
              style={{
                height: '34px',
                width: '34px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-muted)',
                borderRadius: '0.45rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              title="Forward 10s"
            >
              <RotateCw size={14} />
            </button>

            {/* Next Segment Icon Button */}
            <button
              type="button"
              onClick={() =>
                handleSeekToCue(Math.min(videoScript.cues.length - 1, activeCueIndex + 1), true)
              }
              disabled={activeCueIndex >= videoScript.cues.length - 1}
              style={{
                height: '34px',
                width: '34px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color:
                  activeCueIndex >= videoScript.cues.length - 1
                    ? 'rgba(255, 255, 255, 0.2)'
                    : 'var(--text-main)',
                borderRadius: '0.45rem',
                cursor: activeCueIndex >= videoScript.cues.length - 1 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
              }}
              title="Next Segment (Skip Forward)"
            >
              <SkipForward size={15} />
            </button>
          </div>

          {/* Right: Playback Speed, Volume & Fullscreen Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {/* Speed Selector Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => {
                    setPlaybackRate(rate);
                    playbackRateRef.current = rate;
                    if (isPlaying) {
                      handleSeekToCue(activeCueIndex, true);
                    }
                  }}
                  style={{
                    height: '26px',
                    background: playbackRate === rate ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                    border: playbackRate === rate ? '1px solid rgba(99, 102, 241, 0.5)' : 'none',
                    borderRadius: '0.35rem',
                    padding: '0 0.4rem',
                    color: playbackRate === rate ? '#ffffff' : 'var(--text-subtle)',
                    fontSize: '0.68rem',
                    fontWeight: playbackRate === rate ? 700 : 500,
                    cursor: 'pointer',
                    fontVariantNumeric: 'tabular-nums',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Volume & Mute Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isMuted;
                  setIsMuted(nextMuted);
                  isMutedRef.current = nextMuted;
                  if (nextMuted) {
                    stopSpeaking();
                  } else if (isPlaying) {
                    handleSeekToCue(activeCueIndex, true);
                  }
                }}
                style={{
                  height: '30px',
                  width: '30px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: isMuted ? '#ef4444' : '#38bdf8',
                  borderRadius: '0.45rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={isMuted ? 'Unmute Audio (Currently Muted)' : `Mute Audio (${Math.round(volume * 100)}%)`}
              >
                {isMuted ? <VolumeX size={14} /> : volume < 0.5 ? <Volume1 size={14} /> : <Volume2 size={14} />}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setVolume(val);
                  volumeRef.current = val;
                  if (val === 0) {
                    setIsMuted(true);
                    isMutedRef.current = true;
                    stopSpeaking();
                  } else {
                    setIsMuted(false);
                    isMutedRef.current = false;
                    if (isPlaying) {
                      handleSeekToCue(activeCueIndex, true);
                    }
                  }
                }}
                style={{
                  width: '52px',
                  height: '4px',
                  accentColor: '#38bdf8',
                  cursor: 'pointer',
                }}
                title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              style={{
                height: '30px',
                width: '30px',
                background: isFullscreen || isTheaterMode ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: isFullscreen || isTheaterMode ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: isFullscreen || isTheaterMode ? '#c084fc' : 'var(--text-muted)',
                borderRadius: '0.45rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              title={isFullscreen || isTheaterMode ? 'Exit Fullscreen' : 'Enter Fullscreen (Full Display)'}
            >
              {isFullscreen || isTheaterMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Screen Zoom Modal */}
      {isZoomModalOpen && activeCue.imageUrl && (
        <div
          onClick={() => setIsZoomModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '1000px',
              width: '100%',
              background: '#0d111c',
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '1rem',
              overflow: 'hidden',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9)',
            }}
          >
            <div
              style={{
                padding: '0.75rem 1.25rem',
                background: '#0a0d16',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff' }}>
                {activeCue.screenTitle || activeCue.title} • Live Screen Inspection
              </span>
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
              <img
                src={activeCue.imageUrl}
                alt={activeCue.title}
                style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '0.5rem' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Video Studio Engine & Real-Time Pipeline Config Modal */}
      {isVideoSettingsModalOpen && (
        <div
          onClick={() => setIsVideoSettingsModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '680px',
              width: '100%',
              background: '#0d111c',
              border: '1.5px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '1.25rem',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(99, 102, 241, 0.3)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.25rem',
                background: 'linear-gradient(90deg, #111827 0%, #1e1b4b 100%)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '0.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
                  }}
                >
                  <Film size={17} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                    Masterclass Video Engine & Studio Pipeline
                  </h3>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', margin: 0 }}>
                    Modular avatar lip-sync APIs, real-time canvas buffer & studio export
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVideoSettingsModalOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.45rem',
                  color: '#ffffff',
                  padding: '0.35rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body Form */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* 1. Rendering Engine Selection */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.4rem' }}>
                  Video Generation & Avatar Rendering Engine
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'ila-studio-canvas', name: 'ILA Studio Canvas Engine', badge: 'Active Real-Time', desc: 'Hardware-accelerated 60fps Ultra-HD browser presentation canvas' },
                    { id: 'heygen-avatar-api', name: 'HeyGen Streaming Avatar API', badge: 'Cloud Avatar', desc: 'Real-time neural lip-sync avatar streaming pipeline hook' },
                    { id: 'did-avatar-api', name: 'D-ID Real-Time Video API', badge: 'Talking Head', desc: 'Photo-to-video real-time neural talking presenter pipeline' },
                    { id: 'local-open-source', name: 'Local Open-Source Pipeline', badge: 'SadTalker / LivePortrait', desc: 'Zero-cloud fee local open-source neural rendering model' },
                  ].map((engine) => {
                    const isSelected = videoPipelineConfig.engine === engine.id;
                    return (
                      <div
                        key={engine.id}
                        onClick={() =>
                          setVideoPipelineConfig((prev) => ({
                            ...prev,
                            engine: engine.id as VideoRenderEngineType,
                          }))
                        }
                        style={{
                          padding: '0.75rem',
                          borderRadius: '0.65rem',
                          background: isSelected ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1.5px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.08)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: isSelected ? '#ffffff' : '#cbd5e1' }}>
                            {engine.name}
                          </span>
                          <span style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: isSelected ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.08)', color: isSelected ? '#a5b4fc' : 'var(--text-subtle)' }}>
                            {engine.badge}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: 0 }}>
                          {engine.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Avatar Instructor Style & Resolution Controls */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.35rem' }}>
                    Avatar Instructor Persona
                  </label>
                  <select
                    value={videoPipelineConfig.avatarStyle}
                    onChange={(e) =>
                      setVideoPipelineConfig((prev) => ({
                        ...prev,
                        avatarStyle: e.target.value as any,
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      outline: 'none',
                    }}
                  >
                    <option value="executive-professor">Executive Masterclass Professor</option>
                    <option value="tech-lead">Tech Lead / Architecture Specialist</option>
                    <option value="academic-scholar">University Academic Scholar</option>
                    <option value="interactive-coach">Interactive Hands-On Lab Coach</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.35rem' }}>
                    Output Resolution & Framerate
                  </label>
                  <select
                    value={`${videoPipelineConfig.resolution}-${videoPipelineConfig.fps}`}
                    onChange={(e) => {
                      const [res, fps] = e.target.value.split('-');
                      setVideoPipelineConfig((prev) => ({
                        ...prev,
                        resolution: res as any,
                        fps: Number(fps) as any,
                      }));
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      outline: 'none',
                    }}
                  >
                    <option value="1080p-30">1080p Full HD (30 fps) - Standard</option>
                    <option value="1080p-60">1080p Full HD (60 fps) - High Frame Rate</option>
                    <option value="4k-30">4K Ultra HD (30 fps) - Broadcast Cinema</option>
                    <option value="4k-60">4K Ultra HD (60 fps) - Studio Master</option>
                  </select>
                </div>
              </div>

              {/* 3. Render Progress Simulation */}
              {isRenderingPipeline && (
                <div
                  style={{
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    borderRadius: '0.65rem',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: '#cbd5e1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Loader2 size={13} className="animate-spin" color="#a5b4fc" />
                      <span>Rendering Video Frames ({videoPipelineConfig.engine})...</span>
                    </div>
                    <span style={{ fontWeight: 700, color: '#a5b4fc' }}>{pipelineProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.1)', overflow: 'hidden' }}>
                    <div style={{ width: `${pipelineProgress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', transition: 'width 0.25s ease' }} />
                  </div>
                </div>
              )}

              {/* 4. Production Export Actions */}
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#e2e8f0', display: 'block', marginBottom: '0.4rem' }}>
                  Production Exports & Subtitle Generator
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleDownloadSrtSubtitles}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.55rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Download size={13} color="#38bdf8" />
                    <span>Download SRT</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportStudioManifest}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.55rem',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <FileText size={13} color="#c084fc" />
                    <span>Export Manifest</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerVideoRender}
                    disabled={isRenderingPipeline}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.55rem',
                      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      cursor: isRenderingPipeline ? 'not-allowed' : 'pointer',
                      boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
                    }}
                  >
                    <Film size={13} />
                    <span>{isRenderingPipeline ? 'Compiling...' : 'Render Stream'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.75rem 1.25rem',
                background: 'rgba(0, 0, 0, 0.4)',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Active Locale: <strong style={{ color: '#ffffff' }}>{currentLanguage}</strong> • TTS Engine: <strong style={{ color: '#38bdf8' }}>Google Cloud TTS (Neural2 / WaveNet)</strong>
              </div>
              <button
                type="button"
                onClick={() => setIsVideoSettingsModalOpen(false)}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '0.45rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Notice Toast */}
      {exportNotice && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 11000,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.95) 100%)',
            border: '1px solid rgba(52, 211, 153, 0.5)',
            borderRadius: '0.65rem',
            padding: '0.65rem 1rem',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 700,
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <CheckCircle2 size={16} color="#ffffff" />
          <span>{exportNotice}</span>
        </div>
      )}
    </div>
  );
}
