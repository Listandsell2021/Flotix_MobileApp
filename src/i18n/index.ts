import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as RNLocalize from 'react-native-localize';

import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import hi from './locales/hi.json';
import zh from './locales/zh.json';

const LANGUAGE_KEY = '@app_language';

const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  hi: { translation: hi },
  zh: { translation: zh },
};

const languageDetector: any = {
  type: 'languageDetector',
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      // First, try to get the saved language
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }

      // Otherwise, use device language
      const deviceLocales = RNLocalize.getLocales();
      const availableLanguages = Object.keys(resources);

      // Find the first device locale that matches our available languages
      let bestLanguage = 'en'; // default fallback
      for (const locale of deviceLocales) {
        if (availableLanguages.includes(locale.languageCode)) {
          bestLanguage = locale.languageCode;
          break;
        }
      }

      callback(bestLanguage);
    } catch (error) {
      console.error('Error detecting language:', error);
      callback('en');
    }
  },
  init: () => {},
  cacheUserLanguage: async (language: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4' as any,
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// Helper function to change language
export const changeLanguage = async (language: string) => {
  try {
    console.log('Changing language to:', language);
    await i18n.changeLanguage(language);
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
    // Force the language detector to cache the new language
    if (languageDetector.cacheUserLanguage) {
      await languageDetector.cacheUserLanguage(language);
    }
    console.log('Language changed successfully to:', language);
    console.log('Current i18n language:', i18n.language);
  } catch (error) {
    console.error('Error changing language:', error);
  }
};

// Get available languages
export const getLanguages = () => [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];