import { describe, it, expect } from 'vitest';
import {
  encryptVaultPayload,
  decryptVaultPayload,
  isEncryptedEnvelope,
} from '../utils/vaultCrypto';

describe('vaultCrypto (INC-08 client-side PBKDF2 + AES-GCM encryption)', () => {
  const samplePayload = JSON.stringify({
    caseId: 'INC-2026-TEST',
    secretNotes: 'Victim PIN was changed immediately, scammer bank is BCA 9988776655.',
    amountLost: 15000000,
  });
  const passphrase = 'SuperSecretPassphrase123!';

  it('encrypts payload into a valid AES-256-GCM envelope and decrypts cleanly', async () => {
    const envelopeJson = await encryptVaultPayload(samplePayload, passphrase, 5000);
    const parsed = JSON.parse(envelopeJson);

    expect(isEncryptedEnvelope(parsed)).toBe(true);
    expect(parsed.cipher).toBe('AES-256-GCM');
    expect(parsed.kdf).toBe('PBKDF2-HMAC-SHA256');
    expect(parsed.iterations).toBe(5000);
    expect(parsed.ciphertextHex).toBeDefined();
    expect(parsed.saltHex.length).toBe(32); // 16 bytes = 32 hex chars
    expect(parsed.ivHex.length).toBe(24); // 12 bytes = 24 hex chars
    expect(parsed.threatModelNotice).toContain('AES-256-GCM');

    // Decrypt
    const decrypted = await decryptVaultPayload(envelopeJson, passphrase);
    expect(decrypted).toBe(samplePayload);
    expect(JSON.parse(decrypted).caseId).toBe('INC-2026-TEST');
  });

  it('rejects decryption with incorrect passphrase', async () => {
    const envelopeJson = await encryptVaultPayload(samplePayload, passphrase, 2000);
    await expect(
      decryptVaultPayload(envelopeJson, 'WrongPasswordEntirely')
    ).rejects.toThrow(/Incorrect passphrase/i);
  });

  it('rejects decryption with tampered ciphertext', async () => {
    const envelopeJson = await encryptVaultPayload(samplePayload, passphrase, 2000);
    const parsed = JSON.parse(envelopeJson);
    // Flip first character of ciphertextHex
    const flippedChar = parsed.ciphertextHex[0] === 'a' ? 'b' : 'a';
    parsed.ciphertextHex = flippedChar + parsed.ciphertextHex.slice(1);

    await expect(
      decryptVaultPayload(JSON.stringify(parsed), passphrase)
    ).rejects.toThrow(/Incorrect passphrase or tampered ciphertext/i);
  });

  it('rejects passphrases shorter than 6 characters', async () => {
    await expect(encryptVaultPayload(samplePayload, '12345')).rejects.toThrow(
      /at least 6 characters/i
    );
  });

  it('correctly identifies non-envelope objects', () => {
    expect(isEncryptedEnvelope(null)).toBe(false);
    expect(isEncryptedEnvelope({})).toBe(false);
    expect(isEncryptedEnvelope({ format: 'other' })).toBe(false);
    expect(isEncryptedEnvelope('not an object')).toBe(false);
  });
});
