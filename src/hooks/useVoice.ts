import { useState, useEffect, useCallback } from 'react';
import {
  startListening,
  stopListening,
  speakText,
  stopSpeaking,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  type SpeechOptions,
} from '../services/speechService';

export function useVoice() {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeSpeakingId, setActiveSpeakingId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [interimText, setInterimText] = useState<string>('');

  const isRecognitionSupported = isSpeechRecognitionSupported();
  const isSynthesisSupported = isSpeechSynthesisSupported();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, []);

  const toggleListening = useCallback(
    (onFinalTranscript: (text: string) => void) => {
      if (isListening) {
        stopListening();
        setIsListening(false);
        setInterimText('');
      } else {
        setSpeechError(null);
        setInterimText('');
        setIsListening(true);

        startListening(
          (text) => {
            setInterimText(text);
            onFinalTranscript(text);
          },
          (errMsg) => {
            setSpeechError(errMsg);
            setIsListening(false);
            setInterimText('');
          },
          () => {
            setIsListening(false);
            setInterimText('');
          }
        );
      }
    },
    [isListening]
  );

  const speak = useCallback(
    (text: string, id: string = 'active', optionsOrLang?: SpeechOptions | string) => {
      if (!text) return;

      if (activeSpeakingId === id && isSpeaking) {
        stopSpeaking();
        setIsSpeaking(false);
        setActiveSpeakingId(null);
        return;
      }

      stopSpeaking();
      setActiveSpeakingId(id);
      setIsSpeaking(true);

      const resolvedOptions: SpeechOptions =
        typeof optionsOrLang === 'string'
          ? { lang: optionsOrLang }
          : typeof optionsOrLang === 'object' && optionsOrLang !== null
          ? optionsOrLang
          : {};

      speakText(
        text,
        resolvedOptions,
        () => {
          setIsSpeaking(true);
          setActiveSpeakingId(id);
        },
        () => {
          setIsSpeaking(false);
          setActiveSpeakingId(null);
        },
        (err) => {
          setSpeechError(err);
          setIsSpeaking(false);
          setActiveSpeakingId(null);
        }
      );
    },
    [activeSpeakingId, isSpeaking]
  );

  const stopAllSpeech = useCallback(() => {
    stopSpeaking();
    setIsSpeaking(false);
    setActiveSpeakingId(null);
  }, []);

  return {
    isListening,
    isSpeaking,
    activeSpeakingId,
    speechError,
    interimText,
    setSpeechError,
    isRecognitionSupported,
    isSynthesisSupported,
    toggleListening,
    speak,
    stopAllSpeech,
  };
}
