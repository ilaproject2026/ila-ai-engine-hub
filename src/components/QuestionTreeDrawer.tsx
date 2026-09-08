import { useState, useMemo } from 'react';
import {
  X,
  Search,
  MessageSquare,
  ArrowUpRight,
  Sparkles,
  FileText,
  Clock,
  ListTree,
  ChevronRight,
  CornerDownRight,
  Hash,
} from 'lucide-react';
import type { ChatMessage } from '../services/dbService';

export interface QuestionTreeItem {
  questionIndex: number; // 1-indexed
  userMessage: ChatMessage;
  assistantMessage?: ChatMessage;
}

interface QuestionTreeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  activeQuestionId: string | null;
  onJumpToMessage: (messageId: string) => void;
}

export default function QuestionTreeDrawer({
  isOpen,
  onClose,
  messages,
  activeQuestionId,
  onJumpToMessage,
}: QuestionTreeDrawerProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Pair up user questions with their corresponding assistant answers
  const questionPairs: QuestionTreeItem[] = useMemo(() => {
    const pairs: QuestionTreeItem[] = [];
    let qCounter = 0;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user') {
        qCounter++;
        // Find next assistant message if any
        let asstMsg: ChatMessage | undefined;
        if (i + 1 < messages.length && messages[i + 1].role === 'assistant') {
          asstMsg = messages[i + 1];
        }
        pairs.push({
          questionIndex: qCounter,
          userMessage: msg,
          assistantMessage: asstMsg,
        });
      }
    }

    return pairs;
  }, [messages]);

  // Filtered by search
  const filteredPairs = useMemo(() => {
    if (!searchTerm.trim()) return questionPairs;
    const term = searchTerm.toLowerCase().trim();
    return questionPairs.filter(
      (p) =>
        p.userMessage.content.toLowerCase().includes(term) ||
        (p.assistantMessage && p.assistantMessage.content.toLowerCase().includes(term))
    );
  }, [questionPairs, searchTerm]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(5, 8, 15, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          height: '100%',
          background: 'rgba(12, 16, 26, 0.98)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 101,
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(18, 24, 38, 0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '0.5rem',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px var(--accent-glow)',
              }}
            >
              <ListTree size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                  Question Tree Navigation
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.5rem',
                    borderRadius: '9999px',
                    background: 'rgba(99, 102, 241, 0.25)',
                    border: '1px solid rgba(99, 102, 241, 0.45)',
                    color: '#a5b4fc',
                  }}
                >
                  {questionPairs.length} {questionPairs.length === 1 ? 'Question' : 'Questions'}
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                Jump directly to any question & answer in this session
              </p>
            </div>
          </div>

          <button
            id="close-question-tree-btn"
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.4rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Close Question Tree"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search / Filter Bar */}
        {questionPairs.length > 2 && (
          <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(10, 13, 20, 0.6)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '0.6rem',
                padding: '0.4rem 0.75rem',
              }}
            >
              <Search size={14} color="var(--text-subtle)" style={{ marginRight: '0.5rem', flexShrink: 0 }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter questions or answers..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-subtle)',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tree List Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {filteredPairs.length === 0 ? (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                padding: '2rem 1rem',
                color: 'var(--text-subtle)',
              }}
            >
              <MessageSquare size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                {questionPairs.length === 0
                  ? 'No questions asked in this session yet.'
                  : 'No matching questions found.'}
              </p>
              <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                {questionPairs.length === 0
                  ? 'Type your prompt in the search bar above to create a course!'
                  : 'Try clearing your search query.'}
              </p>
            </div>
          ) : (
            filteredPairs.map((item) => {
              const isActive =
                activeQuestionId === item.userMessage.id ||
                (item.assistantMessage && activeQuestionId === item.assistantMessage.id);

              return (
                <div
                  key={item.userMessage.id}
                  id={`tree-item-${item.userMessage.id}`}
                  style={{
                    position: 'relative',
                    background: isActive
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.12) 100%)'
                      : 'rgba(18, 24, 38, 0.6)',
                    border: isActive
                      ? '1px solid rgba(99, 102, 241, 0.55)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: '0.875rem',
                    padding: '1rem',
                    boxShadow: isActive
                      ? '0 0 20px rgba(99, 102, 241, 0.25)'
                      : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => {
                    onJumpToMessage(item.userMessage.id);
                    onClose();
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
                      e.currentTarget.style.background = 'rgba(26, 35, 55, 0.75)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.background = 'rgba(18, 24, 38, 0.6)';
                    }
                  }}
                >
                  {/* Top Line: Q Index Badge, Timestamp, Active Pill */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '0.625rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.35rem',
                          background: isActive
                            ? 'var(--accent-gradient)'
                            : 'rgba(99, 102, 241, 0.2)',
                          color: '#ffffff',
                          border: isActive ? 'none' : '1px solid rgba(99, 102, 241, 0.35)',
                        }}
                      >
                        <Hash size={11} />
                        Q{item.questionIndex}
                      </span>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                        }}
                      >
                        <Clock size={11} />
                        {formatTimestamp(item.userMessage.timestamp)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {isActive && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.45rem',
                            borderRadius: '9999px',
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#34d399',
                          }}
                        >
                          Viewing
                        </span>
                      )}

                      <span
                        style={{
                          color: isActive ? 'var(--accent-primary)' : 'var(--text-subtle)',
                          display: 'flex',
                        }}
                      >
                        <ArrowUpRight size={14} />
                      </span>
                    </div>
                  </div>

                  {/* Question Content Prompt */}
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      lineHeight: '1.45',
                      marginBottom: '0.5rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.userMessage.content}
                  </div>

                  {/* Document chips if user attached documents */}
                  {item.userMessage.documents && item.userMessage.documents.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.3rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      {item.userMessage.documents.map((d) => (
                        <span
                          key={d.id}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.4rem',
                            borderRadius: '0.3rem',
                            background: 'rgba(99, 102, 241, 0.15)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(99, 102, 241, 0.25)',
                          }}
                        >
                          <FileText size={10} />
                          {d.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Assistant Response Status/Snippet in Tree */}
                  {item.assistantMessage ? (
                    <div
                      style={{
                        paddingTop: '0.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.73rem',
                          color: 'var(--accent-primary)',
                          fontWeight: 500,
                          minWidth: 0,
                        }}
                      >
                        <CornerDownRight size={13} style={{ flexShrink: 0 }} />
                        <Sparkles size={12} style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.assistantMessage.modelDisplayName || 'ILA AI'}
                          {item.assistantMessage.responseTimeMs
                            ? ` • ${(item.assistantMessage.responseTimeMs / 1000).toFixed(1)}s`
                            : ''}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.assistantMessage) {
                            onJumpToMessage(item.assistantMessage.id);
                            onClose();
                          }
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '0.35rem',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '0.15rem 0.45rem',
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                        }}
                      >
                        <span>Answer</span>
                        <ChevronRight size={11} />
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        paddingTop: '0.4rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        fontSize: '0.72rem',
                        color: 'var(--text-subtle)',
                        fontStyle: 'italic',
                      }}
                    >
                      Generating response...
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(18, 24, 38, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: 'var(--text-subtle)',
          }}
        >
          <span>Click any question to jump</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
