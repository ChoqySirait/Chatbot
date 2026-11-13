/**
 * Client-Side Vault Encryption Utility (INC-08).
 * Uses standard Web Crypto API (PBKDF2-HMAC-SHA256 + AES-256-GCM).
 *
 * THREAT MODEL & LIMITATIONS:
 * - Protects exported case archives and vault backups at rest against unauthorized inspection
 *   when transferred via untrusted storage or email.
 * - Does NOT protect against an attacker with active code execution or malware on the host machine.
 * - Passphrase recovery is mathematically impossible without the original passphrase.
 */

import { computeClientSha256 } from '../db';

export interface EncryptedVaultEnvelope {
  format: 'securai-encrypted-envelope';
  version: '1.0';
  kdf: 'PBKDF2-HMAC-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
  checksumSha256: string;
  encryptedAt: string;
  threatModelNotice: string;
}

const DEFAULT_ITERATIONS = 100000;
const THREAT_MODEL_NOTICE =
  'SecurAI client-side encryption protects data-at-rest with AES-256-GCM. Passphrase recovery is mathematically impossible. This does not protect against malware on the host machine.';

function bufferToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal string length');
  }
  const buffer = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

export function isEncryptedEnvelope(obj: unknown): obj is EncryptedVaultEnvelope {
  if (!obj || typeof obj !== 'object') return false;
  const item = obj as Record<string, unknown>;
  return (
    item.format === 'securai-encrypted-envelope' &&
    item.cipher === 'AES-256-GCM' &&
    typeof item.ciphertextHex === 'string' &&
    typeof item.saltHex === 'string' &&
    typeof item.ivHex === 'string'
  );
}

export async function encryptVaultPayload(
  plainText: string,
  passphrase: string,
  iterations = DEFAULT_ITERATIONS
): Promise<string> {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Passphrase must be at least 6 characters');
  }

  const crypto = globalThis.crypto;
  if (!crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const aesKey = await crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  const plainBytes = encoder.encode(plainText);
  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plainBytes
  );

  const checksumSha256 = await computeClientSha256(plainText);

  const envelope: EncryptedVaultEnvelope = {
    format: 'securai-encrypted-envelope',
    version: '1.0',
    kdf: 'PBKDF2-HMAC-SHA256',
    iterations,
    cipher: 'AES-256-GCM',
    saltHex: bufferToHex(salt),
    ivHex: bufferToHex(iv),
    ciphertextHex: bufferToHex(encryptedBuf),
    checksumSha256,
    encryptedAt: new Date().toISOString(),
    threatModelNotice: THREAT_MODEL_NOTICE,
  };

  return JSON.stringify(envelope, null, 2);
}

export async function decryptVaultPayload(
  envelopeInput: string | EncryptedVaultEnvelope,
  passphrase: string
): Promise<string> {
  if (!passphrase) {
    throw new Error('Passphrase is required to decrypt this bundle');
  }

  const crypto = globalThis.crypto;
  if (!crypto?.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment');
  }

  const envelope: EncryptedVaultEnvelope =
    typeof envelopeInput === 'string' ? JSON.parse(envelopeInput) : envelopeInput;

  if (!isEncryptedEnvelope(envelope)) {
    throw new Error('Unrecognized or invalid encrypted vault envelope format');
  }

  const salt = hexToBuffer(envelope.saltHex);
  const iv = hexToBuffer(envelope.ivHex);
  const ciphertext = hexToBuffer(envelope.ciphertextHex);
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: envelope.iterations || DEFAULT_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const aesKey = await crypto.subtle.importKey(
    'raw',
    derivedBits,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  let decryptedBuf: ArrayBuffer;
  try {
    decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      aesKey,
      ciphertext.buffer as ArrayBuffer
    );
  } catch {
    throw new Error('Decryption failed: Incorrect passphrase or tampered ciphertext');
  }

  const plainText = new TextDecoder().decode(decryptedBuf);
  const actualChecksum = await computeClientSha256(plainText);

  if (
    envelope.checksumSha256 &&
    actualChecksum.toLowerCase() !== envelope.checksumSha256.toLowerCase()
  ) {
    throw new Error('Integrity check failed: Decrypted content checksum does not match');
  }

  return plainText;
}
