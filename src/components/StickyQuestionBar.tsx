import {
  HelpCircle,
  ListTree,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { ChatMessage } from '../services/dbService';

interface StickyQuestionBarProps {
  isVisible: boolean;
  activeQuestion: ChatMessage | null;
  activeQuestionIndex: number; // 1-indexed
  totalQuestions: number;
  onOpenQuestionTree: () => void;
  onJumpToPreviousQuestion?: () => void;
  onJumpToNextQuestion?: () => void;
  onJumpToCurrentQuestion: () => void;
}

export default function StickyQuestionBar({
  isVisible,
  activeQuestion,
  activeQuestionIndex,
  totalQuestions,
  onOpenQuestionTree,
  onJumpToPreviousQuestion,
  onJumpToNextQuestion,
  onJumpToCurrentQuestion,
}: StickyQuestionBarProps) {
  if (!isVisible || !activeQuestion || totalQuestions === 0) return null;

  return (
    <div
      id="sticky-question-bar"
      className="animate-fade-in"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 25,
        width: '100%',
        maxWidth: '860px',
        margin: '0 auto',
        // Contrasting, highly visible luminous center card theme
        background:
          'linear-gradient(135deg, rgba(20, 24, 48, 0.97) 0%, rgba(30, 27, 75, 0.97) 50%, rgba(45, 20, 65, 0.97) 100%)',
        border: '1.5px solid rgba(129, 140, 248, 0.5)',
        borderRadius: '1rem',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow:
          '0 12px 35px rgba(0, 0, 0, 0.65), 0 0 25px rgba(99, 102, 241, 0.3)',
        padding: '0.65rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Left: Active Question Identifier & Truncated Text */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          minWidth: 0,
          flex: 1,
          cursor: 'pointer',
        }}
        onClick={onJumpToCurrentQuestion}
        title={`Click to scroll to question: "${activeQuestion.content}"`}
      >
        {/* High-contrast Question Index Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            borderRadius: '0.45rem',
            padding: '0.2rem 0.55rem',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.5)',
            flexShrink: 0,
          }}
        >
          <HelpCircle size={13} color="#ffffff" />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '0.02em',
            }}
          >
            Q{activeQuestionIndex || 1}
          </span>
        </div>

        {/* Question Text preview */}
        <div
          style={{
            fontSize: '0.88rem',
            fontWeight: 600,
            color: '#f8fafc',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.01em',
          }}
        >
          {activeQuestion.content}
        </div>
      </div>

      {/* Right: Accumulated Question Tree Indicator & Navigation Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexShrink: 0,
        }}
      >
        {/* Previous Question Button */}
        {totalQuestions > 1 && onJumpToPreviousQuestion && (
          <button
            type="button"
            onClick={onJumpToPreviousQuestion}
            disabled={activeQuestionIndex <= 1}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '0.4rem',
              color:
                activeQuestionIndex <= 1 ? 'rgba(255, 255, 255, 0.25)' : '#ffffff',
              cursor: activeQuestionIndex <= 1 ? 'not-allowed' : 'pointer',
              padding: '0.3rem 0.45rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Jump to Previous Question (Up)"
          >
            <ChevronUp size={15} />
          </button>
        )}

        {/* Next Question Button */}
        {totalQuestions > 1 && onJumpToNextQuestion && (
          <button
            type="button"
            onClick={onJumpToNextQuestion}
            disabled={activeQuestionIndex >= totalQuestions}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '0.4rem',
              color:
                activeQuestionIndex >= totalQuestions
                  ? 'rgba(255, 255, 255, 0.25)'
                  : '#ffffff',
              cursor: activeQuestionIndex >= totalQuestions ? 'not-allowed' : 'pointer',
              padding: '0.3rem 0.45rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title="Jump to Next Question (Down)"
          >
            <ChevronDown size={15} />
          </button>
        )}

        {/* Compact Accumulated Question Tree Counter/Indicator Button ('2 List', '3 List', etc.) */}
        <button
          id="question-tree-indicator-btn"
          type="button"
          onClick={onOpenQuestionTree}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background:
              'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
            border: '1px solid rgba(165, 180, 252, 0.55)',
            borderRadius: '9999px',
            padding: '0.3rem 0.8rem',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.35)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(99, 102, 241, 0.5) 0%, rgba(168, 85, 247, 0.5) 100%)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.5)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(99, 102, 241, 0.35)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          title="Open Question Tree Navigation Drawer"
        >
          <ListTree size={14} color="#c084fc" />
          <span>{totalQuestions} List</span>
          <span
            style={{
              fontSize: '0.68rem',
              opacity: 0.85,
              fontWeight: 500,
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '0.05rem 0.35rem',
              borderRadius: '9999px',
            }}
          >
            Q{activeQuestionIndex}/{totalQuestions}
          </span>
        </button>
      </div>
    </div>
  );
}
