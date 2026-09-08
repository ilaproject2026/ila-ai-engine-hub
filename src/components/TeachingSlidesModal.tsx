import { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Download,
  FileCode,
  Layers,
  Award,
  Code2,
  Server,
  CheckCircle2,
  Plus,
  Video,
  Sparkles,
} from 'lucide-react';
import { speakText, stopSpeaking } from '../services/speechService';
import { detectStandardCurriculum } from '../services/curriculumStandardService';
import { extractMarkdownImages } from '../services/masterclassVideoService';

export interface TeachingSlide {
  id: string;
  slideNumber: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  bullets: string[];
  keyTakeaway: string;
  speakerNotes: string;
  slideType?: 'standard' | 'code' | 'sap_layout' | 'table' | 'lab';
  customHtmlOrMd?: string;
  codeSnippet?: {
    language: string;
    code: string;
    description?: string;
  };
  sapLayout?: {
    tcode: string;
    screenTitle: string;
    menuPath: string;
    fields: Array<{ name: string; required: boolean; desc: string }>;
    imageUrl?: string;
  };
  tableData?: {
    headers: string[];
    rows: string[][];
  };
}

interface TeachingSlidesModalProps {
  courseTitle: string;
  chapterTitle: string;
  chapterNumber?: number;
  chapterContent: string;
  activeLanguage?: string;
  activeVoiceProfile?: string;
  onClose: () => void;
  onOpenInVideo?: () => void;
}

/**
 * Extracts structured presentation-ready teaching slides with visual technical reference modules from markdown
 */
function generateTeachingSlidesFromContent(
  courseTitle: string,
  chapterTitle: string,
  chapterNumber: number = 1,
  content: string
): TeachingSlide[] {
  const standardInfo = detectStandardCurriculum(courseTitle, content);
  const images = extractMarkdownImages(content);

  const lines = content.split('\n');
  const headers = lines.filter((l) => l.startsWith('#')).map((l) => l.replace(/^#+\s*/, '').trim());
  const bulletItems = lines
    .filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* '))
    .map((l) => l.replace(/^[-*]\s*/, '').trim())
    .filter((l) => l.length > 10);

  // 1. Extract Code Blocks
  const codeBlocks: Array<{ language: string; code: string }> = [];
  const codeRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let codeMatch;
  while ((codeMatch = codeRegex.exec(content)) !== null) {
    const lang = codeMatch[1] || 'python';
    const code = codeMatch[2].trim();
    if (code.length > 15) {
      codeBlocks.push({ language: lang, code });
    }
  }

  // 2. Extract Tables
  const tableBlocks: Array<{ headers: string[]; rows: string[][] }> = [];
  const tableLines = lines.filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));
  if (tableLines.length >= 3) {
    const headerRow = tableLines[0]
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const dataRows = tableLines
      .slice(2, 6)
      .map((row) =>
        row
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim())
      )
      .filter((r) => r.length === headerRow.length && r.some((c) => c.length > 0));

    if (headerRow.length > 0 && dataRows.length > 0) {
      tableBlocks.push({ headers: headerRow, rows: dataRows });
    }
  }

  // 3. Detect SAP or Enterprise Interface Mentions
  const hasSapTcodes = /me21n|me51n|migo|miro|mm01|va01|vf01|fb60|f-02|se38|spro/i.test(content);
  const sapMatch = content.match(/\b(ME21N|ME51N|MIGO|MIRO|MM01|VA01|VF01|FB60)\b/i);
  const detectedTcode = sapMatch ? sapMatch[1].toUpperCase() : 'ME21N';

  const slides: TeachingSlide[] = [];
  let slideNum = 1;

  // Slide 1: Title & Executive Syllabus
  slides.push({
    id: `slide-${slideNum}`,
    slideNumber: slideNum++,
    slideType: 'standard',
    badge: standardInfo.badge,
    badgeColor: standardInfo.badgeColor,
    title: chapterTitle || 'Masterclass Module',
    subtitle: `${courseTitle} • Module ${chapterNumber}`,
    bullets: [
      `Standard Framework: ${standardInfo.frameworkName} (${standardInfo.levelOrCode})`,
      `Governing Authority: ${standardInfo.bodyName} (${standardInfo.governingAuthority})`,
      `Nature of Approval: ${standardInfo.approvalNature}`,
      'Pedagogical Delivery: Interactive technical presentation with synchronized multi-language narration',
    ],
    keyTakeaway: `Master the recognized competencies required for ${standardInfo.frameworkName} certified enterprise execution.`,
    speakerNotes: `Welcome to this presentation on ${chapterTitle}. In this module, we will deconstruct the core concepts benchmarked against ${standardInfo.bodyName} standards.`,
  });

  // Slide 2: Theoretical Foundations & Architecture
  const keyConcepts = bulletItems.slice(0, 4);
  slides.push({
    id: `slide-${slideNum}`,
    slideNumber: slideNum++,
    slideType: 'standard',
    badge: 'Core Theory',
    badgeColor: '#38bdf8',
    title: 'Theoretical Foundations & System Architecture',
    subtitle: headers[1] || 'Underlying Mechanics & Conceptual Models',
    bullets:
      keyConcepts.length >= 3
        ? keyConcepts
        : [
            'Fundamental structural concepts, design patterns, and terminology',
            'Enterprise data structures and governance standards',
            'Core business logic and regulatory compliance parameters',
            'Industry best practices ensuring scalability and system integrity',
          ],
    keyTakeaway:
      'Understanding the underlying architecture prevents systemic errors during operational execution.',
    speakerNotes: `Let's examine the foundational principles that govern this topic. Pay close attention to how these concepts structure everyday operations.`,
  });

  // Slide 3: Technical Module - Code Structure Slide (if code exists or Python/Programming)
  if (codeBlocks.length > 0 || /python|javascript|typescript|code|algorithm|sql/i.test(courseTitle)) {
    const primaryCode =
      codeBlocks[0] || {
        language: 'python',
        code: `# Enterprise Data Processing & Pipeline Architecture
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class TransactionRecord:
    transaction_id: str
    amount: float
    status: str = "PENDING"
    
    def validate_and_post(self) -> bool:
        """Validates business rules and executes posting."""
        if self.amount <= 0:
            raise ValueError("Invalid transaction amount.")
        self.status = "POSTED"
        return True`,
      };

    slides.push({
      id: `slide-${slideNum}`,
      slideNumber: slideNum++,
      slideType: 'code',
      badge: `${primaryCode.language.toUpperCase()} Architecture`,
      badgeColor: '#10b981',
      title: 'Technical Implementation & Code Structure',
      subtitle: 'Algorithmic Flow, Data Types & Idiomatic Syntax',
      bullets: [
        'Modular decomposition following clean code and PEP / ISO engineering standards',
        'Strong static typing and structured error handling safeguards',
        'Optimized computational complexity and scalable memory footprint',
        'Unit test verification ready for automated CI/CD deployment',
      ],
      codeSnippet: {
        language: primaryCode.language,
        code: primaryCode.code,
        description: `${primaryCode.language.toUpperCase()} Enterprise Implementation Structure`,
      },
      keyTakeaway:
        'Clean, modular code structures ensure enterprise maintainability and prevent runtime exceptions.',
      speakerNotes: `Here is the technical code structure for this module. Notice the clean typing and validation guards that enforce business rules.`,
    });
  }

  // Slide 4: Technical Module - SAP / Enterprise UI Interface Layout Slide
  if (hasSapTcodes || /sap|erp|procurement|s\/4hana|hana/i.test(courseTitle)) {
    const tcodeMap: Record<string, { screenTitle: string; menuPath: string; fields: Array<{ name: string; required: boolean; desc: string }> }> = {
      ME21N: {
        screenTitle: 'Create Purchase Order (Standard NB)',
        menuPath: 'SAP Menu -> Logistics -> MM -> Purchasing -> Purchase Order -> Create (ME21N)',
        fields: [
          { name: 'Vendor / Business Partner (BP)', required: true, desc: 'Supplying vendor account code' },
          { name: 'Purchasing Org / Group', required: true, desc: 'Responsible procurement authority' },
          { name: 'Company Code & Plant', required: true, desc: 'Receiving enterprise valuation entity' },
          { name: 'Material & Order Quantity', required: true, desc: 'Material Master ID (MARA) & units' },
        ],
      },
      ME51N: {
        screenTitle: 'Create Purchase Requisition',
        menuPath: 'SAP Menu -> Logistics -> MM -> Purchasing -> Purchase Requisition -> Create (ME51N)',
        fields: [
          { name: 'Document Type (NB/FO)', required: true, desc: 'Requisition classification' },
          { name: 'Material Master / Item Description', required: true, desc: 'Item requested for internal use' },
          { name: 'Plant & Storage Location', required: true, desc: 'Destination inventory warehouse' },
          { name: 'Account Assignment (K/P/F)', required: false, desc: 'Cost center / WBS element mapping' },
        ],
      },
      MIGO: {
        screenTitle: 'Goods Receipt for Purchase Order',
        menuPath: 'SAP Menu -> Logistics -> MM -> Inventory Management -> Goods Movement (MIGO)',
        fields: [
          { name: 'Movement Type (101 GR)', required: true, desc: 'Standard warehouse inventory movement' },
          { name: 'PO Number & Line Item', required: true, desc: 'Reference source procurement document' },
          { name: 'Storage Location (0001)', required: true, desc: 'Physical storage bin placement' },
          { name: 'Item OK Checkbox', required: true, desc: 'Physical quantity receipt confirmation' },
        ],
      },
      MIRO: {
        screenTitle: 'Enter Incoming Invoice (3-Way Match)',
        menuPath: 'SAP Menu -> Logistics -> MM -> Logistics Invoice Verification -> Enter Invoice (MIRO)',
        fields: [
          { name: 'Invoice Date & Posting Date', required: true, desc: 'Fiscal posting ledger timestamps' },
          { name: 'Gross Amount & Currency', required: true, desc: 'Vendor billed invoice total' },
          { name: 'Purchase Order Reference', required: true, desc: 'Automated 3-way quantity & price match' },
          { name: 'Tax Code & Baseline Date', required: true, desc: 'Input tax calculation and payment terms' },
        ],
      },
    };

    const tcodeInfo = tcodeMap[detectedTcode] || tcodeMap.ME21N;
    const sapImg = images.find((i) => i.alt.toLowerCase().includes(detectedTcode.toLowerCase())) || images[0];

    slides.push({
      id: `slide-${slideNum}`,
      slideNumber: slideNum++,
      slideType: 'sap_layout',
      badge: `SAP Transaction: ${detectedTcode}`,
      badgeColor: '#0284c7',
      title: `SAP UI Layout & Transaction Flow: ${detectedTcode}`,
      subtitle: tcodeInfo.screenTitle,
      bullets: [
        `Menu Navigation: ${tcodeInfo.menuPath}`,
        'Screen Partition: Header Level (Org Data, Partners, Terms) & Item Overview (Lines, Materials, Quantities)',
        'Item Details Tabs: Delivery Schedule, Account Assignment, Conditions (Pricing Schema), Status',
        'Document Flow Progression: Automatic generation of material document & financial accounting ledger voucher',
      ],
      sapLayout: {
        tcode: detectedTcode,
        screenTitle: tcodeInfo.screenTitle,
        menuPath: tcodeInfo.menuPath,
        fields: tcodeInfo.fields,
        imageUrl: sapImg?.url,
      },
      keyTakeaway:
        'Strict header and line-item data validation guarantees financial accounting integrity and automated 3-way matching.',
      speakerNotes: `On this screen, we examine the standard SAP ${detectedTcode} layout. Notice the mandatory fields and how Header, Item Overview, and Item Detail tabs interact.`,
    });
  }

  // Slide 5: Technical Module - Comparative Table Slide (if tables exist)
  if (tableBlocks.length > 0) {
    const primaryTable = tableBlocks[0];
    slides.push({
      id: `slide-${slideNum}`,
      slideNumber: slideNum++,
      slideType: 'table',
      badge: 'Comparative Matrix',
      badgeColor: '#a855f7',
      title: 'Comparative Architectural & Scenario Matrix',
      subtitle: 'Evaluation Matrix & Decision Criteria',
      bullets: [
        'Side-by-side trade-off analysis across key enterprise evaluation dimensions',
        'Performance, operational risk, and implementation cost comparisons',
        'Recommended default patterns for high-throughput enterprise environments',
      ],
      tableData: primaryTable,
      keyTakeaway:
        'Selecting the optimal architectural variant depends on throughput, latency tolerances, and audit requirements.',
      speakerNotes: `Review the comparative evaluation table. Each column highlights key trade-offs and decision factors for enterprise implementations.`,
    });
  }

  // Slide 6: Practical Workflows & Step-by-Step Execution
  const workflows = bulletItems.slice(4, 8);
  slides.push({
    id: `slide-${slideNum}`,
    slideNumber: slideNum++,
    slideType: 'standard',
    badge: 'Step-by-Step',
    badgeColor: '#34d399',
    title: 'Procedural Execution & Operational Workflow',
    subtitle: headers[2] || 'Step-by-Step Workflow Rules & System Posts',
    bullets:
      workflows.length >= 3
        ? workflows
        : [
            'Step 1: Configure initial parameters and validate mandatory field prerequisites',
            'Step 2: Execute core transaction sequence and document generation',
            'Step 3: Review system status flags, accounting postings, and integration flows',
            'Step 4: Verify ledger balances and trigger downstream operational release',
          ],
    keyTakeaway:
      'Strict procedural sequence discipline guarantees transaction integrity and audit traceability.',
    speakerNotes: `Now we walk through the step-by-step procedure. Follow the exact order to ensure complete data consistency.`,
  });

  // Slide 7: Hands-On Lab Simulation
  slides.push({
    id: `slide-${slideNum}`,
    slideNumber: slideNum++,
    slideType: 'lab',
    badge: 'Hands-On Lab',
    badgeColor: '#f59e0b',
    title: 'Hands-On Lab Simulation & Practical Exercise',
    subtitle: 'Applied Competency & System Verification Checklist',
    bullets: [
      'Lab Scenario: End-to-end configuration and transaction execution test',
      'Student Objective: Configure test parameters and verify system output without exceptions',
      'Troubleshooting Checklist: Review common error codes and validation checkpoints',
      'Success Criteria: Clean system confirmation, document number generated, status log cleared',
    ],
    keyTakeaway:
      'Practical hands-on execution cements theoretical understanding and builds enterprise job readiness.',
    speakerNotes: `In this lab exercise, you will put theory into practice. Follow the troubleshooting checklist if you encounter any system exceptions.`,
  });

  // Slide 8: Summary Takeaways & Certification Check
  const takeaways = bulletItems.slice(8, 12);
  slides.push({
    id: `slide-${slideNum}`,
    slideNumber: slideNum++,
    slideType: 'standard',
    badge: 'Knowledge Check',
    badgeColor: '#ec4899',
    title: 'Summary Takeaways & Certification Check',
    subtitle: 'Certified Learning Milestones & Next Progression',
    bullets:
      takeaways.length >= 3
        ? takeaways
        : [
            `Core concepts mapped to ${standardInfo.frameworkName} international standards`,
            'Technical code and interface layout structures thoroughly deconstructed',
            'Hands-on lab completed with full troubleshooting validation',
            'Ready for advanced module progression and assessment',
          ],
    keyTakeaway: `You have successfully achieved the certified learning milestones benchmarked against ${standardInfo.bodyName}.`,
    speakerNotes: `To summarize: you have now covered all core competencies of this chapter. Proceed to the next module to continue your curriculum journey.`,
  });

  return slides;
}

export default function TeachingSlidesModal({
  courseTitle,
  chapterTitle,
  chapterNumber = 1,
  chapterContent,
  activeLanguage = 'en-US',
  activeVoiceProfile = 'coqui-xtts-multilingual',
  onClose,
  onOpenInVideo,
}: TeachingSlidesModalProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isSpeakingSlide, setIsSpeakingSlide] = useState<boolean>(false);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  // Custom User-Created Slides (Chapter or Global Course level)
  const [customSlides, setCustomSlides] = useState<TeachingSlide[]>([]);
  const [isAddSlideModalOpen, setIsAddSlideModalOpen] = useState<boolean>(false);

  // Add Slide Form State
  const [newSlideScope, setNewSlideScope] = useState<'chapter' | 'course'>('chapter');
  const [newSlideTitle, setNewSlideTitle] = useState<string>('');
  const [newSlideSubtitle, setNewSlideSubtitle] = useState<string>('');
  const [newSlideBadge, setNewSlideBadge] = useState<string>('Custom Topic');
  const [newSlideBadgeColor] = useState<string>('#ec4899');
  const [newSlideType, setNewSlideType] = useState<'standard' | 'code' | 'table' | 'lab'>('standard');
  const [newSlideContent, setNewSlideContent] = useState<string>('');
  const [newSlideTakeaway, setNewSlideTakeaway] = useState<string>('');
  const [newSlideSpeakerNotes, setNewSlideSpeakerNotes] = useState<string>('');

  const generatedBaseSlides = useMemo(() => {
    return generateTeachingSlidesFromContent(courseTitle, chapterTitle, chapterNumber, chapterContent);
  }, [courseTitle, chapterTitle, chapterNumber, chapterContent]);

  // Combined slides with sequential slideNumber indexing
  const slides: TeachingSlide[] = useMemo(() => {
    const combined = [...generatedBaseSlides, ...customSlides];
    return combined.map((s, idx) => ({
      ...s,
      slideNumber: idx + 1,
    }));
  }, [generatedBaseSlides, customSlides]);

  const activeSlide = slides[currentSlideIndex] || slides[0];

  const handleAddCustomSlideSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlideTitle.trim()) return;

    const bullets = newSlideContent
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter((l) => l.length > 0);

    const isCode = newSlideType === 'code' || newSlideContent.startsWith('```');
    let codeSnippetObj: TeachingSlide['codeSnippet'] = undefined;
    if (isCode) {
      const codeClean = newSlideContent.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
      codeSnippetObj = {
        language: 'python',
        code: codeClean || newSlideContent,
        description: newSlideSubtitle || 'Custom Code Implementation',
      };
    }

    const created: TeachingSlide = {
      id: `custom-slide-${Date.now()}`,
      slideNumber: slides.length + 1,
      badge: newSlideBadge || (newSlideScope === 'course' ? 'Course Master' : `Chapter ${chapterNumber}`),
      badgeColor: newSlideBadgeColor || '#ec4899',
      title: newSlideTitle.trim(),
      subtitle: newSlideSubtitle.trim() || `${newSlideScope === 'course' ? courseTitle : chapterTitle}`,
      bullets: bullets.length > 0 ? bullets : ['Key conceptual breakdown', 'Practical implementation details'],
      keyTakeaway: newSlideTakeaway.trim() || 'Custom theoretical milestone and verified best practice.',
      speakerNotes: newSlideSpeakerNotes.trim() || `Discussing ${newSlideTitle} in detail.`,
      slideType: newSlideType,
      customHtmlOrMd: newSlideContent,
      codeSnippet: codeSnippetObj,
    };

    setCustomSlides((prev) => [...prev, created]);
    setCurrentSlideIndex(slides.length); // Navigate to newly added slide
    setIsAddSlideModalOpen(false);

    // Reset Form
    setNewSlideTitle('');
    setNewSlideSubtitle('');
    setNewSlideContent('');
    setNewSlideTakeaway('');
    setNewSlideSpeakerNotes('');
  };

  // Stop speaking on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // Keyboard navigation for presentation slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
        stopSpeaking();
        setIsSpeakingSlide(false);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
        stopSpeaking();
        setIsSpeakingSlide(false);
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length, isFullscreen, onClose]);

  // Read Slide Aloud via Coqui XTTS Multi-Language Audio Engine
  const handleReadSlideAloud = () => {
    if (isSpeakingSlide) {
      stopSpeaking();
      setIsSpeakingSlide(false);
      return;
    }

    let technicalContext = '';
    if (activeSlide.codeSnippet) {
      technicalContext = ` Technical code structure in ${activeSlide.codeSnippet.language}. `;
    } else if (activeSlide.sapLayout) {
      technicalContext = ` SAP Transaction code ${activeSlide.sapLayout.tcode} interface layout. `;
    }

    const narrationText = `${activeSlide.title}. ${activeSlide.subtitle}.${technicalContext} Key points: ${activeSlide.bullets.join('. ')}. Key Takeaway: ${activeSlide.keyTakeaway}`;

    setIsSpeakingSlide(true);
    speakText(
      narrationText,
      {
        rate: 1.0,
        volume: 1.0,
        pitch: 1.0,
        voiceProfileId: activeVoiceProfile,
        lang: activeLanguage,
      },
      () => {
        setIsSpeakingSlide(true);
      },
      () => {
        setIsSpeakingSlide(false);
      },
      () => {
        setIsSpeakingSlide(false);
      }
    );
  };

  // Download Presentation as Markdown (Marp/Reveal Compatible with Side-by-Side Visuals)
  const handleDownloadMarkdownSlides = () => {
    let md = `# ${courseTitle}\n## ${chapterTitle}\n\n---\n\n`;
    slides.forEach((slide) => {
      md += `<!-- _class: lead -->\n`;
      md += `### ${slide.badge} • Slide ${slide.slideNumber}\n`;
      md += `# ${slide.title}\n`;
      md += `*${slide.subtitle}*\n\n`;

      if (slide.codeSnippet) {
        md += `\`\`\`${slide.codeSnippet.language}\n${slide.codeSnippet.code}\n\`\`\`\n\n`;
      }

      if (slide.sapLayout) {
        md += `> **SAP Interface Layout:** \`${slide.sapLayout.tcode}\` — *${slide.sapLayout.screenTitle}*\n`;
        md += `> **Menu Path:** \`${slide.sapLayout.menuPath}\`\n\n`;
      }

      slide.bullets.forEach((b) => {
        md += `- ${b}\n`;
      });
      md += `\n> **Key Takeaway:** ${slide.keyTakeaway}\n\n`;
      md += `<!-- Speaker Notes:\n${slide.speakerNotes}\n-->\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chapterTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Slides.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Self-Contained HTML Presentation Deck
  const handleDownloadHtmlDeck = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${courseTitle} - ${chapterTitle} (Teaching Slides)</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  body { background: #0b0f19; color: #f3f4f6; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; }
  .slide { width: 100%; max-width: 980px; background: #111827; border: 1px solid #374151; border-radius: 1rem; padding: 2.5rem; margin-bottom: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
  .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: bold; margin-bottom: 1rem; background: #3b82f6; color: white; }
  h1 { font-size: 1.8rem; margin-bottom: 0.5rem; color: #ffffff; }
  h2 { font-size: 1.1rem; color: #9ca3af; font-weight: normal; margin-bottom: 1.5rem; }
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
  pre { background: #0d1117; border: 1px solid #30363d; border-radius: 0.5rem; padding: 1rem; overflow-x: auto; color: #58a6ff; font-size: 0.85rem; font-family: monospace; }
  ul { margin-left: 1.5rem; margin-bottom: 1.5rem; }
  li { margin-bottom: 0.6rem; font-size: 0.95rem; color: #d1d5db; line-height: 1.5; }
  .takeaway { background: rgba(59, 130, 246, 0.15); border-left: 4px solid #3b82f6; padding: 0.75rem 1rem; border-radius: 0.4rem; font-size: 0.95rem; }
  .notes { margin-top: 1rem; font-size: 0.85rem; color: #6b7280; font-style: italic; }
</style>
</head>
<body>
${slides
  .map(
    (s) => `
<div class="slide">
  <span class="badge" style="background: ${s.badgeColor}">${s.badge} • Slide ${s.slideNumber}</span>
  <h1>${s.title}</h1>
  <h2>${s.subtitle}</h2>
  ${
    s.codeSnippet
      ? `<div class="split">
          <pre><code>${s.codeSnippet.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
          <div>
            <ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
          </div>
        </div>`
      : `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>`
  }
  <div class="takeaway"><strong>Key Takeaway:</strong> ${s.keyTakeaway}</div>
  <div class="notes">Speaker Notes: ${s.speakerNotes}</div>
</div>`
  )
  .join('\n')}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chapterTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_Presentation.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      ref={modalContainerRef}
      id="teaching-slides-modal"
      className="animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 7, 13, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        padding: isFullscreen ? 0 : '1rem',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: '0.65rem 1.5rem',
          background: 'rgba(15, 20, 32, 0.98)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)',
              border: '1px solid rgba(236, 72, 153, 0.45)',
              color: '#f472b6',
            }}
          >
            <Layers size={17} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#ffffff' }}>
                Presentation-Ready Teaching Slides & Visual Reference
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  background: 'rgba(236, 72, 153, 0.2)',
                  color: '#f472b6',
                  border: '1px solid rgba(236, 72, 153, 0.4)',
                }}
              >
                Coqui XTTS Voice Synchronized
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {chapterTitle} • Slide {activeSlide.slideNumber} of {slides.length}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {/* Add / Create New Slide Trigger */}
          <button
            type="button"
            onClick={() => setIsAddSlideModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '30px',
              padding: '0 0.8rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
              border: '1px solid rgba(236, 72, 153, 0.6)',
              color: '#ffffff',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(236, 72, 153, 0.3)',
              transition: 'all 0.15s ease',
            }}
            title="Add or create a new custom slide for this chapter or full course"
          >
            <Plus size={13} color="#f472b6" />
            <span>Add / Create Slide</span>
          </button>

          {/* Synchronized Create Video Trigger */}
          {onOpenInVideo && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInVideo();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                height: '30px',
                padding: '0 0.75rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                color: '#d8b4fe',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Open synchronized Masterclass Video engine for this lesson"
            >
              <Video size={13} color="#c084fc" />
              <span>Create Video</span>
            </button>
          )}

          {/* Read Slide Aloud via Coqui XTTS */}
          <button
            type="button"
            onClick={handleReadSlideAloud}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: '30px',
              padding: '0 0.75rem',
              borderRadius: '9999px',
              background: isSpeakingSlide ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: isSpeakingSlide ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid var(--border-subtle)',
              color: isSpeakingSlide ? '#f472b6' : 'var(--text-main)',
              fontSize: '0.74rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Read this slide aloud using Coqui XTTS voice"
          >
            {isSpeakingSlide ? <VolumeX size={13} /> : <Volume2 size={13} color="#f472b6" />}
            <span>{isSpeakingSlide ? 'Stop Voice' : 'Read Slide'}</span>
          </button>

          {/* Download Markdown Slides */}
          <button
            type="button"
            onClick={handleDownloadMarkdownSlides}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              height: '30px',
              padding: '0 0.65rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: '0.74rem',
              cursor: 'pointer',
            }}
            title="Export Marp/Reveal compatible Markdown slides"
          >
            <Download size={13} />
            <span>MD Slides</span>
          </button>

          {/* Download HTML Presentation */}
          <button
            type="button"
            onClick={handleDownloadHtmlDeck}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              height: '30px',
              padding: '0 0.65rem',
              borderRadius: '0.5rem',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#a5b4fc',
              fontSize: '0.74rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
            title="Download offline self-contained HTML slide deck"
          >
            <FileCode size={13} />
            <span>HTML Deck</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              cursor: 'pointer',
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Presentation'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              cursor: 'pointer',
            }}
            title="Close Slides"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Presentation Stage (Cinematic 16:9 Slide Canvas) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Navigation Arrow Left */}
        <button
          type="button"
          onClick={() => {
            setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
            stopSpeaking();
            setIsSpeakingSlide(false);
          }}
          disabled={currentSlideIndex === 0}
          style={{
            position: 'absolute',
            left: '1.5rem',
            zIndex: 10,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(15, 20, 32, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentSlideIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentSlideIndex === 0 ? 0.35 : 1,
            transition: 'all 0.15s ease',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          }}
          title="Previous Slide (Left Arrow)"
        >
          <ChevronLeft size={22} />
        </button>

        {/* 16:9 Cinematic Slide Frame */}
        <div
          style={{
            width: '100%',
            maxWidth: '1180px',
            aspectRatio: '16 / 9',
            maxHeight: 'calc(100vh - 170px)',
            background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(10, 13, 22, 1) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '1rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(168, 85, 247, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '2rem 2.5rem',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle Ambient Gradient Glow */}
          <div
            style={{
              position: 'absolute',
              top: '-15%',
              right: '-15%',
              width: '350px',
              height: '350px',
              borderRadius: '50%',
              background: activeSlide.badgeColor,
              filter: 'blur(110px)',
              opacity: 0.15,
              pointerEvents: 'none',
            }}
          />

          {/* Slide Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.65rem',
                    borderRadius: '9999px',
                    background: `${activeSlide.badgeColor}25`,
                    color: activeSlide.badgeColor,
                    border: `1px solid ${activeSlide.badgeColor}60`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {activeSlide.badge}
                </span>
                {activeSlide.slideType === 'code' && (
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '9999px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#6ee7b7',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                    }}
                  >
                    Visual Code Reference
                  </span>
                )}
                {activeSlide.slideType === 'sap_layout' && (
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '9999px',
                      background: 'rgba(2, 132, 199, 0.2)',
                      color: '#7dd3fc',
                      border: '1px solid rgba(2, 132, 199, 0.4)',
                    }}
                  >
                    SAP GUI Interface Layout
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Slide {activeSlide.slideNumber} / {slides.length}
              </span>
            </div>

            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: '1.25',
                marginBottom: '0.2rem',
              }}
            >
              {activeSlide.title}
            </h1>
            <h2
              style={{
                fontSize: '0.92rem',
                fontWeight: 500,
                color: 'var(--text-muted)',
                lineHeight: '1.4',
              }}
            >
              {activeSlide.subtitle}
            </h2>
          </div>

          {/* Slide Body: Side-by-Side or Bottom-Aligned Technical Presentation */}
          <div style={{ margin: '0.85rem 0', flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            {/* Case A: Code Structure Visual Reference Slide */}
            {activeSlide.slideType === 'code' && activeSlide.codeSnippet ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: '1.25rem', width: '100%', height: '100%' }}>
                {/* Left: IDE Code Structure Card */}
                <div
                  style={{
                    background: '#0d1117',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
                  }}
                >
                  <div
                    style={{
                      padding: '0.4rem 0.75rem',
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Code2 size={12} color="#34d399" />
                      <span style={{ fontSize: '0.7rem', color: '#cbd5e1', fontWeight: 600 }}>
                        {activeSlide.codeSnippet.language.toUpperCase()} Module Snippet
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                    </div>
                  </div>
                  <pre
                    style={{
                      padding: '0.85rem',
                      margin: 0,
                      flex: 1,
                      overflowY: 'auto',
                      fontSize: '0.78rem',
                      lineHeight: '1.45',
                      fontFamily: "'Fira Code', 'Consolas', monospace",
                      color: '#93c5fd',
                    }}
                  >
                    <code>{activeSlide.codeSnippet.code}</code>
                  </pre>
                </div>

                {/* Right: Side-by-Side Theory & Architectural Explanation */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Architectural & Execution Rules
                  </div>
                  {activeSlide.bullets.map((bullet, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.035)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        fontSize: '0.84rem',
                        color: 'var(--text-main)',
                        lineHeight: '1.4',
                      }}
                    >
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#34d399',
                          marginTop: '6px',
                          flexShrink: 0,
                          boxShadow: '0 0 6px #34d399',
                        }}
                      />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeSlide.slideType === 'sap_layout' && activeSlide.sapLayout ? (
              /* Case B: SAP GUI Interface Layout Visual Reference Slide */
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.25rem', width: '100%', height: '100%' }}>
                {/* Left: SAP Interface Layout Mockup Card */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                    border: '1px solid rgba(2, 132, 199, 0.4)',
                    borderRadius: '0.75rem',
                    padding: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem',
                    overflowY: 'auto',
                    boxShadow: '0 8px 25px rgba(0,0,0,0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Server size={14} color="#38bdf8" />
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>
                        SAP GUI: {activeSlide.sapLayout.tcode}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.65rem', color: '#7dd3fc', background: 'rgba(2, 132, 199, 0.25)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      S/4HANA Enterprise
                    </span>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    <strong>Menu Path:</strong> {activeSlide.sapLayout.menuPath}
                  </div>

                  {/* Mandatory Field Matrix */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase' }}>
                      Core Transaction Fields & Screen Layout
                    </div>
                    {activeSlide.sapLayout.fields.map((f, fIdx) => (
                      <div
                        key={fIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.3rem 0.5rem',
                          borderRadius: '0.35rem',
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          fontSize: '0.72rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ fontWeight: 600, color: '#ffffff' }}>{f.name}</span>
                          {f.required && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>*</span>}
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{f.desc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Embedded Screenshot Tag or Layout Diagram */}
                  {activeSlide.sapLayout.imageUrl && (
                    <div style={{ marginTop: 'auto', borderRadius: '0.4rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <img
                        src={activeSlide.sapLayout.imageUrl}
                        alt={activeSlide.sapLayout.tcode}
                        style={{ width: '100%', height: '80px', objectFit: 'cover' }}
                      />
                    </div>
                  )}
                </div>

                {/* Right: Side-by-Side Theory & Process Rules */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Process Flow & Business Logic
                  </div>
                  {activeSlide.bullets.map((bullet, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.5rem',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.035)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        fontSize: '0.84rem',
                        color: 'var(--text-main)',
                        lineHeight: '1.4',
                      }}
                    >
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#38bdf8',
                          marginTop: '6px',
                          flexShrink: 0,
                          boxShadow: '0 0 6px #38bdf8',
                        }}
                      />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : activeSlide.slideType === 'table' && activeSlide.tableData ? (
              /* Case C: Structured Table Matrix Slide */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', width: '100%', height: '100%', justifyContent: 'center' }}>
                <div style={{ overflowX: 'auto', borderRadius: '0.6rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(168, 85, 247, 0.25)', color: '#ffffff' }}>
                        {activeSlide.tableData.headers.map((h, hIdx) => (
                          <th key={hIdx} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeSlide.tableData.rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)' }}>
                          {row.map((cell, cIdx) => (
                            <td key={cIdx} style={{ padding: '0.45rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexDirection: 'column' }}>
                  {activeSlide.bullets.map((b, bIdx) => (
                    <div key={bIdx} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <CheckCircle2 size={12} color="#a855f7" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Case D: Standard Bullet Points or Custom Markdown/HTML Presentation */
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.6rem', width: '100%', overflowY: 'auto' }}>
                {activeSlide.customHtmlOrMd && (
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '0.75rem',
                      padding: '1rem',
                      fontSize: '0.92rem',
                      color: '#f3f4f6',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {activeSlide.customHtmlOrMd}
                  </div>
                )}
                {activeSlide.bullets.map((bullet, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '0.6rem',
                      background: 'rgba(255, 255, 255, 0.035)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      fontSize: '0.92rem',
                      color: 'var(--text-main)',
                      lineHeight: '1.45',
                    }}
                  >
                    <div
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: activeSlide.badgeColor,
                        marginTop: '7px',
                        flexShrink: 0,
                        boxShadow: `0 0 8px ${activeSlide.badgeColor}`,
                      }}
                    />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Slide Footer / Key Takeaway Callout */}
          <div
            style={{
              padding: '0.65rem 1.15rem',
              borderRadius: '0.65rem',
              background: 'rgba(99, 102, 241, 0.12)',
              borderLeft: `4px solid ${activeSlide.badgeColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#e0e7ff', lineHeight: '1.35' }}>
              <strong style={{ color: '#ffffff' }}>Key Takeaway: </strong>
              {activeSlide.keyTakeaway}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-subtle)', fontSize: '0.68rem', flexShrink: 0 }}>
              <Award size={13} color="#f59e0b" />
              <span>Standard Aligned</span>
            </div>
          </div>
        </div>

        {/* Navigation Arrow Right */}
        <button
          type="button"
          onClick={() => {
            setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
            stopSpeaking();
            setIsSpeakingSlide(false);
          }}
          disabled={currentSlideIndex === slides.length - 1}
          style={{
            position: 'absolute',
            right: '1.5rem',
            zIndex: 10,
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            background: 'rgba(15, 20, 32, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: currentSlideIndex === slides.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentSlideIndex === slides.length - 1 ? 0.35 : 1,
            transition: 'all 0.15s ease',
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          }}
          title="Next Slide (Right Arrow or Space)"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Bottom Filmstrip Slide Picker */}
      <div
        style={{
          padding: '0.55rem 1.5rem',
          background: 'rgba(12, 16, 26, 0.98)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '0.65rem',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {slides.map((slide, idx) => {
          const isSelected = idx === currentSlideIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => {
                setCurrentSlideIndex(idx);
                stopSpeaking();
                setIsSpeakingSlide(false);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.35rem 0.65rem',
                minWidth: '120px',
                borderRadius: '0.5rem',
                background: isSelected ? 'rgba(236, 72, 153, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: isSelected ? '1px solid rgba(236, 72, 153, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: isSelected ? '#f472b6' : 'var(--text-muted)' }}>
                Slide {slide.slideNumber} • {slide.badge}
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: isSelected ? '#ffffff' : 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '110px',
                }}
              >
                {slide.title}
              </span>
            </button>
          );
        })}

        {/* Filmstrip Add New Slide Action Card */}
        <button
          type="button"
          onClick={() => setIsAddSlideModalOpen(true)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.35rem 0.75rem',
            minWidth: '110px',
            borderRadius: '0.5rem',
            background: 'rgba(236, 72, 153, 0.12)',
            border: '1px dashed rgba(236, 72, 153, 0.45)',
            color: '#f472b6',
            cursor: 'pointer',
            textAlign: 'center',
            gap: '0.2rem',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
          title="Add or create a new slide"
        >
          <Plus size={14} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>+ Add Slide</span>
        </button>
      </div>

      {/* Add / Create New Slide Modal Dialog */}
      {isAddSlideModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
              border: '1.5px solid rgba(236, 72, 153, 0.4)',
              borderRadius: '1rem',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7), 0 0 25px rgba(236, 72, 153, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} color="#f472b6" />
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
                  Add / Create New Slide
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSlideModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleAddCustomSlideSubmit} style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Scope Selector: Chapter Level vs Global Course Level */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '0.35rem', display: 'block' }}>
                  Slide Scope
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setNewSlideScope('chapter')}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      background: newSlideScope === 'chapter' ? 'rgba(236, 72, 153, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: newSlideScope === 'chapter' ? '1px solid #ec4899' : '1px solid var(--border-subtle)',
                      color: newSlideScope === 'chapter' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Current Chapter ({chapterTitle.slice(0, 24)}...)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSlideScope('course')}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      background: newSlideScope === 'course' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      border: newSlideScope === 'course' ? '1px solid #6366f1' : '1px solid var(--border-subtle)',
                      color: newSlideScope === 'course' ? '#ffffff' : 'var(--text-muted)',
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Global Course Master Slide
                  </button>
                </div>
              </div>

              {/* Title & Subtitle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Slide Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Advanced Architecture & Data Flow"
                    value={newSlideTitle}
                    onChange={(e) => setNewSlideTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Subtitle / Topic Focus
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. System Integration Checklist"
                    value={newSlideSubtitle}
                    onChange={(e) => setNewSlideSubtitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
              </div>

              {/* Badge & Category Type */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Badge / Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Deep Dive, Lab, Code Architecture"
                    value={newSlideBadge}
                    onChange={(e) => setNewSlideBadge(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                    Slide Format
                  </label>
                  <select
                    value={newSlideType}
                    onChange={(e) => setNewSlideType(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '0.45rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border-subtle)',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                    }}
                  >
                    <option value="standard">Standard Bullet Points</option>
                    <option value="code">Code Snippet / Structure</option>
                    <option value="lab">Hands-on Lab Simulation</option>
                  </select>
                </div>
              </div>

              {/* Slide Content: Markdown, HTML, Bullets, or Code */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Slide Content (Markdown, HTML, Bullets, or Code)
                </label>
                <textarea
                  rows={4}
                  placeholder={`- Point 1: Enterprise data verification\n- Point 2: Architecture optimization rule\n\nOr paste Markdown/HTML code snippets`}
                  value={newSlideContent}
                  onChange={(e) => setNewSlideContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.55rem',
                    borderRadius: '0.45rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontFamily: newSlideType === 'code' ? 'monospace' : 'inherit',
                  }}
                />
              </div>

              {/* Key Takeaway & Speaker Notes */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Key Takeaway
                </label>
                <input
                  type="text"
                  placeholder="e.g. Robust validation prevents runtime production errors."
                  value={newSlideTakeaway}
                  onChange={(e) => setNewSlideTakeaway(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.45rem',
                    background: 'rgba(0, 0, 0, 0.35)',
                    border: '1px solid var(--border-subtle)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                  }}
                />
              </div>

              {/* Submit & Cancel Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsAddSlideModalOpen(false)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '0.45rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.45rem 1.1rem',
                    borderRadius: '0.45rem',
                    background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(236, 72, 153, 0.4)',
                  }}
                >
                  Save & Add Slide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
