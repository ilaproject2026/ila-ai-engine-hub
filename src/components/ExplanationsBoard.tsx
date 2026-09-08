import { useState, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Search,
  Presentation,
  Video,
  Lightbulb,
  GraduationCap,
  Wand2,
  Loader2,
  Edit3,
  Plus,
  X,
} from 'lucide-react';
import { generateIlaResponse } from '../services/geminiService';
import type { CourseChapter } from '../services/dbService';

interface ExplanationItem {
  id: string;
  topicNumber: string;
  topicTitle: string;
  slideSummary: string[];
  keyTakeaway: string;
  explanatoryNarrative: string;
  teachingTips: string[];
  suggestedQuestions: string[];
  visualCue?: string;
}

interface ExplanationsBoardProps {
  courseTitle: string;
  chapter: CourseChapter;
  chapterNumber?: number;
  activeLanguage?: string;
  targetAudience?: string;
  isStudentMode?: boolean;
  onOpenReading?: () => void;
  onOpenSlides?: () => void;
  onOpenVideo?: (topicNumber?: string) => void;
  onSpeak?: (text: string, id: string, lang?: string) => void;
  isSpeaking?: boolean;
  activeSpeakingId?: string | null;
  onScriptUpdate?: (updatedContent: string) => void;
}

export default function ExplanationsBoard({
  courseTitle,
  chapter,
  chapterNumber = 1,
  activeLanguage = 'en-US',
  targetAudience,
  isStudentMode = false,
  onOpenReading,
  onOpenSlides,
  onOpenVideo,
  onSpeak,
  isSpeaking,
  activeSpeakingId,
  onScriptUpdate,
}: ExplanationsBoardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeItemIndex, setActiveItemIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandingId, setExpandingId] = useState<string | null>(null);
  const [expandedNarratives, setExpandedNarratives] = useState<Record<string, string>>({});
  const [editingItem, setEditingItem] = useState<ExplanationItem | null>(null);
  const [editedNarrativeText, setEditedNarrativeText] = useState<string>('');
  const [showAddTopicModal, setShowAddTopicModal] = useState<boolean>(false);
  const [newTopicTitle, setNewTopicTitle] = useState<string>('');
  const [newTopicNarrative, setNewTopicNarrative] = useState<string>('');

  // Parse markdown content into structured deep pedagogical explanation segments
  const explanationItems: ExplanationItem[] = useMemo(() => {
    const rawContent = chapter.content || '';
    const lines = rawContent.split('\n');
    const items: ExplanationItem[] = [];

    // Helper to find a section block between headings
    const findSectionBlock = (titleSnippet: string): string => {
      const cleanSnippet = titleSnippet.toLowerCase().replace(/[^a-z0-9]/g, '');
      let startIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        const lineClean = lines[i].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lines[i].startsWith('#') && lineClean.includes(cleanSnippet)) {
          startIndex = i + 1;
          break;
        }
      }
      if (startIndex === -1) return '';
      let endIndex = lines.length;
      for (let j = startIndex; j < lines.length; j++) {
        if (lines[j].startsWith('## ') || lines[j].startsWith('# ')) {
          endIndex = j;
          break;
        }
      }
      return lines.slice(startIndex, endIndex).join('\n').trim();
    };

    // Strategy 1: Map from subTopics if available
    if (chapter.subTopics && chapter.subTopics.length > 0) {
      chapter.subTopics.forEach((st, idx) => {
        const stNum = st.topicNumber || `${chapterNumber}.${idx + 1}`;
        const stTitle = st.title;
        const matchedBlock = findSectionBlock(stTitle);

        // Extract deep paragraphs
        const relevantParagraphs = (matchedBlock || rawContent)
          .split('\n')
          .filter(
            (l) =>
              l.trim().length > 20 &&
              !l.startsWith('#') &&
              !l.startsWith('|') &&
              !l.startsWith('```') &&
              !l.startsWith('!')
          );

        const narrativeText =
          matchedBlock && matchedBlock.length > 80
            ? matchedBlock
            : relevantParagraphs.length > 0
            ? relevantParagraphs.slice(0, 5).join('\n\n')
            : `### Comprehensive Educational Breakdown: ${stTitle}\n\nThis foundational module delves into ${stTitle} within ${courseTitle}. It establishes the underlying architecture, governing principles, and standard implementation practices required for enterprise mastery.\n\n#### Key Architectural Principles\n1. **Core Mechanism**: Standardized workflow execution and state governance.\n2. **Practical Application**: Real-world integration models tailored for high-reliability environments.\n3. **Quality & Compliance**: Continuous verification and domain assessment alignment.`;

        items.push({
          id: `exp_${st.id || idx}`,
          topicNumber: stNum,
          topicTitle: stTitle,
          slideSummary: [
            `Core architectural model and foundational mechanisms of ${stTitle}`,
            `Enterprise implementation standards and governance compliance`,
            `Hands-on operational execution with step-by-step verification`,
            `Edge-case mitigation, troubleshooting procedures, and performance optimization`,
          ],
          keyTakeaway: `Deep mastery of ${stTitle} ensures end-to-end competency and strict compliance with recognized industry benchmarks in ${courseTitle}.`,
          explanatoryNarrative: narrativeText,
          teachingTips: [
            `Ground students with a tangible domain scenario before exploring underlying architectural abstractions.`,
            `Demonstrate the step-by-step workflow with live input/output examples to reinforce understanding.`,
            `Highlight critical error modes, common misconception traps, and recommended remediation checklists.`,
            `Conduct quick comprehension checkpoints before advancing to subsequent dependent modules.`,
          ],
          suggestedQuestions: [
            `What is the primary architectural driver and purpose of ${stTitle}?`,
            `How does this mechanism integrate with surrounding workflows across ${courseTitle}?`,
            `What are the most frequent operational failure modes and how are they prevented?`,
          ],
          visualCue: `Architectural topology diagram, state flow chart, and practical workflow schematic for ${stTitle}`,
        });
      });
    }

    // Strategy 2: Fallback extraction from H2 / H3 headers if no subtopics
    if (items.length === 0) {
      const headers = lines
        .map((l, i) => ({ text: l.trim(), lineIdx: i }))
        .filter((h) => h.text.startsWith('## ') || h.text.startsWith('### '));

      if (headers.length > 0) {
        headers.forEach((h, idx) => {
          const title = h.text.replace(/^#+\s*/, '');
          const nextHeaderIdx = headers[idx + 1]?.lineIdx || lines.length;
          const sectionLines = lines.slice(h.lineIdx + 1, nextHeaderIdx);
          const bodyText = sectionLines.join('\n').trim();

          items.push({
            id: `exp_h_${idx}`,
            topicNumber: `${chapterNumber}.${idx + 1}`,
            topicTitle: title,
            slideSummary: [
              `Core principles and structural framework of ${title}`,
              `Standard best practices, operational workflows, and execution`,
              `Verification protocols, assessment criteria, and quality standards`,
              `Optimization strategies for real-world deployment`,
            ],
            keyTakeaway: `Mastering ${title} establishes essential domain competency aligned with ${courseTitle} curriculum standards.`,
            explanatoryNarrative:
              bodyText && bodyText.length > 50
                ? bodyText
                : `### In-Depth Teaching Narrative: ${title}\n\nThis lesson explores ${title} comprehensively, focusing on underlying mechanisms, practical deployment methods, and standardized verification techniques for ${courseTitle}.`,
            teachingTips: [
              `Connect this lesson directly to preceding topics to establish continuity.`,
              `Utilize hands-on code or workflow demonstrations to ground theoretical concepts.`,
              `Emphasize domain best practices and common pitfalls to avoid during practical execution.`,
            ],
            suggestedQuestions: [
              `How does ${title} solve standard operational challenges in this domain?`,
              `What criteria should be used to evaluate successful execution of this concept?`,
            ],
            visualCue: `Conceptual overview, workflow model, and architectural diagram for ${title}`,
          });
        });
      }
    }

    // Default item if content was minimal
    if (items.length === 0) {
      items.push({
        id: 'exp_default',
        topicNumber: `${chapterNumber}.1`,
        topicTitle: chapter.title || 'Core Curriculum Foundations',
        slideSummary: [
          'Foundational domain mechanisms and architecture',
          'Standard operational workflow execution',
          'Hands-on lab integration and case studies',
          'Assessment benchmarks and compliance standards',
        ],
        keyTakeaway: 'Mastering foundational concepts enables seamless progression to advanced modules.',
        explanatoryNarrative:
          chapter.content ||
          `Detailed comprehensive explanatory teaching notes and masterclass lectures for ${courseTitle}.`,
        teachingTips: [
          'Review prerequisite concepts before beginning this module.',
          'Encourage learners to complete hands-on lab exercises for retention.',
        ],
        suggestedQuestions: [
          'What are the core fundamentals and architectural foundations of this topic?',
        ],
      });
    }

    return items;
  }, [chapter, chapterNumber, courseTitle]);

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return explanationItems;
    const term = searchTerm.toLowerCase().trim();
    return explanationItems.filter(
      (item) =>
        item.topicTitle.toLowerCase().includes(term) ||
        item.topicNumber.includes(term) ||
        item.explanatoryNarrative.toLowerCase().includes(term)
    );
  }, [explanationItems, searchTerm]);

  const activeItem = filteredItems[activeItemIndex] || filteredItems[0] || explanationItems[0];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // AI-Powered Deeper Teaching Narrative Expansion
  const handleExpandWithAI = async (item: ExplanationItem) => {
    setExpandingId(item.id);
    try {
      const audienceClause = targetAudience
        ? `\nTARGET AUDIENCE / STUDIED BY: ${targetAudience}\nAdapt all pedagogical analogies, examples, and teacher tips specifically to suit a learner background of: ${targetAudience}.`
        : '';

      const prompt = `You are the Master Educator, Senior Curriculum Architect, and Lead Instructor for Ila Academy.
Provide an exhaustive, textbook-grade Masterclass Teaching Script and deep pedagogical explanation for the lesson topic "${item.topicNumber}: ${item.topicTitle}" in the course "${courseTitle}".
${audienceClause}

CRITICAL PEDAGOGICAL REQUIREMENTS:
1. **Underlying Architecture & Foundational Theory**: Explain the fundamental mechanisms, core data structures, state models, and reasons why this concept exists.
2. **Step-by-Step Technical Breakdown**: Walk through the operational execution flow from input to output with clear examples.
3. **Memorable Domain Analogy**: Provide an intuitive, domain-accurate analogy tailored specifically for ${targetAudience || 'students'}.
4. **Hands-On Real-World Scenario**: Provide a concrete scenario or enterprise case study illustrating practical deployment.
5. **Common Pitfalls & Misconceptions**: Identify critical traps or failure modes and specify exact remediation checklists.
6. **Key Takeaways & Teaching Tips**: Summarize essential principles for instructors delivering this module.

Format with clear Markdown headers, bold highlights, code blocks (if applicable), and bulleted checklists. Make this an authoritative, complete lesson narrative (400-700 words) that serves as the definitive teaching script.`;

      const response = await generateIlaResponse(prompt, [], [], undefined, targetAudience);
      if (response && response.trim()) {
        setExpandedNarratives((prev) => ({
          ...prev,
          [item.id]: response.trim(),
        }));
        if (onScriptUpdate) {
          const updated = chapter.content
            ? `${chapter.content}\n\n### Masterclass Teaching Notes: ${item.topicTitle}\n${response.trim()}`
            : response.trim();
          onScriptUpdate(updated);
        }
      }
    } catch (err) {
      console.error('Failed to expand narrative with AI:', err);
    } finally {
      setExpandingId(null);
    }
  };

  const handleSaveEditedNarrative = () => {
    if (!editingItem || !editedNarrativeText.trim()) return;
    setExpandedNarratives((prev) => ({
      ...prev,
      [editingItem.id]: editedNarrativeText.trim(),
    }));
    if (onScriptUpdate) {
      const updated = `${chapter.content}\n\n### ${editingItem.topicTitle}\n${editedNarrativeText.trim()}`;
      onScriptUpdate(updated);
    }
    setEditingItem(null);
  };

  const handleAddNewTopic = () => {
    if (!newTopicTitle.trim()) return;
    const newNum = `${chapterNumber}.${explanationItems.length + 1}`;
    const narrative =
      newTopicNarrative.trim() ||
      `### In-Depth Pedagogical Breakdown: ${newTopicTitle.trim()}\n\nComprehensive exploration of ${newTopicTitle.trim()} covering core theoretical foundations, implementation workflows, and practical applications within ${courseTitle}.`;
    if (onScriptUpdate) {
      const updated = `${chapter.content}\n\n### Topic ${newNum}: ${newTopicTitle.trim()}\n${narrative}`;
      onScriptUpdate(updated);
    }
    setShowAddTopicModal(false);
    setNewTopicTitle('');
    setNewTopicNarrative('');
  };

  return (
    <div
      id="explanations-board-view"
      className="animate-fade-in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        width: '100%',
        minHeight: '100%',
        overflowY: 'visible',
        color: 'var(--text-main)',
      }}
    >
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)',
          border: '1px solid rgba(129, 140, 248, 0.25)',
          borderRadius: '1.25rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)',
              flexShrink: 0,
            }}
          >
            <GraduationCap size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#818cf8',
                  background: 'rgba(99, 102, 241, 0.15)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                }}
              >
                Teacher & Master Educator Layer
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                Book {chapterNumber}: {chapter.title}
              </span>
            </div>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0.2rem 0 0 0',
                letterSpacing: '-0.02em',
              }}
            >
              Explanations Board • Deep Teaching Narratives
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onOpenReading && (
            <button
              type="button"
              onClick={onOpenReading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
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
                padding: '0.45rem 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(236, 72, 153, 0.15)',
                border: '1px solid rgba(236, 72, 153, 0.35)',
                color: '#f472b6',
                fontSize: '0.76rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Presentation size={13} />
              <span>Teaching Slides</span>
            </button>
          )}

          {onOpenVideo && (
            <button
              type="button"
              onClick={() => onOpenVideo(activeItem?.topicNumber)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '9999px',
                background: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                color: '#d8b4fe',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Video size={13} />
              <span>Watch Video Sync</span>
            </button>
          )}

          {!isStudentMode && (
            <button
              type="button"
              onClick={() => setShowAddTopicModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(236, 72, 153, 0.35)',
              }}
            >
              <Plus size={13} />
              <span>Add Topic</span>
            </button>
          )}
        </div>
      </div>

      {/* Dual-Layer Workspace Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: '1.25rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Lesson Topics & Slide Deck Summary */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '1.25rem',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.6rem',
              padding: '0.4rem 0.75rem',
              fontSize: '0.8rem',
            }}
          >
            <Search size={14} color="var(--text-subtle)" style={{ marginRight: '0.5rem' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter topics & concepts..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ffffff',
                width: '100%',
                fontSize: '0.8rem',
              }}
            />
          </div>

          {/* Topics List Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', maxHeight: '550px', overflowY: 'auto' }}>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: 'var(--text-subtle)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                paddingLeft: '0.25rem',
              }}
            >
              Slide Topics ({filteredItems.length})
            </div>

            {filteredItems.map((item, idx) => {
              const isActive = activeItem?.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveItemIndex(idx)}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: '0.75rem',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.18) 100%)'
                      : 'rgba(255, 255, 255, 0.02)',
                    border: isActive
                      ? '1px solid rgba(129, 140, 248, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: isActive ? '#a5b4fc' : 'var(--text-subtle)',
                      }}
                    >
                      Slide Segment {item.topicNumber}
                    </span>
                    {isActive && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#818cf8',
                          boxShadow: '0 0 8px #818cf8',
                        }}
                      />
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: isActive ? 700 : 600,
                      color: isActive ? '#ffffff' : 'var(--text-main)',
                      lineHeight: '1.3',
                    }}
                  >
                    {item.topicTitle}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Deep Explanatory Teaching Narrative & Pedagogical Breakdown */}
        {activeItem && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {/* Primary Explanation Card */}
            <div
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '1.25rem',
                padding: '1.75rem',
                boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.5rem',
                        borderRadius: '0.35rem',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                      }}
                    >
                      Topic {activeItem.topicNumber}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                      Dual-Layer Sync Alignment
                    </span>
                  </div>
                  <h3
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      color: '#ffffff',
                      letterSpacing: '-0.02em',
                      margin: 0,
                    }}
                  >
                    {activeItem.topicTitle}
                  </h3>
                </div>

                {/* Top Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {onSpeak && (
                    <button
                      type="button"
                      onClick={() =>
                        onSpeak(
                          expandedNarratives[activeItem.id] || activeItem.explanatoryNarrative,
                          activeItem.id,
                          activeLanguage
                        )
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.35rem 0.65rem',
                        borderRadius: '0.4rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        color: isSpeaking && activeSpeakingId === activeItem.id ? '#34d399' : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                      title="Listen to teaching narrative"
                    >
                      {isSpeaking && activeSpeakingId === activeItem.id ? <VolumeX size={13} /> : <Volume2 size={13} />}
                      <span>{isSpeaking && activeSpeakingId === activeItem.id ? 'Stop Narration' : 'Narrate'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(
                        expandedNarratives[activeItem.id] || activeItem.explanatoryNarrative,
                        activeItem.id
                      )
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                    title="Copy explanation"
                  >
                    {copiedId === activeItem.id ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                    <span>{copiedId === activeItem.id ? 'Copied' : 'Copy'}</span>
                  </button>

                  {!isStudentMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(activeItem);
                          setEditedNarrativeText(expandedNarratives[activeItem.id] || activeItem.explanatoryNarrative);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.4rem',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid rgba(56, 189, 248, 0.4)',
                          color: '#7dd3fc',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Directly edit this topic's narrative"
                      >
                        <Edit3 size={13} />
                        <span>Edit Topic</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExpandWithAI(activeItem)}
                        disabled={expandingId === activeItem.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '0.4rem',
                          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(99, 102, 241, 0.3) 100%)',
                          border: '1px solid rgba(168, 85, 247, 0.5)',
                          color: '#d8b4fe',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: expandingId === activeItem.id ? 'not-allowed' : 'pointer',
                          boxShadow: '0 0 10px rgba(168, 85, 247, 0.2)',
                        }}
                        title="Expand with rich AI pedagogical narrative & analogies"
                      >
                        {expandingId === activeItem.id ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Expanding...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 size={13} />
                            <span>Refine with AI</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Layer 1 (Slide Deck View Summary) */}
              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.18)',
                  borderRadius: '0.85rem',
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <Presentation size={14} color="#818cf8" />
                  <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase' }}>
                    Slide Deck Highlights (Layer 1)
                  </span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {activeItem.slideSummary.map((bullet, bIdx) => (
                    <li key={bIdx} style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: '1.4' }}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Layer 2 (Rich Explanatory Teaching Narrative) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <BookOpen size={15} color="#38bdf8" />
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', margin: 0 }}>
                    Explanatory Teaching Narrative (Layer 2)
                  </h4>
                </div>

                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '0.85rem',
                    padding: '1.25rem',
                    fontSize: '0.92rem',
                    lineHeight: '1.7',
                    color: '#f1f5f9',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {expandedNarratives[activeItem.id] || activeItem.explanatoryNarrative}
                </div>
              </div>

              {/* Pedagogical Instructor Guidance & Question Touchpoints */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1rem',
                  paddingTop: '0.5rem',
                }}
              >
                {/* Teaching Tips */}
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.06)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '0.85rem',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <Lightbulb size={14} color="#34d399" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                      Instructor Delivery Tips
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {activeItem.teachingTips.map((tip, tIdx) => (
                      <li key={tIdx} style={{ fontSize: '0.8rem', color: '#d1fae5', lineHeight: '1.4' }}>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* In-Class Checks for Understanding */}
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.06)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '0.85rem',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <Sparkles size={14} color="#fbbf24" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                      Checks for Understanding
                    </span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {activeItem.suggestedQuestions.map((q, qIdx) => (
                      <li key={qIdx} style={{ fontSize: '0.8rem', color: '#fef3c7', lineHeight: '1.4' }}>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Narrative Modal */}
      {editingItem && (
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
              maxWidth: '750px',
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
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  Edit Topic {editingItem.topicNumber}: {editingItem.topicTitle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Pedagogical Narrative Script
              </label>
              <textarea
                rows={9}
                value={editedNarrativeText}
                onChange={(e) => setEditedNarrativeText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
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
                onClick={handleSaveEditedNarrative}
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
                Save Topic Narrative
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Topic Modal */}
      {showAddTopicModal && (
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
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Add New Lesson Topic</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTopicModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Topic Title
              </label>
              <input
                type="text"
                placeholder="e.g. Advanced Fault Recovery & Incident Mitigation"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                Initial Explanation Narrative
              </label>
              <textarea
                rows={6}
                placeholder="Describe the underlying mechanism, practical usage, and real-world analogy..."
                value={newTopicNarrative}
                onChange={(e) => setNewTopicNarrative(e.target.value)}
                style={{
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(5, 8, 16, 0.95)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowAddTopicModal(false)}
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
                onClick={handleAddNewTopic}
                disabled={!newTopicTitle.trim()}
                style={{
                  padding: '0.45rem 1.25rem',
                  borderRadius: '0.5rem',
                  background: newTopicTitle.trim() ? 'linear-gradient(135deg, #6366f1, #a855f7)' : 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  cursor: newTopicTitle.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Create Topic
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
