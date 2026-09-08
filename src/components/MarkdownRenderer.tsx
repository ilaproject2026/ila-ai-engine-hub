import { useState, type ReactNode } from 'react';
import { Copy, Check, ExternalLink, Image as ImageIcon, ZoomIn, X, AlertTriangle, Sparkles, Video } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  onEditSection?: (headingTitle: string) => void;
  onPlayClassVideo?: (headingTitle: string) => void;
}

export default function MarkdownRenderer({ content, onEditSection, onPlayClassVideo }: MarkdownRendererProps) {
  const [zoomImageUrl, setZoomImageUrl] = useState<{ url: string; alt: string } | null>(null);

  // Parse lines and blocks
  const renderMarkdown = (text: string): ReactNode[] => {
    if (!text) return [];

    const lines = text.split('\n');
    const elements: ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';
    let tableRows: string[] = [];
    let inTable = false;

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        elements.push(
          <div
            key={key}
            style={{
              overflowX: 'auto',
              margin: '1rem 0',
              borderRadius: '0.625rem',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(10, 13, 20, 0.6)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <tbody>
                {tableRows.map((row, rIdx) => {
                  const cells = row
                    .split('|')
                    .map((c) => c.trim())
                    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
                  
                  const isHeader = rIdx === 0;
                  const isDivider = row.includes('---');
                  if (isDivider) return null;

                  return (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: isHeader ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                      }}
                    >
                      {cells.map((cell, cIdx) =>
                        isHeader ? (
                          <th
                            key={cIdx}
                            style={{
                              padding: '0.65rem 0.85rem',
                              textAlign: 'left',
                              fontWeight: 600,
                              color: '#ffffff',
                            }}
                          >
                            {renderInlineFormatting(cell)}
                          </th>
                        ) : (
                          <td
                            key={cIdx}
                            style={{
                              padding: '0.6rem 0.85rem',
                              color: 'var(--text-main)',
                            }}
                          >
                            {renderInlineFormatting(cell)}
                          </td>
                        )
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code Block Start/End
      if (line.trim().startsWith('```')) {
        if (inTable) flushTable(`table-${i}`);

        if (inCodeBlock) {
          // End of code block
          const codeString = codeBlockContent.join('\n');
          elements.push(
            <CodeBlockCard
              key={`code-${i}`}
              code={codeString}
              language={codeBlockLang || 'code'}
            />
          );
          codeBlockContent = [];
          codeBlockLang = '';
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
          codeBlockLang = line.trim().replace(/^```/, '').trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Table Detection
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        inTable = true;
        tableRows.push(line.trim());
        continue;
      } else if (inTable) {
        flushTable(`table-${i}`);
      }

      // Standalone Image: ![Alt text](url)
      const imageMatch = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imageMatch) {
        const altText = imageMatch[1] || 'UI Screen / Diagram';
        const imgUrl = imageMatch[2].trim();
        elements.push(
          <MarkdownImageCard
            key={`img-${i}`}
            url={imgUrl}
            alt={altText}
            onZoom={() => setZoomImageUrl({ url: imgUrl, alt: altText })}
          />
        );
        continue;
      }

      // Headings with Anchor Target IDs for Smooth Hyperlink Scrolling
      if (line.startsWith('# ')) {
        const headingText = line.slice(2).trim();
        const headingId = `heading-${headingText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        elements.push(
          <div
            key={`h1-wrap-${i}`}
            id={headingId}
            style={{
              scrollMarginTop: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '1.25rem 0 0.75rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              paddingBottom: '0.4rem',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <h1
              style={{
                fontSize: '1.5rem',
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {renderInlineFormatting(headingText)}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {onPlayClassVideo && (
                <button
                  type="button"
                  onClick={() => onPlayClassVideo(headingText)}
                  style={{
                    background: 'rgba(236, 72, 153, 0.15)',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    borderRadius: '0.4rem',
                    color: '#f472b6',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 0.15s ease',
                  }}
                  title="Watch Masterclass Video for this section"
                >
                  <Video size={11} />
                  <span>Class Video</span>
                </button>
              )}
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection(headingText)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '0.4rem',
                    color: 'var(--text-subtle)',
                    padding: '0.2rem 0.45rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                  title="Edit this section with AI instructions"
                >
                  <Sparkles size={11} color="var(--accent-primary)" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>
        );
        continue;
      }
      if (line.startsWith('## ')) {
        const headingText = line.slice(3).trim();
        const headingId = `heading-${headingText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        elements.push(
          <div
            key={`h2-wrap-${i}`}
            id={headingId}
            style={{
              scrollMarginTop: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '1.15rem 0 0.6rem',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--accent-primary)',
                margin: 0,
              }}
            >
              {renderInlineFormatting(headingText)}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {onPlayClassVideo && (
                <button
                  type="button"
                  onClick={() => onPlayClassVideo(headingText)}
                  style={{
                    background: 'rgba(236, 72, 153, 0.15)',
                    border: '1px solid rgba(236, 72, 153, 0.35)',
                    borderRadius: '0.4rem',
                    color: '#f472b6',
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 0.15s ease',
                  }}
                  title="Watch Masterclass Video for this section"
                >
                  <Video size={11} />
                  <span>Class Video</span>
                </button>
              )}
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection(headingText)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '0.4rem',
                    color: 'var(--text-subtle)',
                    padding: '0.2rem 0.45rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                  title="Edit this section with AI instructions"
                >
                  <Sparkles size={11} color="var(--accent-primary)" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>
        );
        continue;
      }
      if (line.startsWith('### ')) {
        const headingText = line.slice(4).trim();
        const headingId = `heading-${headingText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        elements.push(
          <div
            key={`h3-wrap-${i}`}
            id={headingId}
            style={{
              scrollMarginTop: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '0.9rem 0 0.4rem',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <h3
              style={{
                fontSize: '1.05rem',
                fontWeight: 600,
                color: '#e2e8f0',
                margin: 0,
              }}
            >
              {renderInlineFormatting(headingText)}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {onPlayClassVideo && (
                <button
                  type="button"
                  onClick={() => onPlayClassVideo(headingText)}
                  style={{
                    background: 'rgba(236, 72, 153, 0.12)',
                    border: '1px solid rgba(236, 72, 153, 0.3)',
                    borderRadius: '0.35rem',
                    color: '#f472b6',
                    padding: '0.15rem 0.4rem',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                  }}
                  title="Watch Masterclass Video for this section"
                >
                  <Video size={10} />
                  <span>Class Video</span>
                </button>
              )}
              {onEditSection && (
                <button
                  type="button"
                  onClick={() => onEditSection(headingText)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '0.4rem',
                    color: 'var(--text-subtle)',
                    padding: '0.2rem 0.45rem',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                  title="Edit this section with AI instructions"
                >
                  <Sparkles size={11} color="var(--accent-primary)" />
                  <span>Edit</span>
                </button>
              )}
            </div>
          </div>
        );
        continue;
      }
      if (line.startsWith('#### ')) {
        const headingText = line.slice(5).trim();
        const headingId = `heading-${headingText.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
        elements.push(
          <div
            key={`h4-wrap-${i}`}
            id={headingId}
            style={{
              scrollMarginTop: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '0.75rem 0 0.35rem',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <h4
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#cbd5e1',
                margin: 0,
              }}
            >
              {renderInlineFormatting(headingText)}
            </h4>
            {onEditSection && (
              <button
                type="button"
                onClick={() => onEditSection(headingText)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '0.4rem',
                  color: 'var(--text-subtle)',
                  padding: '0.2rem 0.45rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
                title="Edit this section with AI instructions"
              >
                <Sparkles size={11} color="var(--accent-primary)" />
                <span>Edit</span>
              </button>
            )}
          </div>
        );
        continue;
      }

      // Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`quote-${i}`}
            style={{
              margin: '0.65rem 0',
              padding: '0.65rem 1rem',
              background: 'rgba(99, 102, 241, 0.08)',
              borderLeft: '3px solid var(--accent-primary)',
              borderRadius: '0 0.5rem 0.5rem 0',
              fontSize: '0.9rem',
              color: 'var(--text-main)',
              fontStyle: 'normal',
            }}
          >
            {renderInlineFormatting(line.slice(2))}
          </blockquote>
        );
        continue;
      }

      // Unordered list items (- or *)
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(
          <div
            key={`list-${i}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              margin: '0.25rem 0',
              paddingLeft: '0.5rem',
              fontSize: '0.95rem',
              lineHeight: '1.6',
            }}
          >
            <span
              style={{
                color: 'var(--accent-primary)',
                fontWeight: 700,
                marginTop: '0.1rem',
                fontSize: '1.1rem',
              }}
            >
              •
            </span>
            <span style={{ flex: 1 }}>{renderInlineFormatting(line.trim().slice(2))}</span>
          </div>
        );
        continue;
      }

      // Numbered list items (1., 2., etc.)
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        elements.push(
          <div
            key={`numlist-${i}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              margin: '0.3rem 0',
              paddingLeft: '0.5rem',
              fontSize: '0.95rem',
              lineHeight: '1.6',
            }}
          >
            <span
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
                fontWeight: 700,
                fontSize: '0.75rem',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '0.15rem',
              }}
            >
              {numMatch[1]}
            </span>
            <span style={{ flex: 1 }}>{renderInlineFormatting(numMatch[2])}</span>
          </div>
        );
        continue;
      }

      // Horizontal Rule
      if (line.trim() === '---' || line.trim() === '***') {
        elements.push(
          <hr
            key={`hr-${i}`}
            style={{
              border: 'none',
              borderTop: '1px solid var(--border-subtle)',
              margin: '1.25rem 0',
            }}
          />
        );
        continue;
      }

      // Empty line
      if (!line.trim()) {
        elements.push(<div key={`empty-${i}`} style={{ height: '0.5rem' }} />);
        continue;
      }

      // Standard Paragraph with inline formatting and embedded inline images
      elements.push(
        <p
          key={`p-${i}`}
          style={{
            margin: '0.35rem 0',
            lineHeight: '1.7',
            fontSize: '0.98rem',
            color: 'var(--text-main)',
          }}
        >
          {renderInlineFormatting(line)}
        </p>
      );
    }

    if (inTable) flushTable('table-end');

    return elements;
  };

  // Helper to render bold (**), inline code (`), links ([text](url)), and inline images
  const renderInlineFormatting = (text: string): ReactNode => {
    // Check for inline images first: ![alt](url)
    const parts: ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Find markdown image
      const imgMatch = remaining.match(/!\[(.*?)\]\((.*?)\)/);
      // Find bold
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      // Find inline code
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Find link
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      // Find which comes first
      const matches = [
        imgMatch ? { type: 'img', index: imgMatch.index!, match: imgMatch } : null,
        boldMatch ? { type: 'bold', index: boldMatch.index!, match: boldMatch } : null,
        codeMatch ? { type: 'code', index: codeMatch.index!, match: codeMatch } : null,
        linkMatch ? { type: 'link', index: linkMatch.index!, match: linkMatch } : null,
      ].filter(Boolean) as Array<{ type: string; index: number; match: RegExpMatchArray }>;

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      // Sort by earliest match
      matches.sort((a, b) => a.index - b.index);
      const first = matches[0];

      // Add text before match
      if (first.index > 0) {
        parts.push(remaining.substring(0, first.index));
      }

      // Process match
      if (first.type === 'img') {
        const altText = first.match[1] || 'Screenshot';
        const imgUrl = first.match[2].trim();
        parts.push(
          <MarkdownImageCard
            key={`inline-img-${keyIdx++}`}
            url={imgUrl}
            alt={altText}
            onZoom={() => setZoomImageUrl({ url: imgUrl, alt: altText })}
          />
        );
      } else if (first.type === 'bold') {
        parts.push(
          <strong key={`bold-${keyIdx++}`} style={{ fontWeight: 700, color: '#ffffff' }}>
            {first.match[1]}
          </strong>
        );
      } else if (first.type === 'code') {
        parts.push(
          <code
            key={`code-${keyIdx++}`}
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#a5b4fc',
              padding: '0.15rem 0.4rem',
              borderRadius: '0.3rem',
              fontSize: '0.88rem',
              fontFamily: 'var(--font-mono)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            {first.match[1]}
          </code>
        );
      } else if (first.type === 'link') {
        parts.push(
          <a
            key={`link-${keyIdx++}`}
            href={first.match[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--accent-primary)',
              textDecoration: 'underline',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            <span>{first.match[1]}</span>
            <ExternalLink size={11} />
          </a>
        );
      }

      remaining = remaining.substring(first.index + first.match[0].length);
    }

    return parts;
  };

  return (
    <div style={{ width: '100%' }}>
      {renderMarkdown(content)}

      {/* Lightbox Image Zoom Modal */}
      {zoomImageUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 300,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
          onClick={() => setZoomImageUrl(null)}
        >
          <div
            className="animate-fade-in"
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: 'rgba(18, 24, 38, 0.95)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '1rem',
              padding: '1.25rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              style={{
                position: 'absolute',
                top: '0.75rem',
                right: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>

            <img
              src={zoomImageUrl.url}
              alt={zoomImageUrl.alt}
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '0.5rem',
              }}
            />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {zoomImageUrl.alt}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Markdown Image Card Component with fallback UI Mockup if external image fails
function MarkdownImageCard({
  url,
  alt,
  onZoom,
}: {
  url: string;
  alt: string;
  onZoom: () => void;
}) {
  const [hasError, setHasError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  return (
    <div
      style={{
        margin: '1.25rem 0',
        borderRadius: '0.875rem',
        border: '1px solid var(--border-subtle)',
        background: 'rgba(10, 13, 20, 0.7)',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px -3px var(--accent-glow)',
      }}
    >
      {/* Card Header with Screenshot Tag & Zoom */}
      <div
        style={{
          padding: '0.5rem 0.85rem',
          background: 'rgba(18, 24, 38, 0.8)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
          <ImageIcon size={14} />
          <span>Screen Visual / UI Screenshot: {alt}</span>
        </div>

        {!hasError && (
          <button
            type="button"
            onClick={onZoom}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.35rem',
              color: 'var(--text-muted)',
              padding: '0.2rem 0.45rem',
              fontSize: '0.72rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <ZoomIn size={12} />
            <span>Zoom</span>
          </button>
        )}
      </div>

      {/* Image or Simulated UI Mockup View */}
      {!hasError ? (
        <div
          style={{
            position: 'relative',
            background: '#0d1117',
            textAlign: 'center',
            padding: '0.5rem',
            cursor: 'pointer',
          }}
          onClick={onZoom}
        >
          {loading && (
            <div
              style={{
                height: '180px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-subtle)',
                fontSize: '0.85rem',
              }}
            >
              Loading UI Screen...
            </div>
          )}
          <img
            src={url}
            alt={alt}
            onLoad={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setHasError(true);
            }}
            style={{
              maxWidth: '100%',
              maxHeight: '420px',
              objectFit: 'contain',
              borderRadius: '0.5rem',
              display: loading ? 'none' : 'inline-block',
            }}
          />
        </div>
      ) : (
        /* Fallback High-Fidelity UI Frame if remote host blocks hotlinking */
        <div
          style={{
            padding: '1.25rem',
            background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.9) 0%, rgba(10, 13, 20, 0.9) 100%)',
            border: '1px dashed rgba(99, 102, 241, 0.3)',
            borderRadius: '0 0 0.875rem 0.875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertTriangle size={16} />
            <span>Interactive SAP / Enterprise UI Blueprint: {alt}</span>
          </div>

          <div
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '0.5rem',
              padding: '0.85rem',
              fontSize: '0.82rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-main)',
              lineHeight: '1.6',
            }}
          >
            <div><strong>System View:</strong> {alt}</div>
            <div style={{ color: 'var(--text-muted)' }}>Target Image: {url}</div>
          </div>
        </div>
      )}

      {/* Caption footer */}
      <div
        style={{
          padding: '0.4rem 0.85rem',
          background: 'rgba(18, 24, 38, 0.5)',
          fontSize: '0.75rem',
          color: 'var(--text-subtle)',
          textAlign: 'center',
        }}
      >
        {alt} • Click image to zoom & inspect UI elements
      </div>
    </div>
  );
}

// Code Block Component with Copy Button
function CodeBlockCard({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard copy failed
    }
  };

  return (
    <div
      style={{
        margin: '1rem 0',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-subtle)',
        background: 'rgba(10, 13, 20, 0.95)',
        overflow: 'hidden',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        style={{
          padding: '0.45rem 0.85rem',
          background: 'rgba(18, 24, 38, 0.8)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-subtle)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? 'var(--success)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.72rem',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      <pre
        style={{
          padding: '1rem',
          overflowX: 'auto',
          fontSize: '0.85rem',
          lineHeight: '1.6',
          fontFamily: 'var(--font-mono)',
          color: '#f8fafc',
          margin: 0,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
