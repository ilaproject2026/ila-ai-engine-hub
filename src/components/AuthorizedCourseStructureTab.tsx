import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Award,
  ExternalLink,
  RefreshCw,
  Layers,
  Globe2,
  Target,
  Copy,
  Check,
  FolderGit2,
} from 'lucide-react';
import {
  detectStandardCurriculum,
  fetchDynamicAuthorizedStandard,
  type StandardBodyInfo,
} from '../services/curriculumStandardService';
import type { CourseChapter } from '../services/dbService';

interface AuthorizedCourseStructureTabProps {
  courseTitle: string;
  chapters?: CourseChapter[];
  targetAudience?: string;
  initialStandardInfo?: StandardBodyInfo;
  onSaveStandardInfo?: (info: StandardBodyInfo) => void;
}

export default function AuthorizedCourseStructureTab({
  courseTitle,
  chapters = [],
  targetAudience,
  initialStandardInfo,
  onSaveStandardInfo,
}: AuthorizedCourseStructureTabProps) {
  const combinedContent = chapters.map((c) => c.content).join('\n\n');

  const [standardInfo, setStandardInfo] = useState<StandardBodyInfo>(() => {
    return initialStandardInfo || detectStandardCurriculum(courseTitle, combinedContent);
  });

  const [isRebenchmarking, setIsRebenchmarking] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'roadmap' | 'opensource' | 'criteria' | 'accreditation'>('roadmap');

  useEffect(() => {
    if (initialStandardInfo) {
      setStandardInfo(initialStandardInfo);
    }
  }, [initialStandardInfo]);

  const handleDynamicRebenchmark = async () => {
    setIsRebenchmarking(true);
    try {
      const refreshed = await fetchDynamicAuthorizedStandard(courseTitle, combinedContent, targetAudience);
      setStandardInfo(refreshed);
      if (onSaveStandardInfo) {
        onSaveStandardInfo(refreshed);
      }
    } catch (err) {
      console.error('Rebenchmark error:', err);
    } finally {
      setIsRebenchmarking(false);
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(url);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div
      className="authorized-course-structure-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: '0.5rem 0',
      }}
    >
      {/* 1. Header & Governing Authority Hero Card */}
      <div
        style={{
          borderRadius: '1.25rem',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 27, 75, 0.9) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
          padding: '1.75rem',
          boxShadow: '0 15px 35px -10px rgba(0, 0, 0, 0.6), 0 0 25px rgba(99, 102, 241, 0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-40px',
            right: '-40px',
            width: '180px',
            height: '180px',
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            pointerEvents: 'none',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '1rem',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d8b4fe',
                boxShadow: '0 0 20px rgba(168, 85, 247, 0.3)',
              }}
            >
              <ShieldCheck size={32} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    background: `${standardInfo.badgeColor}25`,
                    color: standardInfo.badgeColor,
                    border: `1px solid ${standardInfo.badgeColor}60`,
                  }}
                >
                  {standardInfo.badge}
                </span>

                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    background: 'rgba(16, 185, 129, 0.18)',
                    color: '#6ee7b7',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                  }}
                >
                  Official International Standard
                </span>

                {targetAudience && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '9999px',
                      background: 'rgba(56, 189, 248, 0.18)',
                      color: '#7dd3fc',
                      border: '1px solid rgba(56, 189, 248, 0.4)',
                    }}
                  >
                    Studied By: {targetAudience}
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '0.35rem' }}>
                {standardInfo.bodyName}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Authority: <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{standardInfo.governingAuthority}</span> • Framework:{' '}
                <span style={{ color: '#a5b4fc', fontWeight: 700 }}>{standardInfo.frameworkName}</span> ({standardInfo.levelOrCode})
              </div>
            </div>
          </div>

          {/* Action Trigger */}
          <button
            type="button"
            onClick={handleDynamicRebenchmark}
            disabled={isRebenchmarking}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.15rem',
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
              border: '1px solid rgba(168, 85, 247, 0.5)',
              color: '#d8b4fe',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: isRebenchmarking ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={15} className={isRebenchmarking ? 'animate-spin' : ''} />
            <span>{isRebenchmarking ? 'Re-Benchmarking with AI...' : 'AI Dynamic Re-Benchmark'}</span>
          </button>
        </div>

        <p style={{ marginTop: '1rem', fontSize: '0.88rem', color: '#cbd5e1', lineHeight: '1.6', maxWidth: '900px' }}>
          {standardInfo.description}
        </p>
      </div>

      {/* 2. Sub-Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.75rem',
          overflowX: 'auto',
        }}
      >
        {[
          { id: 'roadmap', label: 'Authorized Roadmap & Blueprint', icon: Layers, count: standardInfo.standardStructure.length },
          { id: 'opensource', label: 'Open-Source Sourcing & References', icon: FolderGit2, count: (standardInfo.openSourceResources || []).length + standardInfo.referenceLinks.length },
          { id: 'criteria', label: 'Official Exam Pass Criteria', icon: Target },
          { id: 'accreditation', label: 'Accreditation Statement & OER Nature', icon: Award },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1rem',
                borderRadius: '0.65rem',
                background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.2) 100%)' : 'rgba(255, 255, 255, 0.03)',
                border: isActive ? '1.5px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.07)',
                color: isActive ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={14} color={isActive ? '#a855f7' : 'var(--text-subtle)'} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    padding: '0.05rem 0.4rem',
                    borderRadius: '9999px',
                    background: isActive ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255, 255, 255, 0.08)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* Tab 1: Authorized Roadmap & Blueprint */}
      {activeSubTab === 'roadmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '1rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="#818cf8" />
              <span>Authorized Standard Syllabus & Competency Progression</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              This roadmap maps the core competency tiers defined by <strong style={{ color: '#ffffff' }}>{standardInfo.bodyName}</strong> for {courseTitle}.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
              {standardInfo.standardStructure.map((item, idx) => {
                const parts = item.split(':');
                const title = parts[0];
                const desc = parts.slice(1).join(':').trim() || item;

                return (
                  <div
                    key={idx}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.85rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.07)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'rgba(99, 102, 241, 0.25)',
                          color: '#a5b4fc',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '0.88rem', color: '#f8fafc' }}>{title}</strong>
                    </div>
                    {desc && desc !== title && (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.45', paddingLeft: '2rem' }}>
                        {desc}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Open-Source Sourcing & Verified References */}
      {activeSubTab === 'opensource' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Open-Source Materials */}
          {standardInfo.openSourceResources && standardInfo.openSourceResources.length > 0 && (
            <div
              style={{
                padding: '1.25rem',
                borderRadius: '1rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderGit2 size={18} color="#34d399" />
                <span>Verified Open-Source Educational Resources (OERs) & Repositories</span>
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Open-access textbooks, code sandboxes, and study guides authorized for free public learning.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
                {standardInfo.openSourceResources.map((res, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1.1rem',
                      borderRadius: '0.85rem',
                      background: 'rgba(16, 185, 129, 0.05)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '9999px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#34d399',
                          textTransform: 'uppercase',
                        }}
                      >
                        {res.type}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>{res.provider}</span>
                    </div>

                    <strong style={{ fontSize: '0.92rem', color: '#ffffff' }}>{res.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.45' }}>{res.description}</div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <span style={{ fontSize: '0.7rem', color: '#6ee7b7', fontWeight: 600 }}>{res.accessLevel}</span>
                      <a
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.75rem',
                          color: '#38bdf8',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        <span>Access Material</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Official Governing References */}
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '1rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Globe2 size={18} color="#38bdf8" />
              <span>Official Reference Portals & Governing Blueprints</span>
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Authoritative documentation and global frameworks verifying syllabus authenticity.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
              {standardInfo.referenceLinks.map((link, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1.1rem',
                    borderRadius: '0.85rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '9999px',
                        background: 'rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                      }}
                    >
                      {link.approvalNature || 'Official Blueprint'}
                    </span>
                    {link.isOpenAccess && (
                      <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>Open Access</span>
                    )}
                  </div>

                  <strong style={{ fontSize: '0.9rem', color: '#ffffff' }}>{link.title}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.45' }}>{link.description}</div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.35rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(link.url)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: copiedLink === link.url ? '#34d399' : 'var(--text-subtle)',
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {copiedLink === link.url ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedLink === link.url ? 'Link Copied' : 'Copy URL'}</span>
                    </button>

                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.75rem',
                        color: '#818cf8',
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <span>Visit Portal</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Official Exam Pass Criteria */}
      {activeSubTab === 'criteria' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '1rem',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Target size={20} color="#fbbf24" />
                  <span>Official Certification & Examination Pass Standards</span>
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Accreditation requirements, scoring benchmarks, and competency weightages for certification.
                </p>
              </div>

              <div
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '9999px',
                  background: 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.4)',
                  color: '#fbbf24',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                Minimum Pass Mark:{' '}
                {standardInfo.examPassCriteria?.minPassingScore || '70% Overall Benchmark'}
              </div>
            </div>

            {/* Criteria Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div
                style={{
                  padding: '1.1rem',
                  borderRadius: '0.85rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Certification Title
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: '0.3rem' }}>
                  {standardInfo.examPassCriteria?.certificationTitle || `${standardInfo.frameworkName} Certified Specialist`}
                </div>
              </div>

              <div
                style={{
                  padding: '1.1rem',
                  borderRadius: '0.85rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Exam Format & Duration
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: '0.3rem' }}>
                  {standardInfo.examPassCriteria?.examFormat || '60-80 Scenario-based Questions'} • {standardInfo.examPassCriteria?.timeLimit || '90 Minutes'}
                </div>
              </div>

              <div
                style={{
                  padding: '1.1rem',
                  borderRadius: '0.85rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                }}
              >
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                  Prerequisites Baseline
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginTop: '0.3rem' }}>
                  {standardInfo.examPassCriteria?.preRequisites || 'Foundational coursework & applied exercises'}
                </div>
              </div>
            </div>

            {/* Competency Domains */}
            {standardInfo.examPassCriteria?.competencyDomains && (
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem' }}>
                  Exam Competency Domain Weightage Breakdown
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {standardInfo.examPassCriteria.competencyDomains.map((domain, dIdx) => (
                    <div
                      key={dIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.65rem',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600 }}>{domain.name}</span>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          padding: '0.15rem 0.55rem',
                          borderRadius: '9999px',
                          background: 'rgba(168, 85, 247, 0.25)',
                          color: '#d8b4fe',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                        }}
                      >
                        {domain.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Accreditation Statement */}
      {activeSubTab === 'accreditation' && (
        <div
          style={{
            padding: '1.5rem',
            borderRadius: '1rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Award size={24} color="#a855f7" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff' }}>
              Official Open Educational Accreditation & Pedagogy Statement
            </h3>
          </div>

          <div
            style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              fontSize: '0.85rem',
              color: '#cbd5e1',
              lineHeight: '1.7',
            }}
          >
            <p>
              This course is authoritatively designed in strict alignment with <strong>{standardInfo.frameworkName}</strong> as promulgated by <strong>{standardInfo.bodyName}</strong> ({standardInfo.governingAuthority}).
            </p>
            <p style={{ marginTop: '0.75rem' }}>
              <strong>Nature of Approval:</strong> {standardInfo.approvalNature}
            </p>
            <p style={{ marginTop: '0.75rem' }}>
              All modules, lesson segments, slide decks, video scripts, and evaluation assessments conform to the verified open-access curriculum guidelines to ensure standardized learning outcomes across national and international educational thresholds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
