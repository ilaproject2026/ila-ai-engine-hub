import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
} from 'docx';

/**
 * Parses markdown text and generates a clean, professionally formatted Word (.docx) document.
 */
export async function generateWordDocxBlob(
  markdownContent: string,
  title: string = 'Ila Academy Course Document'
): Promise<Blob> {
  const lines = markdownContent.split('\n');
  const docChildren: Paragraph[] = [];

  // Document Title Header Banner
  docChildren.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 120, before: 100 },
    })
  );

  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Ila Academy Enterprise Course Creator • Generated on ${new Date().toLocaleDateString(
            undefined,
            { year: 'numeric', month: 'long', day: 'numeric' }
          )}`,
          italics: true,
          size: 18, // 9pt
          color: '64748b',
        }),
      ],
      spacing: { after: 300 },
      border: {
        bottom: {
          color: '6366f1',
          space: 6,
          style: BorderStyle.SINGLE,
          size: 12,
        },
      },
    })
  );

  let inCodeBlock = false;
  let codeBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code block handling
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeBuffer.join('\n'),
                font: 'Consolas',
                size: 18,
                color: '1e293b',
              }),
            ],
            spacing: { before: 100, after: 100 },
          })
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      continue;
    }

    // Empty lines
    if (!trimmed) {
      docChildren.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    // Heading 1 (# ...)
    if (trimmed.startsWith('# ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^#\s+/, ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 120 },
        })
      );
      continue;
    }

    // Heading 2 (## ...)
    if (trimmed.startsWith('## ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^##\s+/, ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
        })
      );
      continue;
    }

    // Heading 3 (### ...)
    if (trimmed.startsWith('### ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^###\s+/, ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 },
        })
      );
      continue;
    }

    // Heading 4 (#### ...)
    if (trimmed.startsWith('#### ')) {
      docChildren.push(
        new Paragraph({
          text: trimmed.replace(/^####\s+/, ''),
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 140, after: 60 },
        })
      );
      continue;
    }

    // Bullet points (- ... or * ...)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const cleanText = trimmed.replace(/^[-*]\s+/, '');
      docChildren.push(
        new Paragraph({
          children: parseInlineFormattedRuns(cleanText),
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Numbered lists (1. ... 2. ...)
    if (/^\d+\.\s+/.test(trimmed)) {
      const cleanText = trimmed.replace(/^\d+\.\s+/, '');
      docChildren.push(
        new Paragraph({
          children: parseInlineFormattedRuns(cleanText),
          bullet: { level: 0 },
          spacing: { after: 60 },
        })
      );
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith('>')) {
      const cleanQuote = trimmed.replace(/^>\s*/, '');
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cleanQuote,
              italics: true,
              color: '334155',
            }),
          ],
          border: {
            left: {
              color: '6366f1',
              space: 10,
              style: BorderStyle.SINGLE,
              size: 24,
            },
          },
          spacing: { before: 100, after: 100 },
        })
      );
      continue;
    }

    // Standard Paragraph with inline bold / italic parsing
    docChildren.push(
      new Paragraph({
        children: parseInlineFormattedRuns(rawLine),
        spacing: { after: 120, line: 276 }, // 1.15 line spacing
      })
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22, // 11pt
            color: '1e293b',
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
        heading1: {
          run: {
            font: 'Calibri',
            size: 32, // 16pt
            bold: true,
            color: '1e1b4b',
          },
          paragraph: {
            spacing: { before: 300, after: 120 },
          },
        },
        heading2: {
          run: {
            font: 'Calibri',
            size: 26, // 13pt
            bold: true,
            color: '312e81',
          },
          paragraph: {
            spacing: { before: 240, after: 100 },
          },
        },
        heading3: {
          run: {
            font: 'Calibri',
            size: 24, // 12pt
            bold: true,
            color: '4338ca',
          },
          paragraph: {
            spacing: { before: 180, after: 80 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                text: 'Ila Academy • Enterprise Course Curriculum',
                alignment: AlignmentType.RIGHT,
                style: 'Normal',
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Page ' }),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun({ text: ' of ' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Downloads a Word (.docx) document in the browser.
 */
export async function downloadWordDocx(
  markdownContent: string,
  title: string
): Promise<void> {
  const blob = await generateWordDocxBlob(markdownContent, title);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const sanitized = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `${sanitized || 'ila_course_curriculum'}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to parse inline markdown formats (bold **text**, italic *text*, `code`).
 */
function parseInlineFormattedRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Regular expression matching **bold**, *italic*, `code`, and plain text
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`|[^*`]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('**') && chunk.endsWith('**')) {
      runs.push(
        new TextRun({
          text: chunk.slice(2, -2),
          bold: true,
        })
      );
    } else if (chunk.startsWith('*') && chunk.endsWith('*')) {
      runs.push(
        new TextRun({
          text: chunk.slice(1, -1),
          italics: true,
        })
      );
    } else if (chunk.startsWith('`') && chunk.endsWith('`')) {
      runs.push(
        new TextRun({
          text: chunk.slice(1, -1),
          font: 'Consolas',
          color: '4338ca',
          size: 20,
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: chunk,
        })
      );
    }
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}
