/**
 * Internationalized number, percent, and date formatting utilities.
 * Supports switching between standard Latin numerals (0-9) and local script numerals (୧୨୩ / १२३).
 */

import { getLanguage, SupportedLanguageCode } from '@/i18n/languages';

export type NumeralSystem = 'latin' | 'local';

// Script digit mapping fallback for environments or locales lacking Intl numberingSystem support
const LOCAL_DIGIT_MAPS: Partial<Record<string, string[]>> = {
  // Odia (or, kxu)
  'or-IN': ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'],
  'or': ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'],
  'kxu': ['୦', '୧', '୨', '୩', '୪', '୫', '୬', '୭', '୮', '୯'],
  // Devanagari (hi, mr, ne, sa, bho, mai, mag, raj, hne, doi, kok, brx)
  'hi-IN': ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  'hi': ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  'mr': ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'],
  // Bengali / Assamese / Manipuri
  'bn-IN': ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'],
  'bn': ['০', '১', '২', '৩', '৪', '৫', '६', '৭', '৮', '৯'],
  // Gujarati
  'gu-IN': ['૦', '૧', '૨', '૩', '૪', '૫', '૬', '૭', '૮', '૯'],
  // Gurmukhi (pa)
  'pa-IN': ['੦', '੧', '੨', '੩', '੪', '੫', '੬', '੭', '੮', '੯'],
  // Tamil
  'ta-IN': ['௦', '௧', '௨', '௩', '௪', '௫', '௬', '௭', '௮', '௯'],
  // Telugu
  'te-IN': ['౦', '౧', '౨', '౩', '౪', '౫', '౬', '౭', '౮', '౯'],
  // Kannada (kn, tcy)
  'kn-IN': ['೦', '೧', '೨', '೩', '೪', '೫', '೬', '೭', '೮', '೯'],
  // Malayalam
  'ml-IN': ['൦', '൧', '൨', '൩', '൪', '൫', '൬', '൭', '൮', '൯'],
  // Arabic-Indic (ur, ks, sd)
  'ur-IN': ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'],
  // Santali (Ol Chiki)
  'sat-IN': ['᱐', '᱑', '᱒', '᱓', '᱔', '᱕', '᱖', '᱗', '᱘', '᱙'],
};

export function convertDigitsToLocal(text: string, locale: string): string {
  const digits = LOCAL_DIGIT_MAPS[locale] || LOCAL_DIGIT_MAPS[locale.split('-')[0]];
  if (!digits) return text;
  return text.replace(/[0-9]/g, (digit) => digits[parseInt(digit, 10)] || digit);
}

/**
 * Formats a decimal number (0..1) as a percentage string (e.g. 0.6 -> "60%", 0.45 -> "45%").
 * Explicitly fixes Phase 4 Bug 1: Mastery displayed as 0.6% instead of 60%.
 */
export function formatPercent(
  value: number,
  localeCode: string = 'en',
  numerals: NumeralSystem = 'latin'
): string {
  // Normalize value in case a percentage integer (e.g. 60 instead of 0.6) was accidentally provided
  let ratio = value;
  if (ratio > 1.0 && ratio <= 100.0) {
    ratio = ratio / 100.0;
  }
  ratio = Math.max(0, Math.min(1.0, ratio));

  const langMeta = getLanguage(localeCode);
  const intlLocale = langMeta.intlLocale || 'en-IN';

  let formatted = '';
  try {
    const formatter = new Intl.NumberFormat(intlLocale, {
      style: 'percent',
      maximumFractionDigits: 1,
    });
    formatted = formatter.format(ratio);
  } catch {
    formatted = `${Math.round(ratio * 100)}%`;
  }

  if (numerals === 'local') {
    return convertDigitsToLocal(formatted, intlLocale);
  }
  return formatted;
}

/**
 * Formats a standard numeric value with active locale separators.
 */
export function formatNumber(
  value: number,
  localeCode: string = 'en',
  numerals: NumeralSystem = 'latin',
  fractionDigits: number = 0
): string {
  const langMeta = getLanguage(localeCode);
  const intlLocale = langMeta.intlLocale || 'en-IN';

  let formatted = '';
  try {
    const formatter = new Intl.NumberFormat(intlLocale, {
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    });
    formatted = formatter.format(value);
  } catch {
    formatted = value.toFixed(fractionDigits);
  }

  if (numerals === 'local') {
    return convertDigitsToLocal(formatted, intlLocale);
  }
  return formatted;
}

/**
 * Formats a date with active locale.
 */
export function formatDate(
  date: Date | string | number,
  localeCode: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  const langMeta = getLanguage(localeCode);
  const intlLocale = langMeta.intlLocale || 'en-IN';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;

  try {
    return new Intl.DateTimeFormat(
      intlLocale,
      options || { dateStyle: 'medium' }
    ).format(d);
  } catch {
    return d.toLocaleDateString();
  }
}
