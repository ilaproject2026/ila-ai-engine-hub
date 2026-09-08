// Type declarations for Web Speech API
interface IWindowSpeech extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * Checks if browser supports Speech Recognition (Speech-to-Text).
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as IWindowSpeech;
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

/**
 * Checks if browser supports Speech Synthesis (Text-to-Speech).
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

let activeRecognition: any = null;

/**
 * Starts listening to microphone input via Web Speech API.
 * @param onResult - Callback triggered when transcript updates (interim or final).
 * @param onError - Callback triggered on recognition error.
 * @param onEnd - Callback triggered when recognition stops.
 * @returns Recognition instance or null if unsupported.
 */
export function startListening(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (errorMsg: string) => void,
  onEnd: () => void,
  lang: string = 'en-US'
): any {
  if (!isSpeechRecognitionSupported()) {
    onError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
    return null;
  }

  // Stop any ongoing recognition first
  stopListening();

  const win = window as unknown as IWindowSpeech;
  const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

  try {
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang || 'en-US';

    recognition.onstart = () => {
      // recognition active
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const combined = (finalTranscript || interimTranscript).trim();
      if (combined) {
        onResult(combined, Boolean(finalTranscript));
      }
    };

    recognition.onerror = (event: any) => {
      let message = 'Speech recognition error';
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        message = 'Microphone access denied. Please check browser permissions.';
      } else if (event.error === 'no-speech') {
        message = 'No speech detected. Please speak into the microphone.';
      } else if (event.error === 'network') {
        message = 'Network error during speech recognition.';
      }
      onError(message);
    };

    recognition.onend = () => {
      activeRecognition = null;
      onEnd();
    };

    recognition.start();
    activeRecognition = recognition;
    return recognition;
  } catch (err: any) {
    onError(err.message || 'Failed to initialize speech recognition.');
    return null;
  }
}

/**
 * Stops any active speech recognition session.
 */
export function stopListening(): void {
  if (activeRecognition) {
    try {
      activeRecognition.stop();
    } catch {
      // ignore if already stopped
    }
    activeRecognition = null;
  }
}

/**
 * Helper to strip markdown symbols for clean text-to-speech pronunciation.
 */
export function cleanMarkdownForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Strip studio visual cues, screen direction tags, and bracketed notes
    .replace(/\[(?:VISUAL CUE|SCREEN CUE|UI SCREEN|STUDIO CUE|NOTE|DIRECTION|TCODE|TOPIC|SEGMENT)[^\]]*\]/gi, '')
    // Remove embedded markdown images
    .replace(/!\[(.*?)\]\((.*?)\)/g, '')
    // Convert code blocks into natural spoken summaries
    .replace(/```[a-zA-Z0-9_-]*\n([\s\S]*?)```/g, 'Here is the technical code structure displayed on your screen.')
    .replace(/```[\s\S]*?```/g, '')
    // Inline code markers
    .replace(/`([^`]+)`/g, '$1')
    // Remove table formatting syntax (|---|---|) and replace pipes with natural pauses
    .replace(/\|[-:\s|]+\|/g, '')
    .replace(/\|/g, ', ')
    // Convert headers (# Title) into distinct spoken clauses with pauses
    .replace(/^#{1,6}\s*(.+)$/gm, '$1. ')
    // Remove bold, italic, and strikethrough markdown
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    // Link syntax [Text](URL) -> retain plain text label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Strip raw HTML tags
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    // List bullets and numbered markers -> clear pauses
    .replace(/^\s*[-+*▸•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    // HTML entities and quotes
    .replace(/&gt;/g, '')
    .replace(/>+/g, '')
    .replace(/&amp;/g, 'and')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    // Arrows to spoken words
    .replace(/->|→|=>/g, ' leads to ')
    // Strip accidental chat boilerplates / apologies
    .replace(/\b(?:It looks like you forgot to paste[^.]*\.|Sure(?: thing)?[,!.]|Certainly(?:!|.)?|As an AI language model[^.]*\.|Please provide the content[^.]*\.)/gi, '')
    // Clean repetitive punctuation and normalize whitespace for natural cadence
    .replace(/\s*([.,!?;:])\s*/g, '$1 ')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Supported UI and Course Localization Languages
 */
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  defaultVoiceId: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  // Primary Universal
  { code: 'en-US', name: 'English (US)', nativeName: 'English', flag: '🇺🇸', defaultVoiceId: 'google-neural2-executive' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'British English', flag: '🇬🇧', defaultVoiceId: 'google-neural2-british' },
  
  // South Asian / Indic Languages
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-malayalam' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', defaultVoiceId: 'google-neural2-hindi' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-tamil' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-telugu' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-kannada' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-bengali' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-marathi' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-gujarati' },
  { code: 'pa-IN', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', defaultVoiceId: 'google-wavenet-punjabi' },
  { code: 'ur-PK', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', defaultVoiceId: 'google-wavenet-urdu' },
  { code: 'ne-NP', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵', defaultVoiceId: 'google-wavenet-nepali' },
  { code: 'si-LK', name: 'Sinhala', nativeName: 'සිංහල', flag: '🇱🇰', defaultVoiceId: 'google-wavenet-sinhala' },

  // European Languages
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', defaultVoiceId: 'google-neural2-german' },
  { code: 'fr-FR', name: 'French', nativeName: 'Français', flag: '🇫🇷', defaultVoiceId: 'google-neural2-french' },
  { code: 'es-ES', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', defaultVoiceId: 'google-neural2-spanish' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', defaultVoiceId: 'google-neural2-italian' },
  { code: 'pt-PT', name: 'Portuguese (PT)', nativeName: 'Português', flag: '🇵🇹', defaultVoiceId: 'google-wavenet-portuguese' },
  { code: 'pt-BR', name: 'Portuguese (BR)', nativeName: 'Português do Brasil', flag: '🇧🇷', defaultVoiceId: 'google-neural2-brazilian' },
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', defaultVoiceId: 'google-wavenet-russian' },
  { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', defaultVoiceId: 'google-wavenet-dutch' },
  { code: 'pl-PL', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', defaultVoiceId: 'google-wavenet-polish' },
  { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', defaultVoiceId: 'google-wavenet-swedish' },
  { code: 'no-NO', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', defaultVoiceId: 'google-wavenet-norwegian' },
  { code: 'da-DK', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', defaultVoiceId: 'google-wavenet-danish' },
  { code: 'fi-FI', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', defaultVoiceId: 'google-wavenet-finnish' },
  { code: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', defaultVoiceId: 'google-wavenet-greek' },
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', defaultVoiceId: 'google-wavenet-turkish' },
  { code: 'cs-CZ', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', defaultVoiceId: 'google-wavenet-czech' },
  { code: 'hu-HU', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺', defaultVoiceId: 'google-wavenet-hungarian' },
  { code: 'ro-RO', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴', defaultVoiceId: 'google-wavenet-romanian' },
  { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', defaultVoiceId: 'google-wavenet-ukrainian' },

  // Middle Eastern & African Languages
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', defaultVoiceId: 'google-wavenet-arabic' },
  { code: 'he-IL', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', defaultVoiceId: 'google-wavenet-hebrew' },
  { code: 'fa-IR', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷', defaultVoiceId: 'google-wavenet-persian' },
  { code: 'sw-KE', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪', defaultVoiceId: 'google-wavenet-swahili' },
  { code: 'am-ET', name: 'Amharic', nativeName: 'አማርኛ', flag: '🇪🇹', defaultVoiceId: 'google-cloud-multilingual' },
  { code: 'yo-NG', name: 'Yoruba', nativeName: 'Yorùbá', flag: '🇳🇬', defaultVoiceId: 'google-cloud-multilingual' },
  { code: 'zu-ZA', name: 'Zulu', nativeName: 'isiZulu', flag: '🇿🇦', defaultVoiceId: 'google-cloud-multilingual' },

  // East & Southeast Asian Languages
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', defaultVoiceId: 'google-neural2-japanese' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳', defaultVoiceId: 'google-neural2-chinese' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', flag: '🇹🇼', defaultVoiceId: 'google-neural2-chinese-tw' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', defaultVoiceId: 'google-neural2-korean' },
  { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', defaultVoiceId: 'google-neural2-vietnamese' },
  { code: 'th-TH', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', defaultVoiceId: 'google-neural2-thai' },
  { code: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', defaultVoiceId: 'google-neural2-indonesian' },
  { code: 'ms-MY', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾', defaultVoiceId: 'google-wavenet-malay' },
  { code: 'tl-PH', name: 'Filipino (Tagalog)', nativeName: 'Wikang Filipino', flag: '🇵🇭', defaultVoiceId: 'google-neural2-filipino' },
  { code: 'my-MM', name: 'Burmese', nativeName: 'မြန်မာစာ', flag: '🇲🇲', defaultVoiceId: 'google-cloud-multilingual' },
];

/**
 * Google Cloud TTS Voice & Instructor Profiles (WaveNet, Neural2, Studio, Journey)
 */
export interface VoiceProfile {
  id: string;
  name: string;
  engine: 'google-cloud' | 'neural2' | 'wavenet' | 'studio' | 'journey' | 'coqui' | 'cloned' | 'system';
  languageCode: string;
  gender: 'female' | 'male' | 'neural';
  description: string;
  badge: string;
  pitchModifier: number;
  rateModifier: number;
  googleVoiceName?: string;
}

export const VOICE_PROFILES: VoiceProfile[] = [
  // --- MALAYALAM (മലയാളം • ml-IN) ---
  {
    id: 'ml-teacher-female',
    name: 'Malayalam Master Teacher (Dr. Meera • മലയാളം - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'ml-IN',
    gender: 'female',
    description: 'High-fidelity WaveNet native Malayalam female teacher with calm, clear academic articulation',
    badge: 'WaveNet Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'ml-IN-Wavenet-A',
  },
  {
    id: 'ml-professor-male',
    name: 'Malayalam Senior Professor (Dr. Ananth • മലയാളം - Senior Lecturer)',
    engine: 'wavenet',
    languageCode: 'ml-IN',
    gender: 'male',
    description: 'Authoritative WaveNet native Malayalam male professor with steady pedagogical cadence',
    badge: 'WaveNet Professor',
    pitchModifier: 0.96,
    rateModifier: 0.90,
    googleVoiceName: 'ml-IN-Wavenet-B',
  },
  {
    id: 'ml-tutor-female',
    name: 'Malayalam Interactive Tutor (Kavya • മലയാളം - Conversational Coach)',
    engine: 'wavenet',
    languageCode: 'ml-IN',
    gender: 'female',
    description: 'Expressive and friendly Malayalam tutor for step-by-step lesson walkthroughs',
    badge: 'Standard Tutor',
    pitchModifier: 1.02,
    rateModifier: 0.94,
    googleVoiceName: 'ml-IN-Standard-A',
  },
  {
    id: 'ml-instructor-male',
    name: 'Malayalam Master Instructor (Madhavan • മലയാളം - Technical Pro)',
    engine: 'wavenet',
    languageCode: 'ml-IN',
    gender: 'male',
    description: 'Clear, structured Malayalam male instructor for technical masterclass modules',
    badge: 'Standard Instructor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'ml-IN-Standard-B',
  },

  // --- TAMIL (தமிழ் • ta-IN) ---
  {
    id: 'ta-teacher-female',
    name: 'Tamil Master Teacher (Dr. Priya • தமிழ் - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'ta-IN',
    gender: 'female',
    description: 'High-fidelity WaveNet Tamil female academic teacher with natural South Indian cadence',
    badge: 'WaveNet Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'ta-IN-Wavenet-A',
  },
  {
    id: 'ta-professor-male',
    name: 'Tamil Senior Professor (Dr. Kumar • தமிழ் - Senior Lecturer)',
    engine: 'wavenet',
    languageCode: 'ta-IN',
    gender: 'male',
    description: 'Authoritative WaveNet Tamil male professor for in-depth curriculum lectures',
    badge: 'WaveNet Professor',
    pitchModifier: 0.96,
    rateModifier: 0.90,
    googleVoiceName: 'ta-IN-Wavenet-B',
  },
  {
    id: 'ta-tutor-female',
    name: 'Tamil Interactive Tutor (Deepa • தமிழ் - Conversational Coach)',
    engine: 'wavenet',
    languageCode: 'ta-IN',
    gender: 'female',
    description: 'Warm and patient Tamil female tutor for interactive guidance',
    badge: 'Standard Tutor',
    pitchModifier: 1.02,
    rateModifier: 0.94,
    googleVoiceName: 'ta-IN-Standard-A',
  },
  {
    id: 'ta-instructor-male',
    name: 'Tamil Master Instructor (Senthil • தமிழ் - Technical Pro)',
    engine: 'wavenet',
    languageCode: 'ta-IN',
    gender: 'male',
    description: 'Structured Tamil male instructor for technical architecture decks',
    badge: 'Standard Instructor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'ta-IN-Standard-B',
  },

  // --- TELUGU (తెలుగు • te-IN) ---
  {
    id: 'te-teacher-female',
    name: 'Telugu Master Teacher (Dr. Lakshmi • తెలుగు - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'te-IN',
    gender: 'female',
    description: 'High-fidelity Telugu female academic teacher with clear diction',
    badge: 'Standard Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'te-IN-Standard-A',
  },
  {
    id: 'te-professor-male',
    name: 'Telugu Senior Professor (Dr. Rajesh • తెలుగు - Senior Lecturer)',
    engine: 'wavenet',
    languageCode: 'te-IN',
    gender: 'male',
    description: 'Authoritative Telugu male professor for structured course lessons',
    badge: 'Standard Professor',
    pitchModifier: 0.96,
    rateModifier: 0.90,
    googleVoiceName: 'te-IN-Standard-B',
  },
  {
    id: 'te-tutor-female',
    name: 'Telugu Interactive Tutor (Sravani • తెలుగు - Conversational Coach)',
    engine: 'wavenet',
    languageCode: 'te-IN',
    gender: 'female',
    description: 'Friendly Telugu female tutor for interactive tutoring',
    badge: 'Standard Tutor',
    pitchModifier: 1.02,
    rateModifier: 0.94,
    googleVoiceName: 'te-IN-Standard-A',
  },

  // --- HINDI (हिन्दी • hi-IN) ---
  {
    id: 'hi-teacher-female',
    name: 'Hindi Master Teacher (Dr. Sunita • हिन्दी - Neural2 Academic)',
    engine: 'neural2',
    languageCode: 'hi-IN',
    gender: 'female',
    description: 'State-of-the-art Neural2 Hindi female academic teacher with crystal-clear terminology',
    badge: 'Neural2 Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'hi-IN-Neural2-A',
  },
  {
    id: 'hi-professor-male',
    name: 'Hindi Senior Professor (Dr. Rohan • हिन्दी - Neural2 Lecturer)',
    engine: 'neural2',
    languageCode: 'hi-IN',
    gender: 'male',
    description: 'Authoritative Neural2 Hindi male professor for technical explanations',
    badge: 'Neural2 Professor',
    pitchModifier: 0.96,
    rateModifier: 0.90,
    googleVoiceName: 'hi-IN-Neural2-B',
  },
  {
    id: 'hi-tutor-female',
    name: 'Hindi Interactive Tutor (Pooja • हिन्दी - Neural2 Coach)',
    engine: 'neural2',
    languageCode: 'hi-IN',
    gender: 'female',
    description: 'Warm and conversational Hindi tutor for step-by-step guidance',
    badge: 'Neural2 Tutor',
    pitchModifier: 1.02,
    rateModifier: 0.94,
    googleVoiceName: 'hi-IN-Neural2-C',
  },
  {
    id: 'hi-instructor-male',
    name: 'Hindi Master Instructor (Amit • हिन्दी - Neural2 Pro)',
    engine: 'neural2',
    languageCode: 'hi-IN',
    gender: 'male',
    description: 'Dynamic Neural2 Hindi male instructor for masterclass modules',
    badge: 'Neural2 Instructor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'hi-IN-Neural2-D',
  },

  // --- KANNADA (ಕನ್ನಡ • kn-IN) ---
  {
    id: 'kn-teacher-female',
    name: 'Kannada Master Teacher (Dr. Ananya • ಕನ್ನಡ - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'kn-IN',
    gender: 'female',
    description: 'Clear Kannada female teacher for academic lectures',
    badge: 'Standard Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'kn-IN-Standard-A',
  },
  {
    id: 'kn-professor-male',
    name: 'Kannada Senior Professor (Dr. Suresh • ಕನ್ನಡ - Senior Lecturer)',
    engine: 'wavenet',
    languageCode: 'kn-IN',
    gender: 'male',
    description: 'Authoritative Kannada male professor for in-depth course walkthroughs',
    badge: 'Standard Professor',
    pitchModifier: 0.96,
    rateModifier: 0.90,
    googleVoiceName: 'kn-IN-Standard-B',
  },

  // --- BENGALI (বাংলা • bn-IN) ---
  {
    id: 'bn-teacher-female',
    name: 'Bengali Master Teacher (Dr. Shreya • বাংলা - WaveNet Academic)',
    engine: 'wavenet',
    languageCode: 'bn-IN',
    gender: 'female',
    description: 'WaveNet Bengali female teacher with refined diction',
    badge: 'WaveNet Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'bn-IN-Wavenet-A',
  },
  {
    id: 'bn-professor-male',
    name: 'Bengali Senior Professor (Dr. Pritam • বাংলা - WaveNet Lecturer)',
    engine: 'wavenet',
    languageCode: 'bn-IN',
    gender: 'male',
    description: 'WaveNet Bengali male professor for structured technical lessons',
    badge: 'WaveNet Professor',
    pitchModifier: 0.96,
    rateModifier: 0.90,
    googleVoiceName: 'bn-IN-Wavenet-B',
  },

  // --- ARABIC (العربية • ar-SA / ar-XA) ---
  {
    id: 'ar-professor-male',
    name: 'Arabic Senior Professor (Sheikh Kareem • العربية - Classical Orator)',
    engine: 'wavenet',
    languageCode: 'ar-SA',
    gender: 'male',
    description: 'Classical WaveNet Arabic male orator with dignified academic delivery',
    badge: 'WaveNet Orator',
    pitchModifier: 0.98,
    rateModifier: 0.90,
    googleVoiceName: 'ar-XA-Wavenet-B',
  },
  {
    id: 'ar-teacher-female',
    name: 'Arabic Master Teacher (Dr. Fatima • العربية - Academic Lecturer)',
    engine: 'wavenet',
    languageCode: 'ar-SA',
    gender: 'female',
    description: 'WaveNet Arabic female lecturer with crystal-clear classical pronunciation',
    badge: 'WaveNet Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'ar-XA-Wavenet-A',
  },
  {
    id: 'ar-tutor-male',
    name: 'Arabic Interactive Tutor (Tariq • العربية - Conversational Coach)',
    engine: 'wavenet',
    languageCode: 'ar-SA',
    gender: 'male',
    description: 'Engaging Arabic male tutor for interactive concept explanation',
    badge: 'Standard Tutor',
    pitchModifier: 1.02,
    rateModifier: 0.94,
    googleVoiceName: 'ar-XA-Standard-A',
  },

  // --- GERMAN (Deutsch • de-DE) ---
  {
    id: 'de-professor-male',
    name: 'German Master Professor (Dr. Thorsten • Deutsch - Neural2 Pro)',
    engine: 'neural2',
    languageCode: 'de-DE',
    gender: 'male',
    description: 'Native Neural2 German academic speaker with crisp, structured articulation',
    badge: 'Neural2 Professor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'de-DE-Neural2-B',
  },
  {
    id: 'de-teacher-female',
    name: 'German Master Teacher (Dr. Marlene • Deutsch - Neural2 Academic)',
    engine: 'neural2',
    languageCode: 'de-DE',
    gender: 'female',
    description: 'Articulate Neural2 German female teacher for academic lectures',
    badge: 'Neural2 Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'de-DE-Neural2-F',
  },

  // --- FRENCH (Français • fr-FR) ---
  {
    id: 'fr-professor-male',
    name: 'French Master Professor (Dr. Camille • Français - Neural2 Pro)',
    engine: 'neural2',
    languageCode: 'fr-FR',
    gender: 'male',
    description: 'Polished Neural2 French professor for structured educational courses',
    badge: 'Neural2 Professor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'fr-FR-Neural2-B',
  },
  {
    id: 'fr-teacher-female',
    name: 'French Master Teacher (Dr. Juliette • Français - Neural2 Academic)',
    engine: 'neural2',
    languageCode: 'fr-FR',
    gender: 'female',
    description: 'Eloquent Neural2 French female teacher for comprehensive masterclasses',
    badge: 'Neural2 Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'fr-FR-Neural2-A',
  },

  // --- SPANISH (Español • es-ES) ---
  {
    id: 'es-professor-male',
    name: 'Spanish Master Professor (Dr. Mateo • Español - Neural2 Pro)',
    engine: 'neural2',
    languageCode: 'es-ES',
    gender: 'male',
    description: 'Warm and expressive Neural2 European Spanish male academic lecturer',
    badge: 'Neural2 Professor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'es-ES-Neural2-B',
  },
  {
    id: 'es-teacher-female',
    name: 'Spanish Master Teacher (Dr. Sofia • Español - Neural2 Academic)',
    engine: 'neural2',
    languageCode: 'es-ES',
    gender: 'female',
    description: 'Clear and engaging Neural2 European Spanish female teacher',
    badge: 'Neural2 Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'es-ES-Neural2-A',
  },

  // --- ENGLISH (English • en-US / en-GB) ---
  {
    id: 'google-neural2-executive',
    name: 'Masterclass Teacher (Dr. Sarah • Executive Academic Pro)',
    engine: 'neural2',
    languageCode: 'en-US',
    gender: 'female',
    description: 'State-of-the-art Neural2 voice tuned for deep, deliberate educational mastery',
    badge: 'Executive Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'en-US-Neural2-F',
  },
  {
    id: 'google-neural2-scholar',
    name: 'Senior Professor (Dr. Arthur • Oxford Academic Lecturer)',
    engine: 'neural2',
    languageCode: 'en-US',
    gender: 'male',
    description: 'Authoritative, calm, and structured Neural2 voice for deep technical lectures',
    badge: 'Senior Professor',
    pitchModifier: 0.96,
    rateModifier: 0.90,
    googleVoiceName: 'en-US-Neural2-D',
  },
  {
    id: 'google-studio-broadcast',
    name: 'Broadcast Cinema Pro (Elena • Crystal Studio Acoustics)',
    engine: 'studio',
    languageCode: 'en-US',
    gender: 'female',
    description: 'Ultra-HD Studio voice trained on high-grade broadcast studio acoustics',
    badge: 'Studio Broadcast',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'en-US-Studio-O',
  },
  {
    id: 'google-journey-coach',
    name: 'Interactive IntelliCoach™ (David • Technical Mentor)',
    engine: 'journey',
    languageCode: 'en-US',
    gender: 'male',
    description: 'Conversational, encouraging, and empathetic voice for interactive tutoring',
    badge: 'IntelliCoach',
    pitchModifier: 0.98,
    rateModifier: 0.94,
    googleVoiceName: 'en-US-Journey-D',
  },

  // Universal Legacy Aliases (Maintains 100% backward compatibility for all existing state)
  {
    id: 'google-wavenet-malayalam',
    name: 'Malayalam Master Teacher (Dr. Meera • മലയാളം - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'ml-IN',
    gender: 'female',
    description: 'High-fidelity WaveNet native Malayalam female teacher with calm, clear academic articulation',
    badge: 'WaveNet Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'ml-IN-Wavenet-A',
  },
  {
    id: 'google-neural2-hindi',
    name: 'Hindi Master Teacher (Dr. Sunita • हिन्दी - Neural2 Academic)',
    engine: 'neural2',
    languageCode: 'hi-IN',
    gender: 'female',
    description: 'State-of-the-art Neural2 Hindi female academic teacher',
    badge: 'Neural2 Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'hi-IN-Neural2-A',
  },
  {
    id: 'google-wavenet-tamil',
    name: 'Tamil Master Teacher (Dr. Priya • தமிழ் - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'ta-IN',
    gender: 'female',
    description: 'WaveNet Tamil female academic teacher',
    badge: 'WaveNet Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'ta-IN-Wavenet-A',
  },
  {
    id: 'google-neural2-german',
    name: 'German Master Professor (Dr. Thorsten • Deutsch - Neural2 Pro)',
    engine: 'neural2',
    languageCode: 'de-DE',
    gender: 'male',
    description: 'Native Neural2 German academic speaker',
    badge: 'Neural2 Professor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'de-DE-Neural2-B',
  },
  {
    id: 'google-neural2-french',
    name: 'French Master Professor (Dr. Camille • Français - Neural2 Pro)',
    engine: 'neural2',
    languageCode: 'fr-FR',
    gender: 'male',
    description: 'Polished Neural2 French professor',
    badge: 'Neural2 Professor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'fr-FR-Neural2-B',
  },
  {
    id: 'google-neural2-spanish',
    name: 'Spanish Master Professor (Dr. Mateo • Español - Neural2 Pro)',
    engine: 'neural2',
    languageCode: 'es-ES',
    gender: 'male',
    description: 'Warm and expressive Neural2 European Spanish male lecturer',
    badge: 'Neural2 Professor',
    pitchModifier: 0.98,
    rateModifier: 0.92,
    googleVoiceName: 'es-ES-Neural2-B',
  },
  {
    id: 'google-wavenet-arabic',
    name: 'Arabic Senior Professor (Sheikh Kareem • العربية - Classical Orator)',
    engine: 'wavenet',
    languageCode: 'ar-SA',
    gender: 'male',
    description: 'Classical WaveNet Arabic male orator',
    badge: 'WaveNet Orator',
    pitchModifier: 0.98,
    rateModifier: 0.90,
    googleVoiceName: 'ar-XA-Wavenet-B',
  },
  {
    id: 'google-wavenet-telugu',
    name: 'Telugu Master Teacher (Dr. Lakshmi • తెలుగు - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'te-IN',
    gender: 'female',
    description: 'Telugu female academic teacher',
    badge: 'Standard Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'te-IN-Standard-A',
  },
  {
    id: 'google-wavenet-kannada',
    name: 'Kannada Master Teacher (Dr. Ananya • ಕನ್ನಡ - Academic Pro)',
    engine: 'wavenet',
    languageCode: 'kn-IN',
    gender: 'female',
    description: 'Kannada female teacher',
    badge: 'Standard Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'kn-IN-Standard-A',
  },
  {
    id: 'google-wavenet-bengali',
    name: 'Bengali Master Teacher (Dr. Shreya • বাংলা - WaveNet Academic)',
    engine: 'wavenet',
    languageCode: 'bn-IN',
    gender: 'female',
    description: 'WaveNet Bengali female teacher',
    badge: 'WaveNet Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'bn-IN-Wavenet-A',
  },
  {
    id: 'coqui-xtts-multilingual',
    name: 'Masterclass Teacher (Dr. Sarah • Executive Academic Pro)',
    engine: 'neural2',
    languageCode: 'en-US',
    gender: 'female',
    description: 'Universal educational voice engine',
    badge: 'Executive Teacher',
    pitchModifier: 1.0,
    rateModifier: 0.92,
    googleVoiceName: 'en-US-Neural2-F',
  },
];

/**
 * Returns strictly contextually filtered voice profiles relevant to the active translation language.
 * Hides unrelated foreign languages to prevent translation conflicts, accent mingling, and UI clutter.
 */
export function getScopedVoiceProfilesForLanguage(langCode: string): VoiceProfile[] {
  const norm = (langCode || 'en-US').toLowerCase();
  const prefix = norm.split('-')[0];

  // Specific matches for this exact language code or language prefix
  const directMatches = VOICE_PROFILES.filter((v) => {
    if (v.languageCode === 'all') return false;
    const vNorm = v.languageCode.toLowerCase();
    const vPrefix = vNorm.split('-')[0];
    return vNorm === norm || vPrefix === prefix;
  });

  if (directMatches.length > 0) {
    // Return unique voice entries for this language
    const seen = new Set<string>();
    return directMatches.filter((v) => {
      if (seen.has(v.name)) return false;
      seen.add(v.name);
      return true;
    });
  }

  // Fallback to English voices if no direct localized voices are defined
  return VOICE_PROFILES.filter((v) => v.languageCode.startsWith('en'));
}

/**
 * Options for Speech Synthesis playback.
 */
export interface SpeechOptions {
  rate?: number; // 0.5 to 2.0 (default: 1.0)
  pitch?: number; // 0.5 to 2.0 (default: 1.0)
  volume?: number; // 0.0 to 1.0 (default: 1.0)
  voiceName?: string;
  voiceProfileId?: string; // e.g. 'google-wavenet-malayalam', 'google-neural2-executive'
  lang?: string; // default: 'en-US'
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: string) => void;
}

/**
 * Returns configured Google API key for Cloud Text-to-Speech (TTS).
 */
export function getGoogleApiKey(): string {
  return (
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_ILA_API_KEY ||
    import.meta.env.GEMINI_API_KEY ||
    import.meta.env.VITE_GOOGLE_API_KEY ||
    import.meta.env.GOOGLE_TTS_API_KEY ||
    ''
  );
}

/**
 * Comprehensive Google Cloud TTS Locale-to-Voice mapping table.
 */
export interface GoogleVoiceConfig {
  languageCode: string;
  name: string;
  ssmlGender: 'FEMALE' | 'MALE' | 'NEUTRAL';
}

export const GOOGLE_CLOUD_LOCALE_VOICES: Record<string, GoogleVoiceConfig> = {
  'ml-in': { languageCode: 'ml-IN', name: 'ml-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'ml': { languageCode: 'ml-IN', name: 'ml-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'en-us': { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  'en-gb': { languageCode: 'en-GB', name: 'en-GB-Neural2-B', ssmlGender: 'MALE' },
  'en': { languageCode: 'en-US', name: 'en-US-Neural2-F', ssmlGender: 'FEMALE' },
  'hi-in': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A', ssmlGender: 'FEMALE' },
  'hi': { languageCode: 'hi-IN', name: 'hi-IN-Neural2-A', ssmlGender: 'FEMALE' },
  'ta-in': { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'ta': { languageCode: 'ta-IN', name: 'ta-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'te-in': { languageCode: 'te-IN', name: 'te-IN-Standard-A', ssmlGender: 'FEMALE' },
  'te': { languageCode: 'te-IN', name: 'te-IN-Standard-A', ssmlGender: 'FEMALE' },
  'kn-in': { languageCode: 'kn-IN', name: 'kn-IN-Standard-A', ssmlGender: 'FEMALE' },
  'kn': { languageCode: 'kn-IN', name: 'kn-IN-Standard-A', ssmlGender: 'FEMALE' },
  'bn-in': { languageCode: 'bn-IN', name: 'bn-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'bn': { languageCode: 'bn-IN', name: 'bn-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'mr-in': { languageCode: 'mr-IN', name: 'mr-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'mr': { languageCode: 'mr-IN', name: 'mr-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'gu-in': { languageCode: 'gu-IN', name: 'gu-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'gu': { languageCode: 'gu-IN', name: 'gu-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'pa-in': { languageCode: 'pa-IN', name: 'pa-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'pa': { languageCode: 'pa-IN', name: 'pa-IN-Wavenet-A', ssmlGender: 'FEMALE' },
  'ur-pk': { languageCode: 'ur-PK', name: 'ur-PK-Wavenet-A', ssmlGender: 'FEMALE' },
  'ur': { languageCode: 'ur-PK', name: 'ur-PK-Wavenet-A', ssmlGender: 'FEMALE' },
  'ne-np': { languageCode: 'ne-NP', name: 'ne-NP-Standard-A', ssmlGender: 'FEMALE' },
  'ne': { languageCode: 'ne-NP', name: 'ne-NP-Standard-A', ssmlGender: 'FEMALE' },
  'si-lk': { languageCode: 'si-LK', name: 'si-LK-Standard-A', ssmlGender: 'FEMALE' },
  'si': { languageCode: 'si-LK', name: 'si-LK-Standard-A', ssmlGender: 'FEMALE' },
  'de-de': { languageCode: 'de-DE', name: 'de-DE-Neural2-B', ssmlGender: 'MALE' },
  'de': { languageCode: 'de-DE', name: 'de-DE-Neural2-B', ssmlGender: 'MALE' },
  'fr-fr': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B', ssmlGender: 'MALE' },
  'fr': { languageCode: 'fr-FR', name: 'fr-FR-Neural2-B', ssmlGender: 'MALE' },
  'es-es': { languageCode: 'es-ES', name: 'es-ES-Neural2-B', ssmlGender: 'MALE' },
  'es': { languageCode: 'es-ES', name: 'es-ES-Neural2-B', ssmlGender: 'MALE' },
  'it-it': { languageCode: 'it-IT', name: 'it-IT-Neural2-A', ssmlGender: 'FEMALE' },
  'it': { languageCode: 'it-IT', name: 'it-IT-Neural2-A', ssmlGender: 'FEMALE' },
  'pt-pt': { languageCode: 'pt-PT', name: 'pt-PT-Wavenet-A', ssmlGender: 'FEMALE' },
  'pt-br': { languageCode: 'pt-BR', name: 'pt-BR-Neural2-A', ssmlGender: 'FEMALE' },
  'pt': { languageCode: 'pt-BR', name: 'pt-BR-Neural2-A', ssmlGender: 'FEMALE' },
  'ru-ru': { languageCode: 'ru-RU', name: 'ru-RU-Wavenet-A', ssmlGender: 'FEMALE' },
  'ru': { languageCode: 'ru-RU', name: 'ru-RU-Wavenet-A', ssmlGender: 'FEMALE' },
  'nl-nl': { languageCode: 'nl-NL', name: 'nl-NL-Wavenet-A', ssmlGender: 'FEMALE' },
  'nl': { languageCode: 'nl-NL', name: 'nl-NL-Wavenet-A', ssmlGender: 'FEMALE' },
  'pl-pl': { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-A', ssmlGender: 'FEMALE' },
  'pl': { languageCode: 'pl-PL', name: 'pl-PL-Wavenet-A', ssmlGender: 'FEMALE' },
  'sv-se': { languageCode: 'sv-SE', name: 'sv-SE-Wavenet-A', ssmlGender: 'FEMALE' },
  'sv': { languageCode: 'sv-SE', name: 'sv-SE-Wavenet-A', ssmlGender: 'FEMALE' },
  'no-no': { languageCode: 'no-NO', name: 'no-NO-Wavenet-A', ssmlGender: 'FEMALE' },
  'no': { languageCode: 'no-NO', name: 'no-NO-Wavenet-A', ssmlGender: 'FEMALE' },
  'da-dk': { languageCode: 'da-DK', name: 'da-DK-Wavenet-A', ssmlGender: 'FEMALE' },
  'da': { languageCode: 'da-DK', name: 'da-DK-Wavenet-A', ssmlGender: 'FEMALE' },
  'fi-fi': { languageCode: 'fi-FI', name: 'fi-FI-Wavenet-A', ssmlGender: 'FEMALE' },
  'fi': { languageCode: 'fi-FI', name: 'fi-FI-Wavenet-A', ssmlGender: 'FEMALE' },
  'el-gr': { languageCode: 'el-GR', name: 'el-GR-Wavenet-A', ssmlGender: 'FEMALE' },
  'el': { languageCode: 'el-GR', name: 'el-GR-Wavenet-A', ssmlGender: 'FEMALE' },
  'tr-tr': { languageCode: 'tr-TR', name: 'tr-TR-Wavenet-A', ssmlGender: 'FEMALE' },
  'tr': { languageCode: 'tr-TR', name: 'tr-TR-Wavenet-A', ssmlGender: 'FEMALE' },
  'cs-cz': { languageCode: 'cs-CZ', name: 'cs-CZ-Wavenet-A', ssmlGender: 'FEMALE' },
  'cs': { languageCode: 'cs-CZ', name: 'cs-CZ-Wavenet-A', ssmlGender: 'FEMALE' },
  'hu-hu': { languageCode: 'hu-HU', name: 'hu-HU-Wavenet-A', ssmlGender: 'FEMALE' },
  'hu': { languageCode: 'hu-HU', name: 'hu-HU-Wavenet-A', ssmlGender: 'FEMALE' },
  'ro-ro': { languageCode: 'ro-RO', name: 'ro-RO-Wavenet-A', ssmlGender: 'FEMALE' },
  'ro': { languageCode: 'ro-RO', name: 'ro-RO-Wavenet-A', ssmlGender: 'FEMALE' },
  'uk-ua': { languageCode: 'uk-UA', name: 'uk-UA-Wavenet-A', ssmlGender: 'FEMALE' },
  'uk': { languageCode: 'uk-UA', name: 'uk-UA-Wavenet-A', ssmlGender: 'FEMALE' },
  'ar-sa': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B', ssmlGender: 'MALE' },
  'ar': { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B', ssmlGender: 'MALE' },
  'he-il': { languageCode: 'he-IL', name: 'he-IL-Wavenet-A', ssmlGender: 'FEMALE' },
  'he': { languageCode: 'he-IL', name: 'he-IL-Wavenet-A', ssmlGender: 'FEMALE' },
  'fa-ir': { languageCode: 'fa-IR', name: 'fa-IR-Standard-A', ssmlGender: 'FEMALE' },
  'fa': { languageCode: 'fa-IR', name: 'fa-IR-Standard-A', ssmlGender: 'FEMALE' },
  'sw-ke': { languageCode: 'sw-KE', name: 'sw-KE-Standard-A', ssmlGender: 'FEMALE' },
  'sw': { languageCode: 'sw-KE', name: 'sw-KE-Standard-A', ssmlGender: 'FEMALE' },
  'am-et': { languageCode: 'am-ET', name: 'am-ET-Standard-A', ssmlGender: 'FEMALE' },
  'am': { languageCode: 'am-ET', name: 'am-ET-Standard-A', ssmlGender: 'FEMALE' },
  'yo-ng': { languageCode: 'yo-NG', name: 'yo-NG-Standard-A', ssmlGender: 'FEMALE' },
  'yo': { languageCode: 'yo-NG', name: 'yo-NG-Standard-A', ssmlGender: 'FEMALE' },
  'zu-za': { languageCode: 'zu-ZA', name: 'zu-ZA-Standard-A', ssmlGender: 'FEMALE' },
  'zu': { languageCode: 'zu-ZA', name: 'zu-ZA-Standard-A', ssmlGender: 'FEMALE' },
  'ja-jp': { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B', ssmlGender: 'FEMALE' },
  'ja': { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B', ssmlGender: 'FEMALE' },
  'zh-cn': { languageCode: 'zh-CN', name: 'zh-CN-Neural2-A', ssmlGender: 'FEMALE' },
  'zh-tw': { languageCode: 'zh-TW', name: 'zh-TW-Neural2-A', ssmlGender: 'FEMALE' },
  'zh': { languageCode: 'zh-CN', name: 'zh-CN-Neural2-A', ssmlGender: 'FEMALE' },
  'ko-kr': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A', ssmlGender: 'FEMALE' },
  'ko': { languageCode: 'ko-KR', name: 'ko-KR-Neural2-A', ssmlGender: 'FEMALE' },
  'vi-vn': { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A', ssmlGender: 'FEMALE' },
  'vi': { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A', ssmlGender: 'FEMALE' },
  'th-th': { languageCode: 'th-TH', name: 'th-TH-Neural2-C', ssmlGender: 'FEMALE' },
  'th': { languageCode: 'th-TH', name: 'th-TH-Neural2-C', ssmlGender: 'FEMALE' },
  'id-id': { languageCode: 'id-ID', name: 'id-ID-Neural2-A', ssmlGender: 'FEMALE' },
  'id': { languageCode: 'id-ID', name: 'id-ID-Neural2-A', ssmlGender: 'FEMALE' },
  'ms-my': { languageCode: 'ms-MY', name: 'ms-MY-Standard-A', ssmlGender: 'FEMALE' },
  'ms': { languageCode: 'ms-MY', name: 'ms-MY-Standard-A', ssmlGender: 'FEMALE' },
  'tl-ph': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-A', ssmlGender: 'FEMALE' },
  'tl': { languageCode: 'fil-PH', name: 'fil-PH-Neural2-A', ssmlGender: 'FEMALE' },
  'my-mm': { languageCode: 'my-MM', name: 'my-MM-Standard-A', ssmlGender: 'FEMALE' },
  'my': { languageCode: 'my-MM', name: 'my-MM-Standard-A', ssmlGender: 'FEMALE' },
};

/**
 * Dynamically resolves the active course/workspace target language locale for TTS.
 * Prioritizes explicit options.lang, then lexical Unicode/character analysis on actual text,
 * and finally active workspace state from localStorage ('ila_active_language').
 */
export function resolveTargetLocale(explicitLang?: string, textSample: string = ''): string {
  // 1. Explicitly passed language option from caller takes highest priority!
  if (explicitLang && explicitLang.trim() && explicitLang !== 'auto') {
    return explicitLang.trim();
  }

  // 2. Lexical analysis on actual text sample
  if (textSample && textSample.trim().length > 0) {
    const detected = detectLanguageFromText(textSample);
    // If text contains native non-Latin script (Malayalam, Tamil, Hindi, Arabic, Russian, Chinese, Japanese, etc.)
    // or verified German/French/Spanish lexical markers, use the detected language directly:
    if (detected.lang && detected.lang !== 'en-US') {
      return detected.lang;
    }

    // If the text is purely English ASCII words (e.g. "1. Introduction to Cardiology..."),
    // return English directly to prevent accidental fallback to non-English localStorage languages!
    const isPureAscii = /^[A-Za-z0-9\s.,!?'"():;\-_%$/\\#*+=[\]{}|~`<>@&]+$/.test(textSample.trim());
    if (isPureAscii && textSample.trim().length > 15) {
      return 'en-US';
    }
  }

  // 3. Active saved workspace language from localStorage
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('ila_active_language');
      if (saved && saved.trim() && saved !== 'auto') {
        return saved.trim();
      }
    } catch {
      // ignore
    }
  }

  return 'en-US';
}

/**
 * Resolves the Google Cloud TTS voice configuration for any given locale and optional profile ID.
 */
export function getGoogleTTSVoiceConfig(targetLocale: string, profileId?: string): GoogleVoiceConfig {
  const normLocale = (targetLocale || 'en-US').toLowerCase().trim();
  const prefix = normLocale.split('-')[0];

  // If a non-English language is requested (e.g. Malayalam 'ml-IN', German 'de-DE', Hindi 'hi-IN', Tamil 'ta-IN'),
  // ALWAYS map strictly to the authoritative regional Google Cloud voice for that language:
  if (normLocale !== 'en-us' && normLocale !== 'en' && normLocale !== 'en-gb') {
    if (GOOGLE_CLOUD_LOCALE_VOICES[normLocale]) {
      return GOOGLE_CLOUD_LOCALE_VOICES[normLocale];
    }
    if (GOOGLE_CLOUD_LOCALE_VOICES[prefix]) {
      return GOOGLE_CLOUD_LOCALE_VOICES[prefix];
    }
  }

  const profile = profileId ? VOICE_PROFILES.find((p) => p.id === profileId) : undefined;
  if (profile && profile.googleVoiceName) {
    return {
      languageCode: profile.languageCode || 'en-US',
      name: profile.googleVoiceName,
      ssmlGender: profile.gender === 'male' ? 'MALE' : profile.gender === 'female' ? 'FEMALE' : 'NEUTRAL',
    };
  }

  if (GOOGLE_CLOUD_LOCALE_VOICES[normLocale]) {
    return GOOGLE_CLOUD_LOCALE_VOICES[normLocale];
  }

  return GOOGLE_CLOUD_LOCALE_VOICES['en-us'];
}

// In-Memory Synthesized Audio Cache for Zero-Latency Replays
const googleTtsAudioCache = new Map<string, string>();

/**
 * Synthesizes speech using the official Google Cloud Text-to-Speech (TTS) REST API.
 * Returns a base64 MP3 data URI suitable for direct playback in HTML5 Audio or Web Audio API.
 */
export async function synthesizeGoogleCloudTTS(
  text: string,
  options: {
    lang?: string;
    voiceProfileId?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
  } = {}
): Promise<string> {
  const apiKey = getGoogleApiKey();
  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
    throw new Error('No Google Cloud API key configured.');
  }

  const cleaned = cleanMarkdownForSpeech(text);
  if (!cleaned || cleaned.trim().length === 0) {
    return '';
  }

  const targetLang = resolveTargetLocale(options.lang, cleaned).toLowerCase();
  const voiceConfig = getGoogleTTSVoiceConfig(targetLang, options.voiceProfileId);

  const profile = options.voiceProfileId ? VOICE_PROFILES.find((p) => p.id === options.voiceProfileId) : undefined;
  let calculatedPitch = options.pitch ?? 1.0;
  let calculatedRate = options.rate ?? 1.0;
  if (profile) {
    calculatedPitch *= profile.pitchModifier;
    calculatedRate *= profile.rateModifier;
  }

  const speakingRate = Math.max(0.5, Math.min(2.0, calculatedRate));
  const pitchSemitones = Math.max(-20.0, Math.min(20.0, (calculatedPitch - 1.0) * 10));

  const cacheKey = `${voiceConfig.languageCode}_${voiceConfig.name}_${speakingRate.toFixed(2)}_${pitchSemitones.toFixed(2)}_${cleaned}`;
  if (googleTtsAudioCache.has(cacheKey)) {
    return googleTtsAudioCache.get(cacheKey)!;
  }

  const payload = {
    input: { text: cleaned },
    voice: {
      languageCode: voiceConfig.languageCode,
      name: voiceConfig.name,
      ssmlGender: voiceConfig.ssmlGender,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate,
      pitch: pitchSemitones,
      volumeGainDb: 0.0,
    },
  };

  const response = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Cloud TTS API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error('Google Cloud TTS returned empty audioContent.');
  }

  const audioDataUri = `data:audio/mp3;base64,${data.audioContent}`;
  googleTtsAudioCache.set(cacheKey, audioDataUri);
  return audioDataUri;
}

// Active Audio & SpeechSynthesis references
let currentActiveAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      cachedVoices = window.speechSynthesis.getVoices();
    } catch {
      // ignore
    }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

/**
 * Plays a pleasant, subtle studio intro chime to engage hardware audio output.
 */
export function playStudioChime(volume: number = 0.25): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.08); // E5
    osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.16); // G5

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.2, volume * 0.2), now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        // ignore
      }
    }, 350);
  } catch {
    // audio context blocked or unsupported
  }
}

/**
 * Unlocks audio and speech synthesis engines on user gesture.
 */
export function unlockAudioAndSpeech(): void {
  if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Detects the language code (e.g. 'ml-IN', 'ta-IN', 'hi-IN', 'de-DE', 'fr-FR', 'es-ES', 'en-US')
 * from the text content based on Unicode script analysis and lexical patterns.
 */
export function detectLanguageFromText(text: string): { lang: string; langCode: string; name: string } {
  if (!text || typeof text !== 'string') {
    return { lang: 'en-US', langCode: 'en', name: 'English' };
  }

  const sample = text.slice(0, 1500);

  // 1. Unicode Script-based detection
  // Malayalam (ml-IN)
  if (/[\u0D00-\u0D7F]/.test(sample)) {
    return { lang: 'ml-IN', langCode: 'ml', name: 'Malayalam' };
  }
  // Tamil (ta-IN)
  if (/[\u0B80-\u0BFF]/.test(sample)) {
    return { lang: 'ta-IN', langCode: 'ta', name: 'Tamil' };
  }
  // Hindi / Devanagari (hi-IN)
  if (/[\u0900-\u097F]/.test(sample)) {
    return { lang: 'hi-IN', langCode: 'hi', name: 'Hindi' };
  }
  // Telugu (te-IN)
  if (/[\u0C00-\u0C7F]/.test(sample)) {
    return { lang: 'te-IN', langCode: 'te', name: 'Telugu' };
  }
  // Kannada (kn-IN)
  if (/[\u0C80-\u0CFF]/.test(sample)) {
    return { lang: 'kn-IN', langCode: 'kn', name: 'Kannada' };
  }
  // Bengali / Assamese (bn-IN)
  if (/[\u0980-\u09FF]/.test(sample)) {
    return { lang: 'bn-IN', langCode: 'bn', name: 'Bengali' };
  }
  // Gujarati (gu-IN)
  if (/[\u0A80-\u0AFF]/.test(sample)) {
    return { lang: 'gu-IN', langCode: 'gu', name: 'Gujarati' };
  }
  // Punjabi / Gurmukhi (pa-IN)
  if (/[\u0A00-\u0A7F]/.test(sample)) {
    return { lang: 'pa-IN', langCode: 'pa', name: 'Punjabi' };
  }
  // Arabic / Urdu (ar-SA)
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(sample)) {
    return { lang: 'ar-SA', langCode: 'ar', name: 'Arabic' };
  }
  // Japanese (ja-JP)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) {
    return { lang: 'ja-JP', langCode: 'ja', name: 'Japanese' };
  }
  // Chinese (zh-CN)
  if (/[\u4E00-\u9FFF]/.test(sample)) {
    return { lang: 'zh-CN', langCode: 'zh', name: 'Chinese' };
  }
  // Korean (ko-KR)
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(sample)) {
    return { lang: 'ko-KR', langCode: 'ko', name: 'Korean' };
  }
  // Russian / Cyrillic (ru-RU)
  if (/[\u0400-\u04FF]/.test(sample)) {
    return { lang: 'ru-RU', langCode: 'ru', name: 'Russian' };
  }

  // 2. Lexical & character-based detection for European languages
  const lower = sample.toLowerCase();

  // German (de-DE)
  const germanPattern = /\b(und|der|die|das|ist|nicht|eine|einen|einem|einer|für|mit|auf|nach|über|Kapitel|Modul|Kurs|Lernen|Verstehen|Beispiel|Inhalt|Frage|Antwort)\b/i;
  const germanChars = /[äöüß]/i;
  if (germanChars.test(lower) || (lower.match(germanPattern) && (lower.match(germanPattern)?.length || 0) >= 2)) {
    return { lang: 'de-DE', langCode: 'de', name: 'German' };
  }

  // French (fr-FR)
  const frenchPattern = /\b(est|les|des|une|pour|dans|sur|avec|chapitre|cours|module|apprentissage|exemple|ce|cette|vous|nous|sont)\b/i;
  const frenchChars = /[éàèùâêîôûëïüç]/i;
  if (frenchChars.test(lower) || (lower.match(frenchPattern) && (lower.match(frenchPattern)?.length || 0) >= 2)) {
    return { lang: 'fr-FR', langCode: 'fr', name: 'French' };
  }

  // Spanish (es-ES)
  const spanishPattern = /\b(este|esta|curso|capítulo|módulo|ejemplo|para|como|sobre|aprendizaje|explicación|con|los|las|una|uno)\b/i;
  const spanishChars = /[áéíóúñ¿¡]/i;
  if (spanishChars.test(lower) || (lower.match(spanishPattern) && (lower.match(spanishPattern)?.length || 0) >= 2)) {
    return { lang: 'es-ES', langCode: 'es', name: 'Spanish' };
  }

  // Italian (it-IT)
  const italianPattern = /\b(questo|questa|corso|capitolo|modulo|esempio|per|come|apprendimento|spiegazione|con|delle|degli)\b/i;
  if (italianPattern.test(lower) && (lower.match(italianPattern)?.length || 0) >= 2) {
    return { lang: 'it-IT', langCode: 'it', name: 'Italian' };
  }

  // Portuguese (pt-BR)
  const portuguesePattern = /\b(curso|capítulo|módulo|exemplo|para|com|sobre|este|esta|aprendizado|como|você)\b/i;
  const portugueseChars = /[ãõçáéíóúâêô]/i;
  if (portugueseChars.test(lower) && (lower.match(portuguesePattern) && (lower.match(portuguesePattern)?.length || 0) >= 2)) {
    return { lang: 'pt-BR', langCode: 'pt', name: 'Portuguese' };
  }

  // Default fallback to English
  return { lang: 'en-US', langCode: 'en', name: 'English' };
}

// Global playback state for multi-chunk streaming audio
let activeAudioQueueToken = 0;

/**
 * Maps full locale code (e.g. 'ml-IN', 'ta-IN', 'de-DE') to universal TTS language code.
 */
export function getRegionalTtsLanguageCode(locale: string): string {
  const norm = (locale || '').toLowerCase().trim();
  if (norm.startsWith('ml')) return 'ml';
  if (norm.startsWith('ta')) return 'ta';
  if (norm.startsWith('hi')) return 'hi';
  if (norm.startsWith('te')) return 'te';
  if (norm.startsWith('kn')) return 'kn';
  if (norm.startsWith('bn')) return 'bn';
  if (norm.startsWith('mr')) return 'mr';
  if (norm.startsWith('gu')) return 'gu';
  if (norm.startsWith('pa')) return 'pa';
  if (norm.startsWith('ur')) return 'ur';
  if (norm.startsWith('ne')) return 'ne';
  if (norm.startsWith('si')) return 'si';
  if (norm.startsWith('ar')) return 'ar';
  if (norm.startsWith('de')) return 'de';
  if (norm.startsWith('fr')) return 'fr';
  if (norm.startsWith('es')) return 'es';
  if (norm.startsWith('it')) return 'it';
  if (norm.startsWith('pt')) return 'pt';
  if (norm.startsWith('ru')) return 'ru';
  if (norm.startsWith('ja')) return 'ja';
  if (norm.startsWith('zh')) return 'zh-CN';
  if (norm.startsWith('ko')) return 'ko';
  if (norm.startsWith('vi')) return 'vi';
  if (norm.startsWith('th')) return 'th';
  if (norm.startsWith('id')) return 'id';
  if (norm.startsWith('ms')) return 'ms';
  if (norm.startsWith('fil') || norm.startsWith('tl')) return 'tl';
  if (norm.startsWith('tr')) return 'tr';
  if (norm.startsWith('el')) return 'el';
  if (norm.startsWith('nl')) return 'nl';
  if (norm.startsWith('sv')) return 'sv';
  if (norm.startsWith('pl')) return 'pl';
  return 'en';
}

/**
 * Splits text into natural sentence/clause chunks for zero-latency audio streaming.
 */
export function splitTextForAudioStreaming(text: string, maxLen: number = 180): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];

  // Match sentences by Indian/Western punctuation
  const sentences = clean.match(/[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g) || [clean];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const segment = s.trim();
    if (!segment) continue;

    if ((current + ' ' + segment).trim().length <= maxLen) {
      current = (current + ' ' + segment).trim();
    } else {
      if (current) chunks.push(current);
      if (segment.length <= maxLen) {
        current = segment;
      } else {
        // Split long clauses by commas or spaces
        const parts = segment.split(/([,;:\s]+)/);
        let sub = '';
        for (const p of parts) {
          if ((sub + p).length <= maxLen) {
            sub += p;
          } else {
            if (sub.trim()) chunks.push(sub.trim());
            sub = p.trim();
          }
        }
        current = sub.trim();
      }
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [clean.slice(0, maxLen)];
}

/**
 * Universal Zero-Fail Regional Neural Audio Streamer:
 * Speaks native regional languages (Malayalam, Tamil, Hindi, German, Arabic, etc.)
 * with zero required cloud setups, preventing silence or browser skipping.
 */
export function streamRegionalAudioTTS(
  cleanedText: string,
  targetLocale: string,
  options: SpeechOptions = {},
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: string) => void
): void {
  const langCode = getRegionalTtsLanguageCode(targetLocale);
  const chunks = splitTextForAudioStreaming(cleanedText, 180);

  if (chunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  // Increment token to cancel any earlier running playlist
  activeAudioQueueToken += 1;
  const currentToken = activeAudioQueueToken;

  let currentChunkIdx = 0;
  let hasStarted = false;

  const playNextChunk = () => {
    if (currentToken !== activeAudioQueueToken) return;

    if (currentChunkIdx >= chunks.length) {
      currentActiveAudio = null;
      if (onEnd) onEnd();
      return;
    }

    const chunk = chunks[currentChunkIdx];
    const encoded = encodeURIComponent(chunk);
    // Primary High-Speed Endpoint: Local Server TTS Proxy (Zero CORS / Zero Blocking / Direct MP3 stream for Malayalam, Tamil, German, etc.)
    const primaryUrl = `/api/tts?tl=${langCode}&q=${encoded}`;

    const audio = new Audio();
    audio.src = primaryUrl;
    currentActiveAudio = audio;
    audio.volume = Math.max(0.0, Math.min(1.0, options.volume ?? 1.0));
    audio.playbackRate = Math.max(0.5, Math.min(2.5, options.rate ?? 1.0));

    audio.onplay = () => {
      if (currentToken !== activeAudioQueueToken) {
        audio.pause();
        return;
      }
      if (!hasStarted) {
        hasStarted = true;
        if (onStart) onStart();
      }
    };

    audio.onended = () => {
      if (currentToken !== activeAudioQueueToken) return;
      currentChunkIdx += 1;
      playNextChunk();
    };

    audio.onerror = (e) => {
      if (currentToken !== activeAudioQueueToken) return;
      console.warn(`[Regional Audio Streamer] Notice for chunk ${currentChunkIdx} (${langCode}), trying direct cloud stream:`, e);
      // Secondary Direct Cloud Stream URL
      const directUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${langCode}&q=${encoded}`;
      const directAudio = new Audio(directUrl);
      currentActiveAudio = directAudio;
      directAudio.volume = Math.max(0.0, Math.min(1.0, options.volume ?? 1.0));
      directAudio.playbackRate = Math.max(0.5, Math.min(2.5, options.rate ?? 1.0));

      directAudio.onended = () => {
        if (currentToken !== activeAudioQueueToken) return;
        currentChunkIdx += 1;
        playNextChunk();
      };
      directAudio.onerror = () => {
        currentActiveAudio = null;
        speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
      };
      directAudio.play().catch(() => {
        currentActiveAudio = null;
        speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
      });
    };

    audio.play().catch((playErr) => {
      if (currentToken !== activeAudioQueueToken) return;
      console.warn(`[Regional Audio Streamer] Notice for chunk (${langCode}), trying secondary stream:`, playErr);
      const directUrl = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${langCode}&q=${encoded}`;
      const directAudio = new Audio(directUrl);
      currentActiveAudio = directAudio;
      directAudio.onended = () => {
        if (currentToken !== activeAudioQueueToken) return;
        currentChunkIdx += 1;
        playNextChunk();
      };
      directAudio.onerror = () => {
        currentActiveAudio = null;
        speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
      };
      directAudio.play().catch(() => {
        currentActiveAudio = null;
        speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
      });
    });
  };

  playNextChunk();
}

/**
 * Fallback Web Speech Synthesis runner.
 */
function speakViaWebSpeech(
  cleanedText: string,
  options: SpeechOptions,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: string) => void
): void {
  const targetLang = resolveTargetLocale(options.lang, cleanedText);
  const targetLangCode = targetLang.split('-')[0].toLowerCase();

  if (cachedVoices.length === 0) {
    loadVoices();
  }

  const voices = cachedVoices.length > 0 ? cachedVoices : (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []);
  
  // Find matching voice for target language
  let chosenVoice: SpeechSynthesisVoice | undefined;
  if (voices.length > 0) {
    if (options.voiceName) {
      chosenVoice = voices.find((v) => v.name.toLowerCase().includes(options.voiceName!.toLowerCase()));
    }

    if (!chosenVoice && targetLangCode === 'ml') {
      chosenVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().replace('_', '-') === 'ml-in' ||
          v.lang.toLowerCase().startsWith('ml') ||
          v.name.toLowerCase().includes('malayalam') ||
          v.name.includes('മലയാളം')
      );
    }

    if (!chosenVoice && targetLangCode === 'hi') {
      chosenVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().replace('_', '-') === 'hi-in' ||
          v.lang.toLowerCase().startsWith('hi') ||
          v.name.toLowerCase().includes('hindi') ||
          v.name.includes('हिन्दी')
      );
    }

    if (!chosenVoice && targetLangCode === 'ta') {
      chosenVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().replace('_', '-') === 'ta-in' ||
          v.lang.toLowerCase().startsWith('ta') ||
          v.name.toLowerCase().includes('tamil') ||
          v.name.includes('தமிழ்')
      );
    }

    if (!chosenVoice) {
      chosenVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().replace('_', '-') === targetLang.toLowerCase() &&
          (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('Online'))
      );
    }

    if (!chosenVoice) {
      chosenVoice = voices.find((v) => v.lang.toLowerCase().replace('_', '-') === targetLang.toLowerCase());
    }

    if (!chosenVoice) {
      chosenVoice = voices.find((v) => v.lang.toLowerCase().startsWith(targetLangCode));
    }
  }

  if (!isSpeechSynthesisSupported()) {
    console.warn('[SpeechSynthesis] Not supported in this environment.');
    if (onError) onError('Speech synthesis is not supported in this browser.');
    if (onEnd) onEnd();
    return;
  }

  // Split long narration into short, natural sentence/clause chunks (~140 chars max).
  // This completely eliminates the Chromium/Edge 8-15s audio cutoff bug and prevents early termination.
  const sentenceChunks = splitTextForAudioStreaming(cleanedText, 140);
  if (sentenceChunks.length === 0) {
    if (onEnd) onEnd();
    return;
  }

  activeAudioQueueToken += 1;
  const currentToken = activeAudioQueueToken;

  let chunkIdx = 0;
  let hasStarted = false;

  const playNextUtterance = () => {
    if (currentToken !== activeAudioQueueToken) return;

    if (chunkIdx >= sentenceChunks.length) {
      activeUtterance = null;
      if (onEnd) onEnd();
      return;
    }

    const chunkText = sentenceChunks[chunkIdx];
    const utterance = new SpeechSynthesisUtterance(chunkText);
    activeUtterance = utterance;
    (window as any).__masterclassSpeechUtterance = utterance;

    const profile = options.voiceProfileId ? VOICE_PROFILES.find((p) => p.id === options.voiceProfileId) : undefined;
    let calculatedPitch = options.pitch ?? 1.0;
    let calculatedRate = options.rate ?? 1.0;
    if (profile) {
      calculatedPitch *= profile.pitchModifier;
      calculatedRate *= profile.rateModifier;
    }

    utterance.rate = Math.max(0.5, Math.min(2.0, calculatedRate));
    utterance.pitch = Math.max(0.5, Math.min(2.0, calculatedPitch));
    utterance.volume = Math.max(0.0, Math.min(1.0, options.volume ?? 1.0));
    utterance.lang = targetLang;

    if (chosenVoice) {
      utterance.voice = chosenVoice;
      utterance.lang = chosenVoice.lang || targetLang;
    }

    utterance.onstart = () => {
      if (currentToken !== activeAudioQueueToken) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
        return;
      }
      if (!hasStarted) {
        hasStarted = true;
        if (onStart) onStart();
      }
    };

    utterance.onend = () => {
      if (currentToken !== activeAudioQueueToken) return;
      chunkIdx += 1;
      playNextUtterance();
    };

    utterance.onerror = (e) => {
      if (currentToken !== activeAudioQueueToken) return;
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn(`[Web Speech Synthesis] Chunk ${chunkIdx} notice (${e.error}), proceeding:`, e);
      }
      chunkIdx += 1;
      if (chunkIdx < sentenceChunks.length) {
        playNextUtterance();
      } else {
        activeUtterance = null;
        if (onEnd) onEnd();
      }
    };

    try {
      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err: any) {
      console.warn('[SpeechSynthesis] Speak execution notice:', err);
      chunkIdx += 1;
      if (chunkIdx < sentenceChunks.length) {
        playNextUtterance();
      } else {
        activeUtterance = null;
        if (onEnd) onEnd();
      }
    }
  };

  playNextUtterance();
}

/**
 * Primary Audio Synthesis Engine: Speaks the provided text using Google Cloud Text-to-Speech (TTS) REST API,
 * with universal regional audio streaming fallback and browser Web Speech API.
 */
export function speakText(
  text: string,
  optionsOrOnStart?: SpeechOptions | (() => void),
  onStartOrOnEnd?: () => void,
  onEndOrOnError?: (() => void) | ((err: string) => void),
  possibleOnError?: (err: string) => void
): void {
  // Parse polymorphic arguments
  const currentGlobalRate = getGlobalPlaybackRate();
  let options: SpeechOptions = { rate: currentGlobalRate, pitch: 1.0, volume: 1.0, lang: 'en-US' };
  let onStart: (() => void) | undefined;
  let onEnd: (() => void) | undefined;
  let onError: ((err: string) => void) | undefined;

  if (typeof optionsOrOnStart === 'object' && optionsOrOnStart !== null) {
    options = { ...options, ...optionsOrOnStart };
    if (options.rate === undefined) {
      options.rate = currentGlobalRate;
    }
    onStart = options.onStart || onStartOrOnEnd;
    onEnd = options.onEnd || (typeof onEndOrOnError === 'function' ? (onEndOrOnError as () => void) : undefined);
    onError = options.onError || possibleOnError;
  } else if (typeof optionsOrOnStart === 'function') {
    onStart = optionsOrOnStart;
    onEnd = onStartOrOnEnd;
    onError = onEndOrOnError as ((err: string) => void) | undefined;
  }

  stopSpeaking();

  let cleanedText = cleanMarkdownForSpeech(text);
  if (!cleanedText || cleanedText.trim().length === 0) {
    cleanedText = 'Welcome to this masterclass lesson segment. We examine the core architecture, workflows, and implementation guidelines.';
  }

  const targetLang = resolveTargetLocale(options.lang, cleanedText);
  options.lang = targetLang;
  const targetLangCode = targetLang.split('-')[0].toLowerCase();

  // For all regional non-English languages (e.g. Malayalam, Tamil, Hindi, German, Arabic, French, Spanish),
  // immediately stream native MP3 audio via high-speed server TTS proxy!
  if (targetLangCode !== 'en') {
    streamRegionalAudioTTS(cleanedText, targetLang, options, onStart, onEnd, onError);
    return;
  }

  const apiKey = getGoogleApiKey();
  if (apiKey && apiKey.trim() !== '' && apiKey !== 'your_api_key_here') {
    // Primary Official Google Cloud Text-to-Speech (TTS) REST API Pipeline for English
    synthesizeGoogleCloudTTS(cleanedText, {
      lang: options.lang,
      voiceProfileId: options.voiceProfileId,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
    })
      .then((audioUri) => {
        if (!audioUri) {
          speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
          return;
        }

        const audio = new Audio(audioUri);
        currentActiveAudio = audio;
        audio.volume = Math.max(0.0, Math.min(1.0, options.volume ?? 1.0));
        audio.playbackRate = Math.max(0.5, Math.min(2.0, options.rate ?? 1.0));

        let hasFinished = false;
        const triggerEnd = () => {
          if (hasFinished) return;
          hasFinished = true;
          if (currentActiveAudio === audio) {
            currentActiveAudio = null;
          }
          if (onEnd) onEnd();
        };

        audio.onplay = () => {
          if (onStart) onStart();
        };

        audio.onended = () => {
          triggerEnd();
        };

        audio.onerror = (e) => {
          console.warn('[Google Cloud Audio] Notice, delegating to WebSpeech:', e);
          triggerEnd();
          speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
        };

        audio.play().catch((playErr) => {
          console.warn('[Google Cloud Audio] Play execution notice:', playErr);
          speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
        });
      })
      .catch((synthErr) => {
        console.warn('[Google Cloud TTS] Synthesis notice, delegating to WebSpeech:', synthErr);
        speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
      });
  } else {
    speakViaWebSpeech(cleanedText, options, onStart, onEnd, onError);
  }
}

/**
 * Returns currently active speech utterance or audio element if any.
 */
export function getActiveUtterance(): SpeechSynthesisUtterance | HTMLAudioElement | null {
  return currentActiveAudio || activeUtterance;
}

let activeGlobalPlaybackRate: number = (() => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('ila_playback_speed');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 0.5 && val <= 2.5) return val;
      }
    } catch {
      // ignore
    }
  }
  return 1.0;
})();

/**
 * Returns the currently active global playback speed rate.
 */
export function getGlobalPlaybackRate(): number {
  return activeGlobalPlaybackRate;
}

/**
 * Dynamically adjusts and permanently persists the playback speed of the audio or speech stream.
 */
export function setGlobalPlaybackRate(rate: number): void {
  const r = Math.max(0.5, Math.min(2.5, rate));
  activeGlobalPlaybackRate = r;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('ila_playback_speed', String(r));
    } catch {
      // ignore
    }
  }
  if (currentActiveAudio) {
    try {
      currentActiveAudio.playbackRate = r;
    } catch {
      // ignore
    }
  }
}

/**
 * Cancels and stops all ongoing Google Cloud Audio, Regional Streaming, and SpeechSynthesis playback.
 */
export function stopSpeaking(): void {
  activeAudioQueueToken += 1;
  if (currentActiveAudio) {
    try {
      currentActiveAudio.pause();
      currentActiveAudio.currentTime = 0;
      currentActiveAudio.onplay = null;
      currentActiveAudio.onended = null;
      currentActiveAudio.onerror = null;
    } catch {
      // ignore
    }
    currentActiveAudio = null;
  }
  if (activeUtterance) {
    activeUtterance.onstart = null;
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
    activeUtterance = null;
  }
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }
  }
}
