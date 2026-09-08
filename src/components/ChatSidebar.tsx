import { useState, useMemo, useRef, type ChangeEvent } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Edit2,
  Check,
  X,
  Download,
  Upload,
  Pin,
  Sparkles,
  ChevronLeft,
  FileText,
  Clock,
} from 'lucide-react';
import DeleteConfirmModal from './DeleteConfirmModal';
import type { ChatSession, DbStatusInfo } from '../services/dbService';

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onTogglePinSession: (sessionId: string) => void;
  onClearAllSessions: () => void;
  onExportJSON: () => void;
  onImportJSON: (jsonStr: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isDbPersisted?: boolean;
  dbHealth?: DbStatusInfo | null;
}

export default function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onTogglePinSession,
  onClearAllSessions,
  onExportJSON,
  onImportJSON,
  isOpen,
  onToggleOpen,
  dbHealth,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState<string>('');
  const [sessionToDelete, setSessionToDelete] = useState<ChatSession | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState<boolean>(false);
  const fileImportRef = useRef<HTMLInputElement>(null);

  // Filter sessions in real-time by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const term = searchQuery.toLowerCase().trim();

    return sessions.filter((session) => {
      // Title match
      if (session.title.toLowerCase().includes(term)) return true;

      // Message query / answer match
      const hasMessageMatch = session.messages.some((m) =>
        m.content.toLowerCase().includes(term)
      );
      if (hasMessageMatch) return true;

      // Document name / content match
      const hasDocMatch = session.attachedDocuments?.some((d) =>
        d.name.toLowerCase().includes(term) || d.content.toLowerCase().includes(term)
      );
      if (hasDocMatch) return true;

      return false;
    });
  }, [sessions, searchQuery]);

  const handleStartRename = (session: ChatSession, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitleValue(session.title);
  };

  const handleSaveRename = (sessionId: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (editTitleValue.trim()) {
      onRenameSession(sessionId, editTitleValue.trim());
    }
    setEditingSessionId(null);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
  };

  const handleImportFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      if (content) {
        onImportJSON(content);
      }
    };
    reader.readAsText(file);
    if (fileImportRef.current) {
      fileImportRef.current.value = '';
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
    });
  };

  if (!isOpen) return null;

  return (
    <aside
      id="chat-history-sidebar"
      style={{
        width: '320px',
        minWidth: '320px',
        maxWidth: '320px',
        height: '100vh',
        background: 'rgba(12, 16, 26, 0.98)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        boxShadow: '10px 0 30px rgba(0, 0, 0, 0.4)',
        userSelect: 'none',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Hidden file input for JSON import */}
      <input
        ref={fileImportRef}
        type="file"
        accept=".json"
        onChange={handleImportFileChange}
        style={{ display: 'none' }}
        id="import-chat-json-input"
      />

      {/* Top Header & Brand */}
      <div
        style={{
          padding: '1.15rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(18, 24, 38, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '0.5rem',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px var(--accent-glow)',
            }}
          >
            <Sparkles size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Ila Course Creator
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  background: 'rgba(99, 102, 241, 0.25)',
                  border: '1px solid rgba(99, 102, 241, 0.45)',
                  color: '#a5b4fc',
                  lineHeight: '1.2',
                }}
                title="Version 6"
              >
                v6
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
              ILA AI • Ila Academy
            </div>
          </div>
        </div>

        <button
          id="close-sidebar-btn"
          type="button"
          onClick={onToggleOpen}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '0.4rem',
            color: 'var(--text-subtle)',
            cursor: 'pointer',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Collapse Sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* New Chat Button & Search Area */}
      <div
        style={{
          padding: '1rem 1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Prominent "+ New Chat" Button */}
        <button
          id="new-chat-btn"
          type="button"
          onClick={onNewChat}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: 'var(--accent-gradient)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.625rem',
            padding: '0.65rem 1rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>New Chat Session</span>
        </button>

        {/* Real-time Search & Filter Input */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(10, 13, 20, 0.7)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '0.5rem',
            padding: '0.4rem 0.65rem',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-subtle)', marginRight: '0.45rem' }} />
          <input
            id="search-chats-input"
            type="text"
            placeholder="Search past chats & docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '0.8rem',
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-subtle)',
                cursor: 'pointer',
                padding: '0.1rem',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Filter summary status (if searching) */}
      {searchQuery && (
        <div
          style={{
            padding: '0.4rem 1.15rem',
            fontSize: '0.72rem',
            color: 'var(--text-subtle)',
            background: 'rgba(99, 102, 241, 0.08)',
            borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Filtering "{searchQuery}"</span>
          <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
            {filteredSessions.length} {filteredSessions.length === 1 ? 'match' : 'matches'}
          </span>
        </div>
      )}

      {/* Chat Sessions Vertical List */}
      <div
        id="sessions-list-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
        }}
      >
        {filteredSessions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-subtle)',
              fontSize: '0.82rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <MessageSquare size={28} style={{ opacity: 0.4 }} />
            <span>{searchQuery ? 'No matching chat sessions found' : 'No past chats yet'}</span>
            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
              {searchQuery ? 'Try another search term.' : 'Start by asking a question or creating a course.'}
            </span>
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingSessionId === session.id;
            const messageCount = session.messages.length;
            const docCount = session.attachedDocuments?.length || 0;

            return (
              <div
                key={session.id}
                id={`session-item-${session.id}`}
                onClick={() => {
                  if (!isEditing) {
                    onSelectSession(session.id);
                  }
                }}
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: '0.625rem',
                  background: isActive
                    ? 'rgba(99, 102, 241, 0.16)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isActive
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {/* Title & Actions Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
                  {isEditing ? (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(session.id, e);
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          background: 'rgba(10, 13, 20, 0.8)',
                          border: '1px solid var(--accent-primary)',
                          borderRadius: '0.35rem',
                          padding: '0.2rem 0.4rem',
                          color: '#ffffff',
                          fontSize: '0.82rem',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(session.id, e)}
                        style={{
                          background: 'rgba(16, 185, 129, 0.2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: 'var(--success)',
                          borderRadius: '0.3rem',
                          padding: '0.2rem',
                          cursor: 'pointer',
                        }}
                        title="Save title"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleCancelRename(e)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-subtle)',
                          borderRadius: '0.3rem',
                          padding: '0.2rem',
                          cursor: 'pointer',
                        }}
                        title="Cancel"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        {session.isPinned && (
                          <Pin size={12} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                        )}
                        <span
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? '#ffffff' : 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={session.title}
                        >
                          {session.title}
                        </span>
                      </div>

                      {/* Action Menu / Buttons */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(session, e)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            cursor: 'pointer',
                            padding: '0.15rem',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Rename title"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePinSession(session.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: session.isPinned ? 'var(--accent-primary)' : 'var(--text-subtle)',
                            cursor: 'pointer',
                            padding: '0.15rem',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title={session.isPinned ? 'Unpin session' : 'Pin to top'}
                        >
                          <Pin size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSessionToDelete(session);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            cursor: 'pointer',
                            padding: '0.15rem',
                            borderRadius: '0.25rem',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                          title="Delete session"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Sub Meta Row (Time, messages count, docs count) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: 'var(--text-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Clock size={10} />
                    <span>{formatTimestamp(session.updatedAt)}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {docCount > 0 && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          color: '#818cf8',
                        }}
                        title={`${docCount} documents attached`}
                      >
                        <FileText size={11} />
                        <span>{docCount}</span>
                      </span>
                    )}

                    <span>
                      {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Footer Controls */}
      <div
        style={{
          padding: '0.85rem 1.15rem',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          background: 'rgba(18, 24, 38, 0.6)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          {/* Export JSON Button */}
          <button
            id="export-sessions-btn"
            type="button"
            onClick={onExportJSON}
            disabled={sessions.length === 0}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.45rem',
              color: sessions.length === 0 ? 'var(--text-subtle)' : 'var(--text-muted)',
              padding: '0.35rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: sessions.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Export all chat sessions to JSON"
          >
            <Download size={12} />
            <span>Export</span>
          </button>

          {/* Import JSON Button */}
          <button
            id="import-sessions-btn"
            type="button"
            onClick={() => fileImportRef.current?.click()}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.45rem',
              color: 'var(--text-muted)',
              padding: '0.35rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            title="Import chat sessions from JSON"
          >
            <Upload size={12} />
            <span>Import</span>
          </button>

          {/* Clear All Sessions Button */}
          {sessions.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '0.45rem',
                  color: 'var(--error)',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
                title="Clear all chat history"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Luminous SQLite Database Connection Status Indicator */}
        <div
          id="sidebar-sqlite-status-indicator"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.45rem 0.75rem',
            background: dbHealth?.isConnected
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.12) 100%)'
              : 'rgba(99, 102, 241, 0.1)',
            border: dbHealth?.isConnected
              ? '1px solid rgba(52, 211, 153, 0.35)'
              : '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '0.65rem',
            boxShadow: dbHealth?.isConnected ? '0 0 12px rgba(16, 185, 129, 0.15)' : 'none',
            fontSize: '0.72rem',
            color: '#ffffff',
            cursor: 'default',
          }}
          title={
            dbHealth?.dbPath
              ? `Stored locally in SQLite file:\n${dbHealth.dbPath}`
              : 'Local SQLite File Database'
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <div
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: dbHealth?.isConnected ? '#10b981' : '#6366f1',
                boxShadow: dbHealth?.isConnected
                  ? '0 0 8px #10b981, 0 0 12px #34d399'
                  : '0 0 6px #6366f1',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontWeight: 600,
                color: dbHealth?.isConnected ? '#34d399' : '#a5b4fc',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {dbHealth?.isConnected ? 'SQLite DB Connected' : 'Local DB Active'}
            </span>
          </div>

          <span
            style={{
              fontSize: '0.64rem',
              color: 'var(--text-subtle)',
              fontFamily: 'monospace',
              padding: '0.05rem 0.35rem',
              borderRadius: '4px',
              background: 'rgba(0, 0, 0, 0.3)',
            }}
          >
            data/course_creator.db
          </span>
        </div>
      </div>

      {/* Confirmation Modal for Individual Chat Deletion */}
      <DeleteConfirmModal
        isOpen={Boolean(sessionToDelete)}
        itemTitle={sessionToDelete?.title || 'Conversation'}
        onCancel={() => setSessionToDelete(null)}
        onConfirm={() => {
          if (sessionToDelete) {
            onDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }
        }}
      />

      {/* Confirmation Modal for Clear All */}
      <DeleteConfirmModal
        isOpen={isClearAllModalOpen}
        itemTitle="All Conversations"
        isAll={true}
        onCancel={() => setIsClearAllModalOpen(false)}
        onConfirm={() => {
          onClearAllSessions();
          setIsClearAllModalOpen(false);
        }}
      />
    </aside>
  );
}
