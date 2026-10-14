// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import i18n, { setAppLanguage, getInitialLanguage, getStoredNumerals, setStoredNumerals } from '../index';
import {
  LANGUAGES,
  SUPPORTED_LANGUAGE_CODES,
  getFallbackChain,
  isRTL,
  SupportedLanguageCode,
} from '../languages';

describe('i18n Foundation & Languages Configuration', () => {
  it('defines exactly 30 supported languages matching backend enum parity', () => {
    expect(SUPPORTED_LANGUAGE_CODES.length).toBe(30);
    // Tier A (13)
    const tierA = ['en', 'hi', 'or', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'ur', 'as'];
    for (const code of tierA) {
      expect(LANGUAGES[code as SupportedLanguageCode].tier).toBe('A');
    }
    // Tier B (16)
    const tierB = [
      'brx', 'doi', 'ks', 'kok', 'mai', 'mni', 'ne', 'sa', 'sat', 'sd',
      'bho', 'tcy', 'kxu', 'raj', 'hne', 'mag'
    ];
    for (const code of tierB) {
      expect(LANGUAGES[code as SupportedLanguageCode].tier).toBe('B');
    }
    // Special (1)
    expect(LANGUAGES['hi-Latn'].tier).toBe('Special');
  });

  it('correctly maps RTL direction for ur, ks, and sd', () => {
    expect(isRTL('ur')).toBe(true);
    expect(isRTL('ks')).toBe(true);
    expect(isRTL('sd')).toBe(true);
    expect(isRTL('hi')).toBe(false);
    expect(isRTL('or')).toBe(false);
    expect(isRTL('en')).toBe(false);
  });

  it('validates fallback chains per specification', () => {
    // kui -> or -> hi -> en
    expect(getFallbackChain('kxu')).toEqual(['or', 'hi', 'en']);
    // tcy -> kn -> en
    expect(getFallbackChain('tcy')).toEqual(['kn', 'en']);
    // bho/mai/mag -> hi -> en
    expect(getFallbackChain('bho')).toEqual(['hi', 'en']);
    expect(getFallbackChain('mai')).toEqual(['hi', 'en']);
    expect(getFallbackChain('mag')).toEqual(['hi', 'en']);
    // raj/hne -> hi -> en
    expect(getFallbackChain('raj')).toEqual(['hi', 'en']);
    expect(getFallbackChain('hne')).toEqual(['hi', 'en']);
    // sa -> hi -> en
    expect(getFallbackChain('sa')).toEqual(['hi', 'en']);
    // kok -> mr -> en
    expect(getFallbackChain('kok')).toEqual(['mr', 'en']);
    // doi -> hi -> en
    expect(getFallbackChain('doi')).toEqual(['hi', 'en']);
    // brx -> as -> en
    expect(getFallbackChain('brx')).toEqual(['as', 'en']);
    // mni -> bn -> en
    expect(getFallbackChain('mni')).toEqual(['bn', 'en']);
    // hi-Latn -> hi -> en
    expect(getFallbackChain('hi-Latn')).toEqual(['hi', 'en']);
  });
});

describe('Language Switching & DOM Updates', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('switches language instantly and updates document lang, dir, and --font-ui', async () => {
    // Switch to Odia
    await setAppLanguage('or', false);
    expect(i18n.language).toBe('or');
    expect(document.documentElement.getAttribute('lang')).toBe('or');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.style.getPropertyValue('--font-ui')).toContain('Noto Sans Oriya');
    expect(localStorage.getItem('ekalsahayak_lang')).toBe('or');

    // Switch to Urdu (RTL)
    await setAppLanguage('ur', false);
    expect(i18n.language).toBe('ur');
    expect(document.documentElement.getAttribute('lang')).toBe('ur');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.style.getPropertyValue('--font-ui')).toContain('Urdu');

    // Switch to Hinglish (WhatsApp Roman style)
    await setAppLanguage('hi-Latn', false);
    expect(i18n.language).toBe('hi-Latn');
    expect(document.documentElement.getAttribute('lang')).toBe('hi-Latn');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('never displays a raw missing key pattern in translated outputs', () => {
    // Check known keys translate to strings, not raw keys
    const title = i18n.t('settings.title');
    expect(title).not.toMatch(/^settings\.title$/);
    expect(typeof title).toBe('string');

    const appName = i18n.t('common.appName');
    expect(appName).not.toMatch(/^common\.appName$/);
  });

  it('persists and restores numerals system preference', () => {
    expect(getStoredNumerals()).toBe('latin');
    setStoredNumerals('local');
    expect(getStoredNumerals()).toBe('local');
    setStoredNumerals('latin');
    expect(getStoredNumerals()).toBe('latin');
  });
});
