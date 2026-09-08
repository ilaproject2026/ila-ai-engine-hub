import { useState, useMemo } from 'react';
import {
  X,
  Trash2,
  Download,
  Search,
  MessageSquare,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Calendar,
  Zap,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import type { ChatHistoryItem } from '../services/dbService';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: ChatHistoryItem[];
  onSelectHistoryItem: (item: ChatHistoryItem) => void;
  onDeleteItem: (id: string) => void;
  onClearAll: () => void;
  onExport: () => void;
  onSpeak: (text: string, id: string) => void;
  activeSpeakingId: string | null;
  isSpeaking: boolean;
}

export default function HistoryDrawer({
  isOpen,
  onClose,
  history,
  onSelectHistoryItem,
  onDeleteItem,
  onClearAll,
  onExport,
  onSpeak,
  activeSpeakingId,
  isSpeaking,
}: HistoryDrawerProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState<boolean>(false);

  // Filter history by search query
  const filteredHistory = useMemo(() => {
    if (!searchTerm.trim()) return history;
    const term = searchTerm.toLowerCase().trim();
    return history.filter(
      (item) =>
        item.query.toLowerCase().includes(term) ||
        item.response.toLowerCase().includes(term) ||
        item.modelDisplayName.toLowerCase().includes(term)
    );
  }, [history, searchTerm]);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Failed to copy
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transition: 'opacity 0.2s ease',
      }}
      onClick={onClose}
      id="history-drawer-backdrop"
    >
      <div
        className="animate-slide-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          background: 'rgba(13, 17, 28, 0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
        id="history-drawer-panel"
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(18, 24, 38, 0.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '0.5rem',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              <Database size={17} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                IndexedDB History
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
                <span>{history.length} saved {history.length === 1 ? 'interaction' : 'interactions'}</span>
                <span>•</span>
                <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                  Persistent Storage
                </span>
              </div>
            </div>
          </div>

          <button
            id="close-history-drawer-btn"
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.5rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            aria-label="Close history drawer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div
          style={{
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'rgba(10, 13, 20, 0.8)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.625rem',
              padding: '0.4rem 0.75rem',
            }}
          >
            <Search size={16} style={{ color: 'var(--text-subtle)', marginRight: '0.5rem' }} />
            <input
              id="history-search-input"
              type="text"
              placeholder="Search past prompts & answers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
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
                  padding: '0.2rem',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <button
              id="export-history-json-btn"
              type="button"
              onClick={onExport}
              disabled={history.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '0.5rem',
                color: history.length === 0 ? 'var(--text-subtle)' : 'var(--text-muted)',
                padding: '0.4rem 0.75rem',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: history.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Download size={13} />
              <span>Export JSON</span>
            </button>

            {history.length > 0 && (
              <div>
                {confirmClear ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>Clear all?</span>
                    <button
                      id="confirm-clear-history-btn"
                      type="button"
                      onClick={() => {
                        onClearAll();
                        setConfirmClear(false);
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: 'var(--error)',
                        borderRadius: '0.375rem',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Yes, Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-subtle)',
                        borderRadius: '0.375rem',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    id="clear-all-history-btn"
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '0.5rem',
                      color: 'var(--error)',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Clear All</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* History Items List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
          id="history-items-container"
        >
          {filteredHistory.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 1rem',
                textAlign: 'center',
                color: 'var(--text-subtle)',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '1rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-subtle)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <MessageSquare size={24} />
              </div>
              <h4 style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>
                {searchTerm ? 'No matching interactions found' : 'No chat history stored yet'}
              </h4>
              <p style={{ fontSize: '0.8rem', maxWidth: '280px', lineHeight: '1.5' }}>
                {searchTerm
                  ? 'Try searching for a different keyword or prompt.'
                  : 'Every search and response is automatically preserved in IndexedDB.'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const isCurrentlySpeaking = isSpeaking && activeSpeakingId === item.id;
              return (
                <div
                  key={item.id}
                  id={`history-item-${item.id}`}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '0.875rem',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* Meta Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          background: 'rgba(99, 102, 241, 0.12)',
                          color: 'var(--accent-primary)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                        }}
                      >
                        {item.modelDisplayName || item.model}
                      </span>
                      {item.responseTimeMs && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-subtle)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <Zap size={10} />
                          {(item.responseTimeMs / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.72rem',
                        color: 'var(--text-subtle)',
                      }}
                    >
                      <Calendar size={11} />
                      <span>{formatTimestamp(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Query Prompt */}
                  <div
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      lineHeight: '1.4',
                    }}
                  >
                    "{item.query}"
                  </div>

                  {/* Response Preview */}
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      lineHeight: '1.5',
                      maxHeight: '4.5rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      whiteSpace: 'pre-wrap',
                      background: 'rgba(0, 0, 0, 0.25)',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '0.5rem',
                    }}
                  >
                    {item.response}
                  </div>

                  {/* Action Buttons */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '0.25rem',
                      borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <button
                      id={`load-history-btn-${item.id}`}
                      type="button"
                      onClick={() => {
                        onSelectHistoryItem(item);
                        onClose();
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        background: 'rgba(99, 102, 241, 0.1)',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        borderRadius: '0.375rem',
                        color: 'var(--accent-primary)',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ArrowUpRight size={13} />
                      <span>Load Query</span>
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      {/* Speak / TTS Button */}
                      <button
                        id={`speak-history-btn-${item.id}`}
                        type="button"
                        onClick={() => onSpeak(item.response, item.id)}
                        style={{
                          background: isCurrentlySpeaking
                            ? 'rgba(99, 102, 241, 0.2)'
                            : 'rgba(255, 255, 255, 0.04)',
                          border: isCurrentlySpeaking
                            ? '1px solid rgba(99, 102, 241, 0.5)'
                            : '1px solid var(--border-subtle)',
                          borderRadius: '0.375rem',
                          color: isCurrentlySpeaking ? 'var(--accent-primary)' : 'var(--text-muted)',
                          padding: '0.3rem 0.5rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                        }}
                        title={isCurrentlySpeaking ? 'Stop speaking' : 'Read aloud with Voice'}
                      >
                        {isCurrentlySpeaking ? (
                          <>
                            <VolumeX size={13} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '12px' }}>
                              <span className="soundwave-bar" />
                              <span className="soundwave-bar" />
                              <span className="soundwave-bar" />
                            </div>
                          </>
                        ) : (
                          <Volume2 size={13} />
                        )}
                      </button>

                      {/* Copy Button */}
                      <button
                        id={`copy-history-btn-${item.id}`}
                        type="button"
                        onClick={() => handleCopy(item.response, item.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '0.375rem',
                          color: copiedId === item.id ? 'var(--success)' : 'var(--text-muted)',
                          padding: '0.3rem 0.5rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                        }}
                        title="Copy answer"
                      >
                        {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>

                      {/* Delete Item */}
                      <button
                        id={`delete-history-btn-${item.id}`}
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '0.375rem',
                          color: 'var(--text-subtle)',
                          padding: '0.3rem 0.5rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontSize: '0.75rem',
                        }}
                        title="Delete from database"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
