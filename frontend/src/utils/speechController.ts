/**
 * SecurAI Web Speech API Controller (VOICE-01 / VOICE-02)
 * Provides 100% client-side Speech-to-Text (STT) and Text-to-Speech (TTS).
 * Zero server audio upload, zero cost, zero latency, and privacy-preserving.
 */

// Type declarations for browser Web Speech Recognition
interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string };
}

interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: ISpeechRecognitionResult;
  };
}

interface ISpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognitionInstance;
}

interface IWindowWithSpeech extends Window {
  SpeechRecognition?: ISpeechRecognitionConstructor;
  webkitSpeechRecognition?: ISpeechRecognitionConstructor;
}

// Persistent module-level reference to prevent V8 garbage-collection during active speech
let activeUtterance: SpeechSynthesisUtterance | null = null;

export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface SpeakOptions {
  lang?: 'id' | 'en';
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

/**
 * Checks if the browser runtime supports Web Speech Recognition (STT).
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as IWindowWithSpeech;
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

/**
 * Checks if the browser runtime supports SpeechSynthesis (TTS).
 */
export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export interface MicrophonePermissionResult {
  granted: boolean;
  error?: string;
}

/**
 * Prompts the user for microphone access via getUserMedia if not yet authorized.
 * This explicitly triggers the browser's native permission bubble (which webkitSpeechRecognition
 * does not consistently trigger on HTTP/loopback origins in Chromium).
 */
export async function requestMicrophonePermission(): Promise<MicrophonePermissionResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { granted: false, error: 'mediaDevices_unavailable' };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop all audio tracks so the microphone hardware is freed for Web Speech recognition
    stream.getTracks().forEach((track) => track.stop());
    return { granted: true };
  } catch (err: unknown) {
    const errName = err instanceof Error ? err.name : String(err);
    return { granted: false, error: errName };
  }
}

/**
 * Sanitizes markdown, defanged URLs, long technical hashes, and code blocks
 * into natural conversational prose for clear, human-like voice synthesis.
 */
export function sanitizeTextForSpeech(rawText: string, lang: 'id' | 'en' = 'id'): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Remove markdown code blocks ``` ... ```
  text = text.replace(/```[\s\S]*?```/g, lang === 'en' ? ' (code snippet omitted) ' : ' (blok kode dilewati) ');

  // 2. Remove inline code backticks `...`
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3. Clean markdown links [label](url) -> label
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 4. Remove markdown bold/italics/strikethrough
  text = text.replace(/[*_~]{1,3}(.*?)[*_~]{1,3}/g, '$1');

  // 5. Remove long hex hashes (SHA-256 64-char or MD5 32-char) so the voice doesn't spell 64 letters
  text = text.replace(/\b[a-fA-F0-9]{32,64}\b/g, lang === 'en' ? ' cryptographic hash ' : ' kode hash bukti ');

  // 6. Clean defanged URLs: hxxp://, hxxps://, [.]
  text = text
    .replace(/hxxps?:\/\//gi, 'https://')
    .replace(/\[\.\]/g, '.');

  // 7. Expand common acronyms for clearer pronunciation
  text = text
    .replace(/\bOTP\b/g, 'O T P')
    .replace(/\bPIN\b/g, 'P I N')
    .replace(/\bAPK\b/g, 'A P K')
    .replace(/\bIoC\b/gi, lang === 'en' ? 'indicators of compromise' : 'indikator ancaman')
    .replace(/\bBCA\b/g, 'B C A')
    .replace(/\bBRI\b/g, 'B R I')
    .replace(/\bBNI\b/g, 'B N I');

  // 8. Clean excess whitespace and newlines
  text = text.replace(/\s+/g, ' ').trim();

  // 9. Cap length to max 350 chars of natural advice to avoid droning on
  if (text.length > 350) {
    const truncated = text.slice(0, 350);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > 180) {
      text = truncated.slice(0, lastPeriod + 1);
    } else {
      text = truncated + '...';
    }
  }

  return text;
}

/**
 * Speaks text using SpeechSynthesis with appropriate language and pitch/rate tuning.
 */
export function speakText(
  rawText: string,
  options: SpeakOptions = {}
): { cancel: () => void } {
  if (!isSpeechSynthesisSupported()) {
    options.onError?.(new Error('SpeechSynthesis is not supported in this browser environment.'));
    return { cancel: () => {} };
  }

  const {
    lang = 'id',
    rate = 1.0,
    pitch = 1.0,
    onStart,
    onEnd,
    onError,
  } = options;

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();
  }

  const cleanText = sanitizeTextForSpeech(rawText, lang);
  if (!cleanText) {
    onEnd?.();
    return { cancel: () => {} };
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeUtterance = utterance;

  utterance.lang = lang === 'en' ? 'en-US' : 'id-ID';
  utterance.rate = Math.max(0.6, Math.min(1.5, rate));
  utterance.pitch = Math.max(0.7, Math.min(1.4, pitch));
  utterance.volume = 1.0;

  // Voice preference matching if available
  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const targetPrefix = lang === 'en' ? 'en' : 'id';
      const matchedVoice = voices.find((v) =>
        v.lang.toLowerCase().replace('_', '-').startsWith(targetPrefix)
      );
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    }
  } catch {
    // Ignore voice enumeration failures
  }

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    activeUtterance = null;
    onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    // Treat user cancel / interrupt as non-fatal
    if (e.error === 'interrupted' || e.error === 'canceled') {
      onEnd?.();
    } else {
      onError?.(e);
    }
  };

  try {
    window.speechSynthesis.speak(utterance);
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (err) {
    activeUtterance = null;
    onError?.(err);
  }

  return {
    cancel: () => {
      window.speechSynthesis.cancel();
      activeUtterance = null;
      onEnd?.();
    },
  };
}

/**
 * Halts any active text-to-speech output immediately.
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (activeUtterance) {
    activeUtterance = null;
  }
}

/**
 * Checks if the browser is currently synthesizing speech.
 */
export function isCurrentlySpeaking(): boolean {
  return activeUtterance !== null || (typeof window !== 'undefined' && !!window.speechSynthesis?.speaking);
}

/**
 * Creates an instance of SpeechRecognition with bilingual support and callbacks.
 */
export function createSpeechRecognizer(options: {
  lang?: 'id' | 'en';
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: unknown) => void;
  onStart?: () => void;
  onEnd?: () => void;
}): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    options.onError?.(new Error('SpeechRecognition is not supported in this browser.'));
    return null;
  }

  const win = window as unknown as IWindowWithSpeech;
  const RecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!RecognitionClass) return null;

  const recognition = new RecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = options.lang === 'en' ? 'en-US' : 'id-ID';

  recognition.onstart = () => {
    options.onStart?.();
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  recognition.onerror = (event: Event) => {
    const errorEvent = event as unknown as { error?: string };
    const code = errorEvent?.error || 'unknown';
    let friendly = options.lang === 'en' ? 'Voice recognition error.' : 'Kendala pengenalan suara.';

    if (code === 'not-allowed') {
      friendly =
        options.lang === 'en'
          ? 'Microphone permission was blocked. Please click the site settings / padlock icon in your browser address bar, set Microphone to "Allow", and verify Windows Microphone privacy settings.'
          : 'Izin mikrofon belum diizinkan atau diblokir. Silakan klik ikon gembok/setelan situs di sebelah kiri bilah alamat browser Anda dan ubah Mikrofon menjadi "Izinkan" (Allow), serta pastikan akses mikrofon aktif di pengaturan Windows.';
    } else if (code === 'no-speech') {
      friendly =
        options.lang === 'en'
          ? 'No speech detected. Please speak clearly into your microphone.'
          : 'Tidak ada suara yang terdeteksi. Silakan coba berbicara lebih dekat/jelas ke mikrofon Anda.';
    } else if (code === 'network') {
      friendly =
        options.lang === 'en'
          ? 'Web Speech service network error. Chrome requires an internet connection for speech recognition.'
          : 'Layanan suara browser membutuhkan koneksi internet (Chrome Web Speech API). Pastikan koneksi internet aktif.';
    } else if (code === 'audio-capture') {
      friendly =
        options.lang === 'en'
          ? 'No microphone hardware found or audio device is in use by another app.'
          : 'Perangkat mikrofon tidak ditemukan atau sedang dipakai aplikasi lain.';
    }

    options.onError?.(new Error(friendly));
  };

  recognition.onresult = (event: ISpeechRecognitionEvent) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    if (finalTranscript) {
      options.onResult(finalTranscript.trim(), true);
    } else if (interimTranscript) {
      options.onResult(interimTranscript.trim(), false);
    }
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch (err) {
        options.onError?.(err);
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Recognition already stopped
      }
    },
    abort: () => {
      try {
        recognition.abort();
      } catch {
        // Recognition already aborted
      }
    },
  };
}
