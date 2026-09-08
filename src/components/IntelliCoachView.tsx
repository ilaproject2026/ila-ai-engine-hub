import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Bot,
  Send,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  RotateCcw,
  CheckCircle2,
  Compass,
  ArrowRight,
  BookOpen,
  GraduationCap,
  Presentation,
  Tv,
  Check,
  Loader2,
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { useVoice } from '../hooks/useVoice';
import {
  conductIntelliCoachDiagnostic,
  askIntelliCoach,
  type DiagnosticAssessmentData,
} from '../services/geminiService';
import {
  type LibraryCourse,
} from '../services/dbService';
import { startListening, stopListening, cleanMarkdownForSpeech } from '../services/speechService';

export type DiagnosticStep = 'intro' | 'need_analysis' | 'roadmap' | 'ready_to_launch';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  timestamp: number;
  step?: DiagnosticStep;
  suggestedOptions?: string[];
  roadmapData?: Partial<DiagnosticAssessmentData>;
}

interface IntelliCoachViewProps {
  initialCourse?: LibraryCourse | null;
  onLaunchCourse?: (courseTitle: string, targetAudience: string, promptQuery?: string) => void;
  onOpenReadingTab?: () => void;
  onOpenSlideTab?: () => void;
  onOpenVideoTab?: () => void;
  isEmbedded?: boolean;
}

export default function IntelliCoachView({
  initialCourse,
  onLaunchCourse,
  onOpenReadingTab,
  onOpenSlideTab,
  onOpenVideoTab,
  isEmbedded = false,
}: IntelliCoachViewProps) {
  // Active Mode: 'diagnostic' (Interactive Onboarding) vs 'live_tutor' (Free conversational coaching)
  const [activeMode, setActiveMode] = useState<'diagnostic' | 'live_tutor'>('diagnostic');
  const [currentStep, setCurrentStep] = useState<DiagnosticStep>('intro');

  // Student Profile State built dynamically via diagnostics
  const [profile, setProfile] = useState<Partial<DiagnosticAssessmentData>>({
    targetDomain: initialCourse ? initialCourse.title : 'German Language (Goethe / Telc)',
    learnerGoal: '',
    currentProficiency: 'Absolute Beginner (A0)',
    timeCommitment: '8-10 Hours / Week',
    recommendedDepartment: initialCourse?.studiedBy || 'General Student / Lifelong Learner',
    recommendedCefrTier: 'A1 Breakthrough',
    keyMilestones: [
      'Pronunciation, Alphabets & Essential Phonetics',
      'Greetings, Personal Introductions & Numbers',
      'Grammar: Noun Genders (der/die/das) & Verb Conjugations',
      'Conversational Fluency & A1 Certification Practice',
    ],
  });

  // Conversation Dialogue Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [voiceLanguage] = useState<string>(() => localStorage.getItem('ila_active_language') || 'en-US');

  // Voice TTS Integration
  const { isSpeaking, speak, stopAllSpeech } = useVoice();
  const [autoSpeak, setAutoSpeak] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize Diagnostic Conversation
  useEffect(() => {
    if (messages.length === 0) {
      initDiagnosticFlow();
    }
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const initDiagnosticFlow = async () => {
    const welcomeMsg: Message = {
      id: 'msg-welcome-1',
      role: 'assistant',
      text: `👋 **Guten Tag & Welcome!** I am **IntelliCoach™**, your interactive AI master tutor for Ila Academy.\n\nBefore we dive into textbook modules, let's tailor your personalized curriculum track! **Which subject or target language are you aiming to master?**`,
      timestamp: Date.now(),
      step: 'intro',
      suggestedOptions: [
        '🇩🇪 German Language (Goethe / Telc A1-C2)',
        '🇬🇧 IELTS Exam Preparation (Band 7.5+)',
        '🏥 Medical German for Doctors & Nurses (FSP / KP)',
        '💻 Technical IT & Software German',
        '📊 Corporate Enterprise German & Business Communication',
      ],
    };

    setMessages([welcomeMsg]);
    setCurrentStep('intro');

    if (autoSpeak) {
      speak(cleanMarkdownForSpeech(welcomeMsg.text), 'welcome-audio', voiceLanguage);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || isProcessing) return;

    setInputText('');
    const userMsgId = `user-${Date.now()}`;
    const userMsg: Message = {
      id: userMsgId,
      role: 'user',
      text: query,
      timestamp: Date.now(),
      step: currentStep,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsProcessing(true);

    try {
      if (activeMode === 'diagnostic') {
        await processDiagnosticStep(query, updatedMessages);
      } else {
        // Live Free-Form Tutoring Mode
        const conversationHistory = updatedMessages.map((m) => ({
          role: m.role,
          text: m.text,
        }));

        const coachResponse = await askIntelliCoach(query, {
          courseTitle: initialCourse?.title || profile.targetDomain || 'Interactive Masterclass',
          chapterTitle: 'IntelliCoach Interactive Tutoring & Doubt Clearing',
          targetAudience: profile.recommendedDepartment,
          conversationHistory,
        });

        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          text: coachResponse,
          timestamp: Date.now(),
          suggestedOptions: [
            'Simulate an interactive practice conversation',
            'Explain the underlying grammar and rules',
            'Give me 3 diagnostic test questions',
            'How does this apply in real-world professional work?',
          ],
        };

        setMessages((prev) => [...prev, botMsg]);
        if (autoSpeak) {
          speak(cleanMarkdownForSpeech(coachResponse), `audio-${Date.now()}`, voiceLanguage);
        }
      }
    } catch (err) {
      console.error('IntelliCoach message error:', err);
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `I apologize, I encountered a connection glitch. Let me still assist you: Please tell me more about your learning goal or question!`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  const processDiagnosticStep = async (userAnswer: string, history: Message[]) => {
    const cleanAns = userAnswer.toLowerCase();

    if (currentStep === 'intro') {
      // User specified subject/domain
      let detectedDomain = userAnswer;
      if (cleanAns.includes('german') || cleanAns.includes('deutsch')) {
        detectedDomain = 'A1 German Language Course (Goethe & CEFR Standards)';
      } else if (cleanAns.includes('ielts')) {
        detectedDomain = 'IELTS Masterclass (Academic & General)';
      } else if (cleanAns.includes('medic') || cleanAns.includes('nurse') || cleanAns.includes('doctor')) {
        detectedDomain = 'Medical & Clinical German for Healthcare Professionals';
      } else if (cleanAns.includes('it') || cleanAns.includes('software')) {
        detectedDomain = 'Technical German for IT & Software Engineers';
      }

      setProfile((prev) => ({ ...prev, targetDomain: detectedDomain }));
      setCurrentStep('need_analysis');

      const historyFormatted = history.map((m) => ({ role: m.role, text: m.text }));
      const aiResponse = await conductIntelliCoachDiagnostic(
        userAnswer,
        'need_analysis',
        { ...profile, targetDomain: detectedDomain },
        historyFormatted
      );

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: aiResponse,
        timestamp: Date.now(),
        step: 'need_analysis',
        suggestedOptions: [
          '🏥 Healthcare & Nursing Placement (Hospitals / Care Homes)',
          '💼 IT / Engineering Job Relocation & Blue Card',
          '🎓 University Entrance / Master Degree (TestDaF / IELTS)',
          '🛂 Visa Requirement & Family Reunion (Ehegattennachzug)',
          '🌍 General Fluency, Travel & Lifelong Learning',
        ],
      };

      setMessages((prev) => [...prev, botMsg]);
      if (autoSpeak) {
        speak(cleanMarkdownForSpeech(aiResponse), `audio-${Date.now()}`, voiceLanguage);
      }
    } else if (currentStep === 'need_analysis') {
      // User specified track / department need
      let mappedDept = 'General Student / Lifelong Learner';
      let cefr = 'A1 Breakthrough';
      let milestones = [
        'Module 1: Foundations, Greetings & Phonetic Rules',
        'Module 2: Daily Routines, Family & Survival Dialogues',
        'Module 3: Grammar Core: Cases (Nominativ/Akkusativ) & Verbs',
        'Module 4: Exam Readiness & Real-world Simulation',
      ];

      if (cleanAns.includes('health') || cleanAns.includes('nurs') || cleanAns.includes('doctor')) {
        mappedDept = 'Healthcare & Nursing Professional';
        cefr = 'B2 Medical (Fachsprachprüfung)';
        milestones = [
          'Module 1: Patient Anamnese & Clinical Intake Dialogue',
          'Module 2: Medical Terminology, Anatomy & Pharmacology',
          'Module 3: Writing Professional Arztbriefe & Handover Reports',
          'Module 4: Patient Empathy & Clinical Simulation Exam',
        ];
      } else if (cleanAns.includes('it') || cleanAns.includes('engineer') || cleanAns.includes('software')) {
        mappedDept = 'IT & Software Engineering';
        cefr = 'B1/B2 Professional';
        milestones = [
          'Module 1: Agile Standups, Sprint Planning & Tech Terminology',
          'Module 2: Architecture Reviews & Code Documentation',
          'Module 3: Client Meetings, Technical Negotiation & Demos',
          'Module 4: German Tech Workplace Culture & Job Interview Prep',
        ];
      } else if (cleanAns.includes('university') || cleanAns.includes('master') || cleanAns.includes('ielts') || cleanAns.includes('academic')) {
        mappedDept = 'Academic Scholar & University Researcher';
        cefr = 'C1 Academic / Band 8.0';
        milestones = [
          'Module 1: Academic Writing & Complex Syntax Synthesis',
          'Module 2: Research Presentations & Seminar Discourse',
          'Module 3: Graph Analysis, Formal Essay & Argumentation',
          'Module 4: Full-Length Exam Mock Drills & Scoring Rubric',
        ];
      } else if (cleanAns.includes('visa') || cleanAns.includes('family') || cleanAns.includes('reunion')) {
        mappedDept = 'Family Reunion & Settlement Immigrant';
        cefr = 'A1 Goethe Start Deutsch 1';
        milestones = [
          'Module 1: Basic Introductions, Spelling & Essential Contact Data',
          'Module 2: Shopping, Living, Transport & Appointment Booking',
          'Module 3: Official Forms, Short Letters & Email Writing',
          'Module 4: Start Deutsch 1 Speaking & Listening Drills',
        ];
      }

      const updatedProfile: DiagnosticAssessmentData = {
        targetDomain: profile.targetDomain || 'German Language Mastery',
        learnerGoal: userAnswer,
        currentProficiency: 'Calibrated from Diagnostic',
        timeCommitment: '8-10 Hours / Week',
        recommendedDepartment: mappedDept,
        recommendedCefrTier: cefr,
        keyMilestones: milestones,
      };

      setProfile(updatedProfile);
      setCurrentStep('roadmap');

      const historyFormatted = history.map((m) => ({ role: m.role, text: m.text }));
      const aiResponse = await conductIntelliCoachDiagnostic(
        userAnswer,
        'roadmap_synthesis',
        updatedProfile,
        historyFormatted
      );

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: `${aiResponse}\n\n🎯 **Tailored Curriculum Blueprint Synthesized:**\n- **Target Track:** ${updatedProfile.targetDomain}\n- **Recommended Department:** \`${mappedDept}\`\n- **Benchmark Level:** **${cefr}**\n- **Structured Modules:**\n${milestones.map((m, i) => `  ${i + 1}. ${m}`).join('\n')}`,
        timestamp: Date.now(),
        step: 'roadmap',
        roadmapData: updatedProfile,
        suggestedOptions: [
          '🚀 Launch Tailored Course & Open Reading Textbook',
          '📊 Open Slide + AI Masterclass Decks',
          '🎬 Open Studio Video + AI Player',
          '💬 Continue live coaching conversation with IntelliCoach',
        ],
      };

      setMessages((prev) => [...prev, botMsg]);
      if (autoSpeak) {
        speak(cleanMarkdownForSpeech(aiResponse), `audio-${Date.now()}`, voiceLanguage);
      }
    } else if (currentStep === 'roadmap') {
      // User selected action
      if (cleanAns.includes('launch') || cleanAns.includes('reading') || cleanAns.includes('textbook')) {
        handleTriggerLaunch();
      } else if (cleanAns.includes('slide')) {
        if (onOpenSlideTab) onOpenSlideTab();
        else handleTriggerLaunch();
      } else if (cleanAns.includes('video')) {
        if (onOpenVideoTab) onOpenVideoTab();
        else handleTriggerLaunch();
      } else {
        // Switch to general tutoring
        setActiveMode('live_tutor');
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          text: `Great! We are now in **Live Conversational Tutoring Mode**. Feel free to ask any doubt, request grammar practice, or test your speaking skills anytime!`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, botMsg]);
      }
    }
  };

  const handleTriggerLaunch = () => {
    const courseTitle = profile.targetDomain || 'A1 German Language Course with Clear Individual Output';
    const dept = profile.recommendedDepartment || 'General Student / Lifelong Learner';
    const promptQuery = `please create a comprehensive curriculum for ${courseTitle} tailored for ${dept} with clear modular chapters, practical dialogues, and standard CEFR compliance`;

    if (onLaunchCourse) {
      onLaunchCourse(courseTitle, dept, promptQuery);
    } else if (onOpenReadingTab) {
      onOpenReadingTab();
    }
  };

  const toggleVoiceRecording = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      const rec = startListening(
        (transcript, isFinal) => {
          if (transcript) {
            setInputText(transcript);
            if (isFinal) {
              handleSendMessage(transcript);
              setIsListening(false);
            }
          }
        },
        (errorMsg) => {
          console.warn('Voice input error:', errorMsg);
          setIsListening(false);
        },
        () => {
          setIsListening(false);
        },
        voiceLanguage
      );
      if (rec) {
        setIsListening(true);
      }
    }
  };

  const handleResetDiagnostic = () => {
    stopAllSpeech();
    setMessages([]);
    setCurrentStep('intro');
    setActiveMode('diagnostic');
    initDiagnosticFlow();
  };

  return (
    <div
      id="intelli-coach-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: isEmbedded ? '100%' : 'calc(100vh - 58px)',
        minHeight: isEmbedded ? '650px' : 'calc(100vh - 58px)',
        background: 'radial-gradient(ellipse at top right, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.98) 70%)',
        color: 'var(--text-main)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          zIndex: 20,
        }}
      >
        {/* Left: Coach Branding & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <Bot size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
                IntelliCoach™
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '9999px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#34d399',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                AI Mentor & Tutor
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                }}
              />
              <span>Live Diagnostic & Conversational Engine Active</span>
            </div>
          </div>
        </div>

        {/* Center: Stepper Tracker for Diagnostics */}
        {activeMode === 'diagnostic' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {[
              { id: 'intro', num: '1', label: 'Self-Introduction' },
              { id: 'need_analysis', num: '2', label: 'Need Analysis' },
              { id: 'roadmap', num: '3', label: 'Tailored Roadmap' },
              { id: 'ready_to_launch', num: '4', label: 'Launch' },
            ].map((step) => {
              const isCurrent = currentStep === step.id;
              const isPast =
                (step.id === 'intro' && currentStep !== 'intro') ||
                (step.id === 'need_analysis' && (currentStep === 'roadmap' || currentStep === 'ready_to_launch')) ||
                (step.id === 'roadmap' && currentStep === 'ready_to_launch');

              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '9999px',
                    background: isCurrent
                      ? 'rgba(16, 185, 129, 0.25)'
                      : isPast
                      ? 'rgba(99, 102, 241, 0.15)'
                      : 'transparent',
                    border: isCurrent
                      ? '1px solid #10b981'
                      : isPast
                      ? '1px solid rgba(99, 102, 241, 0.3)'
                      : '1px solid transparent',
                    color: isCurrent ? '#34d399' : isPast ? '#818cf8' : 'var(--text-muted)',
                    fontSize: '0.68rem',
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {isPast ? <Check size={10} color="#818cf8" /> : <span>{step.num}.</span>}
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Right: Mode Switcher & Audio Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Mode Switcher */}
          <div
            style={{
              display: 'flex',
              padding: '0.2rem',
              borderRadius: '9999px',
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMode('diagnostic')}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                border: 'none',
                background: activeMode === 'diagnostic' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                color: activeMode === 'diagnostic' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Diagnostic Onboarding
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('live_tutor')}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                border: 'none',
                background: activeMode === 'live_tutor' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'transparent',
                color: activeMode === 'live_tutor' ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Live Tutor
            </button>
          </div>

          {/* Auto Voice Toggle */}
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) stopAllSpeech();
              setAutoSpeak(!autoSpeak);
            }}
            style={{
              padding: '0.35rem 0.55rem',
              borderRadius: '8px',
              background: autoSpeak ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: autoSpeak ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: autoSpeak ? '#34d399' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
            title={autoSpeak ? 'Voice TTS is Enabled' : 'Voice TTS is Muted'}
          >
            {autoSpeak ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span>{autoSpeak ? 'Voice On' : 'Voice Off'}</span>
          </button>

          {/* Reset Stepper */}
          <button
            type="button"
            onClick={handleResetDiagnostic}
            style={{
              padding: '0.35rem 0.55rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.72rem',
            }}
            title="Reset Onboarding Diagnostic"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left: Interactive Dialogue Stream */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            background: 'rgba(10, 15, 29, 0.5)',
          }}
        >
          {/* Messages Scroll Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    gap: '0.75rem',
                    alignSelf: isAssistant ? 'flex-start' : 'flex-end',
                    maxWidth: isAssistant ? '88%' : '75%',
                    flexDirection: isAssistant ? 'row' : 'row-reverse',
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isAssistant
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: isAssistant ? '0 0 12px rgba(16, 185, 129, 0.3)' : '0 0 12px rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    {isAssistant ? <Sparkles size={16} color="#ffffff" /> : <GraduationCap size={16} color="#ffffff" />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      padding: '0.9rem 1.1rem',
                      borderRadius: isAssistant ? '0.2rem 1rem 1rem 1rem' : '1rem 0.2rem 1rem 1rem',
                      background: isAssistant
                        ? 'rgba(15, 23, 42, 0.95)'
                        : 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%)',
                      border: isAssistant
                        ? '1px solid rgba(16, 185, 129, 0.25)'
                        : '1px solid rgba(99, 102, 241, 0.4)',
                      boxShadow: isAssistant ? '0 4px 20px rgba(0, 0, 0, 0.3)' : 'none',
                    }}
                  >
                    <div style={{ fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-main)' }}>
                      <MarkdownRenderer content={msg.text} />
                    </div>

                    {/* Interactive Suggested Response Chips */}
                    {msg.suggestedOptions && msg.suggestedOptions.length > 0 && (
                      <div
                        style={{
                          marginTop: '0.85rem',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.4rem',
                          paddingTop: '0.6rem',
                          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {msg.suggestedOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(opt)}
                            disabled={isProcessing}
                            style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '9999px',
                              background: 'rgba(255, 255, 255, 0.06)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              color: '#a7f3d0',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                              e.currentTarget.style.borderColor = '#10b981';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <span>{opt}</span>
                            <ArrowRight size={11} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {isProcessing && (
              <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start', alignItems: 'center' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Loader2 size={16} color="#34d399" className="animate-spin" />
                </div>
                <div
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: '0.2rem 1rem 1rem 1rem',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    fontSize: '0.78rem',
                    color: '#34d399',
                    fontStyle: 'italic',
                  }}
                >
                  IntelliCoach™ is analyzing your diagnostic response...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div
            style={{
              padding: '0.75rem 1.25rem',
              background: 'rgba(15, 23, 42, 0.95)',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={toggleVoiceRecording}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: isListening ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                border: isListening ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                boxShadow: isListening ? '0 0 15px rgba(239, 68, 68, 0.6)' : 'none',
              }}
              title={isListening ? 'Listening... click to stop' : 'Speak to IntelliCoach via microphone'}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={
                currentStep === 'intro'
                  ? 'Type your target subject or exam (e.g. German A1, IELTS, Medical Terminology)...'
                  : currentStep === 'need_analysis'
                  ? 'Type your goal (e.g. Nursing job in Germany, IT relocation, University)...'
                  : 'Ask IntelliCoach any question or request tailored explanations...'
              }
              style={{
                flex: 1,
                padding: '0.65rem 1rem',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isProcessing || !inputText.trim()}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: isProcessing || !inputText.trim() ? 'not-allowed' : 'pointer',
                opacity: isProcessing || !inputText.trim() ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.3)',
              }}
            >
              <span>Send</span>
              <Send size={13} />
            </button>
          </div>
        </div>

        {/* Right Sidebar: Dynamic Profile Card & Instant Course Launcher */}
        <div
          style={{
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.95)',
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {/* Header Card */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.05) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Compass size={18} color="#34d399" />
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ffffff' }}>
                Diagnostic Blueprint
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              Dynamically adapted through live student diagnostics to match CEFR benchmarks & department needs.
            </p>
          </div>

          {/* Profile Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {/* Target Subject */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Curriculum Focus
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                {profile.targetDomain || 'German Language A1-C2'}
              </div>
            </div>

            {/* Department */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Recommended Department
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a855f7', marginTop: '0.2rem' }}>
                {profile.recommendedDepartment || 'General Student'}
              </div>
            </div>

            {/* Level Tier */}
            <div
              style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '0.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ fontSize: '0.65rem', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Target Benchmark
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
                {profile.recommendedCefrTier || 'A1 Breakthrough'}
              </div>
            </div>
          </div>

          {/* Recommended Learning Pillars */}
          {profile.keyMilestones && profile.keyMilestones.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                Structured Milestone Pillars
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {profile.keyMilestones.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.4rem',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      fontSize: '0.7rem',
                      color: 'var(--text-main)',
                      lineHeight: '1.3',
                    }}
                  >
                    <CheckCircle2 size={12} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{m}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Launcher Buttons */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleTriggerLaunch}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.65rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              <BookOpen size={16} />
              <span>Launch Tailored Course</span>
            </button>

            {onOpenSlideTab && (
              <button
                type="button"
                onClick={onOpenSlideTab}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '0.55rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <Presentation size={14} />
                <span>Open Slide + AI Decks</span>
              </button>
            )}

            {onOpenVideoTab && (
              <button
                type="button"
                onClick={onOpenVideoTab}
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  borderRadius: '0.55rem',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(244, 63, 94, 0.3)',
                  color: '#f43f5e',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <Tv size={14} />
                <span>Open Video + AI Masterclass</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
