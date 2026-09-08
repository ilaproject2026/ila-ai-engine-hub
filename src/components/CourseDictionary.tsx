import { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Sparkles,
  Volume2,
  VolumeX,
  Copy,
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Edit3,
  Plus,
  Trash2,
  X,
  Wand2,
  Presentation,
  Video,
} from 'lucide-react';
import { generateIlaResponse } from '../services/geminiService';
import type { CourseChapter } from '../services/dbService';

export interface DictionaryTerm {
  id: string;
  term: string;
  category: 'core_concept' | 'technical_tcode' | 'standard_framework' | 'syntax_keyword' | 'grammar_vocabulary';
  definition: string;
  exampleOrUsage: string;
  relatedTopic?: string;
}

export interface SubjectQAItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

interface CourseDictionaryProps {
  courseTitle: string;
  chapter: CourseChapter;
  chapterNumber?: number;
  allChapters?: CourseChapter[];
  activeLanguage?: string;
  onOpenReading?: () => void;
  onOpenSlides?: () => void;
  onOpenVideo?: () => void;
  onSpeak?: (text: string, id: string, lang?: string) => void;
  isSpeaking?: boolean;
  activeSpeakingId?: string | null;
  onScriptUpdate?: (updatedContent: string) => void;
}

export default function CourseDictionary({
  courseTitle,
  chapter,
  chapterNumber = 1,
  allChapters = [],
  activeLanguage = 'en-US',
  onOpenReading,
  onOpenSlides,
  onOpenVideo,
  onSpeak,
  isSpeaking,
  activeSpeakingId,
  onScriptUpdate,
}: CourseDictionaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedQAId, setExpandedQAId] = useState<string | null>(null);
  const [isGeneratingMore, setIsGeneratingMore] = useState<boolean>(false);
  const [extraTerms, setExtraTerms] = useState<DictionaryTerm[]>([]);
  const [editingTerm, setEditingTerm] = useState<DictionaryTerm | null>(null);
  const [editTermTitle, setEditTermTitle] = useState<string>('');
  const [editTermDefinition, setEditTermDefinition] = useState<string>('');
  const [editTermExample, setEditTermExample] = useState<string>('');
  const [editTermCategory, setEditTermCategory] = useState<DictionaryTerm['category']>('core_concept');
  const [showAddTermModal, setShowAddTermModal] = useState<boolean>(false);
  const [newTermTitle, setNewTermTitle] = useState<string>('');
  const [newTermDefinition, setNewTermDefinition] = useState<string>('');
  const [newTermExample, setNewTermExample] = useState<string>('');
  const [newTermCategory, setNewTermCategory] = useState<DictionaryTerm['category']>('core_concept');
  const [refiningTermId, setRefiningTermId] = useState<string | null>(null);

  // Dynamically extract terms from the course and chapter content
  const baseTerms: DictionaryTerm[] = useMemo(() => {
    const rawContent = (allChapters.length > 0 ? allChapters.map((c) => c.content).join('\n') : chapter.content) || '';
    const terms: DictionaryTerm[] = [];
    const termSet = new Set<string>();

    // 1. Extract bold terms: **Term**: Definition or **Term** - Definition
    const boldRegex = /\*\*([A-Za-z0-9_\s/-]{2,45})\*\*[:–-]?\s*([^\n*]+)/g;
    let match;
    while ((match = boldRegex.exec(rawContent)) !== null) {
      const termName = match[1].trim();
      const termDef = match[2].trim();

      if (
        termName.length >= 2 &&
        termDef.length >= 15 &&
        !termSet.has(termName.toLowerCase()) &&
        !termName.startsWith('Book ') &&
        !termName.startsWith('Module ') &&
        !termName.startsWith('Step ') &&
        !termName.startsWith('Note') &&
        !termName.startsWith('IMPORTANT')
      ) {
        termSet.add(termName.toLowerCase());

        let category: DictionaryTerm['category'] = 'core_concept';
        if (/\b(ME21N|ME51N|MIGO|MIRO|MM01|BP|VA01|T-Code|CLI|API|SQL|JSON)\b/i.test(termName)) {
          category = 'technical_tcode';
        } else if (/\b(CEFR|Goethe|ISO|NIST|IEEE|ACM|DMI|PMI|WHO|HL7|FHIR)\b/i.test(termName)) {
          category = 'standard_framework';
        } else if (/\b(Akkusativ|Dativ|Nominativ|Grammar|Vocabulary|Verb|Noun)\b/i.test(termName)) {
          category = 'grammar_vocabulary';
        }

        terms.push({
          id: `term_${terms.length + 1}`,
          term: termName,
          category,
          definition: termDef,
          exampleOrUsage: `Applied throughout the ${courseTitle} curriculum and associated practical workflows.`,
          relatedTopic: `Book ${chapterNumber}: ${chapter.title}`,
        });
      }
    }

    // Default terms if extraction was sparse
    if (terms.length < 4) {
      terms.push(
        {
          id: 'term_def_1',
          term: 'Curriculum Benchmarking',
          category: 'standard_framework',
          definition: `The structured pedagogical alignment of course objectives and syllabus depth with authorized international governing bodies.`,
          exampleOrUsage: `Used across all Ila Academy course architectures to guarantee recognized learning roadmaps.`,
          relatedTopic: 'Curriculum Framework',
        },
        {
          id: 'term_def_2',
          term: 'Dual-Layer Architecture',
          category: 'core_concept',
          definition: `The structural separation of concise slide deck presentations from deep explanatory narrative boards for master educators and learners.`,
          exampleOrUsage: `Allows switching between rapid visual consumption and deep theoretical study.`,
          relatedTopic: 'Learning Methodology',
        },
        {
          id: 'term_def_3',
          term: 'Autonomous Decomposition',
          category: 'core_concept',
          definition: `The sequential division of broad masterclass topics into modular 4-book structured roadmaps with embedded labs.`,
          exampleOrUsage: `Executes multi-step curriculum creation with zero manual intervention.`,
          relatedTopic: 'System Pipeline',
        }
      );
    }

    return [...terms, ...extraTerms];
  }, [allChapters, chapter, chapterNumber, courseTitle, extraTerms]);

  // Subject Q&A Reference FAQs
  const qaReferences: SubjectQAItem[] = useMemo(() => {
    return [
      {
        id: 'qa_1',
        question: `What are the core learning objectives of ${courseTitle}?`,
        answer: `The primary objective is to acquire end-to-end conceptual mastery, operational workflow execution, and hands-on validation aligned with international standards in ${courseTitle}.`,
        category: 'Overview',
      },
      {
        id: 'qa_2',
        question: `How should a student best prepare for the Periodic Exam Cycles?`,
        answer: `Review the concise highlights in the Teaching Slides, study the deep narratives in the Explanations Board, and complete the hands-on lab simulation exercises before taking the exam.`,
        category: 'Preparation',
      },
      {
        id: 'qa_3',
        question: `How does the Course Dictionary support real-time study?`,
        answer: `It serves as an instant quick-reference glossary for subject-specific acronyms, system codes, grammar concepts, and definitions without interrupting the masterclass flow.`,
        category: 'Reference',
      },
      {
        id: 'qa_4',
        question: `What is the significance of Book ${chapterNumber}: ${chapter.title}?`,
        answer: `This book anchors fundamental competencies and provides the stepping stone for subsequent specialized modules in ${courseTitle}.`,
        category: 'Curriculum',
      },
    ];
  }, [chapter, chapterNumber, courseTitle]);

  // Filter terms by search & category
  const filteredTerms = useMemo(() => {
    return baseTerms.filter((item) => {
      const matchesSearch =
        !searchTerm.trim() ||
        item.term.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        item.definition.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        item.exampleOrUsage.toLowerCase().includes(searchTerm.toLowerCase().trim());

      const matchesCat = activeCategory === 'all' || item.category === activeCategory;

      return matchesSearch && matchesCat;
    });
  }, [baseTerms, searchTerm, activeCategory]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Generate more domain-specific terms with AI
  const handleGenerateMoreTerms = async () => {
    setIsGeneratingMore(true);
    try {
      const prompt = `You are the Master Terminologist for Ila Academy.
Extract and define 4 specialized domain terms, acronyms, system codes, or technical concepts specifically for the course "${courseTitle}", Book ${chapterNumber}: "${chapter.title}".

Format strictly as JSON:
[
  {
    "term": "Term Name",
    "category": "core_concept",
    "definition": "Precise, exhaustive dictionary definition.",
    "exampleOrUsage": "Real-world context or usage example."
  }
]
Valid categories: "core_concept", "technical_tcode", "standard_framework", "syntax_keyword", "grammar_vocabulary".
Return ONLY valid JSON.`;

      const response = await generateIlaResponse(prompt, []);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const formatted: DictionaryTerm[] = parsed.map((item: any, idx: number) => ({
          id: `term_ai_${Date.now()}_${idx}`,
          term: item.term,
          category: item.category || 'core_concept',
          definition: item.definition,
          exampleOrUsage: item.exampleOrUsage || `Applied in ${courseTitle}.`,
          relatedTopic: `Book ${chapterNumber}`,
        }));
        setExtraTerms((prev) => [...prev, ...formatted]);
        if (onScriptUpdate) {
          const appendedMd = formatted
            .map((ft) => `\n\n**${ft.term}**: ${ft.definition}\n- *Usage*: ${ft.exampleOrUsage}\n`)
            .join('');
          onScriptUpdate(`${chapter.content}${appendedMd}`);
        }
      }
    } catch (err) {
      console.error('Failed to generate extra terms:', err);
    } finally {
      setIsGeneratingMore(false);
    }
  };

  const handleSaveEditedTerm = () => {
    if (!editingTerm || !editTermTitle.trim() || !editTermDefinition.trim()) return;
    const updated: DictionaryTerm = {
      ...editingTerm,
      term: editTermTitle.trim(),
      definition: editTermDefinition.trim(),
      exampleOrUsage: editTermExample.trim() || `Applied in ${courseTitle}.`,
      category: editTermCategory,
    };
    setExtraTerms((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      if (exists) return prev.map((t) => (t.id === updated.id ? updated : t));
      return [...prev, updated];
    });
    if (onScriptUpdate) {
      const md = `\n\n**${updated.term}**: ${updated.definition}\n- *Usage*: ${updated.exampleOrUsage}\n`;
      onScriptUpdate(`${chapter.content}${md}`);
    }
    setEditingTerm(null);
  };

  const handleAddNewCustomTerm = () => {
    if (!newTermTitle.trim() || !newTermDefinition.trim()) return;
    const created: DictionaryTerm = {
      id: `term_custom_${Date.now()}`,
      term: newTermTitle.trim(),
      definition: newTermDefinition.trim(),
      exampleOrUsage: newTermExample.trim() || `Applied in ${courseTitle}.`,
      category: newTermCategory,
      relatedTopic: `Book ${chapterNumber}`,
    };
    setExtraTerms((prev) => [...prev, created]);
    if (onScriptUpdate) {
      const md = `\n\n**${created.term}**: ${created.definition}\n- *Usage*: ${created.exampleOrUsage}\n`;
      onScriptUpdate(`${chapter.content}${md}`);
    }
    setShowAddTermModal(false);
    setNewTermTitle('');
    setNewTermDefinition('');
    setNewTermExample('');
    setNewTermCategory('core_concept');
  };

  const handleRefineTermWithAI = async (term: DictionaryTerm) => {
    setRefiningTermId(term.id);
    try {
      const prompt = `Refine and elaborate on this dictionary definition and usage example for course "${courseTitle}":
Term: "${term.term}"
Current Definition: "${term.definition}"
Current Usage: "${term.exampleOrUsage}"
Return ONLY valid JSON:
{
  "term": "${term.term}",
  "definition": "Clear, accurate, and comprehensive definition",
  "exampleOrUsage": "Real-world professional application example"
}`;
      const res = await generateIlaResponse(prompt, []);
      const match = res.match(/\{[\s\S]*\}/);
      if (match) {
        const p = JSON.parse(match[0]);
        const refined: DictionaryTerm = {
          ...term,
          term: p.term || term.term,
          definition: p.definition || term.definition,
          exampleOrUsage: p.exampleOrUsage || term.exampleOrUsage,
        };
        setExtraTerms((prev) => {
          const exists = prev.some((t) => t.id === term.id);
          if (exists) return prev.map((t) => (t.id === term.id ? refined : t));
          return [...prev, refined];
        });
        if (onScriptUpdate) {
          const md = `\n\n**${refined.term}**: ${refined.definition}\n- *Usage*: ${refined.exampleOrUsage}\n`;
          onScriptUpdate(`${chapter.content}${md}`);
        }
      }
    } catch (err) {
      console.error('Failed to refine dictionary term:', err);
    } finally {
      setRefiningTermId(null);
    }
  };

  const handleDeleteTerm = (termId: string) => {
    setExtraTerms((prev) => prev.filter((t) => t.id !== termId));
  };

  return (
    <div
      id="course-dictionary-view"
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%',
        color: 'var(--text-main)',
      }}
    >
      {/* Top Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(20, 35, 45, 0.9) 0%, rgba(10, 20, 30, 0.95) 100%)',
          border: '1px solid rgba(20, 184, 166, 0.25)',
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
              background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(20, 184, 166, 0.4)',
              flexShrink: 0,
            }}
          >
            <BookOpen size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#2dd4bf',
                  background: 'rgba(20, 184, 166, 0.15)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                }}
              >
                Course Dictionary & Q&A
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                {courseTitle}
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
              Course Dictionary • Terminology, Glossary & Q&A References
            </h2>
          </div>
        </div>

        {/* AI Action */}
        <button
          type="button"
          onClick={handleGenerateMoreTerms}
          disabled={isGeneratingMore}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            height: '36px',
            padding: '0 1rem',
            borderRadius: '9999px',
            background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.3) 0%, rgba(6, 182, 212, 0.3) 100%)',
            border: '1px solid rgba(45, 212, 191, 0.5)',
            color: '#2dd4bf',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: isGeneratingMore ? 'not-allowed' : 'pointer',
            boxShadow: '0 0 12px rgba(20, 184, 166, 0.25)',
          }}
          title="Extract and generate more domain terms with AI"
        >
          {isGeneratingMore ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Extracting Terms...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>Generate Terms with AI</span>
            </>
          )}
        </button>

          <button
            type="button"
            onClick={() => {
              setNewTermTitle('');
              setNewTermDefinition('');
              setNewTermExample('');
              setNewTermCategory('core_concept');
              setShowAddTermModal(true);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '36px',
              padding: '0 1rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(20, 184, 166, 0.35)',
            }}
            title="Add a custom dictionary term"
          >
            <Plus size={13} />
            <span>Add Term</span>
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

      {/* Search & Category Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '1rem',
          padding: '0.85rem 1.25rem',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '0.6rem',
            padding: '0.45rem 0.85rem',
            minWidth: '260px',
            flex: 1,
          }}
        >
          <Search size={14} color="var(--text-subtle)" style={{ marginRight: '0.5rem' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search definitions, acronyms & keywords..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              width: '100%',
              fontSize: '0.84rem',
            }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All Terms' },
            { key: 'core_concept', label: 'Core Concepts' },
            { key: 'technical_tcode', label: 'Technical Codes' },
            { key: 'standard_framework', label: 'Standards' },
            { key: 'grammar_vocabulary', label: 'Vocabulary' },
          ].map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                background:
                  activeCategory === cat.key
                    ? 'rgba(20, 184, 166, 0.25)'
                    : 'rgba(255, 255, 255, 0.04)',
                border:
                  activeCategory === cat.key
                    ? '1px solid rgba(45, 212, 191, 0.5)'
                    : '1px solid var(--border-subtle)',
                color: activeCategory === cat.key ? '#2dd4bf' : 'var(--text-muted)',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dictionary Terms Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filteredTerms.map((t) => (
          <div
            key={t.id}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '1.15rem',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
              boxShadow: '0 8px 20px -5px rgba(0, 0, 0, 0.4)',
              transition: 'all 0.15s ease',
            }}
          >
            <div>
              {/* Term Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '0.25rem',
                    background:
                      t.category === 'technical_tcode'
                        ? 'rgba(168, 85, 247, 0.18)'
                        : t.category === 'standard_framework'
                        ? 'rgba(14, 165, 233, 0.18)'
                        : 'rgba(20, 184, 166, 0.18)',
                    color:
                      t.category === 'technical_tcode'
                        ? '#c084fc'
                        : t.category === 'standard_framework'
                        ? '#38bdf8'
                        : '#2dd4bf',
                  }}
                >
                  {t.category.replace('_', ' ')}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {onSpeak && (
                    <button
                      type="button"
                      onClick={() => onSpeak(`${t.term}. ${t.definition}`, t.id, activeLanguage)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isSpeaking && activeSpeakingId === t.id ? '#2dd4bf' : 'var(--text-subtle)',
                        cursor: 'pointer',
                        padding: '0.2rem',
                      }}
                      title="Pronounce term and definition"
                    >
                      {isSpeaking && activeSpeakingId === t.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopy(`${t.term}: ${t.definition}`, t.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedId === t.id ? '#10b981' : 'var(--text-subtle)',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                    title="Copy definition"
                  >
                    {copiedId === t.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRefineTermWithAI(t)}
                    disabled={refiningTermId === t.id}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#c084fc',
                      cursor: refiningTermId === t.id ? 'not-allowed' : 'pointer',
                      padding: '0.2rem',
                    }}
                    title="Refine term definition with AI"
                  >
                    {refiningTermId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingTerm(t);
                      setEditTermTitle(t.term);
                      setEditTermDefinition(t.definition);
                      setEditTermExample(t.exampleOrUsage);
                      setEditTermCategory(t.category);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                    title="Edit term"
                  >
                    <Edit3 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteTerm(t.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                    title="Delete term"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <h4
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  margin: '0 0 0.4rem 0',
                  letterSpacing: '-0.01em',
                }}
              >
                {t.term}
              </h4>

              <p style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: '1.5', margin: 0 }}>
                {t.definition}
              </p>
            </div>

            {/* Example or usage footnote */}
            {t.exampleOrUsage && (
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingTop: '0.65rem',
                  fontSize: '0.74rem',
                  color: 'var(--text-subtle)',
                  fontStyle: 'italic',
                }}
              >
                💡 {t.exampleOrUsage}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Subject-Specific Q&A References / FAQs Section */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '1.25rem',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <HelpCircle size={18} color="#2dd4bf" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
            Subject-Specific Q&A References & FAQs
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {qaReferences.map((qa) => {
            const isExpanded = expandedQAId === qa.id;
            return (
              <div
                key={qa.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: isExpanded ? '1px solid rgba(45, 212, 191, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  onClick={() => setExpandedQAId(isExpanded ? null : qa.id)}
                  style={{
                    padding: '0.85rem 1.1rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#2dd4bf',
                        background: 'rgba(20, 184, 166, 0.15)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '0.25rem',
                      }}
                    >
                      {qa.category || 'Q&A'}
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                      {qa.question}
                    </span>
                  </div>
                  {isExpanded ? <ChevronUp size={16} color="#2dd4bf" /> : <ChevronDown size={16} color="var(--text-subtle)" />}
                </div>

                {isExpanded && (
                  <div
                    style={{
                      padding: '0 1.1rem 1rem 1.1rem',
                      fontSize: '0.84rem',
                      color: '#cbd5e1',
                      lineHeight: '1.6',
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                      paddingTop: '0.75rem',
                    }}
                  >
                    {qa.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Term Modal */}
      {editingTerm && (
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
              maxWidth: '650px',
              background: '#0d1220',
              border: '1px solid rgba(20, 184, 166, 0.5)',
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
                <Edit3 size={16} color="#2dd4bf" />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Edit Dictionary Term</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingTerm(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Term Name
              </label>
              <input
                type="text"
                value={editTermTitle}
                onChange={(e) => setEditTermTitle(e.target.value)}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Category
              </label>
              <select
                value={editTermCategory}
                onChange={(e) => setEditTermCategory(e.target.value as any)}
                style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="core_concept">Core Concept</option>
                <option value="technical_tcode">Technical Keyword / T-Code</option>
                <option value="standard_framework">Standard Framework</option>
                <option value="syntax_keyword">Syntax / Keyword</option>
                <option value="grammar_vocabulary">Vocabulary / Grammar</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Definition
              </label>
              <textarea
                rows={3}
                value={editTermDefinition}
                onChange={(e) => setEditTermDefinition(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Usage / Real-World Context Example
              </label>
              <textarea
                rows={2}
                value={editTermExample}
                onChange={(e) => setEditTermExample(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setEditingTerm(null)}
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
                onClick={handleSaveEditedTerm}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 12px rgba(20, 184, 166, 0.4)',
                }}
              >
                Save Term
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Term Modal */}
      {showAddTermModal && (
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
              maxWidth: '650px',
              background: '#0d1220',
              border: '1px solid rgba(20, 184, 166, 0.5)',
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
                <Plus size={16} color="#2dd4bf" />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Add New Dictionary Term</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTermModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Term Name
              </label>
              <input
                type="text"
                placeholder="e.g. Master Data Integrity"
                value={newTermTitle}
                onChange={(e) => setNewTermTitle(e.target.value)}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Category
              </label>
              <select
                value={newTermCategory}
                onChange={(e) => setNewTermCategory(e.target.value as any)}
                style={{
                  padding: '0.6rem 0.85rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="core_concept">Core Concept</option>
                <option value="technical_tcode">Technical Keyword / T-Code</option>
                <option value="standard_framework">Standard Framework</option>
                <option value="syntax_keyword">Syntax / Keyword</option>
                <option value="grammar_vocabulary">Vocabulary / Grammar</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Definition
              </label>
              <textarea
                rows={3}
                placeholder="Enter clear, comprehensive dictionary definition..."
                value={newTermDefinition}
                onChange={(e) => setNewTermDefinition(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Usage Example (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Enter practical industry or course context example..."
                value={newTermExample}
                onChange={(e) => setNewTermExample(e.target.value)}
                style={{
                  padding: '0.65rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowAddTermModal(false)}
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
                onClick={handleAddNewCustomTerm}
                disabled={!newTermTitle.trim() || !newTermDefinition.trim()}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background:
                    newTermTitle.trim() && newTermDefinition.trim()
                      ? 'linear-gradient(135deg, #14b8a6, #06b6d4)'
                      : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor:
                    newTermTitle.trim() && newTermDefinition.trim()
                      ? 'pointer'
                      : 'not-allowed',
                }}
              >
                Create Term
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
