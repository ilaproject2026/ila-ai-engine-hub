import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  FileImage,
  UploadCloud,
  X,
  Eye,
  Trash2,
  Paperclip,
} from 'lucide-react';
import { parseMultipleFiles, formatFileSize } from '../services/fileParserService';
import type { AttachedDocument } from '../services/dbService';

interface DocumentUploadZoneProps {
  documents: AttachedDocument[];
  onDocumentsChange: (docs: AttachedDocument[]) => void;
  compact?: boolean;
}

export default function DocumentUploadZone({
  documents,
  onDocumentsChange,
  compact = false,
}: DocumentUploadZoneProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [previewDoc, setPreviewDoc] = useState<AttachedDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    try {
      const parsedDocs = await parseMultipleFiles(files);
      // Merge with existing, avoiding duplicates by name
      const existingNames = new Set(documents.map((d) => d.name));
      const newUnique = parsedDocs.filter((d) => !existingNames.has(d.name));
      onDocumentsChange([...documents, ...newUnique]);
    } catch (err) {
      console.error('Failed to parse documents:', err);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemoveDoc = (id: string) => {
    onDocumentsChange(documents.filter((d) => d.id !== id));
    if (previewDoc?.id === id) {
      setPreviewDoc(null);
    }
  };

  const handleClearAll = () => {
    onDocumentsChange([]);
    setPreviewDoc(null);
  };

  const getDocIcon = (name: string, type: string) => {
    if (type.startsWith('image/')) return <FileImage size={15} color="#ec4899" />;
    if (name.endsWith('.csv') || name.endsWith('.xlsx')) return <FileSpreadsheet size={15} color="#10b981" />;
    if (name.endsWith('.json') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.py')) {
      return <FileCode size={15} color="#818cf8" />;
    }
    return <FileText size={15} color="#6366f1" />;
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      {/* Hidden Multi-file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,.json,.csv,.ts,.js,.py,image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        id="multi-doc-file-input"
      />

      {/* Drag & Drop Upload Zone (Full or Compact Button) */}
      {!compact ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: isDragging
              ? '2px dashed var(--accent-primary)'
              : '1px dashed var(--border-subtle)',
            borderRadius: '0.875rem',
            padding: '1.25rem 1.5rem',
            background: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'rgba(10, 13, 20, 0.4)',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            transition: 'all 0.2s ease',
          }}
          id="multi-doc-dropzone"
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              flexShrink: 0,
            }}
          >
            <UploadCloud size={22} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {isProcessing ? 'Processing files...' : 'Upload Course Materials / Documents'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
              Drag & drop multiple files (PDF, DOCX, TXT, MD, CSV, Syllabus) or{' '}
              <span style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                browse files
              </span>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '0.5rem',
            color: 'var(--text-muted)',
            padding: '0.4rem 0.75rem',
            fontSize: '0.8rem',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'all 0.15s ease',
          }}
          title="Upload multiple reference documents"
          id="compact-upload-doc-btn"
        >
          <Paperclip size={14} color="var(--accent-primary)" />
          <span>{isProcessing ? 'Processing...' : 'Attach Documents'}</span>
          {documents.length > 0 && (
            <span
              style={{
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '0.7rem',
                borderRadius: '9999px',
                padding: '0.05rem 0.4rem',
                fontWeight: 700,
              }}
            >
              {documents.length}
            </span>
          )}
        </button>
      )}

      {/* Attached Document Chips Display */}
      {documents.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            alignItems: 'center',
            background: 'rgba(18, 24, 38, 0.5)',
            padding: '0.625rem 0.85rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-subtle)',
          }}
          id="attached-docs-container"
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', fontWeight: 600 }}>
            Attached Context ({documents.length}):
          </span>

          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '0.5rem',
                padding: '0.25rem 0.55rem',
                fontSize: '0.78rem',
                color: 'var(--text-main)',
              }}
            >
              {getDocIcon(doc.name, doc.type)}
              <span
                style={{
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={doc.name}
              >
                {doc.name}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                ({formatFileSize(doc.size)})
              </span>

              {/* View Preview Button */}
              <button
                type="button"
                onClick={() => setPreviewDoc(doc)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Preview extracted document text"
              >
                <Eye size={12} />
              </button>

              {/* Remove Chip Button */}
              <button
                type="button"
                onClick={() => handleRemoveDoc(doc.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  padding: '0.1rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Remove document"
              >
                <X size={13} />
              </button>
            </div>
          ))}

          {/* Clear All Documents Button */}
          <button
            type="button"
            onClick={handleClearAll}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--error)',
              cursor: 'pointer',
              fontSize: '0.72rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              marginLeft: 'auto',
              opacity: 0.8,
            }}
            title="Clear all attached documents"
          >
            <Trash2 size={12} />
            <span>Clear Docs</span>
          </button>
        </div>
      )}

      {/* Document Text Preview Modal */}
      {previewDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="animate-fade-in"
            style={{
              background: 'rgba(18, 24, 38, 0.98)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '1rem',
              width: '100%',
              maxWidth: '650px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {getDocIcon(previewDoc.name, previewDoc.type)}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {previewDoc.name}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                    {formatFileSize(previewDoc.size)} • Extracted Content for ILA AI
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '0.375rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.3rem',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                padding: '1.25rem',
                overflowY: 'auto',
                fontSize: '0.85rem',
                color: 'var(--text-main)',
                lineHeight: '1.6',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                background: 'rgba(10, 13, 20, 0.6)',
              }}
            >
              {previewDoc.dataUrl ? (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <img
                    src={previewDoc.dataUrl}
                    alt={previewDoc.name}
                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '0.5rem' }}
                  />
                </div>
              ) : null}
              {previewDoc.content || 'No text content extracted.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
