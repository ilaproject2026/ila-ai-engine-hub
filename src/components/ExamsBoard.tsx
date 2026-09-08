import { useState, useMemo } from 'react';
import {
  Award,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  FileCheck,
  Loader2,
  Edit3,
  Plus,
  Trash2,
  X,
  Wand2,
  BookOpen,
  Presentation,
  Video,
} from 'lucide-react';
import { generateIlaResponse } from '../services/geminiService';
import type { CourseChapter } from '../services/dbService';

export interface ExamQuestion {
  id: string;
  topicNumber: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  standardAlignment?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
}

interface ExamsBoardProps {
  courseTitle: string;
  chapter: CourseChapter;
  chapterNumber?: number;
  allChapters?: CourseChapter[];
  onOpenReading?: () => void;
  onOpenSlides?: () => void;
  onOpenVideo?: () => void;
  onScriptUpdate?: (updatedContent: string) => void;
}

export default function ExamsBoard({
  courseTitle,
  chapter,
  chapterNumber = 1,
  allChapters: _allChapters = [],
  onOpenReading,
  onOpenSlides,
  onOpenVideo,
  onScriptUpdate,
}: ExamsBoardProps) {
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [isGeneratingExtra, setIsGeneratingExtra] = useState<boolean>(false);
  const [customQuestions, setCustomQuestions] = useState<ExamQuestion[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [editQuestionText, setEditQuestionText] = useState<string>('');
  const [editOptions, setEditOptions] = useState<string[]>(['', '', '', '']);
  const [editCorrectIndex, setEditCorrectIndex] = useState<number>(0);
  const [editExplanation, setEditExplanation] = useState<string>('');
  const [showAddQuestionModal, setShowAddQuestionModal] = useState<boolean>(false);
  const [newQuestionText, setNewQuestionText] = useState<string>('');
  const [newOptions, setNewOptions] = useState<string[]>(['', '', '', '']);
  const [newCorrectIndex, setNewCorrectIndex] = useState<number>(0);
  const [newExplanation, setNewExplanation] = useState<string>('');
  const [refiningQuestionId, setRefiningQuestionId] = useState<string | null>(null);

  // Parse questions from markdown content or generate initial questions
  const parsedQuestions: ExamQuestion[] = useMemo(() => {
    const rawContent = chapter.content || '';
    const lines = rawContent.split('\n');
    const extracted: ExamQuestion[] = [];

    // Look for markdown questions patterns
    let currentQ: { id?: string; question?: string; options?: string[]; correctIndex?: number; explanation?: string } | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const qMatch = line.match(/^(?:###\s*|\*\*\s*|\d+\.\s*)(?:Question|Quiz|Challenge|Assessment)?\s*(\d+)?[:.]?\s*(.+\?)$/i);
      if (qMatch) {
        if (currentQ && currentQ.question && (currentQ.options?.length || 0) >= 2) {
          extracted.push({
            id: currentQ.id || `q_${extracted.length + 1}`,
            topicNumber: `${chapterNumber}.${extracted.length + 1}`,
            question: currentQ.question,
            options: currentQ.options || [],
            correctIndex: currentQ.correctIndex ?? 0,
            explanation: currentQ.explanation || 'Verified correct according to curriculum standards.',
            difficulty: 'Intermediate',
          });
        }
        currentQ = {
          id: `q_parsed_${extracted.length + 1}`,
          question: qMatch[2].trim(),
          options: [],
          correctIndex: 0,
        };
      } else if (currentQ && line.match(/^[-*]\s*([A-D]\))\s*(.+)$/i)) {
        const optMatch = line.match(/^[-*]\s*([A-D]\))\s*(.+)$/i);
        if (optMatch) {
          currentQ.options = currentQ.options || [];
          currentQ.options.push(optMatch[2].trim());
        }
      } else if (currentQ && line.match(/(?:Answer|Correct|Key):\s*([A-D]|\d+)/i)) {
        const ansMatch = line.match(/(?:Answer|Correct|Key):\s*([A-D]|\d+)/i);
        if (ansMatch) {
          const letter = ansMatch[1].toUpperCase();
          const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
          currentQ.correctIndex = letterMap[letter] ?? 0;
        }
      } else if (currentQ && line.match(/(?:Explanation|Rationale):\s*(.+)$/i)) {
        const expMatch = line.match(/(?:Explanation|Rationale):\s*(.+)$/i);
        if (expMatch) {
          currentQ.explanation = expMatch[1].trim();
        }
      }
    }

    const trailingQ = currentQ as { id?: string; question?: string; options?: string[]; correctIndex?: number; explanation?: string } | null;
    if (trailingQ && trailingQ.question && (trailingQ.options?.length || 0) >= 2) {
      extracted.push({
        id: trailingQ.id || `q_${extracted.length + 1}`,
        topicNumber: `${chapterNumber}.${extracted.length + 1}`,
        question: trailingQ.question,
        options: trailingQ.options || [],
        correctIndex: trailingQ.correctIndex ?? 0,
        explanation: trailingQ.explanation || 'Verified correct according to curriculum standards.',
        difficulty: 'Intermediate',
      });
    }

    // Default robust curriculum questions if content didn't have explicit multiple-choice items
    if (extracted.length === 0) {
      const topic1 = chapter.subTopics?.[0]?.title || 'Theoretical Foundations';
      const topic2 = chapter.subTopics?.[1]?.title || 'Operational Workflows';
      const topic3 = chapter.subTopics?.[2]?.title || 'Hands-on Practice';

      extracted.push(
        {
          id: `q_def_${chapterNumber}_1`,
          topicNumber: `${chapterNumber}.1`,
          question: `Which fundamental principle is central to ${topic1} in ${courseTitle}?`,
          options: [
            `Standardizing core data models and authorized architectural guidelines`,
            `Bypassing systematic verification to accelerate ad-hoc deployment`,
            `Treating documentation as optional secondary reference`,
            `Restricting multi-system interoperability without validation`,
          ],
          correctIndex: 0,
          explanation: `In standard curriculum roadmaps for ${courseTitle}, establishing structured data models and governance frameworks is the primary prerequisite.`,
          difficulty: 'Beginner',
          standardAlignment: 'Module 1 Core Competency Standard',
        },
        {
          id: `q_def_${chapterNumber}_2`,
          topicNumber: `${chapterNumber}.2`,
          question: `In operational workflows concerning ${topic2}, what is the critical step before final execution?`,
          options: [
            `Skipping field-level validation to save processing cycles`,
            `Executing comprehensive prerequisite checks and verifying document flow progression`,
            `Manually hardcoding configuration parameters in user profile`,
            `Ignoring audit trail tracking and status change timestamps`,
          ],
          correctIndex: 1,
          explanation: `Systematic operational execution mandates pre-validation and verifying end-to-end document flow integrity.`,
          difficulty: 'Intermediate',
          standardAlignment: 'Workflow Competency Standard',
        },
        {
          id: `q_def_${chapterNumber}_3`,
          topicNumber: `${chapterNumber}.3`,
          question: `When troubleshooting unexpected errors during ${topic3}, what is the recommended protocol?`,
          options: [
            `Delete the existing master records immediately`,
            `Consult system status logs, verify parameter consistency, and apply the standard checklist`,
            `Disable all authorization checks globally`,
            `Restart without analyzing the error code context`,
          ],
          correctIndex: 1,
          explanation: `Professional best practice requires consulting diagnostic logs and following standardized verification checklists.`,
          difficulty: 'Advanced',
          standardAlignment: 'Practical Implementation Standard',
        }
      );
    }

    return [...extracted, ...customQuestions];
  }, [chapter, chapterNumber, courseTitle, customQuestions]);

  // Current active questions list based on selected cycle
  const currentQuestions = parsedQuestions;

  // Calculate score & metrics
  const totalQuestions = currentQuestions.length;
  const answeredCount = Object.keys(userAnswers).length;
  const correctCount = useMemo(() => {
    return currentQuestions.filter((q) => userAnswers[q.id] === q.correctIndex).length;
  }, [currentQuestions, userAnswers]);

  const scorePercentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const isPassed = scorePercentage >= 70;

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    if (submitted) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const handleResetExam = () => {
    setUserAnswers({});
    setSubmitted(false);
  };

  // Generate additional high-impact assessment questions with AI
  const handleGenerateExtraQuestions = async () => {
    setIsGeneratingExtra(true);
    try {
      const prompt = `You are the Master Assessment Director for Ila Academy.
Create 3 high-yield, multiple-choice certification exam questions specifically for the course "${courseTitle}", Book ${chapterNumber}: "${chapter.title}".

Format each question strictly as JSON:
[
  {
    "question": "Clear scenario-based question text?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0,
    "explanation": "Detailed rationale explaining why the correct choice is accurate.",
    "difficulty": "Intermediate",
    "standardAlignment": "Certification Benchmark Standard"
  }
]
Return ONLY valid JSON.`;

      const response = await generateIlaResponse(prompt, []);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const formatted: ExamQuestion[] = parsed.map((item: any, idx: number) => ({
          id: `q_ai_${Date.now()}_${idx}`,
          topicNumber: `${chapterNumber}.${parsedQuestions.length + idx + 1}`,
          question: item.question,
          options: item.options,
          correctIndex: item.correctIndex ?? 0,
          explanation: item.explanation || 'Verified correct.',
          difficulty: item.difficulty || 'Intermediate',
          standardAlignment: item.standardAlignment || 'Ila Academy Standard',
        }));
        setCustomQuestions((prev) => [...prev, ...formatted]);
        if (onScriptUpdate) {
          const appendedMd = formatted
            .map(
              (fq, idx) =>
                `\n\n### Assessment Challenge ${parsedQuestions.length + idx + 1}: ${fq.question}\n- A) ${fq.options[0]}\n- B) ${fq.options[1]}\n- C) ${fq.options[2]}\n- D) ${fq.options[3]}\n- Answer: ${['A', 'B', 'C', 'D'][fq.correctIndex]}\n- Explanation: ${fq.explanation}`
            )
            .join('');
          onScriptUpdate(`${chapter.content}${appendedMd}`);
        }
      }
    } catch (err) {
      console.error('Failed to generate extra questions with AI:', err);
    } finally {
      setIsGeneratingExtra(false);
    }
  };

  const handleSaveEditedQuestion = () => {
    if (!editingQuestion || !editQuestionText.trim()) return;
    const updated: ExamQuestion = {
      ...editingQuestion,
      question: editQuestionText.trim(),
      options: editOptions.filter((o) => o.trim().length > 0),
      correctIndex: editCorrectIndex,
      explanation: editExplanation.trim(),
    };
    setCustomQuestions((prev) => {
      const exists = prev.some((q) => q.id === updated.id);
      if (exists) return prev.map((q) => (q.id === updated.id ? updated : q));
      return [...prev, updated];
    });
    if (onScriptUpdate) {
      const md = `\n\n### Assessment: ${updated.question}\n${updated.options.map((opt, i) => `- ${['A', 'B', 'C', 'D'][i]}) ${opt}`).join('\n')}\n- Answer: ${['A', 'B', 'C', 'D'][updated.correctIndex]}\n- Explanation: ${updated.explanation}`;
      onScriptUpdate(`${chapter.content}${md}`);
    }
    setEditingQuestion(null);
  };

  const handleAddNewCustomQuestion = () => {
    if (!newQuestionText.trim() || newOptions.filter((o) => o.trim()).length < 2) return;
    const created: ExamQuestion = {
      id: `q_custom_${Date.now()}`,
      topicNumber: `${chapterNumber}.${parsedQuestions.length + 1}`,
      question: newQuestionText.trim(),
      options: newOptions.filter((o) => o.trim().length > 0),
      correctIndex: newCorrectIndex,
      explanation: newExplanation.trim() || 'Verified standard competency checkpoint.',
      difficulty: 'Intermediate',
    };
    setCustomQuestions((prev) => [...prev, created]);
    if (onScriptUpdate) {
      const md = `\n\n### Assessment: ${created.question}\n${created.options.map((opt, i) => `- ${['A', 'B', 'C', 'D'][i]}) ${opt}`).join('\n')}\n- Answer: ${['A', 'B', 'C', 'D'][created.correctIndex]}\n- Explanation: ${created.explanation}`;
      onScriptUpdate(`${chapter.content}${md}`);
    }
    setShowAddQuestionModal(false);
    setNewQuestionText('');
    setNewOptions(['', '', '', '']);
    setNewCorrectIndex(0);
    setNewExplanation('');
  };

  const handleRefineQuestionWithAI = async (q: ExamQuestion) => {
    setRefiningQuestionId(q.id);
    try {
      const prompt = `Rewrite and enhance this exam question to make it more rigorous, scenario-based, and educational for course "${courseTitle}":
Question: "${q.question}"
Options: ${q.options.join(', ')}
Return ONLY valid JSON:
{
  "question": "Refined scenario question?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctIndex": 0,
  "explanation": "Rationale"
}`;
      const res = await generateIlaResponse(prompt, []);
      const match = res.match(/\{[\s\S]*\}/);
      if (match) {
        const p = JSON.parse(match[0]);
        const refined: ExamQuestion = {
          ...q,
          question: p.question || q.question,
          options: p.options || q.options,
          correctIndex: p.correctIndex ?? q.correctIndex,
          explanation: p.explanation || q.explanation,
        };
        setCustomQuestions((prev) => {
          const exists = prev.some((item) => item.id === q.id);
          if (exists) return prev.map((item) => (item.id === q.id ? refined : item));
          return [...prev, refined];
        });
        if (onScriptUpdate) {
          const md = `\n\n### Refined Assessment: ${refined.question}\n${refined.options.map((opt, i) => `- ${['A', 'B', 'C', 'D'][i]}) ${opt}`).join('\n')}\n- Answer: ${['A', 'B', 'C', 'D'][refined.correctIndex]}\n- Explanation: ${refined.explanation}`;
          onScriptUpdate(`${chapter.content}${md}`);
        }
      }
    } catch (err) {
      console.error('Failed to refine question:', err);
    } finally {
      setRefiningQuestionId(null);
    }
  };

  const handleDeleteQuestion = (qId: string) => {
    setCustomQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  return (
    <div
      id="exams-board-view"
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%',
        color: 'var(--text-main)',
      }}
    >
      {/* Top Banner & Progress Summary */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 30, 55, 0.9) 0%, rgba(10, 15, 30, 0.95) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '1.25rem',
          padding: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '0.85rem',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(14, 165, 233, 0.4)',
              flexShrink: 0,
            }}
          >
            <Award size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.15)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                }}
              >
                Periodic Examination Board
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                Book {chapterNumber}: {chapter.title}
              </span>
            </div>
            <h2
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0.2rem 0 0 0',
                letterSpacing: '-0.02em',
              }}
            >
              Exams Board • Knowledge Assessment & Progress Tracking
            </h2>
          </div>
        </div>

        {/* Live Metrics Counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.75rem',
              padding: '0.45rem 0.85rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
              Answered
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
              {answeredCount} / {totalQuestions}
            </div>
          </div>

          <div
            style={{
              background: submitted
                ? isPassed
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)'
                : 'rgba(255, 255, 255, 0.04)',
              border: submitted
                ? isPassed
                  ? '1px solid rgba(16, 185, 129, 0.4)'
                  : '1px solid rgba(239, 68, 68, 0.4)'
                : '1px solid var(--border-subtle)',
              borderRadius: '0.75rem',
              padding: '0.45rem 0.85rem',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 600 }}>
              {submitted ? 'Final Score' : 'Target'}
            </div>
            <div
              style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: submitted ? (isPassed ? '#34d399' : '#f87171') : '#38bdf8',
              }}
            >
              {submitted ? `${scorePercentage}%` : '≥ 70%'}
            </div>
          </div>

          {/* AI Generator Button */}
          <button
            type="button"
            onClick={handleGenerateExtraQuestions}
            disabled={isGeneratingExtra}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '36px',
              padding: '0 0.9rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.3) 0%, rgba(99, 102, 241, 0.3) 100%)',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: isGeneratingExtra ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 12px rgba(14, 165, 233, 0.25)',
            }}
            title="Generate 3 additional test questions with AI"
          >
            {isGeneratingExtra ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate Test Questions</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setNewQuestionText('');
              setNewOptions(['', '', '', '']);
              setNewCorrectIndex(0);
              setNewExplanation('');
              setShowAddQuestionModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '36px',
              padding: '0 0.9rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.35)',
            }}
            title="Add a custom exam question"
          >
            <Plus size={13} />
            <span>Add Question</span>
          </button>

          {/* Cross-Module Quick Previews */}
          {onOpenReading && (
            <button
              type="button"
              onClick={onOpenReading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: '36px',
                padding: '0 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                color: '#38bdf8',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Open Reading Mode textbook"
            >
              <BookOpen size={13} />
              <span>Reading Mode</span>
            </button>
          )}

          {onOpenSlides && (
            <button
              type="button"
              onClick={onOpenSlides}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: '36px',
                padding: '0 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(236, 72, 153, 0.15)',
                border: '1px solid rgba(236, 72, 153, 0.35)',
                color: '#f472b6',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Open Teaching Slides"
            >
              <Presentation size={13} />
              <span>Teaching Slides</span>
            </button>
          )}

          {onOpenVideo && (
            <button
              type="button"
              onClick={onOpenVideo}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: '36px',
                padding: '0 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#d8b4fe',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Watch Video sync"
            >
              <Video size={13} />
              <span>Watch Video</span>
            </button>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {currentQuestions.map((q, idx) => {
          const selectedOpt = userAnswers[q.id];
          const isAnswered = selectedOpt !== undefined;
          const isCorrect = isAnswered && selectedOpt === q.correctIndex;

          return (
            <div
              key={q.id}
              style={{
                background: 'var(--bg-card)',
                border: submitted
                  ? isCorrect
                    ? '1.5px solid rgba(16, 185, 129, 0.45)'
                    : '1.5px solid rgba(239, 68, 68, 0.45)'
                  : isAnswered
                  ? '1px solid rgba(99, 102, 241, 0.4)'
                  : '1px solid var(--border-subtle)',
                borderRadius: '1.25rem',
                padding: '1.5rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Question Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
                  <span
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: submitted
                        ? isCorrect
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)'
                        : 'rgba(99, 102, 241, 0.2)',
                      color: submitted ? (isCorrect ? '#34d399' : '#f87171') : '#a5b4fc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
                        Segment {q.topicNumber}
                      </span>
                      {q.difficulty && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.05rem 0.35rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {q.difficulty}
                        </span>
                      )}
                      {q.standardAlignment && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.05rem 0.4rem',
                            borderRadius: '0.25rem',
                            background: 'rgba(14, 165, 233, 0.15)',
                            color: '#38bdf8',
                          }}
                        >
                          {q.standardAlignment}
                        </span>
                      )}
                    </div>
                    <h4
                      style={{
                        fontSize: '1.02rem',
                        fontWeight: 700,
                        color: '#ffffff',
                        lineHeight: '1.4',
                        margin: 0,
                      }}
                    >
                      {q.question}
                    </h4>

                    {/* Question Action Controls (Refine with AI, Edit, Delete) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.45rem' }}>
                      <button
                        type="button"
                        onClick={() => handleRefineQuestionWithAI(q)}
                        disabled={refiningQuestionId === q.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.35rem',
                          background: 'rgba(168, 85, 247, 0.15)',
                          border: '1px solid rgba(168, 85, 247, 0.35)',
                          color: '#c084fc',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: refiningQuestionId === q.id ? 'not-allowed' : 'pointer',
                        }}
                        title="Refine question with AI"
                      >
                        {refiningQuestionId === q.id ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                        <span>Refine with AI</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestion(q);
                          setEditQuestionText(q.question);
                          setEditOptions(q.options.length >= 4 ? [...q.options] : [...q.options, '', '', ''].slice(0, 4));
                          setEditCorrectIndex(q.correctIndex);
                          setEditExplanation(q.explanation);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.35rem',
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.35)',
                          color: '#7dd3fc',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Directly edit question and answer choices"
                      >
                        <Edit3 size={11} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.35rem',
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          color: '#f87171',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Delete question"
                      >
                        <Trash2 size={11} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {submitted && (
                  <div>
                    {isCorrect ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '9999px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <CheckCircle2 size={13} /> Correct
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '9999px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        <XCircle size={13} /> Incorrect
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Options Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.65rem' }}>
                {q.options.map((opt, optIdx) => {
                  const isSelected = selectedOpt === optIdx;
                  const isRightOption = submitted && optIdx === q.correctIndex;
                  const isWrongSelected = submitted && isSelected && !isRightOption;

                  let optBg = 'rgba(255, 255, 255, 0.02)';
                  let optBorder = '1px solid rgba(255, 255, 255, 0.08)';
                  let optColor = 'var(--text-main)';

                  if (submitted) {
                    if (isRightOption) {
                      optBg = 'rgba(16, 185, 129, 0.2)';
                      optBorder = '1.5px solid #10b981';
                      optColor = '#34d399';
                    } else if (isWrongSelected) {
                      optBg = 'rgba(239, 68, 68, 0.2)';
                      optBorder = '1.5px solid #ef4444';
                      optColor = '#f87171';
                    }
                  } else if (isSelected) {
                    optBg = 'rgba(99, 102, 241, 0.25)';
                    optBorder = '1.5px solid #818cf8';
                    optColor = '#ffffff';
                  }

                  const optLetter = String.fromCharCode(65 + optIdx);

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(q.id, optIdx)}
                      disabled={submitted}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        background: optBg,
                        border: optBorder,
                        color: optColor,
                        fontSize: '0.86rem',
                        textAlign: 'left',
                        cursor: submitted ? 'default' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '0.4rem',
                          background: isSelected || isRightOption ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {optLetter}
                      </span>
                      <span style={{ lineHeight: '1.35', flex: 1 }}>{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Rationale & Explanation upon Submission */}
              {submitted && q.explanation && (
                <div
                  style={{
                    background: 'rgba(56, 189, 248, 0.06)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    borderRadius: '0.75rem',
                    padding: '0.85rem 1.1rem',
                    fontSize: '0.82rem',
                    color: '#e0f2fe',
                    lineHeight: '1.5',
                  }}
                >
                  <strong style={{ color: '#38bdf8', marginRight: '0.35rem' }}>Rationale & Answer Key:</strong>
                  <span>{q.explanation}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submission Footer Bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '1.25rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ fontSize: '0.84rem', color: 'var(--text-subtle)' }}>
          {submitted ? (
            <span>
              Test Cycle Complete • Final Score: <strong style={{ color: isPassed ? '#34d399' : '#f87171' }}>{scorePercentage}%</strong> ({correctCount}/{totalQuestions} correct)
            </span>
          ) : (
            <span>
              Answered <strong>{answeredCount}</strong> of <strong>{totalQuestions}</strong> questions
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {submitted ? (
            <button
              type="button"
              onClick={handleResetExam}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.6rem 1.25rem',
                borderRadius: '0.6rem',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={14} />
              <span>Retake Exam</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              disabled={answeredCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.6rem 1.5rem',
                borderRadius: '0.6rem',
                background:
                  answeredCount === 0
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: answeredCount === 0 ? 'not-allowed' : 'pointer',
                opacity: answeredCount === 0 ? 0.5 : 1,
                boxShadow: answeredCount > 0 ? '0 0 15px rgba(14, 165, 233, 0.4)' : 'none',
              }}
            >
              <FileCheck size={15} />
              <span>Submit & Grade Exam</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Question Modal */}
      {editingQuestion && (
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
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
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
                <Edit3 size={16} color="#38bdf8" />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Edit Assessment Question</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Question Text
              </label>
              <textarea
                rows={3}
                value={editQuestionText}
                onChange={(e) => setEditQuestionText(e.target.value)}
                style={{
                  padding: '0.75rem',
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
                Answer Choices (Select the correct radio option)
              </label>
              {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="editCorrectOpt"
                    checked={editCorrectIndex === optIdx}
                    onChange={() => setEditCorrectIndex(optIdx)}
                    style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', width: '20px' }}>
                    {letter})
                  </span>
                  <input
                    type="text"
                    value={editOptions[optIdx] || ''}
                    onChange={(e) => {
                      const updated = [...editOptions];
                      updated[optIdx] = e.target.value;
                      setEditOptions(updated);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(5, 8, 16, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Explanation / Rationale
              </label>
              <textarea
                rows={3}
                value={editExplanation}
                onChange={(e) => setEditExplanation(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setEditingQuestion(null)}
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
                onClick={handleSaveEditedQuestion}
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
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Question Modal */}
      {showAddQuestionModal && (
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
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
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
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Add New Exam Question</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQuestionModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Question Text
              </label>
              <textarea
                rows={3}
                placeholder="Enter scenario or conceptual question..."
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                style={{
                  padding: '0.75rem',
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
                Answer Choices (Select the correct radio option)
              </label>
              {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="newCorrectOpt"
                    checked={newCorrectIndex === optIdx}
                    onChange={() => setNewCorrectIndex(optIdx)}
                    style={{ cursor: 'pointer', accentColor: '#38bdf8' }}
                  />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8', width: '20px' }}>
                    {letter})
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${letter}`}
                    value={newOptions[optIdx] || ''}
                    onChange={(e) => {
                      const updated = [...newOptions];
                      updated[optIdx] = e.target.value;
                      setNewOptions(updated);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(5, 8, 16, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Explanation / Rationale
              </label>
              <textarea
                rows={3}
                placeholder="Explain why the selected option is correct according to standards..."
                value={newExplanation}
                onChange={(e) => setNewExplanation(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowAddQuestionModal(false)}
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
                onClick={handleAddNewCustomQuestion}
                disabled={!newQuestionText.trim() || newOptions.filter((o) => o.trim()).length < 2}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background:
                    newQuestionText.trim() && newOptions.filter((o) => o.trim()).length >= 2
                      ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                      : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor:
                    newQuestionText.trim() && newOptions.filter((o) => o.trim()).length >= 2
                      ? 'pointer'
                      : 'not-allowed',
                }}
              >
                Create Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
