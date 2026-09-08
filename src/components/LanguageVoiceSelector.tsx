import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Globe,
  Volume2,
  ChevronDown,
  Sparkles,
  Loader2,
  Check,
  Search,
  X,
} from 'lucide-react';
import {
  SUPPORTED_LANGUAGES,
  VOICE_PROFILES,
  getScopedVoiceProfilesForLanguage,
  stopSpeaking,
  type LanguageOption,
  type VoiceProfile,
} from '../services/speechService';

interface LanguageVoiceSelectorProps {
  currentLanguage: string;
  onLanguageChange: (langCode: string) => void;
  currentVoiceProfile?: string;
  onVoiceProfileChange?: (voiceId: string) => void;
  onTranslateContent?: (targetLang?: string) => void;
  isTranslating?: boolean;
  compact?: boolean;
  showVoiceProfile?: boolean;
  showTranslateButton?: boolean;
}

export default function LanguageVoiceSelector({
  currentLanguage,
  onLanguageChange,
  currentVoiceProfile = 'coqui-xtts-multilingual',
  onVoiceProfileChange,
  onTranslateContent,
  isTranslating = false,
  compact = false,
  showVoiceProfile = false,
  showTranslateButton = false,
}: LanguageVoiceSelectorProps) {
  const [isLangOpen, setIsLangOpen] = useState<boolean>(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState<boolean>(false);
  const [langSearchTerm, setLangSearchTerm] = useState<string>('');

  const shouldShowVoice = showVoiceProfile || Boolean(onVoiceProfileChange);

  const langRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<HTMLDivElement>(null);
  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setIsLangOpen(false);
      }
      if (voiceRef.current && !voiceRef.current.contains(e.target as Node)) {
        setIsVoiceOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scoped Voice Profiles dynamically filtered for the active language
  const scopedVoiceProfiles = useMemo(() => {
    return getScopedVoiceProfilesForLanguage(currentLanguage);
  }, [currentLanguage]);

  const activeLang =
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) ||
    SUPPORTED_LANGUAGES[0];

  const activeVoice =
    scopedVoiceProfiles.find((v) => v.id === currentVoiceProfile) ||
    scopedVoiceProfiles[0] ||
    VOICE_PROFILES[0];

  const filteredLanguages = useMemo(() => {
    if (!langSearchTerm.trim()) return SUPPORTED_LANGUAGES;
    const term = langSearchTerm.toLowerCase();
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        l.nativeName.toLowerCase().includes(term) ||
        l.code.toLowerCase().includes(term)
    );
  }, [langSearchTerm]);

  const handleSelectLanguage = (lang: LanguageOption) => {
    stopSpeaking();
    onLanguageChange(lang.code);
    setIsLangOpen(false);
    setLangSearchTerm('');

    try {
      localStorage.setItem('ila_active_language', lang.code);
    } catch {
      // ignore
    }

    // If a default voice exists for this language, auto-select it
    if (lang.defaultVoiceId && onVoiceProfileChange) {
      onVoiceProfileChange(lang.defaultVoiceId);
      try {
        localStorage.setItem('ila_active_voice_profile', lang.defaultVoiceId);
      } catch {
        // ignore
      }
    }
    // Auto-trigger real-time translation when a language is selected
    if (onTranslateContent) {
      onTranslateContent(lang.code);
    }
  };

  const handleSelectVoice = (voice: VoiceProfile) => {
    stopSpeaking();
    if (onVoiceProfileChange) {
      onVoiceProfileChange(voice.id);
    }
    try {
      localStorage.setItem('ila_active_voice_profile', voice.id);
    } catch {
      // ignore
    }
    setIsVoiceOpen(false);
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0.35rem' : '0.5rem',
        flexWrap: 'nowrap',
      }}
    >
      {/* 1. Language Selector Dropdown */}
      <div ref={langRef} style={{ position: 'relative' }}>
        <button
          id="workspace-language-selector-btn"
          type="button"
          onClick={() => {
            setIsLangOpen(!isLangOpen);
            setIsVoiceOpen(false);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            height: compact ? '28px' : '32px',
            padding: compact ? '0 0.6rem' : '0 0.75rem',
            borderRadius: '9999px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            fontSize: compact ? '0.72rem' : '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.45)';
            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-subtle)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
          }}
          title={`Active Language: ${activeLang.name} (${activeLang.nativeName})`}
        >
          <Globe size={compact ? 12 : 13} color="var(--accent-primary)" />
          <span>{activeLang.flag}</span>
          <span>{activeLang.name}</span>
          <ChevronDown size={11} color="var(--text-muted)" />
        </button>

        {/* Language Dropdown Menu */}
        {isLangOpen && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              width: '260px',
              maxHeight: '340px',
              overflowY: 'auto',
              background: 'rgba(15, 20, 32, 0.98)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '0.75rem',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 15px var(--accent-glow)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '0.35rem',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.15rem',
            }}
          >
            {/* Header Title with Language Count */}
            <div
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                padding: '0.25rem 0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>Global Languages</span>
              <span style={{ color: '#a5b4fc', fontSize: '0.62rem' }}>{SUPPORTED_LANGUAGES.length} Worldwide</span>
            </div>

            {/* Quick Live Search Bar for All Worldwide Languages */}
            <div style={{ padding: '0.15rem 0.25rem 0.35rem 0.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '0.45rem',
                  padding: '0.25rem 0.5rem',
                }}
              >
                <Search size={12} color="var(--text-muted)" />
                <input
                  type="text"
                  value={langSearchTerm}
                  onChange={(e) => setLangSearchTerm(e.target.value)}
                  placeholder="Search Malayalam, German, Arabic..."
                  autoFocus
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    width: '100%',
                  }}
                />
                {langSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setLangSearchTerm('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Language List */}
            <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              {filteredLanguages.length === 0 ? (
                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  No language matching "{langSearchTerm}"
                </div>
              ) : (
                filteredLanguages.map((lang) => {
                  const isSelected = lang.code === currentLanguage;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelectLanguage(lang)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '0.35rem 0.6rem',
                        borderRadius: '0.45rem',
                        background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        border: isSelected ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                        color: isSelected ? '#ffffff' : 'var(--text-main)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span>{lang.flag}</span>
                        <span style={{ fontWeight: isSelected ? 700 : 500 }}>{lang.name}</span>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          ({lang.nativeName})
                        </span>
                      </div>
                      {isSelected && <Check size={12} color="var(--accent-primary)" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Open-Source Voice / Instructor Profile Dropdown (Coqui XTTS v2 & Cloned Weights - Exclusively on Video Player) */}
      {shouldShowVoice && (
        <div ref={voiceRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setIsVoiceOpen(!isVoiceOpen);
              setIsLangOpen(false);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              height: compact ? '28px' : '32px',
              padding: compact ? '0 0.6rem' : '0 0.75rem',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-main)',
              fontSize: compact ? '0.72rem' : '0.76rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.45)';
              e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            title={`Active Voice Engine: ${activeVoice.name} (${activeVoice.badge})`}
          >
            <Volume2 size={compact ? 12 : 13} color="#c084fc" />
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                padding: '0.08rem 0.35rem',
                borderRadius: '9999px',
                background:
                  activeVoice.engine === 'wavenet'
                    ? 'rgba(56, 189, 248, 0.2)'
                    : activeVoice.engine === 'studio'
                    ? 'rgba(236, 72, 153, 0.2)'
                    : activeVoice.engine === 'journey'
                    ? 'rgba(52, 211, 153, 0.2)'
                    : activeVoice.engine === 'neural2'
                    ? 'rgba(168, 85, 247, 0.2)'
                    : 'rgba(59, 130, 246, 0.2)',
                color:
                  activeVoice.engine === 'wavenet'
                    ? '#38bdf8'
                    : activeVoice.engine === 'studio'
                    ? '#f472b6'
                    : activeVoice.engine === 'journey'
                    ? '#34d399'
                    : activeVoice.engine === 'neural2'
                    ? '#d8b4fe'
                    : '#93c5fd',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {activeVoice.badge}
            </span>
            <span style={{ maxWidth: compact ? '85px' : '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeVoice.name.split(' (')[0]}
            </span>
            <ChevronDown size={11} color="var(--text-muted)" />
          </button>

          {/* Voice Profile Dropdown Menu */}
          {isVoiceOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '280px',
                maxHeight: '300px',
                overflowY: 'auto',
                background: 'rgba(15, 20, 32, 0.98)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '0.75rem',
                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 15px rgba(168, 85, 247, 0.3)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '0.35rem',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  padding: '0.25rem 0.5rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  marginBottom: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{activeLang.name} Voices ({scopedVoiceProfiles.length})</span>
                <span style={{ color: '#38bdf8', fontSize: '0.62rem' }}>Contextual Filter</span>
              </div>

              {scopedVoiceProfiles.map((voice) => {
                const isSelected = voice.id === currentVoiceProfile;
                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleSelectVoice(voice)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '0.15rem',
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.45rem',
                      background: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                      border: isSelected ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid transparent',
                      color: isSelected ? '#ffffff' : 'var(--text-main)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontWeight: isSelected ? 700 : 600 }}>{voice.name}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          padding: '0.05rem 0.3rem',
                          borderRadius: '9999px',
                          background:
                            voice.engine === 'wavenet'
                              ? 'rgba(56, 189, 248, 0.25)'
                              : voice.engine === 'studio'
                              ? 'rgba(236, 72, 153, 0.25)'
                              : voice.engine === 'journey'
                              ? 'rgba(52, 211, 153, 0.25)'
                              : voice.engine === 'neural2'
                              ? 'rgba(168, 85, 247, 0.25)'
                              : 'rgba(59, 130, 246, 0.25)',
                          color:
                            voice.engine === 'wavenet'
                              ? '#38bdf8'
                              : voice.engine === 'studio'
                              ? '#f472b6'
                              : voice.engine === 'journey'
                              ? '#34d399'
                              : voice.engine === 'neural2'
                              ? '#d8b4fe'
                              : '#93c5fd',
                        }}
                      >
                        {voice.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      {voice.description}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Dedicated Interactive "Translate Course" Trigger Button */}
      {showTranslateButton && onTranslateContent && (
        <button
          id="interactive-translate-course-btn"
          type="button"
          onClick={() => onTranslateContent(currentLanguage)}
          disabled={isTranslating}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            height: compact ? '28px' : '32px',
            padding: compact ? '0 0.65rem' : '0 0.85rem',
            borderRadius: '9999px',
            background: isTranslating
              ? 'rgba(168, 85, 247, 0.2)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(168, 85, 247, 0.3) 100%)',
            border: '1px solid rgba(165, 180, 252, 0.5)',
            color: '#ffffff',
            fontSize: compact ? '0.72rem' : '0.76rem',
            fontWeight: 700,
            cursor: isTranslating ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.25)',
          }}
          title={`Translate course material and audio narration into ${activeLang.name} (${activeLang.nativeName})`}
        >
          {isTranslating ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>Translating to {activeLang.nativeName || activeLang.name}...</span>
            </>
          ) : (
            <>
              <Sparkles size={12} color="#a5b4fc" />
              <span>Translate ({activeLang.nativeName || activeLang.name})</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
