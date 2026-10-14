import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  LANGUAGES,
  SupportedLanguageCode,
  SUPPORTED_LANGUAGE_CODES,
  getFallbackChain,
  isRTL,
  getLanguage,
} from './languages';
import enResource from './locales/en.json';

// In-memory cache of loaded locale JSON modules
const loadedLocales = new Map<string, any>();
loadedLocales.set('en', enResource);

export const DEFAULT_LANGUAGE: SupportedLanguageCode = 'en';
const STORAGE_KEY = 'ekalsahayak_lang';
const NUMERALS_KEY = 'ekalsahayak_numerals';
const AI_SAME_LANG_KEY = 'ekalsahayak_ai_same_lang';
const KEEP_TERMS_KEY = 'ekalsahayak_keep_terms';

export function getInitialLanguage(): SupportedLanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;

  // 1. Stored user selection
  const stored = localStorage.getItem(STORAGE_KEY) as SupportedLanguageCode | null;
  if (stored && (SUPPORTED_LANGUAGE_CODES as readonly string[]).includes(stored)) {
    return stored;
  }

  // 2. Browser navigator.languages detection
  if (navigator.languages) {
    for (const navLang of navigator.languages) {
      const code = navLang.split('-')[0].toLowerCase();
      const direct = (SUPPORTED_LANGUAGE_CODES as readonly string[]).find(
        (c) => c.toLowerCase() === navLang.toLowerCase() || c.toLowerCase() === code
      );
      if (direct) {
        return direct as SupportedLanguageCode;
      }
    }
  }

  return DEFAULT_LANGUAGE;
}

export function getStoredNumerals(): 'latin' | 'local' {
  if (typeof window === 'undefined') return 'latin';
  return (localStorage.getItem(NUMERALS_KEY) as 'latin' | 'local') || 'latin';
}

export function setStoredNumerals(mode: 'latin' | 'local') {
  localStorage.setItem(NUMERALS_KEY, mode);
  window.dispatchEvent(new CustomEvent('ekalsahayak:numerals-changed', { detail: mode }));
}

export function getStoredAiSameLanguage(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(AI_SAME_LANG_KEY);
  return stored !== null ? stored === 'true' : true;
}

export function setStoredAiSameLanguage(val: boolean) {
  localStorage.setItem(AI_SAME_LANG_KEY, String(val));
}

export function getStoredKeepEnglishTerms(): boolean {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(KEEP_TERMS_KEY);
  return stored !== null ? stored === 'true' : true;
}

export function setStoredKeepEnglishTerms(val: boolean) {
  localStorage.setItem(KEEP_TERMS_KEY, String(val));
}

export async function loadLocaleResource(langCode: string) {
  if (loadedLocales.has(langCode)) {
    return loadedLocales.get(langCode);
  }

  try {
    const mod = await import(`./locales/${langCode}.json`);
    const data = mod.default || mod;
    loadedLocales.set(langCode, data);
    i18n.addResourceBundle(langCode, 'translation', data, true, true);
    return data;
  } catch (err) {
    console.warn(`Failed to lazy load locale ${langCode}, falling back to English`, err);
    return enResource;
  }
}

export async function setAppLanguage(
  targetLanguage: SupportedLanguageCode,
  syncToServer: boolean = true
): Promise<void> {
  const meta = getLanguage(targetLanguage);

  // 1. Ensure target bundle + its fallback chain are loaded
  await loadLocaleResource(targetLanguage);
  for (const fb of meta.fallbackChain) {
    if (fb !== 'en') {
      await loadLocaleResource(fb);
    }
  }

  // 2. Change language in i18next
  await i18n.changeLanguage(targetLanguage);

  // 3. Update DOM attributes and CSS variables
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('lang', targetLanguage);
    const rtl = isRTL(targetLanguage);
    root.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    root.style.setProperty('--font-ui', meta.fontFamily);
  }

  // 4. Persist locally
  localStorage.setItem(STORAGE_KEY, targetLanguage);

  // 5. Notify app components
  window.dispatchEvent(
    new CustomEvent('ekalsahayak:language-changed', {
      detail: { language: targetLanguage, meta },
    })
  );

  // 6. Sync to server if authenticated
  if (syncToServer && typeof window !== 'undefined') {
    try {
      const token = localStorage.getItem('ekalsahayak_token') || sessionStorage.getItem('token');
      if (token) {
        fetch('/api/auth/me/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            language: targetLanguage,
            numerals: getStoredNumerals(),
            ai_same_language: getStoredAiSameLanguage(),
            keep_english_terms: getStoredKeepEnglishTerms(),
          }),
        }).catch((e) => console.debug('Preference sync queued for next sync:', e));
      }
    } catch {
      // Offline: ignored, persisted in localStorage
    }
  }
}

// Initial initialization
const initialLang = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    lng: initialLang,
    fallbackLng: getFallbackChain(initialLang),
    resources: {
      en: {
        translation: enResource,
      },
    },
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false,
    },
  })
  .then(() => {
    // If initial is not English, load it immediately
    if (initialLang !== 'en') {
      setAppLanguage(initialLang, false);
    } else if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', 'en');
      document.documentElement.setAttribute('dir', 'ltr');
    }
  });

export default i18n;
