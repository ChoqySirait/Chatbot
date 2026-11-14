import { describe, expect, it, vi } from 'vitest';
import {
  sanitizeTextForSpeech,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speakText,
  stopSpeaking,
} from '../utils/speechController';

describe('Web Speech Controller & Sanitization (VOICE-01)', () => {
  it('correctly cleans markdown formatting and links for natural pronunciation', () => {
    const raw = 'Halo **Sobat**, silakan periksa tautan [BCA](https://bca.co.id) dan jangan berikan `kode rahasia`.';
    const clean = sanitizeTextForSpeech(raw, 'id');
    expect(clean).toContain('Halo Sobat, silakan periksa tautan B C A');
    expect(clean).toContain('jangan berikan kode rahasia');
    expect(clean).not.toContain('**');
    expect(clean).not.toContain('`');
    expect(clean).not.toContain('[');
    expect(clean).not.toContain(']');
  });

  it('replaces defanged URLs and expands acronyms for clear spoken output', () => {
    const raw = 'Terdeteksi phishing di hxxp://bca-promo[.]online. Segera amankan kode OTP Anda.';
    const clean = sanitizeTextForSpeech(raw, 'id');
    expect(clean).toContain('https://bca-promo.online');
    expect(clean).toContain('O T P');
    expect(clean).not.toContain('hxxp://');
    expect(clean).not.toContain('[.]');
  });

  it('strips long raw hexadecimal hashes so speech does not recite 64 characters', () => {
    const raw = 'Bukti disegel dengan SHA-256: 7cac7bad345f982fce59d55a6bcec12cff24b3f4660a908ab9ea867faad16c60 secara lokal.';
    const cleanId = sanitizeTextForSpeech(raw, 'id');
    expect(cleanId).toContain('kode hash bukti');
    expect(cleanId).not.toContain('7cac7bad345f982fce59d55a6bcec12cff24b3f4660a908ab9ea867faad16c60');

    const cleanEn = sanitizeTextForSpeech(raw, 'en');
    expect(cleanEn).toContain('cryptographic hash');
  });

  it('omits markdown code blocks without disrupting remaining advice', () => {
    const raw = 'Ikuti langkah berikut: ```bash\nrm -rf /tmp\n``` Laporkan segera ke call center.';
    const clean = sanitizeTextForSpeech(raw, 'id');
    expect(clean).toContain('blok kode dilewati');
    expect(clean).toContain('Laporkan segera ke call center');
    expect(clean).not.toContain('rm -rf');
  });

  it('truncates excessively long verbose responses to prevent droning', () => {
    const longText = 'Kalimat pertama sangat penting. ' + 'Kalimat tambahan yang sangat panjang dan terus berlanjut tanpa henti untuk menguji pemotongan teks secara otomatis. '.repeat(10);
    const clean = sanitizeTextForSpeech(longText, 'id');
    expect(clean.length).toBeLessThanOrEqual(360);
  });

  it('safely handles environments where SpeechSynthesis is unavailable or mocked', () => {
    // In node/vitest, window.speechSynthesis may be undefined
    const isSupported = isSpeechSynthesisSupported();
    expect(typeof isSupported).toBe('boolean');

    const isRecSupported = isSpeechRecognitionSupported();
    expect(typeof isRecSupported).toBe('boolean');

    const onError = vi.fn();
    const result = speakText('Halo dunia', { onError });
    expect(result).toHaveProperty('cancel');

    expect(() => stopSpeaking()).not.toThrow();
  });
});
