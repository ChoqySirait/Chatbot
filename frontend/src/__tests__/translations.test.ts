import { describe, expect, it } from 'vitest';
import { translations } from '../i18n/translations';

function collectLeafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const paths: string[] = [];
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key];
    const fullPath = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      paths.push(...collectLeafPaths(value as Record<string, unknown>, fullPath));
    } else {
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
      paths.push(fullPath);
    }
  }
  return paths;
}

describe('Bilingual i18n Translations (ID / EN)', () => {
  it('maintains 100% key and section parity between Indonesian and English dictionaries', () => {
    const idPaths = collectLeafPaths(translations.id as unknown as Record<string, unknown>);
    const enPaths = collectLeafPaths(translations.en as unknown as Record<string, unknown>);
    expect(idPaths.length).toBeGreaterThan(50);
    expect(idPaths).toEqual(enPaths);
  });
});
