import {
  BookOpen,
  CheckCircle2,
  PlayCircle,
  Clock,
  Sparkles,
  Layers,
  Video,
  Loader2,
  Play,
  Pause,
} from 'lucide-react';
import type {
  CoursePlan,
  CoursePlanModule,
  AutonomousCoursePlan,
} from '../services/dbService';

interface CoursePlannerTrackerProps {
  plan?: CoursePlan | null;
  autonomousPlan?: AutonomousCoursePlan | null;
  activeModuleIndex?: number;
  isGenerating?: boolean;
  onGenerateModule?: (module: CoursePlanModule) => void;
  onExecuteAllAutonomous?: () => void;
  onPauseAutonomous?: () => void;
  onResumeAutonomous?: () => void;
  onOpenLibraryWorkspace?: () => void;
  isWorkspaceMode?: boolean;
  onToggleWorkspaceMode?: () => void;
  onOpenClassVideo?: (moduleNumber?: number) => void;
  isClassVideoOpen?: boolean;
}

export default function CoursePlannerTracker({
  plan,
  autonomousPlan,
  activeModuleIndex = 1,
  isGenerating = false,
  onGenerateModule,
  onExecuteAllAutonomous,
  onPauseAutonomous,
  onResumeAutonomous: _onResumeAutonomous,
  onOpenLibraryWorkspace,
  isWorkspaceMode = false,
  onToggleWorkspaceMode,
  onOpenClassVideo,
  isClassVideoOpen = false,
}: CoursePlannerTrackerProps) {
  // If neither plan nor autonomousPlan exists, do not render
  if (!plan && !autonomousPlan) return null;

  // Calculate progress
  let completedCount = 0;
  let totalCount = 0;
  let title = 'Course Curriculum Planner';
  let subtitle = 'Autonomous modular task decomposition and synthesis';

  if (autonomousPlan && autonomousPlan.steps.length > 0) {
    totalCount = autonomousPlan.steps.length;
    completedCount = autonomousPlan.steps.filter((s) => s.status === 'completed').length;
    title = autonomousPlan.courseTitle || 'Autonomous Masterclass Planner';
    subtitle = autonomousPlan.courseSubtitle || 'Decomposing and synthesizing enterprise curriculum';
  } else if (plan && plan.modules.length > 0) {
    totalCount = plan.modules.length;
    completedCount = plan.modules.filter((m) => m.status === 'completed').length;
    title = plan.title || 'Structured Course Curriculum';
    subtitle = plan.subtitle || 'Step-by-step modular curriculum breakdown with interactive labs';
  } else {
    return null;
  }

  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isExecuting =
    autonomousPlan?.status === 'executing' || isGenerating;
  const isAutonomousComplete =
    autonomousPlan?.status === 'completed' || (totalCount > 0 && completedCount === totalCount);

  const handleWorkspaceAction = () => {
    if (onToggleWorkspaceMode) {
      onToggleWorkspaceMode();
    } else if (onOpenLibraryWorkspace) {
      onOpenLibraryWorkspace();
    }
  };

  return (
    <div
      id="course-planner-task-tracker"
      className="animate-fade-in"
      style={{
        maxWidth: '860px',
        width: '100%',
        margin: '0 auto 1rem auto',
        background: 'linear-gradient(145deg, rgba(14, 18, 32, 0.98) 0%, rgba(20, 26, 48, 0.98) 100%)',
        border: '1.5px solid rgba(99, 102, 241, 0.4)',
        borderRadius: '1.15rem',
        padding: '1.1rem 1.35rem',
        boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.7), 0 0 25px rgba(99, 102, 241, 0.2)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Top Banner: Plan Title & Action Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '0.85rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '0.65rem',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(99, 102, 241, 0.45)',
              flexShrink: 0,
            }}
          >
            {isExecuting ? (
              <Sparkles size={18} color="#ffffff" className="animate-spin" />
            ) : (
              <Layers size={18} color="#ffffff" />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <h3
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </h3>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  background: isAutonomousComplete
                    ? 'rgba(16, 185, 129, 0.2)'
                    : isExecuting
                      ? 'rgba(168, 85, 247, 0.25)'
                      : 'rgba(99, 102, 241, 0.2)',
                  border: isAutonomousComplete
                    ? '1px solid rgba(16, 185, 129, 0.5)'
                    : isExecuting
                      ? '1px solid rgba(168, 85, 247, 0.5)'
                      : '1px solid rgba(99, 102, 241, 0.4)',
                  color: isAutonomousComplete
                    ? '#34d399'
                    : isExecuting
                      ? '#d8b4fe'
                      : '#a5b4fc',
                  whiteSpace: 'nowrap',
                }}
              >
                {autonomousPlan
                  ? `${completedCount}/${totalCount} Tasks Executed`
                  : `${totalCount} ${totalCount === 1 ? 'Book' : 'Books'}`}
              </span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          {/* Autonomous Execution Trigger (if not yet running or partially complete) */}
          {!isAutonomousComplete && !isExecuting && onExecuteAllAutonomous && (
            <button
              type="button"
              onClick={onExecuteAllAutonomous}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.8rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 0 14px rgba(168, 85, 247, 0.4)',
                transition: 'all 0.15s ease',
              }}
              title="Autonomously generate all books sequentially"
            >
              <Play size={12} fill="#ffffff" />
              <span>Execute All Books</span>
            </button>
          )}

          {/* Pause / Resume Controls during active execution */}
          {isExecuting && onPauseAutonomous && (
            <button
              type="button"
              onClick={onPauseAutonomous}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.45)',
                color: '#f87171',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Pause Autonomous Task Engine"
            >
              <Pause size={12} />
              <span>Pause</span>
            </button>
          )}

          {/* Masterclass Video Player Action */}
          {onOpenClassVideo && (
            <button
              type="button"
              onClick={() => onOpenClassVideo(1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                background: isClassVideoOpen
                  ? 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)'
                  : 'rgba(236, 72, 153, 0.15)',
                border: isClassVideoOpen
                  ? '1px solid rgba(244, 114, 182, 0.6)'
                  : '1px solid rgba(236, 72, 153, 0.35)',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: isClassVideoOpen ? '0 0 12px rgba(236, 72, 153, 0.4)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="Open Masterclass Video Player"
            >
              <Video size={13} />
              <span>{isClassVideoOpen ? 'Hide Video' : 'Class Video'}</span>
            </button>
          )}

          {/* Workspace View Mode Toggle */}
          {(onToggleWorkspaceMode || onOpenLibraryWorkspace) && (
            <button
              type="button"
              onClick={handleWorkspaceAction}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                background: isWorkspaceMode
                  ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)'
                  : 'rgba(255, 255, 255, 0.06)',
                border: isWorkspaceMode ? 'none' : '1px solid var(--border-subtle)',
                color: '#ffffff',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Toggle Multi-Book Library Workspace View"
            >
              <BookOpen size={13} />
              <span>{isWorkspaceMode ? 'Chat View' : 'Course Workspace'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar Row */}
      <div style={{ marginBottom: '0.85rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            marginBottom: '0.35rem',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {isExecuting && <Loader2 size={12} className="animate-spin" color="#818cf8" />}
            <span>
              {isAutonomousComplete
                ? 'Curriculum Synthesis Complete'
                : isExecuting
                  ? 'Autonomous Execution Engine Active...'
                  : 'Task Planner Roadmap'}
            </span>
          </span>
          <span
            style={{
              fontWeight: 700,
              color: progressPercent === 100 ? '#34d399' : '#a5b4fc',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {completedCount} of {totalCount} Steps ({progressPercent}%)
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background:
                progressPercent === 100
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
              borderRadius: '9999px',
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* A. Autonomous Task Steps Timeline / Checklist (if autonomousPlan active) */}
      {autonomousPlan && autonomousPlan.steps.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            maxHeight: '280px',
            overflowY: 'auto',
            paddingRight: '0.2rem',
          }}
        >
          {autonomousPlan.steps.map((step) => {
            const isDone = step.status === 'completed';
            const isCurrent = step.status === 'in_progress';
            const isErr = step.status === 'error';

            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '0.6rem',
                  background: isCurrent
                    ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%)'
                    : isDone
                      ? 'rgba(16, 185, 129, 0.06)'
                      : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrent
                    ? '1px solid rgba(165, 180, 252, 0.45)'
                    : isDone
                      ? '1px solid rgba(16, 185, 129, 0.25)'
                      : '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: isCurrent ? '0 0 12px rgba(99, 102, 241, 0.25)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                  {/* Step Status Icon */}
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDone
                        ? 'rgba(16, 185, 129, 0.2)'
                        : isCurrent
                          ? 'rgba(99, 102, 241, 0.3)'
                          : isErr
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(255, 255, 255, 0.06)',
                      color: isDone
                        ? '#34d399'
                        : isCurrent
                          ? '#818cf8'
                          : isErr
                            ? '#ef4444'
                            : 'var(--text-subtle)',
                      flexShrink: 0,
                    }}
                  >
                    {isDone ? (
                      <CheckCircle2 size={14} />
                    ) : isCurrent ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : isErr ? (
                      <span style={{ fontSize: '0.7rem', fontWeight: 800 }}>!</span>
                    ) : (
                      <Clock size={12} />
                    )}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          color: isDone ? '#34d399' : isCurrent ? '#a5b4fc' : 'var(--text-subtle)',
                        }}
                      >
                        Step {step.stepNumber}:
                      </span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: isDone ? '#ffffff' : isCurrent ? '#ffffff' : 'var(--text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {step.title}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-subtle)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Right Badge / Action */}
                <div style={{ flexShrink: 0 }}>
                  {isDone ? (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        color: '#34d399',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.15)',
                      }}
                    >
                      Completed
                    </span>
                  ) : isCurrent ? (
                    <span
                      style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        color: '#c084fc',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        background: 'rgba(168, 85, 247, 0.2)',
                      }}
                    >
                      Synthesizing...
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.66rem', color: 'var(--text-subtle)' }}>
                      Queued
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* B. Structured Modular Books Grid (Curriculum mode) */
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '0.65rem',
          }}
        >
          {plan?.modules.map((mod) => {
            const isCompleted = mod.status === 'completed';
            const isCurrentGen = isGenerating && mod.moduleNumber === activeModuleIndex;

            return (
              <div
                key={mod.moduleNumber}
                style={{
                  background: isCompleted
                    ? 'rgba(16, 185, 129, 0.08)'
                    : isCurrentGen
                      ? 'rgba(99, 102, 241, 0.12)'
                      : 'rgba(255, 255, 255, 0.03)',
                  border: isCompleted
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : isCurrentGen
                      ? '1px solid rgba(99, 102, 241, 0.5)'
                      : '1px solid var(--border-subtle)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 0.9rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '0.45rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      marginBottom: '0.25rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        color: isCompleted ? '#34d399' : isCurrentGen ? '#818cf8' : 'var(--text-subtle)',
                      }}
                    >
                      Book {mod.moduleNumber}
                    </span>

                    {isCompleted ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: '#34d399',
                        }}
                      >
                        <CheckCircle2 size={11} />
                        <span>Ready</span>
                      </span>
                    ) : isCurrentGen ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: '#818cf8',
                        }}
                      >
                        <Sparkles size={11} className="animate-spin" />
                        <span>Generating</span>
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.66rem',
                          color: 'var(--text-subtle)',
                        }}
                      >
                        <Clock size={10} />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>

                  <h4
                    style={{
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: '#ffffff',
                      lineHeight: '1.3',
                      margin: 0,
                    }}
                  >
                    {mod.title}
                  </h4>

                  {mod.summary && (
                    <p
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.2rem',
                        lineHeight: '1.3',
                        margin: '0.2rem 0 0 0',
                      }}
                    >
                      {mod.summary}
                    </p>
                  )}
                </div>

                {/* Sub-topics Preview or Action */}
                {isCompleted && onOpenClassVideo && (
                  <button
                    type="button"
                    onClick={() => onOpenClassVideo(mod.moduleNumber)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                      padding: '0.3rem 0.55rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(236, 72, 153, 0.15)',
                      border: '1px solid rgba(236, 72, 153, 0.35)',
                      color: '#f472b6',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginTop: '0.2rem',
                    }}
                    title={`Watch Class Video for Book ${mod.moduleNumber}`}
                  >
                    <Video size={11} />
                    <span>Watch Class Video ({mod.moduleNumber}.1)</span>
                  </button>
                )}

                {!isCompleted && !isCurrentGen && onGenerateModule && (
                  <button
                    type="button"
                    onClick={() => onGenerateModule(mod)}
                    disabled={isGenerating}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.3rem',
                      padding: '0.3rem 0.55rem',
                      borderRadius: '0.4rem',
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      color: '#a5b4fc',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                      marginTop: '0.2rem',
                    }}
                  >
                    <PlayCircle size={11} />
                    <span>Generate Book {mod.moduleNumber}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
