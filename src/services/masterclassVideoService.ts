import { generateIlaResponse } from './geminiService';

export interface VideoScriptCue {
  id: string;
  topicNumber: string; // e.g. "1.1", "1.2"
  title: string;
  timestamp: string; // formatted e.g. "00:00", "02:15"
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  durationFormatted: string; // e.g. "2:15"
  narratorScript: string; // spoken dialogue / voiceover text
  visualScreenCue: string; // studio direction / UI screen cue e.g. "[VISUAL CUE: Display SAP ME21N Header]"
  screenTitle?: string;
  imageUrl?: string; // Embedded screenshot or diagram URL if found
  keyBulletPoints?: string[];
  actionBadge?: string; // e.g. "Core Theory", "Live UI Screen", "Hands-on Lab", "Python Architecture", "SAP Layout"
  cueType?: 'standard' | 'code' | 'sap_layout' | 'table' | 'lab';
  codeSnippet?: {
    language: string;
    code: string;
  };
  sapLayout?: {
    tcode: string;
    screenTitle: string;
    menuPath: string;
    fields: Array<{ name: string; required: boolean; desc: string }>;
  };
  checkpointExam?: {
    id: string;
    topicNumber: string;
    topicTitle: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface ChapterVideoScript {
  chapterNumber: number;
  chapterTitle: string;
  totalDurationFormatted: string;
  totalSeconds: number;
  cues: VideoScriptCue[];
}

/**
 * Formats seconds into MM:SS display format.
 */
export function formatTimeCode(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Strips markdown symbols for clean, professional spoken narration.
 */
export function cleanNarratorText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    // Strip studio visual cues, screen direction tags, and bracketed notes
    .replace(/\[(?:VISUAL CUE|SCREEN CUE|UI SCREEN|STUDIO CUE|NOTE|DIRECTION|TCODE|TOPIC|SEGMENT)[^\]]*\]/gi, '')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '') // remove images
    .replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, 'Here is the technical code structure and execution configuration displayed on your screen.') // summarize code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\|[-:\s|]+\|/g, '')
    .replace(/\|/g, ', ')
    .replace(/^#{1,6}\s*(.+)$/gm, '$1. ')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/^\s*[-+*▸•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/&gt;/g, '')
    .replace(/>+/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/->|→|=>/g, ' leads to ')
    .replace(/\b(?:It looks like you forgot to paste[^.]*\.|Sure(?: thing)?[,!.]|Certainly(?:!|.)?|As an AI language model[^.]*\.|Please provide the content[^.]*\.)/gi, '')
    .replace(/\s*([.,!?;:])\s*/g, '$1 ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts embedded image URLs and alt texts from markdown text.
 */
export function extractMarkdownImages(markdown: string): Array<{ alt: string; url: string }> {
  const images: Array<{ alt: string; url: string }> = [];
  const regex = /!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    images.push({ alt: match[1] || 'UI Screen', url: match[2] });
  }
  return images;
}

/**
 * Parses markdown course or chapter content into structured masterclass video segments with timestamps and visual technical screen reference cues.
 */
export function parseMasterclassScriptFromMarkdown(
  content: string,
  chapterNumber: number = 1,
  chapterTitle: string = 'Course Masterclass'
): ChapterVideoScript {
  if (!content || !content.trim()) {
    const defaultCue: VideoScriptCue = {
      id: `cue_${Date.now()}_1`,
      topicNumber: `${chapterNumber}.1`,
      title: 'Introduction & Curriculum Overview',
      timestamp: '00:00',
      startSeconds: 0,
      endSeconds: 120,
      durationSeconds: 120,
      durationFormatted: '02:00',
      narratorScript: `Welcome to this masterclass module on ${chapterTitle}. In this segment, we will explore the core architecture, practical workflows, and enterprise techniques benchmarked to international standards.`,
      visualScreenCue: `[VISUAL CUE: Display ${chapterTitle} Title Card with Instructor Persona]`,
      screenTitle: `${chapterTitle} Overview`,
      actionBadge: 'Overview',
      cueType: 'standard',
      keyBulletPoints: [
        'Curriculum learning outcomes',
        'Architecture and theoretical foundation',
        'Step-by-step enterprise lab configuration',
      ],
    };

    return {
      chapterNumber,
      chapterTitle,
      totalDurationFormatted: '02:00',
      totalSeconds: 120,
      cues: [defaultCue],
    };
  }

  const lines = content.split('\n');
  const allImages = extractMarkdownImages(content);

  // Group text into sections based on #, ##, ### headings
  interface RawSection {
    level: number;
    title: string;
    bodyLines: string[];
    images: Array<{ alt: string; url: string }>;
  }

  const sections: RawSection[] = [];
  let currentSection: RawSection | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h1Match || h2Match || h3Match) {
      if (currentSection && (currentSection.bodyLines.length > 0 || currentSection.title)) {
        sections.push(currentSection);
      }
      const title = (h1Match || h2Match || h3Match)![1].trim();
      const level = h1Match ? 1 : h2Match ? 2 : 3;
      currentSection = {
        level,
        title,
        bodyLines: [],
        images: [],
      };
      continue;
    }

    const imgMatch = line.match(/!\[(.*?)\]\((https?:\/\/[^\s)]+)\)/);
    if (imgMatch && currentSection) {
      currentSection.images.push({ alt: imgMatch[1], url: imgMatch[2] });
    }

    if (currentSection) {
      currentSection.bodyLines.push(line);
    } else {
      // Intro before first heading
      currentSection = {
        level: 1,
        title: chapterTitle,
        bodyLines: [line],
        images: [],
      };
    }
  }

  if (currentSection && (currentSection.bodyLines.length > 0 || currentSection.title)) {
    sections.push(currentSection);
  }

  if (sections.length === 0) {
    sections.push({
      level: 1,
      title: chapterTitle,
      bodyLines: lines,
      images: allImages,
    });
  }

  const cues: VideoScriptCue[] = [];
  let accumulatedSeconds = 0;
  let cueIdx = 1;

  sections.forEach((sec, idx) => {
    const rawBody = sec.bodyLines.join('\n');
    const cleanedNarration = cleanNarratorText(rawBody);

    // Extract code snippet in this section if any
    const codeMatch = rawBody.match(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/);
    let sectionCode: { language: string; code: string } | undefined;
    if (codeMatch) {
      sectionCode = {
        language: codeMatch[1] || 'python',
        code: codeMatch[2].trim(),
      };
    }

    // Estimate speaking duration: ~130 words per minute (2.16 words per second)
    const wordCount = cleanedNarration.split(/\s+/).filter(Boolean).length;
    let estimatedSeconds = Math.max(45, Math.min(360, Math.round((wordCount / 130) * 60)));

    // Fallback narration only if section body is strictly empty
    let narratorSpeech = cleanedNarration.trim();
    if (!narratorSpeech) {
      narratorSpeech = sec.title ? `${sec.title}.` : 'Course Masterclass Segment.';
      estimatedSeconds = 45;
    }

    // Determine visual cue and transaction code badges
    let actionBadge = 'Lecture';
    let cueType: 'standard' | 'code' | 'sap_layout' | 'table' | 'lab' = 'standard';
    const lowerTitle = sec.title.toLowerCase();
    const lowerBody = rawBody.toLowerCase();

    // Check for SAP transaction codes
    const sapMatch = (sec.title + ' ' + rawBody).match(/\b(ME21N|ME51N|MIGO|MIRO|MM01|VA01|VF01|FB60)\b/i);
    const hasSap = Boolean(sapMatch);
    const detectedTcode = sapMatch ? sapMatch[1].toUpperCase() : 'ME21N';

    let sapLayoutInfo: { tcode: string; screenTitle: string; menuPath: string; fields: Array<{ name: string; required: boolean; desc: string }> } | undefined;

    if (hasSap) {
      cueType = 'sap_layout';
      actionBadge = `SAP ${detectedTcode}`;
      const sapMap: Record<string, { tcode: string; screenTitle: string; menuPath: string; fields: Array<{ name: string; required: boolean; desc: string }> }> = {
        ME21N: {
          tcode: 'ME21N',
          screenTitle: 'Create Purchase Order Screen',
          menuPath: 'Logistics -> MM -> Purchasing -> Purchase Order -> Create (ME21N)',
          fields: [
            { name: 'Vendor / BP', required: true, desc: 'Supplying vendor account code' },
            { name: 'Purchasing Org', required: true, desc: 'Procurement organization entity' },
            { name: 'Material & Quantity', required: true, desc: 'Material Master ID & Order Qty' },
          ],
        },
        ME51N: {
          tcode: 'ME51N',
          screenTitle: 'Create Purchase Requisition',
          menuPath: 'Logistics -> MM -> Purchasing -> Purchase Requisition -> Create (ME51N)',
          fields: [
            { name: 'Document Type NB', required: true, desc: 'Standard internal requisition' },
            { name: 'Plant & Storage Loc', required: true, desc: 'Receiving destination' },
          ],
        },
        MIGO: {
          tcode: 'MIGO',
          screenTitle: 'Goods Receipt Movement 101',
          menuPath: 'Logistics -> MM -> Inventory -> Goods Movement (MIGO)',
          fields: [
            { name: 'Movement Type 101', required: true, desc: 'Standard warehouse inventory receipt' },
            { name: 'PO Line Ref', required: true, desc: 'Purchase Order document tracking' },
          ],
        },
        MIRO: {
          tcode: 'MIRO',
          screenTitle: 'Logistics Invoice Verification (3-Way)',
          menuPath: 'Logistics -> MM -> Invoice Verification (MIRO)',
          fields: [
            { name: 'Invoice Date & Amount', required: true, desc: 'Vendor billed total' },
            { name: 'PO Reference', required: true, desc: '3-Way quantity & price match' },
          ],
        },
        MM01: {
          tcode: 'MM01',
          screenTitle: 'Create Material Master',
          menuPath: 'Logistics -> MM -> Material Master -> Create (MM01)',
          fields: [
            { name: 'Industry Sector & Type', required: true, desc: 'Material category classification' },
            { name: 'Base Unit of Measure', required: true, desc: 'Standard inventory unit' },
          ],
        },
      };
      sapLayoutInfo = sapMap[detectedTcode] || sapMap.ME21N;
    } else if (sectionCode) {
      cueType = 'code';
      actionBadge = `${sectionCode.language.toUpperCase()} Architecture`;
    } else if (lowerTitle.includes('foundation') || lowerTitle.includes('concept') || lowerTitle.includes('theor')) {
      actionBadge = 'Core Theory';
    } else if (lowerTitle.includes('scenario') || lowerTitle.includes('use case') || lowerTitle.includes('business')) {
      actionBadge = 'Enterprise Scenario';
    } else if (lowerTitle.includes('lab') || lowerTitle.includes('exercise') || lowerTitle.includes('hands-on') || lowerBody.includes('lab exercise')) {
      actionBadge = 'Hands-on Lab';
      cueType = 'lab';
    } else if (lowerTitle.includes('assessment') || lowerTitle.includes('challenge') || lowerTitle.includes('quiz')) {
      actionBadge = 'Certification Quiz';
    }

    // Determine visual screen cue description
    let visualCue = `[VISUAL CUE: Display structured slide presentation on ${sec.title}]`;
    let screenImgUrl: string | undefined = sec.images[0]?.url;

    if (!screenImgUrl && allImages.length > 0) {
      const matched = allImages.find((img) =>
        lowerTitle.split(' ').some((word) => word.length > 3 && img.alt.toLowerCase().includes(word))
      );
      if (matched) screenImgUrl = matched.url;
      else if (idx === 0) screenImgUrl = allImages[0]?.url;
    }

    if (cueType === 'sap_layout') {
      visualCue = `[VISUAL SCREEN CUE: Display SAP ${detectedTcode} Layout & Header/Item Field Overview]`;
    } else if (cueType === 'code' && sectionCode) {
      visualCue = `[VISUAL CODE CUE: Display ${sectionCode.language.toUpperCase()} Technical Structure & IDE Layout]`;
    } else if (screenImgUrl) {
      visualCue = `[VISUAL SCREEN CUE: Present screen mockup: ${sec.images[0]?.alt || sec.title}]`;
    } else if (cueType === 'lab') {
      visualCue = `[STUDIO LAB CUE: Interactive Lab Terminal & Step-by-Step Exercise Checklist]`;
    }

    // Extract key bullet points for visual slide card
    const bulletLines = sec.bodyLines
      .filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* ') || /^\d+\.\s/.test(l.trim()))
      .map((l) => l.replace(/^[-*]\s+|\d+\.\s+/, '').replace(/\*\*/g, '').trim())
      .filter((l) => l.length > 5 && l.length < 120)
      .slice(0, 4);

    const keyBulletPoints =
      bulletLines.length > 0
        ? bulletLines
        : [
            `Key operational principles of ${sec.title}`,
            'Step-by-step enterprise execution sequence',
            'System validation and compliance safeguards',
          ];

    const startSec = accumulatedSeconds;
    const endSec = accumulatedSeconds + estimatedSeconds;
    const formattedStart = formatTimeCode(startSec);
    const durationFormatted = formatTimeCode(estimatedSeconds);
    const topicNumber = `${chapterNumber}.${cueIdx}`;
    const cleanSectionTitle = sec.title.replace(/^Module\s+\d+:\s*|^Book\s+\d+:\s*/i, '');

    // Dynamically build content-grounded milestone checkpoint quiz
    const checkpointExam = {
      id: `quiz_${chapterNumber}_${cueIdx}`,
      topicNumber,
      topicTitle: cleanSectionTitle,
      question: `What is the core principle or requirement of "${cleanSectionTitle}"?`,
      options: [
        keyBulletPoints[0] || `Standard domain compliance and verified execution of ${cleanSectionTitle}`,
        `Bypassing required validation steps to accelerate runtime execution`,
        `Ignoring baseline architectural patterns and error-handling routines`,
        `Arbitrary manual override without system auditing or logging`,
      ],
      correctIndex: 0,
      explanation: `Verified correct according to curriculum standards. ${cleanSectionTitle} requires structured execution, quality compliance, and disciplined verification.`,
    };

    cues.push({
      id: `cue_${chapterNumber}_${cueIdx}`,
      topicNumber,
      title: cleanSectionTitle,
      timestamp: formattedStart,
      startSeconds: startSec,
      endSeconds: endSec,
      durationSeconds: estimatedSeconds,
      durationFormatted,
      narratorScript: narratorSpeech,
      visualScreenCue: visualCue,
      screenTitle: sec.title,
      imageUrl: screenImgUrl,
      keyBulletPoints,
      actionBadge,
      cueType,
      codeSnippet: sectionCode,
      sapLayout: sapLayoutInfo,
      checkpointExam,
    });

    accumulatedSeconds = endSec;
    cueIdx++;
  });

  return {
    chapterNumber,
    chapterTitle,
    totalDurationFormatted: formatTimeCode(accumulatedSeconds),
    totalSeconds: accumulatedSeconds,
    cues,
  };
}

/**
 * AI helper to generate enhanced broadcast-quality masterclass production scripts with timecodes.
 */
export async function generateAIEnhancedMasterclassScript(
  chapterTitle: string,
  chapterContent: string,
  targetAudience?: string
): Promise<string> {
  const audienceClause = targetAudience
    ? `\nTARGET AUDIENCE / STUDIED BY: ${targetAudience}\nAdapt pacing, case studies, terminology, and visual lab directives to suit: ${targetAudience}.`
    : '';

  const prompt = `You are the Master Educational Director and Screenplay Producer for Ila Academy Masterclasses.
Your task is to transform this chapter into an engaging, multi-segment video masterclass production script.

CHAPTER: ${chapterTitle}
${audienceClause}

SOURCE MATERIAL:
${chapterContent.substring(0, 10000)}

CRITICAL ANTI-HARDCODING RULES:
- Derive all visuals, screen directives, demos, and terminology purely from the course subject. Never inject unrelated enterprise tools (like SAP) unless this subject specifically is SAP.

INSTRUCTIONS:
Format the output as a professional production script with:
1. Exact Timestamps (e.g. [00:00 - 02:30], [02:30 - 05:45])
2. VISUAL SCREEN CUE: Directives for screen recordings, live UI walkthroughs, diagrams, code IDEs, slides, and whiteboard graphics.
3. INSTRUCTOR VOICEOVER: Engaging, authoritative, high-energy teaching narrative matching the learner background.
4. LAB ACTION & DEMO: Step-by-step clicks, keystrokes, formulas, or procedures.

Generate the full professional video masterclass production script.`;

  return generateIlaResponse(prompt, [], [], undefined, targetAudience);
}

/**
 * Video Rendering Engine types supporting modular API hooks and local open-source models.
 */
export type VideoRenderEngineType =
  | 'ila-studio-canvas'
  | 'heygen-avatar-api'
  | 'did-avatar-api'
  | 'local-open-source';

export interface VideoPipelineConfig {
  engine: VideoRenderEngineType;
  avatarStyle: 'executive-professor' | 'tech-lead' | 'academic-scholar' | 'interactive-coach';
  resolution: '1080p' | '4k';
  fps: 30 | 60;
  lipSyncSmoothing: boolean;
  exportFormat: 'mp4' | 'webm' | 'srt' | 'cue-sheet';
  apiKey?: string;
  customEndpoint?: string;
}

export const DEFAULT_VIDEO_PIPELINE_CONFIG: VideoPipelineConfig = {
  engine: 'ila-studio-canvas',
  avatarStyle: 'executive-professor',
  resolution: '1080p',
  fps: 30,
  lipSyncSmoothing: true,
  exportFormat: 'mp4',
};

/**
 * Generates industry-standard SRT Subtitle File content for the video cues.
 */
export function generateSrtSubtitles(
  script: ChapterVideoScript,
  localizedNarrations?: Record<string, string>
): string {
  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
  };

  return script.cues
    .map((cue, index) => {
      const text = localizedNarrations?.[cue.id] || cue.narratorScript;
      return `${index + 1}\n${formatSrtTime(cue.startSeconds)} --> ${formatSrtTime(cue.endSeconds)}\n${text}\n`;
    })
    .join('\n');
}

/**
 * Generates a complete studio production manifest package for video rendering pipelines.
 */
export function generateStudioProductionManifest(
  script: ChapterVideoScript,
  config: VideoPipelineConfig,
  activeLanguage: string = 'en-US',
  activeVoiceId: string = 'coqui-xtts-multilingual',
  localizedNarrations?: Record<string, string>
): string {
  const manifest = {
    schemaVersion: '2.0-masterclass',
    generatedAt: new Date().toISOString(),
    courseMetadata: {
      chapterNumber: script.chapterNumber,
      chapterTitle: script.chapterTitle,
      totalDurationSeconds: script.totalSeconds,
      totalDurationFormatted: script.totalDurationFormatted,
      totalSegments: script.cues.length,
    },
    pipelineSettings: {
      ...config,
      activeLanguage,
      activeVoiceProfile: activeVoiceId,
      ttsEngine: 'coqui-xtts-v2',
    },
    cues: script.cues.map((c) => ({
      id: c.id,
      topicNumber: c.topicNumber,
      title: c.title,
      timecode: {
        start: c.startSeconds,
        end: c.endSeconds,
        duration: c.durationSeconds,
        timestamp: c.timestamp,
      },
      visualDirectives: {
        actionBadge: c.actionBadge,
        visualCue: c.visualScreenCue,
        screenImageUrl: c.imageUrl || null,
        codeSnippet: c.codeSnippet || null,
        sapLayout: c.sapLayout || null,
      },
      audioDialogue: {
        spokenText: localizedNarrations?.[c.id] || c.narratorScript,
        originalText: c.narratorScript,
        language: activeLanguage,
      },
    })),
  };

  return JSON.stringify(manifest, null, 2);
}
