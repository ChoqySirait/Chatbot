import { createContext } from 'react';
import { translations, type Language } from '../i18n/translations';

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.id;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
