import { useState, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react';
import {
  Sparkles,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  BookOpen,
  Layers,
  X,
} from 'lucide-react';
import { useVoice } from '../hooks/useVoice';
import DocumentUploadZone from './DocumentUploadZone';
import { type AttachedDocument } from '../services/dbService';

interface SearchBoxProps {
  onSendMessage: (query: string, documents: AttachedDocument[], targetAudience?: string) => void;
  loading: boolean;
  attachedDocuments: AttachedDocument[];
  onDocumentsChange: (docs: AttachedDocument[]) => void;
  placeholder?: string;
  onNewChat?: () => void;
  isBulkPlannerActive?: boolean;
  onToggleBulkPlanner?: (active: boolean) => void;
  targetAudience?: string;
  onTargetAudienceChange?: (aud: string) => void;
}

export default function SearchBox({
  onSendMessage,
  loading,
  attachedDocuments,
  onDocumentsChange,
  placeholder = 'Create course or ask anything...',
  onNewChat: _onNewChat,
  isBulkPlannerActive = false,
  onToggleBulkPlanner,
  targetAudience: propTargetAudience,
}: SearchBoxProps) {
  const [query, setQuery] = useState<string>('');
  const [showUploadZone, setShowUploadZone] = useState<boolean>(false);
  const targetAudience = propTargetAudience || 'General Student / Lifelong Learner';

  const {
    isListening,
    speechError,
    setSpeechError,
    isRecognitionSupported,
    toggleListening,
  } = useVoice();

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery || loading) return;

    if (isListening) {
      toggleListening(() => { });
    }

    onSendMessage(cleanQuery, attachedDocuments, targetAudience);
    setQuery('');
    setShowUploadZone(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceInputClick = () => {
    toggleListening((transcript) => {
      setQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
    });
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      {/* Search Input Box Card */}
      <div
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '1.25rem',
          padding: '1rem 1.25rem',
          boxShadow: '0 15px 35px -15px rgba(0, 0, 0, 0.5), 0 0 25px -5px var(--accent-glow)',
          transition: 'all 0.3s ease',
        }}
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Main Input Line */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'var(--input-bg)',
              border: isListening
                ? '1px solid rgba(239, 68, 68, 0.6)'
                : '1px solid var(--border-subtle)',
              borderRadius: '0.875rem',
              padding: '0.5rem 0.75rem',
              boxShadow: isListening ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            <div
              style={{
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '0.35rem',
                paddingRight: '0.65rem',
              }}
            >
              <BookOpen size={20} />
            </div>

            <input
              id="ai-search-input"
              type="text"
              value={query}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? 'Listening to your voice... Speak now'
                  : placeholder
              }
              disabled={loading}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-main)',
                fontSize: '0.98rem',
                fontFamily: 'inherit',
                padding: '0.35rem 0',
              }}
            />

            {/* Clear Query button */}
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-subtle)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  marginRight: '0.35rem',
                }}
                title="Clear prompt"
              >
                <X size={15} />
              </button>
            )}

            {/* Voice Input Button */}
            {isRecognitionSupported && (
              <button
                type="button"
                onClick={handleVoiceInputClick}
                disabled={loading}
                style={{
                  background: isListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  border: isListening
                    ? '1px solid rgba(239, 68, 68, 0.5)'
                    : '1px solid var(--border-subtle)',
                  borderRadius: '0.6rem',
                  color: isListening ? '#ef4444' : 'var(--text-main)',
                  padding: '0.45rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.5rem',
                  transition: 'all 0.2s ease',
                }}
                title={isListening ? 'Stop listening' : 'Speak your prompt'}
              >
                {isListening ? (
                  <MicOff size={16} className="animate-pulse" />
                ) : (
                  <Mic size={16} />
                )}
              </button>
            )}

            {/* Submit Prompt Button */}
            <button
              id="ai-submit-button"
              type="submit"
              disabled={!query.trim() || loading}
              style={{
                background:
                  !query.trim() || loading
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'var(--accent-gradient)',
                border: 'none',
                borderRadius: '0.65rem',
                color: !query.trim() || loading ? 'var(--text-subtle)' : '#ffffff',
                padding: '0.45rem 1.15rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: !query.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow:
                  !query.trim() || loading ? 'none' : '0 4px 15px var(--accent-glow)',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Create</span>
                </>
              )}
            </button>
          </div>

          {/* Sub-bar: Document Attachment Trigger, Bulk Task Planner Toggle & Attached Count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              color: 'var(--text-subtle)',
              paddingTop: '0.1rem',
              flexWrap: 'wrap',
              gap: '0.45rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              {/* Document Attachment Button */}
              <button
                type="button"
                onClick={() => setShowUploadZone(!showUploadZone)}
                style={{
                  background: showUploadZone ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: showUploadZone ? '1px solid rgba(99, 102, 241, 0.35)' : 'none',
                  color: showUploadZone ? 'var(--accent-primary)' : 'var(--text-muted)',
                  borderRadius: '0.45rem',
                  padding: '0.25rem 0.6rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
              >
                <Paperclip size={13} />
                <span>
                  {attachedDocuments.length > 0
                    ? `${attachedDocuments.length} ${attachedDocuments.length === 1 ? 'Document' : 'Documents'
                    } Attached`
                    : 'Attach Syllabus / Reference Documents'}
                </span>
              </button>

              {/* Bulk Task Planner Trigger Link / Toggle */}
              {onToggleBulkPlanner && (
                <button
                  id="bulk-task-planner-toggle-btn"
                  type="button"
                  onClick={() => onToggleBulkPlanner(!isBulkPlannerActive)}
                  style={{
                    background: isBulkPlannerActive
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.25) 100%)'
                      : 'transparent',
                    border: isBulkPlannerActive
                      ? '1px solid rgba(165, 180, 252, 0.45)'
                      : '1px solid transparent',
                    color: isBulkPlannerActive ? '#c7d2fe' : 'var(--text-muted)',
                    borderRadius: '0.45rem',
                    padding: '0.25rem 0.6rem',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.78rem',
                    fontWeight: isBulkPlannerActive ? 700 : 500,
                    boxShadow: isBulkPlannerActive
                      ? '0 0 10px rgba(99, 102, 241, 0.25)'
                      : 'none',
                    transition: 'all 0.15s ease',
                  }}
                  title="Bulk Task Planner: Automatically decompose and sequentially execute comprehensive multi-book courses"
                >
                  <Layers size={13} color={isBulkPlannerActive ? '#a5b4fc' : undefined} />
                  <span>Bulk Task Planner</span>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '0.05rem 0.35rem',
                      borderRadius: '9999px',
                      background: isBulkPlannerActive
                        ? 'var(--accent-gradient)'
                        : 'rgba(255, 255, 255, 0.08)',
                      color: isBulkPlannerActive ? '#ffffff' : 'var(--text-subtle)',
                      border: isBulkPlannerActive
                        ? 'none'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {isBulkPlannerActive ? 'Active' : 'Autonomous'}
                  </span>
                </button>
              )}
            </div>

            {/* Hint */}
            <span style={{ fontSize: '0.72rem', opacity: 0.75 }}>
              {isBulkPlannerActive
                ? 'Autonomous Planner Active • Step-by-step modular synthesis'
                : 'Press Enter to create • Multi-turn conversation supported'}
            </span>
          </div>

          {/* Expandable Document Upload Dropzone */}
          {showUploadZone && (
            <div style={{ marginTop: '0.35rem' }}>
              <DocumentUploadZone
                documents={attachedDocuments}
                onDocumentsChange={onDocumentsChange}
                compact={true}
              />
            </div>
          )}

          {/* Voice recognition error notification */}
          {speechError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.5rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--error)',
              }}
            >
              <span>{speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
